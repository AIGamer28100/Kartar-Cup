import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { useReducedMotion } from 'framer-motion';
import { ArrowCounterClockwise, HandGrabbing, Pause, Play } from '@phosphor-icons/react';
import type { TrackProfile } from '../config/tracks/profiles';
import { bezierAt, EASE, formatLapTime } from '../lib/motion';
import { distanceFractions, sectorOfIndex, sectorRanges } from '../lib/trackGeometry';
import {
  chunkRanges,
  clampPitch,
  climbStats,
  decay,
  depthOrder,
  easeFit,
  fitBounds,
  makeCamera,
  normalizeTrack,
  project,
  toScreen,
  wrapYaw,
  yawDelta,
  type Camera,
  type Fit,
  type P3,
} from '../lib/track3d';

/*
 * R41: ONE track graphic showing BOTH colour-coded sectors and elevation, as a true 3D view of the
 * circuit (owner decision 2026-10-07: no elevation chart, no slider, constant line thickness).
 *
 * - The real qualifying-lap trace (OpenF1 telemetry) is lifted by its real elevation (normalised and
 *   exaggerated so it reads; the legend states by how much) and seen through a perspective orbit
 *   camera looking down at ~56 degrees. A soft ground shadow, a translucent curtain and drop-lines
 *   show the height; the line brightens with height (low = darker, high = brighter) on top of its
 *   sector colour; sectors are also labelled S1/S2/S3, so colour is never the only cue.
 * - Painter's algorithm over short chunks, sorted by depth, so where a track crosses itself the
 *   nearer/higher part draws over the lower one.
 * - A chequered start/finish gantry, a kart marker lapping at telemetry pace (samples are about
 *   evenly spaced in time, so it brakes into corners) with a fading trail, and a gentle idle camera
 *   drift. Drag (mouse or touch) or arrow keys rotate; inertia on release; double-click/tap, Home or
 *   the Reset button return to the default view. A Pause button stops all automatic motion.
 * - Canvas + custom projection maths (src/lib/track3d.ts), no 3D library. Per-frame work lives in
 *   refs and one rAF loop that sleeps when nothing moves or the card is off screen.
 * - prefers-reduced-motion: static default view, no drift, no lap, no inertia; still rotatable.
 */

const DEFAULT_YAW = -24;
const DEFAULT_PITCH = 52;
const DIST = 3.2;
const CHUNK = 5;
const LAP_S = 9;
const DRAW_S = 1.6;
const DRIFT_DEG = 9;
const DRIFT_PERIOD_MS = 18000;
const RESET_MS = 650;

const SECTOR_META = [
  { label: 'Sector 1', short: 'S1', token: '--color-accent-text', fallback: '#ff4d61' },
  { label: 'Sector 2', short: 'S2', token: '--color-warn', fallback: '#f5b942' },
  { label: 'Sector 3', short: 'S3', token: '--color-info', fallback: '#6d92ff' },
] as const;

type RGB = [number, number, number];

interface Palette {
  sectors: RGB[];
  ink: RGB;
  base: RGB;
  raised: RGB;
  surface: RGB;
  line: RGB;
  muted: RGB;
  accent: RGB;
  chequerLight: RGB;
  chequerDark: RGB;
  mono: string;
}

function hexToRgb(hex: string, fallback: string): RGB {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim()) ?? /^#?([0-9a-f]{6})$/i.exec(fallback)!;
  const v = parseInt(m[1], 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

/** Read the palette tokens from CSS once (canvas cannot use var()); fall back to the token values. */
function readPalette(): Palette {
  const cs = getComputedStyle(document.documentElement);
  const tok = (name: string, fb: string) => hexToRgb(cs.getPropertyValue(name) || fb, fb);
  return {
    sectors: SECTOR_META.map((s) => tok(s.token, s.fallback)),
    ink: tok('--color-ink', '#f2f5fa'),
    base: tok('--color-base', '#070b14'),
    raised: tok('--color-raised', '#0f1626'),
    surface: tok('--color-surface', '#172138'),
    line: tok('--color-line', '#232b3d'),
    muted: tok('--color-muted', '#9aa6bd'),
    accent: tok('--color-accent', '#d81e36'),
    chequerLight: tok('--color-chequer-light', '#ffffff'),
    chequerDark: tok('--color-chequer-dark', '#000000'),
    mono: cs.getPropertyValue('--font-mono').trim() || 'ui-monospace, monospace',
  };
}

const rgba = (c: RGB, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

const MINUS = '−';

export default function TrackLayout({ profile, name, lengthKm }: { profile: TrackProfile; name: string; lengthKm?: number }) {
  const reduce = useReducedMotion() ?? false;

  const geo = useMemo(() => {
    const world = normalizeTrack(profile.pts, lengthKm);
    const n = world.pts.length;
    const ranges = sectorRanges(n, profile.s1End, profile.s2End);
    // Chunks never straddle a sector boundary, so each has one colour.
    const chunks: { a: number; b: number; sector: 0 | 1 | 2; k: number }[] = [];
    ranges.forEach(([ra, rb], sector) => {
      for (const [a, b] of chunkRanges(rb - ra + 1, CHUNK)) {
        let z = 0;
        for (let i = ra + a; i <= ra + b; i++) z += world.pts[i].z;
        const k = world.zMax > 0 ? z / (b - a + 1) / world.zMax : 0.5;
        chunks.push({ a: ra + a, b: ra + b, sector: sector as 0 | 1 | 2, k });
      }
    });
    const fracs = distanceFractions(world.pts);
    const stats = climbStats(world.rel);
    const exaggeration = world.planPerMetre && world.zPerMetre > 0 ? Math.round(world.zPerMetre / world.planPerMetre) : null;
    return { world, n, ranges, chunks, fracs, stats, exaggeration, target: world.zMax / 2 };
  }, [profile, lengthKm]);

  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  pausedRef.current = paused;
  const reduceRef = useRef(reduce);
  reduceRef.current = reduce;

  /** All per-frame state. */
  const s = useRef({
    yaw: DEFAULT_YAW,
    pitch: DEFAULT_PITCH,
    vel: 0,
    dragging: false,
    lastX: 0,
    lastY: 0,
    lastMoveT: 0,
    driftT: 0,
    interacted: false,
    tau: 0,
    reveal: 0,
    started: false,
    visible: false,
    reset: null as null | { t: number; fromYaw: number; fromPitch: number },
    raf: 0,
    lastTs: 0,
    w: 0,
    h: 0,
    dpr: 1,
    fit: null as Fit | null,
    palette: null as Palette | null,
    lastTap: 0,
  });

  // ---- drawing -------------------------------------------------------------------------------
  /** Render one frame. Returns true while the framing is still gliding toward its target. */
  function draw(dt = 16): boolean {
    const st = s.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || st.w === 0) return false;
    const pal = (st.palette ??= readPalette());
    const { w, h, dpr } = st;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const drift = st.interacted ? 0 : DRIFT_DEG * Math.sin((2 * Math.PI * st.driftT) / DRIFT_PERIOD_MS);
    const cam = makeCamera(st.yaw + drift, st.pitch, DIST, geo.target);
    const pts = geo.world.pts;
    const n = geo.n;
    const QL = pts.map((p) => project(p, cam));
    const QG = pts.map((p) => project({ x: p.x, y: p.y, z: 0 }, cam));
    // Frame the current view; ease the zoom so orbiting glides instead of snapping.
    const target = fitBounds([...QL, ...QG], w, h, w < 640 ? 0.07 : 0.06);
    st.fit = st.fit ? easeFit(st.fit, target, dt) : target;
    const fit = st.fit;
    const settling =
      Math.abs(fit.scale - target.scale) > target.scale * 0.002 || Math.abs(fit.cx - target.cx) > 0.002 || Math.abs(fit.cy - target.cy) > 0.002;
    const L = new Array<{ x: number; y: number; d: number }>(n);
    const G = new Array<{ x: number; y: number }>(n);
    for (let i = 0; i < n; i++) {
      const sp = toScreen(QL[i], fit, w, h);
      L[i] = { x: sp.x, y: sp.y, d: QL[i].depth };
      G[i] = toScreen(QG[i], fit, w, h);
    }
    const scaleK = Math.min(1.25, Math.max(0.75, w / 760));
    const coreW = 3.6 * scaleK;
    const tarmacW = 10 * scaleK;

    drawGrid(ctx, cam, fit, w, h, pal);

    // ground shadow (z = 0)
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    G.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.strokeStyle = rgba(pal.base, 0.8);
    ctx.lineWidth = tarmacW * 1.8;
    ctx.stroke();
    ctx.strokeStyle = rgba(pal.surface, 0.7);
    ctx.lineWidth = tarmacW * 0.55;
    ctx.stroke();

    // chunks, far to near
    const maxIdx = st.reveal >= 1 ? n - 1 : Math.floor(st.reveal * (n - 1));
    const vis = geo.chunks.filter((c) => c.a < maxIdx);
    const depths = vis.map((c) => {
      let d = 0;
      for (let i = c.a; i <= Math.min(c.b, maxIdx); i++) d += L[i].d;
      return d / (Math.min(c.b, maxIdx) - c.a + 1);
    });
    const order = depthOrder(depths, vis.map((c) => c.k));
    for (const oi of order) {
      const c = vis[oi];
      const b = Math.min(c.b, maxIdx);
      const col = pal.sectors[c.sector];
      // curtain
      ctx.beginPath();
      ctx.moveTo(L[c.a].x, L[c.a].y);
      for (let i = c.a + 1; i <= b; i++) ctx.lineTo(L[i].x, L[i].y);
      for (let i = b; i >= c.a; i--) ctx.lineTo(G[i].x, G[i].y);
      ctx.closePath();
      ctx.fillStyle = rgba(col, 0.1 + 0.1 * c.k);
      ctx.fill();
      // drop-lines
      ctx.beginPath();
      for (let i = c.a; i <= b; i++) {
        if (i % 3 !== 0) continue;
        ctx.moveTo(L[i].x, L[i].y);
        ctx.lineTo(G[i].x, G[i].y);
      }
      ctx.strokeStyle = rgba(col, 0.45);
      ctx.lineWidth = 1;
      ctx.stroke();
      // tarmac, bloom, core (core reaches one point past each end to heal chunk joints)
      const a0 = Math.max(0, c.a - 1);
      const b1 = Math.min(maxIdx, b + 1);
      const path = (from: number, to: number) => {
        ctx.beginPath();
        ctx.moveTo(L[from].x, L[from].y);
        for (let i = from + 1; i <= to; i++) ctx.lineTo(L[i].x, L[i].y);
      };
      path(c.a, b);
      ctx.strokeStyle = rgba(pal.raised);
      ctx.lineWidth = tarmacW;
      ctx.stroke();
      ctx.strokeStyle = rgba(pal.line, 0.9);
      ctx.lineWidth = tarmacW + 2;
      ctx.globalCompositeOperation = 'destination-over';
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
      // elevation shading: low = toward navy (darker, cooler), high = toward ink (brighter)
      const shade = c.k < 0.5 ? mix(col, pal.base, (0.5 - c.k) * 0.7) : mix(col, pal.ink, (c.k - 0.5) * 0.45);
      path(a0, b1);
      ctx.strokeStyle = rgba(shade, 0.22);
      ctx.lineWidth = coreW * 3;
      ctx.stroke();
      ctx.strokeStyle = rgba(shade);
      ctx.lineWidth = coreW;
      ctx.stroke();
    }

    if (st.reveal >= 1) {
      drawGantry(ctx, cam, fit, w, h, pal, scaleK);
      drawPills(ctx, L, pal);
      drawRunner(ctx, cam, fit, w, h, pal, scaleK);
    }
    return settling;
  }

  function drawGrid(ctx: CanvasRenderingContext2D, cam: Camera, fit: Fit, w: number, h: number, pal: Palette) {
    const R = 1.25;
    const step = 0.25;
    ctx.lineWidth = 1;
    for (let v = -R; v <= R + 1e-9; v += step) {
      const a = Math.max(0.05, 0.28 * (1 - Math.abs(v) / (R + 0.2)));
      ctx.strokeStyle = rgba(pal.line, a + 0.12);
      for (const [p, q] of [
        [{ x: v, y: -R, z: 0 }, { x: v, y: R, z: 0 }],
        [{ x: -R, y: v, z: 0 }, { x: R, y: v, z: 0 }],
      ] as [P3, P3][]) {
        const s1 = toScreen(project(p, cam), fit, w, h);
        const s2 = toScreen(project(q, cam), fit, w, h);
        ctx.beginPath();
        ctx.moveTo(s1.x, s1.y);
        ctx.lineTo(s2.x, s2.y);
        ctx.stroke();
      }
    }
  }

  /** Chequered start/finish gantry standing across the track at point 0. */
  function drawGantry(ctx: CanvasRenderingContext2D, cam: Camera, fit: Fit, w: number, h: number, pal: Palette, k: number) {
    const pts = geo.world.pts;
    const p0 = pts[0];
    const p1 = pts[Math.min(2, pts.length - 1)];
    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const hw = 0.055;
    const top = p0.z + 0.1;
    const band = 0.03;
    const S = (x: number, y: number, z: number) => toScreen(project({ x, y, z }, cam), fit, w, h);
    const L0 = S(p0.x - nx * hw, p0.y - ny * hw, p0.z);
    const R0 = S(p0.x + nx * hw, p0.y + ny * hw, p0.z);
    const LT = S(p0.x - nx * hw, p0.y - ny * hw, top);
    const RT = S(p0.x + nx * hw, p0.y + ny * hw, top);
    ctx.lineCap = 'round';
    ctx.strokeStyle = rgba(pal.ink, 0.9);
    ctx.lineWidth = 1.6 * k;
    ctx.beginPath();
    ctx.moveTo(L0.x, L0.y);
    ctx.lineTo(LT.x, LT.y);
    ctx.moveTo(R0.x, R0.y);
    ctx.lineTo(RT.x, RT.y);
    ctx.stroke();
    const cols = 8;
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < cols; col++) {
        const t0 = col / cols;
        const t1 = (col + 1) / cols;
        const z0 = top - band + (row * band) / 2;
        const z1 = z0 + band / 2;
        const at = (t: number, z: number) => S(p0.x + nx * hw * (2 * t - 1), p0.y + ny * hw * (2 * t - 1), z);
        const q = [at(t0, z0), at(t1, z0), at(t1, z1), at(t0, z1)];
        ctx.beginPath();
        q.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
        ctx.closePath();
        ctx.fillStyle = rgba((row + col) % 2 ? pal.chequerDark : pal.chequerLight);
        ctx.fill();
      }
    }
    // flat chequered line on the tarmac
    for (let col = 0; col < 6; col++) {
      const t0 = col / 6;
      const t1 = (col + 1) / 6;
      const at = (t: number, along: number) =>
        S(p0.x + nx * hw * 0.8 * (2 * t - 1) + (dx / len) * along, p0.y + ny * hw * 0.8 * (2 * t - 1) + (dy / len) * along, p0.z);
      for (let row = 0; row < 2; row++) {
        const q = [at(t0, row * 0.008), at(t1, row * 0.008), at(t1, (row + 1) * 0.008), at(t0, (row + 1) * 0.008)];
        ctx.beginPath();
        q.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
        ctx.closePath();
        ctx.fillStyle = rgba((row + col) % 2 ? pal.chequerDark : pal.chequerLight);
        ctx.fill();
      }
    }
  }

  function drawPills(ctx: CanvasRenderingContext2D, L: { x: number; y: number }[], pal: Palette) {
    let cx = 0;
    let cy = 0;
    for (const p of L) {
      cx += p.x;
      cy += p.y;
    }
    cx /= L.length;
    cy /= L.length;
    ctx.font = `600 11px ${pal.mono}`;
    ctx.textBaseline = 'middle';
    geo.ranges.forEach(([a, b], i) => {
      const p = L[Math.round((a + b) / 2)];
      const dx = p.x - cx;
      const dy = p.y - cy;
      const len = Math.hypot(dx, dy) || 1;
      const text = SECTOR_META[i].short;
      const tw = ctx.measureText(text).width;
      const bw = tw + 12;
      const bh = 18;
      const x = Math.min(s.current.w - bw - 4, Math.max(4, p.x + (dx / len) * 22 - bw / 2));
      const y = Math.min(s.current.h - bh - 4, Math.max(4, p.y + (dy / len) * 18 - bh / 2));
      ctx.beginPath();
      ctx.roundRect(x, y, bw, bh, 4);
      ctx.fillStyle = rgba(pal.base, 0.88);
      ctx.fill();
      ctx.strokeStyle = rgba(pal.sectors[i]);
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = rgba(pal.sectors[i]);
      ctx.fillRect(x + 1, y + 3, 2.5, bh - 6);
      ctx.fillStyle = rgba(pal.ink);
      ctx.fillText(text, x + 7, y + bh / 2 + 0.5);
    });
  }

  function pointAtTau(t: number): P3 {
    const pts = geo.world.pts;
    const idx = (((t % 1) + 1) % 1) * (geo.n - 1);
    const i = Math.floor(idx);
    const j = Math.min(geo.n - 1, i + 1);
    const f = idx - i;
    return { x: pts[i].x + (pts[j].x - pts[i].x) * f, y: pts[i].y + (pts[j].y - pts[i].y) * f, z: pts[i].z + (pts[j].z - pts[i].z) * f };
  }

  function drawRunner(ctx: CanvasRenderingContext2D, cam: Camera, fit: Fit, w: number, h: number, pal: Palette, k: number) {
    const st = s.current;
    const S = (p: P3) => toScreen(project(p, cam), fit, w, h);
    // fading trail behind the marker (last ~1.6% of the lap time)
    const steps = 14;
    let prev = S(pointAtTau(st.tau - 0.016));
    for (let i = 1; i <= steps; i++) {
      const p = S(pointAtTau(st.tau - 0.016 * (1 - i / steps)));
      const a = i / steps;
      ctx.strokeStyle = rgba(pal.ink, 0.75 * a * a);
      ctx.lineWidth = (1.5 + 4 * a) * k;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      prev = p;
    }
    const head = S(pointAtTau(st.tau));
    const glow = ctx.createRadialGradient(head.x, head.y, 0, head.x, head.y, 16 * k);
    glow.addColorStop(0, rgba(pal.accent, 0.6));
    glow.addColorStop(1, rgba(pal.accent, 0));
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(head.x, head.y, 16 * k, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(head.x, head.y, 5 * k, 0, Math.PI * 2);
    ctx.fillStyle = rgba(pal.ink);
    ctx.fill();
    ctx.lineWidth = 2.5 * k;
    ctx.strokeStyle = rgba(pal.accent);
    ctx.stroke();
  }

  // ---- animation loop ------------------------------------------------------------------------
  function frame(ts: number) {
    const st = s.current;
    const dt = st.lastTs ? Math.min(64, ts - st.lastTs) : 16;
    st.lastTs = ts;
    let active = false;
    const still = reduceRef.current;
    if (st.started && st.reveal < 1) {
      st.reveal = still ? 1 : Math.min(1, st.reveal + dt / (DRAW_S * 1000));
      active = st.reveal < 1 || active;
    }
    if (!still && !pausedRef.current && st.reveal >= 1) {
      st.tau = (st.tau + dt / (LAP_S * 1000)) % 1;
      if (!st.interacted && !st.dragging) st.driftT += dt;
      active = true;
    }
    if (st.reset) {
      st.reset.t = still ? 1 : Math.min(1, st.reset.t + dt / RESET_MS);
      const e = bezierAt(EASE.inOut, st.reset.t);
      st.yaw = st.reset.fromYaw + yawDelta(st.reset.fromYaw, DEFAULT_YAW) * e;
      st.pitch = st.reset.fromPitch + (DEFAULT_PITCH - st.reset.fromPitch) * e;
      if (st.reset.t >= 1) {
        st.reset = null;
        st.interacted = false;
        st.driftT = 0;
      }
      active = true;
    }
    if (!st.dragging && Math.abs(st.vel) > 0.0004) {
      st.yaw = wrapYaw(st.yaw + st.vel * dt);
      st.vel = decay(st.vel, dt);
      active = true;
    }
    if (draw(dt)) active = true;
    st.raf = active && st.visible ? requestAnimationFrame(frame) : 0;
  }

  function kick() {
    const st = s.current;
    if (st.raf) return;
    st.lastTs = 0;
    st.raf = requestAnimationFrame(frame);
  }

  // size + visibility
  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const st = s.current;
    const resize = () => {
      const w = Math.round(wrap.clientWidth);
      const h = Math.round(w < 640 ? w * 0.86 : Math.min(470, Math.max(300, w * 0.5)));
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      st.w = w;
      st.h = h;
      st.dpr = dpr;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.height = `${h}px`;
      wrap.style.height = `${h}px`;
      st.fit = null;
      draw();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    const io = new IntersectionObserver(
      ([e]) => {
        st.visible = e.isIntersecting;
        if (e.isIntersecting) {
          if (!st.started) {
            st.started = true;
            if (reduceRef.current) st.reveal = 1;
          }
          kick();
        }
      },
      { threshold: 0.25 },
    );
    io.observe(wrap);
    return () => {
      ro.disconnect();
      io.disconnect();
      cancelAnimationFrame(st.raf);
      st.raf = 0;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geo]);

  // A preference or pause change: redraw / restart the loop.
  useEffect(() => {
    if (reduce) {
      s.current.vel = 0;
      s.current.reveal = s.current.started ? 1 : s.current.reveal;
    }
    kick();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduce, paused]);

  // ---- input -----------------------------------------------------------------------------------
  function takeOver() {
    const st = s.current;
    if (!st.interacted) {
      st.yaw = wrapYaw(st.yaw + DRIFT_DEG * Math.sin((2 * Math.PI * st.driftT) / DRIFT_PERIOD_MS));
      st.interacted = true;
    }
    st.reset = null;
  }

  function resetView() {
    const st = s.current;
    st.vel = 0;
    st.reset = { t: 0, fromYaw: st.yaw, fromPitch: st.pitch };
    kick();
  }

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    const st = s.current;
    takeOver();
    st.dragging = true;
    st.vel = 0;
    st.lastX = e.clientX;
    st.lastY = e.clientY;
    st.lastMoveT = e.timeStamp;
    e.currentTarget.setPointerCapture(e.pointerId);
    kick();
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const st = s.current;
    if (!st.dragging) return;
    const dx = e.clientX - st.lastX;
    const dy = e.clientY - st.lastY;
    const dt = Math.max(1, e.timeStamp - st.lastMoveT);
    st.lastX = e.clientX;
    st.lastY = e.clientY;
    st.lastMoveT = e.timeStamp;
    const dYaw = dx * 0.45;
    st.yaw = wrapYaw(st.yaw + dYaw);
    if (e.pointerType === 'mouse') st.pitch = clampPitch(st.pitch + dy * 0.3);
    // smoothed velocity for inertia (degrees per ms)
    st.vel = reduceRef.current ? 0 : st.vel * 0.6 + (dYaw / dt) * 0.4;
    kick();
  };
  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const st = s.current;
    st.dragging = false;
    if (reduceRef.current || e.timeStamp - st.lastMoveT > 80) st.vel = 0;
    // double tap (touch) resets
    if (e.pointerType !== 'mouse') {
      if (e.timeStamp - st.lastTap < 300) resetView();
      st.lastTap = e.timeStamp;
    }
    kick();
  };
  const onPointerCancel = () => {
    s.current.dragging = false;
    s.current.vel = 0;
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const st = s.current;
    let used = true;
    if (e.key === 'ArrowLeft') st.yaw = wrapYaw(st.yaw - 10);
    else if (e.key === 'ArrowRight') st.yaw = wrapYaw(st.yaw + 10);
    else if (e.key === 'ArrowUp') st.pitch = clampPitch(st.pitch + 5);
    else if (e.key === 'ArrowDown') st.pitch = clampPitch(st.pitch - 5);
    else if (e.key === 'Home') {
      resetView();
      e.preventDefault();
      return;
    } else used = false;
    if (!used) return;
    e.preventDefault();
    takeOver();
    st.vel = 0;
    kick();
  };

  // ---- text readout ----------------------------------------------------------------------------
  const st = geo.stats;
  const at = (i: number) => {
    const f = geo.fracs[i] ?? 0;
    return lengthKm ? `${(f * lengthKm).toFixed(2)} km` : `${Math.round(f * 100)}% of the lap`;
  };
  const sectorAt = (i: number) => SECTOR_META[sectorOfIndex(i, geo.ranges[1][0], geo.ranges[2][0])].label;
  const highM = Math.round(st.range);
  const climbM = Math.round(st.totalClimb);
  const riseM = Math.round(st.biggestRise.metres);
  const summary = `${name}: 3D view of the circuit, coloured and labelled by sector, with a chequered start/finish gantry. Highest point about ${highM} metres above the lowest (at ${at(st.highIndex)}, ${sectorAt(st.highIndex)}); lowest at ${at(st.lowIndex)}, ${sectorAt(st.lowIndex)}. Total climb about ${climbM} metres per lap; biggest single rise about ${riseM} metres, from ${at(st.biggestRise.from)} to ${at(st.biggestRise.to)}.`;

  const cell = 'min-w-0 rounded-md border border-line bg-raised/70 px-3 py-2';
  const cellLabel = 'block font-mono text-[0.625rem] uppercase tracking-[0.14em] text-muted';
  const cellValue = 'mt-0.5 block font-mono text-base font-semibold tabular-nums text-ink sm:text-lg';
  const cellHint = 'mt-0.5 block text-xs text-muted';
  const btn =
    'press inline-flex min-h-11 items-center gap-2 rounded-lg border border-line bg-raised px-3 text-sm font-medium text-ink transition-colors hover:border-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

  return (
    <figure className="relative isolate m-0 min-w-0 overflow-hidden rounded-xl border border-line bg-base">
      <div aria-hidden="true" className="tl-backdrop pointer-events-none absolute inset-0 -z-10" />

      <header className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4 md:px-5 md:pt-5">
        <div className="min-w-0">
          <p className="font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-muted">Circuit in 3D</p>
          <p className="mt-0.5 text-sm text-ink">One real qualifying lap, {formatLapTime(profile.lapTime, 3)}</p>
        </div>
        <div className="flex items-center gap-2">
          {!reduce && (
            <button type="button" aria-pressed={paused} onClick={() => setPaused((p) => !p)} className={btn}>
              {paused ? <Play size={16} weight="fill" aria-hidden="true" /> : <Pause size={16} weight="fill" aria-hidden="true" />}
              {paused ? 'Play' : 'Pause'}
              <span className="sr-only"> lap and camera motion</span>
            </button>
          )}
          <button type="button" onClick={resetView} className={btn}>
            <ArrowCounterClockwise size={16} weight="bold" aria-hidden="true" />
            Reset view
          </button>
        </div>
      </header>

      <div className="relative mt-2 px-1 sm:px-3">
        <div
          ref={wrapRef}
          role="group"
          aria-roledescription="interactive 3D circuit"
          aria-label={summary}
          aria-describedby={`tl-help-${profile.circuitKey}`}
          tabIndex={0}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          onDoubleClick={resetView}
          onKeyDown={onKeyDown}
          className="relative w-full cursor-grab touch-pan-y select-none rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-accent active:cursor-grabbing"
          style={{ height: 320 }}
        >
          <canvas ref={canvasRef} aria-hidden="true" className="block h-full w-full" />
        </div>
        <p
          id={`tl-help-${profile.circuitKey}`}
          className="mt-1 flex items-center gap-1.5 px-3 font-mono text-[0.625rem] uppercase tracking-widest text-muted sm:px-2"
        >
          <HandGrabbing size={14} weight="regular" aria-hidden="true" />
          <span>
            Drag or use arrow keys to rotate<span className="max-sm:hidden"> · double-click or Home to reset</span>
            <span className="sm:hidden"> · double-tap to reset</span>
          </span>
        </p>
      </div>

      {/* Elevation in figures (also what screen readers get). */}
      <dl className="m-0 mt-3 grid grid-cols-2 gap-2 px-4 sm:grid-cols-4 md:px-5">
        <div className={cell}>
          <dt className={cellLabel}>Highest point</dt>
          <dd className="m-0">
            <span className={cellValue}>+{highM} m</span>
            <span className={cellHint}>
              {at(st.highIndex)}, {SECTOR_META[sectorOfIndex(st.highIndex, geo.ranges[1][0], geo.ranges[2][0])].short}
            </span>
          </dd>
        </div>
        <div className={cell}>
          <dt className={cellLabel}>Lowest point</dt>
          <dd className="m-0">
            <span className={cellValue}>0 m</span>
            <span className={cellHint}>
              {at(st.lowIndex)}, {SECTOR_META[sectorOfIndex(st.lowIndex, geo.ranges[1][0], geo.ranges[2][0])].short}
            </span>
          </dd>
        </div>
        <div className={cell}>
          <dt className={cellLabel}>Total climb</dt>
          <dd className="m-0">
            <span className={cellValue}>{climbM} m</span>
            <span className={cellHint}>per lap</span>
          </dd>
        </div>
        <div className={cell}>
          <dt className={cellLabel}>Biggest rise</dt>
          <dd className="m-0">
            <span className={cellValue}>+{riseM} m</span>
            <span className={cellHint}>
              {lengthKm
                ? `${((geo.fracs[st.biggestRise.from] ?? 0) * lengthKm).toFixed(2)}${MINUS}${((geo.fracs[st.biggestRise.to] ?? 0) * lengthKm).toFixed(2)} km`
                : `from ${at(st.biggestRise.from)}`}
            </span>
          </dd>
        </div>
      </dl>

      <figcaption className="mt-3 border-t border-line px-4 pb-4 pt-3 md:px-5 md:pb-5">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          {SECTOR_META.map((m) => (
            <span key={m.short} className="inline-flex items-center gap-2">
              <span aria-hidden="true" className="inline-block h-1.5 w-6 rounded-full" style={{ background: `var(${m.token})` }} />
              <span className="font-mono text-xs text-muted">{m.short}</span>
              {m.label}
            </span>
          ))}
          <span className="inline-flex items-center gap-2 text-muted">
            <span aria-hidden="true" className="inline-grid grid-cols-4 overflow-hidden rounded-[2px]">
              {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                <span
                  key={i}
                  className="size-1.5"
                  style={{ background: (i + Math.floor(i / 4)) % 2 ? 'var(--color-chequer-dark)' : 'var(--color-chequer-light)' }}
                />
              ))}
            </span>
            Start / finish
          </span>
        </div>
        <p className="mt-2 text-xs text-muted">
          Height is real elevation, scaled so every circuit reads{geo.exaggeration && geo.exaggeration > 1 ? ` (about ${geo.exaggeration}x exaggerated here)` : ''};
          the line brightens as it climbs. Layout, sectors and elevation come from one real qualifying lap (OpenF1 telemetry); elevation is
          indicative and measured from the lowest point. The marker laps at that lap&rsquo;s pace, sped up.
        </p>
      </figcaption>
    </figure>
  );
}

# FastF1 and open F1 data: ideas for Kartar CUP

Research date: 2026-09-26. Method: web search plus page fetches. Every URL below appeared in a search result or was fetched. Feature descriptions come from the fetched README or page text, summarised by a fetch tool, so treat detail as "as described by the project", not independently tested. Reddit r/formula1 and r/dataisbeautiful posts were searched for but no specific post URL was surfaced, so none is listed (nothing invented).

## A) Project survey

| # | Name | URL | What it does | Idea worth stealing |
|---|------|-----|--------------|---------------------|
| 1 | FastF1 | https://github.com/theOehrly/Fast-F1 | Python package for results, schedules, timing, telemetry as pandas DataFrames; docs list v3.8.3 | Team colours and line styles come with the library, so "one style per driver" is a solved problem |
| 2 | FastF1 example gallery (position changes) | https://docs.fastf1.dev/gen_modules/examples_gallery/plot_position_changes.html | Line per driver, position vs lap, inverted y axis, team colour plus line style | Crossing lines read as overtakes and V-dips as pit cycles; line style separates team-mates (not colour-only) |
| 3 | FastF1 example gallery (speed on track) | https://docs.fastf1.dev/gen_modules/examples_gallery/plot_speed_on_track.html | Fastest-lap speed colour-mapped onto the circuit outline | Build the track outline from a single lap's X/Y once, cache as a static SVG path |
| 4 | f1-dash | https://github.com/slowlydev/f1-dash | Real-time dashboard: leaderboard, tyres, gaps, laps, mini-sectors. Rust backend, Next.js front end, SignalR folder in repo | Backend fan-out: one server holds the upstream feed, browsers get a lean stream |
| 5 | F1Dash site | https://f1dash.net/ | Hosted live timing, telemetry, replay, with delay synchronisation between stream and broadcast | User-adjustable delay so stats do not spoil the TV picture (critical for a watch party) |
| 6 | F1 Replay Timing | https://github.com/adn8naiagent/F1ReplayTiming | Self-hosted live and replay timing; track map updated every 0.5 s; broadcast-sync slider; PiP mode; FastF1 + FastAPI + Next.js, single Docker container | Broadcast-delay slider plus a "sync by gap entry" fallback for hosts |
| 7 | undercut-f1 | https://github.com/JustAman62/undercut-f1 | Terminal live timing over SignalR; variable delay (M/N keys, 5 s steps) to match TV; records session as JSON (`live.jsonl`) and replays it | Record every live session to a file, then replay it as a demo/rehearsal source |
| 8 | F1 Race Replay (Tom Shaw) | https://github.com/IAmTomShaw/f1-race-replay | Arcade desktop replay: cars on track, leaderboard, tyres, DRS zones, simulated safety car from track status | Simulated safety car (position ~500 m ahead of leader) as a visual moment; keyboard-driven scrubbing |
| 9 | Tom Shaw build write-up | https://tomshaw.substack.com/p/how-im-building-f1-race-replay-using | Blog on normalising all telemetry onto one timeline for the replay | Resample everything to a common timebase before rendering |
| 10 | Armchair Strategist | https://github.com/Casper-Guo/Armchair-Strategist | FastF1 strategy dashboard 2018 onward: pit strategy, position change, gap to leader, fuel-adjusted pace, teammate comparison | Fuel-adjusted pace so a "who was really fastest" quiz answer is defensible |
| 11 | EngDre f1-telemetry-dashboard | https://github.com/EngDre/f1-telemetry-dashboard | Streamlit/Plotly: speed/throttle/brake/gear vs distance, cumulative time delta, 25-segment mini-sector winners, speed heatmap | Mini-sector winner colouring; synthetic demo mode with a warning banner when data service is down |
| 12 | f1-telemetry-dss | https://github.com/Germanskii/f1-telemetry-dss | Rule-based lap review with replay and offline demo; exports self-contained HTML | Ships an offline demo dataset and a single-file HTML export |
| 13 | FraserTarbet F1Dash | https://github.com/FraserTarbet/F1Dash | Interactive timing/telemetry dashboard using FastF1 and Plotly | Reference for a lap-by-lap interactive layout (only search snippet read) |
| 14 | Tracing Insights | https://tracinginsights.com/ | Web analytics app: pre-race forecasts, post-race breakdowns, telemetry from 2018; also a data archive (https://tracinginsights.com/data/) and Hugging Face Space (https://huggingface.co/spaces/tracinginsights/F1-analysis) | Pre-race forecast plus post-race reveal as one narrative loop |
| 15 | Redline (repo "LiveF1") | https://github.com/RileyK19/LiveF1 | Native iOS app on SignalR + OpenF1 + Jolpica; Live Activities/widgets; on-device radio transcription; strategy chatbot | Every number the AI mentions comes from the algorithm, not the LLM (grounded commentary) |
| 16 | tr-transcription | https://github.com/harningle/tr-transcription | PyAnnote diarisation plus Whisper transcription of team radio; early-stage, GPL-3.0 | Radio quote as a "who said it" mini-question |
| 17 | F1 Duel | https://github.com/ArthurOttevaere/f1-duel | Season-long top-10 prediction game vs an XGBoost/LightGBM benchmark; rarity-weighted scoring; leagues; Flask + Next.js + Supabase | Play against a model baseline; reward rare correct picks (exact formula is in its docs/GAME_DESIGN.md, not read) |
| 18 | Podium Picks | https://github.com/piotrv1001/podium-picks | Group prediction app with per-group statistics tables; separate admin app to enter official results | Admin-enters-result flow keeps scoring authoritative when live data fails |
| 19 | MultiViewer | https://multiviewer.app/ | Desktop app: synced onboards plus live timing (F1 TV subscription needed, not open source) | Sync-to-broadcast is the killer feature of second-screen tools |
| 20 | OpenF1 | https://openf1.org/ | REST/JSON API: telemetry, laps, positions, pit stops, radio, weather, race control; ~3 s live latency on paid tier | Simple polling endpoints beat raw SignalR for a small site |
| 21 | Jolpica F1 | https://github.com/jolpica/jolpica-f1 | Ergast-compatible API (`api.jolpi.ca/ergast/f1/`), 200 req/hour unauthenticated | Authoritative results and standings for scoring after the flag |
| 22 | awesome-f1 | https://github.com/subinium/awesome-f1 | Curated list; surfaced F1 Cosmos, F1 The Data, BoardF1, Formula Live Pulse (https://www.f1livepulse.com/) | Directory for later scouting; not each verified individually |

Also seen but not analysed in depth: Kieran0403/fastf1-data-visualiser (https://github.com/Kieran0403/fastf1-data-visualiser), FastF1 discussion #107 on the undocumented stream (https://github.com/theOehrly/Fast-F1/discussions/107).

## B) Live data reality check

Doc URL: https://docs.fastf1.dev/livetiming.html

What the docs state:
- FastF1 can record live timing: `SignalRClient` in Python, or `python -m fastf1.livetiming save <file>`. It connects to F1's SignalR stream and writes the raw messages to a file.
- Real-time processing is not supported: "is not possible to do real-time processing of the data". You record during the session and load afterwards with `LiveTimingData`.
- Start recording 2-3 minutes before the session or the parser may fail.
- The server appears to drop the connection at about 2 hours; restart with a different filename (`--append` exists).
- `--timeout` (default 60 s) exits if no data arrives.
- Do not mix recorded live data with API data for the same session (sync problems).
- The fetched livetiming page is labelled FastF1 3.6.1 and says the client supports "only Python 3.8 or 3.9". The main docs show 3.8.3, so that page may be stale. Verify against the installed version before relying on it.

Latency and access, from other sources:
- The stream (`livetiming.formula1.com`) is undocumented and reverse-engineered; FastF1 code is the best reference (discussion #107). It was historically reachable without authentication.
- undercut-f1 reports that since the Dutch GP 2025 some enhanced features (driver tracker, DRS, pit times, championship tables) need F1 TV subscription authentication. Assume the unauthenticated stream can degrade or change without notice.
- Broadcast TV is typically 30-60 s behind the data (undercut-f1), which is why f1-dash, F1 Replay Timing and undercut-f1 all ship a manual delay control.
- How projects get live data: f1-dash, F1 Replay Timing, undercut-f1 and Redline all subscribe directly to the F1 SignalR stream (f1-dash has a `signalr` folder and a Rust backend; the others state it outright). OpenF1 is the polling alternative: live REST/MQTT/WebSocket is sponsor-only at EUR 9.90/month, about 3 s latency, 6 req/s and 60 req/min, up to 10 concurrent MQTT/WebSocket connections. The free tier (3 req/s, 30 req/min) has historical data from 2023 but is not available within 30 minutes before and after sessions.
- Jolpica/Ergast is results, standings and schedule only; not live. Fine for post-race scoring (200 req/hour unauthenticated).

Verdict: FastF1 is NOT a live-data tool. It is a record-then-analyse tool for the timing feed and a post-session analysis library. For Kartar CUP, live-during-race stats need either (a) our own small server subscribing to SignalR and fanning out a reduced JSON to clients, (b) OpenF1 sponsor tier (about 3 s, paid), or (c) a host-entered/semi-manual mode. Everything must degrade to (c) and to post-race Jolpica results, because the SignalR feed is unofficial and can break. Guests should never talk to F1 or OpenF1 directly.

## C) Twelve "crazy but buildable" ideas

Effort: S under 2 days, M about a week, L more than a week. Live = depends on live data feed.

1. **Answers resolve on the stats page as they happen.** Each quiz question (first pit stop, fastest lap, safety car before lap 20) has a resolver rule; the row flips to "settled" with the real value and scoring. M, Live: yes for instant, no for a host-tapped fallback.
2. **Crowd vs reality reveal.** After the flag, a bar per driver: share of the room that picked them vs actual result. Room's picks are private data, so no external dependency. S, Live: no.
3. **"How wrong was the room" meter.** One number: mean rank error across all guests, plotted against a rolling history of past Kartar races. S, Live: no (needs final results only).
4. **Guest-pick heat map on the grid.** Drivers as rows, predicted finishing position as columns, cell intensity equals guests picking that pair; the actual result is an outlined marker. M, Live: no.
5. **Replay-as-you-predict.** Host picks a past race, the room predicts at set laps (pause at lap 10, 25), then the recorded timeline plays forward. Runs from cached FastF1 data, so it is also the rehearsal/demo mode when Wi-Fi or feed fails. L, Live: no.
6. **Broadcast-delay slider for the host.** Stats and quiz reveals are held back by N seconds so nothing spoils the TV (stolen from f1-dash, undercut-f1). Client-side buffer of timestamped messages. S, Live: yes.
7. **Model-vs-room duel.** Simple baseline (grid order or championship order) as a virtual player on the leaderboard; "the room beat the grid" (idea from F1 Duel). S, Live: no.
8. **Rarity-weighted scoring.** Correct pick worth more when few guests made it; shows as "bold call" tags on the results screen. S, Live: no.
9. **Prediction accountability strip.** For every guest, a single strip of small ticks (hit, near, miss) per question, forming a personal race summary on their phone; screenshot-friendly. S, Live: no.
10. **Lap-by-lap "who was in the room's podium" tracker.** During the race show how many guests' predicted podium currently stands; ticks up and down with position changes. M, Live: yes.
11. **Radio-quote question.** Pull a team-radio clip transcript (OpenF1 radio or archived) and ask "who said it" as a bonus round. Transcription accuracy is low per undercut-f1, so use only host-curated clips. M, Live: no (post-session is fine).
12. **Record-and-replay night log.** Record the SignalR stream for the whole race to disk (undercut-f1 pattern). Next week the community can replay last race's "room moments" with picks overlaid. M, Live: yes to record, no to replay.

## D) Twelve design ideas

1. **Position-bump chart.** Lap on x, position on y (1 at top), one line per driver; team colour plus line style plus end-of-line label. Basis: FastF1 gallery. Highlight only the guests' top-3 picks in the accent, others in grey.
2. **Tyre-strip timeline.** Horizontal stacked bars per driver, one segment per stint; compound is encoded by letter inside the segment and by fill pattern (solid, hatched, dotted), not colour alone. Chart type: stacked horizontal bar (FastF1 strategy example).
3. **Track-map ribbon.** Circuit outline from one lap's X/Y, stroke width or dash pattern encodes speed or the gap ribbon. Chart type: coloured polyline, static SVG (FastF1 speed-on-track).
4. **Mini-sector winner map.** Split circuit into about 25 segments (EngDre); each segment labelled by driver initials at its centre, so it is readable without colour.
5. **Gap-ladder with spring physics.** Vertical ladder where car chips sit at a distance proportional to gap, animated with a damped spring on updates; snap to instant when reduced motion is on. Chart type: 1-D scaled ladder.
6. **Sector colour language.** Fixed three-state: purple = session best, green = personal best, neutral = slower; shown as a shape (filled square, half square, outline) plus the time text. Neutral for slower, and the single red accent reserved for the app's own interactive state, not sector status.
7. **Timing-tower typography.** Geist Mono tabular numerals in fixed-width columns for position, gap, interval, lap time; right-aligned decimals so the digits do not jitter. Chart type: table; no chart needed.
8. **Projector mode.** Host view at 1080p: minimum body size around 28 px, high-contrast text, reduced chrome, one panel at a time on auto-rotate (tower, bump chart, room reveal). Chart type: single large chart per scene.
9. **Room-vs-reality diverging bars.** Per driver: room's share extending left, actual finish extending right of a centre axis; labels on both ends. Chart type: diverging bar / butterfly.
10. **Pick heat map (grid matrix).** Rows drivers, columns predicted positions, opacity = count, numeric count printed in each occupied cell (not colour-only), one hue only.
11. **Error-meter dial.** "How wrong was the room" as a horizontal gauge with tick marks and a numeric label; previous races as small ticks on the same scale. Chart type: bullet chart.
12. **Radio waveform strip.** For radio-based questions, a thin waveform with a transcript below; the timeline shows where the clip falls in the race (position on a lap axis). Chart type: annotated timeline.

Cross-cutting encodings: identify drivers by a three-letter code always visible next to any team colour; team palette chosen to stay distinguishable under deuteranopia and paired with line style/marker; motion always has a reduced-motion equivalent; charts are static SVG, not canvas video.

## E) Recommended top 5

Constraints applied: no emojis; one red accent; nothing colour-only; poor venue Wi-Fi; unofficial live feed can fail.

1. **Crowd vs reality reveal with the "how wrong was the room" meter (C2 + C3, D9 + D11).** Needs only the final result plus the room's own picks, so it works with zero live data and tiny payloads. This is the emotional payoff of the night.
2. **Guest-pick heat map on the grid (C4, D10).** Unique to a prediction quiz, cheap once picks exist, and printed counts satisfy accessibility.
3. **Answers resolve on the stats page with a host fallback (C1).** The flagship "live stats page" promise, but designed so a host tap or Jolpica post-race result settles every question. Live data is an upgrade, not a dependency.
4. **Broadcast-delay slider (C6).** Every mature second-screen tool ships this; without it live data spoils the TV for a watch party. Small client-side buffer, so it works on weak Wi-Fi.
5. **Replay-as-you-predict from cached data (C5).** Doubles as rehearsal and as the fallback when the feed or the venue network fails; precompute a small JSON per race so guests download kilobytes, not telemetry.

Supporting design picks: position-bump chart (D1) and tyre-strip timeline (D2) as the two staple visuals, static SVG with letter and pattern encodings; projector mode (D8) as the host view standard.

Architecture note: run one small server that ingests the feed (or replays a recorded file), reduces it to a compact state, and pushes it to clients over a single WebSocket or SSE; poll-with-cache as the fallback. Guests never contact F1 or OpenF1 directly. Record every session (C12) so the next event can replay it.

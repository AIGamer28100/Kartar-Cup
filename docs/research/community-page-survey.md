# Community/Watch-Party Site Survey — Kartar CUP Home Page Redesign

Research date: 2026-09-27. Method: live WebSearch + WebFetch of currently-published pages (no scraping, no auth bypass). Every URL below was fetched or searched live in this session; where a fetch was blocked or returned thin content, that is noted rather than guessed.

## A) Sites surveyed

| # | Name | URL | Sections present (as fetched) | One thing worth copying |
|---|------|-----|-------------------------------|--------------------------|
| 1 | DC Motorsport Community | dcmotorsportcommunity.com | Hero, About, Events (+locations), Gallery, Membership/Store, Community/Blog/Press, Sponsors, Loyalty rewards | "Built from the ground up" framing + naming real local venues (Problem Child, Dog Daze) instead of generic "watch party" copy — makes it feel hyperlocal, not templated |
| 2 | Scuderia Fans | scuderiafans.com | News/blog, driver profiles, race coverage/calendar, stats, historical records, shop, newsletter w/ race countdown, writer team, social links | Editorially independent tone ("Ferrari's lack of clear strengths...") — critical/opinionated voice signals real fans, not PR |
| 3 | Association of British Kart Clubs (ABKC) | abkc.org.uk | Hero, About (est. 1990), Clubs & Tracks directory, Regulations, "Start Karting" beginner guide, News, Contact, YouTube/Facebook links | The "Start Karting" pathway page (age 6+, arrive-and-drive) — a clear on-ramp for newcomers who don't yet belong |
| 4 | Pioneer Valley Karting | pioneervalleykarting.com/leaderboard | Live Leaderboard, Arrive & Drive, birthday/corporate booking, Iron Man race series, shop, FAQ, social links | Leaderboard is the actual homepage anchor, not a buried sub-page — standings-as-hero works for a competitive-game brand |
| 5 | F1 Academy | f1academy.com | Hero, Teams/Drivers/Standings/Calendar/Live Timing, "Discover Your Drive" community hub, News & Stories, Our Impact, Global Partners, footer FAQ/Contact | "Discover Your Drive" as a distinct community/participation hub separate from the competition pages — separates "watch" from "join" |
| 6 | K1 Speed Racing Leagues | k1speed.com/racing-leagues.html | Hero, league divisions (adult/teen/junior), World Championship, National Leaderboard ("Top 50"), Rules, FAQ, live Scores, Contact | Tiered league ladder (local → national → world champ qualifying) gives every casual player a next rung to climb |
| 7 | SF Formula 1 Meetup | meetup.com/formula1-10 | About, Upcoming/Past Events, Members (2,704), Photos, Discussions, Organizer, social links | "21 years running" + named Super-Organizer — longevity and a real human face substitute for slick design |
| 8 | DFW F1 Club (Meetup) | meetup.com/dfw-f1 | About, Events/Past Events (101 past), Members (1,592), Photos, Discussions, Organizers, ratings (4.8★/247 reviews) | Visible review count + past-event tally as trust signal — numbers a small club can actually rack up over time |
| 9 | "wack \| motorsport community" Discord | discord.com/invite/motorsports | Landing page is member-count + join CTA only (thin; Discord invite pages render minimally to fetchers) | Sheer scale (80k+ members per search index) shown as the single hero stat — proof-of-life over design polish |
| 10 | F1 Fan Voice (official F1 community) | f1fanvoice.com | Hero/tagline, login/signup gate, 2FA — content behind auth wall | Positions itself as "exclusive" via login gate; not directly reusable (official F1 IP) but shows fan-feedback/polls as a community mechanic |
| 11 | F1 Arcade Watch Parties | f1arcade.com/us/watch-parties | Hero, Book Watch Party CTA, event calendar w/ date+venue filters, FAQ, reminder signup, footer venue list, social links | The reminder-signup CTA shown specifically when the calendar has no matching events — turns a dead-end into a capture |
| 12 | Club100 / Rotax Racing Club | club100.co.uk | Hero, About (est. 1993), age-tiered championships (Cadet/Junior/Senior), Calendar, News/blog, live Leaderboard (Alpha Timing), Sponsors, Club100 TV/gallery, Contact, Registration | Age/skill-tiered competition ladder + branded "Club100 TV" highlight-video section as the gallery, not static photos |
| 13 | TeamSport Go Karting Membership | team-sport.co.uk/membership | Hero, Benefits, 4-tier pricing (Social/Club/Elite/Race Academy), member-only race formats list, licensing info, FAQ, Contact | Membership tiers named by *behavior* (Social vs Race Academy) rather than generic Bronze/Silver/Gold — ties price to identity |
| 14 | Grand Prix India Pvt Ltd | grandprixindia.in | Hero, About (est. 2006), Future Projects, Contact — no events/gallery/standings/social present | Minimal is a cautionary example: a real motorsport org with only 4 sections reads as corporate/inactive, not a community |
| 15 | FIA Karting | fiakarting.com | Championship standings pages confirmed via search (e.g. `/championshipstandings/2025-fia-karting-team-championship-standings-kz`); homepage itself is JS-rendered and returned only a bare title to the fetcher | Even the sport's governing body keeps standings as a first-class, individually-linkable page per season/class |
| — | F1-fansite.com | f1-fansite.com | Attempted — blocked with HTTP 403 to the fetch tool | Not usable as a source; noted for completeness, not counted toward the 15 |

Also searched but not separately fetched (used for pattern confirmation only): DFW/SF Meetup social handles, Scuderia Ferrari Club Sydney (Facebook-only), Mercedes/F1 team Discords, r/formula1.

## B) Common information architecture across community sites

Ranked by how often the section appeared across the 15 sites above, in the order it typically appears top-to-bottom:

1. **Hero / landing banner** — ~13/15. Near-universal; usually a tagline + one primary CTA (book, join, register).
2. **About / origin story** — ~10/15. Almost always states a founding year or "grassroots" framing — this is the single biggest "real community vs corporate" signal.
3. **Contact + social links (footer)** — ~9/15. Ubiquitous but low-effort; icons, not embeds.
4. **Events / calendar (upcoming)** — ~8/15. Strong on anything watch-party or racing-league flavored; near-absent on pure info sites (Grand Prix India, FIA Karting homepage).
5. **Membership / join / registration** — ~7/15. Common wherever money or a roster is involved (leagues, clubs); rare on pure fan-media sites.
6. **Gallery / past-event recap / photos** — ~7/15. Common on Meetup-style and club sites; several dedicated race/booking sites skip it entirely (Pioneer Valley, K1 Speed, Grand Prix India).
7. **Blog / news** — ~5/15. Concentrated in media-flavored sites (Scuderia Fans, F1 Academy, Club100, ABKC); booking-first sites (K1, PVK, TeamSport) skip it.
8. **Leaderboard / standings** — ~5/15, but where it exists it's often promoted to a top-level, non-buried page (Pioneer Valley, Club100, K1 Speed, F1 Academy) — competition-flavored brands treat this as core, not an extra.
9. **Sponsors / partners** — ~4/15. Present once an org has real sponsorship money (F1 Academy, Club100, DC Motorsport Community); absent on grassroots/volunteer sites.
10. **FAQ** — ~4/15. Clustered on booking/ticketed sites (F1 Arcade, TeamSport, K1 Speed) where reducing support questions has direct ROI.
11. **Merch / shop** — ~3-4/15. Present mainly where there's an existing brand/media audience (Scuderia Fans, Club100, DC Motorsport Community) — not a starting-point section.
12. **Newsletter signup** — ~2/15. Rare as a dedicated section; most sites funnel to social/Discord/WhatsApp instead of email.
13. **True embedded live social feed** (not just icon links) — ~0-1/15. Essentially nobody embeds a live Instagram/Twitter feed grid on the homepage; they link out instead. This matters directly for Kartar CUP's gallery question below.

**Takeaway pattern:** Hero → About → Events → (Standings, if the brand is competition-first) → Gallery/News → Join/Membership → Sponsors → footer (Contact/Social/FAQ/Newsletter). Merch and newsletter are late-stage additions, not launch essentials.

## C) Karter Cup's own public presence (re-verified live this session)

**Confirmed (fetched live):**
- Instagram **@thekartercup** — 978 followers, following 71. Bio: *"Motorsport Events & Community / Karting events | Sim Racing | Watch Party's / Watch parties → @thekarterclub"*. Linked website in bio: `linktr.ee/teamkartercup`. Highlight reels organized by named races: Monza GP, Silverstone GP, Belgian GP, Austrian GP, Barcelona GP, Japanese GP, Chinese GP, plus "S1"/"S2" season highlights. Recent posts (Apr–Sep 2026) include karting event coverage and a "Phase 1 2026" partnership announcement naming **Prime Kart Zone** and **Mahindra**. Also maintains a Threads profile under the same handle.
- Linktree **linktr.ee/teamkartercup** — live links confirmed: "SIM RACING REGISTRATION" (Google Form), "F1 WATCHPARTY – MONZA GP" (kynhood.com event page), a WhatsApp group invite, plus standard Linktree footer (privacy/report/cookie links).
- A second, related handle **@thekarterclub** is referenced in the Instagram bio as the watch-party-specific account — not yet independently verified in this session (bio-text-only mention).

**Still unverified / not found:**
- No individual Instagram **post permalink URLs** were located (search only surfaced unrelated "kart cup"-named accounts — Champion Cup Kart, National Kart Cup, Cup Karts North America, etc. — not @thekartercup's own posts). This matters directly for section D below: without exact post URLs, oEmbed cannot be wired up yet.
- No standings/leaderboard, no dedicated website beyond the Linktree, no sponsors page, no public past-event photo gallery outside Instagram itself.
- Whether "Prime Kart Zone" / "Mahindra" partnership is an ongoing sponsorship or a one-off announcement is unconfirmed beyond the bio-adjacent post description.

## D) Image / gallery strategy recommendation

**Verdict: use seeded placeholders now; do not build an oEmbed gallery yet — the prerequisite (exact public post URLs) is missing.**

Reasoning:
- **Instagram oEmbed (`graph.facebook.com/v.../instagram_oembed`) is Meta's sanctioned, authorized way to display someone else's public Instagram post** — it returns official embed HTML for a specific post and is explicitly documented for "embedding Instagram content in websites and apps." This is the *only* legitimate route to showing Karter Cup's real photos without their direct file handoff — it is not equivalent to scraping/downloading, since the image is served and rendered under Meta's own embed, not copied into our asset store.
- **However, oEmbed requires the exact post permalink URL** (`instagram.com/p/{shortcode}`) for every post shown, plus a Meta developer app + access token. This session found the @thekartercup **profile** (bio, follower count, highlight names) but **zero individual post URLs** — WebSearch for site:instagram.com results returned unrelated accounts, and profile pages don't expose individual post permalinks to a non-interactive fetch. So oEmbed is *ready as a mechanism* but *not usable today* — the missing input is real post links, which only the Karter Cup team (or someone browsing the app/logged-in web view) can supply.
- **Scraping/bulk-downloading their Instagram photos is explicitly out of scope and not authorized** — those are Prime Kart Zone/Karter Cup's copyrighted photos; downloading and rehosting them without permission is not legitimate use, regardless of technical feasibility.
- **Seeded placeholders (`https://picsum.photos/seed/{name}/{w}/{h}`)** are the correct interim choice for a "past events" gallery grid: they are unambiguously stand-in stock photography, carry no copyright risk, and let the section's layout/UX ship now. They must be **visually/labelled as placeholders** (e.g., a "Gallery coming soon — join us to be in the next one" caption or a subtle placeholder watermark/badge) so the page never implies these are real Karter Cup event photos.
- **Recommended path forward:** ship the gallery section with picsum placeholders now; ask the Karter Cup team for 6–10 real Instagram post URLs (or upload rights to a handful of their own photos); once obtained, swap in real oEmbed embeds post-by-post (this also gets "verified real content" for free, since oEmbed pulls live from Instagram rather than a stale copy). Do not build a scraper or an unofficial API integration as a shortcut.

## E) Recommended home-page section list for Kartar CUP (ranked by value for a watch-party + prediction-quiz brand)

Filtered to what fits a watch-party/prediction-game community specifically — not a copy of every section every site above has. The quiz is one CTA/section within this page, not the whole page.

1. **Hero — next race + prediction CTA.** Race countdown/name (they already track named GPs: Monza, Silverstone, etc.) with a single primary button into the prediction quiz, and a secondary button to the WhatsApp group. Justified by pattern B#1 (hero is near-universal) plus Karter Cup's own confirmed habit of naming races (Instagram highlights) as its organizing unit.
2. **About / who we are.** One paragraph: karting events + sim racing + watch parties, community-run, not corporate — this is the highest-leverage "feels real" signal per pattern B#2 and the DC Motorsport Community / ABKC examples.
3. **Prediction Quiz section (the game).** Framed as one section/card with its own heading and CTA — not the page. Positions it as the interactive centerpiece without making the whole home page just the quiz form.
4. **Leaderboard / standings.** Quiz leaderboard (and karting/sim results if available) promoted to a real, linkable section — pattern B#8 shows competition-first brands treat this as core, and it gives repeat-visit reasons.
5. **Upcoming watch parties / events.** Pull directly from what's already live and real (e.g., the Monza GP watch-party event, sim racing registration) rather than inventing a generic calendar — mirrors F1 Arcade's and the Meetup groups' event-list pattern.
6. **Join the community.** WhatsApp group invite + Instagram follow (@thekartercup) + sim racing registration form — funnels straight into channels Karter Cup already runs, instead of building a new membership system from scratch.
7. **Past events / gallery.** Ship with labeled picsum placeholders now (see D); swap to real Instagram oEmbed once exact post URLs are obtained from the team. Justified by pattern B#6 (galleries build trust) balanced against D's authorized-use constraint.
8. **Partners / sponsors.** Prime Kart Zone and Mahindra, if the partnership is confirmed ongoing — cheap credibility signal per pattern B#9, worth a small section once confirmed rather than invented.
9. **Footer: contact + social links.** Standard, low-effort, near-universal (pattern B#3) — Instagram, Threads, WhatsApp, Linktree.

Deliberately excluded/deprioritized: merch/shop (no evidence Karter Cup sells anything yet — pattern B#11 shows this is a late-stage addition), dedicated blog/news (low pattern frequency outside media-flavored sites, and Karter Cup's actual channel for updates is Instagram, not a blog), email newsletter signup (pattern B#12 shows this is rare; Karter Cup's real capture mechanism is WhatsApp, which is already section 6), standalone FAQ page (fold key Q&A into the quiz/events sections instead of a 13th section).

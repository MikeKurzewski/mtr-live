# MTR Live

**Hong Kong in motion.** A single-page, geographic MTR map with live arrival boards and animated **estimated** train positions. Built with native JavaScript, SVG and CSS. The Vercel backend uses the Vercel Runtime Cache SDK; no MTR API key is needed.

## Run locally

Requires Node.js 22 or later.

```sh
npm start
```

Open http://127.0.0.1:5173. No installation is necessary.

```sh
npm test       # Feed parsing, timestamps, topology, estimation and rate-limit tests
npm run build # Produces frontend assets in dist/ for the Node server
```

## Features

- All 10 supported heavy-rail lines, with bilingual station names and line index.
- Zoomable, draggable geographic SVG map with a faded coastline; searchable stations and line isolation. Trains follow curved railway alignments.
- Smooth arrival-based motion, larger markers with internal direction arrows, subtle station arrival pulses, amber delay outlines and pause control.
- Station boards with destinations, platforms, countdowns and delay notices.
- Optional device location selects the nearest station, with straight-line distance and accuracy information. Manual station selection always remains available.
- Live Hong Kong clock, freshness reporting, partial-data and offline handling.
- Responsive desktop/mobile layouts, keyboard-operable stations and reduced-motion support.
- Shared Node server cache; no accounts, API keys, runtime dependencies or analytics.

## What “live” means

The [MTR Next Train API](https://data.gov.hk/en-data/dataset/mtr-data2-nexttrain-data) reports up to four upcoming arrivals per direction at each supported station. It does **not** publish GPS positions, unique train identities, or a complete fleet list. This application cannot track every physical train continuously.

Moving markers are separate **approach estimates**, inferred from imminent upcoming arrivals and approximate segment travel times. They are not globally deduplicated train identities or an operational train count. Nearby predictions are matched heuristically within the same approach; revised ETAs adjust velocity smoothly from the current position without rewinding. Unmatched predictions fade out and new ones fade in. At an estimated arrival, a subtle station ring appears and the marker dwells for six seconds before fading. Stops and dwell times are illustrative, not confirmed platform events. Amber dashed outlines reflect the station feed's delay flag, not a per-train delay measurement. Ambiguous branch approaches, including the Racecourse alternative, are omitted. The original approximate segment travel times are retained; animation follows the geographic curves by distance but is not navigation-grade. Static routes use community geographic data; the faint coastline is generalized. See [data sources and licenses](DATA_SOURCES.md).

The actual arrival board remains the authoritative part of the UI. Verify journeys and service notices with MTR.

## Data integration

The spotlight starts at Admiralty unless location permission has already been granted. **Use my location** requests a single browser location reading and selects the nearest station using geographic distance. Previously granted permission is reused automatically on page load. The app does not store or transmit coordinates, and does not track location in the background. Permission denial, unavailable location, and timeout leave manual selection available. A manual selection made during a pending lookup takes priority. Device location requires HTTPS or localhost; proximity does not prove the user is inside a station or measure walking distance.

Endpoint: `https://rt.data.gov.hk/v1/transport/mtr/getSchedule.php?line=ISL&sta=ADM&lang=EN`

- Covers AEL, TCL, TML, TKL, EAL, SIL, TWL, ISL, KTL and DRL. Light Rail and High Speed Rail are not included in this API.
- One server polls all 121 station/line feeds on a **12-second per-feed schedule**, staggered across the interval with at most six concurrent requests and an eight-second request timeout. This is approximately **605 upstream calls/minute total**, independent of visitor count, when responses are fast enough. Slow responses and backoff extend the interval. MTR does not publish a numeric quota; 12 seconds is our target, not a guaranteed permitted rate.
- Browsers read `/api/network` every four seconds while visible. They never contact MTR directly. Forty or forty thousand page views do not start extra upstream jobs. JSON snapshots are serialized and compressed once per cache version and shared across readers; ETags support `304 Not Modified` responses. A busy scheduler skips overlapping jobs, rather than creating duplicates.
- The cache warms progressively during its first interval and runs while the server is alive, even without visitors. It is an in-memory cache and warms again after restart. Hidden browser tabs stop starting cache reads; the server keeps polling.
- Explicit UTC+8 parsing avoids user-timezone errors. Feed timestamps older than 90 seconds are excluded from animation and live boards.
- Invalid predictions are filtered. Failed upstream boards are marked unavailable; their previous rows remain cached but do not animate. When the browser loses the server connection, its last valid snapshot remains usable only until the original MTR timestamps exceed 90 seconds.
- HTTP 429 pauses all new upstream jobs for at least 60 seconds. The cache honors `Retry-After` (seconds or HTTP date), increases repeated backoff up to 15 minutes, and staggers recovery. Existing in-flight requests may finish. Requests from visitors cannot bypass the backoff.
- The browser and API share an origin; no MTR browser CORS dependency or credentials are required.

The [official v1.7 specification](https://opendata.mtr.com.hk/doc/Next_Train_API_Spec_v1.7.pdf) is the source for line/station codes and response semantics. Data © MTR Corporation Limited. This is an independent project, not an official MTR product. Typeface files are loaded from Google Fonts, with system font fallbacks.

## Vercel deployment

Import this repository with production branch `main`. `vercel.json` sets the install/build configuration; no environment variables are required. Each push to `main` deploys automatically through the Vercel GitHub integration. Run `npm ci` and `node scripts/build-vercel.mjs` to build the Vercel output locally.

The Vercel deployment serves static assets plus `/api/network` as an ISR function in Hong Kong (`hkg1`). Its response is shared through Vercel's cache with a **12-second revalidation window**. Revalidation is demand-driven: after expiry, a visitor triggers a bounded refresh while cached content remains available. Refresh duration, traffic timing and propagation extend the observed interval. It is not an always-on 12-second poller.

The function shares normalized snapshots and rate-limit backoff through Vercel Runtime Cache. Refreshes have six workers, eight-second upstream timeouts, and a 40-second work budget (in-flight requests may finish for up to eight additional seconds). Browser cold-start requests allow 55 seconds. Store failures return 503 instead of falling back to per-visitor upstream calls. Original MTR timestamps still expire after 90 seconds, including when ISR serves stale content.

ISR collapses concurrent requests within a region; an in-process promise also deduplicates simultaneous refreshes. Runtime Cache is regional and ephemeral, not an atomic global lock. Cold misses in separate instances/edge regions or separate deployments can still duplicate a refresh. This substantially reduces API load, but does not guarantee a single worldwide poller or a strict 605 calls/minute ceiling. A durable distributed lock is required for that guarantee. Preview deployments have separate cache state. Query strings are excluded from the ISR cache key.

References: [Vercel ISR request collapsing](https://vercel.com/docs/incremental-static-regeneration/request-collapsing), [Runtime Cache](https://vercel.com/docs/caching/runtime-cache).

## Standalone Node deployment

The alternative standalone deployment uses a **long-running Node 22+ server** and the continuous polling behaviour described in Data integration above. GitHub Pages alone cannot run the shared cache. CI runs tests and both builds on every push/PR.

Deploy **one process / one replica**, with no cluster workers or automatic horizontal scaling. That process serves both the frontend and the shared cache. Multiple processes would create separate caches and multiply MTR calls; a distributed cache and elected poller would be required before scaling horizontally. This configuration reduces upstream load, but is not a claim of unlimited HTTP serving capacity.

The included Docker image is ready for a container host:

```sh
docker build -t mtr-live .
docker run --restart unless-stopped -p 8080:8080 mtr-live
```

Or build with `npm run build`, set `NODE_ENV=production`, `HOST=0.0.0.0`, and `PORT` to your host's assigned port, then run `npm start`. Serve it behind an HTTPS reverse proxy or a hosting platform with managed HTTPS (also required for device location outside localhost). Keep a single always-on instance; sleeping or request-scoped serverless functions will not maintain the 12-second scheduler.

`GET /healthz` reports process health and cache warmup coverage; it remains healthy during upstream outages. `GET /api/network` returns only cached normalized boards and backoff metadata. Neither endpoint can select an upstream URL or trigger a refresh. Only application assets are publicly served; server files, tests and local configuration are excluded. The server supports graceful shutdown. No new public deployment has been created by adding this configuration.

## Source map

- `src/network.js`: station catalogue, topology and approximate segment timing.
- `src/geography.js`: map projection and distance-based geographic route interpolation.
- `src/data/geography.js`: bundled station, route and coastline geometry; see `DATA_SOURCES.md`.
- `src/live.js`: API polling, parsing, freshness and position inference.
- `server/cache.mjs`: shared upstream scheduler, in-memory cache and rate-limit handling.
- `server/http.mjs`: read-only cache API, compression, ETags and public asset serving.
- `src/motion.js`: continuous velocity, prediction matching, estimated dwell and arrival events.
- `src/app.js`: SVG rendering, search, filters, arrivals and camera controls.
- `src/style.css`: responsive visual design.
- `tests/live.test.mjs`: deterministic core behaviour tests.

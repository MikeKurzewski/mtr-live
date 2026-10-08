# MTR Live

**Hong Kong in motion.** A single-page, geographic MTR map with live arrival boards and animated **estimated** train positions. Built with native JavaScript, SVG and CSS; no runtime dependencies or API keys.

## Run locally

Requires Node.js 22 or later.

```sh
npm start
```

Open http://127.0.0.1:5173. No installation is necessary.

```sh
npm test       # Feed parsing, timestamps, topology, estimation and rate-limit tests
npm run build # Produces dist/ for any static web host
```

## Features

- All 10 supported heavy-rail lines, with bilingual station names and line index.
- Zoomable, draggable geographic SVG map with a faded coastline; searchable stations and line isolation. Trains follow curved railway alignments.
- Smooth arrival-based motion, larger markers with internal direction arrows, subtle station arrival pulses, amber delay outlines and pause control.
- Station boards with destinations, platforms, countdowns and delay notices.
- Optional device location selects the nearest station, with straight-line distance and accuracy information. Manual station selection always remains available.
- Live Hong Kong clock, freshness reporting, partial-data and offline handling.
- Responsive desktop/mobile layouts, keyboard-operable stations and reduced-motion support.
- No accounts, secrets, backend or analytics.

## What “live” means

The [MTR Next Train API](https://data.gov.hk/en-data/dataset/mtr-data2-nexttrain-data) reports up to four upcoming arrivals per direction at each supported station. It does **not** publish GPS positions, unique train identities, or a complete fleet list. This application cannot track every physical train continuously.

Moving markers are separate **approach estimates**, inferred from imminent upcoming arrivals and approximate segment travel times. They are not globally deduplicated train identities or an operational train count. Nearby predictions are matched heuristically within the same approach; revised ETAs adjust velocity smoothly from the current position without rewinding. Unmatched predictions fade out and new ones fade in. At an estimated arrival, a subtle station ring appears and the marker dwells for six seconds before fading. Stops and dwell times are illustrative, not confirmed platform events. Amber dashed outlines reflect the station feed's delay flag, not a per-train delay measurement. Ambiguous branch approaches, including the Racecourse alternative, are omitted. The original approximate segment travel times are retained; animation follows the geographic curves by distance but is not navigation-grade. Static routes use community geographic data; the faint coastline is generalized. See [data sources and licenses](DATA_SOURCES.md).

The actual arrival board remains the authoritative part of the UI. Verify journeys and service notices with MTR.

## Data integration

The spotlight starts at Admiralty unless location permission has already been granted. **Use my location** requests a single browser location reading and selects the nearest station using geographic distance. Previously granted permission is reused automatically on page load. The app does not store or transmit coordinates, and does not track location in the background. Permission denial, unavailable location, and timeout leave manual selection available. A manual selection made during a pending lookup takes priority. Device location requires HTTPS or localhost; proximity does not prove the user is inside a station or measure walking distance.

Endpoint: `https://rt.data.gov.hk/v1/transport/mtr/getSchedule.php?line=ISL&sta=ADM&lang=EN`

- Covers AEL, TCL, TML, TKL, EAL, SIL, TWL, ISL, KTL and DRL. Light Rail and High Speed Rail are not included in this API.
- Network polling runs with six concurrent requests, with 30 seconds between completed cycles. The upstream dataset updates approximately every 10 seconds; local complete-network refresh takes longer.
- Prioritises the selected station when a refresh begins. Background tabs do not start new scheduled refreshes; an in-flight cycle may finish.
- Explicit UTC+8 parsing avoids user-timezone errors. Feed timestamps older than 90 seconds are excluded from animation and live boards.
- Invalid predictions are filtered. Failures do not generate fake data. HTTP 429 stops queue processing and triggers at least a 60-second backoff.
- Uses the API's browser CORS support. On a restrictive network, the app shows unavailable data and retries. For a large public deployment, use a shared caching proxy to reduce per-viewer upstream traffic.

The [official v1.7 specification](https://opendata.mtr.com.hk/doc/Next_Train_API_Spec_v1.7.pdf) is the source for line/station codes and response semantics. Data © MTR Corporation Limited. This is an independent project, not an official MTR product. Typeface files are loaded from Google Fonts, with system font fallbacks.

## Deployment

`dist/` is a self-contained static website with relative asset paths, suitable for GitHub Pages or another static host. The included GitHub Actions workflow tests and builds every push/PR. To publish, enable Pages with GitHub Actions as its source, then run the deployment workflow manually. Pages availability for private repositories depends on your GitHub plan. No secrets are required.

## Source map

- `src/network.js`: station catalogue, topology and approximate segment timing.
- `src/geography.js`: map projection and distance-based geographic route interpolation.
- `src/data/geography.js`: bundled station, route and coastline geometry; see `DATA_SOURCES.md`.
- `src/live.js`: API polling, parsing, freshness and position inference.
- `src/motion.js`: continuous velocity, prediction matching, estimated dwell and arrival events.
- `src/app.js`: SVG rendering, search, filters, arrivals and camera controls.
- `src/style.css`: responsive visual design.
- `tests/live.test.mjs`: deterministic core behaviour tests.

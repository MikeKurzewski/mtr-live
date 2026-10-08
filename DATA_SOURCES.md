# Geographic map data

Retrieved 8 October 2026. `src/data/geography.js` contains geographic data derived from the following sources, not live train positions.

## Rail alignments

HK Bus Crawling@2021, https://github.com/hkbus/route-waypoints

Ten static geographic shape files: `https://raw.githubusercontent.com/hkbus/route-waypoints/main/mtr/{line}.json`, for ael, drl, eal, isl, ktl, sil, tcl, tkl, tml and twl. The source repository distributes these under GPL-2.0; the license is retained in `licenses/geographic-data-GPL-2.0.txt`. No crawler implementation is copied.

The curves are split into station-to-station paths, connecting branch endpoints where necessary. Station centres are connected to their nearest route vertices. Small offsets distinguish shared segments. This is a geographic visualization, not a survey of exact tracks or platforms. Source geometry may lag construction or reclamation.

## Station coordinates

HK Bus Crawling: https://github.com/hkbus/hk-bus-crawling (GPL-2.0).

The `stopList` in https://data.hkbus.app/routeFareList.json supplies coordinates for 97 of the 98 stations. Racecourse is supplemented from Wikidata Q841864 (CC0): https://www.wikidata.org/wiki/Q841864.

## Coastline

Natural Earth 1:10m land polygons (public domain):
https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_land.geojson

Terms: https://www.naturalearthdata.com/about/terms-of-use/

Polygons are clipped to Hong Kong's surroundings. This is a generalized coastline, so small islands and recent reclaimed land may not appear precisely. All geometry shares one Mercator projection; no third-party tile requests or map key are required at runtime.

## Rebuilding

Place the ten lowercase route JSONs, `routeFareList.json`, and `land.geojson` from the URLs above in `output/geodata/`, then run `node scripts/build-geography.mjs`. The generated data module is checked in; ordinary builds need no download. The derived railway/station data in that module retains the source GPL-2.0 license. The coastline retains its public-domain status.

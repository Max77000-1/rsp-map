# Changelog

## v1.0.2 — 2026-05-08

### Fixed
- **Layer creation silently failed** because Mapbox does not accept `["zoom"]` inside a `["case"]` paint expression. The previous attempt to fade polygon centroids by zoom level invalidated the entire `circle-opacity` paint, blocking creation of `rsp-points`, `rsp-polygons-fill`, and `rsp-polygons-line`.
- Replaced with two filtered layers: `rsp-points` for non-polygon items (always visible) and `rsp-points-centroid` for polygon centroids (with `maxzoom: POLYGON_MIN_ZOOM` so they hide once polygons render).

## v1.0.1 — 2026-05-08

### Added
- **URL state**: deep-linkable map. `?id=<slug>&center=lng,lat&zoom=N` opens the map at exactly the saved viewport with the sidebar already open for that item. Updates on every move via `history.replaceState` (no back-button spam).
- **Floating legend**: auto-built from active sources, RTL/LTR aware, click the title bar to collapse.
- **i18n EN/AR**: source labels and UI text swap based on `<html lang>` or `/ar/*` path. Added English labels alongside Arabic ones in `SOURCES`.

## v1.0.0 — 2026-05-08

### Added
- **Mapbox terrain** via `mapbox.mapbox-terrain-dem-v1` source + `setTerrain({ exaggeration: 1.2 })`. Real elevation for Syrian mountains.
- **Sky atmosphere** layer (`type: "sky"`).
- **3D fill-extrusion** for polygon items with `model-height-m > 0`. Activates at `zoom >= 13`. Vertical gradient enabled.
- Initial map pitch 18° to communicate terrain depth on first paint.

### Notes
- 3D buildings activate only when polygon items have a numeric `model-height-m`. Editor must add the hidden input `<input id="locationModelHeight" value="{{ Model Height (m) }}">` to the projects collection item template.

## v0.9.0 — 2026-05-08

### Added
- **Polygons (Phase 3)**. Items with `geometry-type=polygon` and a parseable `polygon-geojson` field render as filled polygons with coloured strokes.
- Zoom-aware switching: at zoom < 9 a centroid dot represents the area; at zoom ≥ 9 the polygon takes over.
- Centroid auto-computed from the polygon's outer ring if Lat/Lng are blank.
- Polygon parser accepts FeatureCollection, Feature, raw Geometry, or just a coordinates array — copy whatever geojson.io outputs.
- Hover state via `feature-state.hover` (fill-opacity 0.22 → 0.45 on hover).
- Click on polygon flies to centroid + opens sidebar by slug.

### Designer wiring required
Add hidden inputs to polygon-capable Collection Item templates (destruction-area, projects, investments, locations):
```
<input type="hidden" id="locationGeometryType" value="{{ Geometry Type }}" />
<input type="hidden" id="locationPolygon"      value="{{ Polygon GeoJSON }}" />
```

## v0.8.3 — 2026-05-08

### Changed
- Cluster bubble visual cap raised from 38 px to 26 px for better proportion against terrain.
- `clusterRadius: 38` (was 50) — smaller groups, more clusters spread out.
- `clusterMaxZoom: 12` (was 14) — points break apart sooner when zooming in.

## v0.8.2 — 2026-05-08

### Fixed
- `renderedIds` was deleted in v0.8.0 but two log statements still referenced it, throwing `ReferenceError` and blocking layer creation.

## v0.8.1 — 2026-05-08

### Added
- Retry pattern for source/layer setup. Mapbox v3 with `projection: globe` returns false from `isStyleLoaded()` intermittently even after the style is rendered. We attempt `addSource` inside a try/catch and retry every 400 ms until it succeeds.

## v0.8.0 — 2026-05-08

### Added
- **Native Mapbox clustering (Phase 1)**. Replaced DOM-based `mapboxgl.Marker` with a single GeoJSON source `rsp-points` and three layers: cluster circles, cluster count labels, individual coloured points.
- Click cluster → `getClusterExpansionZoom` + `easeTo`.
- Click point → fly + open sidebar via stable slug.
- Filter toggles re-set source data; Mapbox re-clusters automatically.
- 10× perf improvement vs DOM markers.

## v0.7.4 — 2026-05-08

### Added
- Hide Webflow native pagination UI (`.w-pagination-wrapper`) inside `.w-dyn-list` — required by Finsweet for List Load to work, but not for end users.

### Fixed
- Marker `transform: scale()` on hover warped the marker to (0,0) because Mapbox owns the parent's `transform: translate()`. Wrapped visual in an inner div that scales while parent stays put.

## v0.7.3 — 2026-05-08

### Added
- `data-rsp-source` attribute on a Collection List wrapper as authoritative source hint, fallback to href detection. Used for new lists (projects, tenders, orgs) without Visit Profile links.

## v0.7.2 — 2026-05-08

### Fixed
- Encounter-ordered source discovery. Webflow paginated wrappers all share `id="location-list5"`, and the previous `report` keyed by `listEl.id` overwrote duplicate-ID entries. Now an array of `{index, listId, source}` preserves all encounters.

## v0.7.1 — 2026-05-08

### Fixed
- `querySelector("#1cms")` is invalid because IDs starting with a digit are not valid CSS identifiers. Switched to `getElementById` for all `[N]cms` lookups.

## v0.7.0 — 2026-05-08

### Added
- Coloured dot markers using brand palette per source (no icon images).
- Filter buttons receive `data-rsp-src` attribute and tinted active state via injected stylesheet.
- The `#Next` random-marker button is hidden by the map module.
- Filter button binding re-runs every render so late-arriving sources get wired.

## v0.6.6 — 2026-05-08

### Added
- Hide page preloader once first markers render. Finsweet's paginated XHRs were keeping `window.load` from firing.

## v0.6.5 — 2026-05-08

### Changed
- Removed dependency on `map.loaded()` for boot. Render kicks off as soon as items appear in the DOM; markers attach to the map container regardless of style state.

## v0.6.4 — 2026-05-08

### Added
- Poll-based boot: registers `load` listener AND polls `map.loaded()` to handle the race where the load event fires before our listener is attached (defer-script timing on a fast network).

## v0.6.3 — 2026-05-08

### Added
- Top-level try/catch around the IIFE. Surfaces any boot-time error to `window.__rsp_err` so silent failures become visible in DevTools.
- Early-return paths log readable error codes (`MISSING_TOKEN`, `MAPBOX_NOT_LOADED`, `NO_MAP_CONTAINER`).

## v0.6.2 — 2026-05-08

### Added
- `window.__rsp` diagnostic surface: `version`, `map`, `config`, `sources`, `features()`, `rendered()`, `processed()`, `rerender()`, `visibility()`. Read-only consumers expected.

## v0.6.1 — 2026-05-08

### Added
- Two-phase render pipeline:
  1. **First render** as soon as any items appear (no arbitrary wait).
  2. **Continuous render** via long-lived MutationObserver: every new batch of items from Finsweet triggers debounced re-discovery and adds previously-unseen markers.
- `processedIds` and `renderedIds` registers prevent duplicate markers across re-runs and across duplicate list IDs.
- Observer self-stops after 30 s of DOM idle.

## v0.6.0 — 2026-05-08

### Added
- **Multi-source auto-discovery**: reads any `<div id="location-list*">` and detects its source collection from the first item's link href.
- **Finsweet List Load V2 awareness**: MutationObserver waits for Finsweet to finish injecting paginated items before reading.
- Support for the 3 previously-missing collections: projects, tenders, organization-and-initiative.
- `window.RSP_MAP_CONFIG.styleUrl`, `center`, `zoom` overrides.
- `style.load` re-attaches sources after satellite toggle.

### Changed
- Centralised `SOURCES` registry per `CLAUDE.md` brand palette.
- Sidebar lookup uses `data-loc-id` slug (carried over from v0.5.0).

## v0.5.0 — 2026-05-08

### Fixed
- **Marker ↔ sidebar card mismatch**: items with missing or invalid coordinates caused `arrayID` to drift. Replaced numeric `eq(arrayID)` with stable string-ID lookup via `data-loc-id`.

### Changed
- Token now read from `window.RSP_MAP_CONFIG.mapboxToken` instead of being hardcoded in source.

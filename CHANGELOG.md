# Changelog

## v1.0.38 — 2026-09-22

- The building mask now also uses each model's real ground footprint: on load, every triangle is projected to the ground and rasterised into 2 m cells, and the convex hull of those cells becomes the model's outline. Base-map buildings whose centroid or any corner lies inside a model polygon, inside that outline, or within 4 m of the footprint are hidden — so models with no CMS polygon (Zamzam, Beaumont, Financial Centre) are masked too, and so are buildings in the gaps between a model's blocks.
- Flat building outlines (fill/line layers on the `building` source-layer) are masked alongside the 3D extrusions.
- Debug: `window.__rsp.footprints`.

## v1.0.37 — 2026-09-22

- Base-map buildings inside a model project's footprint polygon are now actually hidden. The v1.0.2x `within` filter never matched a building (Mapbox evaluates `within` for Point/LineString features only); buildings are now excluded by feature id when their centroid lies inside the polygon, refreshed as tiles load. Measured on Yaafour villas: 79 drawn before, 0 inside after.

## v1.0.36 — 2026-09-21

### Changed
- **Place names of the previous era are hidden** (Maher, 2026-09-21): names that honour the Assad family or the Baath party and its dates. The list comes from the whole Syrian `place_label` set (7,702 names, swept tile by tile). Each ambiguous name was researched, and a second reviewer tried to refute every verdict.
  - Hidden: ضاحية الشهيد باسل الأسد بالمطار · الباسل (formerly اليابسة, near Qardaha) · البعثية (Sarrin) · Thamin al-Adhar ("8 March", near Tal Abyad) · الأسدية (two villages, Raqqa and Hasakah). Any label that holds the full name of Basil, Hafez or Bashar al-Assad is hidden too, in Arabic or Latin.
  - Kept, with evidence: آذار (Jisr al-Shughur, a name older than 1933) · خربة الاسدية (an old ruin) · مزرعة الرئيس (al-Ruways, mis-rendered) · خربة بشار (a personal name) · the village الأسد in Sarrin (Arabic for the Turkish "Arslan Köy", lion village).
- Hiding more names needs no release: `hiddenPlaceNames: [...]` in `RSP_MAP_CONFIG`.

Tested over the live page, Arabic and English: every hidden name is in the data at its spot and not drawn, every kept name is still drawn, and the config setting hides an extra name (المزة) that shows without it. Zero errors.

## v1.0.35 — 2026-09-21

### Added
- **Place names on demand.** The custom style carries no place names at all. A third button beside Satellite / Home (`#maplabels`, a copy of the satellite button so it keeps the site's style) shows them in the page's language — Arabic on `/ar`, English on `/map` — from Mapbox Streets v8 `place_label`. Off by default (the map looks as before and fetches nothing extra); the choice is remembered per visitor. **Syrian places only** (`iso_3166_1 == "SY"`), the same line as place search: unfiltered, the basemap also names Israeli-built localities inside the Golan under an IL code. All 17 cities show far out; villages are thinned from z8 and return as the visitor zooms in. The Arabic shaping plugin (v0.2.3) loads when the names are turned on — its "lazy" mode never fetched it by itself and no Arabic name was drawn; v0.3.0 threw "RTL text plugin already registered" with GL JS 3.7.
- **Hover preview (mouse only).** Name and category of a point or area before the click; for a cluster, its top three categories with counts. Touch screens skip it.
- **Clusters coloured by what they hold.** A cluster takes the colour of the category it holds most of (per-category counts via `clusterProperties`). The previous look — teal / navy / gold by count — returns with `clusterColors: "size"` in `RSP_MAP_CONFIG`, no release needed.
- **Globe glow in the platform palette.** Navy space, stars and a thin halo instead of the style's grey. `globeGlow: false` keeps the style's own atmosphere.

### Changed
- **Terrain only when the map is tilted.** Seen from straight above our terrain changes nothing visible, yet it downloaded elevation tiles at every zoom. `syncTerrain()` turns it on at `pitchend` from 5° and off below, re-checks on `idle`, and drops it before a style swap. The style's own relief (its imported basemap has a hillshade layer and its own terrain) stays as designed. Measured on the live page, same path (open, Damascus z9–13 flat, tilt, Home, Aleppo z11): elevation tiles **4.5 MB → 0.76 MB** on desktop, 2.9 → 2.75 MB on a phone (where the style's hillshade dominates); opening view 212 KB → 3 KB.
- **Place search starts at three letters.** Two letters rarely name a place, and each keystroke past `minLength` is a Mapbox Geocoding request. `minLength` is 3 (plugin default 2).

### Fixed
- **Every click fired twice after a satellite switch.** Layer-bound listeners live on the map and survive a style swap; attaching them again on each `style.load` doubled them. `attachLayerHandlers()` now runs once.

### Not changed
- The auto-rotation (`setInterval` + `rotateTo` every 50 ms) was a candidate for a lighter rewrite, but on the live page it never runs: its only triggers are `#Zoom`, which the page does not have, and `#Next`, which is hidden.

### Page
- The phone capsule is centred on its width: three 40 px buttons + 46 px search = 173 px (was 131 px). That number lives in the map page's head code and changes in the same publish.

## v1.0.34 — 2026-09-20

### Changed
- **Places are Syria-only (Maher's decision).** The geocoder asked Mapbox for places in sy, lb, jo, iq and tr, so a search for "النصر" filled the list with Nasr in Dhi Qar, Erbil, Nineveh and Amman. `countries` is now `sy`. Anything outside Syria may still appear — but only when it is our own data, because `localGeocoder` is not bound by that list.
- **Our own items fill the suggestions first.** The local matcher stops at 8 instead of 5; the dropdown shows five, so whenever the platform has matches they take every slot and places are pushed out.

## v1.0.33 — 2026-09-20

### Fixed
- **Search showed the governorate instead of the project.** The local geocoder read `.card_heading` and that class first matches `.card_heading.mobile`, which holds the governorate badge — every result read "حمص". It now reads `.card_heading:not(.mobile)` (then `.locations-map_name .text-block`), so "بوليفارد النصر" appears under its own name.
- **Arabic search found nothing.** Query and haystack are now normalised the same way (harakat and tatweel stripped, أ/إ/آ → ا, ة → ه, ى → ي, dashes and underscores to spaces), so "النصر" finds "بوليفارد النصر". Measured before the fix: 0 suggestions for "النصر" and "حمص".
- **Only the first polygon in a field was drawn.** `parsePolygon` returned the first polygon feature it found, so a throwaway sketch left in a geojson.io export hid the real plot (four projects affected, 2026-08-30). Every polygon in the file is now kept and merged into one MultiPolygon, and degenerate rings — fewer than three distinct points or zero area — are dropped.
- **The tapped point flew under the mobile card.** Every path that opens a card (point click, polygon click, deep link) now lifts the target by 24% of the viewport height on screens under 768px.

### Changed
- **Clusters get room on phones.** `clusterRadius` is 60 under 768px (25 elsewhere): at the opening zoom the 25px radius left separate cluster bubbles overlapping each other.
- **Companies colour.** Source colour is now the lighter navy `#7FA6D4`; the brand navy `#2E5077` was invisible against the navy filter chip it sits on (Maher, 2026-09-20).
- **mapbox-gl may be deferred.** The boot no longer gives up when `mapboxgl` is missing; it waits up to 15 seconds for the library, so the page can stop loading it render-blocking.

## v1.0.32 — 2026-09-06

### Fixed
- **Models buried on sloping terrain.** The model was grounded on the terrain height at its origin point only, so on a slope everything uphill of the origin sank into the ground (Beaumont: the mall arcade vanished on one side). The terrain is now sampled at the origin plus eight points around the model footprint every frame and the model is grounded on the highest one.
- **Foundation skirts.** A model whose geometry extends below y=0 (by more than 0.5 m) is treated as carrying an authored foundation skirt: its own y=0 is the ground level (instead of the bounding-box bottom), so the skirt hangs below ground and hides the gap on the downhill side. Skirt-less models (AI exports) behave exactly as before.

## v1.0.31 — 2026-09-05

### Changed
- **Shade-preserving model tint.** Every glTF model now wears its source colour (v1.0.29 had let multi-material models keep their authored colours; Maher wants them in the source colour too). The brightest material becomes the full source colour and every other material gets the same hue scaled by its authored luminance ratio (floor 0.3), so a Blender model with a white facade and darker glass renders as teal facade + dark-teal glass. Single-material models behave exactly as before.

## v1.0.30 — 2026-09-05

### Changed
- **Source colours swapped (Maher's decision):** Projects are now teal `#4DA1A9`, Companies are now brand navy `#2E5077`. Applies to markers, polygons, filter buttons, legend and tinted single-material models.

## v1.0.29 — 2026-09-05

### Changed
- **Projects colour is now brand navy `#2E5077`** (was purple `#9B5DE5`, outside the brand palette). Applies to markers, polygons, filter button, legend and tinted single-material models. Companies stay teal.
- **Authored glTF models keep their own colours.** Until now every model was recoloured with its source colour (purple for projects), which was right for single-material AI/photogrammetry exports but destroyed deliberately authored models. A glTF with two or more materials (e.g. the Blender-built white facade + darker glass) now keeps every material colour; single-material models are tinted as before. Metalness normalised to 0, roughness 0.7 for authored / 0.85 for tinted. Console logs the material count and which path was taken.
- New model `assets/models/db-triangle-building.glb` (procedural Blender, 90 KB Draco, 2 materials, 26.5k tris) — first model built for the "white + darker glass" map style.

## v1.0.28 — 2026-07-16

### Fixed
- **The 70 lingering "open" cards survived every sweep — guard logic bug.** Live probing showed the stray cards are items WITHOUT valid coordinates: processList skips them before assigning `data-loc-id`, so `getAttribute("data-loc-id")` returns null. With no card open, `currentOpenId` is also null, and the sweep guard `id !== currentOpenId` evaluated `null !== null` = false — treating every no-id item as "the open card" and skipping it, forever. The guard now strips whenever no card is open, and otherwise keeps only the exact id match (a no-id item can never be the open card). One-line root-cause fix after v1.0.26/27 hardened the sweep cadence.
- Clarified v1.0.27 diagnosis: the 560-of-630 gap is items with no valid lat/lng (they legitimately have no marker), not dropped batches.


## v1.0.27 — 2026-07-16

### Fixed
- **Late Finsweet batches were silently dropped on slow loads.** The continuous-render MutationObserver self-stopped after 30 s of DOM idle; on slow networks the last Finsweet batch landed AFTER that stop, so its items were never processed (70 markers missing from the map in live diagnosis: 630 items in DOM vs 560 processed) and their baked-in `is--show` cards were never swept (the "cards on load" the user still saw on v1.0.26). The observer now NEVER self-stops (it is cheap — it only counts items on childList mutations), and a 5 s drift net additionally (a) forces a render if the DOM item count changed unnoticed and (b) sweeps stray `is--show` cards even on class-only mutations.
- Removed a secondary bug in the old idle timer: it updated the seen-count on change WITHOUT scheduling a render.


## v1.0.26 — 2026-06-16

### Fixed
- **Cards still appearing on page load (root cause found).** Live diagnosis showed 143 items arriving from Webflow with `is--show` BAKED into the collection-item template class (`locations-map_item is--show w-dyn-item`, list `location-list4`). The timed 0/600/1800 ms cleanup missed late Finsweet batches, which kept re-introducing "open" cards for tens of seconds. The sweep (`stripStrayShownCards`) now also runs on EVERY render — each Finsweet batch triggers one — and is guarded by `currentOpenId`, so the card the user opened (marker click or deep link) is never closed by the sweep.
- **Preloader stuck / reappearing.** A Webflow interaction was observed re-showing the preloader (inline `display:flex`) after our one-shot hide, leaving users on the loading screen indefinitely. `hidePreloader` now hides ALL `.preloader` nodes, re-asserts on every render, and injects a stylesheet kill rule (`display:none !important`) 600 ms after the first hide — a stylesheet `!important` beats inline styles, so the overlay cannot come back.

### Designer note
- The real root of the card bug is `is--show` baked into the locations/attractions collection-item template in the Designer. The map is now immune either way, but removing that combo class in the Designer remains the clean fix.


## v1.0.25 — 2026-06-09

### Fixed
- **Sidebar cards appearing on page load before any click.** Replaced the ad-hoc hide hacks with a single CSS source of truth using `:has()`: a `.locations-map_wrapper` is shown ONLY when it actually contains a `.locations-map_item.is--show`. This also subsumes the Arabic `:lang(ar){display:none}` fix — locale-agnostic now.
- **3D model sat at a different height each load (half-buried or floating).** The terrain elevation was locked on the FIRST query, whose value came from partly-loaded terrain tiles and varied by timing. The model now re-queries the terrain height every frame and tracks it, settling to the correct elevation as tiles refine. Lift reduced to 1 m.

### Changed
- **Models load only at close zoom (>= 14).** three.js + the .glb are no longer fetched until the user is zoomed in enough to actually see the model; below zoom 14 the model is not drawn and its click target is inactive. Saves bandwidth and avoids tiny specks at city scale.


## v1.0.24 — 2026-06-09

### Fixed
- **3D models stayed clickable after the CMS polygon is removed.** Hit volume now auto-generated from the model footprint (dedicated rsp-model-hits-src source); models clickable with or without a polygon.


## v1.0.23 — 2026-06-09

### Fixed
- **Map sometimes loaded the basemap but NO data (markers, polygons, 3D models).** Under projection:globe, `isStyleLoaded()` can stay false indefinitely even after the style is visually rendered, so `addSource` kept throwing "Style is not done loading" and the source — hence every marker and model — was never added. The boot no longer waits on a 400 ms poll alone: it also drives source-add attempts off Mapbox readiness events (`idle`, `styledata`, `sourcedata`, `load`), so the data layer attaches the moment the style is actually ready. This was intermittent (network/timing dependent), which is why "yesterday it worked, today it did not".
- **3D model dependency loads now retry.** If three.js / GLTFLoader / DRACOLoader fail to fetch from their CDN, the cached promise is cleared and the model slot released, so a later render retries instead of the model hanging invisibly forever.


## v1.0.22 — 2026-06-09

### Fixed
- **Models no longer render microscopically when the height input is empty.** If `locationModelHeight` is missing/empty (e.g. a broken Designer binding after editing the embed), the model now falls back to a visible 60 m default and logs a warning naming the item, instead of rendering at 1 unit = 1 m (invisible). Editors fine-tune via Model Scale.

## v1.0.21 — 2026-06-09

### Added
- **CMS-controlled model rotation & scale.** New number fields `Model Rotation (deg)` and `Model Scale` (percent; 100 = default) on the projects and locations collections. Read from hidden inputs `locationModelRotation` / `locationModelScale`; the model yaws and resizes at runtime — no need to re-bake the .glb to re-orient. Rotation is applied before bounding-box fit so centering stays correct.
- **Base-map buildings hidden inside model footprints.** `applyBuildingMask()` sets a `["!", ["within", <multipolygon>]]` filter on every base-map fill-extrusion layer, so Mapbox's own white buildings inside a project footprint disappear and don't clash with the glTF model. The rest of the city keeps its buildings. Re-applied on style reload.

### Changed
- The Beaumont .glb was reverted to its unrotated form; orientation is now driven entirely by the `Model Rotation (deg)` CMS field (set to 90).

## v1.0.20 — 2026-06-09

### Added
- **3D models are clickable.** An invisible fill-extrusion (`rsp-model-hits`, opacity 0) is built from each model's footprint up to its height; Mapbox `queryRenderedFeatures` returns it, so clicking anywhere on the model silhouette opens the project sidebar.
- **Models take the source colour.** At load, the (texture-less) model mesh is recoloured to its category colour (projects = `#9B5DE5`), matching the footprint polygon.

### Fixed
- **Models partly buried by terrain.** The model origin is now lifted 6 m above the queried terrain elevation so coarse terrain bumps no longer clip the base.
- The visible solid extrusion (`rsp-buildings`) now excludes model items (`isModel != true`) so the glTF mesh is the only 3D body, with the footprint shown flat beneath it.

## v1.0.19 — 2026-06-09

### Added
- **Draco-compressed glTF support.** `ensureThree()` now also lazy-loads `DRACOLoader`, and each model loader attaches a Draco decoder (gstatic CDN). This lets the map read Draco-encoded `.glb` files, which shrink heavy AI-generated models dramatically (e.g. an Umayyad Mosque model: 942k tris / 22 MB → 113k tris / 312 KB).
- Tooling: `tools/optimize-glb.mjs` (gltf-transform: weld → simplify → prune/dedup → stone colour → Draco) for turning Tripo/Meshy exports into web-ready models.

### Fixed
- **3D models buried under terrain.** With terrain enabled, a model placed at sea level (altitude 0) sinks below the rendered ground — Damascus sits at ~680 m, so the model was 680 m underground (invisible). The custom-layer `render()` now queries the exaggerated terrain elevation at the model origin once it's available and rebuilds the transform so the base rests on the visible terrain surface. Terrain stays on; models show.

## v1.0.18 — 2026-06-09

### Fixed
- **Model items no longer double-render.** An item with both a `Polygon GeoJSON` footprint and `Geometry Type = model` was extruding the footprint to `Model Height (m)` (via the buildings layer) AND rendering the glTF, so a solid block collided with the 3D model. Now, when an item is a model, its footprint polygon is forced flat (height 0) — it grounds the model — while `Model Height (m)` scales the glTF only.

### Added
- First production massing model shipped: `assets/models/syria-towers-massing.glb` (procedurally generated twin towers + podium + perimeter blocks + plaza/fountain, brand palette, ~187×104×128 m), attached to `syria-towers-complex-baramkeh` with `Model Height (m) = 102`.

## v1.0.17 — 2026-05-25

### Fixed
- **glTF models invisible on the map.** Diagnostics on Syria Towers (`syria-towers-complex-baramkeh`) revealed the .glb (generated by `trimesh`) was normalized into a ~2-unit cube — at the 1-unit-equals-1-meter assumption it rendered as a 2 m object next to a 100 m tower, effectively invisible.
- After GLTFLoader resolves, the map now auto-fits each model: it reads the scene's bounding box, and if `Model Height (m)` is set on the CMS item, scales the model uniformly so its Y extent equals that height in meters. It then centers the model horizontally on the lng/lat and translates it so its base rests on the ground (Y = 0). Models with no `Model Height (m)` keep the previous "1 unit = 1 meter" assumption.
- Console now logs each model's source dimensions, applied scale and target height for quick diagnosis.

## v1.0.16 — 2026-05-17

### Added
- **Phase 5: real 3D models (glTF).** Items with `Geometry Type = model` and a non-empty `3D Model URL` field now render their .glb file directly on the map via a Mapbox custom layer. Three.js (r128) and the GLTFLoader are lazy-loaded from jsDelivr on first model — pages with no model items pay zero extra cost. Each model gets its own custom layer, positioned at the item's lng/lat in meters, rotated Y-up → Z-up. Layers are re-added automatically after style toggles (satellite).
- New hidden input expected on the projects collection-item embed: `<input type="hidden" id="locationModelUrl" value="{{ 3D Model URL }}" />`.

## v1.0.15 — 2026-05-14

### Fixed
- **Arabic sidebar card never appeared.** The Webflow project carries a CSS rule `.locations-map_wrapper:lang(ar){display:none}` that hides the entire info-card wrapper in the Arabic locale, and the wrapper also resolved to `width:0` there. Confirmed live: clicking any marker in Arabic flew the map and updated the URL but showed no card. Injected an override (`display:block !important; width:20em !important` on the wrapper, plus `width:20em` on the shown item) so the Arabic card renders identically to English (verified 320×442). The Designer rule can also be removed manually; this override is defensive against that drift.

## v1.0.14 — 2026-05-14

### Fixed
- **Home & Satellite buttons dead in Arabic.** `#RestMap` and `#mapmode` were bound once at boot via `jq("#id").on(...)`; in the Arabic locale the elements were not in the DOM at that instant, so nothing bound. All four map controls (`#RestMap`, `#mapmode`, `#Zoom`, `#Next`) now use document-level event delegation, immune to timing and Webflow re-renders. The direct `#mapmode` binding was removed to avoid a double-fire in locales where it did bind.
- **Projects cards collapsed to 0×0 (empty card, unclickable close).** The projects collection's `.locations-map_wrapper` was published without the `is---hidden` class that supplies `width: 20em`; its width was 0, so every projects card had no size. `ensureSidebarWrapperClass()` now adds the class to any wrapper missing it, at boot and twice after, so all 8 collections render cards identically.
- **Sidebar card opening by itself on load.** `forceHideSidebarOnce()` now clears the shown state at boot and again at 600 ms and 1800 ms, covering the race where jQuery/DOM were not ready on the first attempt.
- **`openSidebarFor` robustness.** Shows every DOM node matching the slug (not just the first), guarding against unrendered Finsweet duplicates.

### Added
- **In-map loading indicator.** A small pill ("Loading locations..." / "جارٍ تحميل المواقع...") shows immediately and fades only when real markers reach the map, replacing the 10-18 s blank-map window on cold load. Safety timeout removes it after 30 s.

### Changed
- **Organizations & initiatives source is now visible** (the `hidden` flag was removed) and binds to the new 8th filter button (`8cms`).

## v1.0.13 — 2026-05-14

### Fixed
- **Close-card button not working for projects & locations.** The handler bound only to the `.close-block` class. The projects and locations collection templates give their close button only `id="closeWindow"` (no class), so it was never bound. Replaced with a delegated `document` click listener that matches either `.close-block` or `id="closeWindow"`, and also covers cards injected later by Finsweet.

## v1.0.12 — 2026-05-14

### Changed
- **Search box pinned to top-right in both locales.** Previously it mounted top-left under RTL (Arabic). Now `top-right` regardless of locale, per request.

## v1.0.11 — 2026-05-14

### Fixed
- **Arabic locale: filter buttons unresponsive.** On `/ar/the-map-v2` all internal links are prefixed with `/ar/` (e.g. `/ar/companies/<slug>`). The href-based source detector was reading segment `[0]` after splitting by `/`, getting `"ar"` (not a SOURCES key), so every list returned `null` for its source. With `sourceOrder` empty, no filter button got wired and no source was rendered. Now scans all path segments and picks the first one that matches a known SOURCES key.

## v1.0.10 — 2026-05-13

### Changed
- **Hide "Powered by Mapbox" link** inside the Geocoder results panel via CSS (`.mapboxgl-ctrl-geocoder--powered-by`). The main map still renders the required Mapbox attribution control, satisfying Mapbox terms.

## v1.0.9 — 2026-05-13

### Changed
- **Projects color** changed from `#3A6EA5` (blue) to `#9B5DE5` (vivid purple). Even the brighter blue blended with the navy button background. Purple is distinct from every other source and clearly visible on any background.

### Fixed
- **Stale legend leftover removed on boot.** If a cached older build had already attached the `#rsp-legend` element to the DOM, the new build now removes it explicitly. Prevents the legend reappearing for users still on a stale CDN copy during the rollover window.

## v1.0.8 — 2026-05-13

### Removed
- **Floating legend** ("Categories" panel). Filter buttons already display their source name and icon, so the legend was redundant. Code retained behind a commented call for fast restoration if needed.

### Changed
- **Projects color brightened** from `#2E5077` (brand navy) to `#3A6EA5` (richer blue). The original navy blended with the dark navy button background, leaving the projects filter visually unmarked.
- **Filter dot indicator** now has a white ring + soft outer shadow so every source color stays visible against any button background. Increased size from 6 px to 8 px.

## v1.0.7 — 2026-05-13

### Changed
- **Orgs source hidden from UI until the collection is ready.** Added `hidden: true` flag on `organization-and-initiative` in the `SOURCES` registry. The legend skips its row, the filter button (if present in DOM) is set to `display: none`, and `visibility` is forced to `false` so any stray items never render. To re-enable later: remove the `hidden: true` flag — that's the only change required.

## v1.0.5 — 2026-05-09

### Added
- **Geocoder (search box)**. Mapbox Geocoder plugin loaded dynamically (no Designer change). Country bias to `sy,lb,jo,iq,tr`. Locale-aware placeholder ("ابحث عن مكان..." in Arabic, "Search a place..." in English). Mounted in top-right (LTR) or top-left (RTL).

## v1.0.4 — 2026-05-09

### Added
- **Slug-pattern source detection** as a third fallback in `detectSourceFromList()`. Items lacking Visit Profile links and without `data-rsp-source` on the wrapper now get classified by majority slug match: `(^|-)project($|-|s)` → projects, `(^|-)tender($|-|s)` → tenders. Auto-rescues lists Maher hadn't fully wired yet.

## v1.0.3 — 2026-05-08

### Fixed
- **Boot race**: the loader script injects `<script defer>` dynamically into `<head>`, but the `defer` attribute set on a dynamically-created script is ignored — the script runs as soon as it loads, possibly BEFORE `<div id="map">` exists in DOM. Symptom: `__rsp_err = "NO_MAP_CONTAINER"`. Fix: top-level guard waits for `DOMContentLoaded` (or polls for #map every 80 ms up to 8 s) before booting.

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

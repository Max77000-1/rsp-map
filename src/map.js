// ============================================================
// RSP Map — v1.0.1
// ------------------------------------------------------------
// Multi-source auto-discovery (8 collections), Finsweet V2 List
// Load awareness, stable marker↔sidebar binding via slug.
// Native Mapbox cluster layers + zoom-aware polygon overlays.
// Terrain DEM + sky + 3D fill-extrusion buildings.
// URL state for deep links, floating legend, EN/AR i18n.
//
// Phase 6 (v1.0.0): terrain + sky + 3D buildings.
//  - Mapbox terrain DEM gives Syrian mountains real elevation.
//  - Atmospheric sky layer at the horizon.
//  - Polygon items with `model-height-m > 0` render as
//    extruded buildings at zoom >= 13.
//
// Phase 3 (v0.9.0): polygons.
//  - Item with `geometry-type=polygon` and a parseable
//    `polygon-geojson` field renders as a filled polygon
//    bounded by a coloured stroke.
//  - At low zoom (< 9) a centroid dot represents the area.
//  - At high zoom (>= 9) the polygon is drawn and the
//    centroid dot is hidden so it does not double-up.
//  - Centroid is auto-computed if Lat/Lng are blank.
//  - The polygon-geojson field accepts FeatureCollection,
//    Feature, raw Geometry, or just a coordinates array.
//
// v0.7.0:
//  - Markers rendered as colored dots using brand palette per
//    source (no icon images).
//  - Filter buttons receive a data-src attribute and are tinted
//    to match their source color, with an unmistakable active
//    state injected via stylesheet so the styling does not
//    depend on user-side CSS.
//  - The "Next" random-marker button (#Next) is hidden by the
//    map module to remove an unwanted UX path.
//  - Filter button binding re-runs on every render so late-
//    arriving sources (Finsweet pages) get wired correctly.
//
// Configuration (set on the host Webflow page in <head>):
//   <script>
//     window.RSP_MAP_CONFIG = { mapboxToken: "pk...." };
//   </script>
//
// Optional config keys:
//   styleUrl       — Mapbox style URL (default: project's custom style)
//   center         — initial [lng, lat] (default: Syria centroid)
//   zoom           — initial zoom level (default: 5)
//   waitMaxMs      — max ms to wait for Finsweet completion (default: 8000)
// ============================================================

window.__rsp_err = null;
window.__rsp_loaded_at = Date.now();

// The loader injects this script dynamically into <head>. When the
// DOM hasn't finished parsing yet, the dynamically-added script
// executes before <div id="map"> exists. Defer until the DOM is
// ready (and #map present) before booting.
function __rsp_main() {
  try { (function () {
  "use strict";

  var cfg = window.RSP_MAP_CONFIG || {};
  if (!cfg.mapboxToken) {
    window.__rsp_err = "MISSING_TOKEN";
    console.error("[RSP] window.RSP_MAP_CONFIG.mapboxToken is missing.");
    return;
  }
  if (typeof mapboxgl === "undefined" || !mapboxgl.Map) {
    window.__rsp_err = "MAPBOX_NOT_LOADED";
    console.error("[RSP] mapboxgl is not available.");
    return;
  }
  var containerEl = document.getElementById("map");
  if (!containerEl) {
    window.__rsp_err = "NO_MAP_CONTAINER";
    console.error("[RSP] #map container not found.");
    return;
  }

  // ---- Source registry --------------------------------------
  // Detected from first item's first link href (e.g., /companies/...)
  var SOURCES = {
    "companies":                   { ar: "شركات ومكاتب",  en: "Companies",            color: "#4DA1A9", iconKey: "companies" },
    "projects":                    { ar: "مشاريع",         en: "Projects",             color: "#2E5077", iconKey: "projects" },
    "investment-opportunities":    { ar: "فرص استثمارية",  en: "Investment Opps.",     color: "#D4A14D", iconKey: "investments" },
    "destruction-area":            { ar: "مناطق منكوبة",   en: "Damaged Areas",        color: "#D46D6D", iconKey: "destruction" },
    "tenders":                     { ar: "مناقصات",        en: "Tenders",              color: "#5A7492", iconKey: "tenders" },
    "locations":                   { ar: "مواقع جغرافية",  en: "Locations",            color: "#8698AC", iconKey: "locations" },
    "blog":                        { ar: "مدوّنة وأخبار",  en: "News & Blog",          color: "#99C5CB", iconKey: "blog" },
    "organization-and-initiative": { ar: "منظمات ومبادرات", en: "Orgs. & Initiatives", color: "#5FBF7C", iconKey: "orgs" }
  };

  // Active locale: "ar" or "en". Detect from <html lang> or URL.
  function detectLocale() {
    var path = (location.pathname || "").toLowerCase();
    if (/^\/ar(\/|$)/.test(path)) return "ar";
    var html = document.documentElement.getAttribute("lang") || "";
    if (html.toLowerCase().indexOf("ar") === 0) return "ar";
    return "en";
  }
  var LOCALE = detectLocale();
  function sourceLabel(src) {
    var meta = SOURCES[src] || {};
    return meta[LOCALE] || meta.en || meta.ar || src;
  }
  // Static UI text
  var T = {
    legendTitle: { ar: "الفئات", en: "Categories" },
    legendHide:  { ar: "إخفاء", en: "Hide" },
    legendShow:  { ar: "إظهار", en: "Show" }
  };
  function t(k) { return (T[k] && (T[k][LOCALE] || T[k].en)) || k; }

  // Existing CDN-hosted icons. Reused for now; Phase 1 introduces a unified sprite.
  var ICON_URLS = {
    investments:  "https://cdn.prod.website-files.com/6824a5846e78c21d253f92a7/687bafad74004f8c7bb200ef_1.svg",
    destruction:  "https://cdn.prod.website-files.com/6824a5846e78c21d253f92a7/6824a5846e78c21d253f97d4_45b5efce69906881df012e01a0609a81_2.svg",
    blog:         "https://cdn.prod.website-files.com/6824a5846e78c21d253f92a7/6824a5846e78c21d253f97d5_998be4f35777054aabd27591a8584f43_4.svg",
    locations:    "https://cdn.prod.website-files.com/6824a5846e78c21d253f92a7/6824a5846e78c21d253f97d6_6d5a4ce5b76480df0d25c9812d04c590_3.svg",
    companies:    "https://cdn.prod.website-files.com/6824a5846e78c21d253f92a7/6824a5846e78c21d253f97d7_75afc636b6028e3e17936bdbcfe6f728_1.svg",
    // The following three reuse the companies icon as a temporary fallback.
    // A unified colored sprite is planned for Phase 1 (Layer 02 in roadmap).
    projects:     "https://cdn.prod.website-files.com/6824a5846e78c21d253f92a7/6824a5846e78c21d253f97d7_75afc636b6028e3e17936bdbcfe6f728_1.svg",
    tenders:      "https://cdn.prod.website-files.com/6824a5846e78c21d253f92a7/6824a5846e78c21d253f97d7_75afc636b6028e3e17936bdbcfe6f728_1.svg",
    orgs:         "https://cdn.prod.website-files.com/6824a5846e78c21d253f92a7/6824a5846e78c21d253f97d7_75afc636b6028e3e17936bdbcfe6f728_1.svg"
  };

  // ---- Mapbox setup -----------------------------------------
  mapboxgl.accessToken = cfg.mapboxToken;

  var initialCenter = cfg.center  || [38.047038, 34.552063];
  var initialZoom   = cfg.zoom    || 5.0;
  var styleUrl      = cfg.styleUrl || "mapbox://styles/rebuilding2025/cmaz0e1il00a101qxgo3rhaq5";

  var map = new mapboxgl.Map({
    container: "map",
    style: styleUrl,
    center: initialCenter,
    zoom: initialZoom,
    // A small initial pitch lets the user perceive terrain
    // depth straight away. Reset button returns to flat.
    pitch: cfg.pitch !== undefined ? cfg.pitch : 18,
    bearing: 0,
    projection: "globe"
  });

  var originalSettings = { center: initialCenter, zoom: initialZoom, pitch: 0, bearing: 0 };

  // ---- Rotation control -------------------------------------
  var rotating = false, rotationInterval = null;
  function startRotation() {
    if (rotating) return;
    rotating = true;
    rotationInterval = setInterval(function () {
      map.rotateTo((map.getBearing() + 0.2) % 360, { duration: 50 });
    }, 50);
  }
  function stopRotation() {
    if (rotationInterval) clearInterval(rotationInterval);
    rotating = false;
  }

  // ---- Style toggle (default ↔ satellite) -------------------
  var isSatellite = false;
  var defaultStyle = styleUrl;
  var satelliteStyle = "mapbox://styles/mapbox/satellite-v9";

  // After any style change (including initial load and satellite
  // toggle), Mapbox wipes user-added sources/layers. Re-add them.
  map.on("style.load", function () {
    sourceAdded = false;
    setupSourceAndLayers();
    syncSourceData();
  });

  function toggleMapMode() {
    isSatellite = !isSatellite;
    map.setStyle(isSatellite ? satelliteStyle : defaultStyle);
  }
  jq("#mapmode").on("click", toggleMapMode);

  // ---- jQuery shim (page already loads jQuery, but be safe) -
  function jq(sel) {
    return window.jQuery ? window.jQuery(sel) : { on: function(){return this;}, addClass: function(){return this;}, removeClass: function(){return this;}, click: function(){return this;}, eq: function(){return this;} };
  }

  // ---- Source detection from list ---------------------------
  // Tries three signals in order:
  //   1. `data-rsp-source` attribute on the list element or its
  //      Webflow wrapper (.w-dyn-list ancestor). This is the
  //      authoritative override the editor can set in Designer.
  //   2. First valid /<collection-slug>/ href inside any item
  //      (the legacy Visit Profile link pattern).
  //   3. Returns null when nothing matches (empty list or new
  //      list without bindings yet).
  function detectSourceFromList(listEl) {
    // 1) Explicit attribute, on list itself or its wrapper ancestor.
    var hint = listEl.getAttribute("data-rsp-source");
    if (!hint) {
      var wrap = listEl.closest && listEl.closest(".w-dyn-list");
      if (wrap) hint = wrap.getAttribute("data-rsp-source");
    }
    if (!hint) {
      var anyAncestor = listEl.parentElement;
      while (anyAncestor && !hint) {
        if (anyAncestor.getAttribute) {
          hint = anyAncestor.getAttribute("data-rsp-source");
        }
        anyAncestor = anyAncestor.parentElement;
      }
    }
    if (hint && Object.prototype.hasOwnProperty.call(SOURCES, hint)) {
      return hint;
    }

    // 2) Examine first items' first matching href.
    var items = listEl.querySelectorAll(".locations-map_item");
    var counts = {};
    for (var i = 0; i < Math.min(items.length, 6); i++) {
      var hrefs = items[i].querySelectorAll('a[href^="/"]');
      for (var j = 0; j < hrefs.length; j++) {
        var path = hrefs[j].getAttribute("href").split("/").filter(Boolean)[0];
        if (!path) continue;
        if (Object.prototype.hasOwnProperty.call(SOURCES, path)) {
          counts[path] = (counts[path] || 0) + 1;
          break;
        }
      }
    }
    var best = null, bestN = 0;
    for (var k in counts) {
      if (counts[k] > bestN) { bestN = counts[k]; best = k; }
    }
    if (best) return best;

    // 3) Slug pattern heuristic. Items in CMS collections often
    //    have predictable slug shapes:
    //      projects → "...-project-..." or "..-project"
    //      tenders  → "tender-..." or "...-tender-..."
    //    If a majority of sampled items match one of these
    //    patterns, classify the whole list. This rescues lists
    //    that lack Visit Profile links and lack data-rsp-source.
    var slugPatterns = {
      "projects": /(^|-)project($|-|s($|-))/i,
      "tenders":  /(^|-)tender($|-|s($|-))/i
    };
    var sampled = Math.min(items.length, 8);
    if (sampled > 0) {
      var hits = {};
      for (var i2 = 0; i2 < sampled; i2++) {
        var idI = items[i2].querySelector('input[id="locationID"]');
        if (!idI || !idI.value) continue;
        var slug = idI.value;
        for (var key in slugPatterns) {
          if (slugPatterns[key].test(slug)) {
            hits[key] = (hits[key] || 0) + 1;
          }
        }
      }
      var bestKey = null, bestHits = 0;
      for (var kk in hits) {
        if (hits[kk] > bestHits) { bestHits = hits[kk]; bestKey = kk; }
      }
      // Require majority of sampled items to match.
      if (bestKey && bestHits >= Math.ceil(sampled / 2)) {
        return bestKey;
      }
    }
    return null;
  }

  // ---- Build features from DOM lists ------------------------
  // Two parallel feature collections:
  //   • mapLocations  — Point features (centroids for polygons or
  //                     ordinary points). Source for cluster layer.
  //   • mapPolygons   — Polygon features. Source for fill/line layers.
  var mapLocations = { type: "FeatureCollection", features: [] };
  var mapPolygons  = { type: "FeatureCollection", features: [] };
  var markerGroups = {};
  var visibility = {};

  function clearFeatures() {
    mapLocations = { type: "FeatureCollection", features: [] };
    mapPolygons  = { type: "FeatureCollection", features: [] };
  }

  var processedIds = Object.create(null);

  // ---- Polygon JSON parser ----------------------------------
  // Accepts:
  //   • {type:"FeatureCollection", features:[...]}      → first polygon feature
  //   • {type:"Feature", geometry:{type:"Polygon"...}}  → its geometry
  //   • {type:"Polygon", coordinates:[...]}             → as-is
  //   • [[ [lng,lat], ... ]]                            → wrapped as Polygon
  // Returns a Polygon geometry object or null.
  function parsePolygon(raw) {
    if (!raw || typeof raw !== "string") return null;
    var s = raw.trim();
    if (!s) return null;
    var obj;
    try { obj = JSON.parse(s); } catch (e) { return null; }
    if (!obj) return null;
    // Bare coordinates array
    if (Array.isArray(obj)) {
      // Could be a ring [[lng,lat],...] or rings [[[lng,lat],...]]
      if (obj.length && Array.isArray(obj[0]) && typeof obj[0][0] === "number") {
        return { type: "Polygon", coordinates: [obj] };
      }
      if (obj.length && Array.isArray(obj[0]) && Array.isArray(obj[0][0])) {
        return { type: "Polygon", coordinates: obj };
      }
      return null;
    }
    if (obj.type === "FeatureCollection" && obj.features && obj.features.length) {
      for (var i = 0; i < obj.features.length; i++) {
        var g = obj.features[i].geometry;
        if (g && (g.type === "Polygon" || g.type === "MultiPolygon")) return g;
      }
      return null;
    }
    if (obj.type === "Feature" && obj.geometry) {
      if (obj.geometry.type === "Polygon" || obj.geometry.type === "MultiPolygon") return obj.geometry;
      return null;
    }
    if (obj.type === "Polygon" || obj.type === "MultiPolygon") return obj;
    return null;
  }

  // Centroid of a polygon's outer ring (simple average of vertices).
  // Adequate for representative point at low zoom; ignores donut holes.
  function polygonCentroid(geom) {
    if (!geom) return null;
    var ring = geom.type === "Polygon"
      ? (geom.coordinates && geom.coordinates[0])
      : (geom.coordinates && geom.coordinates[0] && geom.coordinates[0][0]);
    if (!ring || !ring.length) return null;
    var sx = 0, sy = 0, n = 0;
    for (var i = 0; i < ring.length; i++) {
      var p = ring[i];
      if (i === ring.length - 1 && ring.length > 1
          && p[0] === ring[0][0] && p[1] === ring[0][1]) continue; // dedupe closing point
      sx += p[0]; sy += p[1]; n++;
    }
    return n ? [sx / n, sy / n] : null;
  }

  function processList(listEl, source) {
    var items = listEl.querySelectorAll(".locations-map_item");
    var added = 0;
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      var latI = item.querySelector('input[id="locationLatitude"]');
      var lngI = item.querySelector('input[id="locationLongitude"]');
      var idI  = item.querySelector('input[id="locationID"]');
      var typeI = item.querySelector('input[id="locationGeometryType"]');
      var polyI = item.querySelector('input[id="locationPolygon"]');
      var heightI = item.querySelector('input[id="locationModelHeight"]');
      var card = item.querySelector(".locations-map_card");

      var geomType = (typeI && typeI.value || "point").toLowerCase().trim();
      var rawPoly = polyI && polyI.value || "";
      var rawHeight = heightI && heightI.value;
      var heightM = rawHeight ? parseFloat(rawHeight) : NaN;
      if (isNaN(heightM) || heightM <= 0) heightM = 0;

      // Try polygon parse first if requested; fall back to point on failure.
      var polygonGeom = null;
      if (geomType === "polygon" && rawPoly) {
        polygonGeom = parsePolygon(rawPoly);
      }

      // Determine point coordinates (used both for centroid marker and
      // as the only representation when geomType !== polygon).
      var lat = latI ? parseFloat(latI.value) : NaN;
      var lng = lngI ? parseFloat(lngI.value) : NaN;
      if ((isNaN(lat) || isNaN(lng)) && polygonGeom) {
        var c = polygonCentroid(polygonGeom);
        if (c) { lng = c[0]; lat = c[1]; }
      }
      if (isNaN(lat) || isNaN(lng)) continue;

      var locId = (idI && idI.value) ? idI.value : (source + "-" + i);
      if (processedIds[locId]) continue;
      processedIds[locId] = true;
      if (!item.getAttribute("data-loc-id")) {
        item.setAttribute("data-loc-id", locId);
      }

      var description = card ? card.innerHTML : "";

      // Always push a Point feature (used as centroid marker for
      // polygons at low zoom, or as the sole representation for
      // non-polygon items).
      mapLocations.features.push({
        type: "Feature",
        geometry: { type: "Point", coordinates: [lng, lat] },
        properties: {
          id: locId,
          source: source,
          description: description,
          isPolygonCentroid: !!polygonGeom
        }
      });

      // If polygon was successfully parsed, also push polygon feature.
      if (polygonGeom) {
        mapPolygons.features.push({
          type: "Feature",
          geometry: polygonGeom,
          properties: {
            id: locId,
            source: source,
            description: description,
            height: heightM
          }
        });
      }

      added++;
    }
    return added;
  }

  function discoverAndProcess() {
    // We do NOT clearFeatures(): processedIds prevents duplicate
    // entries, and keeping accumulated features lets `__rsp.features()`
    // reflect the full state for diagnostics.
    var lists = document.querySelectorAll('[id^="location-list"]');
    // Encounter-ordered list of {source, added}. Indexed by DOM
    // position so duplicate IDs (Webflow paginated wrappers all
    // sharing id="location-list5") don't collapse into one entry.
    var encounters = [];
    for (var i = 0; i < lists.length; i++) {
      var listEl = lists[i];
      var source = detectSourceFromList(listEl);
      if (!source) {
        encounters.push({ index: i, listId: listEl.id, source: null, added: 0 });
        continue;
      }
      var added = processList(listEl, source);
      encounters.push({ index: i, listId: listEl.id, source: source, added: added });
      if (visibility[source] === undefined) visibility[source] = true;
    }
    console.log("[RSP] Source discovery:", encounters,
                "totalFeatures:", mapLocations.features.length);
    return encounters;
  }

  // ---- Mapbox source + cluster layers -----------------------
  // Uses a single GeoJSON source (`rsp-points`) for all features,
  // with cluster:true. Three layers stacked:
  //   • clusters         — coloured circle showing aggregated count
  //   • cluster-count    — number rendered inside the cluster
  //   • unclustered-point — single point, coloured by source
  // Filtering by source replaces the source's data with the visible
  // subset, which re-clusters automatically.
  var SOURCE_ID = "rsp-points";
  var POLY_SOURCE_ID = "rsp-polygons";
  var POLYGON_MIN_ZOOM = 9; // Below this, only centroid markers show.
  var sourceAdded = false;

  function colourMatchExpr() {
    // Mapbox `match` expression: source name → colour.
    var expr = ["match", ["get", "source"]];
    Object.keys(SOURCES).forEach(function (s) {
      expr.push(s, SOURCES[s].color);
    });
    expr.push(SOURCES.companies.color); // default fallback
    return expr;
  }

  function setupSourceAndLayers() {
    if (map.getSource(SOURCE_ID)) { sourceAdded = true; return true; }
    // Mapbox v3 with projection:globe sometimes leaves
    // isStyleLoaded() returning false even after the style is
    // visually rendered. We try to add the source and let Mapbox
    // throw if the style truly is not ready; the caller retries.
    try {
      map.addSource(SOURCE_ID, {
      type: "geojson",
      data: visibleFeatureCollection(),
      cluster: true,
      // Below this zoom, points cluster. Above, every point is
      // shown individually. Higher = clusters persist when
      // zoomed in. Lower = points break apart sooner.
      clusterMaxZoom: 12,
      // Pixel radius within which points join a cluster. Lower
      // value = fewer points clumped together, more clusters
      // overall, smaller in size.
      clusterRadius: 38
    });

    // Cluster circles
    map.addLayer({
      id: "rsp-clusters",
      type: "circle",
      source: SOURCE_ID,
      filter: ["has", "point_count"],
      paint: {
        "circle-color": [
          "step", ["get", "point_count"],
          "#4DA1A9",   // 2-9
          10, "#2E5077", // 10-49
          50, "#D4A14D"  // 50+
        ],
        // Visual size of the cluster bubble. Capped at 26 so
        // very dense clusters do not visually dominate the
        // surrounding terrain.
        "circle-radius": [
          "step", ["get", "point_count"],
          14,
          10, 18,
          50, 22,
          200, 26
        ],
        "circle-stroke-width": 3,
        "circle-stroke-color": "#ffffff",
        "circle-opacity": 0.92
      }
    });

    // Cluster count labels
    map.addLayer({
      id: "rsp-cluster-count",
      type: "symbol",
      source: SOURCE_ID,
      filter: ["has", "point_count"],
      layout: {
        "text-field": ["get", "point_count_abbreviated"],
        "text-size": 13,
        "text-allow-overlap": true
      },
      paint: {
        "text-color": "#ffffff",
        "text-halo-color": "rgba(0,0,0,0.25)",
        "text-halo-width": 1
      }
    });

    // Two layers for unclustered points:
    //  • non-polygon points (real markers): always visible
    //  • polygon centroids: visible only at zoom < POLYGON_MIN_ZOOM
    //    (maxzoom on the layer hides them once polygons take over).
    var basePointPaint = {
      "circle-color": colourMatchExpr(),
      "circle-radius": [
        "interpolate", ["linear"], ["zoom"],
        5, 5,
        10, 7,
        15, 10
      ],
      "circle-stroke-width": 2,
      "circle-stroke-color": "#ffffff",
      "circle-opacity": 0.95
    };

    map.addLayer({
      id: "rsp-points",
      type: "circle",
      source: SOURCE_ID,
      filter: ["all",
        ["!", ["has", "point_count"]],
        ["!=", ["get", "isPolygonCentroid"], true]
      ],
      paint: basePointPaint
    });

    // Centroid markers for polygon items, hidden once polygons render.
    map.addLayer({
      id: "rsp-points-centroid",
      type: "circle",
      source: SOURCE_ID,
      maxzoom: POLYGON_MIN_ZOOM,
      filter: ["all",
        ["!", ["has", "point_count"]],
        ["==", ["get", "isPolygonCentroid"], true]
      ],
      paint: basePointPaint
    });

    // ---- Polygon source + layers ----------------------------
    map.addSource(POLY_SOURCE_ID, {
      type: "geojson",
      data: visiblePolygonCollection(),
      promoteId: "id"
    });

    // Filled area, beneath the line. Hover state lifts opacity.
    map.addLayer({
      id: "rsp-polygons-fill",
      type: "fill",
      source: POLY_SOURCE_ID,
      minzoom: POLYGON_MIN_ZOOM,
      paint: {
        "fill-color": colourMatchExpr(),
        "fill-opacity": [
          "case",
          ["boolean", ["feature-state", "hover"], false], 0.45,
          0.22
        ]
      }
    }, "rsp-points");

    // Outline.
    map.addLayer({
      id: "rsp-polygons-line",
      type: "line",
      source: POLY_SOURCE_ID,
      minzoom: POLYGON_MIN_ZOOM,
      paint: {
        "line-color": colourMatchExpr(),
        "line-width": [
          "interpolate", ["linear"], ["zoom"],
          POLYGON_MIN_ZOOM, 1.4,
          14, 2.4
        ],
        "line-opacity": 0.95
      }
    }, "rsp-points");

      // ---- 3D buildings (fill-extrusion) -------------------
      // Renders polygon items whose `height` property is > 0.
      // Activates at zoom >= 13 to avoid weird shapes at small scales.
      map.addLayer({
        id: "rsp-buildings",
        type: "fill-extrusion",
        source: POLY_SOURCE_ID,
        minzoom: 13,
        filter: [">", ["to-number", ["get", "height"]], 0],
        paint: {
          "fill-extrusion-color": colourMatchExpr(),
          "fill-extrusion-height": ["to-number", ["get", "height"]],
          "fill-extrusion-base": 0,
          "fill-extrusion-opacity": 0.85,
          "fill-extrusion-vertical-gradient": true
        }
      });

      // ---- Terrain (DEM) + Sky -----------------------------
      // Real elevation data (Syrian mountains visible in 3D when
      // pitch > 0). Sky layer adds an atmospheric horizon.
      try {
        if (!map.getSource("mapbox-dem")) {
          map.addSource("mapbox-dem", {
            type: "raster-dem",
            url: "mapbox://mapbox.mapbox-terrain-dem-v1",
            tileSize: 512,
            maxzoom: 14
          });
        }
        map.setTerrain({ source: "mapbox-dem", exaggeration: 1.2 });
      } catch (e) {
        console.warn("[RSP] Terrain not available:", e && e.message);
      }
      try {
        if (!map.getLayer("rsp-sky")) {
          map.addLayer({
            id: "rsp-sky",
            type: "sky",
            paint: {
              "sky-type": "atmosphere",
              "sky-atmosphere-sun": [0.0, 90.0],
              "sky-atmosphere-sun-intensity": 15
            }
          });
        }
      } catch (e) {
        console.warn("[RSP] Sky layer not available:", e && e.message);
      }

      attachLayerHandlers();
      sourceAdded = true;
      console.log("[RSP] Source + cluster layers added.");
      return true;
    } catch (e) {
      console.warn("[RSP] addSource not yet ready, will retry:", e && e.message);
      return false;
    }
  }

  // Retry until source/layers are added (typically once style is loaded).
  function ensureSourceWithRetry() {
    if (sourceAdded) return;
    if (setupSourceAndLayers()) {
      syncSourceData();
      return;
    }
    setTimeout(ensureSourceWithRetry, 400);
  }

  // Build a FeatureCollection containing only currently-visible sources.
  function visibleFeatureCollection() {
    var feats = mapLocations.features;
    var out = [];
    for (var i = 0; i < feats.length; i++) {
      var s = feats[i].properties.source;
      if (visibility[s] !== false) out.push(feats[i]);
    }
    return { type: "FeatureCollection", features: out };
  }

  function visiblePolygonCollection() {
    var feats = mapPolygons.features;
    var out = [];
    for (var i = 0; i < feats.length; i++) {
      var s = feats[i].properties.source;
      if (visibility[s] !== false) out.push(feats[i]);
    }
    return { type: "FeatureCollection", features: out };
  }

  // Push the latest visible features into both sources. Mapbox
  // re-clusters the points automatically; polygons just re-render.
  function syncSourceData() {
    if (!sourceAdded) return;
    var src = map.getSource(SOURCE_ID);
    if (src && src.setData) src.setData(visibleFeatureCollection());
    var psrc = map.getSource(POLY_SOURCE_ID);
    if (psrc && psrc.setData) psrc.setData(visiblePolygonCollection());
  }

  // Click + hover handlers on the rendered layers.
  function attachLayerHandlers() {
    // Click on cluster: zoom in.
    map.on("click", "rsp-clusters", function (e) {
      var features = map.queryRenderedFeatures(e.point, { layers: ["rsp-clusters"] });
      if (!features.length) return;
      var clusterId = features[0].properties.cluster_id;
      var src = map.getSource(SOURCE_ID);
      src.getClusterExpansionZoom(clusterId, function (err, zoom) {
        if (err) return;
        stopRotation();
        map.easeTo({ center: features[0].geometry.coordinates, zoom: zoom });
      });
    });

    // Click on single point: fly + open sidebar (both layers).
    function handlePointClick(e) {
      var f = e.features && e.features[0];
      if (!f) return;
      var coords = f.geometry.coordinates.slice();
      var locId = f.properties.id;
      stopRotation();
      map.flyTo({ center: coords, zoom: Math.max(map.getZoom(), 12), speed: 0.7, curve: 1 });
      openSidebarFor(locId);
    }
    map.on("click", "rsp-points", handlePointClick);
    map.on("click", "rsp-points-centroid", handlePointClick);

    // Cursor styling
    map.on("mouseenter", "rsp-clusters", function () { map.getCanvas().style.cursor = "pointer"; });
    map.on("mouseleave", "rsp-clusters", function () { map.getCanvas().style.cursor = ""; });
    map.on("mouseenter", "rsp-points", function () { map.getCanvas().style.cursor = "pointer"; });
    map.on("mouseleave", "rsp-points", function () { map.getCanvas().style.cursor = ""; });
    map.on("mouseenter", "rsp-points-centroid", function () { map.getCanvas().style.cursor = "pointer"; });
    map.on("mouseleave", "rsp-points-centroid", function () { map.getCanvas().style.cursor = ""; });

    // ---- Polygon click + hover -----------------------------
    var hoveredPolyId = null;

    map.on("click", "rsp-polygons-fill", function (e) {
      var f = e.features && e.features[0];
      if (!f) return;
      var locId = f.properties.id;
      stopRotation();
      // Center on polygon centroid for context.
      var c = polygonCentroid(f.geometry);
      if (c) map.flyTo({ center: c, zoom: Math.max(map.getZoom(), POLYGON_MIN_ZOOM + 1), speed: 0.7, curve: 1 });
      openSidebarFor(locId);
    });

    map.on("mouseenter", "rsp-polygons-fill", function () { map.getCanvas().style.cursor = "pointer"; });
    map.on("mouseleave", "rsp-polygons-fill", function () {
      map.getCanvas().style.cursor = "";
      if (hoveredPolyId !== null) {
        map.setFeatureState({ source: POLY_SOURCE_ID, id: hoveredPolyId }, { hover: false });
        hoveredPolyId = null;
      }
    });
    map.on("mousemove", "rsp-polygons-fill", function (e) {
      var f = e.features && e.features[0];
      if (!f) return;
      if (hoveredPolyId !== null && hoveredPolyId !== f.id) {
        map.setFeatureState({ source: POLY_SOURCE_ID, id: hoveredPolyId }, { hover: false });
      }
      hoveredPolyId = f.id;
      if (hoveredPolyId !== null) {
        map.setFeatureState({ source: POLY_SOURCE_ID, id: hoveredPolyId }, { hover: true });
      }
    });
  }

  // Convenience kept for compatibility with previous code paths.
  function addAllMarkers() { syncSourceData(); }
  function clearAllMarkers() { /* no-op now: layers persist across renders */ }
  var markersInitialized = true;

  // ---- Geocoder (search box) -------------------------------
  // Dynamically loads Mapbox Geocoder plugin and mounts it on
  // the map. Biased to Syria + neighbours. Localised placeholder.
  var geocoderMounted = false;
  function loadGeocoder() {
    if (geocoderMounted) return;
    if (typeof MapboxGeocoder !== "undefined") {
      mountGeocoder();
      return;
    }
    // Inject CSS
    if (!document.querySelector('link[data-rsp="geocoder-css"]')) {
      var link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-geocoder/v5.0.0/mapbox-gl-geocoder.css";
      link.setAttribute("data-rsp", "geocoder-css");
      document.head.appendChild(link);
    }
    // Inject JS
    var s = document.createElement("script");
    s.src = "https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-geocoder/v5.0.0/mapbox-gl-geocoder.min.js";
    s.onload = mountGeocoder;
    s.onerror = function () { console.warn("[RSP] Geocoder script failed to load"); };
    document.head.appendChild(s);
  }

  function mountGeocoder() {
    if (geocoderMounted) return;
    if (typeof MapboxGeocoder === "undefined") return;
    try {
      var geocoder = new MapboxGeocoder({
        accessToken: cfg.mapboxToken,
        mapboxgl: mapboxgl,
        placeholder: LOCALE === "ar" ? "ابحث عن مكان..." : "Search a place...",
        countries: "sy,lb,jo,iq,tr",
        language: LOCALE,
        marker: false,
        zoom: 12,
        flyTo: { speed: 1.5, curve: 1 }
      });
      map.addControl(geocoder, LOCALE === "ar" ? "top-left" : "top-right");
      // RTL adjustment: nudge geocoder a touch into the canvas.
      var box = document.querySelector(".mapboxgl-ctrl-geocoder");
      if (box) {
        box.style.maxWidth = "320px";
        box.style.minWidth = "240px";
      }
      geocoderMounted = true;
      console.log("[RSP] Geocoder mounted");
    } catch (e) {
      console.warn("[RSP] Geocoder mount failed:", e && e.message);
    }
  }

  // ---- Sidebar binding (stable id-based) --------------------
  function openSidebarFor(locId) {
    jq(".locations-map_wrapper").addClass("is--show");
    jq(".locations-map_item").removeClass("is--show");
    var safe = (window.CSS && CSS.escape) ? CSS.escape(locId) : locId.replace(/"/g, '\\"');
    var target = document.querySelector('.locations-map_item[data-loc-id="' + safe + '"]');
    if (target) target.classList.add("is--show");
    else console.warn("[RSP] No sidebar item for id:", locId);
    // Reflect in URL so the link can be shared.
    if (typeof writeUrlState === "function") writeUrlState({ id: locId });
  }

  // ---- Filter toggles ---------------------------------------
  // Backwards-compatible #1cms..#9cms wired by source order.
  // Order respects natural list discovery sequence.
  var sourceOrder = []; // populated after discovery
  var boundButtons = Object.create(null); // src -> true once bound

  function bindFilterButtons() {
    sourceOrder.forEach(function (src, idx) {
      if (boundButtons[src]) return;
      var rawId = (idx + 1) + "cms"; // id like "1cms" — NOT valid as CSS selector
      var raw = document.getElementById(rawId);
      if (!raw) return; // button not present in this page
      raw.setAttribute("data-rsp-src", src);
      raw.setAttribute("title", sourceLabel(src));
      // Click via jQuery (works with digit-leading IDs); fall back to vanilla.
      var $btn = jq("#" + rawId);
      if ($btn && $btn.on) {
        $btn.on("click", function () { toggleSource(src); });
      } else {
        raw.addEventListener("click", function () { toggleSource(src); });
      }
      raw.classList.add("is--active");
      boundButtons[src] = true;
    });
  }

  function toggleSource(src) {
    visibility[src] = !visibility[src];
    syncSourceData(); // re-render with the visible subset, re-clusters
    var idx = sourceOrder.indexOf(src);
    if (idx >= 0) {
      var raw = document.getElementById((idx + 1) + "cms");
      if (raw) {
        if (visibility[src]) raw.classList.add("is--active");
        else raw.classList.remove("is--active");
      }
    }
  }

  // ---- Misc UI bindings -------------------------------------
  jq(".close-block").on("click", function () {
    jq(".locations-map_wrapper").removeClass("is--show");
    stopRotation();
    if (typeof writeUrlState === "function") writeUrlState({ id: null });
  });

  jq("#RestMap").on("click", function () {
    stopRotation();
    map.flyTo({
      center: originalSettings.center, zoom: originalSettings.zoom,
      pitch: originalSettings.pitch, bearing: originalSettings.bearing,
      speed: 2.5, curve: 1
    });
    jq(".locations-map_wrapper").removeClass("is--show");
    jq(".locations-map_item").removeClass("is--show");
  });

  jq("#Zoom").on("click", function () {
    stopRotation();
    map.flyTo({ zoom: 17, pitch: 60, speed: 1.5, curve: 1 });
    map.once("moveend", startRotation);
  });

  jq("#Next").on("click", function () {
    var visible = mapLocations.features.filter(function (f) {
      return visibility[f.properties.source];
    });
    if (visible.length === 0) {
      console.log("[RSP] No visible markers.");
      return;
    }
    var pick = visible[Math.floor(Math.random() * visible.length)];
    stopRotation();
    map.flyTo({
      center: pick.geometry.coordinates,
      zoom: 17, pitch: 60, speed: 1.0, curve: 1
    });
    map.once("moveend", startRotation);
    openSidebarFor(pick.properties.id);
  });

  // Hide sidebar on load
  jq(".locations-map_wrapper").removeClass("is--show");

  // ---- Render pipeline --------------------------------------
  // Two-phase strategy:
  //  1) Initial render once any items have arrived (fast feedback for
  //     the user; ~300-800ms typically once Finsweet's first batch
  //     appears).
  //  2) Continuous render: a long-lived MutationObserver re-discovers
  //     and renders any items that arrive afterwards. This handles
  //     Finsweet's late paginated batches without losing markers.
  //
  // Both phases share `processedIds` and `renderedIds` so duplicates
  // are skipped automatically.

  var initialRenderDone = false;

  function renderNow() {
    var encounters = discoverAndProcess();
    encounters.forEach(function (e) {
      if (e.source && sourceOrder.indexOf(e.source) < 0) sourceOrder.push(e.source);
    });
    // Source/layers may not be addable yet (style still loading).
    // ensureSourceWithRetry keeps trying until it succeeds, then
    // pushes data. If already added, just push the new data.
    if (sourceAdded) syncSourceData();
    else ensureSourceWithRetry();
    bindFilterButtons();
    if (!initialRenderDone) {
      hidePreloader();
      hideNextButton();
      injectMapStyles();
      buildLegend();
      loadGeocoder();
      restoreFromUrl();
      initialRenderDone = true;
    }
  }

  // ---- URL state (deep links) -------------------------------
  // Reads ?id, ?center, ?zoom from the URL on first render and
  // applies them. After every fly/click on a marker, replaces the
  // URL so the page is shareable. Uses replaceState (not push)
  // so the browser back button still navigates pages, not pins.
  function readUrlState() {
    try {
      var p = new URLSearchParams(location.search);
      var st = {};
      if (p.has("id")) st.id = p.get("id");
      if (p.has("zoom")) st.zoom = parseFloat(p.get("zoom"));
      if (p.has("center")) {
        var parts = (p.get("center") || "").split(",").map(parseFloat);
        if (parts.length === 2 && !parts.some(isNaN)) st.center = parts;
      }
      if (p.has("source")) st.source = p.get("source");
      return st;
    } catch (e) { return {}; }
  }
  function writeUrlState(state) {
    try {
      var p = new URLSearchParams(location.search);
      Object.keys(state || {}).forEach(function (k) {
        var v = state[k];
        if (v === null || v === undefined || v === "") p.delete(k);
        else if (Array.isArray(v)) p.set(k, v.map(function (n) { return n.toFixed(4); }).join(","));
        else p.set(k, String(v));
      });
      var qs = p.toString();
      var newUrl = location.pathname + (qs ? "?" + qs : "") + location.hash;
      history.replaceState(null, "", newUrl);
    } catch (e) {}
  }
  function restoreFromUrl() {
    var st = readUrlState();
    if (st.center && !isNaN(st.zoom)) {
      map.flyTo({ center: st.center, zoom: st.zoom, speed: 1.5, curve: 1 });
    } else if (st.center) {
      map.flyTo({ center: st.center, speed: 1.5, curve: 1 });
    }
    if (st.id) {
      // Wait briefly for features to be in source, then fly to it.
      setTimeout(function () {
        var f = mapLocations.features.find(function (ff) { return ff.properties.id === st.id; });
        if (!f) return;
        map.flyTo({ center: f.geometry.coordinates, zoom: Math.max(map.getZoom(), 13), speed: 1.5, curve: 1 });
        openSidebarFor(st.id);
      }, 500);
    }
  }
  // Update the URL on every map move so users can copy a link
  // representing exactly what they see. Throttled to moveend.
  map.on("moveend", function () {
    if (!initialRenderDone) return;
    var c = map.getCenter();
    writeUrlState({
      center: [c.lng, c.lat],
      zoom: +map.getZoom().toFixed(2)
    });
  });

  // Hide the "Next" random-marker button (#Next).
  function hideNextButton() {
    var btn = document.getElementById("Next");
    if (btn) btn.style.setProperty("display", "none", "important");
  }

  // ---- Floating legend --------------------------------------
  // Auto-built from active sources. RTL/LTR aware via LOCALE.
  // Toggleable by clicking the title bar.
  function buildLegend() {
    if (document.getElementById("rsp-legend")) return;
    var rtl = LOCALE === "ar";
    var box = document.createElement("div");
    box.id = "rsp-legend";
    box.dir = rtl ? "rtl" : "ltr";
    box.style.cssText =
      "position:absolute;bottom:18px;" + (rtl ? "left" : "right") + ":18px;" +
      "background:rgba(255,255,255,0.96);backdrop-filter:blur(6px);" +
      "border-radius:12px;padding:10px 14px;font-family:inherit;" +
      "box-shadow:0 4px 14px rgba(0,0,0,0.18);z-index:10;" +
      "min-width:160px;max-width:240px;font-size:13px;color:#1a2329;";
    var head = document.createElement("div");
    head.style.cssText = "display:flex;justify-content:space-between;align-items:center;cursor:pointer;font-weight:600;margin-bottom:8px;color:#2E5077;";
    head.innerHTML = "<span>" + t("legendTitle") + "</span><span style='font-size:11px;color:#888;font-weight:400' id='rsp-legend-toggle'>" + t("legendHide") + "</span>";
    box.appendChild(head);
    var body = document.createElement("div");
    body.id = "rsp-legend-body";
    Object.keys(SOURCES).forEach(function (src) {
      var meta = SOURCES[src];
      var row = document.createElement("div");
      row.style.cssText = "display:flex;align-items:center;gap:8px;padding:3px 0;font-size:12px;";
      row.innerHTML =
        '<span style="width:11px;height:11px;border-radius:50%;background:' + meta.color + ';border:2px solid white;box-shadow:0 0 0 1px rgba(0,0,0,0.15);flex-shrink:0;"></span>' +
        '<span>' + sourceLabel(src) + '</span>';
      body.appendChild(row);
    });
    box.appendChild(body);

    head.addEventListener("click", function () {
      var hidden = body.style.display === "none";
      body.style.display = hidden ? "" : "none";
      document.getElementById("rsp-legend-toggle").textContent = hidden ? t("legendHide") : t("legendShow");
    });

    // Mount inside the map container so it sits over the canvas.
    var host = document.getElementById("map");
    if (host) {
      // Ensure host can host absolute children
      if (getComputedStyle(host).position === "static") host.style.position = "relative";
      host.appendChild(box);
    } else {
      document.body.appendChild(box);
    }
  }

  // Inject a stylesheet that:
  //  - tints each filter button with its source color (active state)
  //  - dims the inactive state
  //  - styles the popup neatly
  // Idempotent: skips if already injected.
  var stylesInjected = false;
  function injectMapStyles() {
    if (stylesInjected) return;
    stylesInjected = true;

    var css = [
      // Filter buttons baseline (when not active = greyed out)
      ".cms_button:not(.is--active),[id$=\"cms\"]:not(.is--active){opacity:0.45;filter:grayscale(0.6);transition:opacity 0.2s,filter 0.2s,box-shadow 0.2s;}",
      ".cms_button.is--active,[id$=\"cms\"].is--active{opacity:1;filter:none;}",

      // Active state coloured ring per source. Border + soft glow.
      // Uses data-rsp-src to be order-independent.
    ];
    Object.keys(SOURCES).forEach(function (src) {
      var c = SOURCES[src].color;
      css.push(
        "[data-rsp-src=\"" + src + "\"].is--active{" +
          "box-shadow:0 0 0 2px " + c + ", 0 0 0 4px " + c + "33;" +
          "border-radius:10px;" +
        "}"
      );
      // Coloured dot indicator next to the button (small bottom strip).
      css.push(
        "[data-rsp-src=\"" + src + "\"]{position:relative;}" +
        "[data-rsp-src=\"" + src + "\"]::after{" +
          "content:\"\";position:absolute;left:50%;bottom:-6px;transform:translateX(-50%);" +
          "width:6px;height:6px;border-radius:50%;background:" + c + ";" +
        "}"
      );
    });

    // Marker hover lift on z-index
    css.push(".custom-marker:hover{z-index:10;}");

    // Hide Webflow's native pagination controls inside the
    // collection lists. Finsweet List Load handles pagination
    // automatically; the visible "Next" / "Previous" / page
    // count UI is required for Finsweet to detect pagination
    // but should not be shown to end users.
    css.push(".w-dyn-list .w-pagination-wrapper,.w-dyn-list .w-pagination-next,.w-dyn-list .w-pagination-previous,.w-dyn-list .w-page-count{display:none !important;}");

    var styleEl = document.createElement("style");
    styleEl.setAttribute("data-rsp", "map-styles");
    styleEl.textContent = css.join("\n");
    document.head.appendChild(styleEl);
  }

  // The Webflow page has a preloader overlay that fades out on
  // `window.load`. Finsweet's paginated XHRs delay that event,
  // sometimes indefinitely on slow networks. Hide it ourselves
  // once the first batch of markers is on screen.
  function hidePreloader() {
    var pre = document.querySelector(".preloader");
    if (!pre) return;
    pre.style.transition = "opacity 0.4s";
    pre.style.opacity = "0";
    setTimeout(function () { pre.style.display = "none"; }, 500);
  }

  // Settles a flurry of mutations into a single render call.
  function debounce(fn, ms) {
    var t = null;
    return function () {
      if (t) clearTimeout(t);
      t = setTimeout(fn, ms);
    };
  }

  function startContinuousRender() {
    var schedule = debounce(renderNow, 400);
    var lastTotalSeen = 0;
    var observer = new MutationObserver(function () {
      var n = document.querySelectorAll(".locations-map_item").length;
      if (n !== lastTotalSeen) {
        lastTotalSeen = n;
        schedule();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    // Safety stop: if no DOM activity for 30s, disconnect the observer.
    var idleSince = Date.now();
    var idleTimer = setInterval(function () {
      var n = document.querySelectorAll(".locations-map_item").length;
      if (n === lastTotalSeen) {
        if (Date.now() - idleSince > 30000) {
          observer.disconnect();
          clearInterval(idleTimer);
          console.log("[RSP] Continuous renderer stopped after idle. Final feature count:",
            mapLocations.features.length);
        }
      } else {
        idleSince = Date.now();
        lastTotalSeen = n;
      }
    }, 5000);
  }

  // First render fires as soon as any items exist (typically right after
  // Finsweet's first batch lands). We don't wait for an arbitrary
  // timeout: the continuous observer will keep adding markers as more
  // items arrive.
  function waitForFirstItemsThen(callback) {
    var maxWait = cfg.waitMaxMs || 15000;
    var startedAt = Date.now();
    var done = false;
    function finish(reason) {
      if (done) return;
      done = true;
      observer.disconnect();
      clearInterval(poll);
      console.log("[RSP] First-items wait done (" + reason + "). Items in DOM:",
        document.querySelectorAll(".locations-map_item").length);
      callback();
    }
    var observer = new MutationObserver(function () {
      if (document.querySelectorAll(".locations-map_item").length > 0) finish("first-items");
    });
    observer.observe(document.body, { childList: true, subtree: true });
    var poll = setInterval(function () {
      if (document.querySelectorAll(".locations-map_item").length > 0) finish("present");
      else if (Date.now() - startedAt > maxWait) finish("timeout");
    }, 200);
  }

  // ---- Boot -------------------------------------------------
  function boot() {
    waitForFirstItemsThen(function () {
      try {
        renderNow();
        startContinuousRender();
      } catch (err) {
        console.error("[RSP] renderNow failed:", err && err.stack || err);
      }
    });
  }

  // Boot as soon as items are in the DOM. Markers attach to the map
  // container regardless of whether the style has finished loading,
  // so we do not depend on map.loaded(). The earlier strategy of
  // waiting for the load event blocked rendering when the custom
  // style was slow to fetch.
  boot();

  // Expose a small diagnostic surface for live debugging without
  // breaking encapsulation. Read-only consumers expected.
  window.__rsp = {
    version: "1.0.5",
    map: map,
    config: cfg,
    sources: SOURCES,
    features: function () { return mapLocations.features.slice(); },
    rendered: function () { return mapLocations.features.length; },
    processed: function () { return Object.keys(processedIds).length; },
    rerender: function () { renderNow(); },
    visibility: function () { return Object.assign({}, visibility); }
  };
  console.log("[RSP] map.js v1.0.5 boot path attached (geocoder). mapboxgl ready, items in DOM:",
    document.querySelectorAll(".locations-map_item").length);
  })();
  } catch (e) {
    window.__rsp_err = { message: e && e.message, stack: e && e.stack };
    console.error("[RSP] Boot threw:", e && e.stack || e);
  }
}

// Boot when DOM is ready. Loader injects this script dynamically,
// so default `defer` semantics don't apply.
if (document.getElementById("map")) {
  __rsp_main();
} else if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", __rsp_main);
} else {
  // DOM is interactive/complete but #map still not there — wait
  // for it to appear (small Webflow render delay sometimes).
  var __rsp_poll = setInterval(function () {
    if (document.getElementById("map")) {
      clearInterval(__rsp_poll);
      __rsp_main();
    }
  }, 80);
  setTimeout(function () { clearInterval(__rsp_poll); }, 8000);
}

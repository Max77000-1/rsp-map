// ============================================================
// RSP Map — v0.7.3
// ------------------------------------------------------------
// Multi-source auto-discovery (8 collections), Finsweet V2 List
// Load awareness with continuous late-arrival handling, stable
// marker↔sidebar binding via slug.
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
    "companies":                   { label: "شركات ومكاتب",       color: "#4DA1A9", iconKey: "companies" },
    "projects":                    { label: "مشاريع",              color: "#2E5077", iconKey: "projects" },
    "investment-opportunities":    { label: "فرص استثمارية",       color: "#D4A14D", iconKey: "investments" },
    "destruction-area":            { label: "مناطق منكوبة",        color: "#D46D6D", iconKey: "destruction" },
    "tenders":                     { label: "مناقصات",             color: "#5A7492", iconKey: "tenders" },
    "locations":                   { label: "مواقع جغرافية",       color: "#8698AC", iconKey: "locations" },
    "blog":                        { label: "مدوّنة وأخبار",       color: "#99C5CB", iconKey: "blog" },
    "organization-and-initiative": { label: "منظمات ومبادرات",     color: "#5FBF7C", iconKey: "orgs" }
  };

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
    pitch: 0,
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

  map.on("style.load", function () {
    if (markersInitialized) addAllMarkers();
  });

  function toggleMapMode() {
    isSatellite = !isSatellite;
    clearAllMarkers();
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
    return best;
  }

  // ---- Build features from DOM lists ------------------------
  var mapLocations = { type: "FeatureCollection", features: [] };
  var markerGroups = {};   // source -> array of mapboxgl.Marker
  var visibility = {};     // source -> bool

  function clearFeatures() {
    mapLocations = { type: "FeatureCollection", features: [] };
  }

  // Track which slugs already have a marker so re-runs only add new ones.
  var processedIds = Object.create(null);

  function processList(listEl, source) {
    var items = listEl.querySelectorAll(".locations-map_item");
    var added = 0;
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      var latI = item.querySelector('input[id="locationLatitude"]');
      var lngI = item.querySelector('input[id="locationLongitude"]');
      var idI  = item.querySelector('input[id="locationID"]');
      var card = item.querySelector(".locations-map_card");
      if (!latI || !lngI) continue;
      var lat = parseFloat(latI.value);
      var lng = parseFloat(lngI.value);
      if (isNaN(lat) || isNaN(lng)) continue;
      var locId = (idI && idI.value) ? idI.value : (source + "-" + i);
      // Skip if a marker for this slug already exists (handles
      // duplicate items across paginated wrappers and re-runs).
      if (processedIds[locId]) continue;
      processedIds[locId] = true;
      // Stamp wrapper for stable lookup later.
      if (!item.getAttribute("data-loc-id")) {
        item.setAttribute("data-loc-id", locId);
      }
      mapLocations.features.push({
        type: "Feature",
        geometry: { type: "Point", coordinates: [lng, lat] },
        properties: {
          id: locId,
          source: source,
          description: card ? card.innerHTML : ""
        }
      });
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

  // ---- Markers ----------------------------------------------
  var markersInitialized = false;

  function clearAllMarkers() {
    for (var s in markerGroups) {
      var arr = markerGroups[s];
      for (var i = 0; i < arr.length; i++) arr[i].remove();
    }
    markerGroups = {};
    renderedIds = Object.create(null);
  }

  function makeMarkerEl(source) {
    var el = document.createElement("div");
    el.className = "custom-marker custom-marker--" + source;
    var color = (SOURCES[source] && SOURCES[source].color) || "#4DA1A9";
    // Solid colored dot with subtle white ring + soft outer glow.
    // No icon image. Sized to read clearly at country zoom and
    // not crowd at city zoom.
    el.style.cssText =
      "width:14px;height:14px;border-radius:50%;cursor:pointer;" +
      "background:" + color + ";" +
      "border:2px solid #ffffff;" +
      "box-shadow:0 0 0 1px rgba(0,0,0,0.15), 0 1px 4px rgba(0,0,0,0.25);" +
      "transition:transform 0.15s ease;";
    el.addEventListener("mouseenter", function () { el.style.transform = "scale(1.35)"; });
    el.addEventListener("mouseleave", function () { el.style.transform = "scale(1)"; });
    return el;
  }

  // Track which feature ids already have a Mapbox marker (separate
  // from processedIds so style toggles can rebuild without re-parsing).
  var renderedIds = Object.create(null);

  function addAllMarkers() {
    // Render only features that don't yet have a marker. Existing markers
    // remain in place. Style toggles call clearAllMarkers() first which
    // resets renderedIds so a full rebuild happens cleanly.
    var newCount = 0;
    for (var i = 0; i < mapLocations.features.length; i++) {
      var f = mapLocations.features[i];
      var locId = f.properties.id;
      if (renderedIds[locId]) continue;
      renderedIds[locId] = true;

      var coords = f.geometry.coordinates;
      var src = f.properties.source;
      var description = f.properties.description;

      var el = makeMarkerEl(src);
      var popup = new mapboxgl.Popup({ offset: 25 }).setHTML(description);
      var marker = new mapboxgl.Marker(el).setLngLat(coords).setPopup(popup).addTo(map);

      if (!markerGroups[src]) markerGroups[src] = [];
      markerGroups[src].push(marker);

      if (visibility[src] === false) el.style.display = "none";

      (function (coords, locId) {
        el.addEventListener("click", function () {
          stopRotation();
          map.flyTo({ center: coords, zoom: map.getZoom(), speed: 0.5, curve: 1 });
          openSidebarFor(locId);
        });
      })(coords, locId);

      newCount++;
    }
    markersInitialized = true;
    if (newCount > 0) console.log("[RSP] Added " + newCount + " markers; total now " + Object.keys(renderedIds).length);
  }

  // ---- Sidebar binding (stable id-based) --------------------
  function openSidebarFor(locId) {
    jq(".locations-map_wrapper").addClass("is--show");
    jq(".locations-map_item").removeClass("is--show");
    var safe = (window.CSS && CSS.escape) ? CSS.escape(locId) : locId.replace(/"/g, '\\"');
    var target = document.querySelector('.locations-map_item[data-loc-id="' + safe + '"]');
    if (target) target.classList.add("is--show");
    else console.warn("[RSP] No sidebar item for id:", locId);
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
      raw.setAttribute("title", (SOURCES[src] && SOURCES[src].label) || src);
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
    var arr = markerGroups[src] || [];
    for (var i = 0; i < arr.length; i++) {
      arr[i].getElement().style.display = visibility[src] ? "block" : "none";
    }
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
    // Build/extend sourceOrder by DOM-position encounter, deduplicated.
    encounters.forEach(function (e) {
      if (e.source && sourceOrder.indexOf(e.source) < 0) sourceOrder.push(e.source);
    });
    addAllMarkers();
    // Re-run on every render so late-arriving sources from
    // Finsweet's paginated batches get their buttons wired too.
    bindFilterButtons();
    if (!initialRenderDone) {
      hidePreloader();
      hideNextButton();
      injectMapStyles();
      initialRenderDone = true;
    }
  }

  // Hide the "Next" random-marker button (#Next).
  function hideNextButton() {
    var btn = document.getElementById("Next");
    if (btn) btn.style.setProperty("display", "none", "important");
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

    // Marker hover label
    css.push(".custom-marker:hover{z-index:10;}");

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
          console.log("[RSP] Continuous renderer stopped after idle. Final marker count:",
            Object.keys(renderedIds).length);
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
    version: "0.7.3",
    map: map,
    config: cfg,
    sources: SOURCES,
    features: function () { return mapLocations.features.slice(); },
    rendered: function () { return Object.keys(renderedIds).length; },
    processed: function () { return Object.keys(processedIds).length; },
    rerender: function () { renderNow(); },
    visibility: function () { return Object.assign({}, visibility); }
  };
  console.log("[RSP] map.js v0.7.3 boot path attached. mapboxgl ready, items in DOM:",
    document.querySelectorAll(".locations-map_item").length);
})();
} catch (e) {
  window.__rsp_err = { message: e && e.message, stack: e && e.stack };
  console.error("[RSP] Boot threw:", e && e.stack || e);
}

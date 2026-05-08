// ============================================================
// RSP Map — v0.6.0
// ------------------------------------------------------------
// Multi-source auto-discovery (8 collections), Finsweet V2 List
// Load awareness, stable marker↔sidebar binding via slug.
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

(function () {
  "use strict";

  var cfg = window.RSP_MAP_CONFIG || {};
  if (!cfg.mapboxToken) {
    console.error("[RSP] window.RSP_MAP_CONFIG.mapboxToken is missing.");
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
  function detectSourceFromList(listEl) {
    // Examine first 3 items' first href, take majority (robustness against stray links).
    var items = listEl.querySelectorAll(".locations-map_item");
    var counts = {};
    for (var i = 0; i < Math.min(items.length, 6); i++) {
      var hrefs = items[i].querySelectorAll('a[href^="/"]');
      for (var j = 0; j < hrefs.length; j++) {
        var path = hrefs[j].getAttribute("href").split("/").filter(Boolean)[0];
        if (!path) continue;
        if (Object.prototype.hasOwnProperty.call(SOURCES, path)) {
          counts[path] = (counts[path] || 0) + 1;
          break; // first matching link per item
        }
      }
    }
    var best = null, bestN = 0;
    for (var k in counts) {
      if (counts[k] > bestN) { bestN = counts[k]; best = k; }
    }
    return best; // may be null for empty lists
  }

  // ---- Build features from DOM lists ------------------------
  var mapLocations = { type: "FeatureCollection", features: [] };
  var markerGroups = {};   // source -> array of mapboxgl.Marker
  var visibility = {};     // source -> bool

  function clearFeatures() {
    mapLocations = { type: "FeatureCollection", features: [] };
  }

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
    clearFeatures();
    var lists = document.querySelectorAll('[id^="location-list"]');
    var report = {};
    for (var i = 0; i < lists.length; i++) {
      var listEl = lists[i];
      var source = detectSourceFromList(listEl);
      if (!source) {
        // Empty list (e.g., organization-and-initiative). Try attribute hint or skip.
        report[listEl.id] = { source: null, added: 0 };
        continue;
      }
      var added = processList(listEl, source);
      report[listEl.id] = { source: source, added: added };
      if (visibility[source] === undefined) visibility[source] = true;
    }
    console.log("[RSP] Source discovery:", report,
                "totalFeatures:", mapLocations.features.length);
    return report;
  }

  // ---- Markers ----------------------------------------------
  var markersInitialized = false;

  function clearAllMarkers() {
    for (var s in markerGroups) {
      var arr = markerGroups[s];
      for (var i = 0; i < arr.length; i++) arr[i].remove();
    }
    markerGroups = {};
  }

  function makeMarkerEl(source) {
    var el = document.createElement("div");
    el.className = "custom-marker";
    el.style.cssText = "width:1.2rem;height:1.2rem;background-size:cover;background-repeat:no-repeat;cursor:pointer;border-radius:50%;";
    var key = (SOURCES[source] && SOURCES[source].iconKey) || source;
    var url = ICON_URLS[key] || ICON_URLS.companies;
    el.style.backgroundImage = "url('" + url + "')";
    return el;
  }

  function addAllMarkers() {
    clearAllMarkers();
    for (var i = 0; i < mapLocations.features.length; i++) {
      var f = mapLocations.features[i];
      var coords = f.geometry.coordinates;
      var src = f.properties.source;
      var locId = f.properties.id;
      var description = f.properties.description;

      var el = makeMarkerEl(src);
      var popup = new mapboxgl.Popup({ offset: 25 }).setHTML(description);
      var marker = new mapboxgl.Marker(el).setLngLat(coords).setPopup(popup).addTo(map);

      if (!markerGroups[src]) markerGroups[src] = [];
      markerGroups[src].push(marker);

      // Hide if currently filtered off
      if (visibility[src] === false) el.style.display = "none";

      (function (coords, locId) {
        el.addEventListener("click", function () {
          stopRotation();
          map.flyTo({ center: coords, zoom: map.getZoom(), speed: 0.5, curve: 1 });
          openSidebarFor(locId);
        });
      })(coords, locId);
    }
    markersInitialized = true;
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

  function bindFilterButtons() {
    sourceOrder.forEach(function (src, idx) {
      var btnId = "#" + (idx + 1) + "cms";
      jq(btnId).on("click", function () { toggleSource(src); }).addClass("is--active");
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
      var btn = jq("#" + (idx + 1) + "cms");
      if (visibility[src]) btn.addClass("is--active"); else btn.removeClass("is--active");
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

  // ---- Finsweet List Load awareness -------------------------
  // V2 emits no documented public event yet, so we use a
  // MutationObserver with debounce: when the count of
  // .locations-map_item stops changing for 600ms, consider load done.
  function waitForFinsweetThen(callback) {
    var maxWait = cfg.waitMaxMs || 8000;
    var debounceMs = 600;
    var startedAt = Date.now();
    var lastCount = -1;
    var lastChangeAt = Date.now();
    var done = false;

    function finish(reason) {
      if (done) return;
      done = true;
      observer.disconnect();
      console.log("[RSP] Finsweet wait done (" + reason + "). Items in DOM:",
        document.querySelectorAll(".locations-map_item").length);
      callback();
    }

    var observer = new MutationObserver(function () {
      var n = document.querySelectorAll(".locations-map_item").length;
      if (n !== lastCount) {
        lastCount = n;
        lastChangeAt = Date.now();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    var poll = setInterval(function () {
      var now = Date.now();
      if (now - lastChangeAt > debounceMs && lastCount > 0) {
        clearInterval(poll);
        finish("stable");
      } else if (now - startedAt > maxWait) {
        clearInterval(poll);
        finish("timeout");
      }
    }, 200);
  }

  // ---- Boot -------------------------------------------------
  map.on("load", function () {
    waitForFinsweetThen(function () {
      var report = discoverAndProcess();
      sourceOrder = Object.keys(report)
        .map(function (k) { return report[k].source; })
        .filter(function (s) { return s; });
      // De-dup while preserving order (companies may appear in 2 lists)
      sourceOrder = sourceOrder.filter(function (s, i, a) { return a.indexOf(s) === i; });
      addAllMarkers();
      bindFilterButtons();
    });
  });
})();

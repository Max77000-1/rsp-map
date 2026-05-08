// ============================================================
// HOTFIX: Marker → Sidebar card mismatch on /the-map-v2
//
// Problem: arrayID drift when items have missing/invalid coords.
// Solution: bind marker to its sidebar item by stable string ID
//           (the slug from #locationID), not a numeric offset.
//
// Prerequisite in Webflow Designer:
//   On each collection item wrapper `.locations-map_item`,
//   add a custom attribute:  data-loc-id = {{ slug }}
// ============================================================

// Token is supplied by the host page via window.RSP_MAP_CONFIG.mapboxToken.
// Restrict the token on the Mapbox dashboard to *.rebuilding-syria.com.
if (!window.RSP_MAP_CONFIG || !window.RSP_MAP_CONFIG.mapboxToken) {
  console.error("RSP map: window.RSP_MAP_CONFIG.mapboxToken is missing.");
}
mapboxgl.accessToken = (window.RSP_MAP_CONFIG && window.RSP_MAP_CONFIG.mapboxToken) || "";

let mapLocations = { type: "FeatureCollection", features: [] };

let map = new mapboxgl.Map({
  container: "map",
  style: "mapbox://styles/rebuilding2025/cmaz0e1il00a101qxgo3rhaq5",
  center: [38.047038, 34.552063],
  zoom: 5.0,
  pitch: 0,
  bearing: 0,
  projection: "globe"
});

const originalMapSettings = { center: [38.047038, 34.552063], zoom: 5.0, pitch: 0, bearing: 0 };

let rotating = false, rotationInterval;
function startRotation() {
  if (rotating) return;
  rotating = true;
  rotationInterval = setInterval(() => {
    map.rotateTo((map.getBearing() + 0.2) % 360, { duration: 50 });
  }, 50);
}
function stopRotation() { clearInterval(rotationInterval); rotating = false; }

// Style toggle
let isSatellite = false;
function toggleMapMode() {
  map.setStyle(isSatellite
    ? "mapbox://styles/rebuilding2025/cmaz0e1il00a101qxgo3rhaq5"
    : "mapbox://styles/mapbox/satellite-v9");
  isSatellite = !isSatellite;
}
$("#mapmode").click(toggleMapMode);

// ----------------------------------------------------------------
// processList: now binds each feature to its item by stable locId.
// We also push locId onto the wrapper as data-loc-id so we can
// look it up directly with an attribute selector. No more eq().
// ----------------------------------------------------------------
function processList(listID, source) {
  const container = document.getElementById(listID);
  if (!container) { console.log(`No container #${listID}`); return; }

  const items = container.querySelectorAll(".locations-map_item");
  let added = 0;

  items.forEach((item, i) => {
    const latInput = item.querySelector('[id="locationLatitude"], .loc-lat');
    const lngInput = item.querySelector('[id="locationLongitude"], .loc-lng');
    const idInput  = item.querySelector('[id="locationID"], .loc-id');
    const cardDiv  = item.querySelector(".locations-map_card");

    if (!latInput || !lngInput) return;
    const lat = parseFloat(latInput.value);
    const lng = parseFloat(lngInput.value);
    if (isNaN(lat) || isNaN(lng)) return;

    // Stable string ID. Fallback if CMS slug missing.
    const locId = (idInput && idInput.value) ? idInput.value : `${source}-${i}`;

    // Stamp the wrapper so the click handler can find it back.
    if (!item.getAttribute("data-loc-id")) {
      item.setAttribute("data-loc-id", locId);
    }

    mapLocations.features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [lng, lat] },
      properties: {
        id: locId,
        description: cardDiv ? cardDiv.innerHTML : "",
        source: source
      }
    });
    added++;
  });

  console.log(`#${listID} → ${added} markers (source: ${source})`);
}

processList("location-list",  "list1");
processList("location-list2", "list2");
processList("location-list3", "list3");
processList("location-list4", "list4");
processList("location-list5", "list5");

// CMS visibility filters
let markerGroups = { list1: [], list2: [], list3: [], list4: [], list5: [] };
let cmsVisibility = { list1: true, list2: true, list3: true, list4: true, list5: true };
const buttonMap = { list1: "#1cms", list2: "#2cms", list3: "#3cms", list4: "#4cms", list5: "#5cms" };

function toggleCMS(source) {
  cmsVisibility[source] = !cmsVisibility[source];
  markerGroups[source].forEach(m => {
    m.getElement().style.display = cmsVisibility[source] ? "block" : "none";
  });
  $(buttonMap[source]).toggleClass("is--active", cmsVisibility[source]);
}
Object.keys(buttonMap).forEach(src => $(buttonMap[src]).click(() => toggleCMS(src)));

// Open the sidebar item that matches the given stable ID.
function openSidebarFor(locId) {
  $(".locations-map_wrapper").addClass("is--show");
  $(".locations-map_item").removeClass("is--show");
  const target = document.querySelector(`.locations-map_item[data-loc-id="${CSS.escape(locId)}"]`);
  if (target) target.classList.add("is--show");
  else console.warn(`No sidebar item found for id="${locId}"`);
}

const iconBySource = {
  list1: "https://cdn.prod.website-files.com/6824a5846e78c21d253f92a7/687bafad74004f8c7bb200ef_1.svg",
  list2: "https://cdn.prod.website-files.com/6824a5846e78c21d253f92a7/6824a5846e78c21d253f97d4_45b5efce69906881df012e01a0609a81_2.svg",
  list3: "https://cdn.prod.website-files.com/6824a5846e78c21d253f92a7/6824a5846e78c21d253f97d5_998be4f35777054aabd27591a8584f43_4.svg",
  list4: "https://cdn.prod.website-files.com/6824a5846e78c21d253f92a7/6824a5846e78c21d253f97d6_6d5a4ce5b76480df0d25c9812d04c590_3.svg",
  list5: "https://cdn.prod.website-files.com/6824a5846e78c21d253f92a7/6824a5846e78c21d253f97d7_75afc636b6028e3e17936bdbcfe6f728_1.svg"
};

function addMapPoints() {
  console.log(`Total features: ${mapLocations.features.length}`);
  mapLocations.features.forEach(f => {
    const { coordinates } = f.geometry;
    const { id: locId, description, source } = f.properties;

    const el = document.createElement("div");
    el.className = "custom-marker";
    el.style.cssText = "width:1.2rem;height:1.2rem;background-size:cover;background-repeat:no-repeat;cursor:pointer;border-radius:50%;";
    el.style.backgroundImage = `url('${iconBySource[source] || iconBySource.list1}')`;

    const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(description);
    const marker = new mapboxgl.Marker(el).setLngLat(coordinates).setPopup(popup).addTo(map);
    (markerGroups[source] = markerGroups[source] || []).push(marker);

    el.addEventListener("click", () => {
      stopRotation();
      map.flyTo({ center: coordinates, zoom: map.getZoom(), speed: 0.5, curve: 1 });
      openSidebarFor(locId);   // ← stable lookup, no more eq()
    });
  });

  Object.values(buttonMap).forEach(b => $(b).addClass("is--active"));
}
map.on("load", addMapPoints);

function flyToRandomMarker() {
  const visible = mapLocations.features.filter(f => cmsVisibility[f.properties.source]);
  if (!visible.length) return console.log("No visible markers.");
  const f = visible[Math.floor(Math.random() * visible.length)];
  stopRotation();
  map.flyTo({ center: f.geometry.coordinates, zoom: 17, pitch: 60, speed: 1.0, curve: 1 });
  map.once("moveend", startRotation);
  openSidebarFor(f.properties.id);
}
$("#Next").click(flyToRandomMarker);
$(".close-block").click(() => { $(".locations-map_wrapper").removeClass("is--show"); stopRotation(); });

function resetMap() {
  stopRotation();
  map.flyTo({ ...originalMapSettings, speed: 2.5, curve: 1 });
  $(".locations-map_wrapper, .locations-map_item").removeClass("is--show");
}
$("#RestMap").click(resetMap);

function zoomToLevel17() {
  stopRotation();
  map.flyTo({ zoom: 17, pitch: 60, speed: 1.5, curve: 1 });
  map.once("moveend", startRotation);
}
$("#Zoom").click(zoomToLevel17);

// Hide sidebar on load
$(".locations-map_wrapper").removeClass("is--show");

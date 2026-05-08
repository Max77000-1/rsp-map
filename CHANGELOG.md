# Changelog

## v0.6.0 — 2026-05-08

### Added
- **Multi-source auto-discovery**: the map now reads any `<div id="location-list*">` element on the page and detects its source collection automatically by inspecting the first item's link href. Adding a new collection is purely a Designer operation; no code change required.
- **Finsweet List Load V2 awareness**: a MutationObserver waits for Finsweet to finish injecting paginated items into the DOM before the map reads them. This lets companies (207 items) and any other paginated collection load fully before markers are built. Configurable timeout via `window.RSP_MAP_CONFIG.waitMaxMs` (default 8000ms).
- Support for the 3 previously-missing collections: **projects**, **tenders**, **organization-and-initiative**.
- `window.RSP_MAP_CONFIG.styleUrl`, `center`, `zoom` overrides for the host page.
- Style-toggle robustness: markers are rebuilt automatically after `setStyle` (satellite ↔ default).

### Changed
- Centralised `SOURCES` registry with label + brand-color + iconKey for each of the 8 collections (per `CLAUDE.md` brand palette).
- Filter buttons (`#1cms` … `#9cms`) bind in source-discovery order rather than hardcoded list slot.
- Sidebar lookup uses a stable `data-loc-id` slug instead of the fragile `arrayID` numeric offset (carried over from v0.5.0).

### Notes
- The 3 new sources (`projects`, `tenders`, `organization-and-initiative`) currently reuse the companies icon as a temporary fallback. Distinct icons land in Phase 1 (Layer 02 of the roadmap) as part of the unified sprite.
- The map is still DOM-based for source data. The pre-built static GeoJSON pipeline is deferred until total items exceed ~5000 (per the simplified architecture decision).

## v0.5.0 — 2026-05-08

### Fixed
- **Marker ↔ sidebar card mismatch**: when an item had missing or invalid coordinates, the cumulative `arrayID` drifted, so clicking a marker opened a different card.
  - Replaced numeric `eq(arrayID)` lookup with stable string-ID lookup via `data-loc-id` attribute on each `.locations-map_item` wrapper.

### Changed
- Token now read from `window.RSP_MAP_CONFIG.mapboxToken` instead of being hardcoded in source.
- Refactored `processList` for clarity. Centralised icon URLs and CMS button mapping.

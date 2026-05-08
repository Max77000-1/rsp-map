# Changelog

## v0.5.0 — 2026-05-08

### Fixed
- **Marker ↔ sidebar card mismatch**: when an item had missing or invalid coordinates, the cumulative `arrayID` drifted, so clicking a marker opened a different card.
  - Replaced numeric `eq(arrayID)` lookup with stable string-ID lookup via `data-loc-id` attribute on each `.locations-map_item` wrapper.
  - The wrapper attribute is auto-stamped at runtime from the existing `#locationID` value so no Designer change is strictly required (but binding `data-loc-id = {{ slug }}` in Webflow is recommended for cleanliness).

### Changed
- Refactored `processList` for clarity. Removed unused offset return value.
- Centralized icon URLs into `iconBySource` map.
- Centralized CMS button mapping.
- Removed duplicate-id reliance: now also accepts `.loc-lat / .loc-lng / .loc-id` class selectors as an alternative.

### Notes
This is the last release before Phase 1 (full refactor to GeoJSON source + symbol layer with clustering). Treat as a hotfix, not a long-term solution.

# rsp-map

Interactive Mapbox layer for [Rebuilding Syria Platform](https://rebuilding-syria.com) — code lives here so it can be edited, versioned, and served to Webflow via CDN without manual paste cycles.

## Live integration

Webflow page `/the-map-v2` (staging) loads the bundle from jsDelivr:

```html
<script src="https://cdn.jsdelivr.net/gh/Max77000-1/rsp-map@latest/dist/map.js" defer></script>
```

Pin a specific version for production:
```html
<script src="https://cdn.jsdelivr.net/gh/Max77000-1/rsp-map@v0.5.0/dist/map.js" defer></script>
```

## Layout

```
src/        editable source
dist/       served to production via jsDelivr
```

For now `src` and `dist` are identical. A build step (minify, bundle) is added in Phase 1.

## Versioning

Each release is a git tag (`v0.5.0`, `v1.0.0`, ...). To roll back: change the tag in the Webflow `<script>` URL and republish.

## Roadmap

Tracked in [`/roadmap.html`](https://github.com/Max77000-1/rsp-map) of the working directory (kept local, not in repo).

| Phase | Status |
|---|---|
| 0.5 — Hotfix marker↔sidebar mismatch | Released `v0.5.0` |
| 1 — GeoJSON source + symbol layer + clustering | Planned |
| 2 — Unified CMS schema | Planned |
| 3 — Polygons | Planned |
| 4 — 3D buildings (fill-extrusion) | Planned |
| 5 — 3D models (glTF) | Planned |
| 6 — Terrain + sky | Planned |
| 7 — UX polish | Planned |
| 8 — Performance | Planned |
| 9 — Release to `/map` | Planned |

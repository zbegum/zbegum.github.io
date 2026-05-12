# SketchNet Explorer

An interactive 3D visualization of SketchNet — a network of 120 hand-drawn
sketches connected by shared interpretations. Built with React + Vite +
`react-force-graph-3d` (three.js) and a Zustand store.

Hover, click a sketch to enter focused mode, filter by context, slide the
similarity threshold, and switch between word/node and light/dark views.

## Stack

- React 19, Vite 7
- `react-force-graph-3d` (three.js) for the 3D net
- `d3-force-3d` for custom cluster forces
- `three-spritetext` for in-scene labels
- Zustand for UI state

## Run locally

```bash
npm install
npm run dev
```

Vite prints a `localhost:5173` URL — open it.

## Build for production

```bash
npm run build
npm run preview   # optional: serve dist/ locally to test the built output
```

The build lands in `dist/`. `vite.config.js` is configured with
`base: './'` so the built site loads its assets relatively — meaning the
same `dist/` works on:

- `username.github.io/<repo>/` (GitHub Pages project site)
- A custom domain at site root
- Any other static host

## Deploying to GitHub Pages

After pushing this repo to GitHub:

1. **Repo settings → Pages:** set the source. Easiest path is the
   `gh-pages` branch via `gh-pages` CLI, or use a GitHub Actions
   workflow that publishes `dist/` to Pages.
2. **Manual one-liner deploy** (if you install `gh-pages`):
   ```bash
   npm i -D gh-pages
   # add to package.json scripts:  "deploy": "vite build && gh-pages -d dist"
   npm run deploy
   ```
3. **GitHub Actions auto-deploy:** add `.github/workflows/deploy.yml`
   that runs `npm ci && npm run build` and publishes `dist/` to the
   Pages environment on every push to `main`.

Because `base: './'` is relative, you do **not** need to hard-code the
repo name anywhere.

## Project layout

```
src/
  App.jsx                # entry component
  sketchnet.json         # graph data (~2.3 MB)
  data/
    parser.js            # turns sketchnet.json into graph data
    clustering.js        # cluster assignment
    constants.js         # palettes, themes
  graph/
    GraphContainer.jsx   # the 3D force-graph
    clusterForces.js     # custom d3-force-3d forces
    nodeObjects.js       # three.js node renderers
  state/
    store.js             # Zustand store
  ui/
    *.jsx                # buttons, panels, sliders, toggles
public/
  sketches/              # 120 small PNG sketches
  sketches-cropped/      # cropped variants
  vite.svg
```

Total source: ~3.5 MB. No external services or backend needed.

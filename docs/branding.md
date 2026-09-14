# Brand assets

The application and README use the production artwork in `public/brand/`:

- `icon.svg`: original vector master, with the basin, canals, Porta Ticinese,
  oak and tram viewed from above.
- `icon-small.svg`: simplified master for the 16/32-point macOS icon sizes.
- `icon.png`: generated raster used by Electron.
- `mark.svg`: browser favicon.
- `waterfront-v12.png`: illustration shared by Welcome, About and the README.

Run `node scripts/icons.mjs` on macOS to regenerate `icon.png` and
`build/icon.icns` from the SVG masters. The intermediate `build/Darsena.iconset/`
directory is ignored by Git. Commit the masters and generated production icons
together. This command does not launch the application.

Earlier proposals, generation experiments and screenshots remain available in
Git history; they are not required to build or maintain the current artwork.

## Sources

The icon geometry is original artwork, simplified for legibility rather than
geographic precision. Orientation was informed by
[Porta Ticinese](https://www.openstreetmap.org/way/172927160) and
[the oak's location](https://www.openstreetmap.org/node/1957473688)
(© OpenStreetMap contributors). No map images are embedded in the app.

The waterfront illustration was generated with ImageGen using user-provided
photographs as composition references. It depicts the basin, curved quay,
Porta Ticinese, an inland oak and a historic Milanese tram. The modern market
building was deliberately omitted. It is an illustrated interpretation, not a
reconstruction of a particular year; no reference photograph is shipped.

Historical text and source links are maintained in `app/content/brandStory.ts`.
Third-party application and task artwork has separate attribution in
`public/apps/README.md`, `public/task-logos/README.md` and
`public/third-party/task-icons/README.md`.

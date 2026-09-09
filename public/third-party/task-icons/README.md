# Task tool artwork

The bundled paths in `app/assets/tool-icon-paths.ts` are generated with
`node scripts/task-icons.mjs` from the pinned Simple Icons revision recorded in
[sources.json](sources.json). That file retains each icon's original source,
brand guidelines and license metadata. The path geometry is unchanged; Darsena
renders it in the badge foreground color for light/dark contrast.

Simple Icons contributors publish the collection under CC0; individual logos
may carry their own licenses and trademark terms. See the included collection
license and disclaimer, and the source metadata for each icon. These logos
identify tools invoked by user tasks; no affiliation or endorsement is implied.

Specific recorded attributions:

- Yarn kitten: Yarn contributors, via [yarnpkg/assets](https://github.com/yarnpkg/assets/tree/76d30ca2aebed5b73ea8131d972218fb860bd32d),
  [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
- Rust gear, used to identify Cargo in the Rust ecosystem: Rust project
  contributors, [media guide](https://www.rust-lang.org/policies/media-guide),
  [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
  The bundled Rust artwork retains that license.
- Apache Maven feather: The Apache Software Foundation,
  [Apache logos](https://apache.org/logos),
  [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0).

Shell, Make, Just and unknown-command symbols use the project's installed
Lucide package (ISC license). They are functional symbols, not invented brand
logos. Assets are bundled locally; displaying a badge requires no network.

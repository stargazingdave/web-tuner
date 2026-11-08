# NoiseD Tuner

- Keep reusable React components, icons, and component styles in the sibling
  `../web/ui` library and import them through `noised-ui`.
- Keep reusable audio analysis in the sibling `../dsp` library. Import Rust
  crates by path; do not copy their implementations into this repository.
- This app owns tuner-specific composition, microphone lifecycle, PWA behavior,
  instrument presets, and the minimal WASM host ABI.
- Keep microphone processing local. Never connect microphone audio to speaker
  monitoring or add analytics/audio uploads.
- Keep the static build compatible with GitHub Pages repository subpaths.
- Build with `npm run build`; verify with `npm test` and `npm run test:rust`.
- Shared dependency changes must be committed/pushed separately before pinning
  revisions and deploying. Preserve unrelated changes in sibling repositories.

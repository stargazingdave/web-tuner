# NoiseD Tuner

Static, installable instrument tuner for iPhone, Android, and desktop. Microphone
PCM stays on the device. No server, account, external font, or analytics.
GitHub Pages hosts the compiled app; Rust and Node are build-time tools only.

## Shared libraries

Keep these sibling checkouts:

```text
noised/
  dsp/      # stargazingdave/noised-dsp
  web/      # stargazingdave/noised-web
  tuner/    # this repository
```

- **UI:** imported as `noised-ui` through `file:../web/ui`. Reusable buttons,
  selectors, note targets, meters, status indicators, and icons live in
  `../web/ui/src`; their styles and SSR tests live in that library.
- **DSP:** `wasm/Cargo.toml` imports `dsp-core` through a local path.
  `dsp_core::tuner::Tuner` owns detection and continuity filtering. It uses
  the existing recent-history YIN and FIR decimator. No DSP source is copied.
- **App:** microphone lifecycle, permission/error messages, instrument presets,
  calibration, installation, and service-worker registration.
- **WASM adapter:** small C ABI and preallocated PCM/reading buffers, with no
  separate pitch algorithm.

New shared source files must be committed and pushed in their own repositories
before the first CI deployment. Existing unrelated working-tree changes do not
belong to this app. `dependency-revisions.json` records exact source commits.
After publishing library changes, run `npm run pin:dependencies` to update
those commits. That command refuses dirty relevant source paths.

## Local development

Requirements: Node 22.12+, Rust 1.98.0, and the WASM target.

```sh
rustup target add wasm32-unknown-unknown
npm ci --prefix ../web
npm ci
npm run dev
```

Open http://127.0.0.1:5174/. Microphone access works on loopback without HTTPS.
An iPhone accessing a LAN IP needs an HTTPS host; use the published Pages URL.

```sh
npm run build       # shared UI, Rust WASM, typecheck, Vite, offline precache
npm test            # real WASM / worklet tests and tuning/calibration tests
npm run test:rust   # shared DSP tuner tests
npm run typecheck
npm run preview     # built app at http://127.0.0.1:4174/
```

The dependency-free WASM crate builds offline after the Rust target is installed.
Generated WASM is about 45 KB in the initial build. It is rebuilt from the shared
source, not checked in as another implementation.

## GitHub Pages

1. Commit and push the shared web/DSP additions, then pin their revisions.
2. Push this repository with the default branch named `main`.
3. Set **Settings → Pages → Source → GitHub Actions**.
4. If a shared source repository is private, add a `NOISED_SOURCE_TOKEN`
   Actions secret with read access to those source repositories. Public sources
   need no extra token.
5. The included Pages workflow checks out all three repositories as siblings,
   builds and tests, then publishes only `dist/`.

The workflow uses Pages metadata for the repository URL prefix. For a local
prefix build, set `VITE_BASE_PATH=/your-repository/` before `npm run build`.
The default relative base also works for static folder hosting.

## iPhone and offline use

Open the HTTPS site in Safari → Share → Add to Home Screen. Enable Open as Web
App if offered. Start once online; "Offline ready" confirms service-worker
installation. The interface, worklet, and WASM are cached locally. iOS may evict
website storage; revisit online if that happens.

Tap Start microphone and allow microphone access. The page requests echo
cancellation, noise suppression, and automatic gain to be disabled; the
diagnostics show reported settings, which are not a guarantee of raw capture.
Actual AudioContext rate is used throughout. No speaker monitoring is connected.
Audio stops when the page goes into the background; tap Start when returning.
This is a foreground tuner, not a background recorder.

Updates are offered explicitly and stop capture before activating/reloading.
Only this app's scoped caches are managed; other NoiseD web apps are unaffected.

## Tuning behavior

- Guitar standard, Drop D, DADGAD, four-string bass, and ukulele presets.
- Strings mode selects the closest target in pitch space; Chromatic selects
  the nearest semitone. Tapping a string sets a fixed target; tap again for auto.
- A4 reference: 430–450 Hz, saved locally with the selected tuning.
- Frequency displays the measured pitch. There is no pitch snapping or hidden
  octave folding. Green indicates ±3 cents, without altering the measured value.
- Shared detector range: 35–1500 Hz. A 25 ms pitch-space filter settles the trace;
  persistent note changes reacquire without a long glide.
- Common 44.1/48/96 kHz input is anti-aliased and analyzed at half rate. At lower
  input rates analysis stays at the native rate. Very high notes at 16 kHz can
  have roughly 6 cents of interpolation error; normal guitar open strings are
  much more precise. Browser input quality and real-world harmonic ambiguity
  still require device testing.
- "Try a reference signal" runs a silent synthetic harmonic source through the
  actual worklet and WASM, 7 cents below the selected string. It tests transport,
  detection, and display; it does not test the physical microphone.
- Diagnostics report analysis centre age, not end-to-end microphone/UI latency.

## Verification

Automated checks exercise detuned low/mid/high notes at 44.1/48/96 kHz, quiet
decay, silence reset, octave transitions, noise rejection, calibration, and
the AudioWorklet-to-WASM path. Shared UI tests include SSR/accessibility.
The initial browser pass verifies demo detection, string changes, mobile layout,
start/stop state, install instructions, and the production service worker.

Before claiming microphone accuracy on iPhone, test the deployed HTTPS app on
the actual device: all six strings, detuned notes, quiet sustain, note changes,
permission denial/retry, app switching, and a reload in airplane mode.

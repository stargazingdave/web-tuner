import { spawnSync } from 'node:child_process';
import { mkdir, copyFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
process.chdir(root);
function run(command, args, cwd = root) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' && command.endsWith('.cmd') });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
try { await access('../web/ui/src/pitch-meter.tsx'); await access('../dsp/crates/dsp-core/src/tuner.rs'); }
catch { throw new Error('The sibling noised-web and noised-dsp checkouts must include the shared tuner components. See README.md.'); }
run('node', [path.resolve('../web/node_modules/tsup/dist/cli-default.js')], path.resolve('../web/ui'));
run('cargo', ['build', '--manifest-path', 'wasm/Cargo.toml', '--target', 'wasm32-unknown-unknown', '--release', '--offline']);
await mkdir('public/wasm', { recursive: true });
await copyFile('wasm/target/wasm32-unknown-unknown/release/noised_tuner_wasm.wasm', 'public/wasm/noised_tuner.wasm');
await import('./icons.mjs');
if (!process.argv.includes('--prepare')) {
  run('node', ['node_modules/typescript/bin/tsc', '--noEmit']);
  run('node', ['node_modules/vite/bin/vite.js', 'build']);
}

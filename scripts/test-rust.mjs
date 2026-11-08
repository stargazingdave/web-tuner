import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Cargo discovers .cargo/config.toml from cwd, not from --manifest-path.
// Run inside the shared workspace so fresh CI runners use its vendored sources.
const cwd = fileURLToPath(new URL('../../dsp/', import.meta.url));
const result = spawnSync('cargo', [
  'test', '-p', 'dsp-core', 'tuner::tests', '--release', '--locked', '--offline',
], { cwd, stdio: 'inherit' });
if (result.error) throw result.error;
process.exit(result.status ?? 1);

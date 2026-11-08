import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const pins = JSON.parse(await readFile(path.join(root, 'dependency-revisions.json'), 'utf8'));
for (const [name, relative, paths] of [['web', '../web', ['ui']], ['dsp', '../dsp', ['crates/dsp-core']]]) {
  const cwd = path.resolve(root, relative);
  const git = args => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
  const changes = git(['status', '--porcelain', '--', ...paths]);
  if (changes) throw new Error(`Commit and push the shared ${name} changes before pinning. Relevant changes:\n${changes}`);
  pins[name].revision = git(['rev-parse', 'HEAD']);
}
await writeFile(path.join(root, 'dependency-revisions.json'), JSON.stringify(pins, null, 2) + '\n');
console.log('Pinned shared library revisions. Ensure these commits are pushed before deploying.');

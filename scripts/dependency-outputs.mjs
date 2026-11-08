import { readFile, appendFile } from 'node:fs/promises';
const pins = JSON.parse(await readFile(new URL('../dependency-revisions.json', import.meta.url), 'utf8'));
const lines = [];
for (const name of ['web', 'dsp']) {
  const pin = pins[name];
  if (!/^[\w.-]+\/[\w.-]+$/.test(pin.repository) || !/^[0-9a-f]{40}$/.test(pin.revision)) {
    throw new Error('Expected a repository and exact published commit for ' + name + '. Run npm run pin:dependencies.');
  }
  for (const field of ['repository', 'revision']) lines.push(name + '_' + field + '=' + pin[field]);
}
if (!process.env.GITHUB_OUTPUT) throw new Error('GITHUB_OUTPUT is required.');
await appendFile(process.env.GITHUB_OUTPUT, lines.join('\n') + '\n');

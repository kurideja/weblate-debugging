import { mkdir, cp, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const repo = fileURLToPath(new URL('../.weblate/repository/', import.meta.url));
await mkdir(repo, { recursive: true });
const existing = existsSync(`${repo}/.git`);
const git = (...args) => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8' });
if (existing && !process.argv.includes('--update')) {
  git('config', 'receive.denyCurrentBranch', 'updateInstead');
  console.log('Keeping existing local repository and pushed translations.');
  process.exit(0);
}
if (existing && git('status', '--porcelain').trim()) {
  throw new Error('The fixture repository has uncommitted changes. Commit them before importing.');
}
// Validate both files before changing the fixture or creating a commit.
for (const lang of ['en', 'lt']) {
  const path = `${root}/src/locales/${lang}/translation.json`;
  const data = JSON.parse(await readFile(path, 'utf8'));
  if (!data || Array.isArray(data) || typeof data !== 'object') {
    throw new Error(`${path} must contain a JSON object`);
  }
}
await mkdir(`${repo}/src`, { recursive: true });
await cp(`${root}/src/locales`, `${repo}/src/locales`, { recursive: true });
if (!existsSync(`${repo}/.git`)) git('init', '-b', 'main');
git('config', 'user.name', 'Local plural test');
git('config', 'user.email', 'local@example.test');
git('config', 'receive.denyCurrentBranch', 'updateInstead');
git('add', 'src/locales');
if (git('status', '--porcelain').trim()) git('commit', '-m', 'Update plural test fixtures');
console.log('Translation test repository ready at .weblate/repository');

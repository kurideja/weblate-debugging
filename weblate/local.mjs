import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile, cp } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const action = process.argv[2];
const compose = (...args) => execFileSync('docker', ['compose', '-f', 'compose.weblate.yml', ...args], { cwd: root, stdio: 'inherit' });
const shell = (script, capture = false) => execFileSync('docker', [
  'compose', '-f', 'compose.weblate.yml', 'exec', '-T', '--user', 'weblate', 'weblate',
  'weblate', 'shell', '--no-imports', '-c', `exec(open('/fixtures/scripts/${script}.py').read())`,
], { cwd: root, encoding: 'utf8', stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit' });

if (action === 'start') {
  execFileSync(process.execPath, ['weblate/seed-repository.mjs'], { cwd: root, stdio: 'inherit' });
  compose('up', '-d');
  console.log('Waiting for Weblate (first startup can take a few minutes)…');
  let ready = false;
  for (let attempt = 0; attempt < 180; attempt++) {
    try {
      const response = await fetch('http://localhost:8080/api/', { signal: AbortSignal.timeout(3000) });
      if ([200, 401, 403].includes(response.status) && response.headers.get('content-type')?.includes('application/json')) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  if (!ready) throw new Error('Weblate is not ready. Inspect npm run weblate:logs.');
  shell('bootstrap');
} else if (action === 'import') {
  execFileSync(process.execPath, ['weblate/seed-repository.mjs', '--update'], { cwd: root, stdio: 'inherit' });
  shell('refresh');
} else if (action === 'push') {
  shell('push');
  execFileSync('git', ['-C', '.weblate/repository', 'log', '-5', '--oneline'], { cwd: root, stdio: 'inherit' });
} else if (action === 'git') {
  execFileSync('git', ['-C', '.weblate/repository', 'log', '-8', '--oneline'], { cwd: root, stdio: 'inherit' });
  execFileSync('git', ['-C', '.weblate/repository', 'status', '--short'], { cwd: root, stdio: 'inherit' });
} else if (action === 'verify') {
  const report = JSON.parse(shell('verify', true));
  await mkdir(`${root}/.weblate`, { recursive: true });
  await writeFile(`${root}/.weblate/verification.json`, JSON.stringify(report, null, 2) + '\n');
  if (report.after) {
    await mkdir(`${root}/.weblate/round-trip/lt`, { recursive: true });
    await writeFile(`${root}/.weblate/round-trip/lt/translation.json`, JSON.stringify(report.after, null, 2) + '\n');
  }
  console.log(`Editor forms: ${JSON.stringify(report.editor_form_counts)}`);
  console.log(`Removed keys: ${report.removed_keys.join(', ') || 'none'}`);
  console.log(`Visible forms saved correctly: ${report.visible_forms_saved_correctly}`);
  console.log(`Fractional _many forms preserved: ${report.fractional_forms_preserved}`);
  console.log(`Original content restored: ${report.original_content_restored}`);
  console.log('Full before/after report: .weblate/verification.json');
  console.log(report.passed ? 'PASS: plural round trip' : 'FAIL: plural round trip; inspect the report');
  process.exitCode = report.passed ? 0 : 1;
} else if (action === 'export') {
  const data = JSON.parse(shell('export', true));
  for (const lang of ['en', 'lt']) {
    await mkdir(`${root}/.weblate/export/${lang}`, { recursive: true });
    await writeFile(`${root}/.weblate/export/${lang}/translation.json`, JSON.stringify(data[lang], null, 2) + '\n');
    const source = JSON.parse(await readFile(`${root}/src/locales/${lang}/translation.json`, 'utf8'));
    const changed = [...new Set([...Object.keys(source), ...Object.keys(data[lang])])]
      .filter(key => source[key] !== data[lang][key]);
    console.log(`${lang}: exported to .weblate/export/${lang}/translation.json; changed keys: ${changed.join(', ') || 'none'}`);
  }
} else if (action === 'apply') {
  for (const lang of ['en', 'lt']) {
    const path = `${root}/.weblate/export/${lang}/translation.json`;
    JSON.parse(await readFile(path, 'utf8'));
  }
  for (const lang of ['en', 'lt']) {
    await cp(`${root}/.weblate/export/${lang}/translation.json`, `${root}/src/locales/${lang}/translation.json`);
  }
  console.log('Exported files applied to src/locales. Run npm test and view the React app.');
} else if (action === 'stop') {
  compose('stop');
} else if (action === 'logs') {
  compose('logs', '--tail', '100', '-f', 'weblate');
} else {
  throw new Error('Expected start, import, push, git, verify, export, apply, stop, or logs');
}

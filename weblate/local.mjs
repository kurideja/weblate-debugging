import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile, cp } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const action = process.argv[2];
const actions = ['start', 'import', 'push', 'git', 'verify', 'export', 'apply', 'stop', 'logs'];
const port = Number(process.env.WEBLATE_PORT || 8080);
const dockerEnv = {
  ...process.env,
  // Git receive-pack must write files owned by the host user on Linux too.
  LOCAL_UID: process.env.LOCAL_UID || String(process.getuid?.() ?? 0),
  LOCAL_GID: process.env.LOCAL_GID || String(process.getgid?.() ?? 0),
};

function run(command, args, capture = false, env = process.env) {
  return execFileSync(command, args, {
    cwd: root, env, encoding: 'utf8',
    stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit',
  });
}

const compose = (args, capture = false) => run('docker', ['compose', '-f', 'compose.weblate.yml', ...args], capture, dockerEnv);
const shell = (script, capture = false) => compose([
  'exec', '-T', '--user', 'weblate', 'weblate', 'weblate', 'shell', '--no-imports',
  '-c', `exec(open('/fixtures/scripts/${script}.py').read())`,
], capture);
const git = (...args) => run('git', ['-C', '.weblate/repository', ...args]);

async function isReady() {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/`, { signal: AbortSignal.timeout(3000) });
    const ready = [200, 401, 403].includes(response.status)
      && response.headers.get('content-type')?.includes('application/json');
    await response.body?.cancel();
    return ready;
  } catch {
    return false;
  }
}

async function main() {
  if (!actions.includes(action)) throw new Error(`Expected one of: ${actions.join(', ')}`);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('WEBLATE_PORT must be between 1 and 65535.');
  if (['import', 'push', 'verify', 'export'].includes(action)) {
    const services = compose(['ps', '--status', 'running', '--services'], true).trim().split(/\s+/);
    if (!services.includes('weblate') || !await isReady()) {
      throw new Error('Weblate is not ready. Run npm run weblate:start first; inspect npm run weblate:logs if startup fails.');
    }
  }

  if (action === 'start') {
    run(process.execPath, ['weblate/seed-repository.mjs']);
    compose(['up', '-d']);
    console.log('Waiting for Weblate (first startup can take a few minutes)…');
    const deadline = Date.now() + 360_000;
    while (!await isReady()) {
      if (Date.now() > deadline) throw new Error('Weblate startup timed out. Inspect npm run weblate:logs.');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    shell('bootstrap');
  } else if (action === 'import') {
    run(process.execPath, ['weblate/seed-repository.mjs', '--update']);
    shell('refresh');
  } else if (action === 'push') {
    shell('push');
    git('log', '-5', '--oneline');
  } else if (action === 'git') {
    git('log', '-8', '--oneline');
    git('status', '--short');
  } else if (action === 'verify') {
    const report = JSON.parse(shell('verify', true));
    await mkdir(`${root}/.weblate`, { recursive: true });
    await writeFile(`${root}/.weblate/verification.json`, JSON.stringify(report, null, 2) + '\n');
    if (report.after) {
      await mkdir(`${root}/.weblate/round-trip/lt`, { recursive: true });
      await writeFile(`${root}/.weblate/round-trip/lt/translation.json`, JSON.stringify(report.after, null, 2) + '\n');
    }
    console.log(`Editor forms: ${JSON.stringify(report.editor_form_counts)}`);
    console.log(`Removed keys: ${report.removed_keys?.join(', ') || 'none'}`);
    console.log(`Edited forms saved correctly: ${report.visible_forms_saved_correctly}`);
    console.log(`Fractional _many forms preserved: ${report.fractional_forms_preserved}`);
    console.log(`Original content restored: ${report.original_content_restored}`);
    for (const error of report.errors || []) console.error(error);
    console.log('Full before/after report: .weblate/verification.json');
    console.log(report.passed ? 'PASS: plural round trip' : 'FAIL: plural round trip; inspect the report');
    process.exitCode = report.passed ? 0 : 1;
  } else if (action === 'export') {
    const files = JSON.parse(shell('export', true));
    const data = Object.fromEntries(['en', 'lt'].map(lang => [lang, JSON.parse(files[lang])]));
    for (const lang of ['en', 'lt']) {
      await mkdir(`${root}/.weblate/export/${lang}`, { recursive: true });
      await writeFile(`${root}/.weblate/export/${lang}/translation.json`, files[lang]);
      const source = JSON.parse(await readFile(`${root}/src/locales/${lang}/translation.json`, 'utf8'));
      const changed = [...new Set([...Object.keys(source), ...Object.keys(data[lang])])]
        .filter(key => source[key] !== data[lang][key]);
      console.log(`${lang}: exported to .weblate/export/${lang}/translation.json; changed keys: ${changed.join(', ') || 'none'}`);
    }
  } else if (action === 'apply') {
    for (const lang of ['en', 'lt']) {
      JSON.parse(await readFile(`${root}/.weblate/export/${lang}/translation.json`, 'utf8'));
    }
    for (const lang of ['en', 'lt']) {
      await cp(`${root}/.weblate/export/${lang}/translation.json`, `${root}/src/locales/${lang}/translation.json`);
    }
    console.log('Exported files applied to src/locales. Run npm test and view the React app.');
  } else if (action === 'stop') {
    compose(['stop']);
  } else if (action === 'logs') {
    compose(['logs', '--tail', '100', '-f', 'weblate']);
  }
}

try {
  await main();
} catch (error) {
  if (error.signal === 'SIGINT') process.exitCode = 130;
  else {
    console.error(error.code === 'ENOENT' ? 'A required file or command is missing. Install Git and Docker, then run weblate:start; run weblate:export before weblate:apply.' : error.message);
    process.exitCode = 1;
  }
}

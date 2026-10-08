import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const directory = resolve(process.argv[2] || 'src/locales');
let missing = false;
for (const language of ['en', 'lt']) {
  const file = `${directory}/${language}/translation.json`;
  const data = JSON.parse(await readFile(file, 'utf8'));
  const categories = new Intl.PluralRules(language).resolvedOptions().pluralCategories;
  const absent = ['apples', 'messages', 'files'].flatMap(key =>
    categories.map(category => `${key}_${category}`)).filter(key => !Object.hasOwn(data, key));
  console.log(`${language}: ${absent.length ? `MISSING ${absent.join(', ')}` : `all plural keys present (${categories.join(', ')})`}`);
  missing ||= absent.length > 0;
}
// Checks key presence even when an extracted translation is still blank.
process.exitCode = missing ? 1 : 0;

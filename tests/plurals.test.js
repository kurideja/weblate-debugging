import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import i18next from 'i18next';

const resources = {};
for (const lang of ['en', 'lt']) {
  resources[lang] = { translation: JSON.parse(await readFile(new URL(`../src/locales/${lang}/translation.json`, import.meta.url), 'utf8')) };
}
const i18n = i18next.createInstance();
await i18n.init({ resources, lng: 'en', fallbackLng: false, interpolation: { escapeValue: false } });

test('every example includes all plural categories and preserves count interpolation', () => {
  for (const lang of ['en', 'lt']) {
    for (const category of new Intl.PluralRules(lang).resolvedOptions().pluralCategories) {
      for (const key of ['apples', 'messages', 'files']) {
        assert.ok(resources[lang].translation[`${key}_${category}`]?.includes('{{count}}'), `${lang}: ${key}_${category}`);
      }
    }
  }
});

test('i18next selects English and Lithuanian forms across integer boundaries and fractions', () => {
  const cases = [
    [0, 'other'], [1, 'one'], [2, 'few'], [10, 'other'],
    [11, 'other'], [19, 'other'], [21, 'one'], [22, 'few'],
    [101, 'one'], [111, 'other'], [1.5, 'many'], [2.5, 'many'],
  ];
  for (const [count, ltCategory] of cases) {
    for (const [lng, category] of [['en', count === 1 ? 'one' : 'other'], ['lt', ltCategory]]) {
      for (const key of ['apples', 'messages', 'files']) {
        const template = resources[lng].translation[`${key}_${category}`];
        assert.equal(typeof template, 'string', `${lng}: ${key}_${category}`);
        assert.equal(i18n.t(key, { lng, count }), template.replaceAll('{{count}}', String(count)), `${lng}: ${key}, count ${count}`);
      }
    }
  }
});

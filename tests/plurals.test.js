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
    [0, '0 apples', '0 obuolių'], [1, '1 apple', '1 obuolys'],
    [2, '2 apples', '2 obuoliai'], [10, '10 apples', '10 obuolių'],
    [11, '11 apples', '11 obuolių'], [19, '19 apples', '19 obuolių'],
    [21, '21 apples', '21 obuolys'], [22, '22 apples', '22 obuoliai'],
    [101, '101 apples', '101 obuolys'], [111, '111 apples', '111 obuolių'],
    [1.5, '1.5 apples', '1.5 obuolio'],
  ];
  for (const [count, en, lt] of cases) {
    assert.equal(i18n.t('apples', { lng: 'en', count }), en);
    assert.equal(i18n.t('apples', { lng: 'lt', count }), lt);
  }
});

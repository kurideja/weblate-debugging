import { defineConfig } from 'i18next-cli';

export default defineConfig({
  locales: ['en', 'lt'],
  extract: {
    input: ['src/**/*.{js,jsx}'],
    output: 'src/locales/{{language}}/{{namespace}}.json',
    defaultNS: 'translation',
    primaryLanguage: 'en',
    defaultValue: '',
    removeUnusedKeys: false,
    extractFromComments: false,
    sort: true,
  },
});

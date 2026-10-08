import config from './i18next.config.js';

export default {
  ...config,
  extract: { ...config.extract, output: '.weblate/extracted/{{language}}/{{namespace}}.json' },
};

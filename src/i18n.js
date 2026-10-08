import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en/translation.json';
import lt from './locales/lt/translation.json';

i18next.use(initReactI18next).init({
  resources: { en: { translation: en }, lt: { translation: lt } },
  lng: 'en',
  supportedLngs: ['en', 'lt'],
  // Keep missing Lithuanian forms visible when testing Weblate edits.
  fallbackLng: false,
  interpolation: { escapeValue: false },
});

export default i18next;

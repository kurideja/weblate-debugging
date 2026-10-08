import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { useTranslation } from 'react-i18next';
import './i18n';
import './style.css';

const samples = [0, 1, 2, 5, 9, 10, 11, 19, 20, 21, 22, 100, 101, 111, 1.5, 2.5];

function App() {
  const { t, i18n } = useTranslation();
  const [input, setInput] = useState('1');
  const count = Number(input);
  const valid = input.trim() !== '' && Number.isFinite(count) && count >= 0;
  const lang = i18n.resolvedLanguage || i18n.language;
  const category = valid ? new Intl.PluralRules(lang).select(count) : '—';
  // Literal keys let the extractor see each plural call.
  const examples = [
    { key: 'apples', text: t('apples', { count, defaultValue_one: '{{count}} apple', defaultValue_other: '{{count}} apples' }) },
    { key: 'messages', text: t('messages', { count, defaultValue_one: '{{count}} message', defaultValue_other: '{{count}} messages' }) },
    { key: 'files', text: t('files', { count, defaultValue_one: '{{count}} file', defaultValue_other: '{{count}} files' }) },
  ];

  useEffect(() => { document.documentElement.lang = lang; }, [lang]);

  return (
    <main>
      <p className="eyebrow">i18next · JSON v4 · en / lt</p>
      <h1>{t('title')}</h1>
      <p className="description">{t('description')}</p>
      <section className="controls">
        <label>{t('language')}
          <select value={lang} onChange={event => i18n.changeLanguage(event.target.value)}>
            <option value="en">English</option>
            <option value="lt">Lietuvių</option>
          </select>
        </label>
        <label>{t('count')}
          <input type="number" min="0" step="any" value={input} onChange={event => setInput(event.target.value)} />
        </label>
        <div className="category">{t('category')} <code>{category}</code></div>
      </section>
      <div className="presets">
        {samples.map(value => <button key={value} onClick={() => setInput(String(value))} aria-pressed={valid && count === value}>{value}</button>)}
      </div>
      <h2>{t('examples')}</h2>
      <section className="cards" aria-live="polite">
        {examples.map(({ key, text }) => <article key={key}>
          <code>{key}_{category}</code>
          <p>{valid ? text : '—'}</p>
        </article>)}
      </section>
      <h2>{t('comparison')}</h2>
      <div className="table-wrap">
        <table>
          <thead><tr><th>{t('count')}</th><th>English · {t('category')}</th><th>English · {t('translation')}</th><th>Lietuvių · {t('category')}</th><th>Lietuvių · {t('translation')}</th></tr></thead>
          <tbody>{samples.map(value => <tr key={value}>
            <td>{value}</td>
            {['en', 'lt'].map(language => <React.Fragment key={language}>
              <td><code>{new Intl.PluralRules(language).select(value)}</code></td>
              <td>{t('apples', { count: value, lng: language })}</td>
            </React.Fragment>)}
          </tr>)}</tbody>
        </table>
      </div>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);

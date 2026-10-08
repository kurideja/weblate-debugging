# i18next plural playground

A small React + Vite app for testing English and Lithuanian i18next translations before and after editing them in Weblate.

## Run locally

Use Node.js 22.12+ (or 24+).

```sh
npm install
npm run dev
```

Open the local URL printed by Vite (normally http://127.0.0.1:5173). Switch languages, enter a nonnegative count (including fractions), or use the preset buttons. The comparison table renders both languages at once. Translation JSON edits update through Vite; no translation service is needed at runtime.

```sh
npm test
npm run build
```

## Translation files and plurals

- English: `src/locales/en/translation.json`
- Lithuanian: `src/locales/lt/translation.json`

The app uses [i18next JSON v4](https://www.i18next.com/translation-function/plurals): call `t('apples', { count })` and i18next selects a suffix using `Intl.PluralRules`.

| Language | Suffixes | Examples |
| --- | --- | --- |
| English | `_one`, `_other` | 1 → one; 0, 2, 1.5 → other |
| Lithuanian | `_one`, `_few`, `_many`, `_other` | 1, 21 → one; 2, 22 → few; 1.5 → many; 0, 10, 11 → other |

Lithuanian needs additional forms that do not exist in the English source. In particular, fractions exercise `_many`. There is deliberately no `_zero` override, so zero tests the normal plural rules. Fallback is disabled to make missing translations visible instead of silently showing English. A missing plural form can still resolve to `_other` under i18next's own resolution rules; `npm test` checks that every required form exists.

## Weblate component settings

Use these settings when connecting this repository to your Weblate instance:

| Setting | Value |
| --- | --- |
| File format | i18next JSON file v4 (`i18nextv4`) |
| File mask | `src/locales/*/translation.json` |
| Monolingual base language file | `src/locales/en/translation.json` |
| Source language | English (`en`) |

Select **v4** explicitly rather than v3 or generic JSON. [Weblate's documentation](https://docs.weblate.org/en/latest/formats/i18next.html) describes v4 support (added in 4.15.1).

To test a round trip, import these files into Weblate, edit the Lithuanian plural forms, bring the resulting JSON back into `src/locales/lt/translation.json`, and run the tests and app. Check 1, 2, 10, 11, 21, 22, and 1.5; verify that `{{count}}` and all four Lithuanian suffixes survive the round trip.

## Local Weblate

### Extract from React code, then round-trip through Git

The project uses the [official i18next CLI](https://github.com/i18next/i18next-cli) with `locales: ['en', 'lt']` in `i18next.config.js`. Plural calls use literal keys so static extraction can find them:

```jsx
t('apples', {
  count,
  defaultValue_one: '{{count}} apple',
  defaultValue_other: '{{count}} apples',
})
```

The `count` option marks the key as plural. The CLI generates each language's categories automatically: English gets `_one` and `_other`; Lithuanian gets `_one`, `_few`, `_many`, and `_other`. You do not put Lithuanian suffixes into the React calls.

To inspect extraction separately from the existing translated JSON:

```sh
npm run i18n:preview
```

Open `.weblate/extracted/lt/translation.json`. Even on its first run with no existing output, it contains `apples_many`, `messages_many`, and `files_many`. Lithuanian values are blank because the extractor generates keys, not translations. This preview merges with its own previous output on subsequent runs.

For the actual round trip, use the app's existing translated files:

```sh
npm run i18n:extract
npm test
npm run weblate:start
npm run weblate:import
```

`i18n:extract` scans `src` and merges keys into `src/locales`, preserving existing translations. Missing Lithuanian forms are generated with empty values. Review those files before importing. The import commits this extracted output into the local fixture repository and asks Weblate to pull it.

Now edit/save a Lithuanian plural entry in Weblate, then:

```sh
npm run weblate:push
npm run i18n:check-pushed
git -C .weblate/repository log -5 --oneline
```

Inspect `.weblate/repository/src/locales/lt/translation.json` to see the actual pushed output. `i18n:check-pushed` checks required key presence and exits with code 1 if forms such as `_many` disappeared. It does not require new translations to be filled in. **Check the pushed file before extracting again:** extraction regenerates missing keys and can conceal what Weblate removed.

To try the received JSON in the React app, use `npm run weblate:export`, inspect the exported files, then `npm run weblate:apply` and `npm test`. With the current Weblate regression, the pushed-key check and the app's translation completeness tests fail after a Lithuanian plural edit drops `_many`.

Start Docker Desktop, then run:

```sh
npm run weblate:start
```

This starts Weblate, PostgreSQL, Valkey, and an internal Git fixture service. It waits for Weblate to finish initialization and creates the **Plural playground → i18next JSON v4** component with English and Lithuanian translations. Images are pinned by digest; the tested Weblate version is **2026.10**. The configuration follows [Weblate's Docker installation](https://docs.weblate.org/en/latest/admin/install/docker.html).

- URL: http://localhost:8080
- Username: `admin`
- Password: `local-weblate-admin`
- Lithuanian component: http://localhost:8080/projects/plural-playground/i18next-v4/lt/

These are local test credentials. The UI is bound to loopback, the database/cache/Git service have no published ports, and emails go to the container log. Weblate data persists in named Docker volumes. The fixture is an isolated Git repository in `.weblate/repository`, seeded from `src/locales`; no remote account or GitHub repository is needed.

### Reproduced plural issue

In the pinned Weblate 2026.10 instance, the Lithuanian editor exposes **three** forms for `apples`, `messages`, and `files`: `_one`, `_few`, and `_other`. The input JSON contains a fourth fractional form, `_many`, which i18next uses for counts such as `1.5`.

Editing the three visible forms and committing the changes **removes the corresponding `_many` keys** from the serialized JSON. The automated test reproduced removal of `apples_many`, `messages_many`, and `files_many`; the visible forms and their `{{count}}` placeholders were saved correctly. This fixture demonstrates a failing round trip, not full Lithuanian plural support.

```sh
npm run weblate:verify
```

The check uses Weblate's REST edit path with temporary markers, flushes edits through its JSON writer, and saves a before/after report to `.weblate/verification.json`. The processed Lithuanian JSON is saved to `.weblate/round-trip/lt/translation.json`. **Exit code 1 is expected for this reproduced regression.** The check restores the complete original file in Weblate afterward, including `_many` values. Test edits and restoration commits remain in Weblate history.

### Try your own edits

1. Open the Lithuanian component, choose **Translate**, search for `apples`, and edit/save its plural forms.
2. Export the actual repository files (this also commits pending edits):

   ```sh
   npm run weblate:export
   ```

   Inspect `.weblate/export/en/translation.json` and `.weblate/export/lt/translation.json`. The command lists keys that differ from the React source files, including removed keys.

3. To apply the exported files to the React app:

   ```sh
   npm run weblate:apply
   npm test
   npm run dev
   ```

   Missing Lithuanian `_many` forms fail the completeness test. The React app can fall back to `_other` for fractions when `_many` is absent, so inspect the files and tests as well as the UI.

After editing the React source JSON, use `npm run weblate:import` to commit the fixture changes and update Weblate. If both sides edited the same strings, inspect Weblate's repository alerts for merge conflicts.

### Push to local Git

Weblate can push real Git commits to `.weblate/repository` through the internal Docker Git service. Both pull and push URLs are `git://repository/repository`; the branch is `main`. Pushes are manual so you can inspect the files before sending changes.

After editing and saving a translation in Weblate, run:

```sh
npm run weblate:push
npm run weblate:git
git -C .weblate/repository show HEAD -- src/locales
```

The push command commits pending Weblate edits, updates from the local remote, pushes, and prints the latest received commits. You can also use Weblate's component **Manage → Repository maintenance → Push** action. Inspect the resulting file directly at `.weblate/repository/src/locales/lt/translation.json`.

The fixture uses Git's [`receive.denyCurrentBranch=updateInstead`](https://git-scm.com/docs/git-config#Documentation/git-config.txt-receivedenyCurrentBranch) so a received push updates both its branch and checked-out files. Keep this fixture's working tree clean; uncommitted edits cause Git to reject the push. The Git service has no published host port. `npm run weblate:start` preserves received changes; only `npm run weblate:import` copies React source translations into the fixture.

The `_many` serialization issue also affects pushed files. Run `npm run weblate:export` before pushing to inspect the changes. The React source files are updated only when you run `npm run weblate:apply`.

```sh
npm run weblate:logs  # startup, parsing, and repository logs; Ctrl+C to exit
npm run weblate:stop  # stops containers and preserves translations
npm run weblate:start # resumes the instance
```

# Contributing

Thanks for your interest in contributing to Easy Screenshot Plus.

## Install (temporary, for development)

1. Open `about:debugging#/runtime/this-firefox` in Firefox.
2. Click **Load Temporary Add-on…** and select `extension/manifest.json`.

Note: temporary add-ons are removed when Firefox restarts, and manifest changes
(permissions, locales) only apply on a full **Remove + re-add**, not on
**Reload**. For a persistent install, sign the add-on (see below).

## Development

```bash
npm install        # install the toolchain (ESLint 9, web-ext)
npm run lint       # ESLint (flat config, eslint.config.js)
npm run lint:ext   # web-ext lint — validates against current Firefox
npm start          # launch a temporary Firefox profile with the add-on
```

### Building / signing for a persistent install

The add-on can be self-distributed via AMO **unlisted** signing (no public
listing required):

```bash
npx web-ext sign --channel=unlisted --source-dir extension \
  --api-key="<AMO_JWT_ISSUER>" --api-secret="<AMO_JWT_SECRET>"
```

Install the resulting signed `.xpi` via `about:addons` → gear →
**Install Add-on From File**.

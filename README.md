# Easy Screenshot Plus

Capture, edit, and save screenshots in Firefox — select a region, grab the
visible area, or capture an entire web page, then annotate and save.

> This project is a community-maintained fork of Easy Screenshot. The original
> project appears inactive. This fork continues maintenance and includes
> usability improvements and compatibility updates.

## Features

- Capture a selected region, the visible area, or the whole web page.
- Built-in editor: crop, rectangles, ellipses, lines, freehand, text, and blur.
- Save to disk or copy straight to the clipboard.
- Settings page (light/dark aware), reachable from the toolbar icon's
  right-click menu:
  - **Capture the whole web page when the toolbar icon is clicked** — one-click
    capture with no popup menu.
  - **Open the download folder after saving a screenshot** — off by default, so
    your file manager no longer pops open on every save.
- macOS-style filenames, e.g. `Screenshot 2026-06-07 at 6.14.17 PM.png`.

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

## Credits

Forked from
[`mozilla-extensions/easyscreenshot`](https://github.com/mozilla-extensions/easyscreenshot)
by Mozilla Online Limited. All original work remains under its original license.

## Maintainer

Quiet Mind Creative — <hello@quietmindcreative.com>
· [thequietmind/easyscreenshotplus](https://github.com/thequietmind/easyscreenshotplus)

## License

[Mozilla Public License 2.0](LICENSE) (MPL-2.0), the same license as the
original project.

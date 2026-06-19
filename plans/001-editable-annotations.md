# Plan 001: Add selectable and editable annotations

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report; do not improvise. When done, update the status row for this plan in
> `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 694cd88..HEAD -- extension/editor extension/_locales tests`
> If an in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding. Treat a
> material mismatch as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: HIGH
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `694cd88`, 2026-06-19

## Why this matters

The editor currently flattens each annotation into the screenshot as soon as
the pointer is released. Users cannot correct placement, resize a shape,
change an arrow endpoint, or delete one annotation without undoing later work.

This plan converts annotations into retained objects, adds a Select tool, and
introduces familiar move and resize interactions. The work deliberately keeps
crop and blur as raster operations while preserving vector annotations across
those operations. No new runtime dependency or framework is warranted for this
small extension.

## Product behavior

The completed feature must behave as follows:

- Add a Select tool, represented by an arrow cursor, as the first toolbar item.
  Its keyboard shortcut is `V`.
- Creating a rectangle, ellipse, line/arrow, pencil stroke, or text annotation
  automatically selects it and returns to the Select tool.
- Clicking an annotation selects the topmost matching annotation.
- Clicking empty canvas space deselects.
- Dragging a selected annotation moves it.
- Rectangles and ellipses show eight circular handles:
  four corners and four edge midpoints.
- Corner handles resize both dimensions. Holding Shift preserves the selected
  shape's starting aspect ratio.
- Edge handles resize one dimension only.
- Lines and arrows show one circular handle at each endpoint. Dragging either
  endpoint changes the line geometry without changing which endpoint owns the
  arrowhead.
- Pencil strokes show a selection boundary and can be moved or deleted as one
  object. They are not resizable in this release.
- Text annotations show a selection boundary and can be moved, deleted,
  recolored, and resized through the existing font-size control. Double-click
  reopens the text editor with the existing content selected for editing.
  Text does not receive geometric resize handles in this release.
- Changing color, line width, arrow mode, or font size while an annotation is
  selected updates that annotation and records one undo step. With nothing
  selected, controls continue to update defaults for future annotations.
- Delete or Backspace removes the selected annotation.
- Escape cancels an active drag or resize first; otherwise it deselects and
  leaves the Select tool active.
- Selection outlines and handles are editor chrome. They must never appear in
  saved or copied images.
- Undo restores annotation creation, movement, resizing, style changes,
  deletion, crop, and blur in chronological order.
- Crop translates retained annotations into the cropped coordinate system and
  clips them visually at the new canvas boundary. It must not flatten or clear
  them.
- Blur modifies only the background pixels. It must not blur annotations that
  happen to overlap the brush.

## Current state

Relevant files:

- `extension/editor/script.js` contains all editor state, drawing tools,
  history, export, and toolbar behavior.
- `extension/editor/page.html` contains the toolbar, floating controls, display
  canvas, and text input.
- `extension/editor/style.css` contains sprite-based toolbar styles and tool
  cursors.
- `extension/_locales/*/messages.json` contains tooltips for the three shipped
  locales.

Annotations are currently committed directly to the display bitmap:

```javascript
// extension/editor/script.js:107-123
if (!this._isStartPoint(evt)) {
  this._refreshImageData();
  Editor.updateHistory();
}

_refreshImageData() {
  var [x, y, w, h] = this._rect;
  Editor.ctx.lineWidth = this.lineWidth;
  Editor.ctx.strokeStyle = this.color;
  Editor.ctx.save();
  this._stroke(Editor.ctx, x, y, w, h);
},
```

Pencil strokes also draw directly into the display context:

```javascript
// extension/editor/script.js:575-577
_draw(x, y) {
  Editor.ctx.lineTo(x, y);
  Editor.ctx.stroke();
},
```

History stores only full-canvas pixel snapshots:

```javascript
// extension/editor/script.js:1013-1021
updateHistory() {
  this._history.push(this.canvasData);
  if (this._history.length > HISTORY_LENGHT_MAX) {
    this._history.shift();
  }
  if (this._history.length > 1) {
    this._enableUndo();
  }
},
```

Export reads the visible display canvas directly:

```javascript
// extension/editor/script.js:1121-1133
"url": this.canvas.toDataURL()

var response = await fetch(this.canvas.toDataURL());
```

The project uses plain browser scripts, object literals, two-space JavaScript
indentation, and no application framework. Match the existing `BaseControl`,
`Button`, and `Floatbar` patterns in `extension/editor/script.js`. Do not add a
dependency or introduce classes, TypeScript, a bundler, or a state-management
library.

## Target architecture

Use two visible canvas layers and one offscreen raster layer:

1. `Editor.baseCanvas` is an offscreen canvas containing only screenshot pixels
   plus destructive raster edits such as blur.
2. `#display` is the composited output: clear, draw `baseCanvas`, then render all
   retained annotations in array order.
3. `#selection` is a transparent canvas positioned exactly over `#display`.
   It renders selection bounds and handles and receives pointer events only
   while the Select tool is active.

Keep annotation data as plain serializable objects:

```javascript
{
  id: "annotation-1",
  type: "rectangle",
  x: 40,
  y: 30,
  width: 200,
  height: 100,
  color: "#ff0000",
  lineWidth: 6
}

{
  id: "annotation-2",
  type: "line",
  start: {x: 40, y: 30},
  end: {x: 240, y: 130},
  color: "#ff0000",
  lineWidth: 6,
  arrowMode: "end"
}

{
  id: "annotation-3",
  type: "pencil",
  points: [{x: 40, y: 30}, {x: 42, y: 31}],
  color: "#ff0000",
  lineWidth: 6
}

{
  id: "annotation-4",
  type: "text",
  x: 40,
  y: 30,
  width: 160,
  height: 44,
  text: "Example",
  color: "#ff0000",
  fontSize: 18
}
```

Do not store canvas contexts, DOM nodes, images, functions, or selection state
inside annotation objects.

Add `extension/editor/annotations.js` for pure annotation operations and
rendering helpers. It may expose one global object for `script.js`; keep the
public surface small:

- clone annotation state;
- calculate bounds and handle positions;
- hit-test annotations and handles;
- move and resize annotations;
- translate all annotations after crop;
- render annotations into a supplied canvas context.

Keep orchestration, browser events, tool activation, history, and storage in
`extension/editor/script.js`.

History entries must have this shape:

```javascript
{
  baseData: ImageData,
  annotations: [/* cloned plain objects */]
}
```

When only vector state changes, reuse the previous immutable `baseData`
reference instead of copying the full screenshot. When crop or blur changes
pixels, capture a new `ImageData`. Selection and active-drag state are not part
of history.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Geometry tests | `node --test tests/editor-annotations.test.js` | exit 0; all tests pass |
| JavaScript lint | `npm run lint` | exit 0; no ESLint errors |
| Extension lint | `npm run lint:ext` | exit 0; 0 errors, warnings, and notices |
| Whitespace | `git diff --check` | exit 0; no output |
| Manual Firefox run | `npm start` | Firefox launches with the temporary extension |

Do not add or change package-manager scripts. This repository uses
`package-lock.json`, so use npm if an existing command requires the package
manager.

## Scope

**In scope**:

- `extension/editor/annotations.js` (create)
- `extension/editor/script.js`
- `extension/editor/page.html`
- `extension/editor/style.css`
- `extension/editor/img/tool-select.svg` (create)
- `extension/_locales/en_US/messages.json`
- `extension/_locales/ru_RU/messages.json`
- `extension/_locales/zh_CN/messages.json`
- `tests/editor-annotations.test.js` (create)
- `plans/README.md` (status update only)

**Out of scope**:

- Multi-selection, grouping, rotation, snapping, alignment guides, z-order
  controls, copy/paste, and redo.
- Resizing pencil strokes.
- Geometric resize handles for text.
- Making blur regions selectable or movable.
- Persisting an editable project after the editor tab closes.
- Changes to capture, popup, options, background, or content-script behavior.
- New dependencies, build tooling, or package scripts.

## Git workflow

- Do not commit, push, or open a pull request.
- Preserve unrelated working-tree changes.
- Keep changes limited to the in-scope files.
- At handoff, provide a scoped conventional commit suggestion of 50 characters
  or fewer and a one-to-three paragraph pull request description.

## Steps

### Step 1: Add pure annotation geometry and rendering helpers

Create `extension/editor/annotations.js` and load it after
`../common/script.js` but before `./script.js` in `page.html`.

Implement the schemas and pure helpers described in "Target architecture."
Use a reverse array scan for hit-testing so the visually topmost annotation is
selected. Use a minimum hit tolerance of 6 canvas pixels, increased to
`lineWidth / 2 + 4` for thick strokes.

Reuse the existing polished arrow geometry from `Line._stroke`; move that
geometry into the annotation renderer so preview, retained rendering, and
export cannot diverge. Rectangle and ellipse bounds must normalize negative
width or height produced when a handle crosses its opposite edge.

Expose the helpers in a form that a Node `vm` context can load for tests without
adding CommonJS behavior to the browser runtime.

Add `tests/editor-annotations.test.js` using Node's built-in `node:test` and
`assert` modules. Cover:

- rectangle and ellipse normalized bounds;
- line hit-testing at horizontal, vertical, and diagonal angles;
- arrow bounds including filled heads;
- topmost annotation wins;
- all eight rectangle/ellipse handle locations;
- edge and corner resizing;
- Shift-preserved aspect ratio;
- line endpoint movement and arrow-mode preservation;
- pencil translation;
- crop translation for every annotation type;
- short and zero-length lines do not produce `NaN` coordinates.

**Verify**:
`node --test tests/editor-annotations.test.js` → all tests pass.

### Step 2: Separate raster pixels from retained annotations

In `Editor`, add an offscreen `baseCanvas`, its context, an `annotations` array,
and `selectedAnnotationId`. Initialize `baseCanvas` from the screenshot image.

Replace direct display-canvas mutation with a single `Editor.render()` path:

1. resize and clear `#display` to match `baseCanvas`;
2. draw `baseCanvas`;
3. render annotations in array order;
4. resize and reposition `#selection`;
5. render selection chrome separately.

Rendering selection chrome must not mutate annotation data and must not draw
into `#display`.

Refactor rectangle, ellipse, and line tools first. Their transient preview may
remain on the existing temporary tool canvas, but pointer release must append a
plain annotation object rather than stroke into `Editor.ctx`. Select the new
object, switch to Select, render, and record history.

**Verify**:

- `npm run lint` → exit 0.
- In Firefox, create one rectangle, ellipse, plain line, one-end arrow, and
  two-end arrow; each remains visible after its tool canvas is removed.
- Saving and copying contain all created shapes but no selection chrome.

### Step 3: Add the Select tool and selection overlay

Add `#button-select` as the first toolbar item and `#selection` immediately
after `#display`. Add a standalone SVG toolbar icon rather than expanding or
repacking the legacy sprite.

Add translated `editor_select_tooltip` messages to all three locale files.
Register Select with shortcut `V` and make it the default active tool after
editor initialization.

Implement pointer state with explicit modes:

- idle;
- moving;
- resizing a named handle;
- moving a line start;
- moving a line end.

On pointer down, test handles first, then the selected annotation, then all
annotations from topmost to bottommost. Snapshot the annotation at drag start.
During pointer move, derive geometry from that immutable starting snapshot and
the current pointer delta; do not repeatedly mutate from the previous move
event, which causes drift.

Draw selection chrome with:

- a 1-pixel blue boundary;
- a translucent white halo where needed for contrast;
- 8-pixel white circular handles with a blue 2-pixel border;
- eight handles for rectangles/ellipses;
- endpoint handles for lines/arrows;
- bounds only for pencil and text.

Set appropriate cursors for move, cardinal resize, diagonal resize, and line
endpoint handles. Commit exactly one history entry on pointer up if geometry
changed. Do not add history entries for selection-only changes.

**Verify**:

- `npm run lint` → exit 0.
- Clicking overlapping shapes selects the topmost one.
- Dragging moves each supported annotation.
- Rectangle and ellipse edge handles resize one axis.
- Corner handles resize two axes and Shift preserves aspect ratio.
- Dragging a handle through the opposite side continues smoothly with handles
  normalized to the new geometry.
- Line endpoint handles preserve the selected arrow mode and arrow direction.
- Selection handles never appear in save or copy output.

### Step 4: Retain pencil and text annotations

Change Pencil to collect canvas-coordinate points while drawing. Render its
preview incrementally, but append one pencil annotation on pointer up. A
single-click pencil dot must remain supported. Selection moves all points by
the same delta and displays bounds without resize handles.

Replace text rasterization through SVG `foreignObject` with retained text data.
Keep the existing textarea for input and IME handling. Render text with the
same Arial/Helvetica fallback, preserved line breaks, color, and font size.
Measure lines with the canvas context to calculate stored width and height.

Double-clicking selected text must position the textarea over the annotation,
populate it with the current text, and commit one history entry when editing
finishes. Blank edited text deletes the annotation. Escape cancels the edit and
restores the pre-edit value.

**Verify**:

- `node --test tests/editor-annotations.test.js` → all tests pass.
- Pencil strokes move without changing their shape.
- Single-click pencil dots can be selected, moved, and deleted.
- New and edited multiline text preserves line breaks.
- Chinese IME input still commits correctly.
- Text move, color, font size, edit, delete, undo, and export all work.

### Step 5: Make floating controls selection-aware

When a selected annotation supports a floating control, populate the control
from the selected object's value. A control change must update both the
selected annotation and the stored default preference so the next annotation
uses the last chosen style.

Only show applicable controls:

- rectangle, ellipse, pencil: line width and color;
- line/arrow: line width, arrow mode, and color;
- text: font size and color.

Hide the floatbar for Select when nothing is selected. Reposition it beneath
the Select button when selection changes.

Coalesce one click on a style option into one history entry. Storage change
listeners must not create duplicate entries.

**Verify**:

- Each annotation type shows only applicable controls.
- Style changes affect the selection immediately and survive undo.
- Deselecting and drawing a new annotation uses the most recently selected
  style as its default.

### Step 6: Replace pixel-only history with structured history

Replace `canvasData` history entries with `{baseData, annotations}` snapshots.
Deep-clone annotation objects and nested point arrays. Treat stored `ImageData`
as immutable.

Add separate commit paths for:

- vector-only changes, reusing the current `baseData` reference;
- raster changes, capturing a new `ImageData`.

Undo restores both layers, clears selection, returns to Select, renders, and
updates the Undo button state. Keep the existing maximum of 50 entries.

Delete and Backspace must remove the selected annotation only when focus is not
inside the textarea or another editable element. Escape must follow the product
behavior defined above.

**Verify**:

- `node --test tests/editor-annotations.test.js` → all tests pass.
- A sequence of create → move → resize → recolor → delete can be undone one
  operation at a time.
- Undo after crop or blur restores both prior pixels and editable annotations.
- Selection-only clicks do not enable Undo or consume history.

### Step 7: Adapt crop, blur, save, and copy

Refactor crop to read from `baseCanvas`, produce a new cropped base image, and
translate every annotation by `-cropX, -cropY`. Keep partially clipped
annotations in the array; canvas clipping handles their visible portion.
Selection is cleared after crop.

Refactor blur to sample and write only `baseCanvas`. During blur movement,
render the composited display after each changed raster region so annotations
remain sharp above the blur. Record one raster history entry on pointer up.

Before save or copy, call `Editor.render()` and export only `#display`.
`#selection` must remain excluded by construction.

**Verify**:

- Crop with annotations present preserves their editability and correct
  relative placement.
- An annotation crossing the crop boundary is clipped but can be selected by
  its visible portion and moved back inside.
- Blur beneath an annotation changes the screenshot pixels but leaves the
  annotation sharp.
- Undo restores crop and blur in the correct chronological position.
- Save and copy match the visible composite without handles.

### Step 8: Complete regression validation

Run all automated checks, then complete the manual matrix below in Firefox.
After validation passes, run `crit` and address feedback affecting correctness,
maintainability, security, performance, or test coverage.

**Verify**:

```text
node --test tests/editor-annotations.test.js
npm run lint
npm run lint:ext
git diff --check
```

All commands must exit 0. `web-ext lint` must report zero errors, warnings, and
notices.

## Manual test plan

Use a screenshot with both light and dark regions.

1. Create every annotation type and verify automatic selection.
2. Select overlapping annotations and confirm topmost selection.
3. Move each type against all four canvas edges.
4. Resize rectangles and ellipses from all eight handles.
5. Resize across the opposite edge and verify smooth normalization.
6. Shift-resize a rectangle and ellipse from every corner.
7. Move both endpoints of plain, one-end, and two-end arrows.
8. Change selected color, width, arrow mode, and font size.
9. Edit multiline Latin text and Chinese IME text.
10. Move and delete pencil strokes, including a single-click dot.
11. Exercise Escape, Delete, and Backspace with canvas and textarea focus.
12. Crop through several annotations, then move the visible clipped portions.
13. Blur behind and beside annotations.
14. Undo at least 15 mixed vector and raster operations.
15. Save and copy with an annotation selected; inspect that no controls export.
16. Verify existing keyboard shortcuts still activate their original tools.

## Done criteria

- [ ] Select is the first toolbar tool, default active tool, and responds to
  `V`.
- [ ] Rectangle and ellipse selection shows eight working resize handles.
- [ ] Lines and arrows expose two working endpoint handles.
- [ ] Pencil and text can be selected, moved, styled where applicable, and
  deleted.
- [ ] Double-click text editing preserves existing content and IME behavior.
- [ ] Selected style controls update the object and future defaults.
- [ ] Delete, Backspace, Escape, and Undo follow the specified behavior.
- [ ] Crop and blur preserve retained vector annotations.
- [ ] Save and copy never include selection chrome.
- [ ] `node --test tests/editor-annotations.test.js` exits 0.
- [ ] `npm run lint` exits 0.
- [ ] `npm run lint:ext` reports zero errors, warnings, and notices.
- [ ] `git diff --check` exits 0.
- [ ] No files outside the in-scope list are modified.
- [ ] `crit` completes with no unresolved substantive feedback.
- [ ] The status row in `plans/README.md` is updated.

## STOP conditions

Stop and report back instead of improvising if:

- In-scope editor code has materially changed from the current-state excerpts.
- Accurate text rendering appears to require a new runtime dependency, a
  bundler, or replacing the textarea/IME flow.
- Crop cannot preserve annotations without flattening or deleting them.
- Blur cannot be isolated to the raster base without blurring annotations.
- A test or validation command fails twice after a focused fix attempt.
- The implementation requires modifying capture, popup, options, background,
  or content-script behavior.
- Performance becomes visibly interactive-laggy on a 4K screenshot with 100
  annotations. Report measurements and the identified bottleneck.

## Maintenance notes

- Annotation IDs are session-local and need only be unique within one editor
  tab. Do not introduce UUID dependencies.
- Keep annotation objects serializable. This leaves open a future editable
  project format without committing to one now.
- Selection handles are intentionally fixed in screen/canvas pixels rather than
  scaled with shape size.
- The first likely follow-ups are redo, z-order controls, and pencil resizing.
  They are explicitly deferred to keep this release understandable.
- Reviewers should pay special attention to history snapshot aliasing,
  coordinate translation after crop, zero-length geometry, and accidental
  export of editor chrome.

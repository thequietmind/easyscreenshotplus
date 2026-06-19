const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(
  __dirname,
  "../extension/editor/annotations.js"
), "utf8");
const context = {console};
vm.createContext(context);
vm.runInContext(source, context);
const Annotations = context.Annotations;

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

test("normalizes negative shape dimensions", () => {
  assert.deepEqual(
    plain(Annotations.normalizeShape({
      id: 1,
      type: "rectangle",
      x: 20,
      y: 30,
      width: -10,
      height: -15
    })),
    {
      id: 1,
      type: "rectangle",
      x: 10,
      y: 15,
      width: 10,
      height: 15
    }
  );
});

test("hits horizontal, vertical, and diagonal lines", () => {
  [
    [{x: 0, y: 10}, {x: 30, y: 10}, {x: 15, y: 14}],
    [{x: 10, y: 0}, {x: 10, y: 30}, {x: 14, y: 15}],
    [{x: 0, y: 0}, {x: 30, y: 30}, {x: 15, y: 18}]
  ].forEach(([start, end, point]) => {
    assert.equal(Annotations.hit({
      type: "line",
      start,
      end,
      color: "#000",
      lineWidth: 2,
      arrowMode: "none"
    }, point), true);
  });
});

test("shift line constraint preserves all drag quadrants", () => {
  const start = {x: 20, y: 20};
  [
    [{x: 50, y: 30}, {x: 30, y: 30}],
    [{x: 10, y: 50}, {x: 10, y: 30}],
    [{x: 0, y: 10}, {x: 10, y: 10}],
    [{x: 30, y: 0}, {x: 30, y: 10}]
  ].forEach(([end, expected]) => {
    assert.deepEqual(
      plain(Annotations.constrainLineEnd(start, end)),
      expected
    );
  });
});

test("arrow bounds include arrowhead width", () => {
  const box = Annotations.bounds({
    type: "line",
    start: {x: 0, y: 20},
    end: {x: 30, y: 20},
    color: "#000",
    lineWidth: 4,
    arrowMode: "end"
  });
  assert.ok(box.y < 12);
  assert.ok(box.y + box.height > 28);
});

test("returns the topmost hit", () => {
  const bottom = {
    id: "bottom",
    type: "rectangle",
    x: 0,
    y: 0,
    width: 30,
    height: 30,
    color: "#000",
    lineWidth: 2
  };
  const top = {...bottom, id: "top"};
  assert.equal(Annotations.topmost([bottom, top], {x: 10, y: 10}).id, "top");
});

test("shape exposes eight handles", () => {
  const handles = Annotations.handles({
    type: "circle",
    x: 10,
    y: 20,
    width: 40,
    height: 60
  });
  assert.deepEqual(
    plain(handles.map(handle => handle.name)),
    ["nw", "n", "ne", "e", "se", "s", "sw", "w"]
  );
  assert.deepEqual(plain(handles[4]), {name: "se", x: 50, y: 80});
});

test("resizes edges and corners, including crossing", () => {
  const shape = {
    type: "rectangle",
    x: 10,
    y: 20,
    width: 40,
    height: 30
  };
  assert.deepEqual(
    plain(Annotations.resize(shape, "e", 15, 50, false)),
    {...shape, width: 55}
  );
  assert.deepEqual(
    plain(Annotations.resize(shape, "nw", 50, 40, false)),
    {...shape, x: 50, y: 50, width: 10, height: 10}
  );
});

test("shift corner resize preserves starting aspect ratio", () => {
  const resized = Annotations.resize({
    type: "rectangle",
    x: 0,
    y: 0,
    width: 40,
    height: 20
  }, "se", 0, 30, true);
  assert.equal(resized.width / resized.height, 2);
  assert.deepEqual(plain(resized), {
    type: "rectangle",
    x: 0,
    y: 0,
    width: 100,
    height: 50
  });
});

test("moves line endpoints without changing arrow ownership", () => {
  const line = {
    type: "line",
    start: {x: 0, y: 0},
    end: {x: 20, y: 10},
    arrowMode: "end"
  };
  const moved = Annotations.moveEndpoint(line, "start", 5, 7);
  assert.deepEqual(plain(moved.start), {x: 5, y: 7});
  assert.deepEqual(plain(moved.end), line.end);
  assert.equal(moved.arrowMode, "end");
});

test("moves every pencil point", () => {
  const moved = Annotations.move({
    type: "pencil",
    points: [{x: 1, y: 2}, {x: 3, y: 4}]
  }, 10, -2);
  assert.deepEqual(plain(moved.points), [{x: 11, y: 0}, {x: 13, y: 2}]);
});

test("crop translates every annotation type", () => {
  const translated = Annotations.cropTranslate([
    {type: "rectangle", x: 10, y: 20, width: 5, height: 6},
    {type: "line", start: {x: 10, y: 20}, end: {x: 30, y: 40}},
    {type: "pencil", points: [{x: 10, y: 20}]},
    {type: "text", x: 10, y: 20, width: 20, height: 10}
  ], 3, 4);
  assert.deepEqual([translated[0].x, translated[0].y], [7, 16]);
  assert.deepEqual(plain(translated[1].start), {x: 7, y: 16});
  assert.deepEqual(plain(translated[2].points[0]), {x: 7, y: 16});
  assert.deepEqual([translated[3].x, translated[3].y], [7, 16]);
});

test("short and zero-length line geometry stays finite", () => {
  [
    {
      type: "line",
      start: {x: 1, y: 1},
      end: {x: 1, y: 1},
      lineWidth: 9,
      arrowMode: "both"
    },
    {
      type: "line",
      start: {x: 1, y: 1},
      end: {x: 2, y: 1},
      lineWidth: 9,
      arrowMode: "end"
    }
  ].forEach(line => {
    const box = Annotations.bounds(line);
    Object.values(box).forEach(value => assert.equal(Number.isFinite(value), true));
    Annotations.arrowPoints(line.end, line.start, line.lineWidth)
      .flatMap(point => Object.values(point))
      .forEach(value => assert.equal(Number.isFinite(value), true));
  });
});

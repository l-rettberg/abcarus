import assert from "node:assert/strict";
import {
  DEFAULT_SET_LIST_HEADER_TEXT,
  insertSetListItemAt,
  moveSetListItems,
  normalizeSetListPageBreaks,
  parseSetListSavedState,
  removeSetListItemAt,
  serializeSetListState,
} from "../../src/renderer/tools/set_list/set_list_model.js";

function test(name, fn) {
  fn();
  console.log(`% PASS ${name}`);
}

const fixedNow = () => 1234;
const fixedRandom = () => 0.5;

test("normalizes saved Set List state", () => {
  const state = parseSetListSavedState({
    version: "1",
    pageBreaks: "auto",
    compact: true,
    headerText: "%%stretchlast 0\n",
    items: [
      { id: "a", title: "A", text: "X:1\nT:A\nK:C\nC\n", addedAtMs: 10 },
      { id: "empty", text: "   " },
      { title: "B", composer: "C", sourceTuneId: "t2", text: "X:2\nT:B\nK:C\nD\n" },
    ],
  }, { now: fixedNow, random: fixedRandom });
  assert.equal(state.pageBreaks, "auto");
  assert.equal(state.compact, true);
  assert.equal(state.headerText, "%%stretchlast 0\n");
  assert.equal(state.items.length, 2);
  assert.equal(state.items[0].id, "a");
  assert.equal(state.items[1].id, "1234::8");
  assert.equal(state.items[1].addedAtMs, 1234);
});

test("rejects invalid saved state and defaults fields", () => {
  assert.equal(parseSetListSavedState(null), null);
  assert.equal(parseSetListSavedState({ version: "2" }), null);
  const state = parseSetListSavedState({ version: "1", pageBreaks: "bad", items: [] });
  assert.equal(state.pageBreaks, "perTune");
  assert.equal(state.compact, false);
  assert.equal(state.headerText, DEFAULT_SET_LIST_HEADER_TEXT);
});

test("serializes state with strict fields", () => {
  const payload = serializeSetListState({
    now: fixedNow,
    pageBreaks: "none",
    compact: true,
    headerText: "H\n",
    items: [{ id: "i", title: "Title", text: "ABC", addedAtMs: 5, extra: "ignored" }],
  });
  assert.deepEqual(Object.keys(payload.items[0]), [
    "id",
    "sourceTuneId",
    "sourcePath",
    "xNumber",
    "title",
    "composer",
    "headerText",
    "text",
    "addedAtMs",
  ]);
  assert.equal(payload.savedAtMs, 1234);
  assert.equal(payload.pageBreaks, "none");
});

test("moves removes and inserts immutably", () => {
  const a = { id: "a" };
  const b = { id: "b" };
  const c = { id: "c" };
  const source = [a, b, c];
  assert.deepEqual(moveSetListItems(source, 0, 2).map((item) => item.id), ["b", "c", "a"]);
  assert.equal(moveSetListItems(source, 4, 0), source);
  assert.deepEqual(removeSetListItemAt(source, 1).map((item) => item.id), ["a", "c"]);
  assert.equal(removeSetListItemAt(source, -1), source);
  assert.deepEqual(insertSetListItemAt(source, { id: "x" }, 1).map((item) => item.id), ["a", "x", "b", "c"]);
  assert.deepEqual(insertSetListItemAt(source, { id: "x" }, 99).map((item) => item.id), ["a", "b", "c", "x"]);
  assert.equal(insertSetListItemAt(source, null, 0), source);
});

test("normalizes page break modes", () => {
  assert.equal(normalizeSetListPageBreaks("perTune"), "perTune");
  assert.equal(normalizeSetListPageBreaks("none"), "none");
  assert.equal(normalizeSetListPageBreaks("auto"), "auto");
  assert.equal(normalizeSetListPageBreaks("continuous", "none"), "none");
});

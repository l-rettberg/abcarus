#!/usr/bin/env node
/* eslint-disable no-console */
import assert from "node:assert/strict";
import { build } from "esbuild";

const bundled = await build({
  entryPoints: ["src/renderer/editor/editor_commands.js"],
  bundle: true,
  format: "esm",
  platform: "node",
  write: false,
});
const encoded = Buffer.from(bundled.outputFiles[0].text, "utf8").toString("base64");
const { toggleLineComments } = await import(`data:text/javascript;base64,${encoded}`);

function createView(text) {
  const lines = String(text).split("\n");
  const starts = [];
  let offset = 0;
  for (const line of lines) {
    starts.push(offset);
    offset += line.length + 1;
  }
  const line = (number) => ({
    number,
    from: starts[number - 1],
    to: starts[number - 1] + lines[number - 1].length,
    text: lines[number - 1],
  });
  const lineAt = (position) => {
    let number = 1;
    for (let index = 1; index < starts.length; index += 1) {
      if (starts[index] > position) break;
      number = index + 1;
    }
    return line(number);
  };
  const transactions = [];
  return {
    transactions,
    view: {
      state: {
        doc: { line, lineAt },
        selection: { ranges: [{ from: 0, to: Math.max(0, text.length - 1) }] },
      },
      dispatch: (transaction) => transactions.push(transaction),
    },
  };
}

{
  const { view, transactions } = createView("%%MIDI drumon");
  assert.equal(toggleLineComments(view), true);
  assert.deepEqual(transactions[0].changes, [
    { from: 0, to: 0, insert: "% " },
  ]);
}

{
  const { view, transactions } = createView("% %%MIDI drumon");
  assert.equal(toggleLineComments(view), true);
  assert.deepEqual(transactions[0].changes, [
    { from: 0, to: 2, insert: "" },
  ]);
}

{
  const { view, transactions } = createView("% existing comment");
  assert.equal(toggleLineComments(view), true);
  assert.deepEqual(transactions[0].changes, [
    { from: 0, to: 2, insert: "" },
  ]);
}

console.log("editor commands harness: all tests passed");

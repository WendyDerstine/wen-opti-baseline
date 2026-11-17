import assert from "node:assert/strict";
import { test } from "node:test";
import { applyHunks, diffLines, parsePatch, unifiedDiff } from "../core/diff.ts";
import { FileToolError } from "../core/errors.ts";
import { NOEOL } from "../core/text.ts";

const applyOps = (a: string[], ops: ReturnType<typeof diffLines>) => {
  const outA: string[] = [];
  const outB: string[] = [];
  for (const op of ops) {
    if (op.type !== "insert") outA.push(op.line);
    if (op.type !== "delete") outB.push(op.line);
  }
  return { outA, outB };
};

test("diffLines reconstructs both sides (randomised)", () => {
  let seed = 42;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
  for (let t = 0; t < 300; t++) {
    const a = Array.from({ length: Math.floor(rnd() * 30) }, () => "abcde"[Math.floor(rnd() * 5)]);
    const b = Array.from({ length: Math.floor(rnd() * 30) }, () => "abcde"[Math.floor(rnd() * 5)]);
    const ops = diffLines(a, b);
    const { outA, outB } = applyOps(a, ops);
    assert.deepEqual(outA, a);
    assert.deepEqual(outB, b);
  }
});

test("unifiedDiff output round-trips through parsePatch/applyHunks (randomised)", () => {
  let seed = 7;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
  for (let t = 0; t < 300; t++) {
    const a = Array.from({ length: Math.floor(rnd() * 40) }, (_, i) => `line ${Math.floor(rnd() * 8)} ${i % 3}`);
    const b = a.filter(() => rnd() > 0.2).map((l) => (rnd() > 0.85 ? `${l} changed` : l));
    if (rnd() > 0.5) b.splice(Math.floor(rnd() * (b.length + 1)), 0, "inserted");
    if (a.length && rnd() > 0.7) a[a.length - 1] += NOEOL;
    const d = unifiedDiff(a, b, { oldName: "a/x", newName: "b/x" });
    if (!d.text) {
      assert.deepEqual(a, b);
      continue;
    }
    const { lines } = applyHunks(a, parsePatch(d.text));
    assert.deepEqual(lines, b, d.text);
  }
});

test("unifiedDiff renders headers and no-newline marker", () => {
  const d = unifiedDiff(["a", "b", `c${NOEOL}`], ["a", "B", "c"], { oldName: "a/f", newName: "b/f" });
  assert.equal(
    d.text,
    ["--- a/f", "+++ b/f", "@@ -1,3 +1,3 @@", " a", "-b", "-c", "\\ No newline at end of file", "+B", "+c", ""].join("\n"),
  );
  assert.equal(d.added, 2);
  assert.equal(d.removed, 2);
});

test("applyHunks uses offset when line numbers are wrong, fails on ambiguity", () => {
  const file = ["x", "x", "function a() {", "  return 1;", "}", "x"];
  const patch = "@@ -40,3 +40,3 @@\n function a() {\n-  return 1;\n+  return 2;\n }\n";
  const { lines, placements } = applyHunks(file, parsePatch(patch));
  assert.equal(lines[3], "  return 2;");
  assert.equal(placements[0].line, 3);

  const dup = ["}", "}", "}"];
  assert.throws(() => applyHunks(dup, parsePatch("@@\n-}\n+};\n")), (e: FileToolError) => e.code === "PATCH_FAILED" && /matches/.test(e.message));
});

test("applyHunks tolerates trailing whitespace and keeps file's context text", () => {
  const file = ["const a = 1;   ", "const b = 2;"];
  const { lines, placements } = applyHunks(file, parsePatch("@@ -1,2 +1,2 @@\n const a = 1;\n-const b = 2;\n+const b = 3;\n"));
  assert.deepEqual(lines, ["const a = 1;   ", "const b = 3;"]);
  assert.equal(placements[0].fuzzy, true);
});

test("parsePatch rejects multi-file patches and junk lines", () => {
  const multi = "--- a/x\n+++ b/x\n@@ -1 +1 @@\n-a\n+b\n--- a/y\n+++ b/y\n@@ -1 +1 @@\n-c\n+d\n";
  assert.throws(() => parsePatch(multi), /more than one file/);
  assert.throws(() => parsePatch("@@ -1 +1 @@\n-a\nnot a diff line\n"), /Unexpected line/);
  assert.throws(() => parsePatch("just text"), /No hunks/);
});

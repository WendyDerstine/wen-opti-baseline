import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { beforeEach, test } from "node:test";
import { makeConfig, type FileToolConfig } from "../config.ts";
import type { FileToolError } from "../core/errors.ts";
import {
  applySourceFilePatch,
  editSourceFileLines,
  readSourceFile,
  replaceInSourceFile,
  restoreSourceFileBackup,
  writeSourceFile,
} from "../core/fileOps.ts";

let root: string;
let outside: string;
let cfg: FileToolConfig;

const code = (c: string) => (e: unknown) => (e as FileToolError).code === c;
const put = (rel: string, content: string | Buffer) => fs.writeFile(path.join(root, rel), content);
const get = (rel: string) => fs.readFile(path.join(root, rel), "utf8");

beforeEach(async () => {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), "srcfile-"));
  root = path.join(base, "repo");
  outside = path.join(base, "outside");
  await fs.mkdir(path.join(root, "src"), { recursive: true });
  await fs.mkdir(outside);
  cfg = makeConfig({ roots: [root], backupDir: path.join(base, "backups"), maxBytes: 64 * 1024, maxReadLines: 50 });
});

// ---------------- read ----------------

test("read returns numbered lines, sha256 and paging", async () => {
  await put("src/a.ts", Array.from({ length: 120 }, (_, i) => `line ${i + 1}`).join("\n") + "\n");
  const r = await readSourceFile(cfg, { path: "src/a.ts" });
  assert.equal(r.total_lines, 120);
  assert.equal(r.end_line, 50);
  assert.equal(r.truncated, true);
  assert.equal(r.next_start_line, 51);
  assert.match(r.content, /^ 1\tline 1\n/);
  assert.equal(r.sha256.length, 64);
  const r2 = await readSourceFile(cfg, { path: "src/a.ts", startLine: 101, lineNumbers: false });
  assert.equal(r2.content.split("\n")[0], "line 101");
  assert.equal(r2.truncated, false);
});

test("read rejects binary, missing and oversize files", async () => {
  await put("bin.dat", Buffer.from([1, 2, 0, 3]));
  await assert.rejects(readSourceFile(cfg, { path: "bin.dat" }), code("BINARY_FILE"));
  await assert.rejects(readSourceFile(cfg, { path: "nope.ts" }), code("NOT_FOUND"));
  await put("big.txt", "x".repeat(70 * 1024));
  await assert.rejects(readSourceFile(cfg, { path: "big.txt" }), code("TOO_LARGE"));
});

// ---------------- path safety ----------------

test("path policy: traversal, absolute outside, symlink escape, deny-list, extensions", async () => {
  await fs.writeFile(path.join(outside, "secret.txt"), "s");
  await assert.rejects(readSourceFile(cfg, { path: "../outside/secret.txt" }), code("PATH_NOT_ALLOWED"));
  await assert.rejects(readSourceFile(cfg, { path: path.join(outside, "secret.txt") }), code("PATH_NOT_ALLOWED"));
  await fs.symlink(outside, path.join(root, "link"));
  await assert.rejects(readSourceFile(cfg, { path: "link/secret.txt" }), code("PATH_NOT_ALLOWED"));
  await assert.rejects(writeSourceFile(cfg, { path: "link/new.txt", content: "x" }), code("PATH_NOT_ALLOWED"));
  await assert.rejects(writeSourceFile(cfg, { path: ".git/config", content: "x" }), code("PATH_NOT_ALLOWED"));
  await assert.rejects(writeSourceFile(cfg, { path: "config/.env.local", content: "x" }), code("PATH_NOT_ALLOWED"));
  await assert.rejects(readSourceFile(cfg, { path: "" }), code("INVALID_ARGUMENT"));

  const strict = { ...cfg, allowedExtensions: [".ts"] };
  await assert.rejects(writeSourceFile(strict, { path: "a.sh", content: "x" }), code("PATH_NOT_ALLOWED"));
  await writeSourceFile(strict, { path: "ok.ts", content: "x" });
});

// ---------------- write ----------------

test("write creates (with dirs), refuses silent overwrite, preserves CRLF + BOM", async () => {
  const c = await writeSourceFile(cfg, { path: "src/new/deep.ts", content: "export const a = 1;\n" });
  assert.equal(c.created, true);
  assert.equal(await get("src/new/deep.ts"), "export const a = 1;\n");
  await assert.rejects(writeSourceFile(cfg, { path: "src/new/deep.ts", content: "x" }), code("ALREADY_EXISTS"));

  await put("win.cs", "\uFEFFclass A {\r\n}\r\n");
  const w = await writeSourceFile(cfg, { path: "win.cs", content: "class B {\n  int x;\n}\n", overwrite: true });
  assert.equal(await get("win.cs"), "\uFEFFclass B {\r\n  int x;\r\n}\r\n");
  assert.ok(w.backup_id);
  assert.match(w.diff, /-class A \{\n\+class B \{/);
});

test("write create_dirs=false fails when parent is missing", async () => {
  await assert.rejects(writeSourceFile(cfg, { path: "missing/x.ts", content: "x", createDirs: false }), code("NOT_FOUND"));
});

// ---------------- str_replace ----------------

test("replace: exactly-once semantics, replace_all, helpful hints", async () => {
  await put("src/a.ts", "const a = 1;\nconst b = 1;\n  indented();\n");
  await assert.rejects(replaceInSourceFile(cfg, { path: "src/a.ts", oldString: "= 1;", newString: "= 2;" }), (e: FileToolError) => {
    assert.equal(e.code, "MULTIPLE_MATCHES");
    assert.deepEqual(e.details?.match_lines, [1, 2]);
    return true;
  });
  await assert.rejects(replaceInSourceFile(cfg, { path: "src/a.ts", oldString: "nothing", newString: "x" }), code("NO_MATCH"));
  await put("src/b.ts", "    foo();\n");
  await assert.rejects(replaceInSourceFile(cfg, { path: "src/b.ts", oldString: "  foo();\n  bar();", newString: "x" }), code("NO_MATCH"));
  await assert.rejects(replaceInSourceFile(cfg, { path: "src/b.ts", oldString: "foo();\n", newString: "foo();\n" }), code("INVALID_ARGUMENT"));

  await put("src/c.ts", "const a = 1;\nconst b = 1;\n");
  const r = await replaceInSourceFile(cfg, { path: "src/c.ts", oldString: "= 1;", newString: "= 2;", replaceAll: true });
  assert.equal(r.replacements, 2);
  assert.equal(await get("src/c.ts"), "const a = 2;\nconst b = 2;\n");
});

test("replace: whitespace-insensitive hint and multi-line CRLF match", async () => {
  await put("src/w.ts", "function f() {\r\n    return 1;\r\n}\r\n");
  await assert.rejects(
    replaceInSourceFile(cfg, { path: "src/w.ts", oldString: "function f() {\n  return 1;", newString: "x" }),
    (e: FileToolError) => e.code === "NO_MATCH" && /line 1/.test(e.hint ?? ""),
  );
  await replaceInSourceFile(cfg, { path: "src/w.ts", oldString: "{\n    return 1;\n}", newString: "{\n    return 2;\n}" });
  assert.equal(await get("src/w.ts"), "function f() {\r\n    return 2;\r\n}\r\n");
});

// ---------------- line edits ----------------

test("line edits: replace, insert, append, delete with previews", async () => {
  await put("src/l.ts", "a\nb\nc\nd\n");
  const r = await editSourceFileLines(cfg, { path: "src/l.ts", operation: "replace", startLine: 2, endLine: 3, content: "B\nC\nC2\n" });
  assert.equal(await get("src/l.ts"), "a\nB\nC\nC2\nd\n");
  assert.equal(r.line_delta, 1);
  assert.match((r.preview as { content: string }).content, /2\tB/);

  await editSourceFileLines(cfg, { path: "src/l.ts", operation: "insert", startLine: 1, content: "// header" });
  await editSourceFileLines(cfg, { path: "src/l.ts", operation: "insert", startLine: 7, content: "e" });
  await editSourceFileLines(cfg, { path: "src/l.ts", operation: "delete", startLine: 3, endLine: 4 });
  assert.equal(await get("src/l.ts"), "// header\na\nC2\nd\ne\n");

  await assert.rejects(editSourceFileLines(cfg, { path: "src/l.ts", operation: "delete", startLine: 9 }), code("INVALID_ARGUMENT"));
  await assert.rejects(editSourceFileLines(cfg, { path: "src/l.ts", operation: "insert", startLine: 1 }), code("INVALID_ARGUMENT"));
});

test("line edits preserve a missing final newline", async () => {
  await put("src/n.ts", "a\nb");
  await editSourceFileLines(cfg, { path: "src/n.ts", operation: "replace", startLine: 1, content: "A" });
  assert.equal(await get("src/n.ts"), "A\nb");
});

// ---------------- patch ----------------

test("patch: multi-hunk apply, drift tolerance, atomic failure", async () => {
  const lines = Array.from({ length: 30 }, (_, i) => `l${i + 1}`);
  await put("src/p.ts", lines.join("\n") + "\n");
  const patch = [
    "--- a/src/p.ts",
    "+++ b/src/p.ts",
    "@@ -2,3 +2,3 @@",
    " l2",
    "-l3",
    "+L3",
    " l4",
    "@@ -25,3 +25,4 @@",
    " l25",
    " l26",
    "+inserted",
    " l27",
  ].join("\n");
  const r = await applySourceFilePatch(cfg, { path: "src/p.ts", patch });
  assert.equal(r.hunks_applied, 2);
  const after = (await get("src/p.ts")).split("\n");
  assert.equal(after[2], "L3");
  assert.equal(after[26], "inserted");

  const before = await get("src/p.ts");
  const bad = "@@ -1,2 +1,2 @@\n l1\n-l2\n+X\n@@ -10,1 +10,1 @@\n-does not exist\n+Y\n";
  await assert.rejects(applySourceFilePatch(cfg, { path: "src/p.ts", patch: bad }), code("PATCH_FAILED"));
  assert.equal(await get("src/p.ts"), before, "nothing written on failure");
});

test("patch: can create a new file from '+' lines only; no-newline marker honoured", async () => {
  await applySourceFilePatch(cfg, { path: "src/created.ts", patch: "--- /dev/null\n+++ b/src/created.ts\n@@ -0,0 +1,2 @@\n+a\n+b\n\\ No newline at end of file\n" });
  assert.equal(await get("src/created.ts"), "a\nb");
  await assert.rejects(applySourceFilePatch(cfg, { path: "src/ghost.ts", patch: "@@ -1 +1 @@\n-a\n+b\n" }), code("NOT_FOUND"));
});

test("patch keeps missing EOF newline when the patch ignores it", async () => {
  await put("src/e.ts", "a\nb");
  await applySourceFilePatch(cfg, { path: "src/e.ts", patch: "@@ -1,2 +1,2 @@\n a\n-b\n+B\n" });
  assert.equal(await get("src/e.ts"), "a\nB");
});

// ---------------- safety: stale, dry-run, read-only, backups ----------------

test("expected_sha256 blocks stale edits", async () => {
  await put("src/s.ts", "v1\n");
  const { sha256 } = await readSourceFile(cfg, { path: "src/s.ts" });
  await put("src/s.ts", "v2 (someone else)\n");
  await assert.rejects(replaceInSourceFile(cfg, { path: "src/s.ts", oldString: "v2", newString: "v3", expectedSha256: sha256 }), code("STALE_FILE"));
  const fresh = await readSourceFile(cfg, { path: "src/s.ts" });
  const ok = await replaceInSourceFile(cfg, { path: "src/s.ts", oldString: "v2", newString: "v3", expectedSha256: fresh.sha256 });
  assert.equal(ok.sha256_before, fresh.sha256);
});

test("dry-run writes nothing; read-only blocks writes but allows dry-run", async () => {
  await put("src/d.ts", "a\n");
  const r = await replaceInSourceFile(cfg, { path: "src/d.ts", oldString: "a", newString: "b", dryRun: true });
  assert.equal(r.dry_run, true);
  assert.match(r.diff, /-a\n\+b/);
  assert.equal(await get("src/d.ts"), "a\n");

  const ro = { ...cfg, readOnly: true };
  await assert.rejects(replaceInSourceFile(ro, { path: "src/d.ts", oldString: "a", newString: "b" }), code("READ_ONLY"));
  await replaceInSourceFile(ro, { path: "src/d.ts", oldString: "a", newString: "b", dryRun: true });

  const defDry = { ...cfg, defaultDryRun: true };
  await replaceInSourceFile(defDry, { path: "src/d.ts", oldString: "a", newString: "b" });
  assert.equal(await get("src/d.ts"), "a\n");
});

test("backups: taken on every write, listed newest-first, restorable, pruned", async () => {
  const small = { ...cfg, backupKeep: 3 };
  await put("src/b.ts", "v0\n");
  for (let i = 1; i <= 5; i++) {
    await writeSourceFile(small, { path: "src/b.ts", content: `v${i}\n`, overwrite: true });
  }
  const listed = await restoreSourceFileBackup(small, { path: "src/b.ts", listOnly: true });
  assert.equal(listed.backups.length, 3);

  const r = await restoreSourceFileBackup(small, { path: "src/b.ts" });
  assert.equal(await get("src/b.ts"), "v4\n");
  assert.ok(r.restored_backup_id);
  await assert.rejects(restoreSourceFileBackup(small, { path: "src/b.ts", backupId: "../../etc" }), code("INVALID_ARGUMENT"));
  await assert.rejects(readSourceFile(cfg, { path: path.join(cfg.backupDir, "x") }), code("PATH_NOT_ALLOWED"));
});

test("no-op edits report changed=false and take no backup", async () => {
  await put("src/same.ts", "x\n");
  const r = await writeSourceFile(cfg, { path: "src/same.ts", content: "x\n", overwrite: true });
  assert.equal(r.changed, false);
  assert.equal(r.backup_id, null);
});

test("concurrent edits to one file are serialised (no lost updates)", async () => {
  await put("src/c.ts", Array.from({ length: 20 }, (_, i) => `item${i}`).join("\n") + "\n");
  await Promise.all(
    Array.from({ length: 20 }, (_, i) => replaceInSourceFile(cfg, { path: "src/c.ts", oldString: `item${i}\n`, newString: `ITEM${i}\n` })),
  );
  const out = await get("src/c.ts");
  assert.equal(out, Array.from({ length: 20 }, (_, i) => `ITEM${i}`).join("\n") + "\n");
});

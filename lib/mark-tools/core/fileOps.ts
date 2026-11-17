import { randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { FileToolConfig } from "../config.ts";
import { createBackup, listBackups, readBackup, type BackupInfo } from "./backup.ts";
import { applyHunks, parsePatch, unifiedDiff } from "./diff.ts";
import { FileToolError } from "./errors.ts";
import { resolveSafePath, type ResolvedPath } from "./paths.ts";
import {
  decodeUtf8,
  fromSentinel,
  isProbablyBinary,
  numberLines,
  parseDoc,
  parseText,
  serialize,
  sha256,
  splitContent,
  toLF,
  withSentinel,
  type TextDoc,
} from "./text.ts";

// ---------------------------------------------------------------------------
// Shared plumbing
// ---------------------------------------------------------------------------

interface Loaded {
  buf: Buffer;
  doc: TextDoc;
  mixedEol: boolean;
  sha: string;
  mode: number;
}

export interface MutationResult {
  ok: true;
  path: string;
  dry_run: boolean;
  changed: boolean;
  created: boolean;
  sha256_before: string | null;
  sha256_after: string;
  backup_id: string | null;
  lines_added: number;
  lines_removed: number;
  diff: string;
  diff_truncated: boolean;
  [extra: string]: unknown;
}

export interface MutationOptions {
  /** Preview only: compute the diff, write nothing. */
  dryRun?: boolean;
  /** Optimistic concurrency: fail unless the file still has this sha256 (from a previous read). */
  expectedSha256?: string;
}

const locks = new Map<string, Promise<unknown>>();

/** Serialise operations on the same file within this process. */
async function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(key) ?? Promise.resolve();
  const run = prev.catch(() => undefined).then(fn);
  const tail = run.catch(() => undefined);
  locks.set(key, tail);
  try {
    return await run;
  } finally {
    if (locks.get(key) === tail) locks.delete(key);
  }
}

async function loadExisting(target: ResolvedPath, cfg: FileToolConfig): Promise<Loaded | null> {
  let stat;
  try {
    stat = await fs.stat(target.abs);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
  if (!stat.isFile()) throw new FileToolError("NOT_A_FILE", `Not a regular file: ${target.rel}`);
  if (stat.size > cfg.maxBytes) {
    throw new FileToolError("TOO_LARGE", `File is ${stat.size} bytes; the limit is ${cfg.maxBytes}.`);
  }
  const buf = await fs.readFile(target.abs);
  if (isProbablyBinary(buf)) throw new FileToolError("BINARY_FILE", `Refusing to treat a binary file as text: ${target.rel}`);
  const text = decodeUtf8(buf);
  const { mixedEol } = parseText(text);
  return { buf, doc: parseDoc(text), mixedEol, sha: sha256(buf), mode: stat.mode & 0o7777 };
}

async function requireExisting(target: ResolvedPath, cfg: FileToolConfig): Promise<Loaded> {
  const loaded = await loadExisting(target, cfg);
  if (!loaded) {
    throw new FileToolError("NOT_FOUND", `File not found: ${target.rel}`, {
      hint: "Check the path (list_source_files can help), or create the file with write_source_file.",
    });
  }
  return loaded;
}

function checkFresh(before: Loaded | null, expected: string | undefined): void {
  if (!expected) return;
  const want = expected.trim().toLowerCase();
  if (!before || before.sha !== want) {
    throw new FileToolError("STALE_FILE", "The file changed since you read it (sha256 mismatch).", {
      hint: "Re-read the file with read_source_file and redo the edit against the current content.",
      details: { expected_sha256: want, actual_sha256: before?.sha ?? null },
    });
  }
}

async function atomicWrite(abs: string, buf: Buffer, mode?: number): Promise<void> {
  const tmp = path.join(path.dirname(abs), `.${path.basename(abs)}.${process.pid}.${randomBytes(4).toString("hex")}.tmp`);
  const fh = await fs.open(tmp, "wx", 0o600);
  try {
    await fh.writeFile(buf);
    await fh.sync();
  } finally {
    await fh.close();
  }
  try {
    await fs.chmod(tmp, mode ?? 0o644);
    await fs.rename(tmp, abs);
  } catch (err) {
    await fs.rm(tmp, { force: true });
    throw err;
  }
}

async function commit(
  cfg: FileToolConfig,
  target: ResolvedPath,
  before: Loaded | null,
  after: TextDoc,
  opts: { dryRun: boolean; createDirs?: boolean; afterRaw?: Buffer },
): Promise<MutationResult> {
  const newBuf = opts.afterRaw ?? Buffer.from(serialize(after), "utf8");
  if (newBuf.length > cfg.maxBytes) {
    throw new FileToolError("TOO_LARGE", `Result would be ${newBuf.length} bytes; the limit is ${cfg.maxBytes}.`);
  }
  if (!before && !opts.createDirs) {
    const parent = path.dirname(target.abs);
    const exists = await fs.stat(parent).then((s) => s.isDirectory(), () => false);
    if (!exists) {
      throw new FileToolError("NOT_FOUND", `Parent directory does not exist: ${path.dirname(target.rel)}`, {
        hint: "Pass create_dirs=\"true\" to create missing directories.",
      });
    }
  }

  const changed = !before || !before.buf.equals(newBuf);
  const d = unifiedDiff(before ? withSentinel(before.doc) : [], withSentinel(after), {
    oldName: before ? `a/${target.rel}` : "/dev/null",
    newName: `b/${target.rel}`,
  });
  const diffTruncated = d.text.length > cfg.maxDiffChars;
  const result: MutationResult = {
    ok: true,
    path: target.rel,
    dry_run: opts.dryRun,
    changed,
    created: !before,
    sha256_before: before?.sha ?? null,
    sha256_after: sha256(newBuf),
    backup_id: null,
    lines_added: d.added,
    lines_removed: d.removed,
    diff: diffTruncated ? `${d.text.slice(0, cfg.maxDiffChars)}\n... (diff truncated)` : d.text,
    diff_truncated: diffTruncated,
  };
  if (opts.dryRun || !changed) return result;

  if (before && cfg.backupsEnabled) result.backup_id = await createBackup(cfg, target.abs, before.buf);
  if (!before) await fs.mkdir(path.dirname(target.abs), { recursive: true });
  await atomicWrite(target.abs, newBuf, before?.mode);
  return result;
}

function resolveDryRun(cfg: FileToolConfig, requested: boolean | undefined): boolean {
  const dryRun = requested ?? cfg.defaultDryRun;
  if (!dryRun && cfg.readOnly) {
    throw new FileToolError("READ_ONLY", "This tool server is in read-only mode.", {
      hint: "Use dry_run=\"true\" to preview the change.",
    });
  }
  return dryRun;
}

function previewAround(doc: TextDoc, fromLine: number, toLine: number, pad = 3) {
  const start = Math.max(1, fromLine - pad);
  const end = Math.min(doc.lines.length, Math.max(toLine, fromLine) + pad);
  return { start_line: start, end_line: end, content: numberLines(doc.lines.slice(start - 1, end), start) };
}

const lineOf = (text: string, index: number): number => {
  let n = 1;
  for (let i = 0; i < index; i++) if (text.charCodeAt(i) === 10) n++;
  return n;
};

function positiveInt(name: string, v: number | undefined): number | undefined {
  if (v === undefined) return undefined;
  if (!Number.isInteger(v) || v < 1) throw new FileToolError("INVALID_ARGUMENT", `\`${name}\` must be a whole number >= 1.`);
  return v;
}

// ---------------------------------------------------------------------------
// read_source_file
// ---------------------------------------------------------------------------

export async function readSourceFile(
  cfg: FileToolConfig,
  args: { path: string; startLine?: number; endLine?: number; lineNumbers?: boolean },
) {
  const target = await resolveSafePath(args.path, cfg);
  const file = await requireExisting(target, cfg);
  const total = file.doc.lines.length;
  const start = positiveInt("start_line", args.startLine) ?? 1;
  const requestedEnd = positiveInt("end_line", args.endLine);
  if (total > 0 && start > total) {
    throw new FileToolError("INVALID_ARGUMENT", `start_line ${start} is past the end of the file (${total} lines).`);
  }
  if (requestedEnd !== undefined && requestedEnd < start) {
    throw new FileToolError("INVALID_ARGUMENT", "end_line must be >= start_line.");
  }
  const wantedEnd = Math.min(total, requestedEnd ?? total);
  const end = Math.min(wantedEnd, start + cfg.maxReadLines - 1);
  const slice = total === 0 ? [] : file.doc.lines.slice(start - 1, end);
  const truncated = end < wantedEnd;
  return {
    ok: true as const,
    path: target.rel,
    sha256: file.sha,
    total_lines: total,
    start_line: total === 0 ? 0 : start,
    end_line: total === 0 ? 0 : end,
    truncated,
    next_start_line: truncated ? end + 1 : null,
    line_endings: file.mixedEol ? "mixed" : file.doc.eol === "\r\n" ? "CRLF" : "LF",
    final_newline: file.doc.finalNewline,
    content: args.lineNumbers === false ? slice.join("\n") : numberLines(slice, start),
  };
}

// ---------------------------------------------------------------------------
// write_source_file (create or overwrite)
// ---------------------------------------------------------------------------

export async function writeSourceFile(
  cfg: FileToolConfig,
  args: { path: string; content: string; overwrite?: boolean; createDirs?: boolean; preserveLineEndings?: boolean } & MutationOptions,
): Promise<MutationResult> {
  if (typeof args.content !== "string") throw new FileToolError("INVALID_ARGUMENT", "`content` is required.");
  const dryRun = resolveDryRun(cfg, args.dryRun);
  const target = await resolveSafePath(args.path, cfg, { forWrite: true });
  return withLock(target.abs, async () => {
    const before = await loadExisting(target, cfg);
    if (before && !args.overwrite) {
      throw new FileToolError("ALREADY_EXISTS", `File already exists: ${target.rel}`, {
        hint: "Prefer replace_in_source_file / edit_source_file_lines / apply_source_file_patch for edits, or pass overwrite=\"true\" to replace the whole file.",
      });
    }
    checkFresh(before, args.expectedSha256);
    const doc = parseDoc(args.content);
    if (before && args.preserveLineEndings !== false) {
      doc.eol = before.doc.eol;
      doc.bom = before.doc.bom;
    }
    return commit(cfg, target, before, doc, { dryRun, createDirs: args.createDirs ?? true });
  });
}

// ---------------------------------------------------------------------------
// replace_in_source_file (exact string find-and-replace)
// ---------------------------------------------------------------------------

export async function replaceInSourceFile(
  cfg: FileToolConfig,
  args: { path: string; oldString: string; newString: string; replaceAll?: boolean } & MutationOptions,
): Promise<MutationResult> {
  if (typeof args.oldString !== "string" || args.oldString === "") {
    throw new FileToolError("INVALID_ARGUMENT", "`old_string` must be a non-empty string.");
  }
  if (typeof args.newString !== "string") throw new FileToolError("INVALID_ARGUMENT", "`new_string` is required (use \"\" to delete).");
  const oldS = args.oldString.replace(/\r\n/g, "\n");
  const newS = args.newString.replace(/\r\n/g, "\n");
  if (oldS === newS) throw new FileToolError("INVALID_ARGUMENT", "`old_string` and `new_string` are identical.");

  const dryRun = resolveDryRun(cfg, args.dryRun);
  const target = await resolveSafePath(args.path, cfg, { forWrite: true });
  return withLock(target.abs, async () => {
    const before = await requireExisting(target, cfg);
    checkFresh(before, args.expectedSha256);
    const text = toLF(before.doc);

    const positions: number[] = [];
    for (let i = text.indexOf(oldS); i !== -1; i = text.indexOf(oldS, i + oldS.length)) positions.push(i);

    if (positions.length === 0) {
      const needle = oldS.split("\n").map((l) => l.trim());
      const hay = before.doc.lines.map((l) => l.trim());
      let similar: number | null = null;
      for (let i = 0; i + needle.length <= hay.length && similar === null; i++) {
        if (needle.every((l, j) => hay[i + j] === l)) similar = i + 1;
      }
      throw new FileToolError("NO_MATCH", "`old_string` was not found in the file.", {
        hint:
          similar !== null
            ? `A whitespace-insensitive match starts at line ${similar}. Re-read the file and copy the exact text, including indentation.`
            : "Re-read the file with read_source_file; old_string must match the current content exactly (whitespace included, without line-number prefixes).",
      });
    }
    if (positions.length > 1 && !args.replaceAll) {
      throw new FileToolError("MULTIPLE_MATCHES", `\`old_string\` occurs ${positions.length} times.`, {
        hint: "Include more surrounding lines so it is unique, or pass replace_all=\"true\".",
        details: { match_lines: positions.slice(0, 20).map((p) => lineOf(text, p)) },
      });
    }

    const next = args.replaceAll
      ? text.split(oldS).join(newS)
      : text.slice(0, positions[0]) + newS + text.slice(positions[0] + oldS.length);
    const doc: TextDoc = { ...parseDoc(next), eol: before.doc.eol, bom: before.doc.bom };
    const result = await commit(cfg, target, before, doc, { dryRun });
    result.replacements = args.replaceAll ? positions.length : 1;
    result.match_lines = positions.slice(0, 20).map((p) => lineOf(text, p));
    return result;
  });
}

// ---------------------------------------------------------------------------
// edit_source_file_lines (line-range replace / insert / delete)
// ---------------------------------------------------------------------------

export type LineOperation = "replace" | "insert" | "delete";

export async function editSourceFileLines(
  cfg: FileToolConfig,
  args: { path: string; operation: LineOperation; startLine: number; endLine?: number; content?: string } & MutationOptions,
): Promise<MutationResult> {
  const op = args.operation;
  if (op !== "replace" && op !== "insert" && op !== "delete") {
    throw new FileToolError("INVALID_ARGUMENT", "`operation` must be one of: replace, insert, delete.");
  }
  const start = positiveInt("start_line", args.startLine);
  if (start === undefined) throw new FileToolError("INVALID_ARGUMENT", "`start_line` is required.");
  if (op !== "delete" && typeof args.content !== "string") {
    throw new FileToolError("INVALID_ARGUMENT", `\`content\` is required for operation '${op}'.`);
  }

  const dryRun = resolveDryRun(cfg, args.dryRun);
  const target = await resolveSafePath(args.path, cfg, { forWrite: true });
  return withLock(target.abs, async () => {
    const before = await requireExisting(target, cfg);
    checkFresh(before, args.expectedSha256);
    const total = before.doc.lines.length;
    const lines = before.doc.lines.slice();
    const newLines = splitContent(args.content ?? "");
    let affectedEnd: number;

    if (op === "insert") {
      if (start > total + 1) {
        throw new FileToolError("INVALID_ARGUMENT", `For insert, start_line must be between 1 and ${total + 1} (file has ${total} lines; ${total + 1} appends).`);
      }
      lines.splice(start - 1, 0, ...newLines);
      affectedEnd = start + newLines.length - 1;
    } else {
      const end = positiveInt("end_line", args.endLine) ?? start;
      if (start > total || end > total || end < start) {
        throw new FileToolError("INVALID_ARGUMENT", `Line range ${start}-${end} is invalid; the file has ${total} lines.`, {
          hint: "Re-read the file: earlier edits may have shifted line numbers.",
        });
      }
      lines.splice(start - 1, end - start + 1, ...(op === "replace" ? newLines : []));
      affectedEnd = op === "replace" ? start + newLines.length - 1 : start - 1;
    }

    const doc: TextDoc = {
      ...before.doc,
      lines,
      finalNewline: lines.length > 0 && (total === 0 ? true : before.doc.finalNewline),
    };
    const result = await commit(cfg, target, before, doc, { dryRun });
    result.total_lines = lines.length;
    result.line_delta = lines.length - total;
    result.preview = previewAround(doc, start, Math.max(start, affectedEnd));
    return result;
  });
}

// ---------------------------------------------------------------------------
// apply_source_file_patch (unified diff)
// ---------------------------------------------------------------------------

export async function applySourceFilePatch(
  cfg: FileToolConfig,
  args: { path: string; patch: string } & MutationOptions,
): Promise<MutationResult> {
  const hunks = parsePatch(args.patch);
  const dryRun = resolveDryRun(cfg, args.dryRun);
  const target = await resolveSafePath(args.path, cfg, { forWrite: true });
  return withLock(target.abs, async () => {
    const before = await loadExisting(target, cfg);
    if (!before && hunks.some((h) => h.lines.some((l) => l.kind !== "+"))) {
      throw new FileToolError("NOT_FOUND", `File not found: ${target.rel}`, {
        hint: "A patch can only create a new file if it contains nothing but '+' lines.",
      });
    }
    checkFresh(before, args.expectedSha256);
    const baseDoc: TextDoc = before?.doc ?? { lines: [], eol: "\n", finalNewline: true, bom: false };
    const { lines, placements } = applyHunks(withSentinel(baseDoc), hunks);
    const doc = fromSentinel(lines, baseDoc);
    const result = await commit(cfg, target, before, doc, { dryRun, createDirs: true });
    result.hunks_applied = placements.length;
    result.placements = placements;
    return result;
  });
}

// ---------------------------------------------------------------------------
// restore_source_file_backup
// ---------------------------------------------------------------------------

export interface BackupListResult {
  ok: true;
  path: string;
  backups: BackupInfo[];
}

type RestoreArgs = { path: string; backupId?: string } & MutationOptions;

export async function restoreSourceFileBackup(
  cfg: FileToolConfig,
  args: RestoreArgs & { listOnly: true },
): Promise<BackupListResult>;
export async function restoreSourceFileBackup(
  cfg: FileToolConfig,
  args: RestoreArgs & { listOnly?: false },
): Promise<MutationResult>;
export async function restoreSourceFileBackup(
  cfg: FileToolConfig,
  args: RestoreArgs & { listOnly?: boolean },
): Promise<BackupListResult | MutationResult>;
export async function restoreSourceFileBackup(
  cfg: FileToolConfig,
  args: RestoreArgs & { listOnly?: boolean },
): Promise<BackupListResult | MutationResult> {
  const target = await resolveSafePath(args.path, cfg);
  const backups = await listBackups(cfg, target.abs);
  if (args.listOnly) return { ok: true as const, path: target.rel, backups };
  if (!backups.length) throw new FileToolError("NO_BACKUP", `No backups exist for ${target.rel}.`);

  const id = args.backupId?.trim() || backups[0].backup_id;
  const dryRun = resolveDryRun(cfg, args.dryRun);
  await resolveSafePath(args.path, cfg, { forWrite: true });
  return withLock(target.abs, async () => {
    const raw = await readBackup(cfg, target.abs, id);
    const before = await loadExisting(target, cfg);
    checkFresh(before, args.expectedSha256);
    const doc = parseDoc(decodeUtf8(raw));
    const result = await commit(cfg, target, before, doc, { dryRun, createDirs: true, afterRaw: raw });
    result.restored_backup_id = id;
    return result;
  });
}

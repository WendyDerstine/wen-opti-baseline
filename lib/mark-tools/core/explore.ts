import fs from "node:fs/promises";
import path from "node:path";
import type { FileToolConfig } from "../config.ts";
import { FileToolError } from "./errors.ts";
import { isDenied, isInside, pathGlob, resolveSafePath } from "./paths.ts";
import { isProbablyBinary } from "./text.ts";

export interface Entry {
  path: string;
  type: "file" | "dir";
  bytes?: number;
}

interface WalkOptions {
  maxDepth: number;
  maxEntries: number;
  include?: RegExp;
  filesOnly?: boolean;
}

/**
 * Breadth-first walk under `start`, never following symlinks, never entering
 * deny-listed segments or the backup folder.
 */
async function walk(cfg: FileToolConfig, startAbs: string, startRel: string, opts: WalkOptions) {
  const entries: Entry[] = [];
  let truncated = false;
  let queue: { abs: string; rel: string }[] = [{ abs: startAbs, rel: startRel }];
  for (let depth = 1; depth <= opts.maxDepth && queue.length && !truncated; depth++) {
    const next: typeof queue = [];
    for (const dir of queue) {
      let dirents;
      try {
        dirents = await fs.readdir(dir.abs, { withFileTypes: true });
      } catch {
        continue;
      }
      dirents.sort((a, b) => a.name.localeCompare(b.name));
      for (const d of dirents) {
        const rel = dir.rel ? `${dir.rel}/${d.name}` : d.name;
        const abs = path.join(dir.abs, d.name);
        if (isDenied(rel, cfg) !== undefined || isInside(abs, cfg.backupDir)) continue;
        if (d.isSymbolicLink()) continue;
        if (d.isDirectory()) {
          next.push({ abs, rel });
          if (!opts.filesOnly && (!opts.include || opts.include.test(rel))) entries.push({ path: `${rel}/`, type: "dir" });
        } else if (d.isFile()) {
          if (opts.include && !opts.include.test(rel)) continue;
          const st = await fs.stat(abs).catch(() => null);
          entries.push({ path: rel, type: "file", bytes: st?.size });
        }
        if (entries.length >= opts.maxEntries) {
          truncated = true;
          break;
        }
      }
      if (truncated) break;
    }
    queue = next;
  }
  return { entries, truncated, unexplored: !truncated && queue.length > 0 };
}

function clampInt(name: string, v: number | undefined, dflt: number, max: number): number {
  if (v === undefined) return dflt;
  if (!Number.isInteger(v) || v < 1) throw new FileToolError("INVALID_ARGUMENT", `\`${name}\` must be a whole number >= 1.`);
  return Math.min(v, max);
}

function compileInclude(glob: string | undefined): RegExp | undefined {
  if (!glob?.trim()) return undefined;
  const g = glob.trim();
  // A bare pattern like "*.tsx" should match at any depth.
  return pathGlob(g.includes("/") ? g : `**/${g}`);
}

async function resolveDir(cfg: FileToolConfig, input: string | undefined) {
  const target = await resolveSafePath(input ?? "", cfg, { allowDirectory: true });
  const st = await fs.stat(target.abs).catch(() => null);
  if (!st) throw new FileToolError("NOT_FOUND", `Directory not found: ${target.rel || "."}`);
  if (!st.isDirectory()) throw new FileToolError("INVALID_ARGUMENT", `Not a directory: ${target.rel}`, { hint: "Use read_source_file for files." });
  return target;
}

// ---------------------------------------------------------------------------
// list_source_files
// ---------------------------------------------------------------------------

export async function listSourceFiles(
  cfg: FileToolConfig,
  args: { path?: string; depth?: number; pattern?: string; maxEntries?: number },
) {
  const dir = await resolveDir(cfg, args.path);
  const include = compileInclude(args.pattern);
  // With a pattern we are looking for files, so search deep by default.
  const depth = clampInt("depth", args.depth, include ? 10 : 2, 10);
  const maxEntries = clampInt("max_entries", args.maxEntries, 300, 2000);
  const { entries, truncated, unexplored } = await walk(cfg, dir.abs, dir.rel, {
    maxDepth: depth,
    maxEntries,
    include,
    filesOnly: Boolean(include),
  });
  return {
    ok: true as const,
    path: dir.rel || ".",
    depth,
    count: entries.length,
    truncated,
    deeper_levels_not_shown: unexplored,
    entries,
  };
}

// ---------------------------------------------------------------------------
// search_source_files
// ---------------------------------------------------------------------------

const MAX_LINE_FOR_REGEX = 2000;
const MAX_SNIPPET = 240;

export async function searchSourceFiles(
  cfg: FileToolConfig,
  args: { query: string; path?: string; include?: string; isRegex?: boolean; caseSensitive?: boolean; maxResults?: number },
) {
  if (typeof args.query !== "string" || args.query === "") {
    throw new FileToolError("INVALID_ARGUMENT", "`query` must be a non-empty string.");
  }
  if (args.query.length > 500) throw new FileToolError("INVALID_ARGUMENT", "`query` is too long (max 500 characters).");
  const dir = await resolveDir(cfg, args.path);
  const maxResults = clampInt("max_results", args.maxResults, 100, 500);
  const flags = args.caseSensitive ? "" : "i";
  let re: RegExp;
  try {
    re = args.isRegex
      ? new RegExp(args.query, flags)
      : new RegExp(args.query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), flags);
  } catch (err) {
    throw new FileToolError("INVALID_ARGUMENT", `Invalid regular expression: ${(err as Error).message}`);
  }

  const { entries, truncated: walkTruncated } = await walk(cfg, dir.abs, dir.rel, {
    maxDepth: 25,
    maxEntries: 20000,
    include: compileInclude(args.include),
    filesOnly: true,
  });

  const matches: { path: string; line: number; text: string }[] = [];
  let filesScanned = 0;
  let filesWithMatches = 0;
  for (const e of entries) {
    if (matches.length >= maxResults) break;
    if ((e.bytes ?? 0) > cfg.maxBytes) continue;
    const buf = await fs.readFile(path.join(dir.root, e.path)).catch(() => null);
    if (!buf || isProbablyBinary(buf)) continue;
    filesScanned++;
    const lines = buf.toString("utf8").split(/\r?\n/);
    let hit = false;
    for (let i = 0; i < lines.length && matches.length < maxResults; i++) {
      const line = lines[i];
      if (args.isRegex && line.length > MAX_LINE_FOR_REGEX) continue;
      if (re.test(line)) {
        hit = true;
        const t = line.trim();
        matches.push({ path: e.path, line: i + 1, text: t.length > MAX_SNIPPET ? `${t.slice(0, MAX_SNIPPET)}…` : t });
      }
    }
    if (hit) filesWithMatches++;
  }
  return {
    ok: true as const,
    query: args.query,
    path: dir.rel || ".",
    files_scanned: filesScanned,
    files_with_matches: filesWithMatches,
    count: matches.length,
    truncated: matches.length >= maxResults || walkTruncated,
    matches,
  };
}

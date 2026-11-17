import fs from "node:fs/promises";
import path from "node:path";
import type { FileToolConfig } from "../config.ts";
import { FileToolError } from "./errors.ts";

export interface ResolvedPath {
  /** Real absolute path (symlinks resolved; may not exist yet). */
  abs: string;
  /** The allow-listed root that contains it. */
  root: string;
  /** POSIX-style path relative to that root ("" for the root itself). */
  rel: string;
}

export interface ResolveOptions {
  /** The caller intends to write: enforce read-only paths. */
  forWrite?: boolean;
  /** Directories are acceptable (listing / searching). */
  allowDirectory?: boolean;
}

export function isInside(child: string, parent: string): boolean {
  const r = path.relative(parent, child);
  return r === "" || (r !== ".." && !r.startsWith(`..${path.sep}`) && !path.isAbsolute(r));
}

function findRoot(p: string, roots: string[]): string | undefined {
  return roots.filter((root) => isInside(p, root)).sort((a, b) => b.length - a.length)[0];
}

/** realpath() that tolerates a not-yet-existing tail (for new files). */
async function realpathAllowMissing(p: string): Promise<string> {
  const rest: string[] = [];
  let cur = p;
  for (;;) {
    try {
      const real = await fs.realpath(cur);
      return path.join(real, ...rest.reverse());
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code !== "ENOENT" && code !== "ENOTDIR") throw err;
      const parent = path.dirname(cur);
      if (parent === cur) throw err;
      rest.push(path.basename(cur));
      cur = parent;
    }
  }
}

const escapeRe = (c: string) => c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
const caseFlag = process.platform === "win32" || process.platform === "darwin" ? "i" : "";

/** Glob for a single path segment: * and ?. */
export function segmentGlob(glob: string): RegExp {
  const src = glob
    .split("")
    .map((c) => (c === "*" ? ".*" : c === "?" ? "." : escapeRe(c)))
    .join("");
  return new RegExp(`^${src}$`, caseFlag);
}

/** Glob for a project-relative path: ** spans directories, * and ? stay in one segment. */
export function pathGlob(glob: string): RegExp {
  let src = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*" && glob[i + 1] === "*") {
      const slash = glob[i + 2] === "/";
      src += slash ? "(?:.*/)?" : ".*";
      i += slash ? 2 : 1;
    } else if (c === "*") src += "[^/]*";
    else if (c === "?") src += "[^/]";
    else src += escapeRe(c);
  }
  return new RegExp(`^${src}$`, caseFlag);
}

export function isDenied(rel: string, cfg: FileToolConfig): string | undefined {
  const res = cfg.deny.map(segmentGlob);
  return rel
    .split("/")
    .find((seg) => seg !== "" && !cfg.denyExceptions.includes(seg) && res.some((re) => re.test(seg)));
}

export function isReadOnlyPath(rel: string, cfg: FileToolConfig): string | undefined {
  return cfg.readOnlyPaths.find((g) => pathGlob(g).test(rel));
}

/**
 * Resolve a caller-supplied path and enforce the safety policy:
 * the project root (checked lexically AND after resolving symlinks),
 * deny-listed segments, read-only paths for writes, the optional extension
 * allow-list, and never the backup dir.
 */
export async function resolveSafePath(
  input: unknown,
  cfg: FileToolConfig,
  opts: ResolveOptions = {},
): Promise<ResolvedPath> {
  if (typeof input !== "string" || (input.trim() === "" && !opts.allowDirectory)) {
    throw new FileToolError("INVALID_ARGUMENT", "`path` is required.");
  }
  if (input.includes("\0")) throw new FileToolError("INVALID_ARGUMENT", "`path` contains a NUL byte.");

  const trimmed = input.trim() || ".";
  const candidate = path.isAbsolute(trimmed) ? path.resolve(trimmed) : path.resolve(cfg.roots[0], trimmed);
  const notAllowed = (why: string, hint?: string) =>
    new FileToolError("PATH_NOT_ALLOWED", why, {
      hint: hint ?? "Use a path relative to the project root, e.g. 'app/layout.tsx'.",
    });

  if (!findRoot(candidate, cfg.roots)) throw notAllowed(`Path is outside the project root: ${trimmed}`);

  const real = await realpathAllowMissing(candidate);
  const root = findRoot(real, cfg.roots);
  if (!root) throw notAllowed(`Path resolves (via a symlink) outside the project root: ${trimmed}`);

  const rel = path.relative(root, real).split(path.sep).join("/");
  if (rel === "" && !opts.allowDirectory) {
    throw new FileToolError("NOT_A_FILE", "Path points at the project root, not a file.");
  }
  if (isInside(real, cfg.backupDir)) throw notAllowed("The backup directory cannot be accessed directly.");

  const denied = isDenied(rel, cfg);
  if (denied !== undefined) throw notAllowed(`Access to '${denied}' is blocked by the deny-list.`);

  if (opts.forWrite) {
    const ro = isReadOnlyPath(rel, cfg);
    if (ro) {
      throw notAllowed(`'${rel}' is read-only for agents (matches '${ro}').`, "Edit this file by hand, or change MARK_TOOLS_READ_ONLY_PATHS.");
    }
  }

  if (cfg.allowedExtensions.length && !opts.allowDirectory) {
    const ext = path.extname(real).toLowerCase();
    if (!cfg.allowedExtensions.includes(ext)) {
      throw notAllowed(`Extension '${ext || "(none)"}' is not allowed. Allowed: ${cfg.allowedExtensions.join(", ")}`);
    }
  }

  return { abs: real, root, rel };
}

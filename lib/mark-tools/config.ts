import fs from "node:fs";
import path from "node:path";

/**
 * Configuration for the Mark source-file tools.
 *
 * The tools are scoped to ONE directory: the project root (process.cwd() when
 * you run `npm run dev`). Every project cloned from opti-baseline gets the same
 * behaviour with zero code changes, and only its own files are reachable.
 */
export interface FileToolConfig {
  /** Real (symlink-resolved) absolute roots. Index 0 is the project root. */
  roots: string[];
  backupDir: string;
  backupKeep: number;
  backupsEnabled: boolean;
  maxBytes: number;
  /** Path segments that can never be read or written (glob: * and ?). */
  deny: string[];
  /** Exact file names exempt from the deny-list (e.g. .env.example holds no secrets). */
  denyExceptions: string[];
  /** Project-relative globs that can be read but never written (supports **). */
  readOnlyPaths: string[];
  /** Lower-case extensions including the dot; empty = any extension. */
  allowedExtensions: string[];
  readOnly: boolean;
  defaultDryRun: boolean;
  maxReadLines: number;
  maxDiffChars: number;
}

/** Never reachable: VCS internals, dependencies, build output, secrets, the backup folder. */
export const DEFAULT_DENY = [
  ".git",
  "node_modules",
  ".next",
  ".vercel",
  ".yarn",
  ".mark-tools",
  ".env",
  ".env.*",
  "*.pem",
  "*.key",
  "id_rsa*",
  ".ssh",
];

/** Templates that match `.env.*` but contain no secrets. */
export const DEFAULT_DENY_EXCEPTIONS = [".env.example", ".env.sample", ".env.template"];

/**
 * Readable but not writable by default. The tools' own code is protected so an
 * agent can't switch off its own guardrails, and lockfiles should only change
 * through the package manager.
 */
export const DEFAULT_READ_ONLY = [
  "lib/mark-tools/**",
  "app/api/mark-tools/**",
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
];

const list = (v: string | undefined): string[] =>
  (v ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

const bool = (v: string | undefined, dflt: boolean): boolean =>
  v === undefined || v.trim() === "" ? dflt : /^(1|true|yes|on)$/i.test(v.trim());

const int = (v: string | undefined, dflt: number): number => {
  const n = Number.parseInt(v ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : dflt;
};

/** Build a config, resolving roots to real paths (fails fast if missing). */
export function makeConfig(partial: Partial<FileToolConfig> & { roots: string[] }): FileToolConfig {
  if (!partial.roots.length) throw new Error("At least one root directory is required.");
  const roots = partial.roots.map((r) => {
    const real = fs.realpathSync(path.resolve(r));
    if (!fs.statSync(real).isDirectory()) throw new Error(`Root is not a directory: ${r}`);
    return real;
  });
  return {
    roots,
    backupDir: path.resolve(partial.backupDir ?? path.join(roots[0], ".mark-tools", "backups")),
    backupKeep: partial.backupKeep ?? 20,
    backupsEnabled: partial.backupsEnabled ?? true,
    maxBytes: partial.maxBytes ?? 1024 * 1024,
    deny: partial.deny ?? DEFAULT_DENY,
    denyExceptions: partial.denyExceptions ?? DEFAULT_DENY_EXCEPTIONS,
    readOnlyPaths: partial.readOnlyPaths ?? DEFAULT_READ_ONLY,
    allowedExtensions: (partial.allowedExtensions ?? []).map((e) =>
      (e.startsWith(".") ? e : `.${e}`).toLowerCase(),
    ),
    readOnly: partial.readOnly ?? false,
    defaultDryRun: partial.defaultDryRun ?? false,
    maxReadLines: partial.maxReadLines ?? 2000,
    maxDiffChars: partial.maxDiffChars ?? 20000,
  };
}

/** Read MARK_TOOLS_* environment variables. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): FileToolConfig {
  const root = env.MARK_TOOLS_ROOT?.trim() || process.cwd();
  const extraDeny = list(env.MARK_TOOLS_DENY);
  const extraReadOnly = list(env.MARK_TOOLS_READ_ONLY_PATHS);
  return makeConfig({
    roots: [root],
    backupDir: env.MARK_TOOLS_BACKUP_DIR?.trim() || undefined,
    backupKeep: int(env.MARK_TOOLS_BACKUP_KEEP, 20),
    backupsEnabled: bool(env.MARK_TOOLS_BACKUPS, true),
    maxBytes: int(env.MARK_TOOLS_MAX_BYTES, 1024 * 1024),
    deny: [...DEFAULT_DENY, ...extraDeny],
    readOnlyPaths: [...DEFAULT_READ_ONLY, ...extraReadOnly],
    allowedExtensions: list(env.MARK_TOOLS_ALLOWED_EXTENSIONS),
    readOnly: bool(env.MARK_TOOLS_READ_ONLY, false),
    defaultDryRun: bool(env.MARK_TOOLS_DEFAULT_DRY_RUN, false),
    maxReadLines: int(env.MARK_TOOLS_MAX_READ_LINES, 2000),
  });
}

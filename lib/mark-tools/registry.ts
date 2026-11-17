import type { FileToolConfig } from "./config.ts";
import { FileToolError } from "./core/errors.ts";
import { listSourceFiles, searchSourceFiles } from "./core/explore.ts";
import {
  applySourceFilePatch,
  editSourceFileLines,
  readSourceFile,
  replaceInSourceFile,
  restoreSourceFileBackup,
  writeSourceFile,
  type LineOperation,
} from "./core/fileOps.ts";

/**
 * Tool definitions, independent of any web framework.
 *
 * The discovery manifest mirrors what @optimizely-opal/opal-tools-sdk emits
 * (Function.toJSON / Parameter.toJSON in the SDK's models.js), so Mark sees
 * exactly the same contract as an SDK-built tool service. Every parameter is
 * declared as a string because Mark sends tool arguments as strings; handlers
 * also accept native JSON booleans/numbers.
 */

export interface ParamDef {
  name: string;
  type: "string";
  description: string;
  required: boolean;
}

type Params = Record<string, unknown>;

export interface ToolDef {
  name: string;
  description: string;
  parameters: ParamDef[];
  run: (cfg: FileToolConfig, p: Params) => Promise<unknown>;
}

// ---------------------------------------------------------------- parsing --

const toBool = (name: string, v: unknown): boolean | undefined => {
  if (v === undefined || v === null || v === "") return undefined;
  if (typeof v === "boolean") return v;
  const s = String(v).trim().toLowerCase();
  if (["true", "yes", "1"].includes(s)) return true;
  if (["false", "no", "0"].includes(s)) return false;
  throw new FileToolError("INVALID_ARGUMENT", `\`${name}\` must be "true" or "false".`);
};

const toInt = (name: string, v: unknown): number | undefined => {
  if (v === undefined || v === null || v === "") return undefined;
  const n = typeof v === "number" ? v : Number(String(v).trim());
  if (!Number.isInteger(n)) throw new FileToolError("INVALID_ARGUMENT", `\`${name}\` must be a whole number.`);
  return n;
};

const str = (v: unknown): string | undefined => (v === undefined || v === null ? undefined : String(v));
const req = (v: unknown): string => (v === undefined || v === null ? "" : String(v));

const p = (name: string, description: string, required = false): ParamDef => ({ name, type: "string", description, required });

const PATH = p("path", "File path relative to the project root, e.g. 'app/layout.tsx' or 'cms/components/Hero.tsx'.", true);
const SHA = p(
  "expected_sha256",
  "Optional but strongly recommended: the sha256 from your last read/edit of this file. If the file changed since, the edit is refused (STALE_FILE) instead of overwriting someone else's work.",
);
const DRY = p("dry_run", 'Optional "true" or "false" (default "false"). "true" returns the diff without writing anything.');

// ------------------------------------------------------------ definitions --

export const TOOL_DEFS: ToolDef[] = [
  {
    name: "list_source_files",
    description:
      "List files and folders in this project (scoped to the project root). Use it to find where things live before reading or editing. " +
      "Skips .git, node_modules, .next, .env files and other blocked paths. pattern filters files by glob (e.g. '*.tsx' or 'cms/**/*.ts').",
    parameters: [
      p("path", "Optional folder relative to the project root (default: the root)."),
      p("depth", "Optional folder depth to descend, 1-10 (default 2, or 10 when pattern is given)."),
      p("pattern", "Optional file glob: '*' within a folder, '**' across folders. A bare '*.tsx' matches at any depth."),
      p("max_entries", "Optional maximum number of entries to return (default 300, max 2000)."),
    ],
    run: (cfg, a) =>
      listSourceFiles(cfg, {
        path: str(a.path),
        depth: toInt("depth", a.depth),
        pattern: str(a.pattern),
        maxEntries: toInt("max_entries", a.max_entries),
      }),
  },
  {
    name: "search_source_files",
    description:
      "Search file contents in this project (like grep). Returns matching lines with file path and 1-based line number, ready for read_source_file or edit_source_file_lines. " +
      "Plain-text search by default; set is_regex=\"true\" for a JavaScript regular expression.",
    parameters: [
      p("query", "Text (or regex when is_regex=\"true\") to search for.", true),
      p("path", "Optional folder to search, relative to the project root (default: the root)."),
      p("include", "Optional file glob to limit the search, e.g. '*.tsx' or 'app/**/*.ts'."),
      p("is_regex", 'Optional "true" or "false" (default "false").'),
      p("case_sensitive", 'Optional "true" or "false" (default "false").'),
      p("max_results", "Optional maximum matching lines (default 100, max 500)."),
    ],
    run: (cfg, a) =>
      searchSourceFiles(cfg, {
        query: req(a.query),
        path: str(a.path),
        include: str(a.include),
        isRegex: toBool("is_regex", a.is_regex),
        caseSensitive: toBool("case_sensitive", a.case_sensitive),
        maxResults: toInt("max_results", a.max_results),
      }),
  },
  {
    name: "read_source_file",
    description:
      "Read a UTF-8 source/text file from this project. Returns content with line-number prefixes (`N<TAB>line`), total_lines, and a sha256 to pass to edit tools as expected_sha256. " +
      "Large files are paged; when truncated=true call again with start_line=next_start_line. Always read a file before editing it. " +
      "The line-number prefixes are NOT part of the file: never include them in old_string or patches.",
    parameters: [
      PATH,
      p("start_line", "Optional 1-based first line to return (default 1)."),
      p("end_line", "Optional 1-based last line to return, inclusive (default: end of file)."),
      p("line_numbers", 'Optional "true" or "false" (default "true"): prefix each line with its number.'),
    ],
    run: (cfg, a) =>
      readSourceFile(cfg, {
        path: req(a.path),
        startLine: toInt("start_line", a.start_line),
        endLine: toInt("end_line", a.end_line),
        lineNumbers: toBool("line_numbers", a.line_numbers),
      }),
  },
  {
    name: "replace_in_source_file",
    description:
      "Edit a file by exact string find-and-replace. old_string must match the current content EXACTLY (whitespace and indentation included) and occur exactly once, " +
      "otherwise the edit fails with NO_MATCH or MULTIPLE_MATCHES and nothing is written. Include 2-3 surrounding lines to make it unique, or set replace_all=\"true\". " +
      "Use new_string=\"\" to delete. Preferred tool for small, targeted edits. Returns a unified diff and the new sha256.",
    parameters: [
      PATH,
      p("old_string", "Exact text to find (from read_source_file output WITHOUT the line-number prefixes).", true),
      p("new_string", "Replacement text. Use an empty string to delete old_string.", true),
      p("replace_all", 'Optional "true" or "false" (default "false"): replace every occurrence.'),
      SHA,
      DRY,
    ],
    run: (cfg, a) =>
      replaceInSourceFile(cfg, {
        path: req(a.path),
        oldString: req(a.old_string),
        newString: req(a.new_string),
        replaceAll: toBool("replace_all", a.replace_all),
        expectedSha256: str(a.expected_sha256),
        dryRun: toBool("dry_run", a.dry_run),
      }),
  },
  {
    name: "edit_source_file_lines",
    description:
      "Edit a file by 1-based line numbers. operation=\"replace\" replaces start_line..end_line with content; \"insert\" inserts content BEFORE start_line (total_lines+1 appends); " +
      "\"delete\" removes start_line..end_line. Line numbers shift after every edit: re-read (or use the returned preview) before another line edit, and pass expected_sha256. " +
      "Returns a diff, a numbered preview of the edited region and the new sha256.",
    parameters: [
      PATH,
      p("operation", 'One of "replace", "insert", "delete".', true),
      p("start_line", "1-based line where the operation starts.", true),
      p("end_line", "1-based last line (inclusive) for replace/delete. Defaults to start_line."),
      p("content", "New lines for replace/insert (no line-number prefixes)."),
      SHA,
      DRY,
    ],
    run: (cfg, a) =>
      editSourceFileLines(cfg, {
        path: req(a.path),
        operation: req(a.operation).trim().toLowerCase() as LineOperation,
        startLine: toInt("start_line", a.start_line) as number,
        endLine: toInt("end_line", a.end_line),
        content: str(a.content),
        expectedSha256: str(a.expected_sha256),
        dryRun: toBool("dry_run", a.dry_run),
      }),
  },
  {
    name: "apply_source_file_patch",
    description:
      "Apply a unified diff to ONE file. Hunks start with '@@ -old,count +new,count @@' (or a bare '@@'); lines start with ' ' (context), '-' (remove) or '+' (add). " +
      "Context and '-' lines must equal the current content. A hunk applies at its header's line, otherwise at the single other place its lines occur; " +
      "if it matches nowhere or in several places the whole patch is refused and nothing is written. Best for several separate edits in one file. " +
      "A patch of only '+' lines can create a new file.",
    parameters: [
      PATH,
      p("patch", "Unified diff text for this single file. '---'/'+++' header lines are optional.", true),
      SHA,
      DRY,
    ],
    run: (cfg, a) =>
      applySourceFilePatch(cfg, {
        path: req(a.path),
        patch: req(a.patch),
        expectedSha256: str(a.expected_sha256),
        dryRun: toBool("dry_run", a.dry_run),
      }),
  },
  {
    name: "write_source_file",
    description:
      "Create a new file in this project, or replace an existing file's entire content (only with overwrite=\"true\"). " +
      "For changes to existing files prefer replace_in_source_file, edit_source_file_lines or apply_source_file_patch. " +
      "Existing files keep their line endings and BOM; a backup is taken before every overwrite. Returns a unified diff and the new sha256.",
    parameters: [
      PATH,
      p("content", "The complete file content.", true),
      p("overwrite", 'Optional "true" or "false" (default "false"). Must be "true" to replace an existing file.'),
      p("create_dirs", 'Optional "true" or "false" (default "true"): create missing parent folders.'),
      SHA,
      DRY,
    ],
    run: (cfg, a) =>
      writeSourceFile(cfg, {
        path: req(a.path),
        content: str(a.content) as string,
        overwrite: toBool("overwrite", a.overwrite),
        createDirs: toBool("create_dirs", a.create_dirs),
        expectedSha256: str(a.expected_sha256),
        dryRun: toBool("dry_run", a.dry_run),
      }),
  },
  {
    name: "restore_source_file_backup",
    description:
      "Undo: restore a file from the automatic backups taken before each write. list_only=\"true\" just lists backups (newest first). " +
      "Without backup_id it restores the most recent one. The restore itself is backed up, so it can be undone too.",
    parameters: [
      PATH,
      p("backup_id", "Optional backup id (from list_only output or an edit's backup_id). Defaults to the newest."),
      p("list_only", 'Optional "true" or "false" (default "false").'),
      SHA,
      DRY,
    ],
    run: (cfg, a) =>
      restoreSourceFileBackup(cfg, {
        path: req(a.path),
        backupId: str(a.backup_id),
        listOnly: toBool("list_only", a.list_only),
        expectedSha256: str(a.expected_sha256),
        dryRun: toBool("dry_run", a.dry_run),
      }),
  },
];

/** Discovery manifest, same JSON shape as the Opal Tools SDK's /discovery. */
export function buildManifest(prefix: string, basePath: string) {
  return {
    functions: TOOL_DEFS.map((t) => ({
      description: t.description,
      endpoint: `${basePath}/tools/${prefix}${t.name}`,
      http_method: "POST",
      name: `${prefix}${t.name}`,
      parameters: t.parameters.map((x) => ({
        description: x.description,
        name: x.name,
        required: x.required,
        type: x.type,
      })),
    })),
  };
}

export function findTool(prefix: string, name: string): ToolDef | undefined {
  if (prefix && !name.startsWith(prefix)) return undefined;
  const base = name.slice(prefix.length);
  return TOOL_DEFS.find((t) => t.name === base);
}

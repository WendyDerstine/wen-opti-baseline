import { FileToolError } from "./errors.ts";
import { NOEOL } from "./text.ts";

// ---------------------------------------------------------------------------
// Line diff (Myers O(ND)) + unified diff output
// ---------------------------------------------------------------------------

export interface DiffOp {
  type: "equal" | "delete" | "insert";
  line: string;
}

/** Above this edit distance we fall back to "delete all, insert all". */
const MAX_EDIT_DISTANCE = 4000;

const eq = (line: string): DiffOp => ({ type: "equal", line });
const del = (line: string): DiffOp => ({ type: "delete", line });
const ins = (line: string): DiffOp => ({ type: "insert", line });

export function diffLines(a: readonly string[], b: readonly string[]): DiffOp[] {
  let pre = 0;
  while (pre < a.length && pre < b.length && a[pre] === b[pre]) pre++;
  let ea = a.length;
  let eb = b.length;
  while (ea > pre && eb > pre && a[ea - 1] === b[eb - 1]) {
    ea--;
    eb--;
  }
  const out: DiffOp[] = [];
  for (let i = 0; i < pre; i++) out.push(eq(a[i]));
  for (const op of myers(a.slice(pre, ea), b.slice(pre, eb))) out.push(op);
  for (let i = ea; i < a.length; i++) out.push(eq(a[i]));
  return out;
}

function myers(a: readonly string[], b: readonly string[]): DiffOp[] {
  const n = a.length;
  const m = b.length;
  if (n === 0) return b.map(ins);
  if (m === 0) return a.map(del);
  const max = n + m;
  const limit = Math.min(max, MAX_EDIT_DISTANCE);
  const off = max + 1;
  const v = new Int32Array(2 * max + 3);
  const trace: Int32Array[] = [];
  for (let d = 0; d <= limit; d++) {
    // Snapshot of the furthest-reaching x per diagonal k in [-d, d] before step d.
    trace.push(v.slice(off - d, off + d + 1));
    for (let k = -d; k <= d; k += 2) {
      let x = k === -d || (k !== d && v[off + k - 1] < v[off + k + 1]) ? v[off + k + 1] : v[off + k - 1] + 1;
      let y = x - k;
      while (x < n && y < m && a[x] === b[y]) {
        x++;
        y++;
      }
      v[off + k] = x;
      if (x >= n && y >= m) return backtrack(a, b, trace, n, m);
    }
  }
  return [...a.map(del), ...b.map(ins)];
}

function backtrack(a: readonly string[], b: readonly string[], trace: Int32Array[], n: number, m: number): DiffOp[] {
  const out: DiffOp[] = [];
  let x = n;
  let y = m;
  for (let d = trace.length - 1; d >= 0; d--) {
    if (d === 0) {
      while (x > 0 && y > 0) {
        out.push(eq(a[x - 1]));
        x--;
        y--;
      }
      break;
    }
    const snap = trace[d];
    const get = (kk: number) => snap[kk + d];
    const k = x - y;
    const prevK = k === -d || (k !== d && get(k - 1) < get(k + 1)) ? k + 1 : k - 1;
    const prevX = get(prevK);
    const prevY = prevX - prevK;
    while (x > prevX && y > prevY) {
      out.push(eq(a[x - 1]));
      x--;
      y--;
    }
    if (x === prevX) out.push(ins(b[y - 1]));
    else out.push(del(a[x - 1]));
    x = prevX;
    y = prevY;
  }
  return out.reverse();
}

export interface UnifiedDiff {
  text: string;
  added: number;
  removed: number;
}

const fmtRange = (start0: number, count: number): string =>
  count === 0 ? `${start0},0` : count === 1 ? `${start0 + 1}` : `${start0 + 1},${count}`;

/** Lines may carry the NOEOL sentinel; it is rendered as `\ No newline at end of file`. */
export function unifiedDiff(
  oldLines: readonly string[],
  newLines: readonly string[],
  opts: { oldName: string; newName: string; context?: number },
): UnifiedDiff {
  const ctx = opts.context ?? 3;
  const ops = diffLines(oldLines, newLines);
  const ann: { op: DiffOp; oi: number; ni: number }[] = [];
  let oi = 0;
  let ni = 0;
  let added = 0;
  let removed = 0;
  const changes: number[] = [];
  ops.forEach((op, i) => {
    ann.push({ op, oi, ni });
    if (op.type !== "insert") oi++;
    if (op.type !== "delete") ni++;
    if (op.type === "insert") added++;
    if (op.type === "delete") removed++;
    if (op.type !== "equal") changes.push(i);
  });
  if (!changes.length) return { text: "", added: 0, removed: 0 };

  const last = ann.length - 1;
  const ranges: [number, number][] = [];
  let s = Math.max(0, changes[0] - ctx);
  let e = Math.min(last, changes[0] + ctx);
  for (const ci of changes.slice(1)) {
    if (ci - ctx <= e + 1) e = Math.min(last, ci + ctx);
    else {
      ranges.push([s, e]);
      s = Math.max(0, ci - ctx);
      e = Math.min(last, ci + ctx);
    }
  }
  ranges.push([s, e]);

  const out: string[] = [`--- ${opts.oldName}`, `+++ ${opts.newName}`];
  for (const [rs, re] of ranges) {
    let oc = 0;
    let nc = 0;
    const body: string[] = [];
    for (let i = rs; i <= re; i++) {
      const { op } = ann[i];
      if (op.type !== "insert") oc++;
      if (op.type !== "delete") nc++;
      const prefix = op.type === "equal" ? " " : op.type === "delete" ? "-" : "+";
      const noeol = op.line.endsWith(NOEOL);
      body.push(prefix + (noeol ? op.line.slice(0, -NOEOL.length) : op.line));
      if (noeol) body.push("\\ No newline at end of file");
    }
    out.push(`@@ -${fmtRange(ann[rs].oi, oc)} +${fmtRange(ann[rs].ni, nc)} @@`, ...body);
  }
  return { text: `${out.join("\n")}\n`, added, removed };
}

// ---------------------------------------------------------------------------
// Unified diff parsing + application
// ---------------------------------------------------------------------------

export interface PatchLine {
  kind: " " | "-" | "+";
  text: string;
}

export interface Hunk {
  header: string;
  oldStart: number | null;
  oldCount: number | null;
  lines: PatchLine[];
}

export interface HunkPlacement {
  hunk: number;
  /** 1-based line where the hunk was applied (in the file as it was at that moment). */
  line: number;
  /** Distance from the position implied by the @@ header (0 = exact). */
  offset: number;
  /** True when matched ignoring trailing whitespace / missing EOF marker. */
  fuzzy: boolean;
}

const patchError = (message: string, hint?: string, details?: Record<string, unknown>) =>
  new FileToolError("PATCH_FAILED", message, { hint, details });

export function parsePatch(patch: string): Hunk[] {
  if (typeof patch !== "string" || patch.trim() === "") throw patchError("`patch` is empty.");
  const src = patch.replace(/\r\n/g, "\n").split("\n");
  if (src.length && src[src.length - 1] === "") src.pop();

  const hunks: Hunk[] = [];
  let cur: Hunk | null = null;
  let fileHeaders = 0;
  for (let i = 0; i < src.length; i++) {
    const line = src[i];
    if (line.startsWith("@@")) {
      const m = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(line);
      if (m) {
        cur = { header: line, oldStart: Number(m[1]), oldCount: m[2] === undefined ? 1 : Number(m[2]), lines: [] };
      } else if (/^@@(\s.*)?$/.test(line)) {
        cur = { header: line, oldStart: null, oldCount: null, lines: [] };
      } else {
        throw patchError(`Malformed hunk header on patch line ${i + 1}: ${line}`, "Use '@@ -start,count +start,count @@' or a bare '@@'.");
      }
      hunks.push(cur);
      continue;
    }
    if (!cur) {
      // Preamble: diff/index/---/+++ lines are ignored.
      if (line.startsWith("--- ") && ++fileHeaders > 1) throw patchError("Patch touches more than one file; send one file per call.");
      continue;
    }
    if (line.startsWith("--- ") && src[i + 1]?.startsWith("+++ ")) {
      throw patchError("Patch touches more than one file; send one file per call.");
    }
    const c = line[0];
    if (c === " " || c === "-" || c === "+") cur.lines.push({ kind: c, text: line.slice(1) });
    else if (c === "\\") {
      const prev = cur.lines[cur.lines.length - 1];
      if (!prev) throw patchError(`'\\ No newline' marker with no preceding line (patch line ${i + 1}).`);
      prev.text += NOEOL;
    } else if (line === "") cur.lines.push({ kind: " ", text: "" });
    else {
      throw patchError(
        `Unexpected line ${i + 1} inside a hunk: ${JSON.stringify(line.slice(0, 80))}`,
        "Every hunk line must start with ' ' (context), '-' (remove), '+' (add) or '\\'.",
      );
    }
  }
  if (!hunks.length) throw patchError("No hunks found.", "A unified diff needs at least one '@@ ... @@' hunk header.");
  hunks.forEach((h, i) => {
    if (!h.lines.length) throw patchError(`Hunk ${i + 1} (${h.header}) is empty.`);
  });
  return hunks;
}

type LineEq = (fileLine: string, patchLine: string) => boolean;
const strictEq: LineEq = (a, b) => a === b;
const looseNorm = (s: string) => s.replace(NOEOL, "").trimEnd();
const looseEq: LineEq = (a, b) => looseNorm(a) === looseNorm(b);

function matchesAt(lines: readonly string[], at: number, block: readonly string[], same: LineEq): boolean {
  if (at < 0 || at + block.length > lines.length) return false;
  for (let i = 0; i < block.length; i++) if (!same(lines[at + i], block[i])) return false;
  return true;
}

function locate(lines: readonly string[], block: readonly string[], expected: number | null, minPos: number, same: LineEq) {
  if (expected !== null && expected >= minPos && matchesAt(lines, expected, block, same)) {
    return { at: expected, matches: [expected] };
  }
  const matches: number[] = [];
  for (let i = minPos; i + block.length <= lines.length; i++) {
    if (matchesAt(lines, i, block, same)) {
      matches.push(i);
      if (matches.length > 10) break;
    }
  }
  return { at: matches.length === 1 ? matches[0] : -1, matches };
}

/**
 * Apply hunks in order. Each hunk is placed at the line its header implies
 * (adjusted for earlier hunks); otherwise at the single other place its
 * context/removed lines occur; otherwise it fails. Nothing is partially applied.
 */
export function applyHunks(fileLines: readonly string[], hunks: readonly Hunk[]): { lines: string[]; placements: HunkPlacement[] } {
  const lines = fileLines.slice();
  const placements: HunkPlacement[] = [];
  let cumulative = 0;
  let drift = 0;
  let minPos = 0;

  hunks.forEach((h, idx) => {
    const oldBlock = h.lines.filter((l) => l.kind !== "+").map((l) => l.text);
    const base = h.oldStart === null ? null : oldBlock.length === 0 ? h.oldStart : Math.max(0, h.oldStart - 1);
    const expected = base === null ? null : base + cumulative + drift;
    let at: number;
    let fuzzy = false;

    if (oldBlock.length === 0) {
      if (expected === null) {
        throw patchError(`Hunk ${idx + 1} has no context lines and no line numbers, so it cannot be placed.`, "Add a few unchanged context lines or a '@@ -N,0 +M,K @@' header.");
      }
      if (expected < minPos || expected > lines.length) {
        throw patchError(`Hunk ${idx + 1} (${h.header}) points outside the file (it has ${lines.length} lines).`);
      }
      at = expected;
    } else {
      let found = locate(lines, oldBlock, expected, minPos, strictEq);
      if (found.at < 0 && found.matches.length === 0) {
        found = locate(lines, oldBlock, expected, minPos, looseEq);
        fuzzy = found.at >= 0;
      }
      if (found.at < 0) {
        const preview = oldBlock.slice(0, 6).map((l) => l.replace(NOEOL, ""));
        if (found.matches.length > 1) {
          throw patchError(
            `Hunk ${idx + 1} (${h.header}) matches ${found.matches.length >= 10 ? "10+" : found.matches.length} places and its line numbers do not pin it down.`,
            "Add more unchanged context lines around the change, or correct the @@ line numbers.",
            { hunk: idx + 1, candidate_lines: found.matches.map((m) => m + 1), expected_lines: preview },
          );
        }
        throw patchError(
          `Hunk ${idx + 1} (${h.header}) does not match the current file content.`,
          "Re-read the file: every context (' ') and removed ('-') line must equal the current content exactly.",
          { hunk: idx + 1, expected_at_line: expected === null ? null : expected + 1, expected_lines: preview },
        );
      }
      at = found.at;
    }

    // Build the replacement, keeping the file's own text for context lines.
    const newBlock: string[] = [];
    let j = 0;
    for (const l of h.lines) {
      if (l.kind === " ") newBlock.push(lines[at + j++]);
      else if (l.kind === "-") j++;
      else newBlock.push(l.text);
    }
    // If the patch silently ignored a missing final newline, preserve it.
    const touchesEnd = at + oldBlock.length === lines.length;
    const fileHadNoEol = lines.length > 0 && lines[lines.length - 1].endsWith(NOEOL);
    const patchMentionsNoEol = h.lines.some((l) => l.text.endsWith(NOEOL));
    if (touchesEnd && fileHadNoEol && !patchMentionsNoEol && newBlock.length && !newBlock[newBlock.length - 1].endsWith(NOEOL)) {
      newBlock[newBlock.length - 1] += NOEOL;
    }

    lines.splice(at, oldBlock.length, ...newBlock);
    placements.push({ hunk: idx + 1, line: at + 1, offset: expected === null ? 0 : at - expected, fuzzy });
    if (base !== null) drift = at - (base + cumulative);
    cumulative += newBlock.length - oldBlock.length;
    minPos = at + newBlock.length;
  });

  return { lines, placements };
}

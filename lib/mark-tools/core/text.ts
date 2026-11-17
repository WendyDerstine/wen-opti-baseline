import { createHash } from "node:crypto";
import { FileToolError } from "./errors.ts";

export type Eol = "\n" | "\r\n";

/** A text file as lines, with the formatting needed to write it back faithfully. */
export interface TextDoc {
  lines: string[];
  eol: Eol;
  finalNewline: boolean;
  bom: boolean;
}

/**
 * Internal marker appended to the last line when the file has no trailing
 * newline. It lets the diff/patch engine treat "no newline at EOF" as a real
 * difference, exactly like `\ No newline at end of file` in unified diffs.
 * NUL never appears in accepted text files (they are rejected as binary).
 */
export const NOEOL = "\u0000<NOEOL>";

const BOM = "\uFEFF";
const utf8 = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });

export function sha256(buf: Buffer | string): string {
  return createHash("sha256").update(buf).digest("hex");
}

export function isProbablyBinary(buf: Buffer): boolean {
  const n = Math.min(buf.length, 8000);
  for (let i = 0; i < n; i++) if (buf[i] === 0) return true;
  return false;
}

export function decodeUtf8(buf: Buffer): string {
  try {
    return utf8.decode(buf);
  } catch {
    throw new FileToolError("BINARY_FILE", "File is not valid UTF-8 text.", {
      hint: "These tools only edit UTF-8 text/source files.",
    });
  }
}

export function parseText(raw: string): TextDoc & { mixedEol: boolean } {
  let bom = false;
  if (raw.startsWith(BOM)) {
    bom = true;
    raw = raw.slice(1);
  }
  const crlf = (raw.match(/\r\n/g) ?? []).length;
  const lf = (raw.match(/\n/g) ?? []).length - crlf;
  const eol: Eol = crlf > lf ? "\r\n" : "\n";
  const normalized = raw.replace(/\r\n/g, "\n");
  const finalNewline = normalized.endsWith("\n");
  const body = finalNewline ? normalized.slice(0, -1) : normalized;
  const lines = body === "" && !finalNewline ? [] : body.split("\n");
  return { lines, eol, finalNewline: finalNewline && lines.length > 0, bom, mixedEol: crlf > 0 && lf > 0 };
}

/** parseText without the diagnostics. */
export function parseDoc(raw: string): TextDoc {
  const { lines, eol, finalNewline, bom } = parseText(raw);
  return { lines, eol, finalNewline, bom };
}

export function serialize(doc: TextDoc): string {
  const body = doc.lines.join(doc.eol);
  return (doc.bom ? BOM : "") + body + (doc.finalNewline && doc.lines.length ? doc.eol : "");
}

/** LF-normalised content without BOM (what string matching operates on). */
export function toLF(doc: TextDoc): string {
  return doc.lines.join("\n") + (doc.finalNewline && doc.lines.length ? "\n" : "");
}

export function withSentinel(doc: TextDoc): string[] {
  const out = doc.lines.slice();
  if (out.length && !doc.finalNewline) out[out.length - 1] += NOEOL;
  return out;
}

export function fromSentinel(lines: string[], base: Pick<TextDoc, "eol" | "bom">): TextDoc {
  const out = lines.slice();
  let finalNewline = out.length > 0;
  for (let i = 0; i < out.length; i++) {
    const idx = out[i].indexOf(NOEOL);
    if (idx === -1) continue;
    if (i !== out.length - 1 || idx !== out[i].length - NOEOL.length) {
      throw new FileToolError(
        "PATCH_FAILED",
        "'\\ No newline at end of file' can only apply to the last line of the file.",
      );
    }
    out[i] = out[i].slice(0, idx);
    finalNewline = false;
  }
  return { lines: out, eol: base.eol, bom: base.bom, finalNewline };
}

/** Split tool-supplied content into lines. "" = no lines; one trailing newline is ignored. */
export function splitContent(content: string): string[] {
  const s = content.replace(/\r\n/g, "\n");
  if (s === "") return [];
  return (s.endsWith("\n") ? s.slice(0, -1) : s).split("\n");
}

export function numberLines(lines: string[], firstLine: number): string {
  const width = String(firstLine + lines.length - 1).length;
  return lines.map((l, i) => `${String(firstLine + i).padStart(width, " ")}\t${l}`).join("\n");
}

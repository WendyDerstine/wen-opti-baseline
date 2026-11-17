import { randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { FileToolConfig } from "../config.ts";
import { FileToolError } from "./errors.ts";
import { sha256 } from "./text.ts";

export interface BackupInfo {
  backup_id: string;
  created_at: string;
  sha256: string;
  bytes: number;
}

const dirFor = (cfg: FileToolConfig, absPath: string) => path.join(cfg.backupDir, sha256(absPath).slice(0, 16));
const ID_RE = /^[\w-]+$/;
let seq = 0;

/** Copy the current bytes aside before a write. Returns the backup id. */
export async function createBackup(cfg: FileToolConfig, absPath: string, buf: Buffer): Promise<string> {
  const dir = dirFor(cfg, absPath);
  await fs.mkdir(dir, { recursive: true });
  const id = `${new Date().toISOString().replace(/[:.]/g, "-")}-${String(seq++ % 1e6).padStart(6, "0")}-${randomBytes(3).toString("hex")}`;
  const info: BackupInfo & { path: string } = {
    backup_id: id,
    created_at: new Date().toISOString(),
    sha256: sha256(buf),
    bytes: buf.length,
    path: absPath,
  };
  await fs.writeFile(path.join(dir, `${id}.bak`), buf);
  await fs.writeFile(path.join(dir, `${id}.json`), JSON.stringify(info, null, 2));
  await prune(cfg, dir);
  return id;
}

async function prune(cfg: FileToolConfig, dir: string): Promise<void> {
  const ids = (await fs.readdir(dir)).filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5)).sort();
  for (const id of ids.slice(0, Math.max(0, ids.length - cfg.backupKeep))) {
    await fs.rm(path.join(dir, `${id}.bak`), { force: true });
    await fs.rm(path.join(dir, `${id}.json`), { force: true });
  }
}

/** Newest first. */
export async function listBackups(cfg: FileToolConfig, absPath: string): Promise<BackupInfo[]> {
  const dir = dirFor(cfg, absPath);
  let files: string[];
  try {
    files = await fs.readdir(dir);
  } catch {
    return [];
  }
  const out: BackupInfo[] = [];
  for (const f of files.filter((x) => x.endsWith(".json")).sort().reverse()) {
    const meta = JSON.parse(await fs.readFile(path.join(dir, f), "utf8"));
    out.push({ backup_id: meta.backup_id, created_at: meta.created_at, sha256: meta.sha256, bytes: meta.bytes });
  }
  return out;
}

export async function readBackup(cfg: FileToolConfig, absPath: string, id: string): Promise<Buffer> {
  if (!ID_RE.test(id)) throw new FileToolError("INVALID_ARGUMENT", "Invalid backup_id.");
  try {
    return await fs.readFile(path.join(dirFor(cfg, absPath), `${id}.bak`));
  } catch {
    throw new FileToolError("NO_BACKUP", `Backup '${id}' not found for this file.`, {
      hint: "Call the restore tool with list_only=\"true\" to see available backups.",
    });
  }
}

import { createHash, timingSafeEqual } from "node:crypto";
import { loadConfig, type FileToolConfig } from "./config.ts";
import { FileToolError } from "./core/errors.ts";
import { buildManifest, findTool } from "./registry.ts";

/**
 * Framework-agnostic request handling for the Mark tools endpoints.
 * app/api/mark-tools/[[...path]]/route.ts is a thin Next.js adapter over this,
 * which keeps everything here unit-testable with plain Node.
 *
 *   GET  /api/mark-tools/discovery          -> tool manifest (Opal SDK format)
 *   POST /api/mark-tools/tools/<tool_name>  -> run a tool (bearer token)
 *   GET  /api/mark-tools                    -> health
 */

export const BASE_PATH = "/api/mark-tools";
const MIN_TOKEN_LENGTH = 24;

export interface MarkToolsRequest {
  method: string;
  pathname: string;
  headers: { get(name: string): string | null };
  readJson: () => Promise<unknown>;
}

export interface MarkToolsResponse {
  status: number;
  body: unknown;
}

type Env = Record<string, string | undefined>;
const truthy = (v: string | undefined) => /^(1|true|yes|on)$/i.test((v ?? "").trim());

export interface GateResult {
  enabled: boolean;
  /** Why the endpoints are hidden (logged, never sent to callers). */
  reason?: string;
  misconfigured?: string;
}

/** Decide whether the endpoints exist at all. Hidden = plain 404, indistinguishable from no route. */
export function gate(env: Env): GateResult {
  if (!truthy(env.MARK_TOOLS_ENABLED)) return { enabled: false, reason: "MARK_TOOLS_ENABLED is not true" };
  // Serverless filesystems are read-only/ephemeral, and a deployed site must never expose its source.
  if (env.VERCEL || env.NETLIFY || env.AWS_LAMBDA_FUNCTION_NAME) {
    return { enabled: false, reason: "serverless platform detected" };
  }
  if (env.NODE_ENV === "production" && !truthy(env.MARK_TOOLS_ALLOW_PRODUCTION)) {
    return { enabled: false, reason: "NODE_ENV=production (set MARK_TOOLS_ALLOW_PRODUCTION=true to override)" };
  }
  const token = env.MARK_TOOLS_TOKEN?.trim() ?? "";
  if (token.length < MIN_TOKEN_LENGTH) {
    return { enabled: true, misconfigured: `MARK_TOOLS_TOKEN must be set to a random string of at least ${MIN_TOKEN_LENGTH} characters.` };
  }
  return { enabled: true };
}

const digest = (s: string) => createHash("sha256").update(s).digest();

export function checkBearer(header: string | null, token: string): boolean {
  const m = /^Bearer\s+(.+)$/i.exec(header ?? "");
  return m !== null && timingSafeEqual(digest(m[1].trim()), digest(token));
}

/** Tool-name prefix so several cloned projects can be registered in Mark side by side. */
export function toolPrefix(env: Env): string {
  const raw = (env.MARK_TOOLS_NAME_PREFIX ?? "").trim();
  if (!raw) return "";
  const clean = raw.toLowerCase().replace(/[^a-z0-9_]/g, "_").replace(/_+$/, "");
  return clean ? `${clean}_` : "";
}

let cached: { key: string; cfg: FileToolConfig } | null = null;
function getConfig(env: Env): FileToolConfig {
  const key = JSON.stringify(Object.entries(env).filter(([k]) => k.startsWith("MARK_TOOLS_")).sort()) + process.cwd();
  if (!cached || cached.key !== key) cached = { key, cfg: loadConfig(env as NodeJS.ProcessEnv) };
  return cached.cfg;
}

let warned = false;
function audit(entry: Record<string, unknown>): void {
  console.log(`[mark-tools] ${JSON.stringify({ ts: new Date().toISOString(), ...entry })}`);
}

const json = (status: number, body: unknown): MarkToolsResponse => ({ status, body });
const NOT_FOUND = json(404, { error: "not_found" });

export async function handleMarkToolsRequest(req: MarkToolsRequest, env: Env = process.env): Promise<MarkToolsResponse> {
  const g = gate(env);
  if (!g.enabled) {
    if (truthy(env.MARK_TOOLS_ENABLED) && !warned) {
      warned = true;
      console.warn(`[mark-tools] endpoints disabled: ${g.reason}`);
    }
    return NOT_FOUND;
  }
  if (g.misconfigured) {
    console.error(`[mark-tools] ${g.misconfigured}`);
    return json(503, { error: "mark_tools_misconfigured", message: g.misconfigured });
  }
  const token = env.MARK_TOOLS_TOKEN!.trim();
  const prefix = toolPrefix(env);

  const rest = req.pathname.startsWith(BASE_PATH) ? req.pathname.slice(BASE_PATH.length) : req.pathname;
  const segments = rest.split("/").filter(Boolean);
  const method = req.method.toUpperCase();

  // Discovery: public by default, exactly like the Opal Tools SDK (it only lists tool names/parameters).
  if (segments[segments.length - 1] === "discovery") {
    if (method !== "GET") return json(405, { error: "method_not_allowed" });
    if (truthy(env.MARK_TOOLS_PROTECT_DISCOVERY) && !checkBearer(req.headers.get("authorization"), token)) {
      return json(401, { detail: "Invalid bearer token" });
    }
    return json(200, buildManifest(prefix, BASE_PATH));
  }

  if (segments.length === 0) {
    if (method !== "GET") return json(405, { error: "method_not_allowed" });
    return json(200, { ok: true, discovery: `${BASE_PATH}/discovery` });
  }

  // Tool call. The manifest declares /api/mark-tools/tools/<name>; we only look at the
  // trailing "tools/<name>" so it works whether Mark resolves the endpoint against
  // the origin or against the discovery URL's folder.
  const toolsIdx = segments.lastIndexOf("tools");
  if (toolsIdx === -1 || toolsIdx !== segments.length - 2) return NOT_FOUND;
  if (method !== "POST") return json(405, { error: "method_not_allowed" });
  if (!checkBearer(req.headers.get("authorization"), token)) {
    audit({ event: "unauthorized", path: req.pathname });
    return json(401, { detail: "Invalid bearer token" });
  }

  const name = segments[segments.length - 1];
  const tool = findTool(prefix, name);
  if (!tool) return json(404, { error: "unknown_tool", tool: name });

  let cfg: FileToolConfig;
  try {
    cfg = getConfig(env);
  } catch (err) {
    console.error("[mark-tools] invalid configuration:", err);
    return json(503, { error: "mark_tools_misconfigured", message: (err as Error).message });
  }

  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared > cfg.maxBytes * 3) return json(413, { error: "payload_too_large" });

  let body: unknown;
  try {
    body = await req.readJson();
  } catch {
    return json(400, { error: "invalid_json" });
  }
  // Same extraction rule as the SDK: use body.parameters when present, else the body itself.
  const b = (body ?? {}) as Record<string, unknown>;
  const params = (b.parameters && typeof b.parameters === "object" ? b.parameters : b) as Record<string, unknown>;

  const started = Date.now();
  const traceIds = {
    thread: req.headers.get("x-opal-thread-id") ?? undefined,
    agent_execution: req.headers.get("x-opal-agent-execution-id") ?? undefined,
  };
  try {
    const result = (await tool.run(cfg, params)) as Record<string, unknown>;
    audit({ event: "call", tool: tool.name, path: params.path, ok: true, dry_run: result.dry_run, changed: result.changed, ms: Date.now() - started, ...traceIds });
    return json(200, result);
  } catch (err) {
    if (err instanceof FileToolError) {
      audit({ event: "call", tool: tool.name, path: params.path, ok: false, code: err.code, ms: Date.now() - started, ...traceIds });
      // Expected failures go back as data so the agent can self-correct.
      return json(200, { ok: false, error: err.toJSON() });
    }
    audit({ event: "call", tool: tool.name, path: params.path, ok: false, code: "INTERNAL", ms: Date.now() - started, ...traceIds });
    console.error(`[mark-tools] ${tool.name} failed:`, err);
    return json(500, { error: err instanceof Error ? err.message : "Unknown error" });
  }
}

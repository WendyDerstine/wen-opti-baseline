import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { beforeEach, test } from "node:test";
import { makeConfig, type FileToolConfig } from "../config.ts";
import type { FileToolError } from "../core/errors.ts";
import { listSourceFiles, searchSourceFiles } from "../core/explore.ts";
import { readSourceFile, replaceInSourceFile, writeSourceFile } from "../core/fileOps.ts";
import { pathGlob } from "../core/paths.ts";
import { gate, handleMarkToolsRequest, toolPrefix, type MarkToolsRequest } from "../http.ts";
import { TOOL_DEFS } from "../registry.ts";

let root: string;
let cfg: FileToolConfig;
const code = (c: string) => (e: unknown) => (e as FileToolError).code === c;

async function put(rel: string, content: string) {
  await fs.mkdir(path.dirname(path.join(root, rel)), { recursive: true });
  await fs.writeFile(path.join(root, rel), content);
}

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "baseline-"));
  // A miniature opti-baseline.
  await put("app/layout.tsx", "export default function RootLayout() {\n  return null;\n}\n");
  await put("app/[locale]/[[...slug]]/page.tsx", "export default function Page() {\n  return <main>Hello</main>;\n}\n");
  await put("cms/components/Hero.tsx", "export function Hero() {\n  return <h1>Hero</h1>;\n}\n");
  await put("lib/mark-tools/http.ts", "// guarded\n");
  await put("app/api/mark-tools/[[...path]]/route.ts", "// guarded\n");
  await put("node_modules/next/index.js", "module.exports = {};\n");
  await put(".next/server/page.js", "x\n");
  await put(".env", "OPTIMIZELY_GRAPH_SINGLE_KEY=secret\n");
  await put(".git/config", "[core]\n");
  await put("yarn.lock", "# lock\n");
  await put("package.json", '{ "name": "demo" }\n');
  cfg = makeConfig({ roots: [root] });
});

// ------------------------------------------------------------- globbing --

test("pathGlob semantics", () => {
  assert.ok(pathGlob("lib/mark-tools/**").test("lib/mark-tools/core/diff.ts"));
  assert.ok(pathGlob("**/*.tsx").test("app/layout.tsx"));
  assert.ok(pathGlob("**/*.tsx").test("layout.tsx"));
  assert.ok(!pathGlob("app/*.tsx").test("app/[locale]/page.tsx"));
  assert.ok(pathGlob("app/[locale]/*.tsx").test("app/[locale]/page.tsx"), "brackets are literal");
});

// ---------------------------------------------------- scope + read-only --

test("default backup dir lives inside the project and is unreachable", async () => {
  assert.equal(cfg.backupDir, path.join(await fs.realpath(root), ".mark-tools", "backups"));
  await writeSourceFile(cfg, { path: "app/layout.tsx", content: "changed\n", overwrite: true });
  await assert.rejects(readSourceFile(cfg, { path: ".mark-tools/backups/x" }), code("PATH_NOT_ALLOWED"));
});

test("secrets, build output and dependencies are blocked; tool code and lockfiles are read-only", async () => {
  for (const p of [".env", ".git/config", "node_modules/next/index.js", ".next/server/page.js"]) {
    await assert.rejects(readSourceFile(cfg, { path: p }), code("PATH_NOT_ALLOWED"), p);
  }
  // .env.example is a template, not a secret.
  await put(".env.example", "MARK_TOOLS_ENABLED=false\n");
  assert.equal((await readSourceFile(cfg, { path: ".env.example" })).ok, true);
  await assert.rejects(readSourceFile(cfg, { path: ".env.local" }), code("PATH_NOT_ALLOWED"));
  // Readable...
  const r = await readSourceFile(cfg, { path: "lib/mark-tools/http.ts" });
  assert.equal(r.ok, true);
  // ...but not writable.
  await assert.rejects(replaceInSourceFile(cfg, { path: "lib/mark-tools/http.ts", oldString: "guarded", newString: "off" }), code("PATH_NOT_ALLOWED"));
  await assert.rejects(writeSourceFile(cfg, { path: "app/api/mark-tools/[[...path]]/route.ts", content: "x", overwrite: true }), code("PATH_NOT_ALLOWED"));
  await assert.rejects(writeSourceFile(cfg, { path: "yarn.lock", content: "x", overwrite: true }), code("PATH_NOT_ALLOWED"));
  // Even a dry run of a protected file is refused.
  await assert.rejects(replaceInSourceFile(cfg, { path: "lib/mark-tools/http.ts", oldString: "guarded", newString: "off", dryRun: true }), code("PATH_NOT_ALLOWED"));
  // Normal project files are editable.
  await replaceInSourceFile(cfg, { path: "cms/components/Hero.tsx", oldString: "<h1>Hero</h1>", newString: "<h1>Hi</h1>" });
});

test("paths outside the project root are refused", async () => {
  await assert.rejects(readSourceFile(cfg, { path: "../../etc/passwd" }), code("PATH_NOT_ALLOWED"));
  await assert.rejects(listSourceFiles(cfg, { path: ".." }), code("PATH_NOT_ALLOWED"));
  await assert.rejects(searchSourceFiles(cfg, { query: "root", path: "/etc" }), code("PATH_NOT_ALLOWED"));
});

// ------------------------------------------------------------- explore --

test("list_source_files hides blocked folders and respects depth", async () => {
  const r = await listSourceFiles(cfg, {});
  const paths = r.entries.map((e) => e.path);
  assert.ok(paths.includes("app/") && paths.includes("cms/") && paths.includes("package.json"));
  assert.ok(paths.includes("app/layout.tsx"), "depth 2 includes app/layout.tsx");
  for (const hidden of ["node_modules/", ".next/", ".git/", ".env", ".mark-tools/"]) assert.ok(!paths.includes(hidden), hidden);
  assert.ok(paths.includes("cms/components/"), "depth 2 lists the folder...");
  assert.ok(!paths.includes("cms/components/Hero.tsx"), "...but not its contents");
  assert.equal(r.deeper_levels_not_shown, true);
});

test("list_source_files pattern searches deep for files", async () => {
  const r = await listSourceFiles(cfg, { pattern: "*.tsx" });
  assert.deepEqual(r.entries.map((e) => e.path).sort(), ["app/[locale]/[[...slug]]/page.tsx", "app/layout.tsx", "cms/components/Hero.tsx"]);
  const scoped = await listSourceFiles(cfg, { path: "cms", pattern: "cms/**/*.tsx" });
  assert.deepEqual(scoped.entries.map((e) => e.path), ["cms/components/Hero.tsx"]);
  const capped = await listSourceFiles(cfg, { maxEntries: 2 });
  assert.equal(capped.truncated, true);
  assert.equal(capped.count, 2);
});

test("search_source_files finds lines, skips blocked files, supports regex", async () => {
  const r = await searchSourceFiles(cfg, { query: "export default" });
  assert.deepEqual(r.matches.map((m) => `${m.path}:${m.line}`).sort(), ["app/[locale]/[[...slug]]/page.tsx:1", "app/layout.tsx:1"]);
  const secret = await searchSourceFiles(cfg, { query: "secret" });
  assert.equal(secret.count, 0, ".env is never searched");
  const rx = await searchSourceFiles(cfg, { query: "<h1>\\w+</h1>", isRegex: true, include: "*.tsx" });
  assert.equal(rx.matches[0].path, "cms/components/Hero.tsx");
  await assert.rejects(searchSourceFiles(cfg, { query: "(", isRegex: true }), code("INVALID_ARGUMENT"));
  const cs = await searchSourceFiles(cfg, { query: "HERO", caseSensitive: true });
  assert.equal(cs.count, 0);
});

// ---------------------------------------------------------------- http --

const TOKEN = "t".repeat(32);
const baseEnv = () => ({ MARK_TOOLS_ENABLED: "true", MARK_TOOLS_TOKEN: TOKEN, MARK_TOOLS_ROOT: root, NODE_ENV: "development" });

function request(method: string, pathname: string, body?: unknown, headers: Record<string, string> = {}): MarkToolsRequest {
  const h = new Map(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  return {
    method,
    pathname,
    headers: { get: (n: string) => h.get(n.toLowerCase()) ?? null },
    readJson: async () => body,
  };
}
const auth = { authorization: `Bearer ${TOKEN}` };

test("gate: disabled by default, dev-only, never on Vercel, needs a strong token", () => {
  assert.equal(gate({}).enabled, false);
  assert.equal(gate({ ...baseEnv(), VERCEL: "1" }).enabled, false);
  assert.equal(gate({ ...baseEnv(), NODE_ENV: "production" }).enabled, false);
  assert.equal(gate({ ...baseEnv(), NODE_ENV: "production", MARK_TOOLS_ALLOW_PRODUCTION: "true" }).enabled, true);
  assert.ok(gate({ ...baseEnv(), MARK_TOOLS_TOKEN: "short" }).misconfigured);
  assert.deepEqual(gate(baseEnv()), { enabled: true });
});

test("http: disabled endpoints are indistinguishable from a missing route", async () => {
  const r = await handleMarkToolsRequest(request("GET", "/api/mark-tools/discovery"), {});
  assert.equal(r.status, 404);
  const p = await handleMarkToolsRequest(request("POST", "/api/mark-tools/tools/read_source_file", {}, auth), { ...baseEnv(), VERCEL: "1" });
  assert.equal(p.status, 404);
});

test("http: discovery matches the Opal SDK manifest shape", async () => {
  const r = await handleMarkToolsRequest(request("GET", "/api/mark-tools/discovery"), baseEnv());
  assert.equal(r.status, 200);
  const fns = (r.body as { functions: Record<string, unknown>[] }).functions;
  assert.equal(fns.length, TOOL_DEFS.length);
  for (const f of fns) {
    assert.deepEqual(Object.keys(f).sort(), ["description", "endpoint", "http_method", "name", "parameters"]);
    assert.equal(f.http_method, "POST");
    assert.equal(f.endpoint, `/api/mark-tools/tools/${f.name}`);
    for (const prm of f.parameters as Record<string, unknown>[]) {
      assert.deepEqual(Object.keys(prm).sort(), ["description", "name", "required", "type"]);
    }
  }
  const protectedDisc = await handleMarkToolsRequest(request("GET", "/api/mark-tools/discovery"), { ...baseEnv(), MARK_TOOLS_PROTECT_DISCOVERY: "true" });
  assert.equal(protectedDisc.status, 401);
});

test("http: tool calls need the bearer token and accept {parameters} or a bare body", async () => {
  const env = baseEnv();
  const noAuth = await handleMarkToolsRequest(request("POST", "/api/mark-tools/tools/read_source_file", { parameters: { path: "app/layout.tsx" } }), env);
  assert.equal(noAuth.status, 401);
  const bad = await handleMarkToolsRequest(request("POST", "/api/mark-tools/tools/read_source_file", {}, { authorization: "Bearer nope" }), env);
  assert.equal(bad.status, 401);

  const wrapped = await handleMarkToolsRequest(request("POST", "/api/mark-tools/tools/read_source_file", { parameters: { path: "app/layout.tsx", start_line: "2", end_line: "2" } }, auth), env);
  assert.equal(wrapped.status, 200);
  assert.equal((wrapped.body as { content: string }).content, "2\t  return null;");

  const bare = await handleMarkToolsRequest(request("POST", "/api/mark-tools/tools/list_source_files", { path: "cms", depth: "3" }, auth), env);
  assert.equal(bare.status, 200);
  assert.ok((bare.body as { entries: { path: string }[] }).entries.some((e) => e.path === "cms/components/Hero.tsx"));
});

test("http: endpoint works whether Mark resolves it from the origin or the discovery folder", async () => {
  const doubled = "/api/mark-tools/api/mark-tools/tools/read_source_file";
  const r = await handleMarkToolsRequest(request("POST", doubled, { parameters: { path: "package.json" } }, auth), baseEnv());
  assert.equal(r.status, 200);
});

test("http: expected failures come back as data, unknown tools 404, GET on a tool is 405", async () => {
  const env = baseEnv();
  const r = await handleMarkToolsRequest(request("POST", "/api/mark-tools/tools/read_source_file", { parameters: { path: ".env" } }, auth), env);
  assert.equal(r.status, 200);
  assert.equal((r.body as { ok: boolean; error: { code: string } }).error.code, "PATH_NOT_ALLOWED");
  assert.equal((await handleMarkToolsRequest(request("POST", "/api/mark-tools/tools/rm_rf", {}, auth), env)).status, 404);
  assert.equal((await handleMarkToolsRequest(request("GET", "/api/mark-tools/tools/read_source_file"), env)).status, 405);
});

test("http: name prefix keeps several cloned projects apart in Mark", async () => {
  assert.equal(toolPrefix({ MARK_TOOLS_NAME_PREFIX: "UPS Demo" }), "ups_demo_");
  const env = { ...baseEnv(), MARK_TOOLS_NAME_PREFIX: "ups" };
  const disc = await handleMarkToolsRequest(request("GET", "/api/mark-tools/discovery"), env);
  const names = (disc.body as { functions: { name: string }[] }).functions.map((f) => f.name);
  assert.ok(names.every((n) => n.startsWith("ups_")));
  const ok = await handleMarkToolsRequest(request("POST", "/api/mark-tools/tools/ups_read_source_file", { parameters: { path: "package.json" } }, auth), env);
  assert.equal(ok.status, 200);
  const unprefixed = await handleMarkToolsRequest(request("POST", "/api/mark-tools/tools/read_source_file", { parameters: { path: "package.json" } }, auth), env);
  assert.equal(unprefixed.status, 404);
});

test("http: an edit through the API writes the file and returns a diff", async () => {
  const r = await handleMarkToolsRequest(
    request("POST", "/api/mark-tools/tools/replace_in_source_file", { parameters: { path: "cms/components/Hero.tsx", old_string: "<h1>Hero</h1>", new_string: "<h1>Welcome</h1>" } }, auth),
    baseEnv(),
  );
  const body = r.body as { ok: boolean; diff: string; backup_id: string };
  assert.equal(body.ok, true);
  assert.match(body.diff, /-  return <h1>Hero<\/h1>;\n\+  return <h1>Welcome<\/h1>;/);
  assert.ok(body.backup_id);
  assert.match(await fs.readFile(path.join(root, "cms/components/Hero.tsx"), "utf8"), /Welcome/);
});

import type { NextRequest } from "next/server";
import { handleMarkToolsRequest } from "@/lib/mark-tools/http";

/**
 * Mark (Opal) source-file tools for THIS project.
 *
 *   GET  /api/mark-tools/discovery          tool manifest (register this URL in Mark)
 *   POST /api/mark-tools/tools/<tool_name>  run a tool (Authorization: Bearer <MARK_TOOLS_TOKEN>)
 *
 * The endpoints return 404 unless MARK_TOOLS_ENABLED=true. They are dev-only by
 * default and never run on Vercel. All logic lives in lib/mark-tools; see
 * docs/Mark Source File Tools.md.
 */

// Needs the Node.js filesystem, and must never be cached or prerendered.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handle(request: NextRequest): Promise<Response> {
  const result = await handleMarkToolsRequest({
    method: request.method,
    pathname: request.nextUrl.pathname,
    headers: request.headers,
    readJson: () => request.json(),
  });
  return Response.json(result.body, {
    status: result.status,
    headers: { "Cache-Control": "no-store" },
  });
}

export const GET = handle;
export const POST = handle;

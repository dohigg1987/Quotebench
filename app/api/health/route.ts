import { databaseHealthcheck } from "../../../db/database.ts";

export const dynamic = "force-dynamic";

export async function GET() {
  const { env } = await import("cloudflare:workers");
  const checks = { database: false, objectStorage: false };
  checks.database = await databaseHealthcheck();
  try { if (env.BUCKET) { await env.BUCKET.list({ limit: 1 }); checks.objectStorage = true; } } catch { checks.objectStorage = false; }
  const healthy = checks.database && checks.objectStorage;
  return Response.json({ status: healthy ? "ok" : "degraded", version: "enterprise-2026.08", checks }, { status: healthy ? 200 : 503, headers: { "cache-control": "no-store" } });
}

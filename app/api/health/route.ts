import { databaseHealthcheck, releaseSchemaHealthcheck } from "../../../db/database.ts";
import { RELEASE_MIGRATIONS } from "../../../db/release-migrations.ts";
import { runReleasePricingAssurance } from "../../../lib/release-assurance.ts";

export const dynamic = "force-dynamic";

export async function GET() {
  const { env } = await import("cloudflare:workers");
  const checks = { database: false, objectStorage: false, schema: false, pricing: false };
  checks.database = await databaseHealthcheck();
  checks.schema = await releaseSchemaHealthcheck(RELEASE_MIGRATIONS.map((migration) => migration.id));
  checks.pricing = runReleasePricingAssurance().ok;
  try { if (env.BUCKET) { await env.BUCKET.list({ limit: 1 }); checks.objectStorage = true; } } catch { checks.objectStorage = false; }
  const healthy = Object.values(checks).every(Boolean);
  return Response.json({ status: healthy ? "ok" : "degraded", version: "enterprise-2026.08", checks }, { status: healthy ? 200 : 503, headers: { "cache-control": "no-store" } });
}

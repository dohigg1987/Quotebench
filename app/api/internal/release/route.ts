import { applyReleaseMigrations, databaseHealthcheck, releaseSchemaHealthcheck } from "../../../../db/database.ts";
import { RELEASE_MIGRATIONS } from "../../../../db/release-migrations.ts";
import { runReleasePricingAssurance } from "../../../../lib/release-assurance.ts";
import { verifyReleaseControlSignature } from "../../../../lib/release-control.ts";

export const dynamic = "force-dynamic";

type ReleaseEnv = {
  APP_ENV?: string;
  BUILD_COMMIT_SHA?: string;
  BUILD_ARTIFACT_SHA256?: string;
  NEON_AUTH_COOKIE_SECRET?: string;
  BUCKET?: R2Bucket;
  CF_VERSION_METADATA?: WorkerVersionMetadata;
};

async function authorised(request: Request, env: ReleaseEnv, body: string) {
  const timestamp = request.headers.get("x-quotebench-release-timestamp") ?? "";
  const commit = request.headers.get("x-quotebench-release-commit") ?? "";
  const signature = request.headers.get("x-quotebench-release-signature") ?? "";
  if (!env.NEON_AUTH_COOKIE_SECRET || commit !== env.BUILD_COMMIT_SHA) return false;
  return verifyReleaseControlSignature(env.NEON_AUTH_COOKIE_SECRET, {
    timestamp,
    method: request.method,
    pathname: new URL(request.url).pathname,
    commit,
    body,
  }, signature);
}

async function assurance(env: ReleaseEnv) {
  const pricing = runReleasePricingAssurance();
  const checks = {
    database: await databaseHealthcheck(),
    objectStorage: false,
    schema: await releaseSchemaHealthcheck(RELEASE_MIGRATIONS.map((migration) => migration.id)),
    pricing: pricing.ok,
  };
  try {
    if (env.BUCKET) {
      await env.BUCKET.list({ limit: 1 });
      checks.objectStorage = true;
    }
  } catch {
    checks.objectStorage = false;
  }
  const ok = Object.values(checks).every(Boolean);
  return {
    ok,
    checks,
    pricing: { fixture: pricing.fixture, traceMatched: pricing.ok },
    release: {
      environment: env.APP_ENV ?? "unknown",
      commit: env.BUILD_COMMIT_SHA ?? "unknown",
      artifactDigest: env.BUILD_ARTIFACT_SHA256 ?? "unknown",
      cloudflareVersionId: env.CF_VERSION_METADATA?.id ?? "unknown",
      cloudflareVersionTag: env.CF_VERSION_METADATA?.tag ?? "unknown",
    },
  };
}

export async function GET(request: Request) {
  const { env } = await import("cloudflare:workers") as { env: ReleaseEnv };
  if (!await authorised(request, env, "")) return Response.json({ error: "Release control authentication failed." }, { status: 401 });
  const result = await assurance(env);
  return Response.json(result, { status: result.ok ? 200 : 503, headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request) {
  const { env } = await import("cloudflare:workers") as { env: ReleaseEnv };
  const body = await request.text();
  if (!await authorised(request, env, body)) return Response.json({ error: "Release control authentication failed." }, { status: 401 });
  const input = JSON.parse(body || "{}") as { action?: string };
  if (input.action !== "migrate") return Response.json({ error: "Unsupported release control action." }, { status: 400 });
  try {
    const migrations = await applyReleaseMigrations(RELEASE_MIGRATIONS);
    const result = await assurance(env);
    return Response.json({ ...result, migrations }, { status: result.ok ? 200 : 503, headers: { "cache-control": "no-store" } });
  } catch (error) {
    console.error(JSON.stringify({ event: "release.migration_failed", environment: env.APP_ENV, error: error instanceof Error ? error.message : "unknown" }));
    return Response.json({ error: error instanceof Error ? error.message : "Release migration failed." }, { status: 500 });
  }
}

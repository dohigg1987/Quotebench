import process from "node:process";
import { createReleaseControlSignature } from "../lib/release-control.ts";

const [action, baseUrl, workerName, versionId, commit] = process.argv.slice(2);
if (!action || !["migrate", "assure"].includes(action)) throw new Error("Usage: release-control.mjs <migrate|assure> <base-url> <worker-name> <version-id> <commit>");
if (!baseUrl || !workerName || !versionId || !/^[a-f0-9]{40}$/.test(commit ?? "")) throw new Error("Release control arguments are invalid.");
const secret = process.env.RELEASE_CONTROL_SECRET;
if (!secret) throw new Error("RELEASE_CONTROL_SECRET is required.");

const pathname = "/api/internal/release";
const method = action === "migrate" ? "POST" : "GET";
const body = action === "migrate" ? JSON.stringify({ action: "migrate" }) : "";
const timestamp = String(Date.now());
const signature = await createReleaseControlSignature(secret, { timestamp, method, pathname, commit, body });
const response = await fetch(new URL(pathname, baseUrl), {
  method,
  headers: {
    "content-type": "application/json",
    "x-quotebench-release-timestamp": timestamp,
    "x-quotebench-release-commit": commit,
    "x-quotebench-release-signature": signature,
    "Cloudflare-Workers-Version-Overrides": `${workerName}="${versionId}"`,
  },
  body: body || undefined,
});
const text = await response.text();
if (!response.ok) throw new Error(`Release control ${action} failed (${response.status}): ${text.slice(0, 1_000)}`);
const payload = JSON.parse(text);
if (!payload.ok || payload.release?.commit !== commit || payload.release?.cloudflareVersionId !== versionId || payload.release?.artifactDigest === "unknown") {
  throw new Error(`Release identity or assurance mismatch: ${text.slice(0, 1_000)}`);
}
console.log(JSON.stringify({ action, ok: true, checks: payload.checks, release: payload.release, migrations: payload.migrations ?? undefined }));

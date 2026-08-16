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
const maxAttempts = 30;
const retryDelayMs = 2_000;
const startedAt = Date.now();
let response;
let text = "";
let attempts = 0;
for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
  attempts = attempt;
  response = await fetch(new URL(pathname, baseUrl), {
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
  text = await response.text();
  if (response.ok || ![401, 403, 404].includes(response.status) || attempt === maxAttempts) break;
  const detail = response.status === 401
    ? "signature rejected; a prior version may have received the new release signature, while a persistent 401 indicates an authentication configuration failure"
    : "target release route not available yet";
  console.warn(`Release probe ${action} received HTTP ${response.status} after ${Date.now() - startedAt}ms (${detail}); retrying ${attempt}/${maxAttempts}.`);
  await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
}
if (!response) throw new Error("Release control request did not run.");
const elapsedMs = Date.now() - startedAt;
if (!response.ok) throw new Error(`Release control ${action} failed after ${attempts} attempts and ${elapsedMs}ms (${response.status}): ${text.slice(0, 1_000)}`);
const payload = JSON.parse(text);
if (!payload.ok || payload.release?.commit !== commit || payload.release?.cloudflareVersionId !== versionId || payload.release?.artifactDigest === "unknown") {
  throw new Error(`Release identity or assurance mismatch: ${text.slice(0, 1_000)}`);
}
console.log(JSON.stringify({ action, ok: true, probe: { attempts, elapsedMs }, checks: payload.checks, release: payload.release, migrations: payload.migrations ?? undefined }));


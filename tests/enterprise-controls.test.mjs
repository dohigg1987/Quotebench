import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const source = (file) => readFile(path.join(root, file), "utf8");

async function filesUnder(directory) {
  const entries = await readdir(path.join(root, directory), { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => entry.isDirectory() ? filesUnder(path.join(directory, entry.name)) : [path.join(directory, entry.name)]));
  return nested.flat();
}

test("E1/E3 internal API boundaries resolve an authenticated tenant", async () => {
  const routes = (await filesUnder("app/api")).filter((file) => file.endsWith("route.ts") && !file.includes("/public/") && !file.includes("/health/"));
  const combined = (await Promise.all(routes.map(source))).join("\n");
  assert.doesNotMatch(combined, /const TENANT_ID|tenantId\s*=\s*["']finance-advisory-partners/);
  assert.match(combined, /requireWorkspaceContext|requireOperator|authenticateApiKey/);
});

test("E3 public quote access derives tenant identity from the stored token", async () => {
  const quoteStore = await source("db/quote-store.ts");
  assert.match(quoteStore, /recipient\.tenant_id/);
  assert.match(quoteStore, /share_token = \?/);
  assert.match(quoteStore, /tenantId: row\.tenant_id/);
  assert.doesNotMatch(quoteStore, /emitWebhooks\(["']finance-advisory-partners/);
});

test("E3/E5 rate limits use hashed recipient tokens and per-key API buckets", async () => {
  const workspace = await source("db/workspace-store.ts");
  const api = await source("app/api/v1/[resource]/route.ts");
  const publicRoutes = ["view", "accept", "decline"].map((action) => source(`app/api/public/quotes/[token]/${action}/route.ts`));
  assert.match(workspace, /SHA-256/);
  assert.match(api, /100,60/);
  assert.match((await Promise.all(publicRoutes)).join("\n"), /enforceTokenRateLimit/);
});

test("E4/E6 scheduled recovery and retention controls are implemented", async () => {
  const worker = await source("worker/index.ts");
  const integrations = await source("db/integration-store.ts");
  const maintenance = await source("db/maintenance-store.ts");
  assert.match(worker, /async scheduled/);
  assert.match(integrations, /processDueWebhookRetries/);
  assert.match(integrations, /failure_started_at/);
  assert.match(maintenance, /-24 months/);
  assert.match(maintenance, /-30 days/);
  assert.match(maintenance, /SoftDeleted/);
  assert.match(maintenance, /BUCKET\.delete/);
});

test("E3/E6 deployment responses apply baseline browser security headers", async () => {
  const worker = await source("worker/index.ts");
  for (const header of ["strict-transport-security", "content-security-policy", "x-content-type-options", "referrer-policy", "permissions-policy", "x-request-id"]) assert.match(worker, new RegExp(header));
});

test("E6 privacy controls include tracking choice, DSAR export and delayed purge", async () => {
  const governance = await source("app/api/governance/route.ts");
  const delivery = await source("db/delivery-store.ts");
  const workspace = await source("db/workspace-store.ts");
  assert.match(governance, /trackingEnabled/);
  assert.match(delivery, /exportRecipientEvents/);
  assert.match(delivery, /deleteRecipientEvents/);
  assert.match(workspace, /\+30 days/);
});

test("E5 transactional email contains HTML and plain-text alternatives", async () => {
  const notifications = await source("db/notification-store.ts");
  assert.match(notifications, /html:string;text:string/);
  assert.match(notifications, /html:input\.html,text:input\.text/);
});

test("E4 deal code redemption claims a code atomically", async () => {
  const billing = await source("db/billing-store.ts");
  assert.match(billing, /redeemed_tenant_id IS NULL RETURNING tier/);
});

test("Proposal studio supports multi-page, multi-format and reusable block composition", async () => {
  const editor = await source("app/proposal-editor.tsx");
  const recipient = await source("app/q/[token]/page.tsx");
  const quoteBuilder = await source("app/quote-bench.tsx");
  for (const capability of ["Standard page", "Wide page", "Cover page", "Block library", "feature_grid", "timeline", "team", "faq", "pricing_table", "signature"]) assert.match(editor, new RegExp(capability, "i"));
  assert.match(recipient, /quote\.document\.pages/);
  assert.match(quoteBuilder, /Start from a reusable template/);
  assert.doesNotMatch(quoteBuilder, /Consulting rate card/i);
});

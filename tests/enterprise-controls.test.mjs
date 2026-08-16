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
  assert.match(notifications, /html:\s*string;\s*text:\s*string/);
  assert.match(notifications, /html:\s*input\.html,\s*text:\s*input\.text/);
});

test("E4 deal code redemption claims a code atomically", async () => {
  const billing = await source("db/billing-store.ts");
  assert.match(billing, /redeemed_tenant_id IS NULL RETURNING tier/);
});

test("Proposal studio supports multi-page, multi-format and reusable block composition", async () => {
  const editor = await source("app/proposal-editor.tsx");
  const recipient = await source("app/q/[token]/page.tsx");
  const quoteBuilder = await source("app/quote-bench.tsx");
  const quoteRoute = await source("app/api/quotes/route.ts");
  for (const capability of ["Standard page", "Wide page", "Cover page", "Block library", "feature_grid", "timeline", "team", "faq", "pricing_table", "signature"]) assert.match(editor, new RegExp(capability, "i"));
  assert.match(recipient, /quote\.document\.pages/);
  assert.match(quoteBuilder, /Selected template/);
  assert.match(quoteBuilder, /quote-workflow/);
  assert.match(quoteBuilder, /Proposal design workspace/);
  assert.match(quoteBuilder, /cloneTemplatePages/);
  assert.match(quoteBuilder, /templateId:selectedTemplateId/);
  assert.match(quoteBuilder, /Standard template for this quote/);
  assert.match(quoteRoute, /templateId:body\.document\?\.templateId/);
  assert.doesNotMatch(quoteBuilder, /Consulting rate card/i);
});

test("Service catalogue supports category hierarchy, proposal types and quote-level toggles", async()=>{
  const store=await source("db/catalogue-store.ts");
  const catalogueScreen=await source("app/catalogue-screen.tsx");
  const quoteBuilder=await source("app/quote-bench.tsx");
  const recipient=await source("app/q/[token]/page.tsx");
  assert.match(store,/service_categories/);
  assert.match(store,/catalogue_item_proposal_types/);
  assert.match(store,/default_included/);
  assert.match(catalogueScreen,/Subcategory/);
  assert.match(catalogueScreen,/Service schedule/);
  assert.match(catalogueScreen,/Service-specific terms/);
  assert.match(catalogueScreen,/Proposal-type availability/);
  assert.match(quoteBuilder,/toggle each eligible service on or off/i);
  assert.match(quoteBuilder,/defaultProposalTypeIds/);
  assert.match(quoteBuilder,/service-category-accordion/);
  assert.match(quoteBuilder,/service-subcategory-accordion/);
  assert.match(quoteBuilder,/aria-expanded=\{categoryOpen\}/);
  assert.match(quoteBuilder,/aria-expanded=\{subgroupOpen\}/);
  assert.match(quoteBuilder,/categorySelected/);
  assert.match(recipient,/Service schedule/);
  assert.match(recipient,/Service terms/);
});

test("Advanced CPQ, engagement governance, ordered e-signature and BYO AI are industrialised", async () => {
  const pricing = await source("packages/pricing-engine/src/index.ts");
  for (const capability of ["bundleItemIds", "optionalUpgradeItemIds", "requiredItemIds", "volumeTiers", "regionalPrices", "taxRateBp", "indexation", "includedUnits", "overagePriceMinor"]) assert.match(pricing, new RegExp(capability));
  const engagement = await source("db/engagement-store.ts");
  assert.match(engagement, /Published legal content is immutable/);
  assert.match(engagement, /missingMandatory/);
  assert.match(engagement, /SHA-256/);
  const signing = await source("db/delivery-store.ts");
  for (const capability of ["signer_role", "signing_order", "signature_required", "signed_at", "reminder_count", "recordRecipientSignature"]) assert.match(signing, new RegExp(capability));
  const ai = await source("db/ai-store.ts");
  assert.match(ai, /AES-GCM/);
  assert.match(ai, /redirect: "error"/);
  assert.match(ai, /human must approve every change/i);
  assert.doesNotMatch(ai, /openai\.com|anthropic\.com|googleapis\.com/i);
});

test("Enterprise shell groups navigation and contains the quote layout responsively", async () => {
  const quoteBench = await source("app/quote-bench.tsx");
  const css = await source("app/globals.css");
  for (const group of ["Commercial", "Content and governance", "Operations", "Administration"]) assert.match(quoteBench, new RegExp(group));
  assert.match(quoteBench, /aria-expanded/);
  assert.match(quoteBench, /navigation-backdrop/);
  assert.match(css, /grid-template-columns:minmax\(0,1fr\) minmax\(300px,340px\)/);
  assert.match(css, /@media \(max-width: 1320px\)[\s\S]*\.builder-grid \{ grid-template-columns:1fr; \}/);
  assert.match(css, /\.builder-workspace \{[^}]*overflow:hidden/);
  assert.match(css, /\.line-table \{[^}]*overflow-x:auto/);
  assert.match(css, /@media \(max-width: 1024px\)[\s\S]*transform:translateX\(-105%\)/);
});

test("Quote summary uses one structural content inset", async () => {
  const component = await source("app/quote-bench.tsx");
  const styles = await source("app/globals.css");
  assert.match(component, /className="summary-kicker"[\s\S]*className="quote-summary-body"[\s\S]*<h2>Quote summary<\/h2>/);
  assert.match(styles, /\.quote-summary-body\s*\{[^}]*padding:20px/);
  assert.match(styles, /\.quote-summary h2\s*\{[^}]*margin:0/);
  assert.doesNotMatch(styles, /\.quote-summary > \*\s*\{/);
  assert.match(styles, /\.preview-button\s*\{[^}]*width:100%[^}]*margin:10px 0 0/);
});

test("Horizon UI foundation and governed-content layout are explicit", async () => {
  const styles = await source("app/globals.css");
  const engagement = await source("app/engagement-screen.tsx");
  const notices = await source("THIRD_PARTY_NOTICES.md");
  for (const token of ["--horizon-brand", "--horizon-navy", "--horizon-canvas", "--horizon-radius"]) assert.match(styles, new RegExp(token));
  assert.match(styles, /\.engagement-layout\s*\{[^}]*grid-template-columns:minmax\(560px,1\.1fr\) minmax\(360px,\.9fr\)/);
  assert.match(styles, /@media \(max-width: 1260px\)[\s\S]*\.engagement-layout \{ grid-template-columns:1fr; \}/);
  for (const element of ["engagement-form-grid", "engagement-content-field", "policy-card", "proposal-scope-grid", "engagement-actions", "engagement-empty-state"]) assert.match(engagement, new RegExp(element));
  assert.match(notices, /Horizon UI/);
  assert.match(notices, /MIT License/);
});

test("Quote-builder internals use container-responsive layouts", async () => {
  const styles = await source("app/globals.css");
  assert.match(styles, /\.builder-workspace\s*\{[^}]*container-name:quote-workspace/);
  assert.match(styles, /\.document-content-block \.section-content\s*\{[^}]*container-name:proposal-editor/);
  assert.match(styles, /\.service-toggle-picker label\s*\{[^}]*grid-template-columns:35px minmax\(0,1fr\) auto/);
  assert.match(styles, /@container quote-workspace \(max-width: 760px\)[\s\S]*\.line-row \{ min-width:0;[^}]*grid-template-columns:repeat\(4,minmax\(0,1fr\)\) 50px/);
  assert.match(styles, /@container proposal-editor \(max-width: 1050px\)[\s\S]*\.proposal-studio \{[^}]*grid-template-columns:150px minmax\(0,1fr\)/);
  assert.match(styles, /@container proposal-editor \(max-width: 780px\)[\s\S]*\.proposal-studio \{ grid-template-columns:1fr; \}/);
  assert.match(styles, /@container proposal-editor \(max-width: 560px\)[\s\S]*\.proposal-block-fields \{ grid-template-columns:1fr; \}/);
  assert.match(styles, /\.proposal-design-editor \.section-content\s*\{[^}]*container-name:proposal-editor/);
  assert.match(styles, /\.proposal-design-footer\s*\{[^}]*position:sticky/);
  assert.match(styles, /\.button:disabled,\.proposal-support-actions \.disabled-upload\s*\{[^}]*opacity:1/);
});

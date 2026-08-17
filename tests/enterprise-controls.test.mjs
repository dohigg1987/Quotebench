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

test("Public authentication is sign-in only until commercial onboarding is enabled", async () => {
  const form = await source("app/auth/sign-in/auth-form.tsx");
  const proxy = await source("app/api/auth/[...path]/route.ts");
  assert.match(form, /signIn\.email/);
  assert.match(form, /New accounts are currently provisioned directly by QuoteBench/);
  assert.doesNotMatch(form, /signUp\.email|Create account|Create secure account/);
  assert.match(proxy, /path\[0\] === "sign-up"/);
  assert.match(proxy, /Self-registration is currently disabled/);
  assert.match(proxy, /status: 403/);
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
  const puck = await source("app/proposal-puck.tsx");
  const packageJson = await source("package.json");
  const recipient = await source("app/q/[token]/page.tsx");
  const quoteBuilder = await source("app/quote-bench.tsx");
  const quoteRoute = await source("app/api/quotes/route.ts");
  const studio = `${editor}\n${puck}`;
  for (const capability of ["Standard page", "Wide page", "Cover page", "Narrative", "Commercial", "Visual and structured", "feature_grid", "timeline", "team", "faq", "pricing_table", "signature"]) assert.match(studio, new RegExp(capability, "i"));
  assert.match(puck, /import \{ Puck, type Config \} from "@puckeditor\/core"/);
  assert.match(packageJson, /"@puckeditor\/core": "0\.22\.4"/);
  assert.match(recipient, /quote\.document\.pages/);
  assert.match(quoteBuilder, /Start from a standard template/);
  assert.match(quoteBuilder, /WorkflowSteps/);
  assert.match(quoteBuilder, /Proposal design workspace/);
  assert.match(quoteBuilder, /cloneTemplatePages/);
  assert.match(quoteBuilder, /templateId:selectedTemplateId/);
  assert.match(quoteBuilder, /independent, editable copy/);
  assert.match(quoteRoute, /templateId:body\.document\?\.templateId/);
  assert.doesNotMatch(quoteBuilder, /Consulting rate card/i);
});

test("Reusable templates use the visual editor and bind live quote metadata", async () => {
  const templates = await source("app/templates-screen.tsx");
  const studio = await source("app/template-studio.tsx");
  const editor = await source("app/proposal-editor.tsx");
  const shell = await source("app/quote-bench.tsx");
  const home = await source("app/page.tsx");
  const boundary = await source("app/workspace-error-boundary.tsx");
  const metadata = await source("lib/proposal-metadata.ts");
  const recipient = await source("app/q/[token]/page.tsx");
  const pdf = await source("lib/proposal-pdf.ts");
  assert.match(templates, /Proposal templates/);
  assert.match(templates, /<TemplateStudio/);
  assert.match(studio, /Visual template editor/);
  assert.match(studio, /context="template"/);
  assert.match(studio, /import ProposalEditor from "\.\/proposal-editor"/);
  assert.match(studio, /useCallback/);
  assert.match(editor, /Data fields/);
  assert.match(editor, /EditorErrorBoundary/);
  assert.doesNotMatch(editor, /ReliableBlockEditor/);
  const puckSource = await source("app/proposal-puck.tsx");
  assert.match(puckSource, /function renderPuckValue/);
  assert.match(puckSource, /isValidElement\(value\)/);
  assert.doesNotMatch(puckSource, /resolveProposalText\(props\.(?:title|content) as string/);
  const telemetry = await source("app/api/client-errors/route.ts");
  assert.match(telemetry, /getCurrentUser/);
  assert.match(telemetry, /quotebench_client_error/);
  assert.match(await source("app/proposal-puck.tsx"), /PUCK_IFRAME = \{ enabled: false, waitForStyles: false, syncHostStyles: false \}/);
  assert.match(shell, /lazy\(\(\) => import\("\.\/templates-screen"\)\)/);
  assert.match(shell, /searchParams\.set\("screen", screen\)/);
  assert.match(shell, /WorkspaceErrorBoundary/);
  assert.match(home, /initialScreen=\{initialScreen\}/);
  assert.match(boundary, /Reload editor/);
  for (const token of ["client.name", "client.contact_name", "quote.reference", "proposal.title", "quote.valid_until", "brand.name"]) assert.match(metadata, new RegExp(token.replace(".", "\\.")));
  assert.match(recipient, /resolveProposalText/);
  assert.match(pdf, /resolveProposalText/);
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
  for (const group of ["Commercial", "Commercial foundation", "Operations", "Workspace"]) assert.match(quoteBench, new RegExp(group));
  assert.match(quoteBench, /aria-expanded/);
  assert.match(quoteBench, /navigation-backdrop/);
  assert.match(css, /grid-template-columns:minmax\(0,1fr\) minmax\(300px,340px\)/);
  assert.match(css, /@media \(max-width: 1320px\)[\s\S]*\.builder-grid \{ grid-template-columns:1fr; \}/);
  assert.match(css, /\.builder-workspace \{[^}]*overflow:hidden/);
  assert.match(css, /\.line-table \{[^}]*overflow-x:auto/);
  assert.match(css, /@media \(max-width: 1024px\)[\s\S]*transform:translateX\(-105%\)/);
});

test("Commercial workspace opens on a data-led overview", async () => {
  const quoteBench = await source("app/quote-bench.tsx");
  const page = await source("app/page.tsx");
  const layout = await source("app/layout.tsx");
  for (const capability of ["OverviewScreen", "Active pipeline", "Decision rate", "Quote progression", "Workspace readiness", "Recent activity"]) {
    assert.match(quoteBench, new RegExp(capability));
  }
  assert.match(quoteBench, /if \(screen === "overview"\) url\.searchParams\.delete\("screen"\)/);
  assert.match(page, /const initialScreen = requestedScreen[\s\S]*: "overview"/);
  assert.match(page, /initialScreen=\{initialScreen\}/);
  assert.match(layout, /commercial-grade\.css/);
  assert.doesNotMatch(layout, /codex-preview/);
});

test("Search, notifications and help are functional workspace utilities", async () => {
  const quoteBench = await source("app/quote-bench.tsx");
  const notificationRoute = await source("app/api/notifications/route.ts");
  const notificationStore = await source("db/notification-store.ts");
  for (const component of ["SearchPalette", "NotificationsPanel", "HelpPanel", "UtilityLayer"]) assert.match(quoteBench, new RegExp(component));
  for (const action of ["onSearch", "onNotifications", "onHelp", "markNotificationsRead", "onOpenQuote"]) assert.match(quoteBench, new RegExp(action));
  assert.match(notificationRoute,/markNotificationsRead/);
  assert.match(notificationStore,/notification_reads/);
  assert.match(quoteBench, /event\.key\.toLowerCase\(\)==="k"/);
  assert.match(quoteBench, /event\.key==="Escape"/);
  assert.match(quoteBench, /aria-modal="true"/);
  assert.match(quoteBench, /mailto:dennis\.ohiggins@gmail\.com/);
});

test("Commercial design layer contains desktop, mobile and reduced-motion safeguards", async () => {
  const styles = await source("app/commercial-grade.css");
  for (const selector of [".sidebar", ".topbar", ".overview-hero", ".overview-metrics", ".pipeline-chart", ".utility-layer", ".utility-panel"]) {
    assert.match(styles, new RegExp(selector.replace(".", "\\.")));
  }
  assert.match(styles, /@media \(max-width: 1100px\)/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
}
);

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
  const premium = await source("app/horizon-premium.css");
  assert.match(styles, /\.builder-workspace\s*\{[^}]*container-name:quote-workspace/);
  assert.match(styles, /\.document-content-block \.section-content\s*\{[^}]*container-name:proposal-editor/);
  assert.match(styles, /\.service-toggle-picker label\s*\{[^}]*grid-template-columns:35px minmax\(0,1fr\) auto/);
  assert.match(styles, /@container quote-workspace \(max-width: 760px\)[\s\S]*\.line-row \{ min-width:0;[^}]*grid-template-columns:repeat\(4,minmax\(0,1fr\)\) 50px/);
  assert.match(premium, /\.puck-page-controls \{[\s\S]*grid-template-columns: minmax\(220px, 1fr\)/);
  assert.match(premium, /@container proposal-editor \(max-width: 900px\)[\s\S]*\.puck-page-controls \{ grid-template-columns:/);
  assert.match(premium, /@container proposal-editor \(max-width: 620px\)[\s\S]*\.puck-page-controls \{ grid-template-columns: 1fr; \}/);
  assert.match(styles, /\.proposal-design-editor \.section-content\s*\{[^}]*container-name:proposal-editor/);
  assert.match(styles, /\.proposal-design-footer\s*\{[^}]*position:sticky/);
  assert.match(styles, /\.button:disabled,\.proposal-support-actions \.disabled-upload\s*\{[^}]*opacity:1/);
});

test("Final review and issue is a governed Horizon workflow stage", async () => {
  const quoteBuilder = await source("app/quote-bench.tsx");
  const quoteRoute = await source("app/api/quotes/route.ts");
  const styles = await source("app/globals.css");
  assert.match(quoteBuilder, /type BuilderStep = "client" \| "services" \| "proposal" \| "governance" \| "review"/);
  for (const capability of ["review-issue-page", "Readiness assessment", "Commercial snapshot", "Approval and issue", "Files and PDF", "ProposalDocument", "copyRecipientLink"]) assert.match(quoteBuilder, new RegExp(capability));
  assert.match(quoteBuilder, /attempt < 10/);
  assert.match(quoteBuilder, /if \(issuing \|\| lifecycleStatus !== "Ready"\) return/);
  assert.match(quoteRoute, /requiredBlocks = \["pricing_table", "terms", "signature"\]/);
  assert.match(quoteRoute, /validity date must not have passed/);
  assert.match(styles, /\.review-issue-grid\s*\{[^}]*grid-template-columns:minmax\(0,1\.6fr\) minmax\(340px,\.7fr\)/);
  assert.match(styles, /@container review-document \(max-width: 820px\)/);
  assert.match(styles, /\.horizon-client-document\s*\{/);
});

test("Presentation architecture uses governed primitives and a five-stage responsive workflow", async () => {
  const layout = await source("app/layout.tsx");
  const quoteBuilder = await source("app/quote-bench.tsx");
  const primitives = await source("app/ui/system.tsx");
  const styles = await source("app/design-system.css");
  assert.match(layout, /import "\.\/globals\.css";[\s\S]*import "\.\/design-system\.css";/);
  for (const step of ["client", "services", "proposal", "governance", "review"]) assert.match(quoteBuilder, new RegExp(`id:\"${step}\"`));
  assert.match(quoteBuilder, /<WorkflowSteps steps=\{workflowSteps\}/);
  assert.match(quoteBuilder, /governance-stage-page/);
  assert.match(quoteBuilder, /Server-enforced governance/);
  assert.match(primitives, /export function WorkflowSteps/);
  assert.match(primitives, /export function GovernanceCheck/);
  for (const token of ["--qb-brand-500", "--qb-navy-900", "--qb-canvas", "--qb-shadow-card", "--qb-radius-lg"]) assert.match(styles, new RegExp(token));
  assert.match(styles, /\.quote-workflow \{[^}]*grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
  assert.match(styles, /@media \(max-width:1100px\)[\s\S]*\.quote-workflow \{[^}]*overflow-x:auto/);
  assert.match(styles, /@media \(max-width:768px\)[\s\S]*\.proposal-design-footer,.governance-stage-footer,.review-issue-footer/);
  assert.match(styles, /font-size:13px/);
  assert.match(styles, /:focus-visible/);
  assert.match(styles, /prefers-reduced-motion:reduce/);
});

test("Enterprise visual system avoids decorative AI-dashboard conventions", async () => {
  const styles = await source("app/design-system.css");
  const quoteBuilder = await source("app/quote-bench.tsx");
  assert.match(styles, /--qb-brand-500:#1d4ed8/);
  assert.match(styles, /--qb-radius-lg:8px/);
  assert.match(styles, /--qb-shadow-card:0 1px 2px/);
  assert.doesNotMatch(styles, /#4318ff|#f3f0ff|#e5deff/);
  assert.match(styles, /\.quote-workflow \{[^}]*box-shadow:none/);
  assert.match(styles, /\.button\.primary \{[^}]*box-shadow:none/);
  assert.match(styles, /\.horizon-client-document > header,.recipient-cover \{ background:var\(--qb-navy-900\)/);
  assert.match(styles, /\.signin-panel h1 \{ font-family:inherit/);
  assert.match(quoteBuilder, /Quote totals/);
  assert.match(quoteBuilder, /Published rule set/);
  assert.doesNotMatch(quoteBuilder, /Engine verified/);
});

test("Supplied Horizon UI system is integrated as a licensed, dependency-safe premium layer", async () => {
  const layout = await source("app/layout.tsx");
  const premium = await source("app/horizon-premium.css");
  const shell = await source("app/quote-bench.tsx");
  const notices = await source("THIRD_PARTY_NOTICES.md");
  const fonts = await readdir(path.join(root, "public/fonts/dm-sans"));
  assert.match(layout, /import "\.\/horizon-premium\.css"/);
  assert.match(premium, /--qb-brand-500: #4318ff/);
  assert.match(premium, /font-family: "DM Sans"/);
  assert.match(premium, /Responsive parity with Horizon/);
  assert.match(shell, /function HorizonIcon/);
  assert.match(shell, /nav-icon/);
  assert.match(notices, /Copyright \(c\) 2023 Horizon UI/);
  for (const font of ["DMSans-Regular.ttf", "DMSans-Medium.ttf", "DMSans-Bold.ttf"]) assert.ok(fonts.includes(font));
});

test("Proposal page and block mutations preserve selection, identity and governance", async () => {
  const editor = await source("app/proposal-editor.tsx");
  const puck = await source("app/proposal-puck.tsx");
  const adapter = await source("lib/proposal-puck-data.ts");
  assert.match(editor, /function cloneBlock[\s\S]*items: block\.items\?\.map\(\(item\) => \(\{ \.\.\.item, id: crypto\.randomUUID\(\) \}\)\)/);
  assert.match(editor, /const addPage =[\s\S]*setSelectedId\(nextPage\.id\)/);
  assert.match(editor, /const duplicatePage =[\s\S]*blocks: page\.blocks\.map\(cloneBlock\)[\s\S]*setSelectedId\(copy\.id\)/);
  assert.match(editor, /const removePage =[\s\S]*setSelectedId\(next\[Math\.min\(pageIndex, next\.length - 1\)\]\.id\)/);
  assert.match(editor, /pages\.length >= 40/);
  assert.match(adapter, /data\.content\.slice\(0, 60\)/);
  assert.match(puck, /governedTypes\.has\(type\) \? \{ delete: false, duplicate: false \}/);
  assert.match(puck, /const permissions = useMemo\(\(\) => \(\{ delete: !readOnly, drag: !readOnly/);
  assert.match(puck, /permissions=\{permissions\}/);
});

test("Every application surface participates in the shared fit and reflow contract", async () => {
  const styles = await source("app/globals.css");
  const governance = await source("app/governance-screen.tsx");
  const operator = await source("app/operator-screen.tsx");
  const catalogue = await source("app/catalogue-screen.tsx");
  const ai = await source("app/ai-assistance-screen.tsx");
  const delivery = await source("app/delivery-screen.tsx");
  const recipient = await source("app/q/[token]/page.tsx");
  for (const selector of ["governance-row", "economics-grid", "security-event-row", "operator-table", "member-table", "webhook-log"]) assert.match(styles, new RegExp(`\\.${selector}`));
  assert.match(governance, /security-event-table/);
  assert.match(governance, /governance-delete-panel/);
  assert.match(operator, /operator-table/);
  assert.match(catalogue, /governance-row/);
  assert.match(ai, /economics-grid/);
  assert.match(delivery, /signer-editor-row/);
  assert.match(recipient, /recipient-shell/);
  assert.match(styles, /@media \(max-width: 1180px\)[\s\S]*\.integration-admin-grid,\.brand-studio-grid \{ grid-template-columns:1fr; \}/);
  assert.match(styles, /@media \(max-width: 720px\)[\s\S]*\.team-invite-fields,\.economics-grid,[^}]*\.plan-limits \{ grid-template-columns:1fr; \}/);
  assert.match(styles, /@media \(max-width: 720px\)[\s\S]*\.signer-editor-row \{ min-width:0 !important;[^}]*grid-template-columns:1fr !important/);
  assert.match(styles, /\.recipient-document \{[^}]*border-radius:20px[^}]*color:var\(--horizon-navy\)/);
  assert.match(styles, /@media \(max-width: 720px\)[\s\S]*\.recipient-accept \{ grid-template-columns:1fr;/);
});

test("Visual QA surfaces are production-inaccessible and layout-critical controls reflow by container", async () => {
  const fixture = await source("app/visual-regression/page.tsx");
  const adminFixture = await source("app/visual-regression/admin/page.tsx");
  const styles = await source("app/horizon-premium.css");
  const delivery = await source("app/delivery-screen.tsx");
  for (const route of [fixture, adminFixture]) {
    assert.match(route, /process\.env\.NODE_ENV !== "development"/);
    assert.match(route, /notFound\(\)/);
  }
  assert.match(styles, /\.platform-admin-link \{[\s\S]*grid-template-columns: 34px minmax\(0, 1fr\) auto/);
  assert.match(styles, /\.panel-toolbar > div:first-child \{[\s\S]*display: grid/);
  assert.match(styles, /\.signer-editor-row \{[\s\S]*min-width: 0 !important;[\s\S]*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(styles, /\.puck-page-controls \{[\s\S]*display: grid/);
  assert.match(styles, /\.qb-puck-document \{[\s\S]*max-width: 920px/);
  assert.match(styles, /\.horizon-client-document \.recipient-content-block > \.document-scope,[\s\S]*\.recipient-document \.recipient-content-block > \.recipient-scope \{[\s\S]*padding: 0;[\s\S]*border-radius: 14px 14px 0 0/);
  assert.match(styles, /\.document-scope > \.proposal-service-line,[\s\S]*\.recipient-scope > \.proposal-service-line \{[\s\S]*padding-right: 28px;[\s\S]*padding-left: 28px/);
  assert.match(styles, /@media \(max-width: 560px\)[\s\S]*\.document-totals,[\s\S]*\.recipient-totals \{[\s\S]*padding-right: 18px;[\s\S]*padding-left: 18px/);
  assert.match(fixture, /requested\.screen === "pricing-preview"/);
  assert.match(fixture, /requested\.screen === "pricing-recipient"/);
  for (const label of ["Full name", "Email address", "Role", "Signing order", "Link expiry"]) assert.match(delivery, new RegExp(`>${label}<`));
});

test("Platform administration is a separate, server-gated multi-tenant control plane", async () => {
  const page = await source("app/admin/page.tsx");
  const shell = await source("app/quote-bench.tsx");
  const route = await source("app/api/operator/route.ts");
  const store = await source("db/operator-store.ts");
  assert.match(page, /hasOperatorAccess/);
  assert.match(page, /OperatorScreen/);
  assert.match(shell, /operatorAccess && <a className="platform-admin-link" href="\/admin"/);
  assert.match(route, /requireOperator/);
  assert.match(store, /FROM tenants t LEFT JOIN billing_subscriptions/);
  assert.doesNotMatch(store, /FROM tenant_cohorts c\s+LEFT JOIN tenants/);
  for (const action of ["tenant.profile_updated", "tenant.archive_exported", "member.invited", "entitlement.override_set", "support.note_added"]) assert.match(store, new RegExp(action.replace(".", "\\.")));
  assert.match(store, /before_json/);
  assert.match(store, /after_json/);
  assert.match(store, /reason/);
});

test("Commercial entitlements are unified and enforced at every chargeable boundary", async () => {
  const plans = await source("db/plans.ts");
  const entitlements = await source("db/entitlement-store.ts");
  const clients = await source("db/client-store.ts");
  const members = await source("db/member-store.ts");
  const quotes = await source("db/quote-store.ts");
  const uploads = await source("app/api/uploads/route.ts");
  const pdfs = await source("app/api/pdfs/route.ts");
  const delivery = await source("app/api/delivery/route.ts");
  for (const plan of ["Trial", "Starter", "Professional", "Scale"]) assert.match(plans, new RegExp(`${plan}:`));
  for (const metric of ["clients", "seats", "quotes", "pdfs", "emails", "storage"]) assert.match(entitlements, new RegExp(`${metric}:`));
  assert.match(entitlements, /Math\.ceil\(target\.limit \* 1\.1\)/);
  assert.match(clients, /assertCapacity\(tenantId, "clients"\)/);
  assert.match(members, /assertCapacity\(tenantId, "seats"\)/);
  assert.match(quotes, /assertCapacity\(tenantId, "quotes"\)/);
  assert.match(uploads, /assertCapacity\(member\.tenantId,\s*"storage",\s*file\.size\)/);
  assert.match(pdfs, /assertCapacity\([^,]+,\s*"pdfs"\)/);
  assert.match(delivery, /assertCapacity\([^,]+,\s*"emails"/);
  assert.doesNotMatch(quotes, /INSERT OR IGNORE INTO workspace_entitlements/);
  assert.match(quotes, /DEFAULT 'Trial'/);
});

test("Billing lifecycle supports plan checkout, portal, signed idempotent webhooks and invoices", async () => {
  const billing = await source("db/billing-store.ts");
  const webhook = await source("app/api/billing/webhook/route.ts");
  const operator = await source("app/operator-screen.tsx");
  for (const price of ["STRIPE_PRICE_STARTER", "STRIPE_PRICE_PROFESSIONAL", "STRIPE_PRICE_SCALE"]) assert.match(billing, new RegExp(price));
  assert.match(billing, /billing_portal\/sessions/);
  assert.match(billing, /automatic_tax\[enabled\]/);
  assert.match(webhook, /candidates = parts\.filter\(\(\[key\]\) => key === "v1"\)/);
  assert.match(webhook, /Math\.abs\(Date\.now\(\) \/ 1000 - Number\(timestamp\)\) >= 300/);
  assert.match(webhook, /SELECT id FROM billing_events WHERE provider_event_id=\?/);
  assert.match(webhook, /event\.type\.startsWith\("invoice\."\)/);
  assert.match(operator, /Invoice register/);
  assert.match(operator, /Billing event stream/);
});

test("Operator customer records expose governed profile, user, support and security workflows", async () => {
  const operator = await source("app/operator-screen.tsx");
  const route = await source("app/api/operator/route.ts");
  const styles = await source("app/globals.css");
  for (const capability of ["Workspace profile", "Invite user", "Entitlement override", "Security evidence", "Platform administration history", "Export archive"]) assert.match(operator, new RegExp(capability));
  assert.match(route, /customer_profile/);
  assert.match(route, /member_invite/);
  assert.match(route, /message\.startsWith\("forbidden:"\) \? 403/);
  assert.match(styles, /\.operator-users-layout/);
  assert.match(styles, /@media \(max-width: 1180px\)[\s\S]*\.operator-users-layout \{ grid-template-columns:1fr; \}/);
  assert.match(styles, /@media \(max-width: 780px\)[\s\S]*\.operator-profile-grid/);
});

test("Commercial activity is tenant-scoped, actionable and never populated with fabricated buyers", async () => {
  const shell = await source("app/quote-bench.tsx");
  const route = await source("app/api/activity/route.ts");
  const store = await source("db/delivery-store.ts");
  const styles = await source("app/commercial-grade.css");
  assert.match(route, /requireWorkspaceContext\(user, \["owner", "admin", "quoter"\]\)/);
  assert.match(route, /listWorkspaceActivity\(context\.tenantId\)/);
  assert.match(store, /WHERE e\.tenant_id=\?/);
  assert.match(shell, /Open quote and act/);
  assert.match(shell, /Inspect evidence/);
  assert.match(styles, /\.activity-metric-strip/);
  for (const fabricated of ["Stellar Grid", "Maya Patel", "Northstar Analytics", "7 recipients are reviewing proposals"]) assert.doesNotMatch(shell, new RegExp(fabricated));
});

test("New quotes start clean and inherit workspace identity instead of demo consultancy data", async () => {
  const shell = await source("app/quote-bench.tsx");
  const route = await source("app/api/quotes/route.ts");
  const recipient = await source("app/q/[token]/page.tsx");
  assert.match(shell, /workspace=\{workspace\}/);
  assert.match(shell, /disabled=\{!reviewReadiness\[0\]\.complete\}/);
  assert.match(route, /brandName: body\.document\?\.brandName\?\.trim\(\) \|\| member\.workspaceName/);
  assert.doesNotMatch(route, /Finance Advisory Partners/);
  assert.doesNotMatch(recipient, /Finance Advisory Partners/);
});

test("Owner command centre unifies platform, customer, plan, Stripe and operational control", async () => {
  const operator = await source("app/operator-screen.tsx");
  const store = await source("db/operator-store.ts");
  const styles = await source("app/commercial-grade.css");
  for (const capability of ["QuoteBench command centre", "Platform health", "Plans and entitlements", "Stripe and payments", "Customer control", "Release commit"]) assert.match(operator, new RegExp(capability));
  for (const measure of ["active_users", "failed_pdfs_24h", "billing_failures_24h", "security_failures_24h", "collected_month_minor", "outstanding_minor"]) assert.match(store, new RegExp(measure));
  assert.match(store, /STRIPE_WEBHOOK_SECRET/);
  assert.match(store, /CF_VERSION_METADATA/);
  assert.match(styles, /\.command-health-grid/);
  assert.match(styles, /@media \(max-width: 850px\)[\s\S]*\.command-two-column/);
});


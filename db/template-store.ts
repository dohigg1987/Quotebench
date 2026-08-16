import { defaultRuleSet } from "../app/demo-data";
import { money, type CatalogueItem, type RuleSet } from "../packages/pricing-engine/src/index";
import type { DocumentBlock } from "./document-store";

type IndustryTemplate = { id: string; name: string; version: number; summary: string; items: CatalogueItem[]; ruleSet: RuleSet; blocks: DocumentBlock[] };

const industries = [
  { id: "creative-agency", name: "Marketing and creative agency", summary: "Campaign strategy, creative production, retainers and media handling.", category: "creative", bandName: "Campaign concept", bandPrice: 185000, recurringName: "Creative retainer", recurringPrice: 395000, productName: "Media placement", productCost: 80000, margin: 2000, fixedName: "Brand discovery", fixedPrice: 240000, intro: "A campaign proposal balancing distinctive creative work with measurable commercial outcomes." },
  { id: "web-development", name: "Web and app development", summary: "Discovery, delivery sprints, support plans and software licences.", category: "development", bandName: "Delivery sprint", bandPrice: 720000, recurringName: "Support plan", recurringPrice: 210000, productName: "Cloud licence", productCost: 4200, margin: 4000, fixedName: "Technical discovery", fixedPrice: 325000, intro: "A pragmatic product delivery plan covering discovery, engineering, release and ongoing support." },
  { id: "managed-services", name: "IT managed services", summary: "Onboarding, per-device support, monitoring and third-party licences.", category: "managed-it", bandName: "Device onboarding", bandPrice: 12500, recurringName: "Managed support", recurringPrice: 185000, productName: "Security licence", productCost: 680, margin: 4500, fixedName: "Network assessment", fixedPrice: 195000, intro: "A resilient managed service designed to reduce operational risk and give users dependable support." },
  { id: "trades-fitout", name: "Trades, installation and fit-out", summary: "Site surveys, installation days, maintenance and supplied materials.", category: "installation", bandName: "Installation day", bandPrice: 95000, recurringName: "Maintenance cover", recurringPrice: 32000, productName: "Supplied materials", productCost: 150000, margin: 3000, fixedName: "Site survey", fixedPrice: 45000, intro: "A clear scope for survey, supply, installation and practical aftercare on site." },
] as const;

export const INDUSTRY_TEMPLATES: IndustryTemplate[] = industries.map((source) => {
  const bandId = `${source.id}-banded`; const recurringId = `${source.id}-recurring`; const productId = `${source.id}-product`; const fixedId = `${source.id}-fixed`;
  const items: CatalogueItem[] = [
    { id: bandId, categoryId: source.category, name: source.bandName, unitLabel: source.id === "managed-services" ? "device" : "unit", pricingBasis: "per_unit", basePriceMinor: money.minor(source.bandPrice), recurrence: "one_off", minQuantity: 1, maxQuantity: 100 },
    { id: recurringId, categoryId: source.category, name: source.recurringName, unitLabel: "month", pricingBasis: "fixed", basePriceMinor: money.minor(source.recurringPrice), recurrence: "monthly", minQuantity: 1, maxQuantity: 1 },
    { id: productId, categoryId: "products", name: source.productName, unitLabel: "unit", pricingBasis: "cost_plus", costMinor: money.minor(source.productCost), targetMarginBp: money.bp(source.margin), recurrence: "monthly", minQuantity: 1, maxQuantity: 1000 },
    { id: fixedId, categoryId: source.category, name: source.fixedName, unitLabel: "project", pricingBasis: "fixed", basePriceMinor: money.minor(source.fixedPrice), recurrence: "one_off", minQuantity: 1, maxQuantity: 1 },
  ];
  const ruleSet: RuleSet = { ...defaultRuleSet, id: `${source.id}-rules`, version: 1, quantityBands: [{ id: `${source.id}-volume`, itemId: bandId, fromQuantity: 5, unitPriceMinor: money.minor(Math.round(source.bandPrice * 0.9)), priority: 10 }], modifiers: [{ id: `${source.id}-complexity`, name: "Complex scope", scope: "all", triggerQuestionId: "delivery-complexity", triggerValue: "complex", adjustmentKind: "percentage", adjustmentValue: 1500, sequence: 10 }], minimumFees: [{ itemId: bandId, minimumMinor: money.minor(Math.round(source.bandPrice * 0.75)) }], questions: [{ id: "delivery-complexity", prompt: "Delivery complexity", helpText: "Applies a governed adjustment for additional coordination and risk.", inputKind: "single_choice", required: true, options: [{ value: "standard", label: "Standard", helpText: "No adjustment" }, { value: "complex", label: "Complex", helpText: "+15%" }] }] };
  const blocks: DocumentBlock[] = [{ id: "intro", type: "text", title: "Our approach", content: source.intro, enabled: true }, { id: "pricing", type: "pricing_table", title: "Scope and investment", display: "full", locked: true, enabled: true }, { id: "terms", type: "terms", title: "Terms", content: "Fees exclude VAT. Work begins following written acceptance and agreed scheduling.", locked: true, enabled: true }, { id: "signature", type: "signature", title: "Acceptance", locked: true, enabled: true }];
  return { id: source.id, name: source.name, version: 1, summary: source.summary, items, ruleSet, blocks };
});

const STATE_SCHEMA = `CREATE TABLE IF NOT EXISTS onboarding_state (tenant_id TEXT NOT NULL, user_email TEXT NOT NULL, selected_template TEXT, status TEXT NOT NULL, walkthrough_step INTEGER NOT NULL DEFAULT 0, completed_at TEXT, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (tenant_id, user_email))`;
const PERSONAL_SCHEMA = `CREATE TABLE IF NOT EXISTS personal_templates (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, name TEXT NOT NULL, snapshot_json TEXT NOT NULL, created_by TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`;
async function database() { const { env } = await import("cloudflare:workers"); if (!env.DB) throw new Error("Template storage is unavailable."); return env.DB; }
async function ensure() { const db = await database(); await db.batch([db.prepare(STATE_SCHEMA), db.prepare(PERSONAL_SCHEMA), db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS onboarding_state_tenant_user_unique ON onboarding_state (tenant_id, user_email)"), db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS personal_templates_tenant_name_unique ON personal_templates (tenant_id, name)")]); return db; }

export async function getTemplateWorkspace(tenantId: string, email: string) {
  const db = await ensure();
  const [state, personal, catalogueCount] = await Promise.all([
    db.prepare("SELECT selected_template, status, walkthrough_step, completed_at FROM onboarding_state WHERE tenant_id = ? AND user_email = ?").bind(tenantId, email).first<Record<string, unknown>>(),
    db.prepare("SELECT id, name, created_at FROM personal_templates WHERE tenant_id = ? ORDER BY created_at DESC").bind(tenantId).all<Record<string, unknown>>(),
    db.prepare("SELECT COUNT(*) AS count FROM catalogue_items WHERE tenant_id = ?").bind(tenantId).first<{ count: number }>(),
  ]);
  return { templates: INDUSTRY_TEMPLATES.map((template) => ({ id: template.id, name: template.name, version: template.version, summary: template.summary, itemCount: template.items.length, questionCount: template.ruleSet.questions?.length ?? 0, blockCount: template.blocks.length })), personalTemplates: personal.results, state: state ?? { status: "NotStarted", walkthrough_step: 0 }, existingCatalogueItems: catalogueCount?.count ?? 0 };
}

export async function provisionIndustry(tenantId: string, email: string, templateId: string) {
  const template = INDUSTRY_TEMPLATES.find((entry) => entry.id === templateId); if (!template) throw new Error("Unknown industry template."); const db = await ensure();
  const statements = template.items.map((item) => db.prepare(`INSERT INTO catalogue_items (tenant_id,id,category_id,name,unit_label,pricing_basis,base_price_minor,cost_minor,target_margin_bp,recurrence,min_quantity,max_quantity,updated_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(tenant_id,id) DO NOTHING`).bind(tenantId, item.id, item.categoryId, item.name, item.unitLabel, item.pricingBasis, item.basePriceMinor ?? null, item.costMinor ?? null, item.targetMarginBp ?? null, item.recurrence, item.minQuantity ?? null, item.maxQuantity ?? null, email));
  await db.batch([
    ...statements,
    db.prepare("UPDATE pricing_rule_sets SET status = 'Archived', updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND status = 'Published'").bind(tenantId),
    db.prepare("INSERT OR REPLACE INTO pricing_rule_sets (tenant_id,id,version,status,rule_json,updated_by,published_at) VALUES (?,?,1,'Published',?,?,CURRENT_TIMESTAMP)").bind(tenantId, template.ruleSet.id, JSON.stringify(template.ruleSet), email),
    db.prepare("UPDATE document_templates SET is_default = 0 WHERE tenant_id = ?").bind(tenantId),
    db.prepare("INSERT OR REPLACE INTO document_templates (id,tenant_id,name,industry,blocks_json,is_default,created_by) VALUES (?,?,?,?,?,1,?)").bind(`industry-${template.id}`, tenantId, `${template.name} proposal`, template.name, JSON.stringify(template.blocks), email),
    db.prepare("INSERT INTO onboarding_state (tenant_id,user_email,selected_template,status,walkthrough_step) VALUES (?,?,?,'InProgress',1) ON CONFLICT(tenant_id,user_email) DO UPDATE SET selected_template=excluded.selected_template,status='InProgress',walkthrough_step=1,updated_at=CURRENT_TIMESTAMP").bind(tenantId, email, template.id),
  ]);
  return getTemplateWorkspace(tenantId, email);
}

export async function updateOnboarding(tenantId: string, email: string, action: "skip" | "resume" | "complete") { const db = await ensure(); const status = action === "skip" ? "Skipped" : action === "complete" ? "Completed" : "InProgress"; const step = action === "complete" ? 4 : action === "resume" ? 1 : 0; await db.prepare("INSERT INTO onboarding_state (tenant_id,user_email,status,walkthrough_step,completed_at) VALUES (?,?,?,?,CASE WHEN ?='Completed' THEN CURRENT_TIMESTAMP ELSE NULL END) ON CONFLICT(tenant_id,user_email) DO UPDATE SET status=excluded.status,walkthrough_step=excluded.walkthrough_step,completed_at=excluded.completed_at,updated_at=CURRENT_TIMESTAMP").bind(tenantId, email, status, step, status).run(); return getTemplateWorkspace(tenantId, email); }

export async function savePersonalTemplate(tenantId: string, email: string, name: string) { const db = await ensure(); const [items, rules, documents] = await Promise.all([db.prepare("SELECT * FROM catalogue_items WHERE tenant_id = ?").bind(tenantId).all(), db.prepare("SELECT rule_json FROM pricing_rule_sets WHERE tenant_id = ? AND status = 'Published' ORDER BY version DESC LIMIT 1").bind(tenantId).first<{ rule_json: string }>(), db.prepare("SELECT blocks_json FROM document_templates WHERE tenant_id = ? AND is_default = 1 LIMIT 1").bind(tenantId).first<{ blocks_json: string }>()]); await db.prepare("INSERT INTO personal_templates (id,tenant_id,name,snapshot_json,created_by) VALUES (?,?,?,?,?)").bind(crypto.randomUUID(), tenantId, name.trim(), JSON.stringify({ items: items.results, ruleSet: rules ? JSON.parse(rules.rule_json) : null, blocks: documents ? JSON.parse(documents.blocks_json) : [] }), email).run(); return getTemplateWorkspace(tenantId, email); }

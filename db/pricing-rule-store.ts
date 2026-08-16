import { getDatabase } from "./database.ts";
import { defaultRuleSet } from "../app/demo-data";
import type { RuleSet } from "../packages/pricing-engine/src/index";

const RULES_SCHEMA = `CREATE TABLE IF NOT EXISTS pricing_rule_sets (
  tenant_id TEXT NOT NULL,
  id TEXT NOT NULL,
  version INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Draft', 'Published', 'Archived')),
  rule_json TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  published_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`;

async function database() {
  return getDatabase("Pricing rule storage is unavailable");
}

async function ensureRules(tenantId: string) {
  const db = await database();
  await db.batch([
    db.prepare(RULES_SCHEMA),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS pricing_rule_sets_tenant_version_unique ON pricing_rule_sets (tenant_id, id, version)"),
    db.prepare("CREATE INDEX IF NOT EXISTS pricing_rule_sets_tenant_status_idx ON pricing_rule_sets (tenant_id, status)"),
  ]);
  await db.prepare(`INSERT OR IGNORE INTO pricing_rule_sets
      (tenant_id, id, version, status, rule_json, updated_by, published_at)
    VALUES (?, ?, ?, 'Published', ?, 'system-seed', CURRENT_TIMESTAMP)`)
    .bind(tenantId, defaultRuleSet.id, defaultRuleSet.version, JSON.stringify(defaultRuleSet))
    .run();
}

function parseRule(value: string): RuleSet {
  const parsed = JSON.parse(value) as RuleSet;
  return { ...parsed, questions: parsed.questions ?? defaultRuleSet.questions };
}

export async function getRuleWorkspace(tenantId: string) {
  await ensureRules(tenantId);
  const db = await database();
  const [published, draft] = await Promise.all([
    db.prepare(`SELECT rule_json FROM pricing_rule_sets WHERE tenant_id = ? AND status = 'Published'
      ORDER BY version DESC LIMIT 1`).bind(tenantId).first<{ rule_json: string }>(),
    db.prepare(`SELECT rule_json FROM pricing_rule_sets WHERE tenant_id = ? AND status = 'Draft'
      ORDER BY version DESC LIMIT 1`).bind(tenantId).first<{ rule_json: string }>(),
  ]);
  return {
    published: published ? parseRule(published.rule_json) : defaultRuleSet,
    draft: draft ? parseRule(draft.rule_json) : null,
  };
}

export async function createRuleDraft(tenantId: string, actorEmail: string) {
  const { published, draft } = await getRuleWorkspace(tenantId);
  if (draft) return draft;
  const next = { ...published, version: published.version + 1 };
  const db = await database();
  await db.prepare(`INSERT INTO pricing_rule_sets
      (tenant_id, id, version, status, rule_json, updated_by)
    VALUES (?, ?, ?, 'Draft', ?, ?)`)
    .bind(tenantId, next.id, next.version, JSON.stringify(next), actorEmail)
    .run();
  return next;
}

export async function saveRuleDraft(tenantId: string, ruleSet: RuleSet, actorEmail: string) {
  await ensureRules(tenantId);
  const db = await database();
  const result = await db.prepare(`UPDATE pricing_rule_sets SET rule_json = ?, updated_by = ?,
      updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND id = ? AND version = ? AND status = 'Draft'`)
    .bind(JSON.stringify(ruleSet), actorEmail, tenantId, ruleSet.id, ruleSet.version)
    .run();
  if (!result.meta.changes) throw new Error("Create a draft version before changing pricing controls.");
  return ruleSet;
}

export async function publishRuleDraft(tenantId: string, ruleSet: RuleSet, actorEmail: string) {
  await saveRuleDraft(tenantId, ruleSet, actorEmail);
  const db = await database();
  await db.batch([
    db.prepare("UPDATE pricing_rule_sets SET status = 'Archived', updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND status = 'Published'").bind(tenantId),
    db.prepare(`UPDATE pricing_rule_sets SET status = 'Published', published_at = CURRENT_TIMESTAMP,
      updated_by = ?, updated_at = CURRENT_TIMESTAMP
      WHERE tenant_id = ? AND id = ? AND version = ? AND status = 'Draft'`)
      .bind(actorEmail, tenantId, ruleSet.id, ruleSet.version),
  ]);
  return ruleSet;
}

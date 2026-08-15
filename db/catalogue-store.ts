import { catalogue as seedCatalogue } from "../app/demo-data";
import type { CatalogueItem } from "../packages/pricing-engine/src/index";

const CATALOGUE_SCHEMA = `CREATE TABLE IF NOT EXISTS catalogue_items (
  tenant_id TEXT NOT NULL,
  id TEXT NOT NULL,
  category_id TEXT NOT NULL,
  name TEXT NOT NULL,
  unit_label TEXT NOT NULL,
  pricing_basis TEXT NOT NULL CHECK (pricing_basis IN ('fixed', 'per_unit', 'cost_plus')),
  base_price_minor INTEGER,
  cost_minor INTEGER,
  target_margin_bp INTEGER,
  recurrence TEXT NOT NULL CHECK (recurrence IN ('one_off', 'weekly', 'fortnightly', 'monthly', 'quarterly', 'annually')),
  min_quantity INTEGER,
  max_quantity INTEGER,
  updated_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`;

async function database() {
  const { env } = await import("cloudflare:workers");
  if (!env.DB) throw new Error("Catalogue storage is unavailable");
  return env.DB;
}

async function ensureCatalogue(tenantId: string) {
  const db = await database();
  await db.batch([
    db.prepare(CATALOGUE_SCHEMA),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS catalogue_items_tenant_id_unique ON catalogue_items (tenant_id, id)"),
    db.prepare("CREATE INDEX IF NOT EXISTS catalogue_items_tenant_name_idx ON catalogue_items (tenant_id, name)"),
  ]);
  await db.batch(seedCatalogue.map((item) => db.prepare(`INSERT OR IGNORE INTO catalogue_items (
      tenant_id, id, category_id, name, unit_label, pricing_basis, base_price_minor,
      cost_minor, target_margin_bp, recurrence, min_quantity, max_quantity, updated_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'system-seed')`)
    .bind(tenantId, item.id, item.categoryId, item.name, item.unitLabel, item.pricingBasis,
      item.basePriceMinor ?? null, item.costMinor ?? null, item.targetMarginBp ?? null,
      item.recurrence, item.minQuantity ?? null, item.maxQuantity ?? null)));
}

export async function listCatalogueItems(tenantId: string): Promise<CatalogueItem[]> {
  await ensureCatalogue(tenantId);
  const db = await database();
  const result = await db.prepare(`SELECT id, category_id, name, unit_label, pricing_basis,
      base_price_minor, cost_minor, target_margin_bp, recurrence, min_quantity, max_quantity
    FROM catalogue_items WHERE tenant_id = ? ORDER BY category_id, name`)
    .bind(tenantId)
    .all<{
      id: string; category_id: string; name: string; unit_label: string;
      pricing_basis: CatalogueItem["pricingBasis"]; base_price_minor: number | null;
      cost_minor: number | null; target_margin_bp: number | null;
      recurrence: CatalogueItem["recurrence"]; min_quantity: number | null; max_quantity: number | null;
    }>();
  return result.results.map((row) => ({
    id: row.id,
    categoryId: row.category_id,
    name: row.name,
    unitLabel: row.unit_label,
    pricingBasis: row.pricing_basis,
    ...(row.base_price_minor === null ? {} : { basePriceMinor: row.base_price_minor }),
    ...(row.cost_minor === null ? {} : { costMinor: row.cost_minor }),
    ...(row.target_margin_bp === null ? {} : { targetMarginBp: row.target_margin_bp }),
    recurrence: row.recurrence,
    ...(row.min_quantity === null ? {} : { minQuantity: row.min_quantity }),
    ...(row.max_quantity === null ? {} : { maxQuantity: row.max_quantity }),
  } as CatalogueItem));
}

export async function upsertCatalogueItem(tenantId: string, item: CatalogueItem, actorEmail: string) {
  await ensureCatalogue(tenantId);
  const db = await database();
  await db.prepare(`INSERT INTO catalogue_items (
      tenant_id, id, category_id, name, unit_label, pricing_basis, base_price_minor,
      cost_minor, target_margin_bp, recurrence, min_quantity, max_quantity, updated_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(tenant_id, id) DO UPDATE SET category_id = excluded.category_id,
      name = excluded.name, unit_label = excluded.unit_label, pricing_basis = excluded.pricing_basis,
      base_price_minor = excluded.base_price_minor, cost_minor = excluded.cost_minor,
      target_margin_bp = excluded.target_margin_bp, recurrence = excluded.recurrence,
      min_quantity = excluded.min_quantity, max_quantity = excluded.max_quantity,
      updated_by = excluded.updated_by, updated_at = CURRENT_TIMESTAMP`)
    .bind(tenantId, item.id, item.categoryId, item.name, item.unitLabel, item.pricingBasis,
      item.basePriceMinor ?? null, item.costMinor ?? null, item.targetMarginBp ?? null,
      item.recurrence, item.minQuantity ?? null, item.maxQuantity ?? null, actorEmail)
    .run();
  return item;
}

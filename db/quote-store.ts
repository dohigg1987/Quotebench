import { getDatabase } from "./database.ts";
const QUOTES_SCHEMA = `CREATE TABLE IF NOT EXISTS quotes (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  owner_email TEXT NOT NULL,
  client_id TEXT,
  reference TEXT NOT NULL,
  client_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  contact_email TEXT,
  valid_until TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Draft', 'Ready', 'Issued', 'Viewed', 'Accepted', 'Declined', 'Expired', 'Superseded')),
  currency TEXT NOT NULL DEFAULT 'GBP',
  one_off_total_minor INTEGER NOT NULL,
  recurring_annualised_minor INTEGER NOT NULL,
  margin_bp INTEGER,
  line_items_json TEXT NOT NULL,
  answers_json TEXT NOT NULL,
  pricing_snapshot_json TEXT NOT NULL,
  document_json TEXT NOT NULL DEFAULT '{}',
  rule_set_id TEXT NOT NULL,
  rule_set_version INTEGER NOT NULL,
  share_token TEXT UNIQUE,
  issued_at TEXT,
  first_viewed_at TEXT,
  accepted_at TEXT,
  accepted_by TEXT,
  acceptance_evidence_json TEXT,
  acceptance_snapshot_json TEXT,
  revision_of TEXT,
  superseded_by TEXT,
  declined_at TEXT,
  decline_reason TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`;

const EVENTS_SCHEMA = `CREATE TABLE IF NOT EXISTS quote_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  quote_reference TEXT NOT NULL,
  actor_email TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('quote.saved', 'quote.ready', 'quote.issued', 'quote.viewed', 'quote.accepted', 'quote.declined', 'quote.expired', 'quote.superseded')),
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`;

const ENTITLEMENTS_SCHEMA = `CREATE TABLE IF NOT EXISTS workspace_entitlements (
  tenant_id TEXT PRIMARY KEY,
  plan_name TEXT NOT NULL DEFAULT 'Trial',
  monthly_quote_limit INTEGER NOT NULL DEFAULT 50,
  active INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`;

export type StoredQuote = {
  id: string;
  clientId: string | null;
  reference: string;
  clientName: string;
  contactName: string;
  contactEmail: string | null;
  validUntil: string;
  status: "Draft" | "Ready" | "Issued" | "Viewed" | "Accepted" | "Declined" | "Expired" | "Superseded";
  currency: string;
  oneOffTotalMinor: number;
  recurringAnnualisedMinor: number;
  marginBp: number | null;
  updatedAt: string;
  ownerEmail: string;
  shareToken: string | null;
  issuedAt: string | null;
  firstViewedAt: string | null;
  acceptedAt: string | null;
  acceptedBy: string | null;
  supersededBy: string | null;
  declinedAt: string | null;
  declineReason: string | null;
};

export type PublicQuote = StoredQuote & {
  tenantId: string;
  recipientId?: string;
  recipientName?: string;
  recipientEmail?: string;
  recipientRole?: import("./delivery-store").RecipientRole;
  signingOrder?: number;
  signatureRequired?: boolean;
  recipientSignedAt?: string | null;
  signingExpiresAt?: string | null;
  signingComplete?: boolean;
  pendingSignatures?: number;
  ruleSetVersion: number;
  pricingSnapshot: {
    currency: string;
    lines: Array<{ lineId: string; itemName: string; categoryId?:string; subcategoryId?:string; description?:string; serviceSchedule?:string; serviceTerms?:string; quantity: number; unitLabel: string; finalPriceMinor: number; taxTreatmentLabel?:string; taxRateBp?:number; taxMinor?:number; grossPriceMinor?:number; taxComponents?:Array<{id:string;label:string;jurisdictionCode:string;jurisdictionLevel:string;rateBp:number;taxMinor:number}> }>;
    oneOffSubtotalMinor: number;
    recurringByFrequency: Record<string, number>;
    recurringAnnualisedMinor: number;
    taxOneOffTotalMinor?:number;
    taxRecurringByFrequency?:Record<string,number>;
    grossOneOffTotalMinor?:number;
    grossRecurringByFrequency?:Record<string,number>;
  };
  document: { title: string; introduction: string; scopeHeading: string; brandName?: string; brandInitials?: string; proposalTypeId?:string; templateId?:string; depositMinor?: number; options?: Array<{ id: string; label: string }>; pages?:import("./document-store").DocumentPage[]; legalContent?:import("./engagement-store").LegalSnapshot[]; market?:{market:"GB"|"US";countryCode:"GB"|"US";locale:string;currency:string;timezone:string;taxRegistrationStatus:string;pricesIncludeTax:boolean;taxConfiguration?:unknown} };
};

export type InternalQuote = StoredQuote & {
  lines: Array<{ itemId: string; quantity: number; discount: number }>;
  answers: { values?: Record<string, string>; complexity?: string; turnaround?: string; quoteDiscount?: number };
  pricingSnapshot:PublicQuote["pricingSnapshot"];
  ruleSetVersion:number;
  document: { title: string; introduction: string; scopeHeading: string; brandName?: string; brandInitials?: string; proposalTypeId?:string; templateId?:string; depositMinor?: number; options?: Array<{ id: string; label: string }>; pages?:import("./document-store").DocumentPage[] };
  revisionOf: string | null;
};

export type StoredQuoteEvent = {
  id: string;
  quoteReference: string;
  actorEmail: string;
  eventType: "quote.saved" | "quote.ready" | "quote.issued" | "quote.viewed" | "quote.accepted" | "quote.declined" | "quote.expired" | "quote.superseded";
  payload: Record<string, unknown>;
  createdAt: string;
};

export type WorkspaceEntitlement = {
  planName: string;
  monthlyQuoteLimit: number;
  quotesUsedThisMonth: number;
  active: boolean;
};

type QuoteWrite = Omit<StoredQuote, "updatedAt" | "shareToken" | "issuedAt" | "firstViewedAt" | "acceptedAt" | "acceptedBy" | "supersededBy" | "declinedAt" | "declineReason"> & {
  tenantId: string;
  lineItemsJson: string;
  answersJson: string;
  pricingSnapshotJson: string;
  documentJson: string;
  ruleSetId: string;
  ruleSetVersion: number;
};

async function database() {
  return getDatabase("Quote storage is unavailable");
}

async function ensureSchema() {
  const db = await database();
  await db.batch([
    db.prepare(QUOTES_SCHEMA),
    db.prepare(EVENTS_SCHEMA),
    db.prepare(ENTITLEMENTS_SCHEMA),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS quotes_tenant_reference_unique ON quotes (tenant_id, reference)"),
    db.prepare("CREATE INDEX IF NOT EXISTS quotes_tenant_updated_idx ON quotes (tenant_id, updated_at)"),
    db.prepare("CREATE INDEX IF NOT EXISTS quote_events_tenant_created_idx ON quote_events (tenant_id, created_at)"),
  ]);
  try {
    await db.prepare("SELECT share_token FROM quotes LIMIT 0").run();
  } catch {
    await db.batch([
      db.prepare("ALTER TABLE quotes ADD COLUMN share_token TEXT"),
      db.prepare("ALTER TABLE quotes ADD COLUMN issued_at TEXT"),
      db.prepare("ALTER TABLE quotes ADD COLUMN first_viewed_at TEXT"),
      db.prepare("ALTER TABLE quotes ADD COLUMN accepted_at TEXT"),
      db.prepare("ALTER TABLE quotes ADD COLUMN accepted_by TEXT"),
      db.prepare("ALTER TABLE quotes ADD COLUMN acceptance_evidence_json TEXT"),
    ]);
    await db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS quotes_share_token_unique ON quotes (share_token)").run();
  }
  try {
    await db.prepare("SELECT document_json FROM quotes LIMIT 0").run();
  } catch {
    await db.prepare("ALTER TABLE quotes ADD COLUMN document_json TEXT NOT NULL DEFAULT '{}'").run();
  }
  try {
    await db.prepare("SELECT revision_of FROM quotes LIMIT 0").run();
  } catch {
    await db.prepare("ALTER TABLE quotes ADD COLUMN revision_of TEXT").run();
  }
  try {
    await db.prepare("SELECT client_id, contact_email, superseded_by, declined_at, decline_reason FROM quotes LIMIT 0").run();
  } catch {
    await db.batch([
      db.prepare("ALTER TABLE quotes ADD COLUMN client_id TEXT"),
      db.prepare("ALTER TABLE quotes ADD COLUMN contact_email TEXT"),
      db.prepare("ALTER TABLE quotes ADD COLUMN superseded_by TEXT"),
      db.prepare("ALTER TABLE quotes ADD COLUMN declined_at TEXT"),
      db.prepare("ALTER TABLE quotes ADD COLUMN decline_reason TEXT"),
    ]);
  }
  try {
    await db.prepare("SELECT acceptance_snapshot_json FROM quotes LIMIT 0").run();
  } catch {
    await db.prepare("ALTER TABLE quotes ADD COLUMN acceptance_snapshot_json TEXT").run();
  }
}

export async function getWorkspaceEntitlement(tenantId: string): Promise<WorkspaceEntitlement> {
  await ensureSchema();
  const db = await database();
  const usage = await db.prepare(`SELECT COUNT(*) AS count FROM quotes WHERE tenant_id = ?
      AND strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')`)
      .bind(tenantId)
      .first<{ count: number }>();
  const { getBillingWorkspace } = await import("./billing-store");
  const billing = await getBillingWorkspace(tenantId);
  return {
    planName: billing.effectivePlan,
    monthlyQuoteLimit: billing.limits.quotes,
    quotesUsedThisMonth: usage?.count ?? 0,
    active: billing.accessActive,
  };
}

export async function assertQuoteCapacity(tenantId: string, reference: string) {
  await ensureSchema();
  const db = await database();
  const existing = await db.prepare("SELECT id FROM quotes WHERE tenant_id = ? AND reference = ?")
    .bind(tenantId, reference)
    .first();
  if (existing) return;
  const { assertCapacity } = await import("./entitlement-store");
  await assertCapacity(tenantId, "quotes");
}

export async function listQuotes(tenantId: string): Promise<StoredQuote[]> {
  await ensureSchema();
  const db = await database();
  await db.batch([
    db.prepare(`UPDATE quotes SET status = 'Expired', updated_at = CURRENT_TIMESTAMP
      WHERE tenant_id = ? AND status IN ('Issued', 'Viewed') AND date(valid_until) < date('now')`).bind(tenantId),
    db.prepare(`INSERT INTO quote_events (id, tenant_id, quote_reference, actor_email, event_type, payload_json)
      SELECT lower(hex(randomblob(16))), ?, reference, 'system', 'quote.expired', json_object('validUntil', valid_until)
      FROM quotes WHERE tenant_id = ? AND status = 'Expired'
      AND NOT EXISTS (
        SELECT 1 FROM quote_events WHERE quote_events.tenant_id = quotes.tenant_id
        AND quote_events.quote_reference = quotes.reference AND quote_events.event_type = 'quote.expired'
      )`).bind(tenantId, tenantId),
  ]);
  const result = await db
    .prepare(`SELECT id, client_id, reference, client_name, contact_name, contact_email, valid_until, status,
    currency, one_off_total_minor, recurring_annualised_minor, margin_bp,
      updated_at, owner_email, share_token, issued_at, first_viewed_at,
      accepted_at, accepted_by, superseded_by, declined_at, decline_reason
      FROM quotes WHERE tenant_id = ? ORDER BY updated_at DESC LIMIT 50`)
    .bind(tenantId)
    .all<{
      id: string;
      client_id: string | null;
      reference: string;
      client_name: string;
      contact_name: string;
      contact_email: string | null;
      valid_until: string;
      status: StoredQuote["status"];
      currency: string;
      one_off_total_minor: number;
      recurring_annualised_minor: number;
      margin_bp: number | null;
      updated_at: string;
      owner_email: string;
      share_token: string | null;
      issued_at: string | null;
      first_viewed_at: string | null;
      accepted_at: string | null;
      accepted_by: string | null;
      superseded_by: string | null;
      declined_at: string | null;
      decline_reason: string | null;
    }>();

  return result.results.map((row) => ({
    id: row.id,
    clientId: row.client_id,
    reference: row.reference,
    clientName: row.client_name,
    contactName: row.contact_name,
    contactEmail: row.contact_email,
    validUntil: row.valid_until,
    status: row.status,
    currency: row.currency,
    oneOffTotalMinor: row.one_off_total_minor,
    recurringAnnualisedMinor: row.recurring_annualised_minor,
    marginBp: row.margin_bp,
    updatedAt: row.updated_at,
    ownerEmail: row.owner_email,
    shareToken: row.share_token,
    issuedAt: row.issued_at,
    firstViewedAt: row.first_viewed_at,
    acceptedAt: row.accepted_at,
    acceptedBy: row.accepted_by,
    supersededBy: row.superseded_by,
    declinedAt: row.declined_at,
    declineReason: row.decline_reason,
  }));
}

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export async function getInternalQuote(tenantId: string, reference: string): Promise<InternalQuote | null> {
  await ensureSchema();
  const db = await database();
  const row = await db.prepare(`SELECT id, client_id, reference, client_name, contact_name, contact_email, valid_until,
      status, currency, one_off_total_minor, recurring_annualised_minor, margin_bp,
      updated_at, owner_email, share_token, issued_at, first_viewed_at, accepted_at,
      accepted_by, line_items_json, answers_json, pricing_snapshot_json,
      document_json, rule_set_version, revision_of,
      superseded_by, declined_at, decline_reason
    FROM quotes WHERE tenant_id = ? AND reference = ?`)
    .bind(tenantId, reference)
    .first<{
      id: string; client_id: string | null; reference: string; client_name: string; contact_name: string; contact_email: string | null;
      valid_until: string; status: StoredQuote["status"]; currency: string;
      one_off_total_minor: number; recurring_annualised_minor: number; margin_bp: number | null;
      updated_at: string; owner_email: string; share_token: string | null; issued_at: string | null;
      first_viewed_at: string | null; accepted_at: string | null; accepted_by: string | null;
      line_items_json: string; answers_json: string; pricing_snapshot_json: string;
      document_json: string; rule_set_version: number; revision_of: string | null;
      superseded_by: string | null; declined_at: string | null; decline_reason: string | null;
    }>();
  if (!row) return null;
  return {
    id: row.id,
    clientId: row.client_id,
    reference: row.reference,
    clientName: row.client_name,
    contactName: row.contact_name,
    contactEmail: row.contact_email,
    validUntil: row.valid_until,
    status: row.status,
    currency: row.currency,
    oneOffTotalMinor: row.one_off_total_minor,
    recurringAnnualisedMinor: row.recurring_annualised_minor,
    marginBp: row.margin_bp,
    updatedAt: row.updated_at,
    ownerEmail: row.owner_email,
    shareToken: row.share_token,
    issuedAt: row.issued_at,
    firstViewedAt: row.first_viewed_at,
    acceptedAt: row.accepted_at,
    acceptedBy: row.accepted_by,
    supersededBy: row.superseded_by,
    declinedAt: row.declined_at,
    declineReason: row.decline_reason,
    lines: parseJson(row.line_items_json, []),
    answers: parseJson(row.answers_json, {}),
    pricingSnapshot:parseJson(row.pricing_snapshot_json,{currency:row.currency,lines:[],oneOffSubtotalMinor:row.one_off_total_minor,recurringByFrequency:{},recurringAnnualisedMinor:row.recurring_annualised_minor}),
    ruleSetVersion:row.rule_set_version,
    document: parseJson(row.document_json, {
      title: "Commercial proposal",
      introduction: "",
      scopeHeading: "Scope and investment",
    }),
    revisionOf: row.revision_of,
  };
}

export async function createQuoteRevision(tenantId: string, reference: string, actorEmail: string) {
  await ensureSchema();
  const db = await database();
  const source = await getInternalQuote(tenantId, reference);
  if (!source) throw new Error("The source quote could not be found.");
  if (["Draft", "Ready"].includes(source.status)) {
    throw new Error("Draft and ready quotes can be edited directly.");
  }
  if (source.status === "Accepted") {
    throw new Error("Accepted quotes and their evidence are permanently immutable.");
  }

  const references = await db.prepare("SELECT reference FROM quotes WHERE tenant_id = ?")
    .bind(tenantId)
    .all<{ reference: string }>();
  const nextNumber = Math.max(1048, ...references.results.map((row) => Number(row.reference.match(/\d+$/)?.[0] ?? 0))) + 1;
  const newReference = `QB-${nextNumber}`;
  await assertQuoteCapacity(tenantId, newReference);

  await db.batch([
    db.prepare(`INSERT INTO quotes (
      id, tenant_id, owner_email, client_id, reference, client_name, contact_name, contact_email, valid_until,
      status, currency, one_off_total_minor, recurring_annualised_minor, margin_bp,
      line_items_json, answers_json, pricing_snapshot_json, document_json,
      rule_set_id, rule_set_version, revision_of
    ) SELECT ?, tenant_id, ?, client_id, ?, client_name, contact_name, contact_email, valid_until,
      'Draft', currency, one_off_total_minor, recurring_annualised_minor, margin_bp,
      line_items_json, answers_json, pricing_snapshot_json, document_json,
      rule_set_id, rule_set_version, reference
      FROM quotes WHERE tenant_id = ? AND reference = ?`)
      .bind(crypto.randomUUID(), actorEmail, newReference, tenantId, reference),
    db.prepare(`UPDATE quotes SET status = 'Superseded', superseded_by = ?, updated_at = CURRENT_TIMESTAMP
      WHERE tenant_id = ? AND reference = ?`).bind(newReference, tenantId, reference),
    db.prepare(`INSERT INTO quote_events (
      id, tenant_id, quote_reference, actor_email, event_type, payload_json
    ) VALUES (?, ?, ?, ?, 'quote.superseded', ?)`)
      .bind(crypto.randomUUID(), tenantId, reference, actorEmail, JSON.stringify({ supersededBy: newReference })),
    db.prepare(`INSERT INTO quote_events (
      id, tenant_id, quote_reference, actor_email, event_type, payload_json
    ) VALUES (?, ?, ?, ?, 'quote.saved', ?)`)
      .bind(crypto.randomUUID(), tenantId, newReference, actorEmail, JSON.stringify({ status: "Draft", revisionOf: reference })),
  ]);
  return getInternalQuote(tenantId, newReference);
}

export async function duplicateQuote(tenantId: string, reference: string, actorEmail: string) {
  await ensureSchema();
  const db = await database();
  const source = await getInternalQuote(tenantId, reference);
  if (!source) throw new Error("The source quote could not be found.");
  const references = await db.prepare("SELECT reference FROM quotes WHERE tenant_id = ?")
    .bind(tenantId)
    .all<{ reference: string }>();
  const nextNumber = Math.max(1048, ...references.results.map((row) => Number(row.reference.match(/\d+$/)?.[0] ?? 0))) + 1;
  const newReference = `QB-${nextNumber}`;
  await assertQuoteCapacity(tenantId, newReference);
  await db.batch([
    db.prepare(`INSERT INTO quotes (
      id, tenant_id, owner_email, client_id, reference, client_name, contact_name, contact_email, valid_until,
      status, currency, one_off_total_minor, recurring_annualised_minor, margin_bp,
      line_items_json, answers_json, pricing_snapshot_json, document_json, rule_set_id, rule_set_version
    ) SELECT ?, tenant_id, ?, client_id, ?, client_name, contact_name, contact_email, valid_until,
      'Draft', currency, one_off_total_minor, recurring_annualised_minor, margin_bp,
      line_items_json, answers_json, pricing_snapshot_json, document_json, rule_set_id, rule_set_version
      FROM quotes WHERE tenant_id = ? AND reference = ?`)
      .bind(crypto.randomUUID(), actorEmail, newReference, tenantId, reference),
    db.prepare(`INSERT INTO quote_events (
      id, tenant_id, quote_reference, actor_email, event_type, payload_json
    ) VALUES (?, ?, ?, ?, 'quote.saved', ?)`)
      .bind(crypto.randomUUID(), tenantId, newReference, actorEmail, JSON.stringify({ status: "Draft", duplicatedFrom: reference })),
  ]);
  return getInternalQuote(tenantId, newReference);
}

export async function listQuoteEvents(tenantId: string): Promise<StoredQuoteEvent[]> {
  await ensureSchema();
  const db = await database();
  const result = await db.prepare(`SELECT id, quote_reference, actor_email, event_type,
      payload_json, created_at FROM quote_events
      WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 100`)
    .bind(tenantId)
    .all<{
      id: string; quote_reference: string; actor_email: string;
      event_type: StoredQuoteEvent["eventType"]; payload_json: string; created_at: string;
    }>();
  return result.results.map((row) => ({
    id: row.id,
    quoteReference: row.quote_reference,
    actorEmail: row.actor_email,
    eventType: row.event_type,
    payload: JSON.parse(row.payload_json) as Record<string, unknown>,
    createdAt: row.created_at,
  }));
}

export async function exportQuoteRecords(tenantId: string) {
  await ensureSchema();
  const db = await database();
  const result = await db.prepare(`SELECT id, owner_email, client_id, reference, client_name, contact_name,
      contact_email, valid_until, status, currency, one_off_total_minor, recurring_annualised_minor,
      margin_bp, line_items_json, answers_json, pricing_snapshot_json, document_json, rule_set_id,
      rule_set_version, issued_at, first_viewed_at, accepted_at, accepted_by,
      acceptance_evidence_json, acceptance_snapshot_json, revision_of, superseded_by,
      declined_at, decline_reason, created_at, updated_at
    FROM quotes WHERE tenant_id = ? ORDER BY created_at ASC`)
    .bind(tenantId)
    .all<Record<string, unknown>>();
  return result.results;
}

export async function upsertQuote(quote: QuoteWrite) {
  await ensureSchema();
  const db = await database();
  const existing = await db.prepare("SELECT status FROM quotes WHERE tenant_id = ? AND reference = ?")
    .bind(quote.tenantId, quote.reference)
    .first<{ status: StoredQuote["status"] }>();
  if (existing && !["Draft", "Ready"].includes(existing.status)) {
    throw new Error("An issued quote is immutable. Create a revision before changing its commercial terms.");
  }
  const eventType = quote.status === "Ready" ? "quote.ready" : "quote.saved";
  await db.batch([
    db.prepare(`INSERT INTO quotes (
      id, tenant_id, owner_email, client_id, reference, client_name, contact_name, contact_email, valid_until,
      status, currency, one_off_total_minor, recurring_annualised_minor, margin_bp,
      line_items_json, answers_json, pricing_snapshot_json, document_json,
      rule_set_id, rule_set_version
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(tenant_id, reference) DO UPDATE SET
      owner_email = excluded.owner_email,
      client_id = excluded.client_id,
      client_name = excluded.client_name,
      contact_name = excluded.contact_name,
      contact_email = excluded.contact_email,
      valid_until = excluded.valid_until,
      status = excluded.status,
      currency = excluded.currency,
      one_off_total_minor = excluded.one_off_total_minor,
      recurring_annualised_minor = excluded.recurring_annualised_minor,
      margin_bp = excluded.margin_bp,
      line_items_json = excluded.line_items_json,
      answers_json = excluded.answers_json,
      pricing_snapshot_json = excluded.pricing_snapshot_json,
      document_json = excluded.document_json,
      rule_set_id = excluded.rule_set_id,
      rule_set_version = excluded.rule_set_version,
      updated_at = CURRENT_TIMESTAMP`)
      .bind(
        quote.id, quote.tenantId, quote.ownerEmail, quote.clientId, quote.reference, quote.clientName,
        quote.contactName, quote.contactEmail, quote.validUntil, quote.status, quote.currency,
        quote.oneOffTotalMinor, quote.recurringAnnualisedMinor, quote.marginBp,
        quote.lineItemsJson, quote.answersJson, quote.pricingSnapshotJson, quote.documentJson,
        quote.ruleSetId, quote.ruleSetVersion,
      ),
    db.prepare(`INSERT INTO quote_events (
      id, tenant_id, quote_reference, actor_email, event_type, payload_json
    ) VALUES (?, ?, ?, ?, ?, ?)`)
      .bind(
        crypto.randomUUID(), quote.tenantId, quote.reference, quote.ownerEmail,
        eventType, JSON.stringify({ status: quote.status, ruleSetVersion: quote.ruleSetVersion }),
      ),
  ]);

  return quote;
}

export async function issueQuote(tenantId: string, reference: string, actorEmail: string) {
  await ensureSchema();
  const db = await database();
  const shareToken = crypto.randomUUID().replaceAll("-", "");
  const result = await db.prepare(`UPDATE quotes SET
      status = CASE WHEN status = 'Viewed' THEN 'Viewed' ELSE 'Issued' END,
      share_token = COALESCE(share_token, ?),
      issued_at = COALESCE(issued_at, CURRENT_TIMESTAMP), updated_at = CURRENT_TIMESTAMP
    WHERE tenant_id = ? AND reference = ? AND status IN ('Ready', 'Issued', 'Viewed')
    RETURNING share_token`)
    .bind(shareToken, tenantId, reference)
    .first<{ share_token: string }>();

  if (!result) throw new Error("Only a ready quote can be issued.");
  await db.prepare(`INSERT INTO quote_events (
      id, tenant_id, quote_reference, actor_email, event_type, payload_json
    ) VALUES (?, ?, ?, ?, 'quote.issued', ?)`)
    .bind(crypto.randomUUID(), tenantId, reference, actorEmail, JSON.stringify({ channel: "secure_link" }))
    .run();
  const { emitWebhooks } = await import("./integration-store");
  await emitWebhooks(tenantId, "quote.sent", { reference, channel: "secure_link" });
  return result.share_token;
}

export async function getPublicQuote(token: string): Promise<PublicQuote | null> {
  await ensureSchema();
  const db = await database();
  const { resolveRecipientToken } = await import("./delivery-store");
  const recipient = await resolveRecipientToken(token);
  const query = `SELECT tenant_id, id, client_id, reference, client_name, contact_name, contact_email,
      valid_until, status, currency, one_off_total_minor, recurring_annualised_minor,
      margin_bp, updated_at, owner_email, share_token, issued_at, first_viewed_at,
      accepted_at, accepted_by, pricing_snapshot_json, document_json, rule_set_version,
      superseded_by, declined_at, decline_reason
    FROM quotes WHERE ${recipient ? "tenant_id = ? AND reference = ?" : "share_token = ?"} AND status IN ('Issued', 'Viewed', 'Accepted', 'Declined', 'Expired', 'Superseded')`;
  const statement = db.prepare(query);
  const row = await (recipient ? statement.bind(recipient.tenant_id, recipient.quote_reference) : statement.bind(token)).first<{
      tenant_id: string; id: string; client_id: string | null; reference: string; client_name: string; contact_name: string; contact_email: string | null;
      valid_until: string; status: StoredQuote["status"]; currency: string;
      one_off_total_minor: number; recurring_annualised_minor: number;
      margin_bp: number | null; updated_at: string; owner_email: string;
      share_token: string | null; issued_at: string | null; first_viewed_at: string | null;
      accepted_at: string | null; accepted_by: string | null; pricing_snapshot_json: string;
      document_json: string; rule_set_version: number; superseded_by: string | null; declined_at: string | null; decline_reason: string | null;
    }>();
  if (!row) return null;

  if (["Issued", "Viewed"].includes(row.status) && new Date(`${row.valid_until}T23:59:59Z`).getTime() < Date.now()) {
    await db.batch([
      db.prepare("UPDATE quotes SET status = 'Expired', updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(row.id),
      db.prepare(`INSERT INTO quote_events (id, tenant_id, quote_reference, actor_email, event_type, payload_json)
        VALUES (?, ?, ?, 'system', 'quote.expired', ?)`)
        .bind(crypto.randomUUID(), row.tenant_id, row.reference, JSON.stringify({ validUntil: row.valid_until })),
    ]);
    row.status = "Expired";
  }

  return {
    tenantId: row.tenant_id,
    id: row.id,
    clientId: row.client_id,
    reference: row.reference,
    clientName: row.client_name,
    contactName: row.contact_name,
    contactEmail: row.contact_email,
    validUntil: row.valid_until,
    status: row.status,
    currency: row.currency,
    oneOffTotalMinor: row.one_off_total_minor,
    recurringAnnualisedMinor: row.recurring_annualised_minor,
    marginBp: row.margin_bp,
    updatedAt: row.updated_at,
    ownerEmail: row.owner_email,
    shareToken: token,
    issuedAt: row.issued_at,
    firstViewedAt: row.first_viewed_at,
    acceptedAt: row.accepted_at,
    acceptedBy: row.accepted_by,
    supersededBy: row.superseded_by,
    declinedAt: row.declined_at,
    declineReason: row.decline_reason,
    ruleSetVersion: row.rule_set_version,
    pricingSnapshot: JSON.parse(row.pricing_snapshot_json) as PublicQuote["pricingSnapshot"],
    document: JSON.parse(row.document_json) as PublicQuote["document"],
    ...(recipient ? { recipientId: recipient.id, recipientName: recipient.name, recipientEmail: recipient.email, recipientRole: recipient.signer_role, signingOrder: recipient.signing_order, signatureRequired: recipient.signature_required === 1, recipientSignedAt: recipient.signed_at, signingExpiresAt: recipient.expires_at } : {}),
  };
}

export async function recordQualifiedView(token: string) {
  const quote = await getPublicQuote(token);
  if (!quote || !["Issued", "Viewed"].includes(quote.status)) return quote;
  const db = await database();
  if (!quote.firstViewedAt) await db.batch([
    db.prepare(`UPDATE quotes SET status = 'Viewed', first_viewed_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP WHERE id = ? AND first_viewed_at IS NULL`).bind(quote.id),
    db.prepare(`INSERT INTO quote_events (
      id, tenant_id, quote_reference, actor_email, event_type, payload_json
    ) VALUES (?, ?, ?, 'recipient', 'quote.viewed', ?)`)
      .bind(crypto.randomUUID(), quote.tenantId, quote.reference, JSON.stringify({ qualification: "active_for_three_seconds" })),
  ]);
  if (!quote.firstViewedAt) { const { emitWebhooks } = await import("./integration-store"); await emitWebhooks(quote.tenantId, "quote.first_viewed", { reference: quote.reference }); }
  if (quote.recipientId) { const { recordTrackingEvent } = await import("./delivery-store"); await recordTrackingEvent(token, "open", null, null, null, { qualification: "active_for_three_seconds" }); }
  return { ...quote, status: "Viewed" as const };
}

async function sha256(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function acceptQuote(token: string, acceptedBy: string, userAgent: string | null, selectedOptionId?: string | null, ipAddress?: string | null) {
  const quote = await getPublicQuote(token);
  if (!quote) throw new Error("This quote link is invalid or unavailable.");
  if (quote.status === "Accepted") return quote;
  if (quote.status === "Superseded") throw new Error("This proposal has been superseded and can no longer be accepted.");
  if (quote.status === "Declined") throw new Error("This proposal has been declined. Request a new version to continue.");
  if (quote.status === "Expired") throw new Error("This proposal has expired and can no longer be accepted.");
  if (new Date(`${quote.validUntil}T23:59:59Z`).getTime() < Date.now()) {
    throw new Error("This proposal has expired and can no longer be accepted.");
  }
  const options = quote.document.options ?? [];
  if (options.length > 0 && !options.some((option) => option.id === selectedOptionId)) throw new Error("Select exactly one proposal option before accepting.");
  const db = await database();
  const evidence = {
    evidenceVersion: 2,
    certificateId: crypto.randomUUID(),
    acceptedBy,
    acceptedAt: new Date().toISOString(),
    consent: "I accept this proposal and confirm that I am authorised to proceed.",
    userAgent,
    ipAddressHash: ipAddress ? await sha256(ipAddress) : null,
    quoteReference: quote.reference,
    ruleSetVersion: quote.ruleSetVersion,
    recipientTokenHash: await sha256(token),
    recipientEmail: quote.recipientEmail ?? null,
    selectedOptionId: selectedOptionId ?? null,
  };
  const quoteSnapshot = {
      reference: quote.reference,
      clientName: quote.clientName,
      contactName: quote.contactName,
      contactEmail: quote.contactEmail,
      validUntil: quote.validUntil,
      currency: quote.currency,
      oneOffTotalMinor: quote.oneOffTotalMinor,
      recurringAnnualisedMinor: quote.recurringAnnualisedMinor,
      ruleSetVersion: quote.ruleSetVersion,
      pricing: quote.pricingSnapshot,
      document: quote.document,
  };
  const quoteSnapshotHash = await sha256(JSON.stringify(quoteSnapshot));
  let signerEvidence: Record<string, unknown>[] = [];
  if (quote.recipientId) {
    const { recordRecipientSignature } = await import("./delivery-store");
    const signing = await recordRecipientSignature(token, acceptedBy, { ...evidence, quoteSnapshotHash });
    signerEvidence = signing.signers.map((signer) => ({ ...signer, signature_evidence_json: signer.signature_evidence_json ? JSON.parse(String(signer.signature_evidence_json)) : null }));
    if (!signing.complete) return { ...quote, recipientSignedAt: evidence.acceptedAt, signingComplete: false, pendingSignatures: signing.remaining };
  }
  const acceptedNames = signerEvidence.length ? signerEvidence.map((signer) => String(signer.name)).join(", ") : acceptedBy;
  const acceptanceSnapshot = { quote: quoteSnapshot, evidence: { ...evidence, acceptedBy: acceptedNames, quoteSnapshotHash, signers: signerEvidence } };
  const accepted = await db.prepare(`UPDATE quotes SET status = 'Accepted', accepted_at = CURRENT_TIMESTAMP,
      accepted_by = ?, acceptance_evidence_json = ?, acceptance_snapshot_json = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND status IN ('Issued', 'Viewed') RETURNING accepted_at`)
      .bind(acceptedNames, JSON.stringify(acceptanceSnapshot.evidence), JSON.stringify(acceptanceSnapshot), quote.id)
      .first<{ accepted_at: string }>();
  if (!accepted) {
    const current = await getPublicQuote(token);
    if (current?.status === "Accepted") return current;
    throw new Error("This proposal changed while acceptance was being recorded. Refresh and try again.");
  }
  await db.prepare(`INSERT INTO quote_events (
      id, tenant_id, quote_reference, actor_email, event_type, payload_json
    ) VALUES (?, ?, ?, ?, 'quote.accepted', ?)`)
      .bind(crypto.randomUUID(), quote.tenantId, quote.reference, acceptedNames, JSON.stringify(acceptanceSnapshot.evidence))
      .run();
  const { emitWebhooks } = await import("./integration-store");
  await emitWebhooks(quote.tenantId, "quote.accepted", { reference: quote.reference, acceptedBy: acceptedNames, signatoryCount: signerEvidence.length || 1 });
  const { sendAcceptanceNotifications } = await import("./notification-store");
  await sendAcceptanceNotifications({ reference: quote.reference, clientName: quote.clientName, recipientEmail: quote.recipientEmail ?? quote.contactEmail, ownerEmail: quote.ownerEmail, acceptedBy: acceptedNames, token });
  return { ...quote, status: "Accepted" as const, acceptedBy: acceptedNames, acceptedAt: accepted.accepted_at, signingComplete: true, pendingSignatures: 0 };
}

export async function getAcceptanceCertificateData(tenantId: string, reference: string) {
  await ensureSchema(); const db = await database();
  const quote = await db.prepare("SELECT reference,client_name,status,accepted_at,accepted_by,acceptance_snapshot_json FROM quotes WHERE tenant_id=? AND reference=?").bind(tenantId, reference).first<Record<string, unknown>>();
  if (!quote || quote.status !== "Accepted" || !quote.acceptance_snapshot_json) throw new Error("An acceptance certificate is available only after every required signature is complete.");
  const { listDeliveryDetail } = await import("./delivery-store"); const delivery = await listDeliveryDetail(tenantId, reference);
  return { reference: String(quote.reference), clientName: String(quote.client_name), acceptedAt: String(quote.accepted_at), acceptedBy: String(quote.accepted_by), snapshot: JSON.parse(String(quote.acceptance_snapshot_json)) as Record<string, unknown>, signers: delivery.recipients.filter((row) => Number(row.signature_required) === 1).map((row) => ({ name: String(row.name), email: String(row.email), role: String(row.signer_role), signingOrder: Number(row.signing_order), signedAt: row.signed_at ? String(row.signed_at) : null })) };
}

export async function markQuoteAcceptedOffline(tenantId: string, reference: string, acceptedBy: string, actorEmail: string) {
  await ensureSchema(); const db = await database(); const quote = await getInternalQuote(tenantId, reference);
  if (!quote || !["Issued", "Viewed"].includes(quote.status)) throw new Error("Only an issued or viewed quote can be recorded as accepted offline.");
  const evidence = { mode: "offline", acceptedBy, recordedBy: actorEmail, acceptedAt: new Date().toISOString(), quoteReference: reference, ruleSetVersion: quote.ruleSetVersion };
  const snapshot = { quote: { reference, clientName: quote.clientName, contactName: quote.contactName, contactEmail: quote.contactEmail, validUntil: quote.validUntil, currency: quote.currency, oneOffTotalMinor: quote.oneOffTotalMinor, recurringAnnualisedMinor: quote.recurringAnnualisedMinor, ruleSetVersion: quote.ruleSetVersion, pricing: quote.pricingSnapshot, document: quote.document }, evidence };
  await db.batch([db.prepare("UPDATE quotes SET status='Accepted',accepted_at=CURRENT_TIMESTAMP,accepted_by=?,acceptance_evidence_json=?,acceptance_snapshot_json=?,updated_at=CURRENT_TIMESTAMP WHERE tenant_id=? AND reference=? AND status IN ('Issued','Viewed')").bind(acceptedBy,JSON.stringify(evidence),JSON.stringify(snapshot),tenantId,reference),db.prepare("INSERT INTO quote_events (id,tenant_id,quote_reference,actor_email,event_type,payload_json) VALUES (?,?,?,?, 'quote.accepted',?)").bind(crypto.randomUUID(),tenantId,reference,actorEmail,JSON.stringify(evidence))]);
  const { emitWebhooks } = await import("./integration-store"); await emitWebhooks(tenantId,"quote.accepted",{reference,acceptedBy,mode:"offline"}); return getInternalQuote(tenantId,reference);
}

export async function declineQuote(token: string, reason: string | null) {
  const quote = await getPublicQuote(token);
  if (!quote) throw new Error("This quote link is invalid or unavailable.");
  if (!["Issued", "Viewed"].includes(quote.status)) {
    throw new Error("This proposal can no longer be declined.");
  }
  const allowedReasons = ["Budget", "Timing", "Scope", "Alternative provider", "No longer required"];
  const declineReason = reason && allowedReasons.includes(reason) ? reason : null;
  const db = await database();
  await db.batch([
    db.prepare(`UPDATE quotes SET status = 'Declined', declined_at = CURRENT_TIMESTAMP,
      decline_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status IN ('Issued', 'Viewed')`)
      .bind(declineReason, quote.id),
    db.prepare(`INSERT INTO quote_events (
      id, tenant_id, quote_reference, actor_email, event_type, payload_json
    ) VALUES (?, ?, ?, 'recipient', 'quote.declined', ?)`)
      .bind(crypto.randomUUID(), quote.tenantId, quote.reference, JSON.stringify({ reason: declineReason })),
  ]);
  const { emitWebhooks } = await import("./integration-store");
  await emitWebhooks(quote.tenantId, "quote.declined", { reference: quote.reference, reason: declineReason });
  return { ...quote, status: "Declined" as const, declinedAt: new Date().toISOString(), declineReason };
}


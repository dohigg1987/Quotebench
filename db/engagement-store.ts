export type EngagementContentKind = "engagement_letter" | "service_schedule" | "master_terms" | "jurisdiction_clause" | "clause";
export type EngagementContentStatus = "Draft" | "Published" | "Retired";

export type EngagementContent = {
  id: string;
  contentGroupId: string;
  kind: EngagementContentKind;
  name: string;
  jurisdiction: string;
  version: number;
  status: EngagementContentStatus;
  content: string;
  mandatory: boolean;
  proposalTypeIds: string[];
  effectiveFrom: string | null;
  checksum: string | null;
  createdBy: string;
  publishedBy: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type LegalSnapshot = Pick<EngagementContent, "id" | "contentGroupId" | "kind" | "name" | "jurisdiction" | "version" | "content" | "mandatory" | "effectiveFrom" | "checksum">;

const CONTENT_SCHEMA = `CREATE TABLE IF NOT EXISTS engagement_content (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  content_group_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  name TEXT NOT NULL,
  jurisdiction TEXT NOT NULL DEFAULT 'England and Wales',
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'Draft',
  content TEXT NOT NULL,
  mandatory INTEGER NOT NULL DEFAULT 0,
  proposal_type_ids_json TEXT NOT NULL DEFAULT '[]',
  effective_from TEXT,
  checksum TEXT,
  created_by TEXT NOT NULL,
  published_by TEXT,
  published_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`;

async function database() {
  const { env } = await import("cloudflare:workers");
  if (!env.DB) throw new Error("Engagement governance storage is unavailable.");
  return env.DB;
}

async function ensureEngagement() {
  const db = await database();
  await db.batch([
    db.prepare(CONTENT_SCHEMA),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS engagement_content_group_version_unique ON engagement_content (tenant_id, content_group_id, version)"),
    db.prepare("CREATE INDEX IF NOT EXISTS engagement_content_tenant_status_idx ON engagement_content (tenant_id, status, kind)"),
  ]);
  return db;
}

async function checksum(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function parseIds(value: unknown): string[] {
  try { return Array.isArray(JSON.parse(String(value ?? "[]"))) ? JSON.parse(String(value ?? "[]")).map(String) : []; } catch { return []; }
}

function mapRow(row: Record<string, unknown>): EngagementContent {
  return {
    id: String(row.id), contentGroupId: String(row.content_group_id), kind: row.kind as EngagementContentKind,
    name: String(row.name), jurisdiction: String(row.jurisdiction), version: Number(row.version),
    status: row.status as EngagementContentStatus, content: String(row.content), mandatory: Number(row.mandatory) === 1,
    proposalTypeIds: parseIds(row.proposal_type_ids_json), effectiveFrom: row.effective_from ? String(row.effective_from) : null,
    checksum: row.checksum ? String(row.checksum) : null, createdBy: String(row.created_by),
    publishedBy: row.published_by ? String(row.published_by) : null, publishedAt: row.published_at ? String(row.published_at) : null,
    createdAt: String(row.created_at), updatedAt: String(row.updated_at),
  };
}

export async function listEngagementContent(tenantId: string) {
  const db = await ensureEngagement();
  const rows = await db.prepare("SELECT * FROM engagement_content WHERE tenant_id=? ORDER BY kind, name, version DESC").bind(tenantId).all<Record<string, unknown>>();
  return rows.results.map(mapRow);
}

export async function saveEngagementDraft(tenantId: string, actorEmail: string, input: Partial<EngagementContent>) {
  const db = await ensureEngagement();
  const kind = input.kind ?? "clause";
  const name = String(input.name ?? "").trim().slice(0, 160);
  const content = String(input.content ?? "").trim().slice(0, 60000);
  if (!name || !content) throw new Error("Content name and body are required.");
  const proposalTypeIds = [...new Set((input.proposalTypeIds ?? []).map(String).filter(Boolean))].slice(0, 100);
  if (input.id) {
    const current = await db.prepare("SELECT status FROM engagement_content WHERE tenant_id=? AND id=?").bind(tenantId, input.id).first<{ status: string }>();
    if (!current) throw new Error("Legal content was not found.");
    if (current.status !== "Draft") throw new Error("Published legal content is immutable. Create a new version before editing.");
    await db.prepare(`UPDATE engagement_content SET kind=?,name=?,jurisdiction=?,content=?,mandatory=?,proposal_type_ids_json=?,effective_from=?,updated_at=CURRENT_TIMESTAMP WHERE tenant_id=? AND id=?`)
      .bind(kind, name, String(input.jurisdiction ?? "England and Wales").trim().slice(0, 120), content, input.mandatory ? 1 : 0, JSON.stringify(proposalTypeIds), input.effectiveFrom ?? null, tenantId, input.id).run();
    return (await listEngagementContent(tenantId)).find((item) => item.id === input.id)!;
  }
  const id = crypto.randomUUID();
  const groupId = input.contentGroupId || crypto.randomUUID();
  const versionRow = await db.prepare("SELECT COALESCE(MAX(version),0)+1 AS next_version FROM engagement_content WHERE tenant_id=? AND content_group_id=?").bind(tenantId, groupId).first<{ next_version: number }>();
  await db.prepare(`INSERT INTO engagement_content (id,tenant_id,content_group_id,kind,name,jurisdiction,version,status,content,mandatory,proposal_type_ids_json,effective_from,created_by) VALUES (?,?,?,?,?,?,?,'Draft',?,?,?,?,?)`)
    .bind(id, tenantId, groupId, kind, name, String(input.jurisdiction ?? "England and Wales").trim().slice(0, 120), Number(versionRow?.next_version ?? 1), content, input.mandatory ? 1 : 0, JSON.stringify(proposalTypeIds), input.effectiveFrom ?? null, actorEmail.toLowerCase()).run();
  return (await listEngagementContent(tenantId)).find((item) => item.id === id)!;
}

export async function publishEngagementContent(tenantId: string, actorEmail: string, id: string) {
  const db = await ensureEngagement();
  const row = await db.prepare("SELECT * FROM engagement_content WHERE tenant_id=? AND id=?").bind(tenantId, id).first<Record<string, unknown>>();
  if (!row) throw new Error("Legal content was not found.");
  if (row.status !== "Draft") throw new Error("Only a draft version can be published.");
  const digest = await checksum(`${row.kind}\n${row.name}\n${row.jurisdiction}\n${row.content}`);
  await db.batch([
    db.prepare("UPDATE engagement_content SET status='Retired',updated_at=CURRENT_TIMESTAMP WHERE tenant_id=? AND content_group_id=? AND status='Published'").bind(tenantId, row.content_group_id),
    db.prepare("UPDATE engagement_content SET status='Published',checksum=?,published_by=?,published_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE tenant_id=? AND id=? AND status='Draft'").bind(digest, actorEmail.toLowerCase(), tenantId, id),
  ]);
  return (await listEngagementContent(tenantId)).find((item) => item.id === id)!;
}

export async function createEngagementVersion(tenantId: string, actorEmail: string, id: string) {
  const items = await listEngagementContent(tenantId);
  const source = items.find((item) => item.id === id);
  if (!source) throw new Error("Legal content was not found.");
  return saveEngagementDraft(tenantId, actorEmail, { ...source, id: undefined, status: "Draft", contentGroupId: source.contentGroupId });
}

export async function resolveLegalContent(tenantId: string, proposalTypeId?: string) {
  const items = await listEngagementContent(tenantId);
  const applies = (item: EngagementContent) => item.proposalTypeIds.length === 0 || Boolean(proposalTypeId && item.proposalTypeIds.includes(proposalTypeId));
  const policies = items.filter((item) => item.mandatory && applies(item));
  const groups = [...new Set(policies.map((item) => item.contentGroupId))];
  const published = items.filter((item) => item.status === "Published" && applies(item));
  const missingMandatory = groups.filter((groupId) => !published.some((item) => item.contentGroupId === groupId));
  const snapshots: LegalSnapshot[] = published.map(({ id, contentGroupId, kind, name, jurisdiction, version, content, mandatory, effectiveFrom, checksum }) => ({ id, contentGroupId, kind, name, jurisdiction, version, content, mandatory, effectiveFrom, checksum }));
  return { snapshots, missingMandatory };
}

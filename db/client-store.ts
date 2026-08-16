import { getDatabase } from "./database.ts";
export type ClientRecord = {
  id: string;
  name: string;
  contactName: string;
  contactEmail: string;
  status: "Active" | "Archived";
  quoteCount: number;
  acceptedOneOffMinor: number;
  acceptedRecurringAnnualisedMinor: number;
  updatedAt: string;
};

const CLIENTS_SCHEMA = `CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Archived')),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`;

async function database() {
  return getDatabase("Client storage is unavailable");
}

async function ensureClients() {
  const db = await database();
  await db.batch([
    db.prepare(CLIENTS_SCHEMA),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS clients_tenant_email_unique ON clients (tenant_id, contact_email)"),
    db.prepare("CREATE INDEX IF NOT EXISTS clients_tenant_name_idx ON clients (tenant_id, name)"),
  ]);
}

export async function listClients(tenantId: string): Promise<ClientRecord[]> {
  await ensureClients();
  const db = await database();
  const result = await db.prepare(`SELECT c.id, c.name, c.contact_name, c.contact_email,
      c.status, c.updated_at, COUNT(q.id) AS quote_count,
      COALESCE(SUM(CASE WHEN q.status = 'Accepted' THEN q.one_off_total_minor ELSE 0 END), 0) AS accepted_one_off,
      COALESCE(SUM(CASE WHEN q.status = 'Accepted' THEN q.recurring_annualised_minor ELSE 0 END), 0) AS accepted_recurring
    FROM clients c LEFT JOIN quotes q ON q.tenant_id = c.tenant_id AND q.client_id = c.id
    WHERE c.tenant_id = ? GROUP BY c.id ORDER BY c.status, c.name`)
    .bind(tenantId)
    .all<{
      id: string; name: string; contact_name: string; contact_email: string;
      status: ClientRecord["status"]; updated_at: string; quote_count: number;
      accepted_one_off: number; accepted_recurring: number;
    }>();
  return result.results.map((row) => ({
    id: row.id,
    name: row.name,
    contactName: row.contact_name,
    contactEmail: row.contact_email,
    status: row.status,
    quoteCount: row.quote_count,
    acceptedOneOffMinor: row.accepted_one_off,
    acceptedRecurringAnnualisedMinor: row.accepted_recurring,
    updatedAt: row.updated_at,
  }));
}

export async function upsertClient(
  tenantId: string,
  input: { id?: string; name: string; contactName: string; contactEmail: string; status?: "Active" | "Archived" },
  actorEmail: string,
) {
  await ensureClients();
  const db = await database();
  const normalisedEmail = input.contactEmail.trim().toLowerCase();
  const existing = await db.prepare("SELECT id,status FROM clients WHERE tenant_id = ? AND contact_email = ?")
    .bind(tenantId, normalisedEmail)
    .first<{ id: string; status: "Active" | "Archived" }>();
  if ((!existing && (input.status ?? "Active") === "Active") || (existing?.status === "Archived" && input.status === "Active")) {
    const { assertCapacity } = await import("./entitlement-store");
    await assertCapacity(tenantId, "clients");
  }
  const id = input.id ?? existing?.id ?? crypto.randomUUID();
  await db.prepare(`INSERT INTO clients
      (id, tenant_id, name, contact_name, contact_email, status, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(tenant_id, contact_email) DO UPDATE SET
      name = excluded.name, contact_name = excluded.contact_name,
      status = excluded.status, updated_at = CURRENT_TIMESTAMP`)
    .bind(id, tenantId, input.name.trim(), input.contactName.trim(), normalisedEmail, input.status ?? "Active", actorEmail)
    .run();
  return db.prepare(`SELECT id, name, contact_name, contact_email, status, updated_at
      FROM clients WHERE tenant_id = ? AND contact_email = ?`)
    .bind(tenantId, normalisedEmail)
    .first<{ id: string; name: string; contact_name: string; contact_email: string; status: ClientRecord["status"]; updated_at: string }>();
}

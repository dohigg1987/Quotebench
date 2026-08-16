import type { ChatGPTUser } from "../app/chatgpt-auth";

export type WorkspaceRole = "owner" | "admin" | "quoter";
export type WorkspaceMember = {
  email: string;
  displayName: string;
  role: WorkspaceRole;
  status: "Active" | "Invited" | "Removed";
  invitedAt: string | null;
  expiresAt: string | null;
  joinedAt: string | null;
};

const MEMBERS_SCHEMA = `CREATE TABLE IF NOT EXISTS workspace_members (
  tenant_id TEXT NOT NULL,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'quoter')),
  status TEXT NOT NULL CHECK (status IN ('Active', 'Invited', 'Removed')),
  invited_by TEXT,
  invited_at TEXT,
  expires_at TEXT,
  joined_at TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (tenant_id, email)
)`;

async function database() {
  const { env } = await import("cloudflare:workers");
  if (!env.DB) throw new Error("Workspace membership storage is unavailable.");
  return env.DB;
}

async function ensureMembers() {
  const db = await database();
  await db.batch([
    db.prepare(MEMBERS_SCHEMA),
    db.prepare("CREATE INDEX IF NOT EXISTS workspace_members_tenant_status_idx ON workspace_members (tenant_id, status)"),
  ]);
}

export async function resolveWorkspaceMember(tenantId: string, user: ChatGPTUser) {
  await ensureMembers();
  const db = await database();
  const count = await db.prepare("SELECT COUNT(*) AS count FROM workspace_members WHERE tenant_id = ? AND status != 'Removed'")
    .bind(tenantId).first<{ count: number }>();
  if ((count?.count ?? 0) === 0) {
    await db.prepare(`INSERT INTO workspace_members
      (tenant_id, email, display_name, role, status, joined_at)
      VALUES (?, ?, ?, 'owner', 'Active', CURRENT_TIMESTAMP)`)
      .bind(tenantId, user.email.toLowerCase(), user.displayName).run();
  }
  const member = await db.prepare(`SELECT email, display_name, role, status, invited_at, expires_at, joined_at
    FROM workspace_members WHERE tenant_id = ? AND email = ?`)
    .bind(tenantId, user.email.toLowerCase())
    .first<{ email: string; display_name: string; role: WorkspaceRole; status: WorkspaceMember["status"]; invited_at: string | null; expires_at: string | null; joined_at: string | null }>();
  if (member?.status === "Invited") {
    if (!member.expires_at || new Date(`${member.expires_at.replace(" ", "T")}Z`).getTime() < Date.now()) {
      throw new Error("This workspace invitation has expired. Ask an owner or admin to resend it.");
    }
    await db.prepare(`UPDATE workspace_members SET status = 'Active', display_name = ?, joined_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND email = ?`)
      .bind(user.displayName, tenantId, user.email.toLowerCase()).run();
    return { ...member, displayName: user.displayName, status: "Active" as const };
  }
  return member ? { email: member.email, displayName: member.display_name, role: member.role, status: member.status, invitedAt: member.invited_at, expiresAt: member.expires_at, joinedAt: member.joined_at } : null;
}

export async function requireWorkspaceRole(tenantId: string, user: ChatGPTUser, allowed: WorkspaceRole[]) {
  const member = await resolveWorkspaceMember(tenantId, user);
  if (!member || member.status !== "Active" || !allowed.includes(member.role)) {
    throw new Error(`forbidden: this action requires ${allowed.join(" or ")} role`);
  }
  return member;
}

export async function listWorkspaceMembers(tenantId: string) {
  await ensureMembers();
  const db = await database();
  const result = await db.prepare(`SELECT email, display_name, role, status, invited_at, expires_at, joined_at
    FROM workspace_members WHERE tenant_id = ? AND status != 'Removed' ORDER BY role, display_name`)
    .bind(tenantId)
    .all<{ email: string; display_name: string; role: WorkspaceRole; status: WorkspaceMember["status"]; invited_at: string | null; expires_at: string | null; joined_at: string | null }>();
  return result.results.map((row) => ({ email: row.email, displayName: row.display_name, role: row.role, status: row.status, invitedAt: row.invited_at, expiresAt: row.expires_at, joinedAt: row.joined_at }));
}

export async function inviteWorkspaceMember(tenantId: string, email: string, role: Exclude<WorkspaceRole, "owner">, actorEmail: string) {
  await ensureMembers();
  const db = await database();
  const { assertCapacity } = await import("./entitlement-store");
  await assertCapacity(tenantId, "seats");
  const normalisedEmail = email.trim().toLowerCase();
  await db.prepare(`INSERT INTO workspace_members
      (tenant_id, email, display_name, role, status, invited_by, invited_at, expires_at)
    VALUES (?, ?, ?, ?, 'Invited', ?, CURRENT_TIMESTAMP, datetime('now', '+14 days'))
    ON CONFLICT(tenant_id, email) DO UPDATE SET role = excluded.role, status = 'Invited',
      invited_by = excluded.invited_by, invited_at = CURRENT_TIMESTAMP,
      expires_at = datetime('now', '+14 days'), updated_at = CURRENT_TIMESTAMP`)
    .bind(tenantId, normalisedEmail, normalisedEmail.split("@")[0], role, actorEmail).run();
}

export async function updateWorkspaceMember(tenantId: string, email: string, action: "role" | "remove", role: WorkspaceRole | undefined, actorEmail: string) {
  await ensureMembers();
  const db = await database();
  const target = await db.prepare("SELECT role, status FROM workspace_members WHERE tenant_id = ? AND email = ?")
    .bind(tenantId, email.toLowerCase()).first<{ role: WorkspaceRole; status: WorkspaceMember["status"] }>();
  if (!target) throw new Error("The workspace member could not be found.");
  const ownerCount = await db.prepare("SELECT COUNT(*) AS count FROM workspace_members WHERE tenant_id = ? AND role = 'owner' AND status = 'Active'")
    .bind(tenantId).first<{ count: number }>();
  if (target.role === "owner" && (action === "remove" || role !== "owner") && (ownerCount?.count ?? 0) <= 1) throw new Error("The last workspace owner cannot be removed or downgraded.");
  if (action === "remove") {
    await db.batch([
      db.prepare("UPDATE workspace_members SET status = 'Removed', updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND email = ?").bind(tenantId, email.toLowerCase()),
      db.prepare("UPDATE quotes SET owner_email = ? WHERE tenant_id = ? AND owner_email = ?").bind(actorEmail, tenantId, email.toLowerCase()),
    ]);
  } else if (role) {
    await db.prepare("UPDATE workspace_members SET role = ?, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND email = ?")
      .bind(role, tenantId, email.toLowerCase()).run();
  }
}

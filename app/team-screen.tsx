"use client";

import { useEffect, useState } from "react";

type Role = "owner" | "admin" | "quoter";
type Member = { email: string; displayName: string; role: Role; status: "Active" | "Invited" | "Removed"; invitedAt: string | null; expiresAt: string | null; joinedAt: string | null };

export default function TeamScreen() {
  const [members, setMembers] = useState<Member[]>([]); const [currentRole, setCurrentRole] = useState<Role>("quoter"); const [seatLimit, setSeatLimit] = useState(0);
  const [email, setEmail] = useState(""); const [role, setRole] = useState<"admin" | "quoter">("quoter"); const [busy, setBusy] = useState(false); const [message, setMessage] = useState<string | null>(null);

  useEffect(() => { fetch("/api/team", { cache: "no-store" }).then(async response => { const payload = await response.json() as { members?: Member[]; currentRole?: Role; seatLimit?: number; error?: string }; if (!response.ok) throw new Error(payload.error ?? "Workspace members are unavailable."); setMembers(payload.members ?? []); setCurrentRole(payload.currentRole ?? "quoter"); setSeatLimit(payload.seatLimit ?? 0); }).catch((error: unknown) => setMessage(error instanceof Error ? error.message : "Workspace members are unavailable.")); }, []);

  async function invite() { setBusy(true); setMessage(null); try { const response = await fetch("/api/team", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, role }) }); const payload = await response.json() as { members?: Member[]; error?: string }; if (!response.ok) throw new Error(payload.error ?? "The invitation could not be created."); setMembers(payload.members ?? []); setEmail(""); setMessage("Invitation created. It expires after 14 days and activates when that user signs in."); } catch (error) { setMessage(error instanceof Error ? error.message : "The invitation could not be created."); } finally { setBusy(false); } }

  async function updateMember(member: Member, action: "role" | "remove", nextRole?: Role) { setMessage(null); const response = await fetch("/api/team", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: member.email, action, role: nextRole }) }); const payload = await response.json() as { members?: Member[]; error?: string }; if (!response.ok) { setMessage(payload.error ?? "The member could not be updated."); return; } setMembers(payload.members ?? []); }

  const canInvite = currentRole === "owner" || currentRole === "admin";
  return <div className="standard-page">
    <div className="page-heading"><div><p className="eyebrow">Tenant administration</p><h1>Team and roles</h1><p className="page-subtitle">Control who can quote, configure pricing and administer the workspace.</p></div><span className="status">{members.length} of {seatLimit || "–"} seats</span></div>
    {message && <div className="notice" role="status"><span>i</span>{message}<button onClick={() => setMessage(null)}>×</button></div>}
    {canInvite && <section className="catalogue-editor team-invite"><div className="editor-heading"><div><p className="eyebrow">New invitation</p><h2>Invite a workspace member</h2></div></div><div className="team-invite-fields"><label><span>Email address</span><input type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="name@company.com" /></label><label><span>Role</span><select value={role} onChange={event => setRole(event.target.value as "admin" | "quoter")}><option value="quoter">Quoter</option><option value="admin">Admin</option></select></label><button className="button primary" onClick={invite} disabled={busy || !email}>{busy ? "Creating…" : "Create invitation"}</button></div></section>}
    <section className="data-panel"><div className="panel-toolbar"><div><h2>Workspace members</h2><p>Owners govern roles; removed members&apos; quotes transfer to the acting owner.</p></div></div><div className="member-table"><div className="member-row member-header"><span>Member</span><span>Status</span><span>Role</span><span>Joined or invited</span><span /></div>{members.map(member => <div className="member-row" key={member.email}><span><strong>{member.displayName}</strong><small>{member.email}</small></span><span className="status">{member.status}</span><span>{currentRole === "owner" ? <select aria-label={`Role for ${member.email}`} value={member.role} onChange={event => void updateMember(member, "role", event.target.value as Role)}><option value="owner">Owner</option><option value="admin">Admin</option><option value="quoter">Quoter</option></select> : member.role}</span><span>{member.joinedAt ?? member.invitedAt ?? "Pending"}</span><span>{currentRole === "owner" && <button className="text-button danger-text" onClick={() => void updateMember(member, "remove")}>Remove</button>}</span></div>)}</div></section>
  </div>;
}

"use client";

import { useEffect, useState } from "react";
import type { ProposalType } from "../db/catalogue-store";
import type { EngagementContent, EngagementContentKind } from "../db/engagement-store";

const KIND_LABELS: Record<EngagementContentKind, string> = { engagement_letter: "Engagement letter", service_schedule: "Schedule of services", master_terms: "Master terms", jurisdiction_clause: "Jurisdiction clause", clause: "Clause" };
const emptyDraft = (): Partial<EngagementContent> => ({ kind: "engagement_letter", name: "", jurisdiction: "England and Wales", content: "", mandatory: true, proposalTypeIds: [], effectiveFrom: new Date().toISOString().slice(0, 10) });

export default function EngagementScreen({ proposalTypes }: { proposalTypes: ProposalType[] }) {
  const [items, setItems] = useState<EngagementContent[]>([]); const [draft, setDraft] = useState<Partial<EngagementContent>>(emptyDraft()); const [notice, setNotice] = useState<string | null>(null); const [saving, setSaving] = useState(false);
  async function refresh() { const response = await fetch("/api/engagement", { cache: "no-store" }); const payload = await response.json() as { content?: EngagementContent[]; error?: string }; if (!response.ok) throw new Error(payload.error); setItems(payload.content ?? []); }
  useEffect(() => { const controller = new AbortController(); void fetch("/api/engagement", { cache: "no-store", signal: controller.signal }).then(async (response) => ({ response, payload: await response.json() as { content?: EngagementContent[]; error?: string } })).then(({ response, payload }) => { if (!response.ok) throw new Error(payload.error); setItems(payload.content ?? []); }).catch((error) => { if (!(error instanceof DOMException && error.name === "AbortError")) setNotice(error instanceof Error ? error.message : "Legal content could not be loaded."); }); return () => controller.abort(); }, []);
  async function act(action: "save" | "publish" | "new_version", item = draft) { setSaving(true); setNotice(null); try { const response = await fetch("/api/engagement", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...item, action }) }); const payload = await response.json() as { item?: EngagementContent; error?: string }; if (!response.ok) throw new Error(payload.error); await refresh(); setDraft(action === "new_version" && payload.item ? payload.item : emptyDraft()); setNotice(action === "publish" ? "Version published and locked. Quotes now snapshot this content." : action === "new_version" ? "New editable version created." : "Draft saved."); } catch (error) { setNotice(error instanceof Error ? error.message : "The change could not be saved."); } finally { setSaving(false); } }
  function toggleProposalType(id: string) { setDraft((current) => ({ ...current, proposalTypeIds: current.proposalTypeIds?.includes(id) ? current.proposalTypeIds.filter((entry) => entry !== id) : [...(current.proposalTypeIds ?? []), id] })); }
  const activeProposalTypes = proposalTypes.filter((type) => type.active);
  const publishedCount = items.filter((item) => item.status === "Published").length;

  return (
    <div className="standard-page engagement-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Engagement governance</p>
          <h1>Legal content and policies</h1>
          <p className="page-subtitle">Control engagement letters, service schedules, master terms and mandatory clauses as immutable published versions.</p>
        </div>
        <button className="button secondary" onClick={() => setDraft(emptyDraft())}>New content</button>
      </div>

      {notice && <div className="notice" role="status"><span>i</span>{notice}<button onClick={() => setNotice(null)}>×</button></div>}

      <div className="engagement-layout">
        <section className="engagement-card engagement-editor-card">
          <header className="engagement-card-header">
            <div>
              <p className="eyebrow">Version-controlled editor</p>
              <h2>{draft.id ? `${draft.name} · v${draft.version}` : "New legal content"}</h2>
              <p>Create and govern the content that forms part of the contractual proposal pack.</p>
            </div>
            {draft.status && <span className="status">{draft.status}</span>}
          </header>

          <div className="engagement-form-grid">
            <label className="engagement-field">
              <span>Content type</span>
              <select value={draft.kind} onChange={(event) => setDraft({ ...draft, kind: event.target.value as EngagementContentKind })}>
                {Object.entries(KIND_LABELS).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
              </select>
            </label>
            <label className="engagement-field">
              <span>Name</span>
              <input value={draft.name ?? ""} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Standard engagement letter" />
            </label>
            <label className="engagement-field">
              <span>Jurisdiction</span>
              <input value={draft.jurisdiction ?? ""} onChange={(event) => setDraft({ ...draft, jurisdiction: event.target.value })} />
            </label>
            <label className="engagement-field">
              <span>Effective from</span>
              <input type="date" value={draft.effectiveFrom ?? ""} onChange={(event) => setDraft({ ...draft, effectiveFrom: event.target.value })} />
            </label>
          </div>

          <label className="engagement-field engagement-content-field">
            <span>Controlled content</span>
            <small>Published versions become immutable and remain available for historic quote evidence.</small>
            <textarea rows={10} value={draft.content ?? ""} onChange={(event) => setDraft({ ...draft, content: event.target.value })} placeholder="Draft the approved legal content." />
          </label>

          <div className="engagement-policy-grid">
            <section className="policy-card">
              <div>
                <span className="policy-icon" aria-hidden="true">✓</span>
                <span><strong>Mandatory clause policy</strong><small>Ready proposals must include a published version for each applicable mandatory policy.</small></span>
              </div>
              <label className="policy-switch">
                <input type="checkbox" checked={draft.mandatory ?? false} onChange={(event) => setDraft({ ...draft, mandatory: event.target.checked })} />
                <span aria-hidden="true" />
                <b>{draft.mandatory ? "Required" : "Optional"}</b>
              </label>
            </section>

            <fieldset className="proposal-scope">
              <legend>Applies to proposal types</legend>
              <p>No selection applies this content to every proposal type.</p>
              <div className="proposal-scope-grid">
                {activeProposalTypes.map((type) => (
                  <label key={type.id}>
                    <input type="checkbox" checked={draft.proposalTypeIds?.includes(type.id) ?? false} onChange={() => toggleProposalType(type.id)} />
                    <span>{type.name}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          </div>

          <footer className="engagement-actions">
            <small>{draft.id ? `Version ${draft.version} · ${draft.status}` : "Complete the name and controlled content to save this draft."}</small>
            <div>
              {(!draft.status || draft.status === "Draft") && <>
                <button className="button primary" disabled={saving || !draft.name || !draft.content} onClick={() => void act("save")}>{saving ? "Saving…" : "Save draft"}</button>
                {draft.id && <button className="button secondary" disabled={saving} onClick={() => void act("publish")}>Publish and lock</button>}
              </>}
              {draft.id && draft.status !== "Draft" && <button className="button primary" disabled={saving} onClick={() => void act("new_version")}>Create new version</button>}
            </div>
          </footer>
        </section>

        <section className="engagement-card engagement-register-card">
          <header className="engagement-card-header register-heading">
            <div>
              <p className="eyebrow">Governed library</p>
              <h2>Controlled content register</h2>
              <p>Select a record to inspect its content, status and version history.</p>
            </div>
            <span className="register-count"><strong>{publishedCount}</strong><small>Published</small></span>
          </header>
          <div className="legal-register">
            {items.map((item) => (
              <button key={item.id} onClick={() => setDraft(item)} className={draft.id === item.id ? "active" : ""}>
                <span><strong>{item.name}</strong><small>{KIND_LABELS[item.kind]} · {item.jurisdiction}</small></span>
                <span><strong>v{item.version}</strong><small>{item.status}{item.mandatory ? " · Mandatory" : ""}</small></span>
              </button>
            ))}
            {items.length === 0 && <div className="engagement-empty-state"><span aria-hidden="true">§</span><strong>No governed legal content yet</strong><p>Create and publish the first engagement letter or clause policy.</p><button className="button secondary" onClick={() => setDraft(emptyDraft())}>Create first record</button></div>}
          </div>
        </section>
      </div>
    </div>
  );
}

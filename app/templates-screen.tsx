"use client";

import { useEffect, useState } from "react";
import TemplateStudio from "./template-studio";

type Template = { id: string; name: string; version: number; summary: string; itemCount: number; questionCount: number; blockCount: number };
type Workspace = { templates: Template[]; personalTemplates: Array<{ id: string; name: string; created_at: string }>; state: { status: string; selected_template?: string; walkthrough_step: number }; existingCatalogueItems: number };

export default function TemplatesScreen({ onProvisioned, startQuote }: { onProvisioned: () => void; startQuote: () => void }) {
  const [view, setView] = useState<"proposals" | "setup">("proposals");
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [personalName, setPersonalName] = useState("");

  function load() {
    fetch("/api/templates", { cache: "no-store" }).then(async (response) => {
      const payload = (await response.json()) as Workspace & { error?: string };
      if (!response.ok) throw new Error(payload.error);
      setWorkspace(payload);
    }).catch((error: unknown) => setMessage(error instanceof Error ? error.message : "Templates are unavailable."));
  }

  useEffect(load, []);

  async function act(action: string, extra: Record<string, string> = {}) {
    setWorking(true);
    setMessage(null);
    try {
      const response = await fetch("/api/templates", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, ...extra }) });
      const payload = (await response.json()) as Workspace & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "The setup action failed.");
      setWorkspace(payload);
      setMessage(action === "provision" ? "Industry configuration provisioned. Existing records were retained." : action === "save_personal" ? "Configuration snapshot saved." : "Onboarding state updated.");
      if (action === "provision") onProvisioned();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The setup action failed.");
    } finally {
      setWorking(false);
    }
  }

  const active = workspace?.templates.find((template) => template.id === selected);

  return <div className="standard-page templates-page">
    <div className="page-heading"><div><p className="eyebrow">Reusable content system</p><h1>Templates</h1><p className="page-subtitle">Create standard proposal experiences and maintain optional industry configuration in one controlled workspace.</p></div></div>
    <nav className="template-view-switch" aria-label="Template workspace"><button type="button" className={view === "proposals" ? "active" : ""} onClick={() => setView("proposals")}><strong>Proposal templates</strong><span>Visual pages, blocks and live data</span></button><button type="button" className={view === "setup" ? "active" : ""} onClick={() => setView("setup")}><strong>Industry setup</strong><span>Catalogue, rules and onboarding</span></button></nav>

    {view === "proposals" ? <TemplateStudio/> : <div className="industry-setup-workspace">
      {message && <div className="notice" role="status"><span>i</span>{message}<button onClick={() => setMessage(null)}>×</button></div>}
      <div className="industry-template-grid">{workspace?.templates.map((template) => <button key={template.id} className={selected === template.id ? "industry-card selected" : "industry-card"} onClick={() => setSelected(template.id)}><span>Version {template.version}</span><strong>{template.name}</strong><p>{template.summary}</p><small>{template.itemCount} priced items · {template.questionCount} modifier question · {template.blockCount} document blocks</small></button>)}</div>
      {active && <section className="data-panel provision-summary"><div className="panel-toolbar"><div><h2>Provision {active.name}</h2><p>Create priced catalogue records, a published default rule set and industry-specific document copy.</p></div></div>{Number(workspace?.existingCatalogueItems ?? 0) > 0 && <div className="delivery-warning"><strong>Existing catalogue detected</strong><p>{workspace?.existingCatalogueItems} records will be retained. Matching identifiers are merged without replacing unrelated configuration.</p></div>}<div className="editor-actions"><button className="button primary" disabled={working} onClick={() => void act("provision", { templateId: active.id })}>Provision setup</button><button className="button secondary" disabled={working} onClick={() => void act("skip")}>Skip setup</button></div></section>}
      <div className="industry-setup-secondary"><section className="data-panel walkthrough-panel"><div className="panel-toolbar"><div><h2>Guided first quote</h2><p>Resume or complete the walkthrough without repeating it for this user.</p></div><span className="status">Step {workspace?.state.walkthrough_step ?? 0} of 4</span></div><ol><li>Confirm the industry configuration.</li><li>Select a client and realistic scope.</li><li>Review calculation and margin controls.</li><li>Save the first quote for delivery.</li></ol><div className="editor-actions"><button className="button primary" onClick={() => { void act("resume"); startQuote(); }}>Resume walkthrough</button><button className="button secondary" onClick={() => void act("complete")}>Mark complete</button></div></section><section className="data-panel personal-template-panel"><div className="panel-toolbar"><div><h2>Configuration snapshots</h2><p>Capture the current catalogue, rules and default proposal as an isolated setup snapshot.</p></div></div><div className="personal-template-form"><input placeholder="Snapshot name" value={personalName} onChange={(event) => setPersonalName(event.target.value)}/><button className="button secondary" disabled={!personalName.trim() || working} onClick={() => void act("save_personal", { name: personalName })}>Save snapshot</button></div>{workspace?.personalTemplates.map((template) => <div className="personal-template-row" key={template.id}><strong>{template.name}</strong><span>{new Date(`${template.created_at.replace(" ", "T")}Z`).toLocaleDateString("en-GB")}</span></div>)}</section></div>
    </div>}
  </div>;
}

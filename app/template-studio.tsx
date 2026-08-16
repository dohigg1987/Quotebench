"use client";

import { useCallback, useEffect, useState } from "react";
import type { DocumentTemplate } from "../db/document-store";
import { sampleProposalMetadata } from "../lib/proposal-metadata";
import ProposalEditor from "./proposal-editor";

function starterTemplate(): DocumentTemplate {
  return {
    id: crypto.randomUUID(),
    name: "New proposal template",
    industry: "Multi-purpose",
    isDefault: false,
    pages: [{
      id: crypto.randomUUID(),
      title: "Proposal overview",
      format: "standard",
      background: "plain",
      blocks: [
        { id: crypto.randomUUID(), type: "heading", eyebrow: "Prepared for {{client.name}}", title: "{{proposal.title}}", enabled: true },
        { id: crypto.randomUUID(), type: "text", title: "A proposal shaped around your priorities", content: "Dear {{client.contact_name}},\n\nUse this section to set out the client context, intended outcomes and recommended approach.", enabled: true },
        { id: crypto.randomUUID(), type: "pricing_table", title: "Scope and investment", display: "full", locked: true, enabled: true },
        { id: crypto.randomUUID(), type: "terms", title: "Commercial terms", content: "This proposal, reference {{quote.reference}}, is valid until {{quote.valid_until}}.", locked: true, enabled: true },
        { id: crypto.randomUUID(), type: "signature", title: "Acceptance", locked: true, enabled: true },
      ],
    }],
  };
}

export default function TemplateStudio() {
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [activeTemplate, setActiveTemplate] = useState<DocumentTemplate | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function load() {
    fetch("/api/documents", { cache: "no-store" }).then(async (response) => {
      const payload = await response.json() as { templates?: DocumentTemplate[]; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Proposal templates are unavailable.");
      setTemplates(payload.templates ?? []);
      setActiveTemplate((current) => current ?? payload.templates?.[0] ?? null);
    }).catch((error: unknown) => setMessage(error instanceof Error ? error.message : "Proposal templates are unavailable."));
  }

  useEffect(load, []);

  async function saveTemplate() {
    if (!activeTemplate) return;
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/documents", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "save_template", template: activeTemplate }) });
      const payload = await response.json() as { templates?: DocumentTemplate[]; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "The template could not be saved.");
      const saved = payload.templates?.find((template) => template.id === activeTemplate.id) ?? payload.templates?.find((template) => template.name === activeTemplate.name) ?? activeTemplate;
      setTemplates(payload.templates ?? templates);
      setActiveTemplate(saved);
      setMessage("Template saved. New quotes can now apply this reusable page set and resolve its live data fields.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The template could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  const uploadImage = useCallback(async (file: File) => {
    const form = new FormData();
    form.set("file", file);
    form.set("kind", "image");
    const response = await fetch("/api/uploads", { method: "POST", body: form });
    const payload = await response.json() as { file?: { id: string }; error?: string };
    if (!response.ok || !payload.file) {
      setMessage(payload.error ?? "Image upload failed.");
      return null;
    }
    return payload.file.id;
  }, []);

  const updatePages = useCallback((pages: DocumentTemplate["pages"]) => {
    setActiveTemplate((current) => current ? { ...current, pages } : current);
  }, []);

  function createTemplate() {
    const template = starterTemplate();
    setTemplates((current) => [template, ...current]);
    setActiveTemplate(template);
  }

  return <section className="template-workspace">
    <div className="template-workspace-toolbar">
      <div><h2>Standard proposal templates</h2><p>Design reusable page sets once, then apply an independent editable copy to each quote.</p></div>
      <div><select aria-label="Selected proposal template" value={activeTemplate?.id ?? ""} onChange={(event) => setActiveTemplate(templates.find((template) => template.id === event.target.value) ?? null)}>{templates.map((template) => <option key={template.id} value={template.id}>{template.name}{template.isDefault ? " · Default" : ""}</option>)}</select><button className="button secondary" type="button" onClick={createTemplate}>New template</button><button className="button primary" type="button" onClick={() => void saveTemplate()} disabled={saving || !activeTemplate}>{saving ? "Saving…" : "Save template"}</button></div>
    </div>
    {message && <div className="notice" role="status"><span>i</span>{message}<button onClick={() => setMessage(null)}>×</button></div>}
    {activeTemplate ? <>
      <div className="template-meta-compact">
        <label><span>Template name</span><input value={activeTemplate.name} onChange={(event) => setActiveTemplate({ ...activeTemplate, name: event.target.value })}/></label>
        <label><span>Use case or sector</span><input value={activeTemplate.industry ?? ""} placeholder="Advisory, construction, SaaS…" onChange={(event) => setActiveTemplate({ ...activeTemplate, industry: event.target.value })}/></label>
        <label className="template-default-control"><input type="checkbox" checked={activeTemplate.isDefault} onChange={(event) => setActiveTemplate({ ...activeTemplate, isDefault: event.target.checked })}/><span>Use as workspace default</span></label>
      </div>
      <div className="template-editor-intro"><div><strong>Visual template editor</strong><p>Drag content blocks onto the page. Pricing, terms and acceptance remain governed; data fields resolve from each quote.</p></div><span>{activeTemplate.pages.length} {activeTemplate.pages.length === 1 ? "page" : "pages"}</span></div>
      <ProposalEditor value={activeTemplate.pages} onChange={updatePages} onUploadImage={uploadImage} metadataPreview={sampleProposalMetadata} context="template"/>
    </> : <div className="template-empty"><strong>No proposal template selected</strong><p>Create a standard template to begin.</p><button className="button primary" type="button" onClick={createTemplate}>Create template</button></div>}
  </section>;
}

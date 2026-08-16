"use client";

import { useState } from "react";
import type { PricedQuote } from "../packages/pricing-engine/src/index";
import type { DocumentBlock, DocumentPage } from "../db/document-store";
import { proposalMetadataFields, type ProposalMetadata } from "../lib/proposal-metadata";
import EditorErrorBoundary from "./editor-error-boundary";
import { ProposalPuck, commonBlock } from "./proposal-puck";

type ProposalEditorProps = {
  value: DocumentPage[];
  onChange: (pages: DocumentPage[]) => void;
  onUploadImage?: (file: File) => Promise<string | null>;
  pricingPreview?: PricedQuote | null;
  proposalOptions?: Array<{ id: string; label: string }>;
  metadataPreview?: ProposalMetadata;
  context?: "quote" | "template";
  readOnly?: boolean;
};

function newPage(number: number, format: DocumentPage["format"] = "standard"): DocumentPage {
  return { id: crypto.randomUUID(), title: `Page ${number}`, format, background: "plain", blocks: [] };
}

function cloneBlock(block: DocumentBlock): DocumentBlock {
  return { ...block, id: crypto.randomUUID(), items: block.items?.map((item) => ({ ...item, id: crypto.randomUUID() })) };
}

export default function ProposalEditor({ value, onChange, onUploadImage, pricingPreview, proposalOptions, metadataPreview, context = "quote", readOnly = false }: ProposalEditorProps) {
  const pages = value.length ? value : [{ id: "proposal-page-fallback", title: "Page 1", format: "standard" as const, background: "plain" as const, blocks: [] }];
  const [selectedId, setSelectedId] = useState(pages[0].id);
  const [pageMenuOpen, setPageMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [dataOpen, setDataOpen] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const pageIndex = Math.max(0, pages.findIndex((page) => page.id === selectedId));
  const page = pages[pageIndex];

  const setPage = (patch: Partial<DocumentPage>) => onChange(pages.map((candidate, index) => index === pageIndex ? { ...candidate, ...patch } : candidate));
  const selectPage = (id: string | undefined) => { if (id) setSelectedId(id); setPageMenuOpen(false); };
  const addPage = (format: DocumentPage["format"]) => {
    if (pages.length >= 40) return;
    const nextPage = newPage(pages.length + 1, format);
    onChange([...pages, nextPage]);
    setSelectedId(nextPage.id);
    setPageMenuOpen(false);
  };
  const duplicatePage = () => {
    if (pages.length >= 40) return;
    const copy: DocumentPage = { ...page, id: crypto.randomUUID(), title: `${page.title} copy`, blocks: page.blocks.map(cloneBlock) };
    const next = [...pages];
    next.splice(pageIndex + 1, 0, copy);
    onChange(next);
    setSelectedId(copy.id);
  };
  const removePage = () => {
    if (pages.length === 1) return;
    const next = pages.filter((_, index) => index !== pageIndex);
    onChange(next);
    setSelectedId(next[Math.min(pageIndex, next.length - 1)].id);
  };
  const movePage = (offset: -1 | 1) => {
    const target = pageIndex + offset;
    if (target < 0 || target >= pages.length) return;
    const next = [...pages];
    [next[pageIndex], next[target]] = [next[target], next[pageIndex]];
    onChange(next);
  };
  const seedPage = () => {
    if (page.blocks.length) return;
    setPage({ blocks: [commonBlock("text"), commonBlock("feature_grid"), commonBlock("pricing_table"), commonBlock("terms"), commonBlock("signature")] });
  };
  const copyToken = (token: string) => {
    if (navigator.clipboard) void navigator.clipboard.writeText(token);
    setCopiedToken(token);
    window.setTimeout(() => setCopiedToken(null), 1400);
  };

  return <div className="puck-proposal-studio">
    <section className="puck-page-manager" aria-label="Proposal pages">
      <div className="puck-page-toolbar">
        <div className="puck-page-navigator">
          <button type="button" disabled={pageIndex === 0} onClick={() => selectPage(pages[pageIndex - 1]?.id)} aria-label="Previous page">←</button>
          <label><span>Current page</span><select aria-label="Current proposal page" value={page.id} onChange={(event) => selectPage(event.target.value)}>{pages.map((candidate, index) => <option key={candidate.id} value={candidate.id}>{index + 1}. {candidate.title}</option>)}</select></label>
          <button type="button" disabled={pageIndex === pages.length - 1} onClick={() => selectPage(pages[pageIndex + 1]?.id)} aria-label="Next page">→</button>
          <span className="puck-page-summary">{page.blocks.length} {page.blocks.length === 1 ? "block" : "blocks"} · {pages.length} {pages.length === 1 ? "page" : "pages"}</span>
        </div>
        {!readOnly && <div className="puck-page-toolbar-actions">
          {context === "template" && <button type="button" className={dataOpen ? "active" : ""} aria-expanded={dataOpen} onClick={() => setDataOpen((open) => !open)}>Data fields</button>}
          <button type="button" className={settingsOpen ? "active" : ""} aria-expanded={settingsOpen} onClick={() => setSettingsOpen((open) => !open)}>Page settings</button>
          <div className="puck-page-add"><button type="button" disabled={pages.length >= 40} aria-expanded={pageMenuOpen} onClick={() => setPageMenuOpen((open) => !open)}>+ Add page</button>{pageMenuOpen && <div role="menu"><button type="button" onClick={() => addPage("standard")}>Standard page<small>Balanced document layout</small></button><button type="button" onClick={() => addPage("wide")}>Wide page<small>Tables and visual content</small></button><button type="button" onClick={() => addPage("cover")}>Cover page<small>Opening statement or section divider</small></button><button type="button" onClick={() => addPage("letter")}>Letter page<small>Formal narrative format</small></button></div>}</div>
        </div>}
      </div>

      {context === "template" && dataOpen && <div className="puck-data-fields" role="region" aria-label="Template data fields"><div><strong>Live data fields</strong><p>Copy a field into any heading or content field. The editor shows sample values; each quote resolves its own data.</p></div><div>{proposalMetadataFields.map((field) => <button type="button" key={field.token} onClick={() => copyToken(field.token)}><span>{field.label}</span><code>{copiedToken === field.token ? "Copied" : field.token}</code></button>)}</div></div>}

      {settingsOpen && <div className="puck-page-controls">
        <label><span>Page title</span><input aria-label="Page title" value={page.title} disabled={readOnly} onChange={(event) => setPage({ title: event.target.value })} /></label>
        <label><span>Format</span><select aria-label="Page format" value={page.format} disabled={readOnly} onChange={(event) => setPage({ format: event.target.value as DocumentPage["format"] })}><option value="standard">Standard</option><option value="wide">Wide showcase</option><option value="cover">Cover</option><option value="letter">Letter</option></select></label>
        <label><span>Background</span><select aria-label="Page background" value={page.background} disabled={readOnly} onChange={(event) => setPage({ background: event.target.value as DocumentPage["background"] })}><option value="plain">Plain</option><option value="soft">Soft tint</option><option value="brand">Brand tint</option><option value="dark">Dark</option></select></label>
        {!readOnly && <div className="puck-page-actions"><button type="button" disabled={pageIndex === 0} onClick={() => movePage(-1)}>Move left</button><button type="button" disabled={pageIndex === pages.length - 1} onClick={() => movePage(1)}>Move right</button><button type="button" disabled={pages.length >= 40} onClick={duplicatePage}>Duplicate</button><button type="button" className="danger-text" disabled={pages.length === 1} onClick={removePage}>Remove</button></div>}
      </div>}
    </section>

    {page.blocks.length === 0 && !readOnly && <section className="puck-empty-page"><div><span>+</span><strong>Start with a proven proposal structure</strong><p>Add an editable narrative, outcome grid, governed pricing, commercial terms and formal acceptance.</p></div><button type="button" className="button secondary" onClick={seedPage}>Create starter page</button></section>}

    <EditorErrorBoundary key={`${page.id}:${page.format}:${page.background}:${readOnly}`} context={context} fallback={(retry) => <section className="puck-editor-recovery" role="alert"><div><strong>The visual canvas could not be displayed</strong><p>Your proposal content remains unchanged. Retry the Puck editor to continue.</p></div><button type="button" className="button primary" onClick={retry}>Retry visual editor</button></section>}>
      <ProposalPuck page={page} readOnly={readOnly} pricingPreview={pricingPreview} proposalOptions={proposalOptions} metadataPreview={metadataPreview} onUploadImage={onUploadImage} onChange={(blocks) => setPage({ blocks })} />
    </EditorErrorBoundary>
  </div>;
}

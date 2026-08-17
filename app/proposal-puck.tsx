"use client";
/* Proposal images are tenant-controlled R2 objects and preserve their authored dimensions. */
/* eslint-disable @next/next/no-img-element */

import { Puck, type Config } from "@puckeditor/core";
import { isValidElement, useCallback, useMemo, type CSSProperties, type ReactNode } from "react";
import type { PricedQuote } from "../packages/pricing-engine/src/index";
import type { BlockType, DocumentBlock, DocumentPage } from "../db/document-store";
import { governedTypes, proposalPageToPuckData, puckDataToProposalBlocks } from "../lib/proposal-puck-data";
import { resolveProposalText, type ProposalMetadata } from "../lib/proposal-metadata";
import { formatMoney as formatMarketMoney, localeForCurrency } from "../lib/market";

type ProposalPuckProps = {
  page: DocumentPage;
  onChange: (blocks: DocumentBlock[]) => void;
  onUploadImage?: (file: File) => Promise<string | null>;
  pricingPreview?: PricedQuote | null;
  proposalOptions?: Array<{ id: string; label: string }>;
  metadataPreview?: ProposalMetadata;
  readOnly?: boolean;
};

const PUCK_VIEWPORTS = [
  { width: 1120, height: "auto" as const, label: "Desktop" },
  { width: 768, height: "auto" as const, label: "Tablet" },
  { width: 390, height: "auto" as const, label: "Mobile" },
];

// QuoteBench already supplies the document canvas styles. Keeping the canvas in
// the host document avoids Puck's iframe stylesheet-mirroring lifecycle, which
// can race with React route transitions and leave the editor subtree unusable.
const PUCK_IFRAME = { enabled: false, waitForStyles: false, syncHostStyles: false };

const blockLabels: Record<BlockType, string> = {
  heading: "Heading", text: "Rich narrative", callout: "Callout", pricing_table: "Pricing and packages",
  options: "Acceptance options", image: "Image", video: "Video", testimonial: "Testimonial",
  feature_grid: "Feature grid", timeline: "Timeline", team: "Team", faq: "FAQ",
  terms: "Commercial terms", signature: "Acceptance", spacer: "Spacing",
};

function commonBlock(type: BlockType): DocumentBlock {
  const item = (title: string, content: string) => ({ id: crypto.randomUUID(), title, content });
  const common: DocumentBlock = { id: crypto.randomUUID(), type, enabled: true, layout: "full", alignment: "left" };
  if (type === "pricing_table") return { ...common, title: "Scope and investment", display: "full", locked: true };
  if (type === "feature_grid") return { ...common, title: "What is included", layout: "cards", columns: 3, items: [item("Outcome one", "Describe the value delivered."), item("Outcome two", "Describe the value delivered."), item("Outcome three", "Describe the value delivered.")] };
  if (type === "timeline") return { ...common, title: "Delivery plan", items: [item("Mobilise", "Agree objectives, governance and ways of working."), item("Deliver", "Complete the agreed work and share progress."), item("Embed", "Transfer knowledge and confirm outcomes.")] };
  if (type === "faq") return { ...common, title: "Frequently asked questions", items: [item("What happens next?", "Explain mobilisation and next steps.")] };
  if (type === "team") return { ...common, title: "Your team", items: [item("Engagement lead", "Role, experience and responsibilities.")] };
  if (type === "testimonial") return { ...common, title: "Client perspective", content: "Add a relevant client quotation and attribution." };
  if (type === "terms") return { ...common, title: "Commercial terms", content: "Add payment, validity, delivery and other commercial terms.", locked: true };
  if (type === "signature") return { ...common, title: "Acceptance", content: "The recipient can formally accept or decline this proposal.", locked: true };
  if (type === "spacer") return common;
  return { ...common, title: type === "heading" ? "A clear section heading" : type === "callout" ? "Key outcome" : type === "options" ? "Proposal options" : type === "video" ? "Video introduction" : type === "image" ? "Visual" : "Narrative", content: "Add content for this block." };
}

function formatMoney(minor: number, currency: string) { return formatMarketMoney(minor,currency,localeForCurrency(currency)); }
function renderPuckValue(value: unknown, metadata?: ProposalMetadata): ReactNode {
  if (typeof value === "string") return resolveProposalText(value, metadata);
  if (typeof value === "number") return String(value);
  if (isValidElement(value)) return value;
  return null;
}
function accessiblePuckText(value: unknown, metadata?: ProposalMetadata) { return typeof value === "string" ? resolveProposalText(value, metadata) : undefined; }
function BlockHeading({ eyebrow, title, metadata }: { eyebrow?: unknown; title?: unknown; metadata?: ProposalMetadata }) { return <>{eyebrow && <p className="eyebrow">{renderPuckValue(eyebrow, metadata)}</p>}{title && <h2>{renderPuckValue(title, metadata)}</h2>}</>; }
function BlockFrame({ props, metadata, children, className = "" }: { props: Record<string, unknown>; metadata?: ProposalMetadata; children?: ReactNode; className?: string }) { return <section className={`qb-puck-block recipient-content-block align-${props.alignment ?? "left"} layout-${props.layout ?? "full"} ${className}`}><BlockHeading eyebrow={props.eyebrow} title={props.title} metadata={metadata} />{children}</section>; }

function buildConfig({ pricingPreview, proposalOptions = [], onUploadImage, metadataPreview }: Pick<ProposalPuckProps, "pricingPreview" | "proposalOptions" | "onUploadImage" | "metadataPreview">): Config {
  const presentationFields = {
    eyebrow: { type: "text", label: "Eyebrow", placeholder: "Optional section label", contentEditable: true },
    title: { type: "text", label: "Heading", contentEditable: true },
    layout: { type: "select", label: "Layout", options: [{ label: "Full width", value: "full" }, { label: "Split", value: "split" }, { label: "Cards", value: "cards" }, { label: "Compact", value: "compact" }] },
    alignment: { type: "radio", label: "Alignment", options: [{ label: "Left", value: "left" }, { label: "Centre", value: "center" }] },
  } as const;
  const narrativeField = { type: "textarea", label: "Content", placeholder: "Write the client-facing contentâ€¦", contentEditable: true } as const;
  const itemsField = { type: "array", label: "Items", min: 1, max: 24, arrayFields: { title: { type: "text", label: "Title" }, content: { type: "textarea", label: "Description" } }, defaultItemProps: () => ({ id: crypto.randomUUID(), title: "New item", content: "Add a concise description." }), getItemSummary: (item: { title?: string }) => item.title || "Untitled item" } as const;
  const defaults = (type: BlockType) => { const { type: _type, id: _id, ...props } = commonBlock(type); void _type; void _id; return props; };
  const component = (type: BlockType, fields: Record<string, unknown>, render: (props: Record<string, unknown>) => ReactNode) => ({ label: blockLabels[type], fields, defaultProps: defaults(type), permissions: governedTypes.has(type) ? { delete: false, duplicate: false } : undefined, render });
  const structured = (type: BlockType, extraClass: string) => component(type, { ...presentationFields, columns: { type: "select", label: "Columns", options: [1, 2, 3, 4].map((value) => ({ label: String(value), value })) }, items: itemsField }, (props) => <BlockFrame props={props} metadata={metadataPreview} className={extraClass}><div className="recipient-items" style={{ "--columns": String(props.columns ?? 3) } as CSSProperties}>{((props.items as Array<{ id?: string; title?: string; content?: string }>) ?? []).map((item, index) => <div key={item.id ?? index}><strong>{renderPuckValue(item.title, metadataPreview)}</strong><p>{renderPuckValue(item.content, metadataPreview)}</p></div>)}</div></BlockFrame>);

  const components = {
    heading: component("heading", presentationFields, (props) => <BlockFrame props={props} metadata={metadataPreview} className="qb-puck-heading" />),
    text: component("text", { ...presentationFields, content: narrativeField }, (props) => <BlockFrame props={props} metadata={metadataPreview}><p className="qb-puck-copy">{renderPuckValue(props.content, metadataPreview)}</p></BlockFrame>),
    callout: component("callout", { ...presentationFields, content: narrativeField }, (props) => <BlockFrame props={props} metadata={metadataPreview} className="recipient-callout"><p className="qb-puck-copy">{renderPuckValue(props.content, metadataPreview)}</p></BlockFrame>),
    pricing_table: component("pricing_table", { title: presentationFields.title, display: { type: "radio", label: "Pricing detail", options: [{ label: "Lines and totals", value: "full" }, { label: "Line items", value: "lines" }, { label: "Totals only", value: "totals" }] }, layout: presentationFields.layout }, (props) => {
      const lines = pricingPreview?.lines ?? []; const currency = pricingPreview?.currency ?? "GBP";
      const sampleLines = lines.length ? lines.slice(0, 8).map((line) => ({ id: line.lineId, name: line.itemName, detail: `${line.quantity} ${line.unitLabel}`, amount: formatMoney(line.finalPriceMinor, currency) })) : [{ id: "sample-1", name: "Selected service", detail: "Live quote scope", amount: "Calculated" }, { id: "sample-2", name: "Additional service", detail: "Live quote scope", amount: "Calculated" }];
      return <BlockFrame props={props} metadata={metadataPreview} className="qb-puck-pricing"><span className="qb-governed-badge">Governed pricing</span>{props.display !== "totals" && <div className="document-scope service-schedule-scope">{sampleLines.map((line) => <div className="proposal-service-line" key={line.id}><div><span><strong>{line.name}</strong><small>{line.detail}</small></span><strong>{line.amount}</strong></div></div>)}</div>}{props.display !== "lines" && <div className="document-totals"><div><small>ONE-OFF INVESTMENT</small><strong>{pricingPreview ? formatMoney(pricingPreview.oneOffSubtotalMinor, currency) : "Calculated from quote"}</strong></div></div>}</BlockFrame>;
    }),
    options: component("options", presentationFields, (props) => <BlockFrame props={props} metadata={metadataPreview}><div className="recipient-items">{(proposalOptions.length ? proposalOptions : [{ id: "option", label: "Client acceptance option" }]).map((option) => <div key={option.id}><strong>{option.label}</strong></div>)}</div></BlockFrame>),
    image: component("image", { ...presentationFields, fileId: { type: "custom", label: "Proposal image", render: ({ value, onChange }: { value?: string; onChange: (value: string) => void }) => <label className="qb-puck-upload"><span>{value ? "Replace image" : "Upload PNG, JPEG or WebP"}</span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (file && onUploadImage) void onUploadImage(file).then((id) => id && onChange(id)); }} />{value && <small>Image attached</small>}</label> } }, (props) => <BlockFrame props={props} metadata={metadataPreview}>{props.fileId ? <img className="recipient-media" src={`/api/files/${props.fileId as string}`} alt={accessiblePuckText(props.title, metadataPreview) || "Proposal image"} /> : <div className="qb-puck-media-placeholder"><span>Image</span><p>Choose an image in the properties panel.</p></div>}</BlockFrame>),
    video: component("video", { ...presentationFields, content: narrativeField, mediaUrl: { type: "text", label: "HTTPS video URL", placeholder: "https://â€¦" } }, (props) => <BlockFrame props={props} metadata={metadataPreview}><div className="qb-puck-video"><span>â–¶</span><div><strong>{renderPuckValue(props.title, metadataPreview)}</strong><p>{props.mediaUrl ? "Linked video" : "Add a secure video URL in the properties panel."}</p></div></div></BlockFrame>),
    testimonial: component("testimonial", { ...presentationFields, content: narrativeField }, (props) => <BlockFrame props={props} metadata={metadataPreview} className="qb-puck-testimonial"><blockquote>{renderPuckValue(props.content, metadataPreview)}</blockquote></BlockFrame>),
    feature_grid: structured("feature_grid", "qb-puck-feature-grid"), timeline: structured("timeline", "qb-puck-timeline"), team: structured("team", "qb-puck-team"), faq: structured("faq", "qb-puck-faq"),
    terms: component("terms", { ...presentationFields, content: narrativeField }, (props) => <BlockFrame props={props} metadata={metadataPreview} className="qb-puck-terms"><span className="qb-governed-badge">Required block</span><p className="qb-puck-copy">{renderPuckValue(props.content, metadataPreview)}</p></BlockFrame>),
    signature: component("signature", { title: presentationFields.title, layout: presentationFields.layout }, (props) => <BlockFrame props={props} metadata={metadataPreview} className="qb-puck-signature"><span className="qb-governed-badge">Required block</span><div><div><strong>Formal acceptance</strong><p>Recipient identity, timestamp and evidence are captured when this proposal is issued.</p></div><button type="button" disabled>Accept proposal</button></div></BlockFrame>),
    spacer: component("spacer", { height: { type: "select", label: "Spacing", options: [{ label: "Small", value: "small" }, { label: "Medium", value: "medium" }, { label: "Large", value: "large" }] } }, (props) => <div className={`qb-puck-spacer size-${props.height ?? "medium"}`} aria-label="Spacing block" />),
  };

  return { categories: { narrative: { title: "Narrative", components: ["heading", "text", "callout", "testimonial"] }, commercial: { title: "Commercial", components: ["pricing_table", "options", "terms", "signature"] }, visual: { title: "Visual and structured", components: ["image", "video", "feature_grid", "timeline", "team", "faq", "spacer"] } }, root: { render: ({ children, format, background }: { children: ReactNode; format?: string; background?: string }) => <main className={`qb-puck-document format-${format ?? "standard"} background-${background ?? "plain"}`}>{children}</main> }, components } as unknown as Config;
}

export function ProposalPuck({ page, onChange, onUploadImage, pricingPreview, proposalOptions, metadataPreview, readOnly = false }: ProposalPuckProps) {
  const data = useMemo(() => proposalPageToPuckData(page), [page]);
  const config = useMemo(() => buildConfig({ pricingPreview, proposalOptions, onUploadImage, metadataPreview }), [pricingPreview, proposalOptions, onUploadImage, metadataPreview]);
  const atBlockLimit = page.blocks.length >= 60;
  const permissions = useMemo(() => ({ delete: !readOnly, drag: !readOnly, duplicate: !readOnly && !atBlockLimit, edit: !readOnly, insert: !readOnly && !atBlockLimit }), [atBlockLimit, readOnly]);
  const handleChange = useCallback((next: Parameters<typeof puckDataToProposalBlocks>[0]) => onChange(puckDataToProposalBlocks(next)), [onChange]);
  return <div className="qb-puck-editor" data-read-only={readOnly ? "true" : "false"}><Puck config={config} data={data} onChange={handleChange} headerTitle={page.title} headerPath={`${page.blocks.length} of 60 blocks`} height={760} iframe={PUCK_IFRAME} permissions={permissions} viewports={PUCK_VIEWPORTS} /></div>;
}

export { commonBlock };


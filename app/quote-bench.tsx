"use client";
/* Proposal images are tenant-controlled R2 objects and preserve their authored dimensions. */
/* eslint-disable @next/next/no-img-element */

import { lazy, Suspense, useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  money,
  type CatalogueItem,
  type Frequency,
  type PricedQuote,
  type RuleSet,
} from "../packages/pricing-engine/src/index";
import type { QuoteBenchUser } from "./auth";
import { catalogue, defaultRuleSet, seedQuotes } from "./demo-data";
import IntegrationsScreen from "./integrations-screen";
import TeamScreen from "./team-screen";
import UsageScreen from "./usage-screen";
import DocumentsScreen from "./documents-screen";
import DeliveryScreen from "./delivery-screen";
import BillingScreen from "./billing-screen";
import GovernanceScreen from "./governance-screen";
import CatalogueScreen from "./catalogue-screen";
import EngagementScreen from "./engagement-screen";
import AiAssistanceScreen from "./ai-assistance-screen";
import type { DocumentPage, DocumentTemplate } from "../db/document-store";
import type { ProposalType, ServiceCategory } from "../db/catalogue-store";
import { resolveProposalText, type ProposalMetadata } from "../lib/proposal-metadata";
import { GovernanceCheck, WorkflowSteps, type WorkflowStep } from "./ui/system";
import { QuoteBenchMark } from "./ui/brand";
import WorkspaceErrorBoundary from "./workspace-error-boundary";

const ProposalEditor = lazy(() => import("./proposal-editor"));
const TemplatesScreen = lazy(() => import("./templates-screen"));

const CURRENT_DAY = new Date().toISOString().slice(0, 10);

export type Screen = "builder" | "quotes" | "clients" | "catalogue" | "rules" | "activity" | "integrations" | "team" | "usage" | "documents" | "delivery" | "templates" | "billing" | "governance" | "engagement" | "ai";
type Workspace = { id:string; name:string; currency:string; role:"owner"|"admin"|"quoter" };
type SelectedLine = { itemId: string; quantity: number; discount: number };
type ClientRecord = {
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
type SavedQuote = {
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
type EditableQuote = SavedQuote & {
  lines: SelectedLine[];
  answers: { values?: Record<string, string>; complexity?: string; turnaround?: string; quoteDiscount?: number; regionCode?:string; asOfDate?:string };
  document: { title: string; introduction: string; scopeHeading: string; brandName?: string; brandInitials?: string; proposalTypeId?:string; templateId?:string; depositMinor?: number; options?: Array<{ id: string; label: string }>; pages?:DocumentPage[] };
  revisionOf: string | null;
};
type SavedEvent = {
  id: string;
  quoteReference: string;
  actorEmail: string;
  eventType: "quote.saved" | "quote.ready" | "quote.issued" | "quote.viewed" | "quote.accepted" | "quote.declined" | "quote.expired" | "quote.superseded";
  payload: Record<string, unknown>;
  createdAt: string;
};
type Entitlement = { planName: string; monthlyQuoteLimit: number; quotesUsedThisMonth: number; active: boolean };
type QuoteFile = { id: string; filename: string; contentType: string; sizeBytes: number; kind: string };
export type BuilderStep = "client" | "services" | "proposal" | "governance" | "review";
type HorizonIconName = "builder" | "quotes" | "clients" | "services" | "rules" | "documents" | "templates" | "engagement" | "ai" | "activity" | "delivery" | "integrations" | "team" | "usage" | "billing" | "governance" | "admin" | "search" | "notification";

const screenTitles: Record<Screen, string> = {
  builder: "Quote builder", quotes: "Quotes", clients: "Clients", catalogue: "Services", rules: "Pricing rules",
    documents: "Brand and delivery", templates: "Templates", engagement: "Engagement governance", ai: "AI assistance",
  activity: "Activity", delivery: "Send and track", integrations: "Imports and integrations", team: "Team and roles",
  usage: "Usage and limits", billing: "Plans and billing", governance: "Privacy and security",
};

function HorizonIcon({ name }: { name: HorizonIconName }) {
  const common = { width: 19, height: 19, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  const paths: Record<HorizonIconName, React.ReactNode> = {
    builder: <><path d="M7 3h8l4 4v14H7z"/><path d="M15 3v5h5M10 13h6M13 10v6"/></>,
    quotes: <><path d="M5 4h14v16H5z"/><path d="M8 8h8M8 12h8M8 16h5"/></>,
    clients: <><circle cx="9" cy="8" r="3"/><path d="M3.5 20c.4-4 2.2-6 5.5-6s5.1 2 5.5 6M16 6.5a2.5 2.5 0 0 1 0 5M16.5 14c2.4.4 3.7 2.2 4 5"/></>,
    services: <><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></>,
    rules: <><path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="2"/><circle cx="15" cy="17" r="2"/></>,
    documents: <><path d="M6 3h9l4 4v14H6z"/><path d="M15 3v5h5M9 12h7M9 16h7"/></>,
    templates: <><path d="m12 3 8 4-8 4-8-4z"/><path d="m4 12 8 4 8-4M4 17l8 4 8-4"/></>,
    engagement: <><path d="M12 3 20 6v5c0 5-3.4 8.5-8 10-4.6-1.5-8-5-8-10V6z"/><path d="m9 12 2 2 4-5"/></>,
    ai: <><path d="m12 3 1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z"/><path d="m18.5 15 .8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/></>,
    activity: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></>,
    delivery: <><path d="m3 11 18-8-7 18-3-7z"/><path d="m11 14 4-4"/></>,
    integrations: <><path d="M8 7h9a4 4 0 0 1 0 8h-2M16 17H7a4 4 0 0 1 0-8h2"/><path d="m6 5 2 2-2 2M18 13l-2 2 2 2"/></>,
    team: <><circle cx="8" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M2.5 20c.4-4 2.2-6 5.5-6s5.1 2 5.5 6M14 15c3.8-.3 6.1 1.4 6.5 5"/></>,
    usage: <><path d="M5 19a9 9 0 1 1 14 0"/><path d="m12 12 4-4M8 19h8"/></>,
    billing: <><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 10h18M7 15h4"/></>,
    governance: <><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/></>,
    admin: <><circle cx="12" cy="12" r="3"/><path d="M19 13.5v-3l-2-.6-.7-1.7 1-1.9-2.1-2.1-1.9 1-1.7-.7L11 2H8l-.6 2.5-1.7.7-1.9-1-2.1 2.1 1 1.9L2 9.9v3l2.5.6.7 1.7-1 1.9 2.1 2.1 1.9-1 1.7.7.6 2.1h3l.6-2.1 1.7-.7 1.9 1 2.1-2.1-1-1.9z"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/></>,
    notification: <><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></>,
  };
  return <svg {...common}>{paths[name]}</svg>;
}

const labels: Record<Frequency, string> = {
  one_off: "One-off",
  weekly: "Weekly",
  fortnightly: "Fortnightly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  annually: "Annually",
};
const seedCatalogueCategories:ServiceCategory[]=[{id:"advisory",name:"Advisory",parentId:null,sortOrder:10,active:true},{id:"delivery",name:"Delivery",parentId:null,sortOrder:20,active:true},{id:"technology",name:"Technology",parentId:null,sortOrder:30,active:true},{id:"strategy",name:"Strategy",parentId:"advisory",sortOrder:10,active:true},{id:"retained-advice",name:"Retained advice",parentId:"advisory",sortOrder:20,active:true},{id:"implementation",name:"Implementation",parentId:"delivery",sortOrder:10,active:true},{id:"platforms",name:"Platforms and licences",parentId:"technology",sortOrder:10,active:true}];
const seedProposalTypes:ProposalType[]=[{id:"full-service",name:"Full service",description:"A comprehensive proposal spanning advice, delivery and supporting technology.",active:true},{id:"advisory",name:"Advisory engagement",description:"Advice, workshops and retained expertise.",active:true},{id:"implementation",name:"Implementation programme",description:"Delivery-led mobilisation and execution.",active:true},{id:"managed-service",name:"Managed service",description:"Recurring service and platform commitments.",active:true}];

function formatMoney(value: number, currency = "GBP") {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    minimumFractionDigits: value % 100 === 0 ? 0 : 2,
  }).format(value / 100);
}

function cloneTemplatePages(template: DocumentTemplate) {
  return template.pages.map((page) => ({
    ...page,
    id: crypto.randomUUID(),
    blocks: page.blocks.map((block) => ({
      ...block,
      id: crypto.randomUUID(),
      items: block.items?.map((item) => ({ ...item, id: crypto.randomUUID() })),
    })),
  }));
}

function Status({ children }: { children: string }) {
  return <span className={`status status-${children.toLowerCase()}`}>{children}</span>;
}

function Sidebar({ screen, setScreen, currentUser, entitlement, mobileOpen, onClose, operatorAccess }: { screen: Screen; setScreen: (screen: Screen) => void; currentUser: QuoteBenchUser | null; entitlement: Entitlement | null; mobileOpen: boolean; onClose: () => void; operatorAccess: boolean }) {
  const groups: Array<{ id: string; label: string; items: Array<{ key: Screen; label: string; icon: HorizonIconName }> }> = [
    { id: "commercial", label: "Commercial", items: [{ key: "builder", label: "Quote builder", icon: "builder" }, { key: "quotes", label: "Quotes", icon: "quotes" }, { key: "clients", label: "Clients", icon: "clients" }, { key: "catalogue", label: "Services", icon: "services" }, { key: "rules", label: "Pricing rules", icon: "rules" }] },
    { id: "content", label: "Content and governance", items: [{ key: "templates", label: "Templates", icon: "templates" }, { key: "documents", label: "Brand and delivery", icon: "documents" }, { key: "engagement", label: "Engagement governance", icon: "engagement" }, { key: "ai", label: "AI assistance", icon: "ai" }] },
    { id: "operations", label: "Operations", items: [{ key: "activity", label: "Activity", icon: "activity" }, { key: "delivery", label: "Send and track", icon: "delivery" }] },
    { id: "administration", label: "Administration", items: [{ key: "integrations", label: "Imports and integrations", icon: "integrations" }, { key: "team", label: "Team and roles", icon: "team" }, { key: "usage", label: "Usage and limits", icon: "usage" }, { key: "billing", label: "Plans and billing", icon: "billing" }, { key: "governance", label: "Privacy and security", icon: "governance" }] },
  ];
  const activeGroup = groups.find((group) => group.items.some((item) => item.key === screen))?.id ?? "commercial";
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({ commercial: true, [activeGroup]: true });
  function navigate(next: Screen) { setScreen(next); onClose(); }
  return (
    <aside className={`sidebar ${mobileOpen ? "mobile-open" : ""}`}>
      <div className="sidebar-brand-row"><button className="brand" onClick={() => navigate("builder")} aria-label="QuoteBench home">
        <QuoteBenchMark />
        <span><strong>QuoteBench</strong><small>Commercial workspace</small></span>
      </button><button className="nav-close" onClick={onClose} aria-label="Close navigation">×</button></div>
      <nav className="nav" aria-label="Primary navigation">
        {groups.map((group) => { const open = Boolean(openGroups[group.id]) || group.id === activeGroup; return <section className="nav-group" key={group.id}><button className="nav-group-trigger" aria-expanded={open} onClick={() => setOpenGroups((current) => ({ ...current, [group.id]: !open }))}><span>{group.label}</span><b aria-hidden="true">{open ? "−" : "+"}</b></button>{open && <div>{group.items.map((item) => <button key={item.key} onClick={() => navigate(item.key)} className={screen === item.key ? "nav-item active" : "nav-item"}><span className="nav-icon"><HorizonIcon name={item.icon}/></span><span>{item.label}</span></button>)}</div>}</section>; })}
      </nav>
      {operatorAccess && <a className="platform-admin-link" href="/admin"><span className="nav-icon"><HorizonIcon name="admin"/></span><span><strong>Platform administration</strong><small>Customers, billing and controls</small></span><b>↗</b></a>}
      <div className="sidebar-foot">
        <div className="usage-bar"><span style={{ width: `${Math.min(100, ((entitlement?.quotesUsedThisMonth ?? 0) / (entitlement?.monthlyQuoteLimit ?? 50)) * 100)}%` }} /></div>
        <p><strong>{entitlement?.quotesUsedThisMonth ?? 0}</strong> of {entitlement?.monthlyQuoteLimit ?? 50} quotes this month</p>
        {currentUser ? (
          <a className="workspace-person" href="/auth/sign-out?return_to=%2F">
            <span className="avatar">{currentUser.displayName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</span>
            <span><strong>{currentUser.displayName}</strong><small>Owner · sign out</small></span>
            <span aria-hidden="true">⋯</span>
          </a>
        ) : (
          <a className="workspace-person" href="/auth/sign-in?return_to=%2F">
            <span className="avatar">?</span>
            <span><strong>Sign in to save</strong><small>Secure account required</small></span>
            <span aria-hidden="true">›</span>
          </a>
        )}
      </div>
    </aside>
  );
}

function Topbar({ screen, workspace, workspaces, onOpenNavigation }: { screen:Screen; workspace:Workspace|null; workspaces:Workspace[]; onOpenNavigation:()=>void }) {
  async function selectWorkspace(id:string){await fetch("/api/workspaces",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"select",tenantId:id})});window.location.reload();}
  return (
    <header className="topbar">
      <div className="topbar-start"><button className="mobile-menu" onClick={onOpenNavigation} aria-label="Open navigation"><span/><span/><span/></button><div className="topbar-context"><span>Workspace</span><strong>{screenTitles[screen]}</strong></div><label className="workspace-switcher"><span className="workspace-dot">{workspace?.name?.charAt(0).toUpperCase()??"Q"}</span><select aria-label="Current workspace" value={workspace?.id??""} onChange={event=>void selectWorkspace(event.target.value)}>{workspaces.length?workspaces.map(item=><option value={item.id} key={item.id}>{item.name}</option>):<option value="">QuoteBench workspace</option>}</select></label></div>
      <div className="top-actions">
        <button className="top-icon" aria-label="Search"><HorizonIcon name="search"/></button>
        <button className="top-icon notification" aria-label="Notifications"><HorizonIcon name="notification"/></button>
        <button className="help-link">Help</button>
      </div>
    </header>
  );
}

function QuoteBuilder({ reference, initialQuote, clients, catalogueItems, catalogueCategories, proposalTypes, ruleSet, onSaved, onRevised, initialStep = "client" }: { reference: string; initialQuote: EditableQuote | null; clients: ClientRecord[]; catalogueItems: CatalogueItem[]; catalogueCategories:ServiceCategory[]; proposalTypes:ProposalType[]; ruleSet: RuleSet; onSaved: () => void; onRevised: (quote: EditableQuote) => void; initialStep?: BuilderStep }) {
  const [clientId, setClientId] = useState(initialQuote?.clientId ?? "");
  const [clientName, setClientName] = useState(initialQuote?.clientName ?? "Stellar Grid Ltd");
  const [contactName, setContactName] = useState(initialQuote?.contactName ?? "Maya Patel");
  const [contactEmail, setContactEmail] = useState(initialQuote?.contactEmail ?? "maya.patel@stellargrid.example");
  const [validUntil, setValidUntil] = useState(initialQuote?.validUntil ?? "2026-09-14");
  const [quoteCurrency,setQuoteCurrency]=useState(initialQuote?.currency??"GBP");
  const [regionCode,setRegionCode]=useState(initialQuote?.answers.regionCode??"GLOBAL");
  const [asOfDate,setAsOfDate]=useState(initialQuote?.answers.asOfDate??new Date().toISOString().slice(0,10));
  const [proposalTitle, setProposalTitle] = useState(initialQuote?.document.title ?? "Transformation delivery partnership");
  const [proposalIntroduction] = useState(initialQuote?.document.introduction ?? "This proposal combines focused strategy, delivery capacity and an ongoing advisory relationship. Every commercial value is derived from the published QuoteBench rule set and recorded with its calculation trace.");
  const [scopeHeading] = useState(initialQuote?.document.scopeHeading ?? "A practical route to measurable change");
  const [brandName, setBrandName] = useState(initialQuote?.document.brandName ?? "Finance Advisory Partners");
  const [brandInitials, setBrandInitials] = useState(initialQuote?.document.brandInitials ?? "FAP");
  const [proposalTypeId,setProposalTypeId]=useState(initialQuote?.document.proposalTypeId??proposalTypes.find(type=>type.active)?.id??"");
  const [selectedTemplateId,setSelectedTemplateId]=useState(initialQuote?.document.templateId??"");
  const [deposit, setDeposit] = useState(String((initialQuote?.document.depositMinor ?? 0) / 100));
  const [proposalOptions, setProposalOptions] = useState<Array<{ id: string; label: string }>>(initialQuote?.document.options ?? []);
  const [proposalPages,setProposalPages]=useState<DocumentPage[]>(initialQuote?.document.pages??[{id:crypto.randomUUID(),title:"Overview and investment",format:"standard",background:"plain",blocks:[{id:crypto.randomUUID(),type:"text",eyebrow:"Overview",title:"Our proposal",content:initialQuote?.document.introduction??"Describe the client context, desired outcomes and the value of the proposed approach.",enabled:true},{id:crypto.randomUUID(),type:"feature_grid",title:"What is included",layout:"cards",columns:3,enabled:true,items:[{id:crypto.randomUUID(),title:"Outcome",content:"Describe a measurable outcome."},{id:crypto.randomUUID(),title:"Approach",content:"Explain how the work will be delivered."},{id:crypto.randomUUID(),title:"Confidence",content:"Add proof, governance or assurance."}]},{id:crypto.randomUUID(),type:"pricing_table",title:"Scope and investment",display:"full",locked:true,enabled:true},{id:crypto.randomUUID(),type:"terms",title:"Commercial terms",content:"This proposal is valid until the stated expiry date. Fees exclude VAT unless specified.",locked:true,enabled:true},{id:crypto.randomUUID(),type:"signature",title:"Acceptance",content:"The recipient can formally accept or decline this proposal.",locked:true,enabled:true}]}]);
  const [lines, setLines] = useState<SelectedLine[]>(()=>initialQuote?initialQuote.lines:catalogueItems.filter(item=>item.defaultProposalTypeIds?.includes(proposalTypes.find(type=>type.active)?.id??"")).map(item=>({itemId:item.id,quantity:item.minQuantity??1,discount:0})));
  const [answers, setAnswers] = useState<Record<string, string>>(() => initialQuote?.answers.values ?? {
    complexity: initialQuote?.answers.complexity ?? "standard",
    turnaround: initialQuote?.answers.turnaround ?? "standard",
  });
  const [quoteDiscount, setQuoteDiscount] = useState(initialQuote?.answers.quoteDiscount ?? 0);
  const [pickerOpen, setPickerOpen] = useState(true);
  const [builderStep, setBuilderStep] = useState<BuilderStep>(initialStep);
  const [openServiceCategories, setOpenServiceCategories] = useState<Record<string, boolean>>({});
  const [openServiceSubgroups, setOpenServiceSubgroups] = useState<Record<string, boolean>>({});
  const [explainLine, setExplainLine] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState<"Draft" | "Ready" | null>(null);
  const [lifecycleStatus, setLifecycleStatus] = useState<SavedQuote["status"]>(initialQuote?.status ?? "Draft");
  const [sharePath, setSharePath] = useState<string | null>(initialQuote?.shareToken ? `/q/${initialQuote.shareToken}` : null);
  const [revising, setRevising] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [quoteFiles, setQuoteFiles] = useState<QuoteFile[]>([]);
  const [proposalTemplates,setProposalTemplates]=useState<DocumentTemplate[]>([]);
  const [pdfState, setPdfState] = useState<string | null>(null);
  const [priced, setPriced] = useState<PricedQuote | null>(null);
  const [pricingErrors, setPricingErrors] = useState<string[]>([]);
  const [hasSaved, setHasSaved] = useState(Boolean(initialQuote));
  const [autosaveState, setAutosaveState] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const locked = !["Draft", "Ready"].includes(lifecycleStatus);
  const proposalMetadata = useMemo<ProposalMetadata>(() => ({
    clientName,
    contactName,
    contactEmail,
    quoteReference: reference,
    proposalTitle,
    validUntil: validUntil ? new Date(`${validUntil}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "",
    currency: quoteCurrency,
    brandName,
  }), [brandName, clientName, contactEmail, contactName, proposalTitle, quoteCurrency, reference, validUntil]);

  useEffect(() => {
    if (preview) window.scrollTo({ top: 0, behavior: "auto" });
  }, [preview]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [builderStep]);

  useEffect(() => {
    fetch(hasSaved?`/api/documents?reference=${encodeURIComponent(reference)}`:"/api/documents", { cache: "no-store" }).then(async (response) => (await response.json()) as { files?: QuoteFile[];templates?:DocumentTemplate[] }).then((payload) => {
      const templates = payload.templates ?? [];
      setQuoteFiles(payload.files ?? []);
      setProposalTemplates(templates);
      if (!initialQuote) setSelectedTemplateId((current) => {
        if (current) return current;
        const standard = templates.find((template) => template.isDefault) ?? templates[0];
        if (!standard) return current;
        setProposalPages(cloneTemplatePages(standard));
        return standard.id;
      });
    }).catch(() => undefined);
  }, [hasSaved, initialQuote, reference]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      fetch("/api/pricing", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ answers, quoteDiscount, lines, currency:quoteCurrency, regionCode, asOfDate }),
        signal: controller.signal,
      })
        .then(async (response) => {
          const payload = (await response.json()) as { ok?: boolean; quote?: PricedQuote; errors?: Array<{ code: string }>; error?: string };
          if (!response.ok) throw new Error(payload.error ?? "Pricing is temporarily unavailable.");
          if (payload.ok && payload.quote) {
            setPriced(payload.quote);
            setPricingErrors([]);
          } else {
            setPriced(null);
            setPricingErrors(payload.errors?.map((error) => error.code) ?? ["pricing.unavailable"]);
          }
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          setPriced(null);
          setPricingErrors([error instanceof Error ? error.message : "pricing.unavailable"]);
        });
    }, 80);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [answers, asOfDate, catalogueItems, lines, quoteCurrency, quoteDiscount, regionCode, ruleSet.version]);

  useEffect(() => {
    if (!hasSaved || locked || !clientName.trim() || !contactName.trim() || !contactEmail.trim() || !validUntil) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setAutosaveState("saving");
      fetch("/api/quotes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reference, clientId, clientName, contactName, contactEmail, validUntil, status: lifecycleStatus === "Ready" ? "Ready" : "Draft", answers, quoteDiscount, lines, currency:quoteCurrency,regionCode,asOfDate, document: { title: proposalTitle, introduction: proposalIntroduction, scopeHeading, brandName, brandInitials, proposalTypeId, templateId:selectedTemplateId || undefined, depositMinor: Math.max(0, Math.round(Number(deposit || 0) * 100)), options: proposalOptions.filter((option) => option.label.trim()), pages:proposalPages } }),
        signal: controller.signal,
      })
        .then((response) => {
          if (!response.ok) throw new Error("Autosave failed");
          setAutosaveState("saved");
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          setAutosaveState("failed");
        });
    }, 900);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [answers, asOfDate, brandInitials, brandName, clientId, clientName, contactEmail, contactName, deposit, hasSaved, lifecycleStatus, lines, locked, proposalIntroduction, proposalOptions, proposalPages, proposalTitle, proposalTypeId, quoteCurrency, quoteDiscount, reference, regionCode, scopeHeading, selectedTemplateId, validUntil]);

  function updateQuantity(itemId: string, value: number) {
    setLines((current) => current.map((line) => line.itemId === itemId ? { ...line, quantity: value } : line));
  }

  function toggleItem(itemId: string) {
    setLines((current) => {
      if(current.some(line=>line.itemId===itemId))return current.filter(line=>line.itemId!==itemId);
      const item=catalogueItems.find(candidate=>candidate.id===itemId);if(!item)return current;
      const additions=[itemId,...(item.requiredItemIds??[]),...(item.bundleItemIds??[])].filter(id=>!current.some(line=>line.itemId===id));
      return [...current,...additions.flatMap(id=>{const component=catalogueItems.find(candidate=>candidate.id===id);return component?[{itemId:id,quantity:component.minQuantity??1,discount:0}]:[]})];
    });
  }

  function selectProposalType(nextTypeId:string){
    setProposalTypeId(nextTypeId);
    setLines(current=>{
      const eligible=catalogueItems.filter(item=>!item.proposalTypeIds?.length||item.proposalTypeIds.includes(nextTypeId));
      const retained=current.filter(line=>eligible.some(item=>item.id===line.itemId));
      const retainedIds=new Set(retained.map(line=>line.itemId));
      const defaults=eligible.filter(item=>item.defaultProposalTypeIds?.includes(nextTypeId)&&!retainedIds.has(item.id)).map(item=>({itemId:item.id,quantity:item.minQuantity??1,discount:0}));
      return [...retained,...defaults];
    });
  }

  function selectProposalTemplate(templateId: string) {
    const template = proposalTemplates.find((item) => item.id === templateId);
    setSelectedTemplateId(templateId);
    if (!template) return;
    setProposalPages(cloneTemplatePages(template));
    setNotice(`${template.name} applied. This quote now has its own editable copy.`);
  }

  const eligibleCatalogue=catalogueItems.filter(item=>!proposalTypeId||!item.proposalTypeIds?.length||item.proposalTypeIds.includes(proposalTypeId));
  const categoryLabel=(id?:string)=>catalogueCategories.find(category=>category.id===id)?.name??id??"Other";
  const serviceGroups=[...new Set(eligibleCatalogue.map(item=>item.categoryId))].map(categoryId=>({categoryId,subgroups:[...new Set(eligibleCatalogue.filter(item=>item.categoryId===categoryId).map(item=>item.subcategoryId??""))].map(subcategoryId=>({subcategoryId,items:eligibleCatalogue.filter(item=>item.categoryId===categoryId&&(item.subcategoryId??"")===subcategoryId)}))}));
  const enabledProposalBlocks = proposalPages.flatMap((page) => page.blocks).filter((block) => block.enabled !== false);
  const requiredProposalBlocks = ["pricing_table", "terms", "signature"] as const;
  const requiredQuestionsComplete = (ruleSet.questions ?? []).filter((question) => question.required).every((question) => Boolean(answers[question.id]));
  const reviewReadiness = [
    { id:"recipient", label:"Recipient and validity", detail:"Named client, contact, email and a current validity date", complete:Boolean(clientName.trim() && contactName.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail.trim()) && validUntil >= CURRENT_DAY), step:"client" as const },
    { id:"pricing", label:"Commercial calculation", detail:"At least one priced service with no engine errors", complete:Boolean(priced && lines.length > 0 && pricingErrors.length === 0 && requiredQuestionsComplete), step:"services" as const },
    { id:"proposal", label:"Proposal content", detail:"A titled page set containing pricing, terms and acceptance controls", complete:Boolean(proposalTitle.trim() && proposalPages.length > 0 && requiredProposalBlocks.every((type) => enabledProposalBlocks.some((block) => block.type === type))), step:"proposal" as const },
    { id:"identity", label:"Brand and document identity", detail:"A client-facing brand and traceable quote-specific page set", complete:Boolean(brandName.trim() && brandInitials.trim() && proposalPages.length), step:"proposal" as const },
    { id:"governance", label:"Terms and acceptance", detail:"Terms, pricing and signature controls are present in the governed page set", complete:Boolean(requiredProposalBlocks.every((type) => enabledProposalBlocks.some((block) => block.type === type))), step:"governance" as const },
  ];
  const completedReadiness = reviewReadiness.filter((item) => item.complete).length;
  const readyToSubmit = reviewReadiness.every((item) => item.complete);
  const pdfBusy = pdfState === "Queueing PDF…" || pdfState === "Generating PDF…";
  const workflowSteps: WorkflowStep<BuilderStep>[] = [
    { id:"client", label:"Client", description:"Recipient and validity", complete:reviewReadiness[0].complete },
    { id:"services", label:"Scope", description:"Services and pricing", complete:reviewReadiness[1].complete },
    { id:"proposal", label:"Proposal", description:"Template and pages", complete:reviewReadiness[2].complete && reviewReadiness[3].complete },
    { id:"governance", label:"Governance", description:"Terms and acceptance", complete:reviewReadiness[4].complete },
    { id:"review", label:"Review", description:"Validate and issue", complete:lifecycleStatus !== "Draft" },
  ];

  async function saveQuote(status: "Draft" | "Ready") {
    setSaving(status);
    setNotice(null);
    try {
      const response = await fetch("/api/quotes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          reference,
          clientId,
          clientName,
          contactName,
          contactEmail,
          validUntil,
          status,
          answers,
          quoteDiscount,
          lines,
          currency:quoteCurrency,
          regionCode,
          asOfDate,
          document: { title: proposalTitle, introduction: proposalIntroduction, scopeHeading, brandName, brandInitials, proposalTypeId, templateId:selectedTemplateId || undefined, depositMinor: Math.max(0, Math.round(Number(deposit || 0) * 100)), options: proposalOptions.filter((option) => option.label.trim()), pages:proposalPages },
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "The quote could not be saved.");
      setLifecycleStatus(status);
      setHasSaved(true);
      setAutosaveState("saved");
      setNotice(status === "Ready" ? "Quote repriced on the server and marked ready" : "Draft repriced and saved securely");
      onSaved();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The quote could not be saved.");
    } finally {
      setSaving(null);
    }
  }

  async function issueCurrentQuote() {
    if (issuing || lifecycleStatus !== "Ready") return;
    setIssuing(true);
    setNotice(null);
    try {
      const response = await fetch(`/api/quotes/${encodeURIComponent(reference)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "issue" }),
      });
      const payload = (await response.json()) as { error?: string; path?: string };
      if (!response.ok || !payload.path) throw new Error(payload.error ?? "The quote could not be issued.");
      setLifecycleStatus("Issued");
      setSharePath(payload.path);
      setNotice("Secure recipient link issued and recorded in the audit trail");
      onSaved();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The quote could not be issued.");
    } finally {
      setIssuing(false);
    }
  }

  async function copyRecipientLink() {
    if (!sharePath) return;
    try {
      await navigator.clipboard.writeText(new URL(sharePath, window.location.origin).toString());
      setNotice("Secure recipient link copied to the clipboard.");
    } catch {
      setNotice("The recipient link could not be copied. Open it and copy the address from the browser.");
    }
  }

  async function createRevision() {
    setRevising(true);
    setNotice(null);
    try {
      const response = await fetch(`/api/quotes/${encodeURIComponent(reference)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "revise" }),
      });
      const payload = (await response.json()) as { error?: string; quote?: EditableQuote };
      if (!response.ok || !payload.quote) throw new Error(payload.error ?? "The revision could not be created.");
      onRevised(payload.quote);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The revision could not be created.");
    } finally {
      setRevising(false);
    }
  }

  async function duplicateCurrentQuote() {
    setDuplicating(true);
    setNotice(null);
    try {
      const response = await fetch(`/api/quotes/${encodeURIComponent(reference)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "duplicate" }),
      });
      const payload = (await response.json()) as { error?: string; quote?: EditableQuote };
      if (!response.ok || !payload.quote) throw new Error(payload.error ?? "The duplicate could not be created.");
      onRevised(payload.quote);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The duplicate could not be created.");
    } finally {
      setDuplicating(false);
    }
  }

  async function acceptOffline() {
    const acceptedBy = window.prompt("Full name of the person who accepted offline");
    if (!acceptedBy?.trim()) return;
    const response = await fetch(`/api/quotes/${encodeURIComponent(reference)}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "accept_offline", acceptedBy }) });
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) { setNotice(payload.error ?? "Offline acceptance could not be recorded."); return; }
    setLifecycleStatus("Accepted"); setNotice(`Offline acceptance recorded for ${acceptedBy.trim()}.`); onSaved();
  }

  async function uploadAttachment(file?: File) {
    if (!file || !hasSaved || uploading) return;
    setUploading(true);
    try {
      const form = new FormData(); form.set("file", file); form.set("kind", "attachment"); form.set("reference", reference);
      const response = await fetch("/api/uploads", { method: "POST", body: form });
      const payload = (await response.json()) as { file?: QuoteFile; error?: string };
      if (!response.ok || !payload.file) throw new Error(payload.error ?? "The attachment could not be uploaded.");
      setQuoteFiles((current) => [...current, payload.file!]); setNotice(`${payload.file.filename} attached to ${reference}.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The attachment could not be uploaded.");
    } finally {
      setUploading(false);
    }
  }

  async function uploadProposalImage(file:File){if(!hasSaved){setNotice("Save the draft before adding proposal images.");return null;}const form=new FormData();form.set("file",file);form.set("kind","image");form.set("reference",reference);const response=await fetch("/api/uploads",{method:"POST",body:form});const payload=await response.json()as{file?:QuoteFile;error?:string};if(!response.ok||!payload.file){setNotice(payload.error??"The image could not be uploaded.");return null;}setQuoteFiles(current=>[...current,payload.file!]);return payload.file.id;}

  async function requestPdf() {
    if (!hasSaved || pdfState === "Queueing PDF…" || pdfState === "Generating PDF…") return;
    setPdfState("Queueing PDF…");
    const response = await fetch("/api/pdfs", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reference }) });
    const payload = (await response.json()) as { job?: { id: string }; error?: string };
    if (!response.ok || !payload.job) { setPdfState(payload.error ?? "PDF generation failed."); return; }
    setPdfState("Generating PDF…");
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, attempt === 0 ? 500 : 1500));
      const statusResponse = await fetch(`/api/pdfs?id=${encodeURIComponent(payload.job.id)}`, { cache: "no-store" });
      const status = (await statusResponse.json()) as { job?: { status?: string }; downloadPath?: string | null; error?: string };
      if (status.downloadPath) { setPdfState(`PDF ready|${status.downloadPath}`); return; }
      if (!statusResponse.ok || status.job?.status === "Failed") { setPdfState(status.error ?? "PDF generation failed."); return; }
    }
    setPdfState("PDF generation is taking longer than expected. It remains queued and can be checked again.");
  }

  if (preview && priced) {
    return <QuotePreview quote={priced} clientName={clientName} contactName={contactName} contactEmail={contactEmail} reference={reference} title={proposalTitle} introduction={proposalIntroduction} scopeHeading={scopeHeading} brandName={brandName} brandInitials={brandInitials} validUntil={validUntil} pages={proposalPages} options={proposalOptions} onBack={() => setPreview(false)} />;
  }

  return (
    <div className="builder-page">
      <div className="page-heading builder-heading">
        <div>
          <p className="eyebrow">Quotes / {reference}</p>
          <div className="title-row"><h1>Build quote</h1><Status>{lifecycleStatus}</Status>{hasSaved && <span className={`autosave-state autosave-${autosaveState}`}>{autosaveState === "saving" ? "Saving changes…" : autosaveState === "failed" ? "Autosave failed" : "All changes saved"}</span>}</div>
        </div>
        <div className="heading-actions">
          <button className="button secondary" onClick={() => saveQuote("Draft")} disabled={saving !== null || !["Draft", "Ready"].includes(lifecycleStatus)}>{saving === "Draft" ? "Saving…" : "Save draft"}</button>
          <button className="button primary" onClick={() => setBuilderStep("governance")}>Review and issue</button>
          {hasSaved && <button className="button secondary" onClick={duplicateCurrentQuote} disabled={duplicating}>{duplicating ? "Duplicating…" : "Duplicate as draft"}</button>}
          {locked && lifecycleStatus !== "Accepted" && <button className="button primary" onClick={createRevision} disabled={revising}>{revising ? "Creating…" : "Create revision"}</button>}
        </div>
      </div>

      {notice && <div className="notice" role="status"><span>✓</span>{notice}<button onClick={() => setNotice(null)}>×</button></div>}
      {locked && <div className="locked-panel"><strong>Commercial snapshot locked</strong><span>{lifecycleStatus === "Accepted" ? "This accepted version and its evidence are permanently immutable." : "This issued version is immutable. Create a revision to change scope, pricing or proposal content."}</span>{initialQuote?.revisionOf && <small>Revision of {initialQuote.revisionOf}</small>}</div>}
      {sharePath && <div className="share-panel"><div><strong>Recipient link</strong><p>This tokenised link provides the governed client document and formal acceptance control.</p></div><code>{sharePath}</code><a className="button secondary" href={sharePath} target="_blank" rel="noreferrer">Open quote</a></div>}

      <WorkflowSteps steps={workflowSteps} current={builderStep} onChange={setBuilderStep}/>

      {builderStep === "client" || builderStep === "services" ? (
      <div className="builder-grid">
        <div className="builder-workspace">
          {builderStep === "client" && <>
          <section className="section-block client-block">
            <div className="section-number">01</div>
            <div className="section-content">
              <div className="section-title-row">
                <div><h2>Client and validity</h2><p>Identify the recipient and the commercial window.</p></div>
                <span className="complete-mark">Complete</span>
              </div>
              <div className="field-grid">
                <label><span>Saved client</span><select value={clientId} onChange={(event) => { const nextId = event.target.value; setClientId(nextId); const client = clients.find((entry) => entry.id === nextId); if (client) { setClientName(client.name); setContactName(client.contactName); setContactEmail(client.contactEmail); } }}><option value="">Create from quote</option>{clients.filter((client) => client.status === "Active").map((client) => <option key={client.id} value={client.id}>{client.name} · {client.contactName}</option>)}</select></label>
                <label><span>Client</span><input value={clientName} onChange={(event) => { setClientName(event.target.value); setClientId(""); }} /></label>
                <label><span>Contact</span><input value={contactName} onChange={(event) => setContactName(event.target.value)} /></label>
                <label><span>Contact email</span><input type="email" value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} /></label>
                <label><span>Valid until</span><input type="date" value={validUntil} onChange={(event) => setValidUntil(event.target.value)} /></label>
                <label><span>Quote currency</span><select value={quoteCurrency} onChange={event=>setQuoteCurrency(event.target.value)}><option>GBP</option><option>EUR</option><option>USD</option><option>AUD</option><option>CAD</option></select></label>
                <label><span>Commercial region</span><input value={regionCode} maxLength={12} onChange={event=>setRegionCode(event.target.value.toUpperCase())} placeholder="GLOBAL or UK"/></label>
                <label><span>Pricing date</span><input type="date" value={asOfDate} onChange={event=>setAsOfDate(event.target.value)}/></label>
              </div>
            </div>
          </section>

          <footer className="commercial-step-footer">
            <div><strong>Recipient details complete</strong><p>Continue to configure the service scope and pricing context.</p></div>
            <button className="button primary" onClick={() => setBuilderStep("services")}>Continue to services →</button>
          </footer>
          </>}

          {builderStep === "services" && <>
          <section className="section-block">
            <div className="section-number">02</div>
            <div className="section-content">
              <div className="section-title-row">
                <div><h2>Services and products</h2><p>Choose the proposal type, then toggle each eligible service on or off for this quote.</p></div>
                <button className="text-button" onClick={() => setPickerOpen((open) => !open)}>{pickerOpen?"Hide service selector":"Manage services"}</button>
              </div>

              <div className="proposal-type-selector"><label><span>Proposal type</span><select value={proposalTypeId} disabled={locked} onChange={event=>selectProposalType(event.target.value)}>{proposalTypes.filter(type=>type.active).map(type=><option key={type.id} value={type.id}>{type.name}</option>)}</select></label><p>{proposalTypes.find(type=>type.id===proposalTypeId)?.description??"Services without a proposal-type restriction remain available in every quote."}</p><strong>{lines.length} selected</strong></div>

              {pickerOpen && (
                <div className="service-toggle-picker">
                  <div className="service-toggle-heading"><div><strong>Services available for this proposal type</strong><p>Default services are preselected but every service remains under quote-level control.</p></div><button aria-label="Close service selector" onClick={() => setPickerOpen(false)}>×</button></div>
                  {serviceGroups.map((group, groupIndex) => {
                    const categoryOpen = openServiceCategories[group.categoryId] ?? groupIndex === 0;
                    const categoryItemIds = group.subgroups.flatMap((subgroup) => subgroup.items.map((item) => item.id));
                    const categorySelected = lines.filter((line) => categoryItemIds.includes(line.itemId)).length;
                    const categoryPanelId = `service-category-${group.categoryId}`;
                    return <section className="service-category-accordion" key={group.categoryId}>
                      <button className="service-accordion-trigger" aria-expanded={categoryOpen} aria-controls={categoryPanelId} onClick={() => setOpenServiceCategories(() => ({ ...Object.fromEntries(serviceGroups.map((entry) => [entry.categoryId, false])), [group.categoryId]: !categoryOpen }))}>
                        <span><strong>{categoryLabel(group.categoryId)}</strong><small>{group.subgroups.length} {group.subgroups.length === 1 ? "subcategory" : "subcategories"}</small></span>
                        <span><b>{categorySelected}</b> of {categoryItemIds.length} selected <i aria-hidden="true">⌄</i></span>
                      </button>
                      {categoryOpen && <div id={categoryPanelId} className="service-category-panel">
                        {group.subgroups.map((subgroup, subgroupIndex) => {
                          const subgroupId = subgroup.subcategoryId || "other";
                          const subgroupKey = `${group.categoryId}:${subgroupId}`;
                          const subgroupOpen = openServiceSubgroups[subgroupKey] ?? subgroupIndex === 0;
                          const subgroupSelected = subgroup.items.filter((item) => lines.some((line) => line.itemId === item.id)).length;
                          const subgroupPanelId = `service-subcategory-${group.categoryId}-${subgroupId}`;
                          return <section className="service-subcategory-accordion" key={subgroupId}>
                            <button className="service-subaccordion-trigger" aria-expanded={subgroupOpen} aria-controls={subgroupPanelId} onClick={() => setOpenServiceSubgroups((current) => ({ ...current, ...Object.fromEntries(group.subgroups.map((entry) => [`${group.categoryId}:${entry.subcategoryId || "other"}`, false])), [subgroupKey]: !subgroupOpen }))}>
                              <span>{categoryLabel(subgroup.subcategoryId) || "Other"}</span><span>{subgroupSelected}/{subgroup.items.length}<i aria-hidden="true">⌄</i></span>
                            </button>
                            {subgroupOpen && <div id={subgroupPanelId}>{subgroup.items.map(item=>{const selected=lines.some(line=>line.itemId===item.id);return <label className={selected?"selected":""} key={item.id}><input type="checkbox" checked={selected} disabled={locked} onChange={()=>toggleItem(item.id)}/><span className="service-switch" aria-hidden="true"><i/></span><span><strong>{item.name}</strong><small>{item.description||`${item.pricingBasis.replace("_"," ")} · ${labels[item.recurrence]}`}</small><em>{labels[item.recurrence]} · {item.bundleItemIds?.length?`${item.bundleItemIds.length} bundled components`:item.optionalUpgradeItemIds?.length?`${item.optionalUpgradeItemIds.length} optional upgrades`:item.serviceSchedule?"Schedule included":"No schedule"}</em></span><b>{item.basePriceMinor?formatMoney(item.basePriceMinor,item.baseCurrency):item.pricingBasis.replace("_"," ")}</b></label>})}</div>}
                          </section>;
                        })}
                      </div>}
                    </section>;
                  })}
                </div>
              )}

              <div className="line-table" role="table" aria-label="Quote lines">
                <div className="line-row line-header" role="row">
                  <span>Item</span><span>Quantity</span><span>Unit price</span><span>Margin</span><span>Total</span><span />
                </div>
                {lines.map((selected) => {
                  const item = catalogueItems.find((candidate) => candidate.id === selected.itemId);
                  const line = priced?.lines.find((candidate) => candidate.lineId === selected.itemId);
                  if (!item) return null;
                  return (
                    <div className="line-group" key={selected.itemId}>
                      <div className="line-row" role="row">
                        <span className="item-cell"><span className="item-glyph">{item.name.charAt(0)}</span><span><strong>{item.name}</strong><small>{categoryLabel(item.categoryId)}{item.subcategoryId?` / ${categoryLabel(item.subcategoryId)}`:""} · {item.unitLabel} · {labels[item.recurrence]}</small></span></span>
                        <span><input className="quantity-input" aria-label={`${item.name} quantity`} type="number" disabled={locked} min={item.minQuantity ?? 1} max={item.maxQuantity} value={selected.quantity} onChange={(event) => updateQuantity(item.id, Number(event.target.value))} /></span>
                        <span>{line ? formatMoney(line.effectiveUnitPriceMinor,priced?.currency) : "—"}</span>
                        <span className={line?.marginBp !== null && line?.marginBp !== undefined && line.marginBp < 3500 ? "margin-low" : "margin-good"}>{line?.marginBp === null || line?.marginBp === undefined ? "Unknown" : `${(line.marginBp / 100).toFixed(1)}%`}</span>
                        <span className="line-total">{line ? formatMoney(line.finalPriceMinor,priced?.currency) : "—"}</span>
                        <span className="line-actions"><button aria-label={`Explain ${item.name}`} onClick={() => setExplainLine(explainLine === item.id ? null : item.id)}>⌄</button><button aria-label={`Remove ${item.name}`} disabled={locked} onClick={() => toggleItem(item.id)}>×</button></span>
                      </div>
                      {explainLine === item.id && line && (
                        <div className="explanation">
                          <p><strong>Calculation trace</strong><span>Rule set v{ruleSet.version}</span></p>
                          {line.trace.map((step) => <div key={`${step.label}-${step.beforeMinor}`}><span>{step.label}</span><span>{formatMoney(step.beforeMinor)} → <strong>{formatMoney(step.afterMinor)}</strong></span></div>)}
                        </div>
                      )}
                    </div>
                  );
                })}
                {lines.length === 0 && <div className="empty-state"><strong>No items selected</strong><p>Add a catalogue item to begin pricing.</p></div>}
              </div>
            </div>
          </section>

          <section className="section-block">
            <div className="section-number">03</div>
            <div className="section-content">
              <div className="section-title-row"><div><h2>Pricing context</h2><p>Answers activate published pricing modifiers.</p></div><span className="rule-version">Rule set v{ruleSet.version}</span></div>
              <div className="question-grid">
                {(ruleSet.questions ?? []).map((question) => <fieldset key={question.id}><legend>{question.prompt}{question.required ? " *" : ""}</legend><p>{question.helpText}</p>{question.options.map((option) => <label key={option.value}><input type="radio" name={question.id} checked={answers[question.id] === option.value} onChange={() => setAnswers((current) => ({ ...current, [question.id]: option.value }))} /><span>{option.label}</span><small>{option.helpText}</small></label>)}</fieldset>)}
              </div>
            </div>
          </section>

          <footer className="commercial-step-footer">
            <button className="button secondary" onClick={() => setBuilderStep("client")}>← Back to client</button>
            <div><strong>Commercial scope complete</strong><p>Continue to apply the standard proposal template and tailor the client document.</p></div>
            <button className="button primary" onClick={() => setBuilderStep("proposal")}>Continue to proposal →</button>
          </footer>
          </>}
        </div>

        <QuoteSummary
          quote={priced}
          reference={reference}
          ruleSetVersion={ruleSet.version}
          errors={pricingErrors}
          discount={quoteDiscount}
          setDiscount={setQuoteDiscount}
          onPreview={() => setBuilderStep("governance")}
        />
      </div>
      ) : builderStep === "proposal" ? (
        <section className="proposal-design-page">
          <header className="proposal-design-header">
            <div><p className="eyebrow">Proposal design workspace</p><h2>Shape the client document</h2><p>The selected standard template is copied into this quote. Changes here do not alter the reusable master template or governed pricing.</p></div>
            <div><span className="proposal-page-count"><strong>{proposalPages.length}</strong><small>{proposalPages.length === 1 ? "Page" : "Pages"}</small></span><button className="button secondary" onClick={() => setBuilderStep("services")}>← Scope and pricing</button><button className="button primary" disabled={!priced} onClick={() => priced && setPreview(true)}>Preview proposal</button></div>
          </header>

          <section className="proposal-setup-bar">
            <div><span className="template-card-icon" aria-hidden="true">T</span><div><strong>Start from a standard template</strong><p>Applying a template creates an independent, editable copy for this quote.</p></div></div>
            <label><span>Template</span><select value={selectedTemplateId} disabled={locked} onChange={(event) => selectProposalTemplate(event.target.value)}><option value="">Custom proposal</option>{proposalTemplates.map((template) => <option key={template.id} value={template.id}>{template.name}{template.isDefault ? " · Default" : ""}</option>)}</select></label>
          </section>

          <details className="proposal-disclosure">
            <summary><span><strong>Quote-specific details</strong><small>Title, brand, deposit and acceptance options</small></span><span>{selectedTemplateId ? "Template linked" : "Custom pages"}</span></summary>
            <div className="document-fields proposal-design-fields">
              <label><span>Proposal title</span><input value={proposalTitle} disabled={locked} onChange={(event) => setProposalTitle(event.target.value)} /></label>
              <div className="brand-fields"><label><span>Brand name</span><input value={brandName} disabled={locked} onChange={(event) => setBrandName(event.target.value)} /></label><label><span>Initials</span><input maxLength={4} value={brandInitials} disabled={locked} onChange={(event) => setBrandInitials(event.target.value.toUpperCase())} /></label></div>
              <label><span>Deposit stated, £, optional</span><input type="number" min="0" step="0.01" value={deposit} disabled={locked} onChange={(event) => setDeposit(event.target.value)} /></label>
              <div className="proposal-options-editor"><span>Acceptance options, optional</span>{proposalOptions.map((option, index) => <div key={option.id}><input value={option.label} disabled={locked} placeholder={`Option ${index + 1}`} onChange={(event) => setProposalOptions((current) => current.map((entry) => entry.id === option.id ? { ...entry, label: event.target.value } : entry))} /><button className="text-button danger-text" disabled={locked} onClick={() => setProposalOptions((current) => current.filter((entry) => entry.id !== option.id))}>Remove</button></div>)}<button className="text-button" disabled={locked} onClick={() => setProposalOptions((current) => [...current, { id: crypto.randomUUID(), label: "" }])}>+ Add option</button></div>
            </div>
          </details>

          <section className="proposal-design-editor document-content-block">
            <div className="proposal-editor-heading"><div><strong>Visual proposal builder</strong><p>Select a page, then drag and edit content directly in the canvas.</p></div><span>Quote-specific copy</span></div>
            <div className="section-content"><Suspense fallback={<div className="proposal-editor-loading"><span/><strong>Loading visual editor</strong><p>Preparing the governed page and block library.</p></div>}><ProposalEditor value={proposalPages} onChange={setProposalPages} onUploadImage={uploadProposalImage} pricingPreview={priced} proposalOptions={proposalOptions} metadataPreview={proposalMetadata} readOnly={locked}/></Suspense></div>
          </section>

          <details className="proposal-disclosure proposal-output-disclosure">
            <summary><span><strong>Files and output</strong><small>Attachments and governed PDF</small></span><span>{quoteFiles.length ? `${quoteFiles.length} files` : "Optional"}</span></summary>
            <div className="proposal-support-card"><div><p>Save the draft before attaching files or generating a governed PDF.</p></div><div className="proposal-support-actions"><label aria-disabled={!hasSaved} className={`button secondary upload-button ${hasSaved ? "" : "disabled-upload"}`}>Attach file<input type="file" disabled={!hasSaved} accept=".pdf,.png,.jpg,.jpeg,.txt" onChange={(event) => void uploadAttachment(event.target.files?.[0])} /></label><button className="button secondary" disabled={!hasSaved} onClick={requestPdf}>Generate PDF</button></div></div>
          </details>
          {quoteFiles.length > 0 && <div className="quote-files">{quoteFiles.map((file) => <a key={file.id} href={`/api/files/${file.id}`} target="_blank" rel="noreferrer"><span>{file.kind === "pdf" ? "PDF" : "FILE"}</span><strong>{file.filename}</strong><small>{Math.ceil(file.sizeBytes / 1024)} KB</small></a>)}</div>}
          {pdfState && (pdfState.startsWith("PDF ready|") ? <a className="pdf-ready-link" href={pdfState.split("|")[1]} target="_blank" rel="noreferrer">PDF ready, download now</a> : <p className="pdf-state">{pdfState}</p>)}

          <footer className="proposal-design-footer"><button className="button secondary" onClick={() => setBuilderStep("services")}>← Back to scope and pricing</button><span>Step 3 of 5 · {proposalPages.length} {proposalPages.length === 1 ? "page" : "pages"}</span><div><button className="button secondary" onClick={() => saveQuote("Draft")} disabled={saving !== null || locked}>{saving === "Draft" ? "Saving…" : "Save draft"}</button><button className="button primary" onClick={() => setBuilderStep("governance")}>Continue to governance →</button></div></footer>
        </section>
      ) : builderStep === "governance" ? (
        <section className="governance-stage-page">
          <header className="governance-stage-header">
            <div><p className="eyebrow">Engagement governance</p><h2>Confirm the contractual package</h2><p>Review the commercial terms, schedules and acceptance controls attached to this quote before final validation.</p></div>
            <span className={`control-status ${reviewReadiness[4].complete ? "ready" : "attention"}`}>{reviewReadiness[4].complete ? "Controls complete" : "Action required"}</span>
          </header>

          <div className="governance-stage-grid">
            <section className="governance-stage-card">
              <header><div><p className="eyebrow">Document controls</p><h3>Proposal content policy</h3></div><span>{enabledProposalBlocks.length} active blocks</span></header>
              <div className="governance-check-list">
                <GovernanceCheck title="Commercial pricing" description="A governed pricing table communicates the accepted scope and investment." status={enabledProposalBlocks.some((block) => block.type === "pricing_table") ? "Ready" : "Review"}/>
                <GovernanceCheck title="Terms and jurisdiction" description="The quote contains a terms block. Published mandatory clauses are revalidated by the server at readiness." status={enabledProposalBlocks.some((block) => block.type === "terms") ? "Ready" : "Review"}/>
                <GovernanceCheck title="Acceptance and signature" description="The recipient document includes a formal acceptance control and immutable evidence path." status={enabledProposalBlocks.some((block) => block.type === "signature") ? "Ready" : "Review"}/>
              </div>
            </section>

            <aside className="governance-stage-aside">
              <section className="governance-stage-card">
                <header><div><p className="eyebrow">Engagement package</p><h3>Quote-level summary</h3></div></header>
                <dl className="governance-summary-list">
                  <div><dt>Proposal type</dt><dd>{proposalTypes.find((type) => type.id === proposalTypeId)?.name ?? "Custom"}</dd></div>
                  <div><dt>Service schedules</dt><dd>{eligibleCatalogue.filter((item) => lines.some((line) => line.itemId === item.id) && item.serviceSchedule).length} included</dd></div>
                  <div><dt>Acceptance options</dt><dd>{proposalOptions.filter((option) => option.label.trim()).length || "Standard"}</dd></div>
                  <div><dt>Valid until</dt><dd>{validUntil}</dd></div>
                  <div><dt>Jurisdiction policy</dt><dd>Validated on readiness</dd></div>
                </dl>
                <button className="button secondary full-action" onClick={() => setBuilderStep("proposal")}>Edit proposal content</button>
              </section>
              <section className="governance-policy-note"><span>§</span><div><strong>Server-enforced governance</strong><p>Published legal content is immutable. Applicable mandatory policies, expiry and commercial calculations are checked again when this quote is marked ready.</p></div></section>
            </aside>
          </div>

          <footer className="governance-stage-footer"><button className="button secondary" onClick={() => setBuilderStep("proposal")}>← Back to proposal</button><span>Step 4 of 5 · Governance controls</span><button className="button primary" onClick={() => setBuilderStep("review")}>Continue to final review →</button></footer>
        </section>
      ) : (
        <section className="review-issue-page">
          <header className="review-issue-header">
            <div><p className="eyebrow">Final review</p><h2>Validate and issue the proposal</h2><p>Review the exact client document, resolve readiness exceptions and control the transition from draft to issued commercial record.</p></div>
            <div><span className={`review-readiness-score ${readyToSubmit ? "complete" : "attention"}`}><strong>{completedReadiness}/{reviewReadiness.length}</strong><small>Checks complete</small></span><button className="button secondary" disabled={!priced} onClick={() => priced && setPreview(true)}>Full-screen preview</button></div>
          </header>

          <div className="review-issue-grid">
            <section className="review-preview-card">
              <header><div><span className="review-live-dot"/><strong>Client document preview</strong><small>Responsive web proposal</small></div><span>{proposalPages.length} pages · {quoteCurrency}</span></header>
              <div className="review-document-frame">
                {priced ? <ProposalDocument quote={priced} clientName={clientName} contactName={contactName} contactEmail={contactEmail} reference={reference} title={proposalTitle} introduction={proposalIntroduction} scopeHeading={scopeHeading} brandName={brandName} brandInitials={brandInitials} validUntil={validUntil} pages={proposalPages} options={proposalOptions} compact /> : <div className="review-preview-empty"><span>!</span><strong>Commercial preview unavailable</strong><p>Return to scope and pricing and resolve the pricing-engine exceptions.</p><button className="button secondary" onClick={() => setBuilderStep("services")}>Open scope and pricing</button></div>}
              </div>
            </section>

            <aside className="review-control-column">
              <section className="review-control-card readiness-card">
                <header><div><p className="eyebrow">Pre-issue controls</p><h3>Readiness assessment</h3></div><span className={readyToSubmit ? "control-status ready" : "control-status attention"}>{readyToSubmit ? "Ready" : "Action required"}</span></header>
                <div className="readiness-list">{reviewReadiness.map((item) => <button key={item.id} onClick={() => setBuilderStep(item.step)}><span className={item.complete ? "readiness-icon complete" : "readiness-icon"}>{item.complete ? "✓" : "!"}</span><span><strong>{item.label}</strong><small>{item.detail}</small></span><b>{item.complete ? "Complete" : "Review"}</b></button>)}</div>
                <p className="legal-validation-note"><span aria-hidden="true">§</span>Mandatory legal policies and immutable content versions are revalidated by the server when the quote is marked ready.</p>
              </section>

              <section className="review-control-card commercial-review-card">
                <header><div><p className="eyebrow">Commercial snapshot</p><h3>Quote economics</h3></div><span>Rule set v{ruleSet.version}</span></header>
                <div className="review-metrics"><div><span>One-off</span><strong>{priced ? formatMoney(priced.oneOffSubtotalMinor, priced.currency) : "—"}</strong></div><div><span>Annual recurring</span><strong>{priced ? formatMoney(priced.recurringAnnualisedMinor, priced.currency) : "—"}</strong></div><div><span>Margin</span><strong>{priced?.marginBp === null || priced?.marginBp === undefined ? "Incomplete" : `${(priced.marginBp / 100).toFixed(1)}%`}</strong></div><div><span>Services</span><strong>{lines.length}</strong></div></div>
              </section>

              <section className="review-control-card lifecycle-card">
                <header><div><p className="eyebrow">Governed action</p><h3>Approval and issue</h3></div><Status>{lifecycleStatus}</Status></header>
                {lifecycleStatus === "Draft" && <><p>Marking ready reprices and validates this quote on the server before issue is permitted.</p><div className="review-action-stack"><button className="button secondary" onClick={() => saveQuote("Draft")} disabled={saving !== null}>{saving === "Draft" ? "Saving…" : hasSaved ? "Save latest draft" : "Save draft"}</button><button className="button primary" onClick={() => saveQuote("Ready")} disabled={!readyToSubmit || saving !== null}>{saving === "Ready" ? "Validating…" : "Validate and mark ready"}</button></div></>}
                {lifecycleStatus === "Ready" && <><p>The validated snapshot is ready for controlled publication to the recipient.</p><button className="button primary full-action" onClick={issueCurrentQuote} disabled={issuing}>{issuing ? "Issuing secure link…" : "Issue secure recipient link"}</button></>}
                {sharePath && <div className="issued-link-panel"><span>Secure recipient link</span><code>{sharePath}</code><div><button className="button secondary" onClick={() => void copyRecipientLink()}>Copy link</button><a className="button primary" href={sharePath} target="_blank" rel="noreferrer">Open recipient view</a></div></div>}
                {["Issued", "Viewed"].includes(lifecycleStatus) && <button className="text-button offline-action" onClick={acceptOffline}>Record evidenced offline acceptance</button>}
                {locked && lifecycleStatus !== "Accepted" && <button className="button secondary full-action" onClick={createRevision} disabled={revising}>{revising ? "Creating revision…" : "Create editable revision"}</button>}
                {lifecycleStatus === "Accepted" && <div className="accepted-state"><span>✓</span><div><strong>Proposal accepted</strong><p>The accepted snapshot is immutable and its evidence certificate is available.</p><a className="button secondary" href={`/api/quotes/${encodeURIComponent(reference)}/certificate`} target="_blank" rel="noreferrer">Download acceptance certificate</a></div></div>}
              </section>

              <section className="review-control-card output-card">
                <header><div><p className="eyebrow">Controlled output</p><h3>Files and PDF</h3></div><span>{quoteFiles.length} files</span></header>
                <p>Supporting files and generated PDFs are bound to this quote version.</p>
                <div className="output-actions"><label aria-disabled={!hasSaved || uploading} className={`button secondary upload-button ${hasSaved && !uploading ? "" : "disabled-upload"}`}>{uploading ? "Uploading…" : "Attach file"}<input type="file" disabled={!hasSaved || uploading} accept=".pdf,.png,.jpg,.jpeg,.txt" onChange={(event) => void uploadAttachment(event.target.files?.[0])}/></label><button className="button secondary" disabled={!hasSaved || pdfBusy} onClick={requestPdf}>{pdfBusy ? "Generating…" : "Generate PDF"}</button></div>
                {pdfState && (pdfState.startsWith("PDF ready|") ? <a className="pdf-ready-link" href={pdfState.split("|")[1]} target="_blank" rel="noreferrer">Download generated PDF</a> : <p className="pdf-state">{pdfState}</p>)}
              </section>
            </aside>
          </div>

          <footer className="review-issue-footer"><button className="button secondary" onClick={() => setBuilderStep("governance")}>← Back to governance</button><span>Step 5 of 5 · {lifecycleStatus}</span><button className="button secondary" onClick={() => setBuilderStep("services")}>Review scope and pricing</button></footer>
        </section>
      )}
    </div>
  );
}

function QuoteSummary({ quote, reference, ruleSetVersion, errors, discount, setDiscount, onPreview }: { quote: PricedQuote | null; reference: string; ruleSetVersion: number; errors: string[]; discount: number; setDiscount: (value: number) => void; onPreview: () => void }) {
  const recurring = quote
    ? (Object.entries(quote.recurringByFrequency) as Array<[Frequency, number]>).filter(([frequency, amount]) => frequency !== "one_off" && amount > 0)
    : [];
  return (
    <aside className="quote-summary">
      <div className="summary-kicker"><span>Quote totals</span><b>Published rule set</b></div>
      <div className="quote-summary-body">
        <div className="quote-summary-heading">
          <h2>Quote summary</h2>
          <p className="summary-reference">{reference} · Rule set version {ruleSetVersion}</p>
        </div>

        {errors.length > 0 && <div className="error-panel"><strong>Pricing blocked</strong>{errors.map((error) => <span key={error}>{error.replace("pricing.", "").replaceAll("_", " ")}</span>)}</div>}

        <div className="summary-lines">
          {quote?.lines.map((line) => (
            <div key={line.lineId}><span>{line.itemName}<small>{line.quantity} × {line.unitLabel}</small></span><strong>{formatMoney(line.finalPriceMinor,quote.currency)}</strong></div>
          ))}
        </div>

        <label className="discount-control">
          <span><strong>Quote discount</strong><b>{discount}%</b></span>
          <input type="range" min="0" max="20" step="1" value={discount} onChange={(event) => setDiscount(Number(event.target.value))} />
          <small>Owner authority: up to 20%</small>
        </label>

        <div className="totals">
          <div><span>One-off total</span><strong>{quote ? formatMoney(quote.oneOffSubtotalMinor,quote.currency) : "—"}</strong></div>
          {recurring.map(([frequency, amount]) => <div key={frequency}><span>{labels[frequency]} recurring</span><strong>{formatMoney(amount,quote?.currency)}</strong></div>)}
          {recurring.length > 0 && <div className="annualised"><span>Annualised recurring</span><strong>{quote ? formatMoney(quote.recurringAnnualisedMinor,quote.currency) : "—"}</strong></div>}
          {quote&&quote.taxTotalMinor>0&&<div><span>Tax across displayed periods</span><strong>{formatMoney(quote.taxTotalMinor,quote.currency)}</strong></div>}
        </div>

        <div className="health-row">
          <span><i className="health-dot" />Commercial health</span>
          <strong>{quote?.marginBp === null || quote?.marginBp === undefined ? "Margin incomplete" : `${(quote.marginBp / 100).toFixed(1)}% margin`}</strong>
        </div>
        <p className="separation-note">One-off and recurring values remain separate by design.</p>
        <button className="button preview-button" onClick={onPreview} disabled={!quote}>Open client preview</button>
      </div>
    </aside>
  );
}

function PreviewBlock({block,quote,recurring,options,metadata}:{block:DocumentPage["blocks"][number];quote:PricedQuote;recurring:Array<[Frequency,number]>;options:Array<{id:string;label:string}>;metadata:ProposalMetadata}){if(block.enabled===false)return null;const heading=<>{block.eyebrow&&<p className="eyebrow">{resolveProposalText(block.eyebrow,metadata)}</p>}{block.title&&<h2>{resolveProposalText(block.title,metadata)}</h2>}</>;if(block.type==="spacer")return <div className="recipient-spacer"/>;if(block.type==="pricing_table")return <div className="recipient-content-block">{heading}{block.display!=="totals"&&<section className="document-scope service-schedule-scope">{quote.lines.map(line=><div className="proposal-service-line" key={line.lineId}><div><span><strong>{line.itemName}</strong><small>{line.quantity} {line.unitLabel}</small></span><strong>{formatMoney(line.finalPriceMinor,quote.currency)}</strong></div>{(line.description||line.serviceSchedule||line.serviceTerms)&&<section>{line.description&&<p>{line.description}</p>}{line.serviceSchedule&&<div><strong>Service schedule</strong><p>{line.serviceSchedule}</p></div>}{line.serviceTerms&&<div><strong>Service terms</strong><p>{line.serviceTerms}</p></div>}</section>}</div>)}</section>}{block.display!=="lines"&&<section className="document-totals"><div><small>ONE-OFF INVESTMENT</small><strong>{formatMoney(quote.oneOffSubtotalMinor,quote.currency)}</strong></div>{recurring.map(([frequency,amount])=><div key={frequency}><small>{labels[frequency].toUpperCase()} RECURRING</small><strong>{formatMoney(amount)}</strong></div>)}</section>}</div>;if(["feature_grid","timeline","team","faq"].includes(block.type))return <div className="recipient-content-block">{heading}<div className="recipient-items" style={{"--columns":String(block.columns??3)} as CSSProperties}>{(block.items??[]).map(item=><div key={item.id}><strong>{resolveProposalText(item.title,metadata)}</strong><p>{resolveProposalText(item.content,metadata)}</p></div>)}</div></div>;if(block.type==="image")return <div className="recipient-content-block">{heading}{block.fileId&&<img className="recipient-media" src={`/api/files/${block.fileId}`} alt={resolveProposalText(block.title,metadata)??"Proposal image"}/>}</div>;if(block.type==="options")return <div className="recipient-content-block">{heading}<div className="recipient-items">{options.map(option=><div key={option.id}><strong>{option.label}</strong></div>)}</div></div>;return <div className={`recipient-content-block ${block.type==="callout"?"recipient-callout":""}`}>{heading}{block.content&&<p>{resolveProposalText(block.content,metadata)}</p>}</div>}

type ProposalDocumentProps = { quote:PricedQuote; clientName:string; contactName:string; contactEmail:string; reference:string; title:string; introduction:string; scopeHeading:string; brandName:string; brandInitials:string; validUntil:string; pages:DocumentPage[]; options:Array<{id:string;label:string}>; compact?:boolean };

function ProposalDocument({ quote, clientName, contactName, contactEmail, reference, title, introduction, scopeHeading, brandName, brandInitials, validUntil, pages, options, compact=false }:ProposalDocumentProps) {
  const recurring = (Object.entries(quote.recurringByFrequency) as Array<[Frequency, number]>).filter(([frequency, amount]) => frequency !== "one_off" && amount > 0);
  const validity = validUntil ? new Date(`${validUntil}T12:00:00Z`).toLocaleDateString("en-GB", { day:"numeric", month:"long", year:"numeric" }) : "Not set";
  const metadata:ProposalMetadata = { clientName, contactName, contactEmail, quoteReference:reference, proposalTitle:title, validUntil:validity, currency:quote.currency, brandName };
  return (
      <article className={`client-document horizon-client-document ${compact ? "compact-document" : ""}`}>
        <header><span className="client-logo">{brandInitials || "QB"}</span><div><small>PROPOSAL · {reference}</small><h1>{title}</h1><p>Prepared for {clientName}</p></div><div className="document-hero-meta"><span>Valid until</span><strong>{validity}</strong><span>Currency</span><strong>{quote.currency}</strong></div></header>
        {pages.length?pages.map(page=><section className={`recipient-page page-${page.format} background-${page.background}`} key={page.id}>{page.blocks.map(block=><PreviewBlock key={block.id} block={block} quote={quote} recurring={recurring} options={options} metadata={metadata}/>)}</section>):<><section className="document-intro"><p className="eyebrow">Our proposal</p><h2>Clarity from scope to commitment.</h2><p>{introduction}</p></section><section className="document-scope"><p className="eyebrow">Scope and investment</p><h2>{scopeHeading}</h2>{quote.lines.map((line) => <div key={line.lineId}><span><strong>{line.itemName}</strong><small>{line.quantity} {line.unitLabel}{line.quantity === 1 ? "" : "s"}</small></span><strong>{formatMoney(line.finalPriceMinor,quote.currency)}</strong></div>)}</section><section className="document-totals"><div><small>ONE-OFF INVESTMENT</small><strong>{formatMoney(quote.oneOffSubtotalMinor,quote.currency)}</strong></div>{recurring.map(([frequency, amount]) => <div key={frequency}><small>{labels[frequency].toUpperCase()} RECURRING</small><strong>{formatMoney(amount)}</strong></div>)}</section></>}
        <section className="document-accept"><div><p className="eyebrow">Formal acceptance</p><h2>Ready to proceed?</h2><p>The secure acceptance workflow records the selected option, authorised signatory and verification evidence.</p></div><button disabled>Accept proposal</button></section>
        <footer><span>{brandName}</span><span>Valid until {validity}</span><span>Private and confidential</span></footer>
      </article>
  );
}

function QuotePreview(props: ProposalDocumentProps & { onBack: () => void }) {
  return (
    <div className="preview-shell horizon-preview-shell">
      <div className="preview-toolbar horizon-preview-toolbar"><button className="button secondary" onClick={props.onBack}>← Back to review</button><span><i className="review-live-dot"/>Client experience preview</span><button className="button primary" onClick={() => window.print()}>Print or save PDF</button></div>
      <ProposalDocument {...props} />
    </div>
  );
}

function QuotesScreen({ onCreate, onOpen, savedQuotes, loading, storageMessage }: { onCreate: () => void; onOpen: (reference: string) => void; savedQuotes: SavedQuote[]; loading: boolean; storageMessage: string | null }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const query = search.trim().toLowerCase();
  const visibleSaved = savedQuotes.filter((quote) =>
    (statusFilter === "All" || quote.status === statusFilter)
    && (!query || `${quote.reference} ${quote.clientName} ${quote.contactName}`.toLowerCase().includes(query)),
  );
  const visibleSeed = seedQuotes.filter((quote) =>
    (statusFilter === "All" || quote.status === statusFilter)
    && (!query || `${quote.reference} ${quote.client}`.toLowerCase().includes(query)),
  );
  const oneOffPipeline = savedQuotes.reduce((total, quote) => total + quote.oneOffTotalMinor, 0);
  const recurringPipeline = savedQuotes.reduce((total, quote) => total + quote.recurringAnnualisedMinor, 0);
  return (
    <div className="standard-page">
      <div className="page-heading"><div><p className="eyebrow">Commercial workspace</p><h1>Quotes</h1><p className="page-subtitle">Monitor active commercial decisions from draft to acceptance.</p></div><button className="button primary" onClick={onCreate}>+ New quote</button></div>
      <div className="metric-strip">
        <div><span>One-off pipeline</span><strong>{savedQuotes.length ? formatMoney(oneOffPipeline) : "£0"}</strong><small>{loading ? "Loading workspace records…" : `${formatMoney(recurringPipeline)} annualised recurring, shown separately`}</small></div>
        <div><span>Accepted this month</span><strong>£48,200</strong><small className="positive">+18.4% from July</small></div>
        <div><span>Average margin</span><strong>43.7%</strong><small>Above 35% floor</small></div>
        <div><span>Time to first view</span><strong>2h 14m</strong><small>Median, last 30 days</small></div>
      </div>
      <section className="data-panel">
        <div className="panel-toolbar"><div><h2>Workspace records</h2><p>Open durable records to continue work or create a governed revision</p></div><div><input aria-label="Search quotes" placeholder="Search quotes" value={search} onChange={(event) => setSearch(event.target.value)} /><select aria-label="Filter quotes by status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option>All</option><option>Draft</option><option>Ready</option><option>Issued</option><option>Viewed</option><option>Accepted</option><option>Declined</option><option>Expired</option><option>Superseded</option></select></div></div>
        {storageMessage && <p className="storage-message">{storageMessage}</p>}
        <div className="quotes-table">
          <div className="quotes-row quotes-header"><span>Reference</span><span>Client</span><span>Status</span><span>Value</span><span>Last activity</span><span /></div>
          {visibleSaved.map((quote) => <button className="quotes-row durable-row" key={quote.id} onClick={() => onOpen(quote.reference)}><strong>{quote.reference}</strong><span>{quote.clientName}<small>{quote.contactEmail ?? `Saved by ${quote.ownerEmail}`}</small></span><span><Status>{quote.status}</Status></span><span><strong>{formatMoney(quote.oneOffTotalMinor, quote.currency)}</strong><small>{formatMoney(quote.recurringAnnualisedMinor, quote.currency)} annualised recurring</small></span><span>{new Date(`${quote.updatedAt.replace(" ", "T")}Z`).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</span><span>›</span></button>)}
          {visibleSeed.map((quote) => <div className="quotes-row illustrative-row" key={quote.reference}><strong>{quote.reference}</strong><span>{quote.client}<small>Illustrative pipeline record</small></span><span><Status>{quote.status}</Status></span><strong>{quote.value}</strong><span>{quote.activity}</span><span>•</span></div>)}
          {!loading && visibleSaved.length === 0 && visibleSeed.length === 0 && <div className="empty-state quote-empty"><strong>No matching quotes</strong><p>Adjust the search or status filter.</p></div>}
        </div>
      </section>
    </div>
  );
}

function ClientsScreen({ clients, onSaved }: { clients: ClientRecord[]; onSaved: (client: ClientRecord) => void }) {
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<ClientRecord | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [name, setName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [status, setStatus] = useState<ClientRecord["status"]>("Active");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const visible = clients.filter((client) => `${client.name} ${client.contactName} ${client.contactEmail}`.toLowerCase().includes(search.toLowerCase()));

  function openEditor(client?: ClientRecord) {
    setEditing(client ?? null);
    setName(client?.name ?? "");
    setContactName(client?.contactName ?? "");
    setContactEmail(client?.contactEmail ?? "");
    setStatus(client?.status ?? "Active");
    setMessage(null);
    setEditorOpen(true);
  }

  async function saveClient() {
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/clients", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: editing?.id, name, contactName, contactEmail, status }) });
      const payload = (await response.json()) as { client?: { id: string; name: string; contact_name: string; contact_email: string; status: ClientRecord["status"]; updated_at: string }; error?: string };
      if (!response.ok || !payload.client) throw new Error(payload.error ?? "The client could not be saved.");
      onSaved({ id: payload.client.id, name: payload.client.name, contactName: payload.client.contact_name, contactEmail: payload.client.contact_email, status: payload.client.status, quoteCount: editing?.quoteCount ?? 0, acceptedOneOffMinor: editing?.acceptedOneOffMinor ?? 0, acceptedRecurringAnnualisedMinor: editing?.acceptedRecurringAnnualisedMinor ?? 0, updatedAt: payload.client.updated_at });
      setEditorOpen(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The client could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return <div className="standard-page"><div className="page-heading"><div><p className="eyebrow">Commercial relationships</p><h1>Clients</h1><p className="page-subtitle">Govern contact records, quote history and accepted commercial value.</p></div><button className="button primary" onClick={() => openEditor()}>+ New client</button></div>{editorOpen && <section className="catalogue-editor"><div className="editor-heading"><div><p className="eyebrow">{editing ? "Edit client" : "New client"}</p><h2>{editing?.name ?? "Client record"}</h2></div><button aria-label="Close client editor" onClick={() => setEditorOpen(false)}>×</button></div><div className="editor-grid client-editor-grid"><label><span>Client name</span><input value={name} onChange={(event) => setName(event.target.value)} /></label><label><span>Contact name</span><input value={contactName} onChange={(event) => setContactName(event.target.value)} /></label><label><span>Contact email</span><input type="email" value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} /></label><label><span>Status</span><select value={status} onChange={(event) => setStatus(event.target.value as ClientRecord["status"])}><option>Active</option><option>Archived</option></select></label></div>{message && <p className="editor-error">{message}</p>}<div className="editor-actions"><button className="button secondary" onClick={() => setEditorOpen(false)}>Cancel</button><button className="button primary" onClick={saveClient} disabled={saving || !name.trim() || !contactName.trim() || !contactEmail.trim()}>{saving ? "Saving…" : "Save client"}</button></div></section>}<section className="data-panel"><div className="panel-toolbar"><div><h2>Client records</h2><p>{clients.filter((client) => client.status === "Active").length} active relationships</p></div><input placeholder="Search clients" value={search} onChange={(event) => setSearch(event.target.value)} /></div><div className="client-table"><div className="client-row client-header"><span>Client and contact</span><span>Status</span><span>Quotes</span><span>Accepted one-off</span><span>Accepted recurring</span><span /></div>{visible.map((client) => <button className="client-row" key={client.id} onClick={() => openEditor(client)}><span><strong>{client.name}</strong><small>{client.contactName} · {client.contactEmail}</small></span><span><Status>{client.status}</Status></span><strong>{client.quoteCount}</strong><strong>{formatMoney(client.acceptedOneOffMinor)}</strong><strong>{formatMoney(client.acceptedRecurringAnnualisedMinor)} annualised</strong><span>›</span></button>)}{visible.length === 0 && <div className="empty-state quote-empty"><strong>No matching clients</strong><p>Create a client or adjust the search.</p></div>}</div></section></div>;
}

function RulesScreen({ published, draft, catalogueItems, onChanged }: { published: RuleSet; draft: RuleSet | null; catalogueItems: CatalogueItem[]; onChanged: (published: RuleSet, draft: RuleSet | null) => void }) {
  const [working, setWorking] = useState<RuleSet>(draft ?? published);
  const [saving, setSaving] = useState<"create" | "save" | "publish" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [testItemId, setTestItemId] = useState(catalogueItems[0]?.id ?? "");
  const [testQuantity, setTestQuantity] = useState(1);
  const [testAnswers, setTestAnswers] = useState<Record<string, string>>(() => Object.fromEntries((working.questions ?? []).map((question) => [question.id, question.options[0]?.value ?? ""])));
  const [testQuote, setTestQuote] = useState<PricedQuote | null>(null);
  const [testErrors, setTestErrors] = useState<string[]>([]);

  useEffect(() => {
    if (!testItemId) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      fetch("/api/pricing", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ruleSet: working, answers: testAnswers, quoteDiscount: 0, lines: [{ itemId: testItemId, quantity: testQuantity, discount: 0 }] }), signal: controller.signal })
        .then(async (response) => {
          const payload = (await response.json()) as { ok?: boolean; quote?: PricedQuote; errors?: Array<{ code: string }>; error?: string };
          if (!response.ok) throw new Error(payload.error ?? "Test pricing failed.");
          setTestQuote(payload.ok ? payload.quote ?? null : null);
          setTestErrors(payload.ok ? [] : payload.errors?.map((error) => error.code) ?? []);
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          setTestQuote(null);
          setTestErrors([error instanceof Error ? error.message : "Test pricing failed."]);
        });
    }, 80);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [testAnswers, testItemId, testQuantity, working]);

  async function ruleAction(action: "create_draft" | "save_draft" | "publish") {
    setSaving(action === "create_draft" ? "create" : action === "publish" ? "publish" : "save");
    setMessage(null);
    try {
      const response = await fetch("/api/rules", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, ...(action === "create_draft" ? {} : { ruleSet: working }) }),
      });
      const payload = (await response.json()) as { published?: RuleSet; draft?: RuleSet | null; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Pricing rules could not be updated.");
      if (action === "create_draft" && payload.draft) {
        setWorking(payload.draft);
        onChanged(published, payload.draft);
        setMessage(`Draft version ${payload.draft.version} created from the published controls.`);
      } else if (action === "publish" && payload.published) {
        setWorking(payload.published);
        onChanged(payload.published, null);
        setMessage(`Version ${payload.published.version} published. New quotes now use these controls.`);
      } else if (payload.draft) {
        onChanged(published, payload.draft);
        setMessage("Draft controls saved without affecting live quotes.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Pricing rules could not be updated.");
    } finally {
      setSaving(null);
    }
  }

  function addQuestion() {
    const id = `question-${(working.questions?.length ?? 0) + 1}`;
    setWorking({ ...working, questions: [...(working.questions ?? []), { id, prompt: "New pricing question", helpText: "Explain how this affects the work.", inputKind: "single_choice", required: true, options: [{ value: "standard", label: "Standard" }, { value: "enhanced", label: "Enhanced" }] }] });
  }

  function removeQuestion(questionId: string) {
    const dependencies = working.modifiers.filter((modifier) => modifier.triggerQuestionId === questionId);
    if (dependencies.length) {
      setMessage(`Remove dependent modifiers first: ${dependencies.map((modifier) => modifier.name).join(", ")}.`);
      return;
    }
    setWorking({ ...working, questions: (working.questions ?? []).filter((question) => question.id !== questionId) });
  }

  const overlapWarnings = working.quantityBands.flatMap((band, index) => working.quantityBands.slice(index + 1).flatMap((other) => {
    const sameScope = band.itemId === other.itemId && band.categoryId === other.categoryId;
    const bandEnd = band.toQuantity ?? Number.POSITIVE_INFINITY;
    const otherEnd = other.toQuantity ?? Number.POSITIVE_INFINITY;
    return sameScope && band.fromQuantity <= otherEnd && other.fromQuantity <= bandEnd ? [`${band.id} overlaps ${other.id}`] : [];
  }));

  const isDraft = Boolean(draft);
  return (
    <div className="standard-page">
      <div className="page-heading"><div><p className="eyebrow">Pricing governance</p><div className="title-row"><h1>Pricing rules and controls</h1><Status>{isDraft ? "Draft" : "Published"}</Status></div><p className="page-subtitle">Published version {published.version} governs products, services, subscriptions and mixed commercial proposals. Draft changes remain isolated until explicit publication.</p></div><div className="heading-actions">{!isDraft ? <button className="button primary" onClick={() => ruleAction("create_draft")} disabled={saving !== null}>{saving === "create" ? "Creating…" : "Create draft version"}</button> : <><button className="button secondary" onClick={() => ruleAction("save_draft")} disabled={saving !== null}>{saving === "save" ? "Saving…" : "Save draft"}</button><button className="button primary" onClick={() => ruleAction("publish")} disabled={saving !== null}>{saving === "publish" ? "Publishing…" : `Publish version ${working.version}`}</button></>}</div></div>
      {message && <div className="notice" role="status"><span>✓</span>{message}<button onClick={() => setMessage(null)}>×</button></div>}
      <div className={`rule-overview ${isDraft ? "rule-editor" : ""}`}><label><span>Rounding increment</span>{isDraft ? <input type="number" min="0.01" step="0.01" value={working.roundingIncrementMinor / 100} onChange={(event) => setWorking({ ...working, roundingIncrementMinor: money.minor(Math.round(Number(event.target.value) * 100)) })} /> : <strong>{formatMoney(working.roundingIncrementMinor)}</strong>}<small>Away from zero, per line</small></label><label><span>Quote minimum</span>{isDraft ? <input type="number" min="0" step="1" value={working.quoteMinimumMinor / 100} onChange={(event) => setWorking({ ...working, quoteMinimumMinor: money.minor(Math.round(Number(event.target.value) * 100)) })} /> : <strong>{formatMoney(working.quoteMinimumMinor)}</strong>}<small>One-off subtotal only</small></label><label><span>Margin floor</span>{isDraft ? <input type="number" min="0" max="95" step="0.1" value={(working.marginFloorBp ?? 0) / 100} onChange={(event) => setWorking({ ...working, marginFloorBp: money.bp(Math.round(Number(event.target.value) * 100)) })} /> : <strong>{(working.marginFloorBp ?? 0) / 100}%</strong>}<small>Warning, not a block</small></label><label><span>Owner discount cap</span>{isDraft ? <input type="number" min="0" max="95" step="0.1" value={working.discountCaps.owner / 100} onChange={(event) => setWorking({ ...working, discountCaps: { ...working.discountCaps, owner: money.bp(Math.round(Number(event.target.value) * 100)) } })} /> : <strong>{working.discountCaps.owner / 100}%</strong>}<small>Hard commercial control</small></label></div>
      <section className="data-panel rule-questions"><div className="panel-toolbar"><div><h2>Pricing questions</h2><p>Required questions appear dynamically in every new quote.</p></div>{isDraft ? <button className="button secondary" onClick={addQuestion}>+ Add question</button> : <span className="rule-count">{working.questions?.length ?? 0} questions</span>}</div>{(working.questions ?? []).map((question, questionIndex) => <div className="question-editor" key={question.id}><div className="question-editor-head"><span className="sequence">{questionIndex + 1}</span>{isDraft ? <><input aria-label="Question prompt" value={question.prompt} onChange={(event) => setWorking({ ...working, questions: working.questions?.map((entry) => entry.id === question.id ? { ...entry, prompt: event.target.value } : entry) })} /><label><input type="checkbox" checked={question.required} onChange={(event) => setWorking({ ...working, questions: working.questions?.map((entry) => entry.id === question.id ? { ...entry, required: event.target.checked } : entry) })} /> Required</label><button aria-label={`Remove ${question.prompt}`} onClick={() => removeQuestion(question.id)}>×</button></> : <><strong>{question.prompt}</strong><Status>{question.required ? "Required" : "Optional"}</Status></>}</div><p>{question.helpText}</p><div className="question-options">{question.options.map((option, optionIndex) => isDraft ? <div key={`${question.id}-${optionIndex}`}><input aria-label="Option label" value={option.label} onChange={(event) => setWorking({ ...working, questions: working.questions?.map((entry) => entry.id === question.id ? { ...entry, options: entry.options.map((item, index) => index === optionIndex ? { ...item, label: event.target.value } : item) } : entry) })} /><input aria-label="Option value" value={option.value} onChange={(event) => setWorking({ ...working, questions: working.questions?.map((entry) => entry.id === question.id ? { ...entry, options: entry.options.map((item, index) => index === optionIndex ? { ...item, value: event.target.value } : item) } : entry) })} /></div> : <span key={option.value}>{option.label}</span>)}</div></div>)}</section>
      <div className="rules-grid"><section className="data-panel"><div className="panel-toolbar"><div><h2>Quantity bands</h2><p>Item-scoped bands resolve by priority; overlaps are surfaced.</p></div>{isDraft ? <button className="button secondary" onClick={() => { const item = catalogueItems[0]; if (!item) return; setWorking({ ...working, quantityBands: [...working.quantityBands, { id: `band-${working.quantityBands.length + 1}`, itemId: item.id, fromQuantity: 1, unitPriceMinor: money.minor(item.basePriceMinor ?? item.costMinor ?? 0), priority: 10 }] }); }}>+ Add band</button> : <span className="rule-count">{working.quantityBands.length} bands</span>}</div>{overlapWarnings.map((warning) => <p className="rule-warning" key={warning}>{warning}</p>)}{working.quantityBands.map((band, bandIndex) => isDraft ? <div className="rule-inline-editor" key={band.id}><select aria-label="Band item" value={band.itemId ?? ""} onChange={(event) => setWorking({ ...working, quantityBands: working.quantityBands.map((entry, index) => index === bandIndex ? { ...entry, itemId: event.target.value, categoryId: undefined } : entry) })}>{catalogueItems.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><input aria-label="From quantity" type="number" min="1" value={band.fromQuantity} onChange={(event) => setWorking({ ...working, quantityBands: working.quantityBands.map((entry, index) => index === bandIndex ? { ...entry, fromQuantity: Number(event.target.value) } : entry) })} /><input aria-label="To quantity" type="number" min={band.fromQuantity} value={band.toQuantity ?? ""} placeholder="No maximum" onChange={(event) => setWorking({ ...working, quantityBands: working.quantityBands.map((entry, index) => index === bandIndex ? { ...entry, toQuantity: event.target.value ? Number(event.target.value) : undefined } : entry) })} /><input aria-label="Unit price" type="number" min="0" step="0.01" value={band.unitPriceMinor / 100} onChange={(event) => setWorking({ ...working, quantityBands: working.quantityBands.map((entry, index) => index === bandIndex ? { ...entry, unitPriceMinor: money.minor(Math.round(Number(event.target.value) * 100)) } : entry) })} /><button aria-label={`Remove ${band.id}`} onClick={() => setWorking({ ...working, quantityBands: working.quantityBands.filter((_, index) => index !== bandIndex) })}>×</button></div> : (() => { const item = catalogueItems.find((entry) => entry.id === band.itemId); return <div className="rule-row" key={band.id}><span><strong>{item?.name ?? band.categoryId}</strong><small>{band.fromQuantity} to {band.toQuantity ?? "unbounded"} units</small></span><b>{formatMoney(band.unitPriceMinor)} / unit</b><span /></div>; })())}</section><section className="data-panel"><div className="panel-toolbar"><div><h2>Question modifiers</h2><p>Worked examples use a £1,000 sample subtotal.</p></div>{isDraft ? <button className="button secondary" onClick={() => { const question = working.questions?.[0]; const option = question?.options[0]; if (!question || !option) return; setWorking({ ...working, modifiers: [...working.modifiers, { id: `modifier-${working.modifiers.length + 1}`, name: "New modifier", scope: "all", triggerQuestionId: question.id, triggerValue: option.value, adjustmentKind: "percentage", adjustmentValue: 0, sequence: (working.modifiers.length + 1) * 10 }] }); }}>+ Add modifier</button> : <span className="rule-count">{working.modifiers.length} controls</span>}</div>{working.modifiers.map((modifier, index) => isDraft ? <div className="modifier-editor" key={modifier.id}><input aria-label="Modifier name" value={modifier.name} onChange={(event) => setWorking({ ...working, modifiers: working.modifiers.map((entry, itemIndex) => itemIndex === index ? { ...entry, name: event.target.value } : entry) })} /><select aria-label="Trigger question" value={modifier.triggerQuestionId} onChange={(event) => { const question = working.questions?.find((entry) => entry.id === event.target.value); setWorking({ ...working, modifiers: working.modifiers.map((entry, itemIndex) => itemIndex === index ? { ...entry, triggerQuestionId: event.target.value, triggerValue: question?.options[0]?.value ?? "" } : entry) }); }}>{(working.questions ?? []).map((question) => <option key={question.id} value={question.id}>{question.prompt}</option>)}</select><select aria-label="Trigger option" value={modifier.triggerValue} onChange={(event) => setWorking({ ...working, modifiers: working.modifiers.map((entry, itemIndex) => itemIndex === index ? { ...entry, triggerValue: event.target.value } : entry) })}>{working.questions?.find((question) => question.id === modifier.triggerQuestionId)?.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><label><span>Adjustment %</span><input type="number" step="0.1" value={modifier.adjustmentValue / 100} onChange={(event) => setWorking({ ...working, modifiers: working.modifiers.map((entry, itemIndex) => itemIndex === index ? { ...entry, adjustmentValue: Math.round(Number(event.target.value) * 100) } : entry) })} /></label><small>£1,000 → {formatMoney(100_000 + Math.round(100_000 * modifier.adjustmentValue / 10_000))}</small><button aria-label={`Remove ${modifier.name}`} onClick={() => setWorking({ ...working, modifiers: working.modifiers.filter((_, itemIndex) => itemIndex !== index) })}>×</button></div> : <div className="rule-row" key={modifier.id}><span className="sequence">{index + 1}</span><span><strong>{modifier.name}</strong><small>{modifier.triggerQuestionId} = {modifier.triggerValue}</small></span><b>+{modifier.adjustmentValue / 100}%</b><span /></div>)}</section></div>
      <section className="data-panel rule-test-panel"><div className="panel-toolbar"><div><h2>Live regression test</h2><p>Recalculates against the unsaved controls within 200 milliseconds.</p></div><span className="rule-count">Draft v{working.version}</span></div><div className="rule-test-controls"><label><span>Catalogue item</span><select value={testItemId} onChange={(event) => setTestItemId(event.target.value)}>{catalogueItems.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label><span>Quantity</span><input type="number" min="1" value={testQuantity} onChange={(event) => setTestQuantity(Number(event.target.value))} /></label>{(working.questions ?? []).map((question) => <label key={question.id}><span>{question.prompt}</span><select value={testAnswers[question.id] ?? ""} onChange={(event) => setTestAnswers((current) => ({ ...current, [question.id]: event.target.value }))}>{question.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>)}</div>{testErrors.length > 0 && <div className="error-panel"><strong>Test blocked</strong>{testErrors.map((error) => <span key={error}>{error}</span>)}</div>}{testQuote && <div className="test-result"><div><span>One-off</span><strong>{formatMoney(testQuote.oneOffSubtotalMinor)}</strong></div><div><span>Annualised recurring</span><strong>{formatMoney(testQuote.recurringAnnualisedMinor)}</strong></div><div><span>Margin</span><strong>{testQuote.marginBp === null ? "Incomplete" : `${testQuote.marginBp / 100}%`}</strong></div></div>}{testQuote?.lines[0] && <div className="test-trace">{testQuote.lines[0].trace.map((step) => <div key={`${step.label}-${step.beforeMinor}`}><span>{step.label}</span><b>{formatMoney(step.beforeMinor)} → {formatMoney(step.afterMinor)}</b></div>)}</div>}</section>
    </div>
  );
}

function ActivityScreen({ events }: { events: SavedEvent[] }) {
  const eventLabels: Record<SavedEvent["eventType"], string> = {
    "quote.saved": "Draft saved",
    "quote.ready": "Quote marked ready",
    "quote.issued": "Secure link issued",
    "quote.viewed": "Qualified recipient view",
    "quote.accepted": "Proposal accepted",
    "quote.declined": "Proposal declined",
    "quote.expired": "Proposal expired",
    "quote.superseded": "Quote superseded",
  };
  return (
    <div className="standard-page">
      <div className="page-heading"><div><p className="eyebrow">Recipient engagement</p><h1>Quote activity</h1><p className="page-subtitle">Qualified views exclude scanners, datacentre traffic and visits under three seconds.</p></div><a className="button secondary export-link" href="/api/export">Export workspace data</a></div>
      <div className="activity-layout"><section className="activity-hero"><p>Live quote engagement</p><h2>7 recipients are reviewing proposals</h2><div className="activity-bars"><span style={{ height: "22%" }} /><span style={{ height: "38%" }} /><span style={{ height: "31%" }} /><span style={{ height: "58%" }} /><span style={{ height: "47%" }} /><span style={{ height: "80%" }} /><span style={{ height: "68%" }} /><span style={{ height: "92%" }} /><span style={{ height: "75%" }} /><span style={{ height: "62%" }} /><span style={{ height: "86%" }} /><span style={{ height: "72%" }} /></div><div className="activity-axis"><span>4 Aug</span><span>15 Aug</span></div></section><section className="attention-panel"><p className="eyebrow">Attention signal</p><h2>Northstar Analytics</h2><p>Viewed QB-1048 three times. 4m 42s spent on pricing.</p><div><span>Introduction</span><b>1m 06s</b></div><div><span>Scope</span><b>2m 18s</b></div><div className="pricing-attention"><span>Pricing</span><b>4m 42s</b></div><button>Open activity detail →</button></section></div>
      <section className="data-panel timeline"><div className="panel-toolbar"><div><h2>Recent signals</h2><p>Durable audit events appear before illustrative engagement data</p></div></div>{events.map((event) => <div key={event.id}><span className={`timeline-mark ${event.eventType.split(".")[1]}`}>{event.eventType.split(".")[1].charAt(0).toUpperCase()}</span><p><strong>{eventLabels[event.eventType]} · {event.quoteReference}</strong><small>{event.actorEmail} · {new Date(`${event.createdAt.replace(" ", "T")}Z`).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</small></p><button>Audit record</button></div>)}<div><span className="timeline-mark viewed">V</span><p><strong>Maya Patel viewed QB-1048</strong><small>Northstar Analytics · 18 minutes ago · 7m 41s total dwell</small></p><button>View quote</button></div><div><span className="timeline-mark accepted">A</span><p><strong>Owen Lewis accepted QB-1046</strong><small>Meridian Works · 12 Aug 2026 · £31,680 one-off</small></p><button>View evidence</button></div><div><span className="timeline-mark sent">S</span><p><strong>QB-1047 delivered to two recipients</strong><small>Aperture Health · Yesterday · No qualified view yet</small></p><button>Open tracking</button></div></section>
    </div>
  );
}

export default function QuoteBench({ currentUser, operatorAccess = false, initialScreen = "builder", initialBuilderStep = "client" }: { currentUser: QuoteBenchUser | null; operatorAccess?: boolean; initialScreen?: Screen; initialBuilderStep?: BuilderStep }) {
  const [screen, setScreen] = useState<Screen>(initialScreen);
  const [activeReference, setActiveReference] = useState("QB-1049");
  const [activeQuote, setActiveQuote] = useState<EditableQuote | null>(null);
  const [savedQuotes, setSavedQuotes] = useState<SavedQuote[]>([]);
  const [savedEvents, setSavedEvents] = useState<SavedEvent[]>([]);
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [workspaceCatalogue, setWorkspaceCatalogue] = useState<CatalogueItem[]>(catalogue);
  const [catalogueCategories,setCatalogueCategories]=useState<ServiceCategory[]>(seedCatalogueCategories);
  const [proposalTypes,setProposalTypes]=useState<ProposalType[]>(seedProposalTypes);
  const [activeRuleSet, setActiveRuleSet] = useState<RuleSet>(defaultRuleSet);
  const [draftRuleSet, setDraftRuleSet] = useState<RuleSet | null>(null);
  const [entitlement, setEntitlement] = useState<Entitlement | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [quotesLoading, setQuotesLoading] = useState(Boolean(currentUser));
  const [storageMessage, setStorageMessage] = useState<string | null>(currentUser ? null : "Sign in to QuoteBench to load and save durable workspace quotes.");
  const [mobileNavigationOpen,setMobileNavigationOpen]=useState(false);
  const currentUserEmail = currentUser?.email;

  useEffect(() => {
    const url = new URL(window.location.href);
    if (screen === "builder") url.searchParams.delete("screen");
    else url.searchParams.set("screen", screen);
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  }, [screen]);

  function startNewQuote() {
    const references = [activeReference, ...seedQuotes.map((quote) => quote.reference), ...savedQuotes.map((quote) => quote.reference)];
    const nextNumber = Math.max(1048, ...references.map((reference) => Number(reference.match(/\d+$/)?.[0] ?? 0))) + 1;
    setActiveReference(`QB-${nextNumber}`);
    setActiveQuote(null);
    setScreen("builder");
  }

  async function openQuote(reference: string) {
    setStorageMessage(null);
    try {
      const response = await fetch(`/api/quotes/${encodeURIComponent(reference)}`, { cache: "no-store" });
      const payload = (await response.json()) as { quote?: EditableQuote; error?: string };
      if (!response.ok || !payload.quote) throw new Error(payload.error ?? "The quote could not be opened.");
      setActiveReference(payload.quote.reference);
      setActiveQuote(payload.quote);
      setScreen("builder");
    } catch (error) {
      setStorageMessage(error instanceof Error ? error.message : "The quote could not be opened.");
    }
  }

  function openRevision(quote: EditableQuote) {
    setActiveReference(quote.reference);
    setActiveQuote(quote);
    setScreen("builder");
    void refreshQuotes();
  }

  async function refreshQuotes() {
    if (!currentUserEmail) return;
    setQuotesLoading(true);
    try {
      const response = await fetch("/api/quotes", { cache: "no-store" });
      const payload = (await response.json()) as { quotes?: SavedQuote[]; events?: SavedEvent[]; entitlement?: Entitlement; catalogue?: CatalogueItem[]; catalogueCategories?:ServiceCategory[];proposalTypes?:ProposalType[]; ruleSet?: RuleSet; draftRuleSet?: RuleSet | null; clients?: ClientRecord[]; workspace?:Workspace; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Saved quotes are unavailable.");
      setSavedQuotes(payload.quotes ?? []);
      setSavedEvents(payload.events ?? []);
      setEntitlement(payload.entitlement ?? null);
      setWorkspaceCatalogue(payload.catalogue ?? catalogue);
      setCatalogueCategories(payload.catalogueCategories??seedCatalogueCategories);
      setProposalTypes(payload.proposalTypes??seedProposalTypes);
      setActiveRuleSet(payload.ruleSet ?? defaultRuleSet);
      setDraftRuleSet(payload.draftRuleSet ?? null);
      setClients(payload.clients ?? []);
      setWorkspace(payload.workspace??null);
      setStorageMessage(null);
    } catch (error) {
      setStorageMessage(error instanceof Error ? error.message : "Saved quotes are unavailable.");
    } finally {
      setQuotesLoading(false);
    }
  }

  useEffect(() => {
    if (!currentUserEmail) return;
    let active = true;
    fetch("/api/quotes", { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json()) as { quotes?: SavedQuote[]; events?: SavedEvent[]; entitlement?: Entitlement; catalogue?: CatalogueItem[]; catalogueCategories?:ServiceCategory[];proposalTypes?:ProposalType[]; ruleSet?: RuleSet; draftRuleSet?: RuleSet | null; clients?: ClientRecord[]; workspace?:Workspace; error?: string };
        if (!response.ok) throw new Error(payload.error ?? "Saved quotes are unavailable.");
        return { quotes: payload.quotes ?? [], events: payload.events ?? [], entitlement: payload.entitlement ?? null, catalogueItems: payload.catalogue ?? catalogue, nextCategories:payload.catalogueCategories??seedCatalogueCategories,nextProposalTypes:payload.proposalTypes??seedProposalTypes, nextRuleSet: payload.ruleSet ?? defaultRuleSet, nextDraftRuleSet: payload.draftRuleSet ?? null, clientRecords: payload.clients ?? [], nextWorkspace: payload.workspace??null };
      })
      .then(({ quotes, events, entitlement: nextEntitlement, catalogueItems, nextCategories,nextProposalTypes,nextRuleSet, nextDraftRuleSet, clientRecords, nextWorkspace }) => {
        if (active) {
          setSavedQuotes(quotes);
          setSavedEvents(events);
          setEntitlement(nextEntitlement);
          setWorkspaceCatalogue(catalogueItems);
          setCatalogueCategories(nextCategories);
          setProposalTypes(nextProposalTypes);
          setActiveRuleSet(nextRuleSet);
          setDraftRuleSet(nextDraftRuleSet);
          setClients(clientRecords);
          setWorkspace(nextWorkspace);
          setStorageMessage(null);
        }
      })
      .catch((error: unknown) => {
        if (active) setStorageMessage(error instanceof Error ? error.message : "Saved quotes are unavailable.");
      })
      .finally(() => {
        if (active) setQuotesLoading(false);
      });
    return () => {
      active = false;
    };
  }, [currentUserEmail]);

  useEffect(()=>{if(!currentUserEmail)return;fetch("/api/workspaces",{cache:"no-store"}).then(async response=>(await response.json()) as {workspaces?:Array<Record<string,unknown>>}).then(payload=>setWorkspaces((payload.workspaces??[]).map(row=>({id:String(row.id),name:String(row.name),currency:String(row.currency),role:String(row.role) as Workspace["role"]})))).catch(()=>undefined);},[currentUserEmail]);

  return (
    <div className={`app-shell ${mobileNavigationOpen ? "navigation-open" : ""}`}>
      <Sidebar screen={screen} setScreen={setScreen} currentUser={currentUser} entitlement={entitlement} mobileOpen={mobileNavigationOpen} onClose={()=>setMobileNavigationOpen(false)} operatorAccess={operatorAccess} />
      {mobileNavigationOpen&&<button className="navigation-backdrop" aria-label="Close navigation" onClick={()=>setMobileNavigationOpen(false)}/>}
      <div className="main-shell">
        <Topbar screen={screen} workspace={workspace} workspaces={workspaces.length?workspaces:workspace?[workspace]:[]} onOpenNavigation={()=>setMobileNavigationOpen(true)} />
        <main className="main-content">
          {screen === "builder" && <QuoteBuilder key={activeReference} reference={activeReference} initialQuote={activeQuote} clients={clients} catalogueItems={workspaceCatalogue} catalogueCategories={catalogueCategories} proposalTypes={proposalTypes} ruleSet={activeRuleSet} onSaved={refreshQuotes} onRevised={openRevision} initialStep={initialBuilderStep} />}
          {screen === "quotes" && <QuotesScreen onCreate={startNewQuote} onOpen={openQuote} savedQuotes={savedQuotes} loading={quotesLoading} storageMessage={storageMessage} />}
          {screen === "clients" && <ClientsScreen clients={clients} onSaved={(client) => setClients((current) => [...current.filter((entry) => entry.id !== client.id), client].sort((a, b) => a.name.localeCompare(b.name)))} />}
          {screen === "catalogue" && <CatalogueScreen catalogueItems={workspaceCatalogue} categories={catalogueCategories} proposalTypes={proposalTypes} onRefresh={refreshQuotes} />}
          {screen === "rules" && <RulesScreen published={activeRuleSet} draft={draftRuleSet} catalogueItems={workspaceCatalogue} onChanged={(published, draft) => { setActiveRuleSet(published); setDraftRuleSet(draft); }} />}
          {screen === "activity" && <ActivityScreen events={savedEvents} />}
          {screen === "integrations" && <IntegrationsScreen onImported={refreshQuotes} />}
          {screen === "team" && <TeamScreen />}
          {screen === "usage" && <UsageScreen />}
          {screen === "documents" && <DocumentsScreen />}
          {screen === "delivery" && <DeliveryScreen quotes={savedQuotes} onSent={refreshQuotes} />}
          {screen === "templates" && <WorkspaceErrorBoundary title="The template editor stopped responding" description="Your saved templates remain unchanged. Retry the editor or reload this workspace without returning to the home screen." recoveryPath="/?screen=templates"><Suspense fallback={<div className="proposal-editor-loading"><span/><strong>Loading template workspace</strong><p>Preparing standard templates and the visual editor.</p></div>}><TemplatesScreen onProvisioned={refreshQuotes} startQuote={startNewQuote} /></Suspense></WorkspaceErrorBoundary>}
          {screen === "engagement" && <EngagementScreen proposalTypes={proposalTypes} />}
          {screen === "ai" && <AiAssistanceScreen />}
          {screen === "billing" && <BillingScreen />}
          {screen === "governance" && <GovernanceScreen />}
        </main>
      </div>
    </div>
  );
}

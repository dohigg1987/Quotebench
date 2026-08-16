import { notFound } from "next/navigation";
import { getPublicQuote, type PublicQuote } from "../../../db/quote-store";
import AcceptanceForm from "./acceptance-form";
import ViewTracker from "./view-tracker";
import { listQuoteFiles } from "../../../db/document-store";
import type { DocumentBlock } from "../../../db/document-store";
import type { CSSProperties } from "react";
/* Proposal images are tenant-controlled R2 objects and preserve authored dimensions. */
/* eslint-disable @next/next/no-img-element */

export const dynamic = "force-dynamic";

const frequencyLabels: Record<string, string> = {
  weekly: "Weekly",
  fortnightly: "Fortnightly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  annually: "Annually",
};

function formatMoney(value: number, currency = "GBP") {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(value / 100);
}

function ProposalBlock({block,quote,recurring}:{block:DocumentBlock;quote:PublicQuote;recurring:Array<[string,number]>}){
  if(block.enabled===false)return null;const classes=`recipient-content-block align-${block.alignment??"left"} layout-${block.layout??"full"}`;const heading=<>{block.eyebrow&&<p className="eyebrow">{block.eyebrow}</p>}{block.title&&<h2>{block.title}</h2>}</>;
  if(block.type==="spacer")return <div className="recipient-spacer"/>;
  if(block.type==="pricing_table")return <div className={classes}>{heading}{block.display!=="totals"&&<section className="recipient-scope service-schedule-scope">{quote.pricingSnapshot.lines.map(line=><div className="proposal-service-line" key={line.lineId}><div><span><strong>{line.itemName}</strong><small>{line.quantity} {line.unitLabel}{line.quantity===1?"":"s"}</small></span><strong>{formatMoney(line.finalPriceMinor,quote.currency)}</strong></div>{(line.description||line.serviceSchedule||line.serviceTerms)&&<section>{line.description&&<p>{line.description}</p>}{line.serviceSchedule&&<div><strong>Service schedule</strong><p>{line.serviceSchedule}</p></div>}{line.serviceTerms&&<div><strong>Service terms</strong><p>{line.serviceTerms}</p></div>}</section>}</div>)}</section>}{block.display!=="lines"&&<section className="recipient-totals"><div><small>ONE-OFF INVESTMENT</small><strong>{formatMoney(quote.oneOffTotalMinor,quote.currency)}</strong></div>{recurring.map(([frequency,amount])=><div key={frequency}><small>{(frequencyLabels[frequency]??frequency).toUpperCase()} RECURRING</small><strong>{formatMoney(amount,quote.currency)}</strong></div>)}</section>}</div>;
  if(["feature_grid","timeline","team","faq"].includes(block.type))return <div className={classes} style={{"--columns":String(block.columns??(block.layout==="compact"?2:3))} as CSSProperties}>{heading}<div className="recipient-items">{(block.items??[]).map(item=><div key={item.id}><strong>{item.title}</strong><p>{item.content}</p></div>)}</div></div>;
  if(block.type==="image")return <div className={classes}>{heading}{block.fileId&&<img className="recipient-media" src={`/api/files/${block.fileId}?public=1`} alt={block.title??"Proposal image"}/>}</div>;
  if(block.type==="video")return <div className={classes}>{heading}{block.content&&<p>{block.content}</p>}{block.mediaUrl?.startsWith("https://")&&<a className="recipient-video" href={block.mediaUrl} target="_blank" rel="noreferrer">Watch video</a>}</div>;
  if(block.type==="options")return <div className={classes}>{heading}<div className="recipient-items">{(quote.document.options??[]).map(option=><div key={option.id}><strong>{option.label}</strong><p>Select this option in the formal decision section.</p></div>)}</div></div>;
  if(block.type==="signature")return <div className={classes}>{heading}<p>{block.content??"The formal decision controls appear below and preserve an immutable evidence record."}</p></div>;
  return <div className={`${classes} ${block.type==="callout"?"recipient-callout":""}`}>{heading}{block.content&&<p>{block.content}</p>}</div>;
}

export default async function RecipientQuotePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const quote = await getPublicQuote(token);
  if (!quote) notFound();
  const attachments = await listQuoteFiles(quote.tenantId, quote.reference);
  const recurring = Object.entries(quote.pricingSnapshot.recurringByFrequency)
    .filter(([frequency, amount]) => frequency !== "one_off" && amount > 0);
  const document = {
    title: quote.document.title || "Transformation delivery partnership",
    introduction: quote.document.introduction || "This proposal combines focused strategy, delivery capacity and an ongoing advisory relationship.",
    scopeHeading: quote.document.scopeHeading || "A practical route to measurable change",
    brandName: quote.document.brandName || "Finance Advisory Partners",
    brandInitials: quote.document.brandInitials || "FAP",
  };

  return (
    <main className="recipient-shell">
      {["Issued", "Viewed"].includes(quote.status) && <ViewTracker token={token} />}
      <article className="recipient-document">
        <header className="recipient-cover" data-track-section="cover">
          <span className="client-logo">{document.brandInitials}</span>
          <div><small>PROPOSAL {quote.reference}</small><h1>{document.title}</h1><p>Prepared for {quote.clientName}</p></div>
        </header>
        {quote.document.pages?.length?quote.document.pages.map((page,index)=><section key={page.id} className={`recipient-page page-${page.format} background-${page.background}`} data-track-section={`page-${index+1}`}>{page.blocks.map(block=><ProposalBlock key={block.id} block={block} quote={quote} recurring={recurring}/>)}</section>):<><section className="recipient-intro" data-track-section="introduction"><p className="eyebrow">Our proposal</p><h2>Clarity from scope to commitment.</h2><p>{document.introduction}</p></section><section className="recipient-scope" data-track-section="scope"><p className="eyebrow">Scope and investment</p><h2>{document.scopeHeading}</h2>{quote.pricingSnapshot.lines.map((line) => <div key={line.lineId}><span><strong>{line.itemName}</strong><small>{line.quantity} {line.unitLabel}{line.quantity === 1 ? "" : "s"}</small></span><strong>{formatMoney(line.finalPriceMinor, quote.currency)}</strong></div>)}</section><section className="recipient-totals" data-track-section="pricing"><div><small>ONE-OFF INVESTMENT</small><strong>{formatMoney(quote.oneOffTotalMinor, quote.currency)}</strong></div>{recurring.map(([frequency, amount]) => <div key={frequency}><small>{(frequencyLabels[frequency] ?? frequency).toUpperCase()} RECURRING</small><strong>{formatMoney(amount, quote.currency)}</strong></div>)}</section></>}
        {attachments.length > 0 && <section className="recipient-attachments"><p className="eyebrow">Supporting files</p><h2>Documents included with this proposal</h2>{attachments.map((file) => <a key={file.id} href={`/api/files/${file.id}?public=1`}><span>{file.kind === "pdf" ? "PDF" : "FILE"}</span><strong>{file.filename}</strong><small>{Math.ceil(file.sizeBytes / 1024)} KB</small></a>)}<p>File download is recorded as a server event only. Activity inside a downloaded document is not tracked.</p></section>}
        <section className="recipient-accept" data-track-section="decision"><div><p className="eyebrow">Formal decision</p><h2>{quote.status === "Accepted" ? "Proposal authorised" : quote.status === "Declined" ? "Decision recorded" : quote.status === "Expired" ? "Validity period ended" : quote.status === "Superseded" ? "Proposal replaced" : "Authorise the proposal"}</h2><p>Acceptance records the signatory, timestamp, quote reference and governing rule-set version.</p></div><AcceptanceForm token={token} status={quote.status as "Issued" | "Viewed" | "Accepted" | "Declined" | "Expired" | "Superseded"} acceptedBy={quote.acceptedBy} declineReason={quote.declineReason} supersededBy={quote.supersededBy} options={quote.document.options} depositMinor={quote.document.depositMinor} currency={quote.currency} /></section>
        <section className="recipient-privacy"><p className="eyebrow">Privacy and engagement data</p><p>QuoteBench records qualified page views, section visibility and formal decisions for legitimate commercial administration. It does not retain full IP addresses. Downloaded files are not tracked after download.</p></section>
        <footer><span>{document.brandName}</span><span>Valid until {new Date(`${quote.validUntil}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</span><span>Secure proposal · {quote.reference}</span></footer>
      </article>
    </main>
  );
}

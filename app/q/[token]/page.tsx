import { notFound } from "next/navigation";
import { getPublicQuote, type PublicQuote } from "../../../db/quote-store";
import AcceptanceForm from "./acceptance-form";
import ViewTracker from "./view-tracker";
import { listQuoteFiles } from "../../../db/document-store";
import type { DocumentBlock } from "../../../db/document-store";
import type { CSSProperties } from "react";
import { resolveProposalText, type ProposalMetadata } from "../../../lib/proposal-metadata";
import { formatDate, formatMoney as formatMarketMoney, localeForCurrency } from "../../../lib/market";
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
  return formatMarketMoney(value,currency,localeForCurrency(currency));
}

function ProposalBlock({block,quote,recurring}:{block:DocumentBlock;quote:PublicQuote;recurring:Array<[string,number]>}){
  const locale=quote.document.market?.locale??localeForCurrency(quote.currency);const timezone=quote.document.market?.timezone??(quote.currency==="USD"?"America/New_York":"Europe/London");const metadata:ProposalMetadata={clientName:quote.clientName,contactName:quote.contactName,contactEmail:quote.contactEmail??"",quoteReference:quote.reference,proposalTitle:quote.document.title,validUntil:formatDate(quote.validUntil,locale,timezone),currency:quote.currency,brandName:quote.document.brandName};
  if(block.enabled===false)return null;const classes=`recipient-content-block align-${block.alignment??"left"} layout-${block.layout??"full"}`;const heading=<>{block.eyebrow&&<p className="eyebrow">{resolveProposalText(block.eyebrow,metadata)}</p>}{block.title&&<h2>{resolveProposalText(block.title,metadata)}</h2>}</>;
  if(block.type==="spacer")return <div className="recipient-spacer"/>;
  if(block.type==="pricing_table")return <div className={classes}>{heading}{block.display!=="totals"&&<section className="recipient-scope service-schedule-scope">{quote.pricingSnapshot.lines.map(line=><div className="proposal-service-line" key={line.lineId}><div><span><strong>{line.itemName}</strong><small>{line.quantity} {line.unitLabel}{line.quantity===1?"":"s"}</small></span><strong>{formatMoney(line.finalPriceMinor,quote.currency)}</strong></div>{(line.description||line.serviceSchedule||line.serviceTerms)&&<section>{line.description&&<p>{line.description}</p>}{line.serviceSchedule&&<div><strong>Service schedule</strong><p>{line.serviceSchedule}</p></div>}{line.serviceTerms&&<div><strong>Service terms</strong><p>{line.serviceTerms}</p></div>}</section>}</div>)}</section>}{block.display!=="lines"&&<section className="recipient-totals"><div><small>ONE-OFF INVESTMENT</small><strong>{formatMoney(quote.oneOffTotalMinor,quote.currency)}</strong></div>{recurring.map(([frequency,amount])=><div key={frequency}><small>{(frequencyLabels[frequency]??frequency).toUpperCase()} RECURRING</small><strong>{formatMoney(amount,quote.currency)}</strong></div>)}</section>}</div>;
  if(["feature_grid","timeline","team","faq"].includes(block.type))return <div className={classes} style={{"--columns":String(block.columns??(block.layout==="compact"?2:3))} as CSSProperties}>{heading}<div className="recipient-items">{(block.items??[]).map(item=><div key={item.id}><strong>{resolveProposalText(item.title,metadata)}</strong><p>{resolveProposalText(item.content,metadata)}</p></div>)}</div></div>;
  if(block.type==="image")return <div className={classes}>{heading}{block.fileId&&<img className="recipient-media" src={`/api/files/${block.fileId}?public=1`} alt={resolveProposalText(block.title,metadata)??"Proposal image"}/>}</div>;
  if(block.type==="video")return <div className={classes}>{heading}{block.content&&<p>{resolveProposalText(block.content,metadata)}</p>}{block.mediaUrl?.startsWith("https://")&&<a className="recipient-video" href={block.mediaUrl} target="_blank" rel="noreferrer">Watch video</a>}</div>;
  if(block.type==="options")return <div className={classes}>{heading}<div className="recipient-items">{(quote.document.options??[]).map(option=><div key={option.id}><strong>{option.label}</strong><p>Select this option in the formal decision section.</p></div>)}</div></div>;
  if(block.type==="signature")return <div className={classes}>{heading}<p>{resolveProposalText(block.content,metadata)??"The formal decision controls appear below and preserve an immutable evidence record."}</p></div>;
  return <div className={`${classes} ${block.type==="callout"?"recipient-callout":""}`}>{heading}{block.content&&<p>{resolveProposalText(block.content,metadata)}</p>}</div>;
}

export default async function RecipientQuotePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const quote = await getPublicQuote(token);
  if (!quote) notFound();
  const attachments = await listQuoteFiles(quote.tenantId, quote.reference);
  const recurring = Object.entries(quote.pricingSnapshot.recurringByFrequency)
    .filter(([frequency, amount]) => frequency !== "one_off" && amount > 0);
  const taxOneOff=quote.pricingSnapshot.taxOneOffTotalMinor??quote.pricingSnapshot.lines.reduce((sum,line)=>sum+(line.taxMinor??0),0);
  const taxComponents=quote.pricingSnapshot.lines.flatMap(line=>line.taxComponents??[]).reduce<Array<{key:string;label:string;rateBp:number;taxMinor:number}>>((items,component)=>{const key=`${component.jurisdictionCode}:${component.label}:${component.rateBp}`;const existing=items.find(item=>item.key===key);if(existing)existing.taxMinor+=component.taxMinor;else items.push({key,label:component.label,rateBp:component.rateBp,taxMinor:component.taxMinor});return items;},[]);
  const document = {
    title: quote.document.title || "Transformation delivery partnership",
    introduction: quote.document.introduction || "This proposal combines focused strategy, delivery capacity and an ongoing advisory relationship.",
    scopeHeading: quote.document.scopeHeading || "A practical route to measurable change",
    brandName: quote.document.brandName || "Commercial proposal",
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
        {taxOneOff>0&&<section className="recipient-tax-summary" data-track-section="tax"><div><p className="eyebrow">Tax breakdown</p><h2>Transparent jurisdiction treatment</h2><p>Net {formatMoney(quote.oneOffTotalMinor,quote.currency)} · tax {formatMoney(taxOneOff,quote.currency)} · gross {formatMoney(quote.pricingSnapshot.grossOneOffTotalMinor??quote.oneOffTotalMinor+taxOneOff,quote.currency)}</p></div><dl>{taxComponents.map(component=><div key={component.key}><dt>{component.label}<small>{(component.rateBp/100).toFixed(3).replace(/0+$/,"").replace(/\.$/,"")}%</small></dt><dd>{formatMoney(component.taxMinor,quote.currency)}</dd></div>)}</dl></section>}
        {attachments.length > 0 && <section className="recipient-attachments"><p className="eyebrow">Supporting files</p><h2>Documents included with this proposal</h2>{attachments.map((file) => <a key={file.id} href={`/api/files/${file.id}?public=1`}><span>{file.kind === "pdf" ? "PDF" : "FILE"}</span><strong>{file.filename}</strong><small>{Math.ceil(file.sizeBytes / 1024)} KB</small></a>)}<p>File download is recorded as a server event only. Activity inside a downloaded document is not tracked.</p></section>}
        {(quote.document.legalContent?.length ?? 0) > 0 && <section className="recipient-legal" data-track-section="legal-content"><p className="eyebrow">Engagement terms</p><h2>Documents governing this engagement</h2>{quote.document.legalContent?.map((item) => <details key={item.id} open={item.kind === "engagement_letter"}><summary><span><strong>{item.name}</strong><small>{item.jurisdiction} · version {item.version}{item.mandatory ? " · Mandatory" : ""}</small></span><span>View</span></summary><div className="legal-content-body">{item.content.split(/\n{2,}/).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div></details>)}</section>}
        <section className="recipient-accept" data-track-section="decision"><div><p className="eyebrow">Formal decision</p><h2>{quote.status === "Accepted" ? "Proposal authorised" : quote.status === "Declined" ? "Decision recorded" : quote.status === "Expired" ? "Validity period ended" : quote.status === "Superseded" ? "Proposal replaced" : "Authorise the proposal"}</h2><p>{quote.recipientRole ? `${quote.recipientRole} · signing order ${quote.signingOrder ?? 1}. ` : ""}Acceptance records the signatory, timestamp, quote reference and governing rule-set version.</p></div><AcceptanceForm token={token} status={quote.status as "Issued" | "Viewed" | "Accepted" | "Declined" | "Expired" | "Superseded"} acceptedBy={quote.acceptedBy} declineReason={quote.declineReason} supersededBy={quote.supersededBy} options={quote.document.options} depositMinor={quote.document.depositMinor} currency={quote.currency} recipientSignedAt={quote.recipientSignedAt} recipientRole={quote.recipientRole} signingOrder={quote.signingOrder} /></section>
        <section className="recipient-privacy"><p className="eyebrow">Privacy and engagement data</p><p>QuoteBench records qualified page views, section visibility and formal decisions for legitimate commercial administration. It does not retain full IP addresses. Downloaded files are not tracked after download.</p></section>
        <footer><span>{document.brandName}</span><span>Valid until {formatDate(quote.validUntil,quote.document.market?.locale??localeForCurrency(quote.currency),quote.document.market?.timezone??(quote.currency==="USD"?"America/New_York":"Europe/London"))}</span><span>Secure proposal · {quote.reference}</span></footer>
      </article>
    </main>
  );
}


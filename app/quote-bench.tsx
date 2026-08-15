"use client";

import { useEffect, useMemo, useState } from "react";
import {
  money,
  price,
  type Frequency,
  type PricedQuote,
} from "../packages/pricing-engine/src/index";
import { catalogue, defaultRuleSet, seedQuotes } from "./demo-data";

type Screen = "builder" | "quotes" | "catalogue" | "rules" | "activity";
type SelectedLine = { itemId: string; quantity: number; discount: number };

const labels: Record<Frequency, string> = {
  one_off: "One-off",
  weekly: "Weekly",
  fortnightly: "Fortnightly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  annually: "Annually",
};

function formatMoney(value: number, currency = "GBP") {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    minimumFractionDigits: value % 100 === 0 ? 0 : 2,
  }).format(value / 100);
}

function Status({ children }: { children: string }) {
  return <span className={`status status-${children.toLowerCase()}`}>{children}</span>;
}

function Sidebar({ screen, setScreen }: { screen: Screen; setScreen: (screen: Screen) => void }) {
  const navigation: Array<{ key: Screen; label: string; mark: string }> = [
    { key: "builder", label: "Quote builder", mark: "+" },
    { key: "quotes", label: "Quotes", mark: "Q" },
    { key: "catalogue", label: "Catalogue", mark: "C" },
    { key: "rules", label: "Pricing rules", mark: "R" },
    { key: "activity", label: "Activity", mark: "A" },
  ];
  return (
    <aside className="sidebar">
      <button className="brand" onClick={() => setScreen("builder")} aria-label="QuoteBench home">
        <span className="brand-mark">Q</span>
        <span>QuoteBench</span>
      </button>
      <nav className="nav" aria-label="Primary navigation">
        <p className="nav-label">Workspace</p>
        {navigation.map((item) => (
          <button
            key={item.key}
            onClick={() => setScreen(item.key)}
            className={screen === item.key ? "nav-item active" : "nav-item"}
          >
            <span className="nav-mark" aria-hidden="true">{item.mark}</span>
            {item.label}
          </button>
        ))}
      </nav>
      <div className="sidebar-foot">
        <div className="usage-bar"><span /></div>
        <p><strong>14</strong> of 50 quotes this month</p>
        <button className="workspace-person">
          <span className="avatar">DO</span>
          <span><strong>Dennis O&apos;Higgins</strong><small>Owner</small></span>
          <span aria-hidden="true">⋯</span>
        </button>
      </div>
    </aside>
  );
}

function Topbar() {
  return (
    <header className="topbar">
      <button className="workspace-switcher">
        <span className="workspace-dot">F</span>
        Finance Advisory Partners
        <span aria-hidden="true">⌄</span>
      </button>
      <div className="top-actions">
        <button className="top-icon" aria-label="Search">⌕</button>
        <button className="top-icon notification" aria-label="Notifications">○</button>
        <button className="help-link">Help</button>
      </div>
    </header>
  );
}

function QuoteBuilder() {
  const [clientName, setClientName] = useState("Stellar Grid Ltd");
  const [lines, setLines] = useState<SelectedLine[]>([
    { itemId: "strategy-workshop", quantity: 3, discount: 0 },
    { itemId: "advisory-retainer", quantity: 1, discount: 0 },
    { itemId: "platform-licence", quantity: 25, discount: 0 },
  ]);
  const [complexity, setComplexity] = useState("standard");
  const [turnaround, setTurnaround] = useState("standard");
  const [quoteDiscount, setQuoteDiscount] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [explainLine, setExplainLine] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (preview) window.scrollTo({ top: 0, behavior: "auto" });
  }, [preview]);

  const result = useMemo(() => {
    const requestLines = lines.flatMap((line) => {
      const item = catalogue.find((candidate) => candidate.id === line.itemId);
      if (!item) return [];
      return [{
        lineId: line.itemId,
        item,
        quantity: line.quantity,
        discountBp: money.bp(line.discount * 100),
      }];
    });
    return price({
      ruleSet: defaultRuleSet,
      currency: "GBP",
      role: "owner",
      answers: { complexity, turnaround },
      lines: requestLines,
      quoteDiscountBp: money.bp(quoteDiscount * 100),
      trace: true,
    });
  }, [complexity, lines, quoteDiscount, turnaround]);

  const priced = result.ok ? result.quote : null;

  function updateQuantity(itemId: string, value: number) {
    setLines((current) => current.map((line) => line.itemId === itemId ? { ...line, quantity: value } : line));
  }

  function toggleItem(itemId: string) {
    setLines((current) =>
      current.some((line) => line.itemId === itemId)
        ? current.filter((line) => line.itemId !== itemId)
        : [...current, { itemId, quantity: catalogue.find((item) => item.id === itemId)?.minQuantity ?? 1, discount: 0 }],
    );
  }

  if (preview && priced) {
    return <QuotePreview quote={priced} clientName={clientName} onBack={() => setPreview(false)} />;
  }

  return (
    <div className="builder-page">
      <div className="page-heading builder-heading">
        <div>
          <p className="eyebrow">Quotes / QB-1049</p>
          <div className="title-row"><h1>Build quote</h1><Status>Draft</Status></div>
        </div>
        <div className="heading-actions">
          <button className="button secondary" onClick={() => setNotice("Draft saved securely")}>Save draft</button>
          <button className="button secondary" onClick={() => priced && setPreview(true)} disabled={!priced}>Preview</button>
          <button
            className="button primary"
            disabled={!priced || lines.length === 0}
            onClick={() => setNotice("Quote ready. Delivery integration is the next governed release.")}
          >
            Review and send
          </button>
        </div>
      </div>

      {notice && <div className="notice" role="status"><span>✓</span>{notice}<button onClick={() => setNotice(null)}>×</button></div>}

      <div className="builder-grid">
        <div className="builder-workspace">
          <section className="section-block client-block">
            <div className="section-number">01</div>
            <div className="section-content">
              <div className="section-title-row">
                <div><h2>Client and validity</h2><p>Identify the recipient and the commercial window.</p></div>
                <span className="complete-mark">Complete</span>
              </div>
              <div className="field-grid">
                <label><span>Client</span><input value={clientName} onChange={(event) => setClientName(event.target.value)} /></label>
                <label><span>Contact</span><input defaultValue="Maya Patel" /></label>
                <label><span>Valid until</span><input type="date" defaultValue="2026-09-14" /></label>
              </div>
            </div>
          </section>

          <section className="section-block">
            <div className="section-number">02</div>
            <div className="section-content">
              <div className="section-title-row">
                <div><h2>Services and products</h2><p>Select from the governed catalogue. Prices calculate automatically.</p></div>
                <button className="text-button" onClick={() => setPickerOpen((open) => !open)}>+ Add item</button>
              </div>

              {pickerOpen && (
                <div className="item-picker">
                  <div><strong>Add from catalogue</strong><button onClick={() => setPickerOpen(false)}>×</button></div>
                  {catalogue.map((item) => (
                    <label key={item.id}>
                      <input type="checkbox" checked={lines.some((line) => line.itemId === item.id)} onChange={() => toggleItem(item.id)} />
                      <span><strong>{item.name}</strong><small>{item.pricingBasis.replace("_", " ")} · {labels[item.recurrence]}</small></span>
                      <b>{item.basePriceMinor ? formatMoney(item.basePriceMinor) : "Cost plus"}</b>
                    </label>
                  ))}
                </div>
              )}

              <div className="line-table" role="table" aria-label="Quote lines">
                <div className="line-row line-header" role="row">
                  <span>Item</span><span>Quantity</span><span>Unit price</span><span>Margin</span><span>Total</span><span />
                </div>
                {lines.map((selected) => {
                  const item = catalogue.find((candidate) => candidate.id === selected.itemId);
                  const line = priced?.lines.find((candidate) => candidate.lineId === selected.itemId);
                  if (!item) return null;
                  return (
                    <div className="line-group" key={selected.itemId}>
                      <div className="line-row" role="row">
                        <span className="item-cell"><span className="item-glyph">{item.name.charAt(0)}</span><span><strong>{item.name}</strong><small>{item.unitLabel} · {labels[item.recurrence]}</small></span></span>
                        <span><input className="quantity-input" aria-label={`${item.name} quantity`} type="number" min={item.minQuantity ?? 1} max={item.maxQuantity} value={selected.quantity} onChange={(event) => updateQuantity(item.id, Number(event.target.value))} /></span>
                        <span>{line ? formatMoney(line.effectiveUnitPriceMinor) : "—"}</span>
                        <span className={line?.marginBp !== null && line?.marginBp !== undefined && line.marginBp < 3500 ? "margin-low" : "margin-good"}>{line?.marginBp === null || line?.marginBp === undefined ? "Unknown" : `${(line.marginBp / 100).toFixed(1)}%`}</span>
                        <span className="line-total">{line ? formatMoney(line.finalPriceMinor) : "—"}</span>
                        <span className="line-actions"><button aria-label={`Explain ${item.name}`} onClick={() => setExplainLine(explainLine === item.id ? null : item.id)}>⌄</button><button aria-label={`Remove ${item.name}`} onClick={() => toggleItem(item.id)}>×</button></span>
                      </div>
                      {explainLine === item.id && line && (
                        <div className="explanation">
                          <p><strong>Calculation trace</strong><span>Rule set v{defaultRuleSet.version}</span></p>
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
              <div className="section-title-row"><div><h2>Pricing context</h2><p>Answers activate published pricing modifiers.</p></div><span className="rule-version">Rule set v7</span></div>
              <div className="question-grid">
                <fieldset>
                  <legend>Delivery complexity</legend>
                  <p>Reflects stakeholder and implementation complexity.</p>
                  <label><input type="radio" name="complexity" checked={complexity === "standard"} onChange={() => setComplexity("standard")} /><span>Standard</span><small>No adjustment</small></label>
                  <label><input type="radio" name="complexity" checked={complexity === "high"} onChange={() => setComplexity("high")} /><span>High</span><small>+20%</small></label>
                </fieldset>
                <fieldset>
                  <legend>Turnaround</legend>
                  <p>Priority mobilisation compounds after complexity.</p>
                  <label><input type="radio" name="turnaround" checked={turnaround === "standard"} onChange={() => setTurnaround("standard")} /><span>Standard</span><small>No adjustment</small></label>
                  <label><input type="radio" name="turnaround" checked={turnaround === "priority"} onChange={() => setTurnaround("priority")} /><span>Priority</span><small>+15%</small></label>
                </fieldset>
              </div>
            </div>
          </section>
        </div>

        <QuoteSummary
          quote={priced}
          errors={result.ok ? [] : result.errors.map((error) => error.code)}
          discount={quoteDiscount}
          setDiscount={setQuoteDiscount}
          onPreview={() => priced && setPreview(true)}
        />
      </div>
    </div>
  );
}

function QuoteSummary({ quote, errors, discount, setDiscount, onPreview }: { quote: PricedQuote | null; errors: string[]; discount: number; setDiscount: (value: number) => void; onPreview: () => void }) {
  const recurring = quote
    ? (Object.entries(quote.recurringByFrequency) as Array<[Frequency, number]>).filter(([frequency, amount]) => frequency !== "one_off" && amount > 0)
    : [];
  return (
    <aside className="quote-summary">
      <div className="summary-kicker"><span>Live calculation</span><b>Engine verified</b></div>
      <h2>Quote summary</h2>
      <p className="summary-reference">QB-1049 · Rule set version 7</p>

      {errors.length > 0 && <div className="error-panel"><strong>Pricing blocked</strong>{errors.map((error) => <span key={error}>{error.replace("pricing.", "").replaceAll("_", " ")}</span>)}</div>}

      <div className="summary-lines">
        {quote?.lines.map((line) => (
          <div key={line.lineId}><span>{line.itemName}<small>{line.quantity} × {line.unitLabel}</small></span><strong>{formatMoney(line.finalPriceMinor)}</strong></div>
        ))}
      </div>

      <label className="discount-control">
        <span><strong>Quote discount</strong><b>{discount}%</b></span>
        <input type="range" min="0" max="20" step="1" value={discount} onChange={(event) => setDiscount(Number(event.target.value))} />
        <small>Owner authority: up to 20%</small>
      </label>

      <div className="totals">
        <div><span>One-off total</span><strong>{quote ? formatMoney(quote.oneOffSubtotalMinor) : "—"}</strong></div>
        {recurring.map(([frequency, amount]) => <div key={frequency}><span>{labels[frequency]} recurring</span><strong>{formatMoney(amount)}</strong></div>)}
        {recurring.length > 0 && <div className="annualised"><span>Annualised recurring</span><strong>{quote ? formatMoney(quote.recurringAnnualisedMinor) : "—"}</strong></div>}
      </div>

      <div className="health-row">
        <span><i className="health-dot" />Commercial health</span>
        <strong>{quote?.marginBp === null || quote?.marginBp === undefined ? "Margin incomplete" : `${(quote.marginBp / 100).toFixed(1)}% margin`}</strong>
      </div>
      <p className="separation-note">One-off and recurring values remain separate by design.</p>
      <button className="button preview-button" onClick={onPreview} disabled={!quote}>Open client preview</button>
    </aside>
  );
}

function QuotePreview({ quote, clientName, onBack }: { quote: PricedQuote; clientName: string; onBack: () => void }) {
  const recurring = (Object.entries(quote.recurringByFrequency) as Array<[Frequency, number]>).filter(([frequency, amount]) => frequency !== "one_off" && amount > 0);
  return (
    <div className="preview-shell">
      <div className="preview-toolbar"><button className="button secondary" onClick={onBack}>← Back to builder</button><span>Client preview · responsive web document</span><button className="button primary" onClick={() => window.print()}>Print or save PDF</button></div>
      <article className="client-document">
        <header><span className="client-logo">FAP</span><div><small>PROPOSAL QB-1049</small><h1>Transformation delivery partnership</h1><p>Prepared for {clientName}</p></div></header>
        <section className="document-intro"><p className="eyebrow">Our proposal</p><h2>Clarity from scope to commitment.</h2><p>This proposal combines focused strategy, delivery capacity and an ongoing advisory relationship. Every commercial value is derived from the published QuoteBench rule set and recorded with its calculation trace.</p></section>
        <section className="document-scope"><p className="eyebrow">Scope and investment</p><h2>A practical route to measurable change</h2>{quote.lines.map((line) => <div key={line.lineId}><span><strong>{line.itemName}</strong><small>{line.quantity} {line.unitLabel}{line.quantity === 1 ? "" : "s"}</small></span><strong>{formatMoney(line.finalPriceMinor)}</strong></div>)}</section>
        <section className="document-totals"><div><small>ONE-OFF INVESTMENT</small><strong>{formatMoney(quote.oneOffSubtotalMinor)}</strong></div>{recurring.map(([frequency, amount]) => <div key={frequency}><small>{labels[frequency].toUpperCase()} RECURRING</small><strong>{formatMoney(amount)}</strong></div>)}</section>
        <section className="document-accept"><div><p className="eyebrow">Next step</p><h2>Ready to proceed?</h2><p>The formal acceptance workflow will record the selected option, full name and timestamp.</p></div><button>Accept proposal</button></section>
        <footer><span>Finance Advisory Partners</span><span>Valid until 14 September 2026</span><span>Private and confidential</span></footer>
      </article>
    </div>
  );
}

function QuotesScreen({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="standard-page">
      <div className="page-heading"><div><p className="eyebrow">Commercial workspace</p><h1>Quotes</h1><p className="page-subtitle">Monitor active commercial decisions from draft to acceptance.</p></div><button className="button primary" onClick={onCreate}>+ New quote</button></div>
      <div className="metric-strip">
        <div><span>Open pipeline</span><strong>£72,680</strong><small>6 live quotes</small></div>
        <div><span>Accepted this month</span><strong>£48,200</strong><small className="positive">+18.4% from July</small></div>
        <div><span>Average margin</span><strong>43.7%</strong><small>Above 35% floor</small></div>
        <div><span>Time to first view</span><strong>2h 14m</strong><small>Median, last 30 days</small></div>
      </div>
      <section className="data-panel">
        <div className="panel-toolbar"><div><h2>Recent quotes</h2><p>Latest activity across the workspace</p></div><div><input placeholder="Search quotes" /><button>Filter</button></div></div>
        <div className="quotes-table"><div className="quotes-row quotes-header"><span>Reference</span><span>Client</span><span>Status</span><span>Value</span><span>Last activity</span><span /></div>{seedQuotes.map((quote) => <button className="quotes-row" key={quote.reference} onClick={onCreate}><strong>{quote.reference}</strong><span>{quote.client}</span><span><Status>{quote.status}</Status></span><strong>{quote.value}</strong><span>{quote.activity}</span><span>›</span></button>)}</div>
      </section>
    </div>
  );
}

function CatalogueScreen() {
  const [search, setSearch] = useState("");
  const visible = catalogue.filter((item) => item.name.toLowerCase().includes(search.toLowerCase()));
  return (
    <div className="standard-page">
      <div className="page-heading"><div><p className="eyebrow">Governed configuration</p><h1>Catalogue</h1><p className="page-subtitle">The approved services and products available to quoters.</p></div><button className="button primary">+ Add catalogue item</button></div>
      <section className="data-panel"><div className="panel-toolbar"><div><h2>Active catalogue</h2><p>{catalogue.length} items across 3 categories</p></div><input placeholder="Search catalogue" value={search} onChange={(event) => setSearch(event.target.value)} /></div><div className="catalogue-table"><div className="catalogue-row catalogue-header"><span>Item</span><span>Pricing basis</span><span>Recurrence</span><span>Base or cost</span><span>Margin basis</span></div>{visible.map((item) => <div className="catalogue-row" key={item.id}><span className="item-cell"><span className="item-glyph">{item.name.charAt(0)}</span><span><strong>{item.name}</strong><small>{item.categoryId}</small></span></span><span>{item.pricingBasis.replace("_", " ")}</span><span>{labels[item.recurrence]}</span><strong>{formatMoney(item.basePriceMinor ?? item.costMinor ?? 0)}</strong><span>{item.targetMarginBp ? `${item.targetMarginBp / 100}% target` : item.costMinor ? "Tracked cost" : "Not recorded"}</span></div>)}</div></section>
    </div>
  );
}

function RulesScreen() {
  return (
    <div className="standard-page">
      <div className="page-heading"><div><p className="eyebrow">Pricing governance</p><div className="title-row"><h1>Consulting rate card</h1><Status>Published</Status></div><p className="page-subtitle">Version 7 applies to every new quote. Changes require explicit publication.</p></div><button className="button primary">Create draft version</button></div>
      <div className="rule-overview"><div><span>Rounding increment</span><strong>£5</strong><small>Away from zero, per line</small></div><div><span>Quote minimum</span><strong>£2,500</strong><small>One-off subtotal only</small></div><div><span>Margin floor</span><strong>35%</strong><small>Warning, not a block</small></div><div><span>Owner discount cap</span><strong>20%</strong><small>Hard commercial control</small></div></div>
      <div className="rules-grid"><section className="data-panel"><div className="panel-toolbar"><div><h2>Quantity bands</h2><p>Total-quantity pricing, item specificity first</p></div><button>+ Add band</button></div>{defaultRuleSet.quantityBands.map((band) => { const item = catalogue.find((entry) => entry.id === band.itemId); return <div className="rule-row" key={band.id}><span><strong>{item?.name ?? band.categoryId}</strong><small>{band.fromQuantity} to {band.toQuantity ?? "unbounded"} units</small></span><b>{formatMoney(band.unitPriceMinor)} / unit</b><button>•••</button></div>; })}</section><section className="data-panel"><div className="panel-toolbar"><div><h2>Question modifiers</h2><p>Applied in published sequence</p></div><button>+ Add modifier</button></div>{defaultRuleSet.modifiers.map((modifier, index) => <div className="rule-row" key={modifier.id}><span className="sequence">{index + 1}</span><span><strong>{modifier.name}</strong><small>{modifier.triggerQuestionId} = {modifier.triggerValue}</small></span><b>+{modifier.adjustmentValue / 100}%</b><button>•••</button></div>)}</section></div>
    </div>
  );
}

function ActivityScreen() {
  return (
    <div className="standard-page">
      <div className="page-heading"><div><p className="eyebrow">Recipient engagement</p><h1>Quote activity</h1><p className="page-subtitle">Qualified views exclude scanners, datacentre traffic and visits under three seconds.</p></div><button className="button secondary">Export activity</button></div>
      <div className="activity-layout"><section className="activity-hero"><p>Live quote engagement</p><h2>7 recipients are reviewing proposals</h2><div className="activity-bars"><span style={{ height: "22%" }} /><span style={{ height: "38%" }} /><span style={{ height: "31%" }} /><span style={{ height: "58%" }} /><span style={{ height: "47%" }} /><span style={{ height: "80%" }} /><span style={{ height: "68%" }} /><span style={{ height: "92%" }} /><span style={{ height: "75%" }} /><span style={{ height: "62%" }} /><span style={{ height: "86%" }} /><span style={{ height: "72%" }} /></div><div className="activity-axis"><span>4 Aug</span><span>15 Aug</span></div></section><section className="attention-panel"><p className="eyebrow">Attention signal</p><h2>Northstar Analytics</h2><p>Viewed QB-1048 three times. 4m 42s spent on pricing.</p><div><span>Introduction</span><b>1m 06s</b></div><div><span>Scope</span><b>2m 18s</b></div><div className="pricing-attention"><span>Pricing</span><b>4m 42s</b></div><button>Open activity detail →</button></section></div>
      <section className="data-panel timeline"><div className="panel-toolbar"><div><h2>Recent signals</h2><p>Qualified engagement and commercial outcomes</p></div></div><div><span className="timeline-mark viewed">V</span><p><strong>Maya Patel viewed QB-1048</strong><small>Northstar Analytics · 18 minutes ago · 7m 41s total dwell</small></p><button>View quote</button></div><div><span className="timeline-mark accepted">A</span><p><strong>Owen Lewis accepted QB-1046</strong><small>Meridian Works · 12 Aug 2026 · £31,680 one-off</small></p><button>View evidence</button></div><div><span className="timeline-mark sent">S</span><p><strong>QB-1047 delivered to two recipients</strong><small>Aperture Health · Yesterday · No qualified view yet</small></p><button>Open tracking</button></div></section>
    </div>
  );
}

export default function QuoteBench() {
  const [screen, setScreen] = useState<Screen>("builder");
  return (
    <div className="app-shell">
      <Sidebar screen={screen} setScreen={setScreen} />
      <div className="main-shell">
        <Topbar />
        <main className="main-content">
          {screen === "builder" && <QuoteBuilder />}
          {screen === "quotes" && <QuotesScreen onCreate={() => setScreen("builder")} />}
          {screen === "catalogue" && <CatalogueScreen />}
          {screen === "rules" && <RulesScreen />}
          {screen === "activity" && <ActivityScreen />}
        </main>
      </div>
    </div>
  );
}

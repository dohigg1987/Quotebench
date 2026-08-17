"use client";

import { useEffect, useState } from "react";

type Resource = "clients" | "catalogue";
type Failure = { row: number; error: string };

const fields: Record<Resource, Array<{ key: string; label: string; required: boolean }>> = {
  clients: [
    { key: "name", label: "Client name", required: true },
    { key: "contactName", label: "Contact name", required: true },
    { key: "contactEmail", label: "Contact email", required: true },
    { key: "status", label: "Status", required: false },
  ],
  catalogue: [
    { key: "id", label: "Item ID", required: false },
    { key: "name", label: "Item name", required: true },
    { key: "categoryId", label: "Category", required: true },
    { key: "unitLabel", label: "Unit", required: true },
    { key: "pricingBasis", label: "Pricing basis", required: true },
    { key: "recurrence", label: "Recurrence", required: true },
    { key: "basePriceMinor", label: "Base price (minor units)", required: false },
    { key: "costMinor", label: "Cost (minor units)", required: false },
    { key: "targetMarginBp", label: "Target margin (basis points)", required: false },
    { key: "minQuantity", label: "Minimum quantity", required: false },
    { key: "maxQuantity", label: "Maximum quantity", required: false },
  ],
};

function readHeaders(csv: string) {
  const firstLine = csv.split(/\r?\n/, 1)[0] ?? "";
  return firstLine.match(/(?:"(?:[^"]|"")*"|[^,])+/g)?.map((value) => value.trim().replace(/^"|"$/g, "").replaceAll('""', '"')) ?? [];
}

function suggestedColumn(headers: string[], key: string) {
  const normalise = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
  return headers.find((header) => normalise(header) === normalise(key)) ?? "";
}

function ImportsAndApiScreen({ onImported }: { onImported: () => void }) {
  const [resource, setResource] = useState<Resource>("clients");
  const [csv, setCsv] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ imported: number; failed: number; failures: Failure[] } | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function chooseFile(file: File | undefined) {
    if (!file) return;
    const text = await file.text();
    const nextHeaders = readHeaders(text);
    setCsv(text);
    setHeaders(nextHeaders);
    setMapping(Object.fromEntries(fields[resource].map((field) => [field.key, suggestedColumn(nextHeaders, field.key)])));
    setResult(null);
    setMessage(null);
  }

  function changeResource(next: Resource) {
    setResource(next);
    setMapping(Object.fromEntries(fields[next].map((field) => [field.key, suggestedColumn(headers, field.key)])));
    setResult(null);
  }

  async function importCsv() {
    setBusy(true);
    setMessage(null);
    setResult(null);
    try {
      const missing = fields[resource].filter((field) => field.required && !mapping[field.key]);
      if (missing.length) throw new Error(`Map required columns: ${missing.map((field) => field.label).join(", ")}.`);
      const response = await fetch("/api/import", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ resource, csv, mapping }) });
      const payload = (await response.json()) as { imported?: number; failed?: number; failures?: Failure[]; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "The CSV could not be imported.");
      setResult({ imported: payload.imported ?? 0, failed: payload.failed ?? 0, failures: payload.failures ?? [] });
      onImported();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The CSV could not be imported.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="standard-page"><div className="page-heading"><div><p className="eyebrow">Workspace connections</p><h1>Imports, exports and API</h1><p className="page-subtitle">Move governed data and administer tenant-scoped machine access without weakening tenant controls.</p></div><a className="button secondary export-link" href="/api/export">Export all data</a></div><div className="integration-grid"><section className="catalogue-editor integration-import"><div className="editor-heading"><div><p className="eyebrow">CSV import</p><h2>Map source columns</h2></div></div><label className="import-resource"><span>Data type</span><select value={resource} onChange={(event) => changeResource(event.target.value as Resource)}><option value="clients">Clients</option><option value="catalogue">Catalogue</option></select></label><label className="file-drop"><strong>Choose CSV file</strong><span>Maximum 2 MB. Valid rows import even when other rows fail.</span><input type="file" accept=".csv,text/csv" onChange={(event) => void chooseFile(event.target.files?.[0])} /></label>{headers.length > 0 && <div className="mapping-grid">{fields[resource].map((field) => <label key={field.key}><span>{field.label}{field.required ? " *" : ""}</span><select value={mapping[field.key] ?? ""} onChange={(event) => setMapping((current) => ({ ...current, [field.key]: event.target.value }))}><option value="">Not mapped</option>{headers.map((header) => <option key={header} value={header}>{header}</option>)}</select></label>)}</div>}{message && <p className="editor-error">{message}</p>}<div className="editor-actions"><button className="button primary" onClick={importCsv} disabled={busy || !csv}>{busy ? "Importingâ€¦" : "Import valid rows"}</button></div></section><section className="data-panel import-results"><div className="panel-toolbar"><div><h2>Import report</h2><p>Failures identify the original CSV row.</p></div></div>{!result && <div className="empty-state"><strong>No import run</strong><p>Select a file and map its columns to begin.</p></div>}{result && <><div className="import-totals"><div><span>Imported</span><strong>{result.imported}</strong></div><div><span>Failed</span><strong>{result.failed}</strong></div></div>{result.failures.map((failure) => <div className="failure-row" key={`${failure.row}-${failure.error}`}><strong>Row {failure.row}</strong><span>{failure.error}</span></div>)}{result.failed === 0 && <div className="success-panel">Every data row imported successfully.</div>}</>}</section></div><section className="data-panel export-options"><div className="panel-toolbar"><div><h2>CSV exports</h2><p>Download current tenant-scoped records.</p></div></div><div><a className="button secondary export-link" href="/api/export?format=csv&resource=clients">Clients CSV</a><a className="button secondary export-link" href="/api/export?format=csv&resource=catalogue">Catalogue CSV</a><a className="button secondary export-link" href="/api/export?format=csv&resource=quotes">Quotes CSV</a></div></section><IntegrationAdministration /></div>;
}

type ConnectorDefinition={provider:string;name:string;category:"crm"|"ledger";description:string;capabilities:string[];configured:boolean};
type ConnectorConnection={id:string;provider:string;status:string;display_name:string;external_account_id?:string|null;connected_at?:string|null;last_sync_at?:string|null};
function ProviderConnections(){const[definitions,setDefinitions]=useState<ConnectorDefinition[]>([]);const[connections,setConnections]=useState<ConnectorConnection[]>([]);const[notice,setNotice]=useState<string|null>(null);function load(){fetch("/api/connectors",{cache:"no-store"}).then(async response=>{const payload=await response.json() as {catalogue?:ConnectorDefinition[];connections?:ConnectorConnection[];error?:string};if(!response.ok)throw new Error(payload.error);setDefinitions(payload.catalogue??[]);setConnections(payload.connections??[]);}).catch((error:unknown)=>setNotice(error instanceof Error?error.message:"Provider connections are unavailable."));}useEffect(load,[]);async function disable(id:string){const response=await fetch("/api/connectors",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"disable",id})});const payload=await response.json() as {connections?:ConnectorConnection[];error?:string};if(!response.ok){setNotice(payload.error??"Connection could not be disabled.");return;}setConnections(payload.connections??[]);setNotice("Connection disabled and stored tokens removed.");}return <section className="provider-connections"><div className="provider-heading"><div><p className="eyebrow">Managed connections</p><h2>CRM and accounting</h2><p>Authorise each provider with OAuth. QuoteBench stores encrypted tokens, tenant-scoped status and an auditable sync record.</p></div><span>{connections.filter(connection=>connection.status==="active").length} active</span></div><div className="provider-grid">{definitions.map(definition=>{const connection=connections.find(item=>item.provider===definition.provider&&item.status==="active");return <article key={definition.provider}><header><span className={`provider-mark ${definition.category}`}>{definition.name.slice(0,2).toUpperCase()}</span><div><strong>{definition.name}</strong><small>{definition.category.toUpperCase()} Â· UK and US</small></div><i className={connection?"active":definition.configured?"ready":"setup"}>{connection?"Connected":definition.configured?"Ready":"Credentials required"}</i></header><p>{definition.description}</p><div className="provider-capabilities">{definition.capabilities.map(capability=><span key={capability}>{capability}</span>)}</div>{connection?<footer><span><strong>{connection.external_account_id||"Authorised account"}</strong><small>{connection.connected_at?`Connected ${new Date(connection.connected_at).toLocaleDateString()}`:"Connection active"}</small></span><button onClick={()=>void disable(connection.id)}>Disconnect</button></footer>:<footer><span><strong>{definition.configured?"OAuth configured":"Developer app required"}</strong><small>{definition.configured?"Administrator consent opens securely":"Add client ID and secret to deployment secrets"}</small></span>{definition.configured?<a className="button secondary" href={`/api/connectors/${definition.provider}`}>Connect</a>:<button className="button secondary" disabled>Connect</button>}</footer>}</article>;})}</div>{notice&&<p className="provider-notice" role="status">{notice}</p>}</section>;}

export default function IntegrationsScreen({onImported}:{onImported:()=>void}){return <div className="connector-page-wrap"><ProviderConnections/><ImportsAndApiScreen onImported={onImported}/></div>;}

type IntegrationWorkspace = { keys: Array<Record<string, unknown>>; endpoints: Array<Record<string, unknown>>; deliveries: Array<Record<string, unknown>>; supportedEvents: string[] };
function IntegrationAdministration() { const [workspace,setWorkspace]=useState<IntegrationWorkspace|null>(null); const [notice,setNotice]=useState<string|null>(null); const [keyName,setKeyName]=useState("Reporting access"); const [scopes,setScopes]=useState(["clients:read","catalogue:read","quotes:read"]); const [webhookName,setWebhookName]=useState("Quote lifecycle"); const [webhookUrl,setWebhookUrl]=useState(""); const [events,setEvents]=useState(["quote.sent","quote.first_viewed","quote.accepted","quote.declined"]); const [includeMonetary,setIncludeMonetary]=useState(false); function load(){fetch("/api/integrations",{cache:"no-store"}).then(async response=>{const payload=await response.json() as IntegrationWorkspace&{error?:string};if(!response.ok)throw new Error(payload.error);setWorkspace(payload);}).catch((error:unknown)=>setNotice(error instanceof Error?error.message:"Integration administration is unavailable."));} useEffect(load,[]); async function act(action:string,input:Record<string,unknown>={}){setNotice(null);try{const response=await fetch("/api/integrations",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action,...input})});const payload=await response.json() as {raw?:string;secret?:string;workspace?:IntegrationWorkspace;error?:string}&IntegrationWorkspace;if(!response.ok)throw new Error(payload.error);setWorkspace(payload.workspace??payload);if(payload.raw)setNotice(`Copy this API key now. It will not be shown again: ${payload.raw}`);else if(payload.secret)setNotice(`Copy this signing secret now. It will not be shown again: ${payload.secret}`);else setNotice("Integration setting updated.");}catch(error){setNotice(error instanceof Error?error.message:"Integration setting could not be changed.");}}
return <div className="integration-admin">{notice&&<div className="notice" role="status"><span>i</span><code>{notice}</code><button onClick={()=>setNotice(null)}>Ã—</button></div>}<div className="integration-admin-grid"><section className="data-panel"><div className="panel-toolbar"><div><h2>Read API keys</h2><p>Keys are tenant-scoped, read-only, hashed at rest and revealed once.</p></div></div><div className="api-key-form"><input value={keyName} onChange={event=>setKeyName(event.target.value)} /><div>{["clients:read","catalogue:read","quotes:read"].map(scope=><label key={scope}><input type="checkbox" checked={scopes.includes(scope)} onChange={event=>setScopes(current=>event.target.checked?[...current,scope]:current.filter(item=>item!==scope))}/>{scope}</label>)}</div><button className="button primary" onClick={()=>void act("create_key",{name:keyName,scopes})}>Create API key</button></div>{workspace?.keys.map(key=><div className="integration-record" key={String(key.id)}><span><strong>{String(key.name)}</strong><small>{String(key.prefix)}â€¦ Â· {(key.scopes as string[]).join(", ")}</small></span><span className="status">{key.revoked_at?"Revoked":"Active"}</span>{!key.revoked_at&&<button className="text-button danger-text" onClick={()=>void act("revoke_key",{id:key.id})}>Revoke</button>}</div>)}</section><section className="data-panel"><div className="panel-toolbar"><div><h2>Signed webhooks</h2><p>HMAC-SHA256 over the exact request body. Verify the x-quotebench-signature header.</p></div></div><div className="webhook-form"><input value={webhookName} onChange={event=>setWebhookName(event.target.value)} placeholder="Endpoint name"/><input value={webhookUrl} onChange={event=>setWebhookUrl(event.target.value)} placeholder="https://example.com/hooks/quotes"/><div>{(workspace?.supportedEvents??events).map(eventName=><label key={eventName}><input type="checkbox" checked={events.includes(eventName)} onChange={event=>setEvents(current=>event.target.checked?[...current,eventName]:current.filter(item=>item!==eventName))}/>{eventName}</label>)}</div><label><input type="checkbox" checked={includeMonetary} onChange={event=>setIncludeMonetary(event.target.checked)}/> Include monetary values in third-party payloads</label><button className="button primary" onClick={()=>void act("create_webhook",{name:webhookName,url:webhookUrl,events,includeMonetary})}>Add endpoint</button></div>{workspace?.endpoints.map(endpoint=><div className="integration-record" key={String(endpoint.id)}><span><strong>{String(endpoint.name)}</strong><small>{String(endpoint.url)} Â· {(endpoint.events as string[]).join(", ")}</small></span><span className="status">{String(endpoint.status)}</span><span><button className="text-button" onClick={()=>void act("test_webhook",{id:endpoint.id})}>Send test</button>{endpoint.status==="Active"&&<button className="text-button danger-text" onClick={()=>void act("disable_webhook",{id:endpoint.id})}>Disable</button>}</span></div>)}</section></div><section className="data-panel webhook-log"><div className="panel-toolbar"><div><h2>Webhook delivery log</h2><p>Payload, response, attempts and exponential retry state remain visible for operational diagnosis.</p></div></div><div className="webhook-log-row webhook-log-header"><span>Endpoint</span><span>Event</span><span>Status</span><span>Attempts</span><span>Response</span></div>{workspace?.deliveries.map(delivery=><div className="webhook-log-row" key={String(delivery.id)}><span>{String(delivery.endpoint_name)}</span><code>{String(delivery.event_type)}</code><span className="status">{String(delivery.status)}</span><strong>{String(delivery.attempt_count)}</strong><span>{delivery.response_status?String(delivery.response_status):String(delivery.response_body??"No response").slice(0,80)}</span></div>)}</section></div>;}


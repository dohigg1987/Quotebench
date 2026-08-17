import { getDatabase } from "./database.ts";
import { auditSecurity } from "./workspace-store.ts";
import { CONNECTORS, type ConnectorProvider } from "../lib/connectors.ts";

const CONNECTION_SCHEMA=`CREATE TABLE IF NOT EXISTS integration_connections (id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL,provider TEXT NOT NULL,category TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending_authorisation',display_name TEXT NOT NULL,external_account_id TEXT,encrypted_credentials TEXT,configuration_json TEXT NOT NULL DEFAULT '{}',connected_by TEXT,connected_at TEXT,last_sync_at TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`;
const SYNC_SCHEMA=`CREATE TABLE IF NOT EXISTS integration_sync_runs (id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL,connection_id TEXT NOT NULL,direction TEXT NOT NULL,status TEXT NOT NULL,records_read INTEGER NOT NULL DEFAULT 0,records_written INTEGER NOT NULL DEFAULT 0,records_failed INTEGER NOT NULL DEFAULT 0,cursor_value TEXT,error_code TEXT,error_summary TEXT,started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,completed_at TEXT)`;

async function database(){
  const db=await getDatabase("Connector storage is unavailable.");
  await db.batch([db.prepare(CONNECTION_SCHEMA),db.prepare(SYNC_SCHEMA),db.prepare("CREATE INDEX IF NOT EXISTS integration_connections_tenant_idx ON integration_connections (tenant_id,category,provider)"),db.prepare("CREATE INDEX IF NOT EXISTS integration_sync_runs_tenant_connection_idx ON integration_sync_runs (tenant_id,connection_id,started_at)")]);
  return db;
}

export async function listConnectorWorkspace(tenantId:string){
  const db=await database();
  const[connections,runs]=await Promise.all([
    db.prepare("SELECT id,provider,category,status,display_name,external_account_id,configuration_json,connected_by,connected_at,last_sync_at,created_at,updated_at FROM integration_connections WHERE tenant_id=? ORDER BY category,provider,created_at DESC").bind(tenantId).all<Record<string,unknown>>(),
    db.prepare("SELECT id,connection_id,direction,status,records_read,records_written,records_failed,error_code,error_summary,started_at,completed_at FROM integration_sync_runs WHERE tenant_id=? ORDER BY started_at DESC LIMIT 50").bind(tenantId).all<Record<string,unknown>>(),
  ]);
  return{connections:connections.results.map(row=>({...row,configuration:JSON.parse(String(row.configuration_json??"{}"))})),syncRuns:runs.results};
}

export async function createPendingConnection(tenantId:string,provider:ConnectorProvider,actorEmail:string){
  const db=await database();
  const definition=CONNECTORS[provider];
  const id=crypto.randomUUID();
  await db.prepare("INSERT INTO integration_connections (id,tenant_id,provider,category,status,display_name,connected_by) VALUES (?,?,?,?, 'pending_authorisation',?,?)").bind(id,tenantId,provider,definition.category,definition.name,actorEmail.toLowerCase()).run();
  return id;
}

async function encryptedCredentials(credentials:unknown){
  const{env}=await import("cloudflare:workers") as {env:Record<string,unknown>};
  const secret=String(env.INTEGRATION_ENCRYPTION_KEY??env.COOKIE_ENCRYPTION_KEY??"");
  if(secret.length<32)throw new Error("INTEGRATION_ENCRYPTION_KEY must be configured before OAuth connections can be stored.");
  const material=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(`quotebench:connector-credentials:v1:${secret}`));
  const key=await crypto.subtle.importKey("raw",material,"AES-GCM",false,["encrypt"]);
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const encrypted=await crypto.subtle.encrypt({name:"AES-GCM",iv},key,new TextEncoder().encode(JSON.stringify(credentials)));
  return `${btoa(String.fromCharCode(...iv))}.${btoa(String.fromCharCode(...new Uint8Array(encrypted)))}`;
}

export async function completeConnection(input:{id:string;tenantId:string;provider:ConnectorProvider;actorEmail:string;externalAccountId?:string|null;credentials:unknown}){
  const db=await database();
  const encrypted=await encryptedCredentials(input.credentials);
  await db.prepare("UPDATE integration_connections SET status='active',external_account_id=?,encrypted_credentials=?,connected_by=?,connected_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND tenant_id=? AND provider=?").bind(input.externalAccountId??null,encrypted,input.actorEmail.toLowerCase(),input.id,input.tenantId,input.provider).run();
  await auditSecurity({tenantId:input.tenantId,actorEmail:input.actorEmail,eventType:"integration.connected",resourceType:"integration_connection",resourceId:input.id,outcome:"success",details:{provider:input.provider}});
}

export async function disableConnection(tenantId:string,id:string,actorEmail:string){
  const db=await database();
  await db.prepare("UPDATE integration_connections SET status='disabled',encrypted_credentials=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=? AND tenant_id=?").bind(id,tenantId).run();
  await auditSecurity({tenantId,actorEmail,eventType:"integration.disabled",resourceType:"integration_connection",resourceId:id,outcome:"success"});
}


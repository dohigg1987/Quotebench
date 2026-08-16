export const BLOCK_TYPES = ["heading", "text", "callout", "pricing_table", "options", "image", "video", "testimonial", "feature_grid", "timeline", "team", "faq", "terms", "signature", "spacer"] as const;
export type BlockType = typeof BLOCK_TYPES[number];
export type DocumentBlock = { id: string; type: BlockType; title?: string; eyebrow?: string; content?: string; locked?: boolean; enabled?: boolean; display?: "totals" | "lines" | "full"; fileId?: string; mediaUrl?: string; layout?: "full" | "split" | "cards" | "compact"; alignment?: "left" | "center"; columns?: 1 | 2 | 3 | 4; items?: Array<{ id:string; title:string; content:string }> };
export type DocumentPage = { id:string; title:string; format:"standard"|"wide"|"cover"|"letter"; background:"plain"|"soft"|"brand"|"dark"; blocks:DocumentBlock[] };
export type BrandProfile = { id: string; name: string; logoFileId: string | null; primaryColor: string; typeface: string; sendingName: string; replyTo: string; sendingDomain: string | null; domainVerified: boolean; whiteLabel: boolean; isDefault: boolean };
export type DocumentTemplate = { id: string; name: string; industry: string | null; pages: DocumentPage[]; isDefault: boolean };

const DEFAULT_BLOCKS: DocumentBlock[] = [
  { id: "introduction", type: "text", eyebrow:"Overview", title: "Our proposal", content: "A focused commercial proposal shaped around the client’s objectives.", locked: false, enabled: true },
  { id: "pricing", type: "pricing_table", title: "Scope and investment", locked: true, enabled: true, display: "full" },
  { id: "terms", type: "terms", title: "Terms", content: "This proposal is valid until the stated expiry date. Fees exclude VAT unless specified.", locked: true, enabled: true },
  { id: "signature", type: "signature", title: "Acceptance", locked: true, enabled: true },
];
const DEFAULT_PAGES:DocumentPage[]=[{id:"page-overview",title:"Overview and commercial proposal",format:"standard",background:"plain",blocks:DEFAULT_BLOCKS}];

const BRAND_SCHEMA = `CREATE TABLE IF NOT EXISTS brand_profiles (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, name TEXT NOT NULL, logo_file_id TEXT, primary_color TEXT NOT NULL DEFAULT '#205b63', typeface TEXT NOT NULL DEFAULT 'Inter', sending_name TEXT NOT NULL, reply_to TEXT NOT NULL, sending_domain TEXT, domain_verified INTEGER NOT NULL DEFAULT 0, white_label INTEGER NOT NULL DEFAULT 0, is_default INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`;
const TEMPLATE_SCHEMA = `CREATE TABLE IF NOT EXISTS document_templates (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, name TEXT NOT NULL, industry TEXT, blocks_json TEXT NOT NULL, is_default INTEGER NOT NULL DEFAULT 0, created_by TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`;
const FILE_SCHEMA = `CREATE TABLE IF NOT EXISTS stored_files (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, quote_reference TEXT, kind TEXT NOT NULL, filename TEXT NOT NULL, content_type TEXT NOT NULL, size_bytes INTEGER NOT NULL, r2_key TEXT NOT NULL, public INTEGER NOT NULL DEFAULT 0, expires_at TEXT, created_by TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`;
const PDF_SCHEMA = `CREATE TABLE IF NOT EXISTS pdf_jobs (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, quote_reference TEXT NOT NULL, status TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, file_id TEXT, error TEXT, requested_by TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`;

async function database() { const { env } = await import("cloudflare:workers"); if (!env.DB) throw new Error("Document storage is unavailable."); return env.DB; }
async function bucket() { const { env } = await import("cloudflare:workers"); if (!env.BUCKET) throw new Error("Object storage is unavailable."); return env.BUCKET; }

async function ensureDocuments(tenantId: string, actorEmail = "system") {
  const db = await database();
  await db.batch([db.prepare(BRAND_SCHEMA), db.prepare(TEMPLATE_SCHEMA), db.prepare(FILE_SCHEMA), db.prepare(PDF_SCHEMA), db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS brand_profiles_tenant_name_unique ON brand_profiles (tenant_id, name)"), db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS document_templates_tenant_name_unique ON document_templates (tenant_id, name)"), db.prepare("CREATE INDEX IF NOT EXISTS stored_files_tenant_quote_idx ON stored_files (tenant_id, quote_reference)"), db.prepare("CREATE INDEX IF NOT EXISTS pdf_jobs_tenant_quote_idx ON pdf_jobs (tenant_id, quote_reference)")]);
  await db.batch([
    db.prepare(`INSERT OR IGNORE INTO brand_profiles (id, tenant_id, name, primary_color, typeface, sending_name, reply_to, is_default) SELECT ?, ?, 'Default brand', '#205b63', 'Inter', 'QuoteBench proposal team', 'proposals@example.com', 1 WHERE NOT EXISTS (SELECT 1 FROM brand_profiles WHERE tenant_id=?)`).bind(`${tenantId}:brand-default`,tenantId,tenantId),
    db.prepare(`INSERT OR IGNORE INTO document_templates (id, tenant_id, name, industry, blocks_json, is_default, created_by) SELECT ?, ?, 'Flexible commercial proposal', 'multi-purpose', ?, 1, ? WHERE NOT EXISTS (SELECT 1 FROM document_templates WHERE tenant_id=?)`).bind(`${tenantId}:template-default`,tenantId, JSON.stringify({pages:DEFAULT_PAGES}), actorEmail,tenantId),
  ]);
}

async function ensureDocumentSchema() {
  const db = await database();
  await db.batch([db.prepare(BRAND_SCHEMA), db.prepare(TEMPLATE_SCHEMA), db.prepare(FILE_SCHEMA), db.prepare(PDF_SCHEMA), db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS brand_profiles_tenant_name_unique ON brand_profiles (tenant_id, name)"), db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS document_templates_tenant_name_unique ON document_templates (tenant_id, name)"), db.prepare("CREATE INDEX IF NOT EXISTS stored_files_tenant_quote_idx ON stored_files (tenant_id, quote_reference)"), db.prepare("CREATE INDEX IF NOT EXISTS pdf_jobs_tenant_quote_idx ON pdf_jobs (tenant_id, quote_reference)")]);
}

function validBlocks(blocks: DocumentBlock[]) {
  if (!Array.isArray(blocks) || blocks.some((block) => !BLOCK_TYPES.includes(block.type))) throw new Error("unsupported_document_block");
  if (blocks.some((block) => block.type === "pricing_table" && /(?:amount|price|total|value)Minor/.test(JSON.stringify(block)))) throw new Error("pricing_block_immutable");
  if(blocks.length>60)throw new Error("document_page_block_limit");
  return blocks.map((block) => ({ ...block, title:block.title?.slice(0,160),eyebrow:block.eyebrow?.slice(0,80),content:block.content?.slice(0,12000),items:block.items?.slice(0,24).map(item=>({id:item.id||crypto.randomUUID(),title:item.title.slice(0,160),content:item.content.slice(0,2000)})),enabled: block.enabled !== false }));
}
export function normaliseProposalPages(value:unknown):DocumentPage[]{const candidate=Array.isArray(value)?[{id:"page-overview",title:"Overview",format:"standard",background:"plain",blocks:value}]:((value as{pages?:unknown})?.pages??value);if(!Array.isArray(candidate)||!candidate.length)return structuredClone(DEFAULT_PAGES);if(candidate.length>40)throw new Error("document_page_limit");return candidate.map((page,index)=>{const input=page as Partial<DocumentPage>;return{id:input.id||crypto.randomUUID(),title:(input.title||`Page ${index+1}`).slice(0,160),format:["standard","wide","cover","letter"].includes(String(input.format))?input.format as DocumentPage["format"]:"standard",background:["plain","soft","brand","dark"].includes(String(input.background))?input.background as DocumentPage["background"]:"plain",blocks:validBlocks(input.blocks??[])}});}

export async function getDocumentWorkspace(tenantId: string) {
  await ensureDocuments(tenantId); const db = await database();
  const [brands, templates] = await Promise.all([
    db.prepare("SELECT id, name, logo_file_id, primary_color, typeface, sending_name, reply_to, sending_domain, domain_verified, white_label, is_default FROM brand_profiles WHERE tenant_id = ? ORDER BY is_default DESC, name").bind(tenantId).all<Record<string, unknown>>(),
    db.prepare("SELECT id, name, industry, blocks_json, is_default FROM document_templates WHERE tenant_id = ? ORDER BY is_default DESC, name").bind(tenantId).all<Record<string, unknown>>(),
  ]);
  return {
    brands: brands.results.map((row) => ({ id: row.id, name: row.name, logoFileId: row.logo_file_id, primaryColor: row.primary_color, typeface: row.typeface, sendingName: row.sending_name, replyTo: row.reply_to, sendingDomain: row.sending_domain, domainVerified: row.domain_verified === 1, whiteLabel: row.white_label === 1, isDefault: row.is_default === 1 })) as BrandProfile[],
    templates: templates.results.map((row) => ({ id: row.id, name: row.name, industry: row.industry, pages: normaliseProposalPages(JSON.parse(String(row.blocks_json))), isDefault: row.is_default === 1 })) as DocumentTemplate[],
  };
}

export async function saveBrandProfile(tenantId: string, input: BrandProfile) {
  await ensureDocuments(tenantId); const db = await database();
  if (!/^#[0-9a-fA-F]{6}$/.test(input.primaryColor)) throw new Error("Brand colour must be a six-digit hexadecimal value.");
  if (!["Inter", "Source Sans 3", "Merriweather", "IBM Plex Sans"].includes(input.typeface)) throw new Error("Choose a supported typeface.");
  if (input.isDefault) await db.prepare("UPDATE brand_profiles SET is_default = 0 WHERE tenant_id = ?").bind(tenantId).run();
  await db.prepare(`INSERT INTO brand_profiles (id, tenant_id, name, logo_file_id, primary_color, typeface, sending_name, reply_to, sending_domain, domain_verified, white_label, is_default) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name=excluded.name, logo_file_id=excluded.logo_file_id, primary_color=excluded.primary_color, typeface=excluded.typeface, sending_name=excluded.sending_name, reply_to=excluded.reply_to, sending_domain=excluded.sending_domain, white_label=excluded.white_label, is_default=excluded.is_default, updated_at=CURRENT_TIMESTAMP`).bind(input.id || crypto.randomUUID(), tenantId, input.name.trim(), input.logoFileId, input.primaryColor, input.typeface, input.sendingName.trim(), input.replyTo.trim().toLowerCase(), input.sendingDomain?.trim().toLowerCase() ?? null, input.domainVerified ? 1 : 0, input.whiteLabel ? 1 : 0, input.isDefault ? 1 : 0).run();
}

export async function saveDocumentTemplate(tenantId: string, input: DocumentTemplate, actorEmail: string) {
  await ensureDocuments(tenantId, actorEmail); const db = await database(); const pages = normaliseProposalPages(input.pages);
  if (input.isDefault) await db.prepare("UPDATE document_templates SET is_default = 0 WHERE tenant_id = ?").bind(tenantId).run();
  await db.prepare(`INSERT INTO document_templates (id, tenant_id, name, industry, blocks_json, is_default, created_by) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name=excluded.name, industry=excluded.industry, blocks_json=excluded.blocks_json, is_default=excluded.is_default, updated_at=CURRENT_TIMESTAMP`).bind(input.id || crypto.randomUUID(), tenantId, input.name.trim(), input.industry, JSON.stringify({pages}), input.isDefault ? 1 : 0, actorEmail).run();
}

export async function validateStoredFile(file: File, kind: "logo" | "image" | "attachment") {
  const limit = kind === "image" || kind === "logo" ? 10_000_000 : 25_000_000;
  if (file.size > limit) throw new Error(`File exceeds the ${limit / 1_000_000} MB limit.`);
  const allowed = kind === "logo" ? ["image/png", "image/jpeg", "image/webp"] : kind === "image" ? ["image/png", "image/jpeg", "image/webp"] : ["application/pdf", "image/png", "image/jpeg", "text/plain"];
  if (!allowed.includes(file.type)) throw new Error("This file type is not supported.");
  const header = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const starts = (...bytes: number[]) => bytes.every((byte, index) => header[index] === byte);
  const validSignature = file.type === "image/png" ? starts(0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a)
    : file.type === "image/jpeg" ? starts(0xff,0xd8,0xff)
    : file.type === "image/webp" ? starts(0x52,0x49,0x46,0x46) && String.fromCharCode(...header.slice(8,12)) === "WEBP"
    : file.type === "application/pdf" ? String.fromCharCode(...header.slice(0,5)) === "%PDF-"
    : file.type === "text/plain" ? !header.includes(0) : false;
  if (!validSignature) throw new Error("File content does not match its declared type.");
}

export async function putStoredFile(tenantId: string, actorEmail: string, file: File, kind: "logo" | "image" | "attachment", quoteReference: string | null) {
  await ensureDocuments(tenantId, actorEmail);
  await validateStoredFile(file, kind);
  const id = crypto.randomUUID(); const key = `${tenantId}/${kind}/${id}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
  const storage = await bucket(); await storage.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type } });
  const db = await database(); await db.prepare(`INSERT INTO stored_files (id, tenant_id, quote_reference, kind, filename, content_type, size_bytes, r2_key, public, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(id, tenantId, quoteReference, kind, file.name, file.type, file.size, key, quoteReference ? 1 : 0, actorEmail).run();
  return { id, filename: file.name, contentType: file.type, sizeBytes: file.size, kind, quoteReference };
}

export async function listQuoteFiles(tenantId: string, reference: string) { await ensureDocuments(tenantId); const db = await database(); const result = await db.prepare("SELECT id, filename, content_type, size_bytes, kind FROM stored_files WHERE tenant_id = ? AND quote_reference = ? AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP) ORDER BY created_at").bind(tenantId, reference).all<{ id: string; filename: string; content_type: string; size_bytes: number; kind: string }>(); return result.results.map((row) => ({ id: row.id, filename: row.filename, contentType: row.content_type, sizeBytes: row.size_bytes, kind: row.kind })); }
export async function getStoredFile(id: string, tenantId?: string) { await ensureDocumentSchema(); const db = await database(); const row = await db.prepare("SELECT r2_key, filename, content_type, kind, public, expires_at, tenant_id FROM stored_files WHERE id = ?").bind(id).first<{ r2_key: string; filename: string; content_type: string; kind: string; public: number; expires_at: string | null; tenant_id: string }>(); if (!row || (tenantId && row.tenant_id !== tenantId) || (!tenantId && row.public !== 1) || (row.expires_at && new Date(`${row.expires_at.replace(" ", "T")}Z`).getTime() < Date.now())) return null; const object = await (await bucket()).get(row.r2_key); return object ? { object, filename: row.filename, contentType: row.content_type, kind: row.kind, tenantId: row.tenant_id } : null; }

export async function createPdfJob(tenantId: string, reference: string, actorEmail: string) { await ensureDocuments(tenantId, actorEmail); const db = await database(); const existing = await db.prepare("SELECT id, status, file_id FROM pdf_jobs WHERE tenant_id = ? AND quote_reference = ? AND status IN ('Queued','Processing','Completed') ORDER BY created_at DESC LIMIT 1").bind(tenantId, reference).first<{ id: string; status: string; file_id: string | null }>(); if (existing) return existing; const id = crypto.randomUUID(); await db.prepare("INSERT INTO pdf_jobs (id, tenant_id, quote_reference, status, requested_by) VALUES (?, ?, ?, 'Queued', ?)").bind(id, tenantId, reference, actorEmail).run(); return { id, status: "Queued", file_id: null }; }
export async function getPdfJob(tenantId: string, id: string) { await ensureDocuments(tenantId); const db = await database(); return db.prepare("SELECT id, quote_reference, status, attempts, file_id, error, created_at, updated_at FROM pdf_jobs WHERE tenant_id = ? AND id = ?").bind(tenantId, id).first<Record<string, unknown>>(); }
export async function completePdfJob(tenantId: string, jobId: string, reference: string, actorEmail: string, bytes: Uint8Array) { await ensureDocuments(tenantId, actorEmail); const storage = await bucket(); const fileId = crypto.randomUUID(); const key = `${tenantId}/pdf/${fileId}-${reference}.pdf`; await storage.put(key, bytes, { httpMetadata: { contentType: "application/pdf" } }); const db = await database(); await db.batch([db.prepare(`INSERT INTO stored_files (id, tenant_id, quote_reference, kind, filename, content_type, size_bytes, r2_key, public, expires_at, created_by) VALUES (?, ?, ?, 'pdf', ?, 'application/pdf', ?, ?, 1, datetime('now', '+30 days'), ?)`).bind(fileId, tenantId, reference, `${reference}.pdf`, bytes.byteLength, key, actorEmail), db.prepare("UPDATE pdf_jobs SET status = 'Completed', attempts = attempts + 1, file_id = ?, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND id = ?").bind(fileId, tenantId, jobId)]); return fileId; }
export async function failPdfJob(tenantId: string, jobId: string, error: string) { const db = await database(); await db.prepare(`UPDATE pdf_jobs SET status = CASE WHEN attempts < 2 THEN 'Queued' ELSE 'Failed' END, attempts = attempts + 1, error = ?, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND id = ?`).bind(error.slice(0, 500), tenantId, jobId).run(); }

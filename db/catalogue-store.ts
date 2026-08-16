import { catalogue as seedCatalogue } from "../app/demo-data";
import type { CatalogueItem } from "../packages/pricing-engine/src/index";

export type ServiceCategory = { id:string; name:string; parentId:string|null; sortOrder:number; active:boolean };
export type ProposalType = { id:string; name:string; description:string; active:boolean };

const CATALOGUE_SCHEMA = `CREATE TABLE IF NOT EXISTS catalogue_items (
  tenant_id TEXT NOT NULL,id TEXT NOT NULL,category_id TEXT NOT NULL,subcategory_id TEXT,name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',service_schedule TEXT NOT NULL DEFAULT '',service_terms TEXT NOT NULL DEFAULT '',
  unit_label TEXT NOT NULL,pricing_basis TEXT NOT NULL CHECK (pricing_basis IN ('fixed','per_unit','cost_plus')),
  base_price_minor INTEGER,cost_minor INTEGER,target_margin_bp INTEGER,
  recurrence TEXT NOT NULL CHECK (recurrence IN ('one_off','weekly','fortnightly','monthly','quarterly','annually')),
  min_quantity INTEGER,max_quantity INTEGER,updated_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`;
const CATEGORY_SCHEMA = `CREATE TABLE IF NOT EXISTS service_categories (tenant_id TEXT NOT NULL,id TEXT NOT NULL,name TEXT NOT NULL,parent_id TEXT,sort_order INTEGER NOT NULL DEFAULT 0,active INTEGER NOT NULL DEFAULT 1,updated_by TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`;
const PROPOSAL_TYPE_SCHEMA = `CREATE TABLE IF NOT EXISTS proposal_types (tenant_id TEXT NOT NULL,id TEXT NOT NULL,name TEXT NOT NULL,description TEXT NOT NULL DEFAULT '',active INTEGER NOT NULL DEFAULT 1,updated_by TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`;
const ITEM_TYPE_SCHEMA = `CREATE TABLE IF NOT EXISTS catalogue_item_proposal_types (tenant_id TEXT NOT NULL,item_id TEXT NOT NULL,proposal_type_id TEXT NOT NULL,default_included INTEGER NOT NULL DEFAULT 0)`;

async function database(){const{env}=await import("cloudflare:workers");if(!env.DB)throw new Error("Catalogue storage is unavailable");return env.DB;}
const slug=(value:string)=>value.trim().toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,80);

async function ensureCatalogue(tenantId:string){
  const db=await database();
  await db.batch([
    db.prepare(CATALOGUE_SCHEMA),db.prepare(CATEGORY_SCHEMA),db.prepare(PROPOSAL_TYPE_SCHEMA),db.prepare(ITEM_TYPE_SCHEMA),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS catalogue_items_tenant_id_unique ON catalogue_items (tenant_id,id)"),
    db.prepare("CREATE INDEX IF NOT EXISTS catalogue_items_tenant_name_idx ON catalogue_items (tenant_id,name)"),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS service_categories_tenant_id_unique ON service_categories (tenant_id,id)"),
    db.prepare("CREATE INDEX IF NOT EXISTS service_categories_tenant_parent_idx ON service_categories (tenant_id,parent_id,sort_order)"),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS proposal_types_tenant_id_unique ON proposal_types (tenant_id,id)"),
    db.prepare("CREATE INDEX IF NOT EXISTS proposal_types_tenant_name_idx ON proposal_types (tenant_id,name)"),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS catalogue_item_proposal_types_unique ON catalogue_item_proposal_types (tenant_id,item_id,proposal_type_id)"),
    db.prepare("CREATE INDEX IF NOT EXISTS catalogue_item_proposal_types_type_idx ON catalogue_item_proposal_types (tenant_id,proposal_type_id)"),
  ]);
  for(const [column,definition] of [["subcategory_id","TEXT"],["description","TEXT NOT NULL DEFAULT ''"],["service_schedule","TEXT NOT NULL DEFAULT ''"],["service_terms","TEXT NOT NULL DEFAULT ''"]] as const){try{await db.prepare(`SELECT ${column} FROM catalogue_items LIMIT 0`).run();}catch{await db.prepare(`ALTER TABLE catalogue_items ADD COLUMN ${column} ${definition}`).run();}}
  const categories=[
    ["advisory","Advisory",null,10],["delivery","Delivery",null,20],["technology","Technology",null,30],
    ["strategy","Strategy","advisory",10],["retained-advice","Retained advice","advisory",20],
    ["implementation","Implementation","delivery",10],["platforms","Platforms and licences","technology",10],
  ] as const;
  const proposalTypes=[
    ["full-service","Full service","A comprehensive proposal spanning advice, delivery and supporting technology."],
    ["advisory","Advisory engagement","Advice, workshops and retained expertise."],
    ["implementation","Implementation programme","Delivery-led mobilisation and execution."],
    ["managed-service","Managed service","Recurring service and platform commitments."],
  ] as const;
  await db.batch([
    ...categories.map(row=>db.prepare("INSERT OR IGNORE INTO service_categories (tenant_id,id,name,parent_id,sort_order,updated_by) VALUES (?,?,?,?,?,'system-seed')").bind(tenantId,...row)),
    ...proposalTypes.map(row=>db.prepare("INSERT OR IGNORE INTO proposal_types (tenant_id,id,name,description,updated_by) VALUES (?,?,?,?,'system-seed')").bind(tenantId,...row)),
    ...seedCatalogue.map(item=>db.prepare(`INSERT OR IGNORE INTO catalogue_items (tenant_id,id,category_id,subcategory_id,name,description,service_schedule,service_terms,unit_label,pricing_basis,base_price_minor,cost_minor,target_margin_bp,recurrence,min_quantity,max_quantity,updated_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, 'system-seed')`).bind(tenantId,item.id,item.categoryId,item.subcategoryId??null,item.name,item.description??"",item.serviceSchedule??"",item.serviceTerms??"",item.unitLabel,item.pricingBasis,item.basePriceMinor??null,item.costMinor??null,item.targetMarginBp??null,item.recurrence,item.minQuantity??null,item.maxQuantity??null)),
  ]);
  const seedLinks:{item:string;type:string;defaultIncluded:number}[]=[
    {item:"strategy-workshop",type:"full-service",defaultIncluded:1},{item:"strategy-workshop",type:"advisory",defaultIncluded:1},{item:"delivery-sprint",type:"full-service",defaultIncluded:1},{item:"delivery-sprint",type:"implementation",defaultIncluded:1},
    {item:"advisory-retainer",type:"full-service",defaultIncluded:0},{item:"advisory-retainer",type:"advisory",defaultIncluded:0},{item:"advisory-retainer",type:"managed-service",defaultIncluded:1},{item:"platform-licence",type:"full-service",defaultIncluded:0},{item:"platform-licence",type:"implementation",defaultIncluded:0},{item:"platform-licence",type:"managed-service",defaultIncluded:1},
  ];
  const linkCount=await db.prepare("SELECT COUNT(*) AS count FROM catalogue_item_proposal_types WHERE tenant_id=?").bind(tenantId).first<{count:number}>();
  if(Number(linkCount?.count??0)===0)await db.batch(seedLinks.map(link=>db.prepare("INSERT OR IGNORE INTO catalogue_item_proposal_types (tenant_id,item_id,proposal_type_id,default_included) VALUES (?,?,?,?)").bind(tenantId,link.item,link.type,link.defaultIncluded)));
  return db;
}

export async function listServiceCategories(tenantId:string){const db=await ensureCatalogue(tenantId);const rows=await db.prepare("SELECT id,name,parent_id,sort_order,active FROM service_categories WHERE tenant_id=? ORDER BY parent_id IS NOT NULL,parent_id,sort_order,name").bind(tenantId).all<{id:string;name:string;parent_id:string|null;sort_order:number;active:number}>();return rows.results.map(row=>({id:row.id,name:row.name,parentId:row.parent_id,sortOrder:row.sort_order,active:row.active===1}));}
export async function listProposalTypes(tenantId:string){const db=await ensureCatalogue(tenantId);const rows=await db.prepare("SELECT id,name,description,active FROM proposal_types WHERE tenant_id=? ORDER BY name").bind(tenantId).all<{id:string;name:string;description:string;active:number}>();return rows.results.map(row=>({id:row.id,name:row.name,description:row.description,active:row.active===1}));}

export async function listCatalogueItems(tenantId:string):Promise<CatalogueItem[]>{
  const db=await ensureCatalogue(tenantId);
  const [items,links]=await Promise.all([
    db.prepare(`SELECT id,category_id,subcategory_id,name,description,service_schedule,service_terms,unit_label,pricing_basis,base_price_minor,cost_minor,target_margin_bp,recurrence,min_quantity,max_quantity FROM catalogue_items WHERE tenant_id=? ORDER BY category_id,subcategory_id,name`).bind(tenantId).all<Record<string,unknown>>(),
    db.prepare("SELECT item_id,proposal_type_id,default_included FROM catalogue_item_proposal_types WHERE tenant_id=?").bind(tenantId).all<{item_id:string;proposal_type_id:string;default_included:number}>(),
  ]);
  return items.results.map(row=>{const assigned=links.results.filter(link=>link.item_id===row.id);return{
    id:String(row.id),categoryId:String(row.category_id),...(row.subcategory_id?{subcategoryId:String(row.subcategory_id)}:{}),name:String(row.name),
    ...(row.description?{description:String(row.description)}:{}),...(row.service_schedule?{serviceSchedule:String(row.service_schedule)}:{}),...(row.service_terms?{serviceTerms:String(row.service_terms)}:{}),
    unitLabel:String(row.unit_label),pricingBasis:row.pricing_basis as CatalogueItem["pricingBasis"],...(row.base_price_minor===null?{}:{basePriceMinor:Number(row.base_price_minor) as CatalogueItem["basePriceMinor"]}),
    ...(row.cost_minor===null?{}:{costMinor:Number(row.cost_minor) as CatalogueItem["costMinor"]}),...(row.target_margin_bp===null?{}:{targetMarginBp:Number(row.target_margin_bp) as CatalogueItem["targetMarginBp"]}),
    recurrence:row.recurrence as CatalogueItem["recurrence"],...(row.min_quantity===null?{}:{minQuantity:Number(row.min_quantity)}),...(row.max_quantity===null?{}:{maxQuantity:Number(row.max_quantity)}),
    proposalTypeIds:assigned.map(link=>link.proposal_type_id),defaultProposalTypeIds:assigned.filter(link=>link.default_included===1).map(link=>link.proposal_type_id),
  }});
}

export async function listCatalogueWorkspace(tenantId:string){const catalogue=await listCatalogueItems(tenantId);const categories=await listServiceCategories(tenantId);const proposalTypes=await listProposalTypes(tenantId);return{catalogue,categories,proposalTypes};}

export async function upsertCatalogueItem(tenantId:string,item:CatalogueItem,actorEmail:string){
  const db=await ensureCatalogue(tenantId);const itemId=slug(item.id||item.name);const proposalIds=[...new Set(item.proposalTypeIds??[])];const defaults=new Set(item.defaultProposalTypeIds??[]);
  const category=await db.prepare("SELECT parent_id FROM service_categories WHERE tenant_id=? AND id=? AND active=1").bind(tenantId,item.categoryId).first<{parent_id:string|null}>();
  if(!category||category.parent_id)throw new Error("Select an active top-level category.");
  if(item.subcategoryId){const child=await db.prepare("SELECT parent_id FROM service_categories WHERE tenant_id=? AND id=? AND active=1").bind(tenantId,item.subcategoryId).first<{parent_id:string|null}>();if(!child||child.parent_id!==item.categoryId)throw new Error("Select a subcategory within the chosen category.");}
  for(const typeId of proposalIds){const type=await db.prepare("SELECT 1 AS valid FROM proposal_types WHERE tenant_id=? AND id=? AND active=1").bind(tenantId,typeId).first();if(!type)throw new Error("One or more proposal-type assignments are invalid.");}
  await db.batch([
    db.prepare(`INSERT INTO catalogue_items (tenant_id,id,category_id,subcategory_id,name,description,service_schedule,service_terms,unit_label,pricing_basis,base_price_minor,cost_minor,target_margin_bp,recurrence,min_quantity,max_quantity,updated_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(tenant_id,id) DO UPDATE SET category_id=excluded.category_id,subcategory_id=excluded.subcategory_id,name=excluded.name,description=excluded.description,service_schedule=excluded.service_schedule,service_terms=excluded.service_terms,unit_label=excluded.unit_label,pricing_basis=excluded.pricing_basis,base_price_minor=excluded.base_price_minor,cost_minor=excluded.cost_minor,target_margin_bp=excluded.target_margin_bp,recurrence=excluded.recurrence,min_quantity=excluded.min_quantity,max_quantity=excluded.max_quantity,updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP`).bind(tenantId,itemId,item.categoryId,item.subcategoryId??null,item.name,item.description??"",item.serviceSchedule??"",item.serviceTerms??"",item.unitLabel,item.pricingBasis,item.basePriceMinor??null,item.costMinor??null,item.targetMarginBp??null,item.recurrence,item.minQuantity??null,item.maxQuantity??null,actorEmail),
    db.prepare("DELETE FROM catalogue_item_proposal_types WHERE tenant_id=? AND item_id=?").bind(tenantId,itemId),
    ...proposalIds.map(typeId=>db.prepare("INSERT INTO catalogue_item_proposal_types (tenant_id,item_id,proposal_type_id,default_included) VALUES (?,?,?,?)").bind(tenantId,itemId,typeId,defaults.has(typeId)?1:0)),
  ]);
  return (await listCatalogueItems(tenantId)).find(entry=>entry.id===itemId)??{...item,id:itemId};
}

export async function upsertServiceCategory(tenantId:string,input:Partial<ServiceCategory>&{name:string},actorEmail:string){const db=await ensureCatalogue(tenantId);const id=slug(input.id||input.name);const parentId=input.parentId||null;if(parentId===id)throw new Error("A category cannot be its own parent.");if(parentId){const parent=await db.prepare("SELECT parent_id FROM service_categories WHERE tenant_id=? AND id=? AND active=1").bind(tenantId,parentId).first<{parent_id:string|null}>();if(!parent||parent.parent_id)throw new Error("Subcategories must sit directly beneath a top-level category.");}await db.prepare(`INSERT INTO service_categories (tenant_id,id,name,parent_id,sort_order,active,updated_by) VALUES (?,?,?,?,?,?,?) ON CONFLICT(tenant_id,id) DO UPDATE SET name=excluded.name,parent_id=excluded.parent_id,sort_order=excluded.sort_order,active=excluded.active,updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP`).bind(tenantId,id,input.name.trim().slice(0,120),parentId,Math.round(Number(input.sortOrder??0)),input.active===false?0:1,actorEmail).run();return(await listServiceCategories(tenantId)).find(category=>category.id===id);}

export async function upsertProposalType(tenantId:string,input:Partial<ProposalType>&{name:string},actorEmail:string){const db=await ensureCatalogue(tenantId);const id=slug(input.id||input.name);await db.prepare(`INSERT INTO proposal_types (tenant_id,id,name,description,active,updated_by) VALUES (?,?,?,?,?,?) ON CONFLICT(tenant_id,id) DO UPDATE SET name=excluded.name,description=excluded.description,active=excluded.active,updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP`).bind(tenantId,id,input.name.trim().slice(0,120),String(input.description??"").trim().slice(0,1000),input.active===false?0:1,actorEmail).run();return(await listProposalTypes(tenantId)).find(type=>type.id===id);}

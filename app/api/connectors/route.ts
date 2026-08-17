import { getCurrentUser } from "../../auth";
import { listConnectorWorkspace, disableConnection } from "../../../db/connector-store";
import { requireWorkspaceContext } from "../../../db/workspace-store";
import { CONNECTORS } from "../../../lib/connectors";

export const dynamic="force-dynamic";

async function catalogue(){const{env}=await import("cloudflare:workers") as {env:Record<string,unknown>};return Object.values(CONNECTORS).map(definition=>({...definition,configured:Boolean(env[definition.clientIdEnv]&&env[definition.clientSecretEnv]),clientIdEnv:undefined,clientSecretEnv:undefined}));}

export async function GET(){const user=await getCurrentUser();if(!user)return Response.json({error:"unauthorised"},{status:401});const workspace=await requireWorkspaceContext(user,["owner","admin","quoter"]);return Response.json({...await listConnectorWorkspace(workspace.tenantId),catalogue:await catalogue()});}

export async function POST(request:Request){const user=await getCurrentUser();if(!user)return Response.json({error:"unauthorised"},{status:401});const workspace=await requireWorkspaceContext(user,["owner","admin"]);const body=await request.json() as {action?:string;id?:string};if(body.action==="disable"&&body.id){await disableConnection(workspace.tenantId,body.id,user.email);return Response.json({...await listConnectorWorkspace(workspace.tenantId),catalogue:await catalogue()});}return Response.json({error:"unsupported_connector_action"},{status:400});}


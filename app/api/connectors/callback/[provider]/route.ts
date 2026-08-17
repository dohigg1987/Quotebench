import { getCurrentUser } from "../../../../auth";
import { completeConnection } from "../../../../../db/connector-store";
import { requireWorkspaceContext } from "../../../../../db/workspace-store";
import { CONNECTORS, connectorRedirectUri, isConnectorProvider } from "../../../../../lib/connectors";
import { verifyOAuthState } from "../../../../../lib/oauth-state";

export const dynamic="force-dynamic";

export async function GET(request:Request,{params}:{params:Promise<{provider:string}>}){
  const user=await getCurrentUser();
  const url=new URL(request.url);
  const{provider}=await params;
  if(!user)return Response.redirect(new URL("/?error=connector_sign_in",url.origin));
  if(!isConnectorProvider(provider))return Response.json({error:"unsupported_connector"},{status:404});
  const state=await verifyOAuthState(url.searchParams.get("state")??"");
  const code=url.searchParams.get("code");
  if(!state||state.provider!==provider||!code)return Response.redirect(new URL(`/?screen=integrations&connector=${provider}&error=oauth_rejected`,url.origin));
  const workspace=await requireWorkspaceContext(user,["owner","admin"]);
  if(workspace.tenantId!==state.tenantId)return Response.json({error:"forbidden"},{status:403});
  const definition=CONNECTORS[provider];
  const{env}=await import("cloudflare:workers") as {env:Record<string,unknown>};
  const clientId=String(env[definition.clientIdEnv]??"");
  const clientSecret=String(env[definition.clientSecretEnv]??"");
  const body=new URLSearchParams({grant_type:"authorization_code",code,redirect_uri:connectorRedirectUri(url.origin,provider)});
  let headers:Record<string,string>={"content-type":"application/x-www-form-urlencoded",accept:"application/json"};
  if(provider==="xero"||provider==="quickbooks")headers={...headers,authorization:`Basic ${btoa(`${clientId}:${clientSecret}`)}`};
  else{body.set("client_id",clientId);body.set("client_secret",clientSecret);}
  const tokenResponse=await fetch(definition.tokenUrl,{method:"POST",headers,body});
  const credentials=await tokenResponse.json() as Record<string,unknown>;
  if(!tokenResponse.ok||!credentials.access_token)return Response.redirect(new URL(`/?screen=integrations&connector=${provider}&error=token_exchange_failed`,url.origin));
  const providerAccount=String(credentials.hub_id??credentials.organization_id??"")||null;
  await completeConnection({id:state.connectionId,tenantId:workspace.tenantId,provider,actorEmail:user.email,externalAccountId:url.searchParams.get("realmId")??providerAccount,credentials});
  return Response.redirect(new URL(`/?screen=integrations&connector=${provider}&connected=1`,url.origin));
}


import { getCurrentUser } from "../../../auth";
import { createPendingConnection } from "../../../../db/connector-store";
import { requireWorkspaceContext } from "../../../../db/workspace-store";
import { CONNECTORS, connectorAuthoriseUrl, connectorRedirectUri, isConnectorProvider } from "../../../../lib/connectors";
import { createOAuthState } from "../../../../lib/oauth-state";

export const dynamic="force-dynamic";

export async function GET(request:Request,{params}:{params:Promise<{provider:string}>}){const user=await getCurrentUser();if(!user)return Response.redirect(new URL("/?error=connector_sign_in",request.url));const{provider}=await params;if(!isConnectorProvider(provider))return Response.json({error:"unsupported_connector"},{status:404});const workspace=await requireWorkspaceContext(user,["owner","admin"]);const definition=CONNECTORS[provider];const{env}=await import("cloudflare:workers") as {env:Record<string,unknown>};const clientId=String(env[definition.clientIdEnv]??"");const clientSecret=String(env[definition.clientSecretEnv]??"");if(!clientId||!clientSecret)return Response.redirect(new URL(`/?screen=integrations&connector=${provider}&error=credentials_required`,request.url));const connectionId=await createPendingConnection(workspace.tenantId,provider,user.email);const state=await createOAuthState({connectionId,tenantId:workspace.tenantId,provider});const origin=new URL(request.url).origin;return Response.redirect(connectorAuthoriseUrl(definition,clientId,connectorRedirectUri(origin,provider),state));}


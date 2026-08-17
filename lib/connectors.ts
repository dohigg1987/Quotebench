export type ConnectorProvider = "hubspot" | "salesforce" | "xero" | "quickbooks";
export type ConnectorCategory = "crm" | "ledger";

export type ConnectorDefinition = {
  provider: ConnectorProvider;
  name: string;
  category: ConnectorCategory;
  description: string;
  markets: Array<"GB" | "US">;
  capabilities: string[];
  authoriseUrl: string;
  tokenUrl: string;
  scopes: string[];
  clientIdEnv: string;
  clientSecretEnv: string;
};

export const CONNECTORS: Record<ConnectorProvider, ConnectorDefinition> = {
  hubspot: {
    provider: "hubspot",
    name: "HubSpot",
    category: "crm",
    description: "Synchronise companies, contacts and deal context.",
    markets: ["GB", "US"],
    capabilities: ["Contacts", "Companies", "Deals"],
    authoriseUrl: "https://app.hubspot.com/oauth/authorize",
    tokenUrl: "https://api.hubapi.com/oauth/v1/token",
    scopes: [
      "crm.objects.contacts.read",
      "crm.objects.contacts.write",
      "crm.objects.companies.read",
      "crm.objects.companies.write",
      "crm.objects.deals.read",
      "crm.objects.deals.write",
    ],
    clientIdEnv: "HUBSPOT_CLIENT_ID",
    clientSecretEnv: "HUBSPOT_CLIENT_SECRET",
  },
  salesforce: {
    provider: "salesforce",
    name: "Salesforce",
    category: "crm",
    description: "Synchronise accounts, contacts and opportunities.",
    markets: ["GB", "US"],
    capabilities: ["Accounts", "Contacts", "Opportunities"],
    authoriseUrl: "https://login.salesforce.com/services/oauth2/authorize",
    tokenUrl: "https://login.salesforce.com/services/oauth2/token",
    scopes: ["api", "refresh_token"],
    clientIdEnv: "SALESFORCE_CLIENT_ID",
    clientSecretEnv: "SALESFORCE_CLIENT_SECRET",
  },
  xero: {
    provider: "xero",
    name: "Xero",
    category: "ledger",
    description: "Create governed customer and invoice hand-offs.",
    markets: ["GB", "US"],
    capabilities: ["Contacts", "Invoices", "Tax codes"],
    authoriseUrl: "https://login.xero.com/identity/connect/authorize",
    tokenUrl: "https://identity.xero.com/connect/token",
    scopes: [
      "openid",
      "profile",
      "email",
      "offline_access",
      "accounting.contacts",
      "accounting.transactions",
    ],
    clientIdEnv: "XERO_CLIENT_ID",
    clientSecretEnv: "XERO_CLIENT_SECRET",
  },
  quickbooks: {
    provider: "quickbooks",
    name: "QuickBooks Online",
    category: "ledger",
    description: "Create customer and invoice hand-offs for accepted work.",
    markets: ["GB", "US"],
    capabilities: ["Customers", "Estimates", "Invoices", "Tax codes"],
    authoriseUrl: "https://appcenter.intuit.com/connect/oauth2",
    tokenUrl: "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer",
    scopes: ["com.intuit.quickbooks.accounting"],
    clientIdEnv: "QUICKBOOKS_CLIENT_ID",
    clientSecretEnv: "QUICKBOOKS_CLIENT_SECRET",
  },
};

export function isConnectorProvider(value: string): value is ConnectorProvider {
  return value in CONNECTORS;
}

export function connectorRedirectUri(origin: string, provider: ConnectorProvider) {
  return `${origin}/api/connectors/callback/${provider}`;
}

export function connectorAuthoriseUrl(
  definition: ConnectorDefinition,
  clientId: string,
  redirectUri: string,
  state: string,
) {
  const url = new URL(definition.authoriseUrl);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", definition.scopes.join(" "));
  url.searchParams.set("state", state);

  if (definition.provider === "quickbooks") {
    url.searchParams.set("response_mode", "query");
  }

  return url.toString();
}


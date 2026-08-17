import { mkdir, writeFile } from "node:fs/promises";
import process from "node:process";

const required = ["NEON_AUTH_BASE_URL", "NEON_AUTH_COOKIE_SECRET", "OPERATOR_EMAIL_SHA256"];
const optional = ["COOKIE_ENCRYPTION_KEY", "INTEGRATION_ENCRYPTION_KEY", "EMAIL_API_ENDPOINT", "EMAIL_API_KEY", "EMAIL_FROM_ADDRESS", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "STRIPE_PRICE_STARTER", "STRIPE_PRICE_PROFESSIONAL", "STRIPE_PRICE_SCALE", "HUBSPOT_CLIENT_ID", "HUBSPOT_CLIENT_SECRET", "SALESFORCE_CLIENT_ID", "SALESFORCE_CLIENT_SECRET", "XERO_CLIENT_ID", "XERO_CLIENT_SECRET", "QUICKBOOKS_CLIENT_ID", "QUICKBOOKS_CLIENT_SECRET"];
const secrets = Object.fromEntries([...required, ...optional].flatMap((name) => process.env[name] ? [[name, process.env[name]]] : []));
for (const name of required) if (!secrets[name]) throw new Error(`${name} is required.`);
if (String(secrets.NEON_AUTH_COOKIE_SECRET).length < 32) throw new Error("NEON_AUTH_COOKIE_SECRET must contain at least 32 characters.");

await mkdir(new URL("../.wrangler/", import.meta.url), { recursive: true });
const target = new URL("../.wrangler/deploy-secrets.json", import.meta.url);
await writeFile(target, `${JSON.stringify(secrets)}\n`, { mode: 0o600 });
process.stdout.write(target.pathname);


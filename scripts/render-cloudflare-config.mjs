import { mkdir, readFile, writeFile } from "node:fs/promises";
import process from "node:process";

const environment = process.env.DEPLOY_ENV;
const hyperdriveId = process.env.CLOUDFLARE_HYPERDRIVE_ID?.trim();
const publicSiteUrl = process.env.PUBLIC_SITE_URL?.trim();
const commit = process.env.BUILD_COMMIT_SHA?.trim();
if (!environment || !["dev", "test", "preprod", "production"].includes(environment)) throw new Error("DEPLOY_ENV must be dev, test, preprod or production.");
if (!hyperdriveId) throw new Error("CLOUDFLARE_HYPERDRIVE_ID is required.");
if (!publicSiteUrl || !/^https:\/\//.test(publicSiteUrl)) throw new Error("PUBLIC_SITE_URL must be an HTTPS URL.");
if (!commit || !/^[a-f0-9]{40}$/.test(commit)) throw new Error("BUILD_COMMIT_SHA must be a full Git commit SHA.");

const environments = JSON.parse(await readFile(new URL("../deployment/environments.json", import.meta.url), "utf8"));
const selected = environments[environment];
const config = {
  $schema: "node_modules/wrangler/config-schema.json",
  name: selected.worker,
  main: "../dist/server/index.js",
  assets: { directory: "../dist/client", binding: "ASSETS", run_worker_first: false },
  compatibility_date: "2026-08-16",
  compatibility_flags: ["nodejs_compat"],
  no_bundle: true,
  find_additional_modules: true,
  rules: [{ type: "ESModule", globs: ["**/*.js"] }],
  upload_source_maps: true,
  placement: { mode: "smart" },
  images: { binding: "IMAGES" },
  observability: { enabled: true, logs: { enabled: true, invocation_logs: true, head_sampling_rate: 1 } },
  vars: { APP_ENV: environment, BUILD_COMMIT_SHA: commit, PUBLIC_SITE_URL: publicSiteUrl },
  hyperdrive: [{ binding: "HYPERDRIVE", id: hyperdriveId }],
  r2_buckets: [{ binding: "BUCKET", bucket_name: selected.r2Bucket }],
  queues: {
    producers: [{ binding: "PDF_QUEUE", queue: selected.pdfQueue }],
    consumers: [{ queue: selected.pdfQueue, max_batch_size: 1, max_batch_timeout: 5, max_retries: 4, dead_letter_queue: `${selected.pdfQueue}-dead-letter` }],
  },
  triggers: { crons: ["*/5 * * * *"] },
};

await mkdir(new URL("../.wrangler/", import.meta.url), { recursive: true });
const target = new URL(`../.wrangler/deploy-${environment}.json`, import.meta.url);
await writeFile(target, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
process.stdout.write(target.pathname);

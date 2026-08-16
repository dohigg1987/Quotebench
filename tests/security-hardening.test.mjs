import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { escapeHtml } from "../db/notification-store.ts";
import { assertSafeWebhookUrl } from "../db/integration-store.ts";

test("HTML email content is contextually escaped", () => {
  assert.equal(
    escapeHtml(`<img src=x onerror="alert('x')"> & text`),
    "&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt; &amp; text",
  );
});

test("webhook validation accepts only public HTTPS destinations", () => {
  assert.equal(assertSafeWebhookUrl("https://hooks.example.com/quotebench"), "https://hooks.example.com/quotebench");
  for (const value of [
    "http://hooks.example.com",
    "https://localhost/hook",
    "https://127.0.0.1/hook",
    "https://10.0.0.4/hook",
    "https://169.254.169.254/latest/meta-data",
    "https://192.168.1.1/hook",
    "https://[::1]/hook",
    "https://user:password@example.com/hook",
    "https://example.com:8443/hook",
  ]) assert.throws(() => assertSafeWebhookUrl(value));
});

test("unsafe API methods require same-origin browser provenance", async () => {
  const worker = await readFile(new URL("../worker/index.ts", import.meta.url), "utf8");
  assert.match(worker, /Request origin could not be verified/);
  assert.match(worker, /missingBrowserProvenance/);
});

test("the production CSP permits the framework bootstrap while retaining containment", async () => {
  const worker = await readFile(new URL("../worker/index.ts", import.meta.url), "utf8");
  assert.match(worker, /script-src 'self' 'unsafe-inline'/);
  assert.match(worker, /object-src 'none'/);
  assert.match(worker, /frame-ancestors 'none'/);
  assert.match(worker, /upgrade-insecure-requests/);
});

test("acceptance stores hashes and uses an atomic state transition", async () => {
  const store = await readFile(new URL("../db/quote-store.ts", import.meta.url), "utf8");
  assert.match(store, /recipientTokenHash/);
  assert.doesNotMatch(store, /recipientToken:\s*token/);
  assert.match(store, /RETURNING accepted_at/);
  assert.match(store, /quoteSnapshotHash/);
});

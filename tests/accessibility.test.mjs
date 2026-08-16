import assert from "node:assert/strict";
import test from "node:test";
import axe from "axe-core";
import { JSDOM } from "jsdom";

test("public sign-in surface has no serious automated WCAG violations", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("accessibility", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const response = await worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
  assert.equal(response.status, 200);
  const dom = new JSDOM(await response.text(), {
    runScripts: "outside-only",
    url: "http://localhost/",
  });
  dom.window.eval(axe.source);
  const results = await dom.window.axe.run(dom.window.document, {
    resultTypes: ["violations"],
    rules: { "color-contrast": { enabled: false } },
  });
  const blocking = results.violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? ""));
  assert.equal(blocking.length, 0, JSON.stringify(Array.from(blocking, (violation) => ({ id: violation.id, impact: violation.impact, nodes: violation.nodes.length }))));
  dom.window.close();
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { destructiveStatements, RELEASE_MIGRATIONS } from "../db/release-migrations.ts";
import { EXPECTED_RELEASE_PRICING_TRACE, runReleasePricingAssurance } from "../lib/release-assurance.ts";
import { createReleaseControlSignature, verifyReleaseControlSignature } from "../lib/release-control.ts";

test("release pricing fixture matches totals and the complete calculation trace", () => {
  const result = runReleasePricingAssurance();
  assert.equal(result.ok, true);
  assert.deepEqual(result.actual, EXPECTED_RELEASE_PRICING_TRACE);
  assert.deepEqual(result.actual.lines.map((line) => line.trace.map((step) => step.label)), [
    ["Base and quantity", "High complexity", "Rush", "Presentation rounding"],
    ["Base and quantity", "High complexity", "Rush", "Presentation rounding"],
  ]);
});

test("release migrations are ordered, additive and block destructive SQL", () => {
  assert.deepEqual(destructiveStatements(RELEASE_MIGRATIONS), []);
  assert.deepEqual(destructiveStatements([{
    id: "20260816_999_bad",
    description: "unsafe",
    backwardCompatible: true,
    statements: ["ALTER TABLE quotes DROP COLUMN total_minor"],
  }]).map((entry) => entry.migration), ["20260816_999_bad"]);
});

test("release identity signatures are scoped, time-bound and tamper evident", async () => {
  const now = Date.now();
  const message = { timestamp: String(now), method: "GET", pathname: "/api/internal/release", commit: "a".repeat(40), body: "" };
  const signature = await createReleaseControlSignature("a sufficiently long release control secret", message);
  assert.equal(await verifyReleaseControlSignature("a sufficiently long release control secret", message, signature, now), true);
  assert.equal(await verifyReleaseControlSignature("a sufficiently long release control secret", { ...message, commit: "b".repeat(40) }, signature, now), false);
  assert.equal(await verifyReleaseControlSignature("a sufficiently long release control secret", message, signature, now + 5 * 60_000 + 1), false);
});

test("successful main builds promote automatically through dev, test and preprod only", () => {
  const workflows = [
    ["deploy-dev.yml", "QuoteBench CI", "dev"],
    ["deploy-test.yml", "Deploy QuoteBench to dev", "test"],
    ["deploy-preprod.yml", "Deploy QuoteBench to test", "preprod"],
  ];

  for (const [file, prerequisite, target] of workflows) {
    const workflow = readFileSync(new URL(`../.github/workflows/${file}`, import.meta.url), "utf8");
    assert.match(workflow, new RegExp(`workflows: \\[\"${prerequisite}\"\\]`));
    assert.match(workflow, /if: github\.event\.workflow_run\.conclusion == 'success'/);
    assert.match(workflow, /commit: \$\{\{ github\.event\.workflow_run\.head_sha \}\}/);
    assert.match(workflow, new RegExp(`target: ${target}`));
    assert.doesNotMatch(workflow, /target: production/);
  }

  const promotion = readFileSync(new URL("../.github/workflows/promote.yml", import.meta.url), "utf8");
  assert.match(promotion, /workflow_dispatch:/);
  assert.match(promotion, /options: \[dev, test, preprod, production\]/);
  assert.match(promotion, /environment:\s+name: \$\{\{ inputs\.target \}\}/);
});

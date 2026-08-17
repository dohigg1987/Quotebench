import assert from "node:assert/strict";
import test from "node:test";
import { buildActivityInsights } from "../lib/activity-insights.ts";

const now = new Date("2026-08-17T12:00:00Z");

test("activity insights report real recipient engagement without inventing empty data", () => {
  const empty = buildActivityInsights([], now);
  assert.equal(empty.activeRecipients, 0);
  assert.equal(empty.engagedRecipients, 0);
  assert.equal(empty.totalOpens, 0);
  assert.equal(empty.days.length, 14);
  assert.deepEqual(empty.attention, []);
});

test("activity insights aggregate opens, dwell, daily recipients and strongest quote", () => {
  const insights = buildActivityInsights([
    { quote_reference:"QB-1001", recipient_id:"r1", event_type:"open", section:null, duration_ms:null, created_at:"2026-08-17 09:00:00", recipient_status:"Delivered", signed_at:null, expires_at:"2026-09-01", client_name:"Acme Corp" },
    { quote_reference:"QB-1001", recipient_id:"r1", event_type:"section_heartbeat", section:"pricing", duration_ms:42_000, created_at:"2026-08-17 09:01:00", recipient_status:"Delivered", signed_at:null, expires_at:"2026-09-01", client_name:"Acme Corp" },
    { quote_reference:"QB-1002", recipient_id:"r2", event_type:"open", section:null, duration_ms:null, created_at:"2026-08-16 09:00:00", recipient_status:"Delivered", signed_at:null, expires_at:"2026-09-01", client_name:"Beta Ltd" },
    { quote_reference:"QB-1002", recipient_id:"r2", event_type:"section_heartbeat", section:"scope", duration_ms:10_000, created_at:"2026-08-16 09:01:00", recipient_status:"Delivered", signed_at:null, expires_at:"2026-09-01", client_name:"Beta Ltd" },
    { quote_reference:"QB-1003", recipient_id:"r3", event_type:"email_delivered", section:null, duration_ms:null, created_at:"2026-08-17 08:00:00", recipient_status:"Delivered", signed_at:null, expires_at:null, client_name:"Not engagement" },
  ], now);
  assert.equal(insights.activeRecipients, 2);
  assert.equal(insights.engagedRecipients, 2);
  assert.equal(insights.totalOpens, 2);
  assert.equal(insights.totalDwellMs, 52_000);
  assert.equal(insights.days.at(-1).recipients, 1);
  assert.equal(insights.days.at(-1).opens, 1);
  assert.equal(insights.attention[0].quoteReference, "QB-1001");
  assert.deepEqual(insights.attention[0].sections, [{ section:"pricing", dwellMs:42_000 }]);
});

test("signed, expired and revoked recipients are not described as actively reviewing", () => {
  const common = { quote_reference:"QB-1001", event_type:"open", section:null, duration_ms:null, created_at:"2026-08-17 09:00:00", client_name:"Acme" };
  const insights = buildActivityInsights([
    { ...common, recipient_id:"signed", recipient_status:"Delivered", signed_at:"2026-08-17", expires_at:null },
    { ...common, recipient_id:"expired", recipient_status:"Delivered", signed_at:null, expires_at:"2026-08-01" },
    { ...common, recipient_id:"revoked", recipient_status:"Revoked", signed_at:null, expires_at:null },
  ], now);
  assert.equal(insights.activeRecipients, 0);
  assert.equal(insights.engagedRecipients, 3);
});


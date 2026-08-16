import assert from "node:assert/strict";
import test from "node:test";
import { translateSql } from "../db/database.ts";

test("Postgres compatibility translates bound values without touching literals", () => {
  const sql = translateSql("SELECT '?' AS literal, value FROM records WHERE tenant_id=? AND status=?");
  assert.equal(sql, "SELECT '?' AS literal, value FROM records WHERE tenant_id=$1 AND status=$2");
});

test("Postgres compatibility translates SQLite conflict and time expressions", () => {
  assert.equal(
    translateSql("INSERT OR IGNORE INTO records (id) VALUES (?)"),
    "INSERT INTO records (id) VALUES ($1) ON CONFLICT DO NOTHING",
  );
  const sql = translateSql("SELECT * FROM records WHERE created_at>=datetime('now','start of month') AND expires_at<datetime('now',?)");
  assert.match(sql, /date_trunc\('month', CURRENT_TIMESTAMP\)/);
  assert.match(sql, /CURRENT_TIMESTAMP \+ \$1::interval/);
});

test("Postgres compatibility maps schema timestamps and table discovery", () => {
  const schema = translateSql("CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, expires_at TEXT)");
  assert.match(schema, /created_at TIMESTAMPTZ/);
  assert.match(schema, /expires_at TIMESTAMPTZ/);
  assert.match(translateSql("SELECT name FROM sqlite_master WHERE type='table'"), /information_schema\.tables/);
});

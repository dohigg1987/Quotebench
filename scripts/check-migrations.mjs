import process from "node:process";
import { destructiveStatements, RELEASE_MIGRATIONS } from "../db/release-migrations.ts";

const ids = new Set();
for (const migration of RELEASE_MIGRATIONS) {
  if (!/^\d{8}_\d{3}_[a-z0-9_]+$/.test(migration.id)) throw new Error(`Migration id ${migration.id} is not ordered and stable.`);
  if (ids.has(migration.id)) throw new Error(`Duplicate migration id ${migration.id}.`);
  if (migration.backwardCompatible !== true) throw new Error(`Migration ${migration.id} is not marked backward-compatible.`);
  if (migration.statements.length === 0) throw new Error(`Migration ${migration.id} has no statements.`);
  ids.add(migration.id);
}

const destructive = destructiveStatements();
if (destructive.length > 0 && process.env.ALLOW_DESTRUCTIVE_MIGRATIONS !== "true") {
  for (const item of destructive) console.error(`${item.migration}: ${item.statement.replace(/\s+/g, " ").trim()}`);
  throw new Error("Destructive migration blocked. A manual, audited run must set ALLOW_DESTRUCTIVE_MIGRATIONS=true.");
}
if (destructive.length > 0) console.warn(`AUDITED OVERRIDE: allowing ${destructive.length} destructive migration statement(s).`);
console.log(`Validated ${RELEASE_MIGRATIONS.length} ordered, backward-compatible migration(s).`);

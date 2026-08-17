import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { extname, join } from "node:path";
import test from "node:test";

function sourceFiles(path) {
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const child = join(path, entry.name);
    if (entry.isDirectory()) return [".git", ".next", "dist", "node_modules"].includes(entry.name) ? [] : sourceFiles(child);
    return [child];
  });
}

test("product source contains no double-encoded UTF-8 text", () => {
  const extensions = new Set([".css", ".html", ".js", ".json", ".md", ".mjs", ".ts", ".tsx", ".txt", ".yml", ".yaml"]);
  const mojibake = /\u00c3|\u00c2|\u00e2(?:\u20ac|\u2020|\u0153|\u02c6)|\ufffd/u;
  const roots = ["app", "db", "lib", "packages", "public", "scripts", "tests", "worker"];
  const affected = roots.flatMap(sourceFiles).filter((file) => extensions.has(extname(file)) && mojibake.test(readFileSync(file, "utf8")));
  assert.deepEqual(affected, [], `Mojibake detected in: ${affected.join(", ")}`);
});

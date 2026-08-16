import assert from "node:assert/strict";
import test from "node:test";
import { validateStoredFile } from "../db/document-store.ts";

test("accepts a correctly signed PNG image", async () => {
  const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
  await assert.doesNotReject(validateStoredFile(new File([bytes], "logo.png", { type: "image/png" }), "logo"));
});

test("rejects active SVG content and disguised files", async () => {
  await assert.rejects(
    validateStoredFile(new File(["<svg><script>alert(1)</script></svg>"], "logo.svg", { type: "image/svg+xml" }), "logo"),
    /not supported/,
  );
  await assert.rejects(
    validateStoredFile(new File(["not a pdf"], "terms.pdf", { type: "application/pdf" }), "attachment"),
    /does not match/,
  );
});

test("rejects null bytes in plain-text attachments", async () => {
  await assert.rejects(
    validateStoredFile(new File([new Uint8Array([65, 0, 66])], "note.txt", { type: "text/plain" }), "attachment"),
    /does not match/,
  );
});

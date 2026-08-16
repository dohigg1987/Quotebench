export type ReleaseControlMessage = {
  timestamp: string;
  method: string;
  pathname: string;
  commit: string;
  body: string;
};

function canonical(message: ReleaseControlMessage) {
  return [message.timestamp, message.method.toUpperCase(), message.pathname, message.commit, message.body].join("\n");
}

function hex(bytes: ArrayBuffer) {
  return [...new Uint8Array(bytes)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

export async function createReleaseControlSignature(secret: string, message: ReleaseControlMessage) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", key, encoder.encode(canonical(message))));
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

export async function verifyReleaseControlSignature(secret: string, message: ReleaseControlMessage, supplied: string, now = Date.now()) {
  const timestamp = Number(message.timestamp);
  if (!Number.isSafeInteger(timestamp) || Math.abs(now - timestamp) > 5 * 60_000) return false;
  const expected = await createReleaseControlSignature(secret, message);
  return constantTimeEqual(expected, supplied.toLowerCase());
}

type OAuthState = {
  connectionId: string;
  tenantId: string;
  provider: string;
  expiresAt: number;
  nonce: string;
};

function encode(value: string) {
  return btoa(value).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function decode(value: string) {
  const padded =
    value.replaceAll("-", "+").replaceAll("_", "/") +
    "=".repeat((4 - (value.length % 4)) % 4);
  return atob(padded);
}

async function signingKey() {
  const { env } = (await import("cloudflare:workers")) as {
    env: Record<string, unknown>;
  };
  const secret = String(env.INTEGRATION_ENCRYPTION_KEY ?? env.COOKIE_ENCRYPTION_KEY ?? "");

  if (secret.length < 32) {
    throw new Error("Connector OAuth signing secret is not configured.");
  }

  const scoped = new TextEncoder().encode(`quotebench:oauth-state:v1:${secret}`);
  return crypto.subtle.importKey(
    "raw",
    scoped,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function createOAuthState(input: Omit<OAuthState, "expiresAt" | "nonce">) {
  const payload: OAuthState = {
    ...input,
    expiresAt: Date.now() + 10 * 60_000,
    nonce: crypto.randomUUID(),
  };
  const encoded = encode(JSON.stringify(payload));
  const signature = new Uint8Array(
    await crypto.subtle.sign("HMAC", await signingKey(), new TextEncoder().encode(encoded)),
  );
  return `${encoded}.${encode(String.fromCharCode(...signature))}`;
}

export async function verifyOAuthState(value: string) {
  const [encoded, signature] = value.split(".");

  if (!encoded || !signature) {
    return null;
  }

  const valid = await crypto.subtle.verify(
    "HMAC",
    await signingKey(),
    Uint8Array.from(decode(signature), (character) => character.charCodeAt(0)),
    new TextEncoder().encode(encoded),
  );

  if (!valid) {
    return null;
  }

  const payload = JSON.parse(decode(encoded)) as OAuthState;
  if (
    !payload.connectionId ||
    !payload.tenantId ||
    !payload.provider ||
    payload.expiresAt < Date.now()
  ) {
    return null;
  }

  return payload;
}


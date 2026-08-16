/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";

interface Env {
  ASSETS: Fetcher;
  DB?: D1Database;
  HYPERDRIVE?: Hyperdrive;
  DATABASE_URL?: string;
  PDF_QUEUE?: Queue;
  APP_ENV?: string;
  BUILD_COMMIT_SHA?: string;
  BUILD_ARTIFACT_SHA256?: string;
  CF_VERSION_METADATA?: WorkerVersionMetadata;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    const stateChanging = ["POST", "PUT", "PATCH", "DELETE"].includes(request.method.toUpperCase());
    const webhookExempt = url.pathname === "/api/billing/webhook" || url.pathname === "/api/internal/release";
    const requestOrigin = request.headers.get("origin");
    const fetchSite = request.headers.get("sec-fetch-site");
    const crossOrigin = requestOrigin ? requestOrigin !== url.origin : fetchSite === "cross-site";
    const missingBrowserProvenance = !requestOrigin && !fetchSite;
    const rejected = url.pathname.startsWith("/api/") && stateChanging && !webhookExempt && (crossOrigin || missingBrowserProvenance);
    let response: Response;
    try {
      response = rejected
        ? Response.json({ error: "Request origin could not be verified." }, { status: 403 })
        : await handler.fetch(request, env, ctx);
    } catch (error) {
      console.error(JSON.stringify({ event: "request.unhandled_error", environment: env.APP_ENV, path: url.pathname, requestId: request.headers.get("x-request-id"), error: error instanceof Error ? error.message : "unknown" }));
      throw error;
    }
    const secured = new Response(response.body, response);
    secured.headers.set("strict-transport-security", "max-age=31536000; includeSubDomains");
    secured.headers.set("x-content-type-options", "nosniff");
    secured.headers.set("referrer-policy", "strict-origin-when-cross-origin");
    secured.headers.set("permissions-policy", "camera=(), microphone=(), geolocation=(), payment=()");
    secured.headers.set("content-security-policy", "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; img-src 'self' data: blob:; font-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; upgrade-insecure-requests");
    secured.headers.set("x-request-id", request.headers.get("x-request-id") ?? crypto.randomUUID());
    if (url.pathname.startsWith("/api/")) secured.headers.set("cache-control", "no-store");
    return secured;
  },
  async scheduled(_controller: ScheduledController, _env: Env, ctx: ExecutionContext) {
    ctx.waitUntil((async () => {
      const [{ processDueWebhookRetries }, { runRetentionJobs }] = await Promise.all([import("../db/integration-store"), import("../db/maintenance-store")]);
      await Promise.all([processDueWebhookRetries(), runRetentionJobs()]);
    })());
  },
  async queue(batch: MessageBatch, _env: Env): Promise<void> {
    const { processPdfJob } = await import("../lib/pdf-jobs");
    for (const message of batch.messages) {
      try {
        await processPdfJob(message.body as import("../lib/pdf-jobs").PdfJobMessage);
        message.ack();
      } catch {
        message.retry({ delaySeconds: Math.min(300, 15 * 2 ** Math.min(message.attempts, 4)) });
      }
    }
  },
};

export default worker;

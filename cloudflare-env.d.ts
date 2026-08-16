interface QuoteBenchImagesBinding {
  input(stream: ReadableStream): {
    transform(options: Record<string, unknown>): {
      output(options: {
        format: string;
        quality: number;
      }): Promise<{ response(): Response }>;
    };
  };
}

declare namespace Cloudflare {
  interface Env {
    ASSETS: Fetcher;
    BUCKET: R2Bucket;
    DB: D1Database;
    IMAGES: QuoteBenchImagesBinding;
    EMAIL_API_ENDPOINT?: string;
    EMAIL_API_KEY?: string;
    EMAIL_FROM_ADDRESS?: string;
    OPERATOR_EMAIL_SHA256?: string;
    PUBLIC_SITE_URL?: string;
    STRIPE_PRICE_ID?: string;
    STRIPE_PRICE_STARTER?: string;
    STRIPE_PRICE_PROFESSIONAL?: string;
    STRIPE_PRICE_SCALE?: string;
    STRIPE_SECRET_KEY?: string;
    STRIPE_WEBHOOK_SECRET?: string;
  }
}

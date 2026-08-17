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
    [key: string]: unknown;
    ASSETS: Fetcher;
    BUCKET: R2Bucket;
    DB?: D1Database;
    HYPERDRIVE?: Hyperdrive;
    DATABASE_URL?: string;
    PDF_QUEUE?: Queue;
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
    INTEGRATION_ENCRYPTION_KEY?: string;
    COOKIE_ENCRYPTION_KEY?: string;
    HUBSPOT_CLIENT_ID?: string;
    HUBSPOT_CLIENT_SECRET?: string;
    SALESFORCE_CLIENT_ID?: string;
    SALESFORCE_CLIENT_SECRET?: string;
    XERO_CLIENT_ID?: string;
    XERO_CLIENT_SECRET?: string;
    QUICKBOOKS_CLIENT_ID?: string;
    QUICKBOOKS_CLIENT_SECRET?: string;
  }
}


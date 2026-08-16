import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const tenants = sqliteTable("tenants", {
  id: text("id").primaryKey(), name: text("name").notNull(), currency: text("currency").notNull(),
  status: text("status", { enum: ["Active", "SoftDeleted"] }).notNull().default("Active"),
  trackingEnabled: integer("tracking_enabled", { mode: "boolean" }).notNull().default(true),
  deletedAt: text("deleted_at"), purgeAfter: text("purge_after"), billingAnniversaryDay: integer("billing_anniversary_day").notNull().default(1),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`), updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const securityEvents = sqliteTable("security_events", {
  id: text("id").primaryKey(), tenantId: text("tenant_id"), actorEmail: text("actor_email"), eventType: text("event_type").notNull(),
  resourceType: text("resource_type"), resourceId: text("resource_id"), outcome: text("outcome").notNull(), detailsJson: text("details_json").notNull().default("{}"),
  requestId: text("request_id"), createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("security_events_tenant_created_idx").on(table.tenantId, table.createdAt)]);

export const rateLimits = sqliteTable("rate_limits", {
  bucketKey: text("bucket_key").primaryKey(), windowStartedAt: text("window_started_at").notNull(), count: integer("count").notNull(), expiresAt: text("expires_at").notNull(),
});

export const meteredEvents = sqliteTable("metered_events", {
  id: text("id").primaryKey(), tenantId: text("tenant_id").notNull(), metric: text("metric").notNull(), quantity: integer("quantity").notNull().default(1),
  sourceId: text("source_id").notNull(), occurredAt: text("occurred_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex("metered_events_tenant_metric_source_unique").on(table.tenantId, table.metric, table.sourceId), index("metered_events_tenant_time_idx").on(table.tenantId, table.occurredAt)]);

export const quotes = sqliteTable(
  "quotes",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    ownerEmail: text("owner_email").notNull(),
    clientId: text("client_id"),
    reference: text("reference").notNull(),
    clientName: text("client_name").notNull(),
    contactName: text("contact_name").notNull(),
    contactEmail: text("contact_email"),
    validUntil: text("valid_until").notNull(),
    status: text("status", { enum: ["Draft", "Ready", "Issued", "Viewed", "Accepted", "Declined", "Expired", "Superseded"] }).notNull(),
    currency: text("currency").notNull().default("GBP"),
    oneOffTotalMinor: integer("one_off_total_minor").notNull(),
    recurringAnnualisedMinor: integer("recurring_annualised_minor").notNull(),
    marginBp: integer("margin_bp"),
    lineItemsJson: text("line_items_json").notNull(),
    answersJson: text("answers_json").notNull(),
    pricingSnapshotJson: text("pricing_snapshot_json").notNull(),
    documentJson: text("document_json").notNull().default("{}"),
    ruleSetId: text("rule_set_id").notNull(),
    ruleSetVersion: integer("rule_set_version").notNull(),
    shareToken: text("share_token").unique(),
    issuedAt: text("issued_at"),
    firstViewedAt: text("first_viewed_at"),
    acceptedAt: text("accepted_at"),
    acceptedBy: text("accepted_by"),
    acceptanceEvidenceJson: text("acceptance_evidence_json"),
    acceptanceSnapshotJson: text("acceptance_snapshot_json"),
    revisionOf: text("revision_of"),
    supersededBy: text("superseded_by"),
    declinedAt: text("declined_at"),
    declineReason: text("decline_reason"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("quotes_tenant_reference_unique").on(table.tenantId, table.reference),
    index("quotes_tenant_updated_idx").on(table.tenantId, table.updatedAt),
  ],
);

export const quoteEvents = sqliteTable(
  "quote_events",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    quoteReference: text("quote_reference").notNull(),
    actorEmail: text("actor_email").notNull(),
    eventType: text("event_type", { enum: ["quote.saved", "quote.ready", "quote.issued", "quote.viewed", "quote.accepted", "quote.declined", "quote.expired", "quote.superseded"] }).notNull(),
    payloadJson: text("payload_json").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("quote_events_tenant_created_idx").on(table.tenantId, table.createdAt)],
);

export const clients = sqliteTable(
  "clients",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    name: text("name").notNull(),
    contactName: text("contact_name").notNull(),
    contactEmail: text("contact_email").notNull(),
    status: text("status", { enum: ["Active", "Archived"] }).notNull().default("Active"),
    createdBy: text("created_by").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("clients_tenant_email_unique").on(table.tenantId, table.contactEmail),
    index("clients_tenant_name_idx").on(table.tenantId, table.name),
  ],
);

export const workspaceEntitlements = sqliteTable("workspace_entitlements", {
  tenantId: text("tenant_id").primaryKey(),
  planName: text("plan_name").notNull().default("Professional"),
  monthlyQuoteLimit: integer("monthly_quote_limit").notNull().default(50),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const workspaceMembers = sqliteTable(
  "workspace_members",
  {
    tenantId: text("tenant_id").notNull(),
    email: text("email").notNull(),
    displayName: text("display_name").notNull(),
    role: text("role", { enum: ["owner", "admin", "quoter"] }).notNull(),
    status: text("status", { enum: ["Active", "Invited", "Removed"] }).notNull(),
    invitedBy: text("invited_by"),
    invitedAt: text("invited_at"),
    expiresAt: text("expires_at"),
    joinedAt: text("joined_at"),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("workspace_members_tenant_email_unique").on(table.tenantId, table.email),
    index("workspace_members_tenant_status_idx").on(table.tenantId, table.status),
  ],
);

export const brandProfiles = sqliteTable(
  "brand_profiles",
  {
    id: text("id").primaryKey(), tenantId: text("tenant_id").notNull(), name: text("name").notNull(),
    logoFileId: text("logo_file_id"), primaryColor: text("primary_color").notNull().default("#205b63"),
    typeface: text("typeface").notNull().default("Inter"), sendingName: text("sending_name").notNull(),
    replyTo: text("reply_to").notNull(), sendingDomain: text("sending_domain"),
    domainVerified: integer("domain_verified", { mode: "boolean" }).notNull().default(false),
    whiteLabel: integer("white_label", { mode: "boolean" }).notNull().default(false),
    isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`), updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [uniqueIndex("brand_profiles_tenant_name_unique").on(table.tenantId, table.name)],
);

export const documentTemplates = sqliteTable(
  "document_templates",
  {
    id: text("id").primaryKey(), tenantId: text("tenant_id").notNull(), name: text("name").notNull(),
    industry: text("industry"), blocksJson: text("blocks_json").notNull(), isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false),
    createdBy: text("created_by").notNull(), createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [uniqueIndex("document_templates_tenant_name_unique").on(table.tenantId, table.name)],
);

export const storedFiles = sqliteTable(
  "stored_files",
  {
    id: text("id").primaryKey(), tenantId: text("tenant_id").notNull(), quoteReference: text("quote_reference"),
    kind: text("kind", { enum: ["logo", "image", "attachment", "pdf"] }).notNull(), filename: text("filename").notNull(),
    contentType: text("content_type").notNull(), sizeBytes: integer("size_bytes").notNull(), r2Key: text("r2_key").notNull(),
    public: integer("public", { mode: "boolean" }).notNull().default(false), expiresAt: text("expires_at"),
    createdBy: text("created_by").notNull(), createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("stored_files_tenant_quote_idx").on(table.tenantId, table.quoteReference)],
);

export const pdfJobs = sqliteTable(
  "pdf_jobs",
  {
    id: text("id").primaryKey(), tenantId: text("tenant_id").notNull(), quoteReference: text("quote_reference").notNull(),
    status: text("status", { enum: ["Queued", "Processing", "Completed", "Failed"] }).notNull(), attempts: integer("attempts").notNull().default(0),
    fileId: text("file_id"), error: text("error"), requestedBy: text("requested_by").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`), updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("pdf_jobs_tenant_quote_idx").on(table.tenantId, table.quoteReference)],
);

export const quoteRecipients = sqliteTable(
  "quote_recipients",
  {
    id: text("id").primaryKey(), tenantId: text("tenant_id").notNull(), quoteReference: text("quote_reference").notNull(),
    name: text("name").notNull(), email: text("email").notNull(), token: text("token").notNull(),
    status: text("status", { enum: ["Queued", "Delivered", "Bounced", "Complained", "Revoked"] }).notNull(),
    signerRole: text("signer_role", { enum: ["signatory", "approver", "countersignatory", "viewer"] }).notNull().default("signatory"),
    signingOrder: integer("signing_order").notNull().default(1), signatureRequired: integer("signature_required", { mode: "boolean" }).notNull().default(true),
    signedAt: text("signed_at"), acceptedName: text("accepted_name"), signatureEvidenceJson: text("signature_evidence_json"), expiresAt: text("expires_at"),
    reminderIntervalDays: integer("reminder_interval_days").notNull().default(3), nextReminderAt: text("next_reminder_at"), reminderCount: integer("reminder_count").notNull().default(0),
    deliveredAt: text("delivered_at"), firstViewedAt: text("first_viewed_at"), revokedAt: text("revoked_at"),
    lastSentAt: text("last_sent_at"), createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [uniqueIndex("quote_recipients_token_unique").on(table.token), index("quote_recipients_quote_idx").on(table.tenantId, table.quoteReference)],
);

export const trackingEvents = sqliteTable(
  "tracking_events",
  {
    id: text("id").primaryKey(), tenantId: text("tenant_id").notNull(), quoteReference: text("quote_reference").notNull(),
    recipientId: text("recipient_id"), eventType: text("event_type").notNull(), section: text("section"),
    durationMs: integer("duration_ms"), deviceHash: text("device_hash"), coarseLocation: text("coarse_location"),
    payloadJson: text("payload_json").notNull().default("{}"), createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("tracking_events_quote_created_idx").on(table.tenantId, table.quoteReference, table.createdAt)],
);

export const onboardingState = sqliteTable(
  "onboarding_state",
  {
    tenantId: text("tenant_id").notNull(), userEmail: text("user_email").notNull(),
    selectedTemplate: text("selected_template"), status: text("status", { enum: ["NotStarted", "InProgress", "Completed", "Skipped"] }).notNull(),
    walkthroughStep: integer("walkthrough_step").notNull().default(0), completedAt: text("completed_at"),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [uniqueIndex("onboarding_state_tenant_user_unique").on(table.tenantId, table.userEmail)],
);

export const personalTemplates = sqliteTable(
  "personal_templates",
  {
    id: text("id").primaryKey(), tenantId: text("tenant_id").notNull(), name: text("name").notNull(),
    snapshotJson: text("snapshot_json").notNull(), createdBy: text("created_by").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [uniqueIndex("personal_templates_tenant_name_unique").on(table.tenantId, table.name)],
);

export const apiKeys = sqliteTable(
  "api_keys",
  {
    id: text("id").primaryKey(), tenantId: text("tenant_id").notNull(), name: text("name").notNull(),
    prefix: text("prefix").notNull(), keyHash: text("key_hash").notNull(), scopesJson: text("scopes_json").notNull(),
    revokedAt: text("revoked_at"), lastUsedAt: text("last_used_at"), createdBy: text("created_by").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [uniqueIndex("api_keys_hash_unique").on(table.keyHash), index("api_keys_tenant_idx").on(table.tenantId)],
);

export const webhookEndpoints = sqliteTable(
  "webhook_endpoints",
  {
    id: text("id").primaryKey(), tenantId: text("tenant_id").notNull(), name: text("name").notNull(), url: text("url").notNull(),
    secret: text("secret").notNull(), eventsJson: text("events_json").notNull(), includeMonetary: integer("include_monetary", { mode: "boolean" }).notNull().default(false),
    status: text("status", { enum: ["Active", "Disabled"] }).notNull(), failureStartedAt: text("failure_started_at"), createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`), updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("webhook_endpoints_tenant_idx").on(table.tenantId)],
);

export const webhookDeliveries = sqliteTable(
  "webhook_deliveries",
  {
    id: text("id").primaryKey(), tenantId: text("tenant_id").notNull(), endpointId: text("endpoint_id").notNull(), eventType: text("event_type").notNull(), payloadJson: text("payload_json").notNull(), status: text("status").notNull(), attemptCount: integer("attempt_count").notNull().default(0), responseStatus: integer("response_status"), responseBody: text("response_body"), nextRetryAt: text("next_retry_at"), createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`), updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("webhook_deliveries_tenant_idx").on(table.tenantId, table.createdAt)],
);

export const apiAccessLog = sqliteTable("api_access_log", { id: text("id").primaryKey(), tenantId: text("tenant_id"), keyPrefix: text("key_prefix"), resource: text("resource").notNull(), outcome: text("outcome").notNull(), createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`) });

export const dealCodes = sqliteTable("deal_codes", { codeHash: text("code_hash").primaryKey(), tier: integer("tier").notNull(), campaign: text("campaign").notNull(), redeemedTenantId: text("redeemed_tenant_id"), redeemedAt: text("redeemed_at") });
export const dealRedemptions = sqliteTable("deal_redemptions", { id: text("id").primaryKey(), tenantId: text("tenant_id").notNull(), codeHash: text("code_hash").notNull(), tierContribution: integer("tier_contribution").notNull(), redeemedBy: text("redeemed_by").notNull(), redeemedAt: text("redeemed_at").notNull().default(sql`CURRENT_TIMESTAMP`) }, (table) => [index("deal_redemptions_tenant_idx").on(table.tenantId)]);
export const billingSubscriptions = sqliteTable("billing_subscriptions", { tenantId: text("tenant_id").primaryKey(), stripeCustomerId: text("stripe_customer_id"), stripeSubscriptionId: text("stripe_subscription_id"), planName: text("plan_name"), status: text("status"), currentPeriodEnd: text("current_period_end"), paymentFailureAt: text("payment_failure_at"), updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`) });
export const tenantCohorts = sqliteTable("tenant_cohorts", { tenantId: text("tenant_id").primaryKey(), cohort: text("cohort").notNull(), lifetimeTier: integer("lifetime_tier").notNull().default(0), joinedAt: text("joined_at").notNull().default(sql`CURRENT_TIMESTAMP`) });

export const catalogueItems = sqliteTable(
  "catalogue_items",
  {
    tenantId: text("tenant_id").notNull(),
    id: text("id").notNull(),
    categoryId: text("category_id").notNull(),
    subcategoryId: text("subcategory_id"),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    serviceSchedule: text("service_schedule").notNull().default(""),
    serviceTerms: text("service_terms").notNull().default(""),
    unitLabel: text("unit_label").notNull(),
    pricingBasis: text("pricing_basis", { enum: ["fixed", "per_unit", "cost_plus", "retainer", "usage"] }).notNull(),
    cpqJson: text("cpq_json").notNull().default("{}"),
    basePriceMinor: integer("base_price_minor"),
    costMinor: integer("cost_minor"),
    targetMarginBp: integer("target_margin_bp"),
    recurrence: text("recurrence", { enum: ["one_off", "weekly", "fortnightly", "monthly", "quarterly", "annually"] }).notNull(),
    minQuantity: integer("min_quantity"),
    maxQuantity: integer("max_quantity"),
    updatedBy: text("updated_by").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("catalogue_items_tenant_id_unique").on(table.tenantId, table.id),
    index("catalogue_items_tenant_name_idx").on(table.tenantId, table.name),
  ],
);

export const serviceCategories = sqliteTable(
  "service_categories",
  {
    tenantId: text("tenant_id").notNull(), id: text("id").notNull(), name: text("name").notNull(),
    parentId: text("parent_id"), sortOrder: integer("sort_order").notNull().default(0),
    active: integer("active", { mode: "boolean" }).notNull().default(true), updatedBy: text("updated_by").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`), updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [uniqueIndex("service_categories_tenant_id_unique").on(table.tenantId, table.id), index("service_categories_tenant_parent_idx").on(table.tenantId, table.parentId, table.sortOrder)],
);

export const proposalTypes = sqliteTable(
  "proposal_types",
  {
    tenantId: text("tenant_id").notNull(), id: text("id").notNull(), name: text("name").notNull(),
    description: text("description").notNull().default(""), active: integer("active", { mode: "boolean" }).notNull().default(true),
    updatedBy: text("updated_by").notNull(), createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [uniqueIndex("proposal_types_tenant_id_unique").on(table.tenantId, table.id), index("proposal_types_tenant_name_idx").on(table.tenantId, table.name)],
);

export const catalogueItemProposalTypes = sqliteTable(
  "catalogue_item_proposal_types",
  {
    tenantId: text("tenant_id").notNull(), itemId: text("item_id").notNull(), proposalTypeId: text("proposal_type_id").notNull(),
    defaultIncluded: integer("default_included", { mode: "boolean" }).notNull().default(false),
  },
  (table) => [uniqueIndex("catalogue_item_proposal_types_unique").on(table.tenantId, table.itemId, table.proposalTypeId), index("catalogue_item_proposal_types_type_idx").on(table.tenantId, table.proposalTypeId)],
);

export const pricingRuleSets = sqliteTable(
  "pricing_rule_sets",
  {
    tenantId: text("tenant_id").notNull(),
    id: text("id").notNull(),
    version: integer("version").notNull(),
    status: text("status", { enum: ["Draft", "Published", "Archived"] }).notNull(),
    ruleJson: text("rule_json").notNull(),
    updatedBy: text("updated_by").notNull(),
    publishedAt: text("published_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("pricing_rule_sets_tenant_version_unique").on(table.tenantId, table.id, table.version),
    index("pricing_rule_sets_tenant_status_idx").on(table.tenantId, table.status),
  ],
);

export const engagementContent = sqliteTable("engagement_content", {
  id: text("id").primaryKey(), tenantId: text("tenant_id").notNull(), contentGroupId: text("content_group_id").notNull(),
  kind: text("kind", { enum: ["engagement_letter", "service_schedule", "master_terms", "jurisdiction_clause", "clause"] }).notNull(),
  name: text("name").notNull(), jurisdiction: text("jurisdiction").notNull().default("England and Wales"), version: integer("version").notNull().default(1),
  status: text("status", { enum: ["Draft", "Published", "Retired"] }).notNull().default("Draft"), content: text("content").notNull(),
  mandatory: integer("mandatory", { mode: "boolean" }).notNull().default(false), proposalTypeIdsJson: text("proposal_type_ids_json").notNull().default("[]"),
  effectiveFrom: text("effective_from"), checksum: text("checksum"), createdBy: text("created_by").notNull(), publishedBy: text("published_by"), publishedAt: text("published_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`), updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex("engagement_content_group_version_unique").on(table.tenantId, table.contentGroupId, table.version), index("engagement_content_tenant_status_idx").on(table.tenantId, table.status, table.kind)]);

export const aiProviderConfigs = sqliteTable("ai_provider_configs", {
  tenantId: text("tenant_id").primaryKey(), providerName: text("provider_name").notNull(), endpointUrl: text("endpoint_url").notNull(), model: text("model").notNull(),
  credentialCiphertext: text("credential_ciphertext"), enabledFeaturesJson: text("enabled_features_json").notNull().default("[]"), updatedBy: text("updated_by").notNull(),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

CREATE TABLE `billing_subscriptions` (
	`tenant_id` text PRIMARY KEY NOT NULL,
	`stripe_customer_id` text,
	`stripe_subscription_id` text,
	`plan_name` text,
	`status` text,
	`current_period_end` text,
	`payment_failure_at` text,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `deal_codes` (
	`code_hash` text PRIMARY KEY NOT NULL,
	`tier` integer NOT NULL,
	`campaign` text NOT NULL,
	`redeemed_tenant_id` text,
	`redeemed_at` text
);
--> statement-breakpoint
CREATE TABLE `deal_redemptions` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`code_hash` text NOT NULL,
	`tier_contribution` integer NOT NULL,
	`redeemed_by` text NOT NULL,
	`redeemed_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `deal_redemptions_tenant_idx` ON `deal_redemptions` (`tenant_id`);--> statement-breakpoint
CREATE TABLE `tenant_cohorts` (
	`tenant_id` text PRIMARY KEY NOT NULL,
	`cohort` text NOT NULL,
	`lifetime_tier` integer DEFAULT 0 NOT NULL,
	`joined_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);

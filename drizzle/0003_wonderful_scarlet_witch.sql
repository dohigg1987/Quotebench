CREATE TABLE `workspace_entitlements` (
	`tenant_id` text PRIMARY KEY NOT NULL,
	`plan_name` text DEFAULT 'Professional' NOT NULL,
	`monthly_quote_limit` integer DEFAULT 50 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);

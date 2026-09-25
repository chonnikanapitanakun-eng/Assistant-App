CREATE TABLE `calendar_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`synced_at` integer,
	`email` text NOT NULL,
	`color` text NOT NULL,
	`status` text DEFAULT 'ok' NOT NULL,
	`last_synced_at` integer
);
--> statement-breakpoint
ALTER TABLE `calendar_events` ADD `account_id` text;--> statement-breakpoint
CREATE INDEX `calendar_events_account_idx` ON `calendar_events` (`account_id`,`external_id`);
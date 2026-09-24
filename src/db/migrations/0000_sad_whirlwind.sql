CREATE TABLE `areas` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`synced_at` integer,
	`name_th` text NOT NULL,
	`name_en` text NOT NULL,
	`parent_id` text,
	`color` text,
	`icon` text,
	`sort_order` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `calendar_events` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`synced_at` integer,
	`external_id` text NOT NULL,
	`source` text DEFAULT 'google' NOT NULL,
	`calendar_name` text,
	`title` text NOT NULL,
	`start` integer NOT NULL,
	`end` integer NOT NULL,
	`location` text,
	`is_all_day` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE INDEX `calendar_events_start_idx` ON `calendar_events` (`start`);--> statement-breakpoint
CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`synced_at` integer,
	`name_th` text NOT NULL,
	`name_en` text NOT NULL,
	`type` text NOT NULL,
	`icon` text,
	`budget_monthly` real,
	`sort_order` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `checkins` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`synced_at` integer,
	`date` text NOT NULL,
	`mood` integer,
	`energy` integer,
	`reflection` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `checkins_date_unique` ON `checkins` (`date`);--> statement-breakpoint
CREATE TABLE `contacts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`synced_at` integer,
	`name` text NOT NULL,
	`company` text,
	`role` text,
	`email` text,
	`phone` text,
	`line_id` text,
	`area_id` text,
	`notes` text
);
--> statement-breakpoint
CREATE INDEX `contacts_name_idx` ON `contacts` (`name`);--> statement-breakpoint
CREATE TABLE `focus_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`synced_at` integer,
	`task_id` text,
	`started_at` integer NOT NULL,
	`duration_min` integer NOT NULL,
	`completed` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE `links` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`synced_at` integer,
	`from_type` text NOT NULL,
	`from_id` text NOT NULL,
	`to_type` text NOT NULL,
	`to_id` text NOT NULL,
	`relation` text
);
--> statement-breakpoint
CREATE INDEX `links_from_idx` ON `links` (`from_type`,`from_id`);--> statement-breakpoint
CREATE INDEX `links_to_idx` ON `links` (`to_type`,`to_id`);--> statement-breakpoint
CREATE TABLE `notes` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`synced_at` integer,
	`title` text DEFAULT '' NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`tags` text,
	`pinned` integer DEFAULT false NOT NULL,
	`attachments` text,
	`area_id` text
);
--> statement-breakpoint
CREATE TABLE `recurring_bills` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`synced_at` integer,
	`name` text NOT NULL,
	`amount` real NOT NULL,
	`currency` text DEFAULT 'THB' NOT NULL,
	`wallet_id` text,
	`category_id` text,
	`due_day` integer NOT NULL,
	`frequency` text DEFAULT 'monthly' NOT NULL,
	`remind_days_before` integer DEFAULT 3 NOT NULL,
	`is_subscription` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE `routines` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`synced_at` integer,
	`title` text NOT NULL,
	`rule` text NOT NULL,
	`period` text,
	`template` text,
	`area_id` text
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`synced_at` integer,
	`title` text NOT NULL,
	`notes` text,
	`date` text,
	`start_time` text,
	`end_time` text,
	`duration_min` integer,
	`is_done` integer DEFAULT false NOT NULL,
	`done_at` integer,
	`priority` integer DEFAULT 2 NOT NULL,
	`energy` text,
	`color` text,
	`icon` text,
	`area_id` text,
	`routine_id` text,
	`checklist` text,
	`reminder_at` integer,
	`sort_order` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `tasks_date_idx` ON `tasks` (`date`);--> statement-breakpoint
CREATE INDEX `tasks_done_idx` ON `tasks` (`is_done`);--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`synced_at` integer,
	`wallet_id` text NOT NULL,
	`amount` real NOT NULL,
	`currency` text DEFAULT 'THB' NOT NULL,
	`type` text NOT NULL,
	`to_wallet_id` text,
	`category_id` text,
	`area_id` text,
	`date` text NOT NULL,
	`note` text,
	`slip_image` text,
	`source` text DEFAULT 'manual' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `transactions_date_idx` ON `transactions` (`date`);--> statement-breakpoint
CREATE INDEX `transactions_wallet_idx` ON `transactions` (`wallet_id`);--> statement-breakpoint
CREATE TABLE `wallets` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`synced_at` integer,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`currency` text DEFAULT 'THB' NOT NULL,
	`balance` real DEFAULT 0 NOT NULL,
	`color` text,
	`sort_order` integer DEFAULT 0 NOT NULL
);

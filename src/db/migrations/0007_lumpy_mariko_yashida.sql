ALTER TABLE `calendar_events` ADD `repeat` text;--> statement-breakpoint
ALTER TABLE `calendar_events` ADD `remind_before` integer;--> statement-breakpoint
ALTER TABLE `calendar_events` ADD `reminder_notification_id` text;--> statement-breakpoint
ALTER TABLE `tasks` ADD `remind_before` integer;--> statement-breakpoint
ALTER TABLE `tasks` ADD `repeat` text;--> statement-breakpoint
ALTER TABLE `tasks` ADD `repeat_from_id` text;--> statement-breakpoint
-- Existing reminders fired at the start time.
UPDATE `tasks` SET `remind_before` = 0 WHERE `reminder_at` IS NOT NULL;

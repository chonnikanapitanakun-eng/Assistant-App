ALTER TABLE `recurring_bills` ADD `due_month` integer;--> statement-breakpoint
ALTER TABLE `recurring_bills` ADD `paid_through` text;--> statement-breakpoint
ALTER TABLE `recurring_bills` ADD `last_payment_id` text;--> statement-breakpoint
ALTER TABLE `recurring_bills` ADD `previous_paid_through` text;
ALTER TABLE "options" ADD COLUMN "compatible_machine_models" text;--> statement-breakpoint
ALTER TABLE "options" ADD COLUMN "required_when_compatible" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "options" ADD COLUMN "allow_quantity_adjustment" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "options" ADD COLUMN "min_quantity" integer;--> statement-breakpoint
ALTER TABLE "options" ADD COLUMN "max_quantity" integer;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "cnc_machine_model" text;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "cnc_year" integer;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "cnc_serial_number" text;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "voltage" text;
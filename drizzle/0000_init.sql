CREATE TABLE "machines" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"series" text NOT NULL,
	"tagline" text NOT NULL,
	"description" text NOT NULL,
	"base_price" double precision NOT NULL,
	"image_url" text,
	"specs" text NOT NULL,
	"compatible_machines" text NOT NULL,
	"features" text NOT NULL,
	CONSTRAINT "machines_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "option_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer NOT NULL,
	"machine_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "options" (
	"id" serial PRIMARY KEY NOT NULL,
	"category_id" integer NOT NULL,
	"part_number" text,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"price" double precision NOT NULL,
	"is_standard" boolean DEFAULT false NOT NULL,
	"is_required" boolean DEFAULT false NOT NULL,
	"quantity" integer DEFAULT 1,
	"machine_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quotes" (
	"id" serial PRIMARY KEY NOT NULL,
	"quote_number" text NOT NULL,
	"machine_name" text NOT NULL,
	"machine_id" integer NOT NULL,
	"customer_name" text NOT NULL,
	"customer_email" text NOT NULL,
	"customer_company" text,
	"customer_phone" text,
	"selected_options" text NOT NULL,
	"base_price" double precision NOT NULL,
	"options_total" double precision NOT NULL,
	"total_price" double precision NOT NULL,
	"financing_params" text,
	"roi_params" text,
	"created_at" text NOT NULL,
	CONSTRAINT "quotes_quote_number_unique" UNIQUE("quote_number")
);

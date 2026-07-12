-- Migration 3: asset_category + asset_category_field

CREATE TABLE "asset_category" (
  "id"          TEXT NOT NULL DEFAULT gen_random_uuid(),
  "name"        TEXT NOT NULL,
  "description" TEXT,
  "status"      TEXT NOT NULL DEFAULT 'Active',

  CONSTRAINT "asset_category_pkey"     PRIMARY KEY ("id"),
  CONSTRAINT "asset_category_name_key" UNIQUE ("name"),
  CONSTRAINT "asset_category_status_check" CHECK ("status" IN ('Active', 'Inactive'))
);

CREATE TABLE "asset_category_field" (
  "id"          TEXT NOT NULL DEFAULT gen_random_uuid(),
  "category_id" TEXT NOT NULL,
  "field_name"  TEXT NOT NULL,
  "field_type"  TEXT NOT NULL,
  "required"    BOOLEAN NOT NULL DEFAULT false,

  CONSTRAINT "asset_category_field_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "asset_category_field_field_type_check" CHECK ("field_type" IN ('text', 'number', 'date')),
  CONSTRAINT "asset_category_field_category_id_fkey"
    FOREIGN KEY ("category_id")
    REFERENCES "asset_category"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

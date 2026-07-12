-- Migration 4: asset, asset_custom_field_value, asset_document

CREATE TABLE "asset" (
  "id"               TEXT NOT NULL DEFAULT gen_random_uuid(),
  "tag"              TEXT NOT NULL,
  "name"             TEXT NOT NULL,
  "category_id"      TEXT NOT NULL,
  "department_id"    TEXT,
  "serial_number"    TEXT,
  "acquisition_date" TIMESTAMP(3) NOT NULL,
  "acquisition_cost" DOUBLE PRECISION,
  "condition"        TEXT NOT NULL,
  "location"         TEXT,
  "status"           TEXT NOT NULL DEFAULT 'Available',
  "is_bookable"      BOOLEAN NOT NULL DEFAULT false,

  CONSTRAINT "asset_pkey"              PRIMARY KEY ("id"),
  CONSTRAINT "asset_tag_key"           UNIQUE ("tag"),
  CONSTRAINT "asset_serial_number_key" UNIQUE ("serial_number"),
  CONSTRAINT "asset_condition_check" CHECK ("condition" IN ('New', 'Good', 'Fair', 'Poor')),
  CONSTRAINT "asset_status_check"    CHECK ("status"    IN ('Available', 'Allocated', 'Reserved', 'Under Maintenance', 'Lost', 'Retired', 'Disposed')),
  CONSTRAINT "asset_category_id_fkey"
    FOREIGN KEY ("category_id")
    REFERENCES "asset_category"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "asset_department_id_fkey"
    FOREIGN KEY ("department_id")
    REFERENCES "department"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Indexes for Directory search/filter (Screen 4)
CREATE INDEX "asset_tag_idx"           ON "asset"("tag");
CREATE INDEX "asset_status_idx"        ON "asset"("status");
CREATE INDEX "asset_department_id_idx" ON "asset"("department_id");
CREATE INDEX "asset_category_id_idx"   ON "asset"("category_id");

CREATE TABLE "asset_custom_field_value" (
  "id"                TEXT NOT NULL DEFAULT gen_random_uuid(),
  "asset_id"          TEXT NOT NULL,
  "category_field_id" TEXT NOT NULL,
  "value"             TEXT NOT NULL,

  CONSTRAINT "asset_custom_field_value_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "asset_custom_field_value_asset_id_fkey"
    FOREIGN KEY ("asset_id")
    REFERENCES "asset"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "asset_custom_field_value_category_field_id_fkey"
    FOREIGN KEY ("category_field_id")
    REFERENCES "asset_category_field"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "asset_document" (
  "id"          TEXT NOT NULL DEFAULT gen_random_uuid(),
  "asset_id"    TEXT NOT NULL,
  "file_url"    TEXT NOT NULL,
  "type"        TEXT NOT NULL,
  "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "asset_document_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "asset_document_type_check" CHECK ("type" IN ('photo', 'document')),
  CONSTRAINT "asset_document_asset_id_fkey"
    FOREIGN KEY ("asset_id")
    REFERENCES "asset"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

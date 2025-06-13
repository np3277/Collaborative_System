
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
DROP TABLE IF EXISTS "form_responses" CASCADE; -- CASCADE ensures dependent objects (like FKs) are dropped
DROP TABLE IF EXISTS "forms" CASCADE;
DROP TABLE IF EXISTS "users" CASCADE;
CREATE TABLE "users" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "username" VARCHAR(255) UNIQUE NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "role" VARCHAR(50) NOT NULL DEFAULT 'user', -- 'admin' or 'user'
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "forms" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "admin_id" UUID NOT NULL, -- The user (admin) who created the form
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "fields" JSONB NOT NULL DEFAULT '[]'::JSONB, -- Array of field definitions for the form structure
    "share_code" VARCHAR(10) UNIQUE NOT NULL, -- Short unique code for sharing
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("admin_id") REFERENCES "users"("id") ON DELETE CASCADE
);
CREATE INDEX "idx_forms_share_code" ON "forms"("share_code");
CREATE TABLE "form_responses" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "form_id" UUID NOT NULL, -- The form this response belongs to
    "user_id" UUID NOT NULL, -- The user who owns/created this specific response entry
    "data" JSONB NOT NULL DEFAULT '{}'::JSONB, -- The actual form data (field_name: value)
    "last_edited_by_user_id" UUID, -- ID of the user who last edited this response (can be different from user_id if multiple users edit the same 'master' response)
    "last_edited_by_username" VARCHAR(255), -- Username of the user who last edited
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("form_id") REFERENCES "forms"("id") ON DELETE CASCADE,
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE, -- Foreign key to the users table for the response owner
    FOREIGN KEY ("last_edited_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL, -- Foreign key for the last editor
    UNIQUE ("form_id", "user_id") -- Ensures each user has only ONE response entry per form
);
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER update_users_updated_at
BEFORE UPDATE ON "users"
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_forms_updated_at
BEFORE UPDATE ON "forms"
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_form_responses_updated_at
BEFORE UPDATE ON "form_responses"
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

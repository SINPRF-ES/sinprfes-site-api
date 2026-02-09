-- FENAPRF MIGRATION V24: ADD UUID SUPPORT TO PUSH_TOKENS
-- Goal: Fix "invalid input syntax for type integer" when registering push tokens for UUID users.

-- 1. Add user_id_uuid column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'push_tokens' AND column_name = 'user_id_uuid') THEN
        ALTER TABLE push_tokens ADD COLUMN user_id_uuid UUID;
    END IF;
END $$;

-- 2. Create index for performance
CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id_uuid ON push_tokens(user_id_uuid);

-- 3. Add foreign key constraint to users(id) if possible
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'push_tokens_user_id_uuid_fkey') THEN
        ALTER TABLE push_tokens
        ADD CONSTRAINT push_tokens_user_id_uuid_fkey
        FOREIGN KEY (user_id_uuid) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
EXCEPTION WHEN others THEN
    RAISE NOTICE 'Could not add foreign key constraint push_tokens_user_id_uuid_fkey. This is expected if users.id is not UUID.';
END $$;

-- 4. Add unique constraints for robust upsert logic (per user/device)
-- This allows future implementation of recording "denied" status without a token.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'push_tokens_user_id_uuid_device_id_key') THEN
        ALTER TABLE push_tokens ADD CONSTRAINT push_tokens_user_id_uuid_device_id_key UNIQUE (user_id_uuid, device_id);
    END IF;
EXCEPTION WHEN others THEN RAISE NOTICE 'Could not add unique constraint push_tokens_user_id_uuid_device_id_key'; END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'push_tokens_user_id_device_id_key') THEN
        ALTER TABLE push_tokens ADD CONSTRAINT push_tokens_user_id_device_id_key UNIQUE (user_id, device_id);
    END IF;
EXCEPTION WHEN others THEN RAISE NOTICE 'Could not add unique constraint push_tokens_user_id_device_id_key'; END $$;

-- ============================================================
-- SAAP Migration 004 — Email OTP Authentication
-- Adds otp_codes table for passwordless email login.
-- Requires pgcrypto extension for bcrypt hashing.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- OTP codes table
CREATE TABLE IF NOT EXISTS otp_codes (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email      VARCHAR(255) NOT NULL,
    otp_hash   TEXT NOT NULL,          -- bcrypt hash of the OTP
    expires_at TIMESTAMPTZ NOT NULL,
    used       BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookup by email
CREATE INDEX IF NOT EXISTS idx_otp_email ON otp_codes(email);

-- Auto-cleanup: delete expired/used OTPs older than 1 hour
-- (run periodically via celery-beat or a cron job)
-- DELETE FROM otp_codes WHERE expires_at < NOW() - INTERVAL '1 hour';

-- Allow users table to have email-only accounts (no google_id required)
-- google_id is already nullable in init.sql, but add email unique constraint
-- if not already present
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'users_email_key'
    ) THEN
        ALTER TABLE users ADD CONSTRAINT users_email_key UNIQUE (email);
    END IF;
END $$;

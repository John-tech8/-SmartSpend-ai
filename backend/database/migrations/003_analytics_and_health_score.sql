-- =====================================================
-- Migration 003: Financial Health History and Budgets
-- =====================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Table: financial_health_history
-- Stores historical snapshots of calculated health scores
CREATE TABLE IF NOT EXISTS financial_health_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    score NUMERIC(5, 2) NOT NULL,
    classification VARCHAR(50) NOT NULL,
    component_scores JSONB NOT NULL,
    earned_points NUMERIC(5, 2) NOT NULL,
    available_points NUMERIC(5, 2) NOT NULL,
    data_completeness VARCHAR(20) DEFAULT 'medium',
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fhh_user_id ON financial_health_history(user_id);
CREATE INDEX IF NOT EXISTS idx_fhh_calculated_at ON financial_health_history(calculated_at DESC);

-- 2. Table: budgets
-- Stores user-defined monthly category budgets for budget management scoring
CREATE TABLE IF NOT EXISTS budgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    monthly_limit NUMERIC(12, 2) NOT NULL,
    month VARCHAR(7), -- e.g. '2026-11' or null for standing monthly budget
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_user_category_month UNIQUE (user_id, category, month)
);

CREATE INDEX IF NOT EXISTS idx_budgets_user ON budgets(user_id);

-- Ensure indexes on existing expenses and incomes for fast date-range queries
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'expenses') THEN
        CREATE INDEX IF NOT EXISTS idx_expenses_user_date ON expenses(user_id, date);
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'incomes') THEN
        CREATE INDEX IF NOT EXISTS idx_incomes_user_date ON incomes(user_id, date);
    END IF;
END $$;

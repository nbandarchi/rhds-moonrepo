-- Initial database setup for RHDS Monorepo
-- This script runs when the PostgreSQL container starts for the first time

-- Create a function to initialize a project schema if it doesn't exist
CREATE OR REPLACE FUNCTION create_project_schema(schema_name TEXT)
RETURNS VOID AS $$
BEGIN
    -- Check if schema exists, create if it doesn't
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.schemata 
        WHERE information_schema.schemata.schema_name = $1
    ) THEN
        EXECUTE format('CREATE SCHEMA %I', $1);
        EXECUTE format('GRANT ALL PRIVILEGES ON SCHEMA %I TO %I', $1, current_user);
        RAISE NOTICE 'Created schema: %', $1;
    ELSE
        RAISE NOTICE 'Schema % already exists', $1;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Create project_schemas table to track project schema mappings
CREATE TABLE IF NOT EXISTS public.project_schemas (
    id SERIAL PRIMARY KEY,
    project_name VARCHAR(255) UNIQUE NOT NULL,
    schema_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- Create low-privilege sandbox role for user queries
-- This role cannot create databases, is not superuser, and has limited permissions
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'sandbox_user') THEN
    CREATE ROLE sandbox_user WITH LOGIN PASSWORD 'sandbox_pass';
  END IF;
END
$$;

-- Grant connect to the sandbox database
GRANT CONNECT ON DATABASE sql_sandbox TO sandbox_user;

-- Grant usage on public schema (system tables live here)
GRANT USAGE ON SCHEMA public TO sandbox_user;

-- Allow sandbox_user to create schemas (for workspace isolation)
GRANT CREATE ON DATABASE sql_sandbox TO sandbox_user;

-- Sandbox user can create tables/indexes within schemas they own
ALTER DEFAULT PRIVILEGES FOR ROLE sandbox_user GRANT ALL ON TABLES TO sandbox_user;
ALTER DEFAULT PRIVILEGES FOR ROLE sandbox_user GRANT ALL ON SEQUENCES TO sandbox_user;

-- init.sql — runs automatically on first PostgreSQL container start
-- The main schema is applied separately via: docker compose exec api npm run db:init
-- This file just ensures the PostGIS extension is available before the API starts.

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;

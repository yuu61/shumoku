-- Add options_json column to topology_data_sources
-- Stores per-topology-source options (e.g., groupBy, siteFilter, tagFilter for NetBox)
ALTER TABLE topology_data_sources ADD COLUMN options_json TEXT;

-- Add share tokens for public sharing
ALTER TABLE topologies ADD COLUMN share_token TEXT;
ALTER TABLE dashboards ADD COLUMN share_token TEXT;
CREATE UNIQUE INDEX idx_topologies_share_token ON topologies(share_token) WHERE share_token IS NOT NULL;
CREATE UNIQUE INDEX idx_dashboards_share_token ON dashboards(share_token) WHERE share_token IS NOT NULL;

# Database Schema

Shumoku Server uses SQLite (via `bun:sqlite`) for persistent storage. The database file is stored at `{dataDir}/shumoku.db`.

## Overview

```
┌─────────────────┐     ┌─────────────────────────┐     ┌─────────────────┐
│  data_sources   │     │  topology_data_sources  │     │   topologies    │
│─────────────────│     │─────────────────────────│     │─────────────────│
│ id (PK)         │◄────│ data_source_id (FK)     │     │ id (PK)         │
│ name            │     │ topology_id (FK)        │────►│ name            │
│ type            │     │ purpose                 │     │ content_json    │
│ config_json     │     │ sync_mode               │     │ mapping_json    │
│ status          │     │ ...                     │     │ ...             │
│ ...             │     └─────────────────────────┘     └─────────────────┘
└─────────────────┘
                                                        ┌─────────────────┐
                                                        │   dashboards    │
                                                        │─────────────────│
                                                        │ id (PK)         │
                                                        │ name            │
                                                        │ layout_json     │
                                                        └─────────────────┘

                                                        ┌─────────────────┐
                                                        │    settings     │
                                                        │─────────────────│
                                                        │ key (PK)        │
                                                        │ value           │
                                                        └─────────────────┘
```

## Tables

### data_sources

External data source connections (Zabbix, NetBox, Prometheus, etc.)

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT (PK) | Unique identifier (nanoid) |
| `name` | TEXT | Display name |
| `type` | TEXT | Plugin type: `zabbix`, `netbox`, `prometheus` |
| `config_json` | TEXT | Plugin-specific configuration (JSON) |
| `status` | TEXT | Connection status: `connected`, `disconnected`, `unknown` |
| `status_message` | TEXT | Last status message (error details, etc.) |
| `last_checked_at` | INTEGER | Last health check timestamp (ms) |
| `fail_count` | INTEGER | Consecutive failure count |
| `created_at` | INTEGER | Creation timestamp (ms) |
| `updated_at` | INTEGER | Last update timestamp (ms) |

**config_json examples:**

```json
// Zabbix
{
  "url": "https://zabbix.example.com/api_jsonrpc.php",
  "token": "api_token_here",
  "pollInterval": 5000
}

// Prometheus
{
  "url": "http://prometheus:9090",
  "preset": "snmp",
  "hostLabel": "hostname",
  "jobFilter": "snmp"
}

// NetBox
{
  "url": "https://netbox.example.com",
  "token": "api_token_here",
  "groupBy": "site"
}
```

### topologies

Network topology definitions with optional metrics mapping.

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT (PK) | Unique identifier (nanoid) |
| `name` | TEXT | Topology name |
| `content_json` | TEXT | Multi-file YAML content (see below) |
| `topology_source_id` | TEXT (FK) | Data source for topology sync (optional) |
| `metrics_source_id` | TEXT (FK) | Data source for metrics (optional) |
| `mapping_json` | TEXT | Node/Link to monitoring host mapping (JSON) |
| `created_at` | INTEGER | Creation timestamp (ms) |
| `updated_at` | INTEGER | Last update timestamp (ms) |

**content_json format:**

```json
{
  "files": [
    { "name": "main.yaml", "content": "name: My Network\nnodes:\n  - id: router1\n..." },
    { "name": "campus.yaml", "content": "name: Campus\nnodes:\n..." }
  ]
}
```

**mapping_json format (ZabbixMapping):**

```json
{
  "nodes": {
    "router1": { "hostId": "prometheus-hostname-or-zabbix-hostid" },
    "switch1": { "hostId": "switch1.example.com" }
  },
  "links": {
    "link-0": {
      "monitoredNodeId": "router1",
      "interface": "ge-0/0/1",
      "capacity": 1000000000
    }
  }
}
```

### topology_data_sources

Junction table for topology-datasource relationships (many-to-many).

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT (PK) | Unique identifier (nanoid) |
| `topology_id` | TEXT (FK) | Reference to topologies.id |
| `data_source_id` | TEXT (FK) | Reference to data_sources.id |
| `purpose` | TEXT | `topology` or `metrics` |
| `sync_mode` | TEXT | `manual`, `on_view`, or `webhook` |
| `webhook_secret` | TEXT | Secret for webhook validation (optional) |
| `last_synced_at` | INTEGER | Last sync timestamp (ms) |
| `priority` | INTEGER | Priority order (higher = preferred) |
| `created_at` | INTEGER | Creation timestamp (ms) |
| `updated_at` | INTEGER | Last update timestamp (ms) |

**Unique constraint:** `(topology_id, data_source_id, purpose)`

### dashboards

Dashboard layouts for displaying multiple topologies.

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT (PK) | Unique identifier (nanoid) |
| `name` | TEXT | Dashboard name |
| `layout_json` | TEXT | Widget layout configuration (JSON) |
| `created_at` | INTEGER | Creation timestamp (ms) |
| `updated_at` | INTEGER | Last update timestamp (ms) |

### settings

Key-value store for application settings.

| Column | Type | Description |
|--------|------|-------------|
| `key` | TEXT (PK) | Setting key |
| `value` | TEXT | Setting value |

**Reserved keys:**
- `schema_version`: Current database schema version (for migrations)

## Indexes

| Index | Table | Columns |
|-------|-------|---------|
| `idx_topologies_topology_source` | topologies | topology_source_id |
| `idx_topologies_metrics_source` | topologies | metrics_source_id |
| `idx_topologies_name` | topologies | name |
| `idx_data_sources_name` | data_sources | name |
| `idx_data_sources_type` | data_sources | type |
| `idx_topology_data_sources_topology` | topology_data_sources | topology_id |
| `idx_topology_data_sources_source` | topology_data_sources | data_source_id |

## Migrations

Schema migrations are tracked via `settings.schema_version`.

| Version | Description |
|---------|-------------|
| 1 | Initial schema |
| 2 | Plugin architecture support (config_json, topology_source_id, metrics_source_id) |
| 3 | Health check status fields (status, status_message, last_checked_at, fail_count) |

## TypeScript Interfaces

See `apps/server/src/types.ts` for corresponding TypeScript interfaces:

- `DataSource` - data_sources table
- `Topology` - topologies table
- `TopologyDataSource` - topology_data_sources table
- `Dashboard` - dashboards table
- `ZabbixMapping` - mapping_json structure

## Database Configuration

- **Location:** `{dataDir}/shumoku.db` (default: `/data/shumoku.db`)
- **Journal mode:** WAL (Write-Ahead Logging) for better concurrency
- **ID generation:** nanoid (12 characters)

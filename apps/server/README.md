# @shumoku/server

Real-time network topology visualization server with Zabbix integration for Shumoku.

## Features

- **Real-time Metrics**: WebSocket-based live updates for link utilization and node status
- **Weathermap Visualization**: Color-coded links based on traffic utilization
- **Zabbix Integration**: Pull metrics from Zabbix monitoring system
- **Docker Ready**: Container deployment with configurable settings
- **Interactive UI**: Pan, zoom, and explore network topologies

## Quick Start

### Development

```bash
# From repository root
cd apps/server
bun install
bun run dev
```

Open http://localhost:3000 to view the dashboard.

### Production (Docker)

```bash
# Build and run
docker-compose up -d

# Or build manually
docker build -t shumoku-server -f apps/server/Dockerfile .
docker run -p 3000:3000 shumoku-server
```

## Configuration

Create a `config.yaml` file (see `config.example.yaml` for reference):

```yaml
server:
  port: 3000
  host: 0.0.0.0

# Optional: Zabbix integration
zabbix:
  url: https://zabbix.example.com
  token: ${ZABBIX_TOKEN}  # Environment variable
  pollInterval: 30000     # Polling interval in ms

# Network topologies to serve
topologies:
  - name: main-network
    file: /data/topologies/main.yaml
    mapping: /data/mappings/main-mapping.yaml

# Weathermap color thresholds
weathermap:
  thresholds:
    - value: 0
      color: '#73BF69'   # Green
    - value: 50
      color: '#FADE2A'   # Yellow
    - value: 75
      color: '#FF9830'   # Orange
    - value: 90
      color: '#FF0000'   # Red
```

## API

### HTTP Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /` | Dashboard with topology list |
| `GET /topology/:name` | Interactive topology view |
| `GET /api/topologies` | List all topology names (JSON) |
| `GET /api/topology/:name` | Topology details with metrics (JSON) |

### WebSocket

Connect to `ws://<host>/ws` for real-time metrics.

**Client Messages:**

```javascript
// Subscribe to topology updates
{ "type": "subscribe", "topology": "main-network" }

// Change update interval (5s - 5min)
{ "type": "setInterval", "interval": 10000 }

// Filter specific nodes/links
{ "type": "filter", "nodes": ["router1"], "links": ["link-0"] }
```

**Server Messages:**

```javascript
{
  "type": "metrics",
  "data": {
    "nodes": {
      "router1": { "status": "up", "cpu": 23.5 }
    },
    "links": {
      "link-0": { "status": "up", "utilization": 45.2 }
    },
    "timestamp": 1705849200000
  }
}
```

## Zabbix Mapping

Create a mapping file to connect topology elements to Zabbix:

```yaml
# nodes: Map by host ID or name
nodes:
  router1:
    hostId: "10084"
  switch1:
    hostName: "sw-core-01"

# links: Map by item ID or interface
links:
  link-0:
    in: "12345"       # Item ID for inbound traffic
    out: "12346"      # Item ID for outbound traffic
    capacity: 10000000000  # 10Gbps
  link-1:
    interface: "eth0"  # Auto-discover by interface name
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 3000 |
| `HOST` | Bind address | 0.0.0.0 |
| `SHUMOKU_CONFIG` | Config file path | ./config.yaml |
| `ZABBIX_URL` | Zabbix API URL | - |
| `ZABBIX_TOKEN` | Zabbix API token | - |
| `ZABBIX_POLL_INTERVAL` | Polling interval (ms) | 30000 |

## Architecture

```
┌─────────────┐     ┌────────────────┐     ┌───────────┐
│   Browser   │────►│ Shumoku Server │────►│  Zabbix   │
│   (Viewer)  │◄────│   (Node.js)    │◄────│    API    │
└─────────────┘     └────────────────┘     └───────────┘
    WebSocket        HTTP + WebSocket
```

The server:
1. Loads topology YAML files on startup
2. Computes layout using ELK.js
3. Polls Zabbix for metrics (or generates mock data)
4. Broadcasts updates to connected WebSocket clients
5. Clients update SVG elements dynamically

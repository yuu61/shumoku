/**
 * Metrics Store
 * WebSocket connection and real-time metrics updates
 */

import { writable, derived, get } from 'svelte/store'

// Types
export type NodeStatus = 'up' | 'down' | 'unknown' | 'warning'
export type EdgeStatus = 'up' | 'down' | 'unknown' | 'degraded'

export interface NodeMetrics {
  status: NodeStatus
}

export interface EdgeMetrics {
  status: EdgeStatus
  utilization?: number
}

export interface MetricsData {
  nodes: Record<string, NodeMetrics>
  links: Record<string, EdgeMetrics>
  timestamp: number
}

interface MetricsMessage {
  type: 'metrics'
  data: MetricsData
}

interface ClientMessage {
  type: 'subscribe' | 'setInterval' | 'filter'
  topology?: string
  interval?: number
  nodes?: string[]
  links?: string[]
}

// Store state
interface MetricsState {
  connected: boolean
  subscribedTopology: string | null
  metrics: MetricsData | null
  error: string | null
}

const initialState: MetricsState = {
  connected: false,
  subscribedTopology: null,
  metrics: null,
  error: null,
}

function createMetricsStore() {
  const { subscribe, set, update } = writable<MetricsState>(initialState)
  let ws: WebSocket | null = null
  let reconnectTimeout: ReturnType<typeof setTimeout> | null = null
  let reconnectAttempts = 0
  const maxReconnectAttempts = 5

  function getWebSocketUrl(): string {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${protocol}//${window.location.host}/ws`
  }

  function connect(): void {
    if (ws?.readyState === WebSocket.OPEN || ws?.readyState === WebSocket.CONNECTING) {
      return
    }

    try {
      ws = new WebSocket(getWebSocketUrl())

      ws.onopen = () => {
        reconnectAttempts = 0
        update((s) => ({ ...s, connected: true, error: null }))

        // Re-subscribe if we had a topology
        const state = get({ subscribe })
        if (state.subscribedTopology) {
          sendMessage({ type: 'subscribe', topology: state.subscribedTopology })
        }
      }

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as MetricsMessage
          if (msg.type === 'metrics') {
            update((s) => ({ ...s, metrics: msg.data }))
          }
        } catch (err) {
          console.error('[Metrics] Failed to parse message:', err)
        }
      }

      ws.onclose = () => {
        update((s) => ({ ...s, connected: false }))
        scheduleReconnect()
      }

      ws.onerror = (event) => {
        console.error('[Metrics] WebSocket error:', event)
        update((s) => ({ ...s, error: 'Connection error' }))
      }
    } catch (err) {
      console.error('[Metrics] Failed to create WebSocket:', err)
      update((s) => ({ ...s, error: 'Failed to connect' }))
      scheduleReconnect()
    }
  }

  function scheduleReconnect(): void {
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout)
    }

    if (reconnectAttempts < maxReconnectAttempts) {
      const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000)
      reconnectAttempts++
      reconnectTimeout = setTimeout(connect, delay)
    }
  }

  function disconnect(): void {
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout)
      reconnectTimeout = null
    }

    if (ws) {
      ws.close()
      ws = null
    }

    set(initialState)
  }

  function sendMessage(msg: ClientMessage): void {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg))
    }
  }

  function subscribeToTopology(topologyId: string): void {
    update((s) => ({ ...s, subscribedTopology: topologyId, metrics: null }))
    sendMessage({ type: 'subscribe', topology: topologyId })
  }

  function setInterval(interval: number): void {
    sendMessage({ type: 'setInterval', interval })
  }

  function unsubscribe(): void {
    update((s) => ({ ...s, subscribedTopology: null, metrics: null }))
  }

  return {
    subscribe,
    connect,
    disconnect,
    subscribeToTopology,
    setInterval,
    unsubscribe,
  }
}

export const metricsStore = createMetricsStore()

// Derived stores for easy access
export const metricsConnected = derived(metricsStore, ($store) => $store.connected)
export const metricsData = derived(metricsStore, ($store) => $store.metrics)
export const metricsError = derived(metricsStore, ($store) => $store.error)

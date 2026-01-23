<script lang="ts">
import { onMount } from 'svelte'
import { goto } from '$app/navigation'
import { api } from '$lib/api'
import { Button } from '$lib/components/ui/button'
import {
  displaySettings,
  metricsConnected,
  liveUpdatesEnabled,
  showTrafficFlow,
  showNodeStatus,
} from '$lib/stores'
import type { Topology, DataSource, ZabbixMapping } from '$lib/types'
import PencilSimple from 'phosphor-svelte/lib/PencilSimple'
import Trash from 'phosphor-svelte/lib/Trash'
import MapPin from 'phosphor-svelte/lib/MapPin'
import ArrowsClockwise from 'phosphor-svelte/lib/ArrowsClockwise'

export let topology: Topology
export let renderData: { nodeCount: number; edgeCount: number } | null = null
export let onDeleted: (() => void) | null = null
export let onUpdated: ((topology: Topology) => void) | null = null

let deleting = false
let topologyDataSources: DataSource[] = []
let metricsDataSources: DataSource[] = []
let selectedTopologySourceId = topology.topologySourceId || ''
let selectedMetricsSourceId = topology.metricsSourceId || ''
let savingDataSource = false
let syncing = false
let syncResult: { nodeCount: number; linkCount: number } | null = null

// Mapping stats
function getMappingStats(mappingJson?: string): { mappedNodes: number; mappedLinks: number } {
  if (!mappingJson) return { mappedNodes: 0, mappedLinks: 0 }
  try {
    const mapping = JSON.parse(mappingJson) as ZabbixMapping
    const mappedNodes = Object.values(mapping.nodes || {}).filter(
      (n) => n.hostId || n.hostName,
    ).length
    const mappedLinks = Object.values(mapping.links || {}).filter(
      (l) => l.interface || l.in || l.out,
    ).length
    return { mappedNodes, mappedLinks }
  } catch {
    return { mappedNodes: 0, mappedLinks: 0 }
  }
}

$: mappingStats = getMappingStats(topology.mappingJson)

onMount(async () => {
  try {
    // Load data sources by capability in parallel
    const [topologySources, metricsSources] = await Promise.all([
      api.dataSources.listByCapability('topology'),
      api.dataSources.listByCapability('metrics'),
    ])
    topologyDataSources = topologySources
    metricsDataSources = metricsSources
  } catch (e) {
    console.error('Failed to load data sources:', e)
  }
})

async function handleTopologySourceChange() {
  savingDataSource = true
  syncResult = null
  try {
    const updated = await api.topologies.update(topology.id, {
      topologySourceId: selectedTopologySourceId || undefined,
    })
    topology = updated
    onUpdated?.(updated)
  } catch (e) {
    alert(e instanceof Error ? e.message : 'Failed to save')
    selectedTopologySourceId = topology.topologySourceId || ''
  } finally {
    savingDataSource = false
  }
}

async function handleMetricsSourceChange() {
  savingDataSource = true
  try {
    const updated = await api.topologies.update(topology.id, {
      metricsSourceId: selectedMetricsSourceId || undefined,
    })
    topology = updated
    onUpdated?.(updated)
  } catch (e) {
    alert(e instanceof Error ? e.message : 'Failed to save')
    selectedMetricsSourceId = topology.metricsSourceId || ''
  } finally {
    savingDataSource = false
  }
}

async function handleSyncFromSource() {
  if (!selectedTopologySourceId) return

  syncing = true
  syncResult = null
  try {
    const result = await api.topologies.syncFromSource(topology.id)
    topology = result.topology
    syncResult = { nodeCount: result.nodeCount, linkCount: result.linkCount }
    onUpdated?.(result.topology)
  } catch (e) {
    alert(e instanceof Error ? e.message : 'Failed to sync from source')
  } finally {
    syncing = false
  }
}

async function handleDelete() {
  if (!confirm(`Delete topology "${topology.name}"? This action cannot be undone.`)) {
    return
  }
  deleting = true
  try {
    await api.topologies.delete(topology.id)
    if (onDeleted) {
      onDeleted()
    } else {
      goto('/topologies')
    }
  } catch (e) {
    alert(e instanceof Error ? e.message : 'Failed to delete')
    deleting = false
  }
}
</script>

<div class="space-y-4">
  <!-- General -->
  <div class="space-y-3">
    <h3 class="text-xs font-medium text-theme-text-muted uppercase tracking-wide">General</h3>
    <div class="space-y-2">
      <div>
        <p class="text-xs text-theme-text-muted">Name</p>
        <p class="text-sm font-medium text-theme-text-emphasis">{topology.name}</p>
      </div>
      <div>
        <p class="text-xs text-theme-text-muted">ID</p>
        <p class="text-xs font-mono text-theme-text">{topology.id}</p>
      </div>
    </div>
  </div>

  <hr class="border-theme-border" />

  <!-- Statistics -->
  {#if renderData}
    <div class="space-y-3">
      <h3 class="text-xs font-medium text-theme-text-muted uppercase tracking-wide">Statistics</h3>
      <div class="grid grid-cols-2 gap-3">
        <div class="bg-theme-bg rounded-lg p-3">
          <p class="text-xs text-theme-text-muted">Nodes</p>
          <p class="text-xl font-semibold text-theme-text-emphasis">{renderData.nodeCount}</p>
        </div>
        <div class="bg-theme-bg rounded-lg p-3">
          <p class="text-xs text-theme-text-muted">Edges</p>
          <p class="text-xl font-semibold text-theme-text-emphasis">{renderData.edgeCount}</p>
        </div>
      </div>
      <div>
        <p class="text-xs text-theme-text-muted">Updated</p>
        <p class="text-sm text-theme-text">{new Date(topology.updatedAt).toLocaleString()}</p>
      </div>
    </div>

    <hr class="border-theme-border" />
  {/if}

  <!-- Data Sources -->
  <div class="space-y-3">
    <h3 class="text-xs font-medium text-theme-text-muted uppercase tracking-wide">Data Sources</h3>
    <div class="space-y-3">
      <!-- Topology Source -->
      <div>
        <label for="topologySource" class="text-xs text-theme-text-muted">Topology Source</label>
        <div class="flex items-center gap-2 mt-1">
          <select
            id="topologySource"
            class="input flex-1"
            bind:value={selectedTopologySourceId}
            on:change={handleTopologySourceChange}
            disabled={savingDataSource}
          >
            <option value="">Manual (YAML)</option>
            {#each topologyDataSources as ds}
              <option value={ds.id}>{ds.name} ({ds.type})</option>
            {/each}
          </select>
          {#if savingDataSource}
            <span class="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></span>
          {/if}
        </div>
        <p class="text-xs text-theme-text-muted mt-1">Import topology from external source</p>
      </div>

      <!-- Sync from Source -->
      {#if selectedTopologySourceId}
        <div class="bg-theme-bg rounded-lg p-3">
          <Button
            variant="secondary"
            class="w-full justify-center"
            onclick={handleSyncFromSource}
            disabled={syncing}
          >
            {#if syncing}
              <span class="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2"></span>
              Syncing...
            {:else}
              <ArrowsClockwise size={16} class="mr-2" />
              Sync from Source
            {/if}
          </Button>
          {#if syncResult}
            <p class="text-xs text-success mt-2 text-center">
              Synced: {syncResult.nodeCount} nodes, {syncResult.linkCount} links
            </p>
          {/if}
        </div>
      {/if}

      <!-- Metrics Source -->
      <div>
        <label for="metricsSource" class="text-xs text-theme-text-muted">Metrics Source</label>
        <div class="flex items-center gap-2 mt-1">
          <select
            id="metricsSource"
            class="input flex-1"
            bind:value={selectedMetricsSourceId}
            on:change={handleMetricsSourceChange}
            disabled={savingDataSource}
          >
            <option value="">None</option>
            {#each metricsDataSources as ds}
              <option value={ds.id}>{ds.name} ({ds.type})</option>
            {/each}
          </select>
          {#if savingDataSource}
            <span class="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></span>
          {/if}
        </div>
        <p class="text-xs text-theme-text-muted mt-1">Select a data source for live metrics</p>
      </div>
    </div>
  </div>

  <hr class="border-theme-border" />

  <!-- Mapping Configuration -->
  {#if selectedMetricsSourceId}
    <div class="space-y-3">
      <h3 class="text-xs font-medium text-theme-text-muted uppercase tracking-wide">Metrics Mapping</h3>
      <div class="space-y-3">
        <div class="grid grid-cols-2 gap-3">
          <div class="bg-theme-bg rounded-lg p-3">
            <p class="text-xs text-theme-text-muted">Mapped Nodes</p>
            <p class="text-lg font-semibold text-theme-text-emphasis">
              {mappingStats.mappedNodes}
              {#if renderData}
                <span class="text-xs font-normal text-theme-text-muted">/ {renderData.nodeCount}</span>
              {/if}
            </p>
          </div>
          <div class="bg-theme-bg rounded-lg p-3">
            <p class="text-xs text-theme-text-muted">Mapped Links</p>
            <p class="text-lg font-semibold text-theme-text-emphasis">
              {mappingStats.mappedLinks}
              {#if renderData}
                <span class="text-xs font-normal text-theme-text-muted">/ {renderData.edgeCount}</span>
              {/if}
            </p>
          </div>
        </div>
        <a
          href="/topologies/{topology.id}/mapping"
          class="btn btn-secondary w-full justify-center"
        >
          <MapPin size={16} class="mr-2" />
          Configure Mapping
        </a>
        <p class="text-xs text-theme-text-muted">
          Map topology nodes and links to hosts and interfaces for live metrics display.
        </p>
      </div>
    </div>

    <hr class="border-theme-border" />
  {/if}

  <!-- Display Settings -->
  <div class="space-y-3">
    <h3 class="text-xs font-medium text-theme-text-muted uppercase tracking-wide">Display</h3>

    <!-- Connection Status (read-only indicator) -->
    <div class="flex items-center justify-between py-2">
      <div>
        <p class="text-sm text-theme-text">Connection Status</p>
        <p class="text-xs text-theme-text-muted">Real-time data stream</p>
      </div>
      <div class="flex items-center gap-2">
        {#if $metricsConnected}
          <span class="w-2 h-2 bg-success rounded-full animate-pulse"></span>
          <span class="text-xs text-success font-medium">Live</span>
        {:else}
          <span class="w-2 h-2 bg-theme-text-muted rounded-full"></span>
          <span class="text-xs text-theme-text-muted">Offline</span>
        {/if}
      </div>
    </div>

    <hr class="border-theme-border/50" />

    <!-- Live Updates Toggle -->
    <label class="flex items-center justify-between py-2 cursor-pointer">
      <div>
        <p class="text-sm text-theme-text">Live Updates</p>
        <p class="text-xs text-theme-text-muted">Connect to metrics server</p>
      </div>
      <input
        type="checkbox"
        class="toggle"
        checked={$liveUpdatesEnabled}
        on:change={(e) => displaySettings.setLiveUpdates(e.currentTarget.checked)}
      />
    </label>

    <!-- Traffic Flow Toggle -->
    <label class="flex items-center justify-between py-2 cursor-pointer {!$liveUpdatesEnabled ? 'opacity-50' : ''}">
      <div>
        <p class="text-sm text-theme-text">Traffic Flow</p>
        <p class="text-xs text-theme-text-muted">Show link utilization colors</p>
      </div>
      <input
        type="checkbox"
        class="toggle"
        checked={$showTrafficFlow}
        disabled={!$liveUpdatesEnabled}
        on:change={(e) => displaySettings.setShowTrafficFlow(e.currentTarget.checked)}
      />
    </label>

    <!-- Node Status Toggle -->
    <label class="flex items-center justify-between py-2 cursor-pointer {!$liveUpdatesEnabled ? 'opacity-50' : ''}">
      <div>
        <p class="text-sm text-theme-text">Node Status</p>
        <p class="text-xs text-theme-text-muted">Show up/down indicators</p>
      </div>
      <input
        type="checkbox"
        class="toggle"
        checked={$showNodeStatus}
        disabled={!$liveUpdatesEnabled}
        on:change={(e) => displaySettings.setShowNodeStatus(e.currentTarget.checked)}
      />
    </label>
  </div>

  <hr class="border-theme-border" />

  <!-- Actions -->
  <div class="space-y-3">
    <h3 class="text-xs font-medium text-theme-text-muted uppercase tracking-wide">Actions</h3>
    <div class="space-y-2">
      <a href="/topologies/{topology.id}/edit" class="btn btn-secondary w-full justify-center">
        <PencilSimple size={16} class="mr-2" />
        Edit YAML
      </a>
    </div>
  </div>

  <hr class="border-theme-border" />

  <!-- Danger Zone -->
  <div class="space-y-3">
    <h3 class="text-xs font-medium text-danger uppercase tracking-wide">Danger Zone</h3>
    <div>
      <p class="text-xs text-theme-text-muted mb-2">Once deleted, this topology cannot be recovered.</p>
      <Button variant="destructive" class="w-full justify-center" onclick={handleDelete} disabled={deleting}>
        {#if deleting}
          <span class="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2"></span>
        {:else}
          <Trash size={16} class="mr-2" />
        {/if}
        Delete Topology
      </Button>
    </div>
  </div>
</div>

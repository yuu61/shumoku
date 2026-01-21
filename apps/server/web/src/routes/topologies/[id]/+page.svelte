<script lang="ts">
  import { onMount } from 'svelte'
  import { page } from '$app/stores'
  import { goto } from '$app/navigation'
  import { api } from '$lib/api'
  import { metricsConnected } from '$lib/stores'
  import NetworkDiagram from '$lib/components/NetworkDiagram.svelte'
  import type { Topology } from '$lib/types'

  let topology: Topology | null = null
  let renderData: { nodeCount: number; edgeCount: number } | null = null
  let loading = true
  let error = ''
  let enableMetrics = true

  // Get ID from route params (always defined for this route)
  $: topologyId = $page.params.id!

  onMount(async () => {
    try {
      // Fetch topology metadata and render data for stats
      const [topoData, renderResponse] = await Promise.all([
        api.topologies.get(topologyId),
        fetch(`/api/topologies/${topologyId}/render`).then((r) => r.json()),
      ])
      topology = topoData
      renderData = { nodeCount: renderResponse.nodeCount, edgeCount: renderResponse.edgeCount }
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load topology'
    } finally {
      loading = false
    }
  })

  async function handleDelete() {
    if (!confirm(`Delete topology "${topology?.name}"?`)) {
      return
    }
    try {
      await api.topologies.delete(topologyId)
      goto('/topologies')
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to delete'
    }
  }
</script>

<svelte:head>
  <title>{topology?.name || 'Topology'} - Shumoku</title>
</svelte:head>

<div class="p-6 h-full flex flex-col">
  <!-- Back link -->
  <a href="/topologies" class="inline-flex items-center gap-2 text-dark-text-muted hover:text-dark-text mb-4">
    <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M19 12H5M12 19l-7-7 7-7"/>
    </svg>
    Back to Topologies
  </a>

  {#if loading}
    <div class="flex items-center justify-center py-12 flex-1">
      <div class="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
    </div>
  {:else if error && !topology}
    <div class="card p-6 text-center">
      <p class="text-danger">{error}</p>
      <a href="/topologies" class="btn btn-secondary mt-4">Go Back</a>
    </div>
  {:else if topology}
    <!-- Header -->
    <div class="flex items-center justify-between mb-4">
      <div class="flex items-center gap-4">
        <h1 class="text-2xl font-semibold text-dark-text-emphasis">{topology.name}</h1>
        <!-- Connection status -->
        <div class="flex items-center gap-2 text-xs">
          {#if $metricsConnected}
            <span class="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            <span class="text-green-400">Live</span>
          {:else}
            <span class="w-2 h-2 bg-gray-500 rounded-full"></span>
            <span class="text-dark-text-muted">Offline</span>
          {/if}
        </div>
      </div>
      <div class="flex items-center gap-2">
        <!-- Metrics toggle -->
        <label class="flex items-center gap-2 text-sm text-dark-text-muted cursor-pointer">
          <input
            type="checkbox"
            bind:checked={enableMetrics}
            class="w-4 h-4 rounded border-dark-border bg-dark-bg-elevated"
          />
          Metrics
        </label>
        <a href="/topologies/{topology.id}/edit" class="btn btn-secondary">
          <svg class="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
          Edit
        </a>
        <button class="btn btn-danger" onclick={handleDelete}>
          <svg class="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
          Delete
        </button>
      </div>
    </div>

    <!-- Network Diagram -->
    <div class="card flex-1 overflow-hidden">
      <div class="h-full">
        <NetworkDiagram {topologyId} {enableMetrics} />
      </div>
    </div>

    <!-- Info -->
    {#if renderData}
      <div class="grid grid-cols-4 gap-4 mt-4">
        <div class="card p-3">
          <p class="text-xs text-dark-text-muted">Nodes</p>
          <p class="font-mono text-sm text-dark-text">{renderData.nodeCount}</p>
        </div>
        <div class="card p-3">
          <p class="text-xs text-dark-text-muted">Edges</p>
          <p class="font-mono text-sm text-dark-text">{renderData.edgeCount}</p>
        </div>
        <div class="card p-3">
          <p class="text-xs text-dark-text-muted">Data Source</p>
          <p class="text-sm text-dark-text">{topology.dataSourceId || 'None'}</p>
        </div>
        <div class="card p-3">
          <p class="text-xs text-dark-text-muted">Updated</p>
          <p class="text-sm text-dark-text">{new Date(topology.updatedAt).toLocaleString()}</p>
        </div>
      </div>
    {/if}
  {/if}
</div>

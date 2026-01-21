<script lang="ts">
  import { onMount } from 'svelte'
  import { api } from '$lib/api'
  import type { Topology, DataSource } from '$lib/types'

  let topologies: Topology[] = []
  let dataSources: DataSource[] = []
  let loading = true
  let error = ''

  onMount(async () => {
    try {
      const [topoRes, dsRes] = await Promise.all([
        api.topologies.list(),
        api.dataSources.list(),
      ])
      topologies = topoRes
      dataSources = dsRes
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load data'
    } finally {
      loading = false
    }
  })
</script>

<svelte:head>
  <title>Home - Shumoku</title>
</svelte:head>

<div class="p-6">
  <!-- Header -->
  <div class="mb-8">
    <h1 class="text-2xl font-semibold text-dark-text-emphasis">Dashboard</h1>
    <p class="text-dark-text-muted mt-1">Overview of your network topology management</p>
  </div>

  {#if loading}
    <div class="flex items-center justify-center py-12">
      <div class="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
    </div>
  {:else if error}
    <div class="card p-6 text-center">
      <p class="text-danger">{error}</p>
    </div>
  {:else}
    <!-- Stats -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
      <div class="card p-4">
        <div class="flex items-center gap-4">
          <div class="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
            <svg class="w-6 h-6 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="5" r="3"/>
              <circle cx="5" cy="19" r="3"/>
              <circle cx="19" cy="19" r="3"/>
              <line x1="12" y1="8" x2="5" y2="16"/>
              <line x1="12" y1="8" x2="19" y2="16"/>
            </svg>
          </div>
          <div>
            <p class="text-2xl font-semibold text-dark-text-emphasis">{topologies.length}</p>
            <p class="text-sm text-dark-text-muted">Topologies</p>
          </div>
        </div>
      </div>

      <div class="card p-4">
        <div class="flex items-center gap-4">
          <div class="w-12 h-12 bg-info/10 rounded-lg flex items-center justify-center">
            <svg class="w-6 h-6 text-info" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <ellipse cx="12" cy="5" rx="9" ry="3"/>
              <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
              <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
            </svg>
          </div>
          <div>
            <p class="text-2xl font-semibold text-dark-text-emphasis">{dataSources.length}</p>
            <p class="text-sm text-dark-text-muted">Data Sources</p>
          </div>
        </div>
      </div>

      <div class="card p-4">
        <div class="flex items-center gap-4">
          <div class="w-12 h-12 bg-success/10 rounded-lg flex items-center justify-center">
            <svg class="w-6 h-6 text-success" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
          </div>
          <div>
            <p class="text-2xl font-semibold text-dark-text-emphasis">Online</p>
            <p class="text-sm text-dark-text-muted">Server Status</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Recent Topologies -->
    <div class="card">
      <div class="card-header flex items-center justify-between">
        <h2 class="font-medium text-dark-text-emphasis">Recent Topologies</h2>
        <a href="/topologies" class="text-sm text-primary hover:text-primary-dark">View all</a>
      </div>
      <div class="card-body">
        {#if topologies.length === 0}
          <div class="text-center py-8">
            <svg class="w-12 h-12 text-dark-text-muted mx-auto mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <circle cx="12" cy="5" r="3"/>
              <circle cx="5" cy="19" r="3"/>
              <circle cx="19" cy="19" r="3"/>
              <line x1="12" y1="8" x2="5" y2="16"/>
              <line x1="12" y1="8" x2="19" y2="16"/>
            </svg>
            <p class="text-dark-text-muted mb-4">No topologies yet</p>
            <a href="/topologies" class="btn btn-primary">Add Topology</a>
          </div>
        {:else}
          <div class="space-y-2">
            {#each topologies.slice(0, 5) as topology}
              <a
                href="/topologies/{topology.id}"
                class="flex items-center justify-between p-3 rounded-lg hover:bg-dark-bg transition-colors"
              >
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                    <svg class="w-5 h-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <circle cx="12" cy="5" r="3"/>
                      <circle cx="5" cy="19" r="3"/>
                      <circle cx="19" cy="19" r="3"/>
                      <line x1="12" y1="8" x2="5" y2="16"/>
                      <line x1="12" y1="8" x2="19" y2="16"/>
                    </svg>
                  </div>
                  <div>
                    <p class="font-medium text-dark-text-emphasis">{topology.name}</p>
                    <p class="text-xs text-dark-text-muted">
                      Updated {new Date(topology.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <svg class="w-5 h-5 text-dark-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </a>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>

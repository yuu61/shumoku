<script lang="ts">
  import { onMount } from 'svelte'
  import { page } from '$app/stores'
  import { goto } from '$app/navigation'
  import { api } from '$lib/api'
  import type { Topology, DataSource } from '$lib/types'

  // Get ID from route params (always defined for this route)
  $: id = $page.params.id!

  let topology: Topology | null = null
  let dataSources: DataSource[] = []
  let loading = true
  let error = ''
  let saving = false

  // Form state
  let formName = ''
  let formYaml = ''
  let formDataSourceId = ''

  onMount(async () => {
    try {
      const [topoData, dsData] = await Promise.all([
        api.topologies.get(id),
        api.dataSources.list(),
      ])
      topology = topoData
      dataSources = dsData
      formName = topology.name
      formYaml = topology.yamlContent
      formDataSourceId = topology.dataSourceId || ''
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load topology'
    } finally {
      loading = false
    }
  })

  async function handleSave() {
    if (!formName.trim() || !formYaml.trim()) {
      error = 'Name and YAML content are required'
      return
    }

    saving = true
    error = ''

    try {
      await api.topologies.update(id, {
        name: formName.trim(),
        yamlContent: formYaml,
        dataSourceId: formDataSourceId || undefined,
      })
      goto(`/topologies/${id}`)
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to save'
    } finally {
      saving = false
    }
  }
</script>

<svelte:head>
  <title>Edit {topology?.name || 'Topology'} - Shumoku</title>
</svelte:head>

<div class="p-6 h-full flex flex-col">
  <!-- Back link -->
  <a href="/topologies/{$page.params.id}" class="inline-flex items-center gap-2 text-dark-text-muted hover:text-dark-text mb-4">
    <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M19 12H5M12 19l-7-7 7-7"/>
    </svg>
    Back to Topology
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
    <div class="flex items-center justify-between mb-4">
      <h1 class="text-2xl font-semibold text-dark-text-emphasis">Edit {topology.name}</h1>
    </div>

    <div class="card flex-1 flex flex-col overflow-hidden">
      <form class="flex flex-col h-full" onsubmit={(e) => { e.preventDefault(); handleSave(); }}>
        <div class="p-4 border-b border-dark-border space-y-4">
          {#if error}
            <div class="p-3 bg-danger/10 border border-danger/20 rounded-lg text-danger text-sm">
              {error}
            </div>
          {/if}

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label for="name" class="label">Name</label>
              <input type="text" id="name" class="input" bind:value={formName} />
            </div>
            <div>
              <label for="dataSource" class="label">Data Source</label>
              <select id="dataSource" class="input" bind:value={formDataSourceId}>
                <option value="">None</option>
                {#each dataSources as ds}
                  <option value={ds.id}>{ds.name}</option>
                {/each}
              </select>
            </div>
          </div>
        </div>

        <div class="flex-1 p-4 overflow-hidden">
          <label for="yaml" class="label">YAML Definition</label>
          <textarea
            id="yaml"
            class="input font-mono text-sm h-[calc(100%-2rem)]"
            bind:value={formYaml}
          ></textarea>
        </div>

        <div class="flex justify-end gap-2 p-4 border-t border-dark-border">
          <a href="/topologies/{$page.params.id}" class="btn btn-secondary">Cancel</a>
          <button type="submit" class="btn btn-primary" disabled={saving}>
            {#if saving}
              <span class="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2"></span>
            {/if}
            Save Changes
          </button>
        </div>
      </form>
    </div>
  {/if}
</div>

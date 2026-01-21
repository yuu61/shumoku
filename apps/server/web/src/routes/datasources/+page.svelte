<script lang="ts">
  import { onMount } from 'svelte'
  import { dataSources, dataSourcesList, dataSourcesLoading, dataSourcesError } from '$lib/stores'
  import type { DataSource, ConnectionTestResult } from '$lib/types'

  let showCreateModal = false
  let testingId: string | null = null
  let testResult: ConnectionTestResult | null = null

  // Form state
  let formName = ''
  let formUrl = ''
  let formToken = ''
  let formPollInterval = 30000
  let formError = ''
  let formSubmitting = false

  onMount(() => {
    dataSources.load()
  })

  function openCreateModal() {
    formName = ''
    formUrl = ''
    formToken = ''
    formPollInterval = 30000
    formError = ''
    showCreateModal = true
  }

  function closeCreateModal() {
    showCreateModal = false
  }

  async function handleCreate() {
    if (!formName.trim() || !formUrl.trim()) {
      formError = 'Name and URL are required'
      return
    }

    formSubmitting = true
    formError = ''

    try {
      await dataSources.create({
        name: formName.trim(),
        url: formUrl.trim(),
        token: formToken.trim() || undefined,
        pollInterval: formPollInterval,
      })
      closeCreateModal()
    } catch (e) {
      formError = e instanceof Error ? e.message : 'Failed to create data source'
    } finally {
      formSubmitting = false
    }
  }

  async function handleTest(id: string) {
    testingId = id
    testResult = null
    try {
      testResult = await dataSources.test(id)
    } catch (e) {
      testResult = {
        success: false,
        message: e instanceof Error ? e.message : 'Test failed',
      }
    }
    testingId = null
  }

  async function handleDelete(ds: DataSource) {
    if (!confirm(`Delete data source "${ds.name}"?`)) {
      return
    }
    try {
      await dataSources.delete(ds.id)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to delete')
    }
  }
</script>

<svelte:head>
  <title>Data Sources - Shumoku</title>
</svelte:head>

<div class="p-6">
  <!-- Header -->
  <div class="flex items-center justify-between mb-6">
    <div>
      <h1 class="text-2xl font-semibold text-dark-text-emphasis">Data Sources</h1>
      <p class="text-dark-text-muted mt-1">Manage your Zabbix and other data source connections</p>
    </div>
    <button class="btn btn-primary" onclick={openCreateModal}>
      <svg class="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="12" y1="5" x2="12" y2="19"/>
        <line x1="5" y1="12" x2="19" y2="12"/>
      </svg>
      Add Data Source
    </button>
  </div>

  {#if $dataSourcesLoading}
    <div class="flex items-center justify-center py-12">
      <div class="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
    </div>
  {:else if $dataSourcesError}
    <div class="card p-6 text-center">
      <p class="text-danger">{$dataSourcesError}</p>
      <button class="btn btn-secondary mt-4" onclick={() => dataSources.load()}>Retry</button>
    </div>
  {:else if $dataSourcesList.length === 0}
    <div class="card p-12 text-center">
      <svg class="w-16 h-16 text-dark-text-muted mx-auto mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <ellipse cx="12" cy="5" rx="9" ry="3"/>
        <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
        <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
      </svg>
      <h3 class="text-lg font-medium text-dark-text-emphasis mb-2">No data sources</h3>
      <p class="text-dark-text-muted mb-4">Add a Zabbix server to start collecting metrics</p>
      <button class="btn btn-primary" onclick={openCreateModal}>Add Data Source</button>
    </div>
  {:else}
    <!-- Data Sources Table -->
    <div class="card">
      <table class="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>URL</th>
            <th>Poll Interval</th>
            <th>Status</th>
            <th class="text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {#each $dataSourcesList as ds}
            <tr>
              <td>
                <a href="/datasources/{ds.id}" class="font-medium text-dark-text-emphasis hover:text-primary">
                  {ds.name}
                </a>
              </td>
              <td>
                <span class="badge badge-info">{ds.type}</span>
              </td>
              <td class="text-dark-text-muted text-sm font-mono">{ds.url}</td>
              <td class="text-dark-text-muted">{ds.pollInterval / 1000}s</td>
              <td>
                {#if testResult && testingId === null}
                  <span class="badge {testResult.success ? 'badge-success' : 'badge-danger'}">
                    {testResult.success ? 'Connected' : 'Failed'}
                  </span>
                {:else}
                  <span class="badge badge-info">Unknown</span>
                {/if}
              </td>
              <td class="text-right">
                <div class="flex items-center justify-end gap-2">
                  <button
                    class="btn btn-secondary py-1 px-2 text-xs"
                    onclick={() => handleTest(ds.id)}
                    disabled={testingId === ds.id}
                  >
                    {#if testingId === ds.id}
                      <span class="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin mr-1"></span>
                    {/if}
                    Test
                  </button>
                  <a href="/datasources/{ds.id}" class="btn btn-secondary py-1 px-2 text-xs">Edit</a>
                  <button class="btn btn-danger py-1 px-2 text-xs" onclick={() => handleDelete(ds)}>Delete</button>
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>

<!-- Create Modal -->
{#if showCreateModal}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" role="dialog" aria-modal="true" onclick={closeCreateModal}>
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div class="bg-dark-bg-elevated border border-dark-border rounded-xl w-full max-w-md m-4" onclick={(e) => e.stopPropagation()}>
      <div class="flex items-center justify-between p-4 border-b border-dark-border">
        <h2 class="text-lg font-semibold text-dark-text-emphasis">Add Data Source</h2>
        <button class="text-dark-text-muted hover:text-dark-text" onclick={closeCreateModal} aria-label="Close">
          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <form class="p-4 space-y-4" onsubmit={(e) => { e.preventDefault(); handleCreate(); }}>
        {#if formError}
          <div class="p-3 bg-danger/10 border border-danger/20 rounded-lg text-danger text-sm">
            {formError}
          </div>
        {/if}

        <div>
          <label for="name" class="label">Name</label>
          <input
            type="text"
            id="name"
            class="input"
            placeholder="My Zabbix Server"
            bind:value={formName}
          />
        </div>

        <div>
          <label for="url" class="label">URL</label>
          <input
            type="url"
            id="url"
            class="input"
            placeholder="https://zabbix.example.com"
            bind:value={formUrl}
          />
        </div>

        <div>
          <label for="token" class="label">API Token</label>
          <input
            type="password"
            id="token"
            class="input"
            placeholder="Enter API token"
            bind:value={formToken}
          />
          <p class="text-xs text-dark-text-muted mt-1">Optional. Required for authenticated access.</p>
        </div>

        <div>
          <label for="pollInterval" class="label">Poll Interval</label>
          <select id="pollInterval" class="input" bind:value={formPollInterval}>
            <option value={5000}>5 seconds</option>
            <option value={10000}>10 seconds</option>
            <option value={30000}>30 seconds</option>
            <option value={60000}>1 minute</option>
            <option value={300000}>5 minutes</option>
          </select>
        </div>

        <div class="flex justify-end gap-2 pt-4 border-t border-dark-border">
          <button type="button" class="btn btn-secondary" onclick={closeCreateModal}>Cancel</button>
          <button type="submit" class="btn btn-primary" disabled={formSubmitting}>
            {#if formSubmitting}
              <span class="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2"></span>
            {/if}
            Create
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

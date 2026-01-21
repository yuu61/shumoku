<script lang="ts">
  import { onMount } from 'svelte'
  import { page } from '$app/stores'
  import { goto } from '$app/navigation'
  import { api } from '$lib/api'
  import type { DataSource, ConnectionTestResult } from '$lib/types'

  // Get ID from route params (always defined for this route)
  $: id = $page.params.id!

  let dataSource: DataSource | null = null
  let loading = true
  let error = ''
  let saving = false
  let testResult: ConnectionTestResult | null = null
  let testing = false

  // Form state
  let formName = ''
  let formUrl = ''
  let formToken = ''
  let formPollInterval = 30000

  onMount(async () => {
    try {
      dataSource = await api.dataSources.get(id)
      formName = dataSource.name
      formUrl = dataSource.url
      formToken = '' // Don't show existing token
      formPollInterval = dataSource.pollInterval
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load data source'
    } finally {
      loading = false
    }
  })

  async function handleSave() {
    if (!formName.trim() || !formUrl.trim()) {
      error = 'Name and URL are required'
      return
    }

    saving = true
    error = ''

    try {
      const updates: Record<string, unknown> = {
        name: formName.trim(),
        url: formUrl.trim(),
        pollInterval: formPollInterval,
      }

      // Only update token if a new one was entered
      if (formToken.trim()) {
        updates.token = formToken.trim()
      }

      dataSource = await api.dataSources.update(id, updates)
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to save'
    } finally {
      saving = false
    }
  }

  async function handleTest() {
    testing = true
    testResult = null
    try {
      testResult = await api.dataSources.test(id)
    } catch (e) {
      testResult = {
        success: false,
        message: e instanceof Error ? e.message : 'Test failed',
      }
    }
    testing = false
  }

  async function handleDelete() {
    if (!confirm(`Delete data source "${dataSource?.name}"?`)) {
      return
    }
    try {
      await api.dataSources.delete(id)
      goto('/datasources')
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to delete'
    }
  }
</script>

<svelte:head>
  <title>{dataSource?.name || 'Data Source'} - Shumoku</title>
</svelte:head>

<div class="p-6">
  <!-- Back link -->
  <a href="/datasources" class="inline-flex items-center gap-2 text-theme-text-muted hover:text-theme-text mb-4">
    <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M19 12H5M12 19l-7-7 7-7"/>
    </svg>
    Back to Data Sources
  </a>

  {#if loading}
    <div class="flex items-center justify-center py-12">
      <div class="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
    </div>
  {:else if error && !dataSource}
    <div class="card p-6 text-center">
      <p class="text-danger">{error}</p>
      <a href="/datasources" class="btn btn-secondary mt-4">Go Back</a>
    </div>
  {:else if dataSource}
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-semibold text-theme-text-emphasis">{dataSource.name}</h1>
      <button class="btn btn-danger" onclick={handleDelete}>Delete</button>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Edit Form -->
      <div class="lg:col-span-2">
        <div class="card">
          <div class="card-header">
            <h2 class="font-medium text-theme-text-emphasis">Configuration</h2>
          </div>
          <form class="card-body space-y-4" onsubmit={(e) => { e.preventDefault(); handleSave(); }}>
            {#if error}
              <div class="p-3 bg-danger/10 border border-danger/20 rounded-lg text-danger text-sm">
                {error}
              </div>
            {/if}

            <div>
              <label for="name" class="label">Name</label>
              <input type="text" id="name" class="input" bind:value={formName} />
            </div>

            <div>
              <label for="url" class="label">URL</label>
              <input type="url" id="url" class="input" bind:value={formUrl} />
            </div>

            <div>
              <label for="token" class="label">API Token</label>
              <input
                type="password"
                id="token"
                class="input"
                placeholder="Enter new token to update"
                bind:value={formToken}
              />
              <p class="text-xs text-theme-text-muted mt-1">
                {dataSource.token ? 'Token is set. Enter a new value to update.' : 'No token set.'}
              </p>
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

            <div class="flex justify-end pt-4 border-t border-theme-border">
              <button type="submit" class="btn btn-primary" disabled={saving}>
                {#if saving}
                  <span class="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2"></span>
                {/if}
                Save Changes
              </button>
            </div>
          </form>
        </div>
      </div>

      <!-- Connection Test -->
      <div>
        <div class="card">
          <div class="card-header">
            <h2 class="font-medium text-theme-text-emphasis">Connection Test</h2>
          </div>
          <div class="card-body">
            <button class="btn btn-secondary w-full mb-4" onclick={handleTest} disabled={testing}>
              {#if testing}
                <span class="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2"></span>
              {/if}
              Test Connection
            </button>

            {#if testResult}
              <div
                class="p-4 rounded-lg {testResult.success ? 'bg-success/10' : 'bg-danger/10'}"
              >
                <div class="flex items-center gap-2 mb-2">
                  {#if testResult.success}
                    <svg class="w-5 h-5 text-success" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                      <polyline points="22 4 12 14.01 9 11.01"/>
                    </svg>
                    <span class="font-medium text-success">Connected</span>
                  {:else}
                    <svg class="w-5 h-5 text-danger" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <circle cx="12" cy="12" r="10"/>
                      <line x1="15" y1="9" x2="9" y2="15"/>
                      <line x1="9" y1="9" x2="15" y2="15"/>
                    </svg>
                    <span class="font-medium text-danger">Failed</span>
                  {/if}
                </div>
                <p class="text-sm text-theme-text-muted">{testResult.message}</p>
                {#if testResult.version}
                  <p class="text-xs text-theme-text-muted mt-1">Zabbix version: {testResult.version}</p>
                {/if}
              </div>
            {/if}
          </div>
        </div>

        <!-- Info -->
        <div class="card mt-4">
          <div class="card-header">
            <h2 class="font-medium text-theme-text-emphasis">Info</h2>
          </div>
          <div class="card-body text-sm space-y-2">
            <div class="flex justify-between">
              <span class="text-theme-text-muted">ID</span>
              <span class="font-mono text-theme-text">{dataSource.id}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-theme-text-muted">Type</span>
              <span class="text-theme-text">{dataSource.type}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-theme-text-muted">Created</span>
              <span class="text-theme-text">{new Date(dataSource.createdAt).toLocaleString()}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-theme-text-muted">Updated</span>
              <span class="text-theme-text">{new Date(dataSource.updatedAt).toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>

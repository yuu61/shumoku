<script lang="ts">
  import '../app.css'
  import { page } from '$app/stores'

  interface NavItem {
    href: string
    label: string
    icon: string
  }

  const navItems: NavItem[] = [
    { href: '/', label: 'Home', icon: 'home' },
    { href: '/topologies', label: 'Topologies', icon: 'topology' },
    { href: '/datasources', label: 'Data Sources', icon: 'database' },
    { href: '/settings', label: 'Settings', icon: 'settings' },
  ]

  function isActive(href: string, pathname: string): boolean {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }
</script>

<div class="flex h-screen">
  <!-- Sidebar -->
  <aside class="w-64 bg-dark-bg-canvas border-r border-dark-border flex flex-col">
    <!-- Logo -->
    <div class="h-16 flex items-center gap-3 px-4 border-b border-dark-border">
      <div class="w-9 h-9 bg-primary rounded-lg flex items-center justify-center">
        <svg viewBox="0 0 1024 1024" class="w-5 h-5" fill="none">
          <g transform="translate(90,40) scale(1.25)">
            <path fill="#1F2328" d="M380 340H450V505H700V555H510V645H450V645H380Z"/>
          </g>
        </svg>
      </div>
      <span class="text-lg font-semibold text-dark-text-emphasis">Shumoku</span>
    </div>

    <!-- Navigation -->
    <nav class="flex-1 p-3 space-y-1">
      {#each navItems as item}
        <a
          href={item.href}
          class="nav-item"
          class:active={isActive(item.href, $page.url.pathname)}
        >
          {#if item.icon === 'home'}
            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          {:else if item.icon === 'topology'}
            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="5" r="3"/>
              <circle cx="5" cy="19" r="3"/>
              <circle cx="19" cy="19" r="3"/>
              <line x1="12" y1="8" x2="5" y2="16"/>
              <line x1="12" y1="8" x2="19" y2="16"/>
            </svg>
          {:else if item.icon === 'database'}
            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <ellipse cx="12" cy="5" rx="9" ry="3"/>
              <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
              <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
            </svg>
          {:else if item.icon === 'settings'}
            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          {/if}
          <span>{item.label}</span>
        </a>
      {/each}
    </nav>

    <!-- Version -->
    <div class="p-4 border-t border-dark-border">
      <div class="text-xs text-dark-text-muted">
        v0.1.0
      </div>
    </div>
  </aside>

  <!-- Main Content -->
  <main class="flex-1 overflow-auto">
    <slot />
  </main>
</div>

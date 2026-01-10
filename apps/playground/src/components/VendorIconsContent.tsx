import { useState, useMemo } from 'react'
import { vendorIconSets } from '@shumoku/icons'

type VendorKey = 'yamaha' | 'aruba' | 'juniper' | 'aws'

const vendorNames: Record<VendorKey, string> = {
  yamaha: 'Yamaha',
  aruba: 'Aruba',
  juniper: 'Juniper',
  aws: 'AWS',
}

const vendorOrder: VendorKey[] = ['yamaha', 'aruba', 'juniper', 'aws']

function IconPreview({ svg, viewBox }: { svg: string; viewBox?: string }) {
  // Some vendors (yamaha, juniper) have full <svg> tags, others (aruba, aws) have inner content only
  const needsWrapper = !svg.trim().startsWith('<svg')
  const content = needsWrapper
    ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox || '0 0 100 100'}">${svg}</svg>`
    : svg

  return (
    <span
      className="icon-preview"
      dangerouslySetInnerHTML={{ __html: content }}
    />
  )
}

export default function VendorIconsContent() {
  const [search, setSearch] = useState('')
  const [selectedVendor, setSelectedVendor] = useState<VendorKey | 'all'>('all')

  const iconCounts = useMemo(() => {
    const counts: Record<string, number> = { all: 0 }
    for (const vendor of vendorOrder) {
      const icons = vendorIconSets[vendor]
      const count = icons ? Object.keys(icons).length : 0
      counts[vendor] = count
      counts.all += count
    }
    return counts
  }, [])

  const filteredVendors = useMemo(() => {
    const results: { vendor: VendorKey; icons: { id: string; svg: string; viewBox?: string }[] }[] = []

    for (const vendor of vendorOrder) {
      if (selectedVendor !== 'all' && selectedVendor !== vendor) continue

      const icons = vendorIconSets[vendor]
      if (!icons) continue

      const filteredIcons: { id: string; svg: string; viewBox?: string }[] = []
      for (const [id, entry] of Object.entries(icons)) {
        if (search && !id.toLowerCase().includes(search.toLowerCase())) continue
        filteredIcons.push({
          id,
          svg: entry.default,
          viewBox: entry.viewBox,
        })
      }

      if (filteredIcons.length > 0) {
        results.push({ vendor, icons: filteredIcons })
      }
    }

    return results
  }, [search, selectedVendor])

  return (
    <div className="vendor-icons-content">
      <h1>Vendor Icons</h1>
      <p>Shumoku で使用可能な {iconCounts.all} 個のベンダーアイコン</p>

      <h2>インストール</h2>
      <pre><code>npm install @shumoku/icons</code></pre>

      <pre><code>{`import { registerAllIcons } from '@shumoku/icons'

// アイコンを登録
registerAllIcons()`}</code></pre>

      <h2>使用方法</h2>
      <pre><code>{`nodes:
  - id: router-1
    type: router
    vendor: yamaha
    model: rtx3510`}</code></pre>

      <h2>サポートベンダー一覧</h2>
      <table>
        <thead>
          <tr>
            <th>ベンダー</th>
            <th>アイコン数</th>
          </tr>
        </thead>
        <tbody>
          {vendorOrder.map((vendor) => (
            <tr key={vendor}>
              <td>{vendorNames[vendor]}</td>
              <td>{iconCounts[vendor]}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>アイコン検索</h2>
      <div className="vendor-icons-filters">
        <input
          type="text"
          placeholder="Search icons..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="vendor-icons-search"
        />
        <div className="vendor-icons-tabs">
          <button
            className={selectedVendor === 'all' ? 'active' : ''}
            onClick={() => setSelectedVendor('all')}
          >
            All ({iconCounts.all})
          </button>
          {vendorOrder.map((vendor) => (
            <button
              key={vendor}
              className={selectedVendor === vendor ? 'active' : ''}
              onClick={() => setSelectedVendor(vendor)}
            >
              {vendorNames[vendor]} ({iconCounts[vendor]})
            </button>
          ))}
        </div>
      </div>

      {filteredVendors.map(({ vendor, icons }) => (
        <section key={vendor}>
          <h2>{vendorNames[vendor]} ({icons.length})</h2>
          <table>
            <thead>
              <tr>
                <th>model / service</th>
                <th>Icon</th>
              </tr>
            </thead>
            <tbody>
              {icons.map(({ id, svg, viewBox }) => (
                <tr key={id}>
                  <td>
                    <code>{id}</code>
                  </td>
                  <td className="icon-cell">
                    <IconPreview svg={svg} viewBox={viewBox} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}

      {filteredVendors.length === 0 && search && (
        <p>No icons found for "{search}"</p>
      )}
    </div>
  )
}

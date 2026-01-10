import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import VendorIconsContent from '../components/VendorIconsContent'
import gettingStarted from '../../../../docs/getting-started.md?raw'
import yamlReference from '../../../../docs/yaml-reference.md?raw'
import apiReference from '../../../../docs/api-reference.md?raw'
import examples from '../../../../docs/examples.md?raw'
import netbox from '../../../../docs/netbox.md?raw'

const docs: Record<string, { title: string; content: string }> = {
  'getting-started': {
    title: 'Getting Started',
    content: gettingStarted,
  },
  'yaml-reference': {
    title: 'YAML Reference',
    content: yamlReference,
  },
  'api-reference': {
    title: 'API Reference',
    content: apiReference,
  },
  'examples': {
    title: 'Examples',
    content: examples,
  },
  'netbox': {
    title: 'NetBox Integration',
    content: netbox,
  },
}

export default function DocsPage() {
  const { docId } = useParams<{ docId: string }>()
  const [activeDoc, setActiveDoc] = useState(docId || 'getting-started')

  useEffect(() => {
    if (docId) {
      setActiveDoc(docId)
    }
  }, [docId])

  const currentDoc = docs[activeDoc]
  const isVendorIcons = activeDoc === 'vendor-icons'

  return (
    <div className="docs-page">
      <aside className="docs-sidebar">
        <nav>
          <h3>Documentation</h3>
          <ul>
            <li className="nav-section">はじめに</li>
            <li>
              <Link
                to="/docs/getting-started"
                className={activeDoc === 'getting-started' ? 'active' : ''}
                onClick={() => setActiveDoc('getting-started')}
              >
                Getting Started
              </Link>
            </li>
            <li className="nav-section">リファレンス</li>
            <li>
              <Link
                to="/docs/yaml-reference"
                className={activeDoc === 'yaml-reference' ? 'active' : ''}
                onClick={() => setActiveDoc('yaml-reference')}
              >
                YAML Reference
              </Link>
            </li>
            <li>
              <Link
                to="/docs/api-reference"
                className={activeDoc === 'api-reference' ? 'active' : ''}
                onClick={() => setActiveDoc('api-reference')}
              >
                API Reference
              </Link>
            </li>
            <li>
              <Link
                to="/docs/vendor-icons"
                className={activeDoc === 'vendor-icons' ? 'active' : ''}
                onClick={() => setActiveDoc('vendor-icons')}
              >
                Vendor Icons
              </Link>
            </li>
            <li className="nav-section">インテグレーション</li>
            <li>
              <Link
                to="/docs/netbox"
                className={activeDoc === 'netbox' ? 'active' : ''}
                onClick={() => setActiveDoc('netbox')}
              >
                NetBox
              </Link>
            </li>
            <li className="nav-section">サンプル</li>
            <li>
              <Link
                to="/docs/examples"
                className={activeDoc === 'examples' ? 'active' : ''}
                onClick={() => setActiveDoc('examples')}
              >
                Examples
              </Link>
            </li>
          </ul>
        </nav>
      </aside>
      <main className="docs-content">
        {isVendorIcons ? (
          <VendorIconsContent />
        ) : currentDoc ? (
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {currentDoc.content}
          </ReactMarkdown>
        ) : (
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {docs['getting-started'].content}
          </ReactMarkdown>
        )}
      </main>
    </div>
  )
}

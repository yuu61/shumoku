import type { ReactNode } from 'react'
import { CodeIcon, DocumentIcon, DownloadIcon, ImageIcon, LayoutIcon, NetBoxIcon } from './icons'

// Icons for each feature (order matches translations.features.items)
export const featureIcons: ReactNode[] = [
  <DocumentIcon key="document" className="w-6 h-6" />,
  <ImageIcon key="image" className="w-6 h-6" />,
  <LayoutIcon key="layout" className="w-6 h-6" />,
  <DownloadIcon key="download" className="w-6 h-6" />,
  <CodeIcon key="code" className="w-6 h-6" />,
  <NetBoxIcon key="netbox" className="w-6 h-6" />,
]

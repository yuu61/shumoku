import { RootProvider } from 'fumadocs-ui/provider/next'
import './global.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'

const inter = Inter({
  subsets: ['latin'],
})

export const metadata: Metadata = {
  metadataBase: new URL('https://shumoku.packof.me'),
  title: {
    default: 'Shumoku - Network Topology Diagram Generator',
    template: '%s | Shumoku',
  },
  description:
    'Network topology diagram generator. Generate SVG network diagrams from YAML. Supports Cisco, Yamaha, Juniper, Aruba, AWS icons (900+). NetBox integration. Diagram as code for network engineers.',
  openGraph: {
    title: 'Shumoku - Network Topology Diagram Generator',
    description:
      'Generate network topology diagrams from YAML. Diagram as code with 900+ vendor icons. NetBox integration.',
    siteName: 'Shumoku',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
  },
}

export default function Layout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={inter.className} suppressHydrationWarning>
      <body className="flex flex-col min-h-screen">
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  )
}

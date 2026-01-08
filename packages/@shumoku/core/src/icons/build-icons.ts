/**
 * Build script to convert SVG files to TypeScript
 * Run with: npx tsx src/icons/build-icons.ts
 */

import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const ICONS_DIR = path.join(__dirname)
const OUTPUT_FILE = path.join(__dirname, 'generated-icons.ts')

// Default icons (simple format)
interface DefaultIconSet {
  name: 'default'
  icons: Record<string, string>
}

// Vendor icons with theme variants
interface IconEntry {
  default: string
  light?: string
  dark?: string
  viewBox?: string  // Original SVG viewBox (e.g., "0 0 500 500")
}

interface VendorIconSet {
  name: string
  icons: Record<string, IconEntry>
}

type IconSet = DefaultIconSet | VendorIconSet

interface SvgExtractResult {
  content: string
  viewBox?: string
}

function extractSvgContent(svgContent: string): SvgExtractResult {
  // Extract the SVG tag attributes
  const svgTagMatch = svgContent.match(/<svg([^>]*)>/i)
  let viewBox: string | undefined

  if (svgTagMatch) {
    // Extract viewBox attribute
    const viewBoxMatch = svgTagMatch[1].match(/viewBox="([^"]+)"/i)
    if (viewBoxMatch) {
      viewBox = viewBoxMatch[1]
    }
  }

  // Extract the inner content of the SVG (everything inside <svg>...</svg>)
  const contentMatch = svgContent.match(/<svg[^>]*>([\s\S]*?)<\/svg>/i)
  if (!contentMatch) return { content: '' }

  // Clean up whitespace
  const content = contentMatch[1].trim().replace(/\s+/g, ' ')

  return { content, viewBox }
}

/**
 * Read PNG dimensions from file header
 * PNG header: bytes 16-19 = width, bytes 20-23 = height (big-endian)
 */
function getPngDimensions(buffer: Buffer): { width: number; height: number } {
  const width = buffer.readUInt32BE(16)
  const height = buffer.readUInt32BE(20)
  return { width, height }
}

/**
 * Convert PNG file to base64 image tag content for embedding in SVG
 * Reads actual PNG dimensions and creates appropriate viewBox
 */
function convertPngToImageTag(filePath: string): string {
  const buffer = fs.readFileSync(filePath)
  const base64 = buffer.toString('base64')
  const { width, height } = getPngDimensions(buffer)

  // Normalize to height=48 (matching AWS icon size) while preserving aspect ratio
  const normalizedWidth = Math.round((width / height) * 48)
  const normalizedHeight = 48

  // Return nested SVG with proper viewBox for the image dimensions
  return `<svg viewBox="0 0 ${normalizedWidth} ${normalizedHeight}" width="100%" height="100%"><image href="data:image/png;base64,${base64}" width="${normalizedWidth}" height="${normalizedHeight}" preserveAspectRatio="xMidYMid meet"/></svg>`
}

/**
 * Parse AWS icon filename to extract service, resource, and theme variant
 *
 * Examples:
 *   Res_Amazon-EC2_Instance_48.svg -> { key: 'ec2/instance', variant: 'default' }
 *   Res_Database_48_Light.svg -> { key: 'general/database', variant: 'light' }
 *   Res_AWS-IoT_Thing_Camera_48.svg -> { key: 'iot/thing-camera', variant: 'default' }
 */
function parseAWSFilename(filename: string): { key: string; variant: 'default' | 'light' | 'dark' } | null {
  // Remove .svg extension
  let name = filename.replace(/\.svg$/i, '')

  // Check for Light/Dark suffix
  let variant: 'default' | 'light' | 'dark' = 'default'
  if (name.endsWith('_Light')) {
    variant = 'light'
    name = name.slice(0, -6)
  } else if (name.endsWith('_Dark')) {
    variant = 'dark'
    name = name.slice(0, -5)
  }

  // Must start with Res_
  if (!name.startsWith('Res_')) {
    return null
  }
  name = name.slice(4) // Remove Res_

  // Remove _48 suffix if present
  name = name.replace(/_48$/, '')

  // Try to match Amazon-{Service}_{Resource} pattern
  const amazonMatch = name.match(/^Amazon-([^_]+)_(.+)$/)
  if (amazonMatch) {
    const service = normalizeServiceName(amazonMatch[1])
    const resource = normalizeResourceName(amazonMatch[2])
    return { key: `${service}/${resource}`, variant }
  }

  // Try to match AWS-{Service}_{Resource} pattern
  const awsMatch = name.match(/^AWS-([^_]+)_(.+)$/)
  if (awsMatch) {
    const service = normalizeServiceName(awsMatch[1])
    const resource = normalizeResourceName(awsMatch[2])
    return { key: `${service}/${resource}`, variant }
  }

  // Generic icon (no service prefix) - use 'general' as service
  const resource = normalizeResourceName(name)
  return { key: `general/${resource}`, variant }
}

function normalizeServiceName(name: string): string {
  return name
    .toLowerCase()
    .replace(/-/g, '')  // Remove hyphens (e.g., "Simple-Storage-Service" -> "simplestorageservice")
}

function normalizeResourceName(name: string): string {
  return name
    .toLowerCase()
    .replace(/_/g, '-')  // Replace underscores with hyphens
    .replace(/\s+/g, '-') // Replace spaces with hyphens
}

/**
 * Normalize Aruba icon name by removing category prefix
 * "Device - AP500 Series.svg" → "ap500-series"
 * "Client - Desktop.svg" → "desktop"
 */
function normalizeArubaIconName(filename: string): string {
  let name = filename.replace(/\.(svg|png)$/i, '')

  // Remove category prefixes
  const prefixes = ['Device - ', 'Client - ', 'Generic - ', 'Function - ']
  for (const prefix of prefixes) {
    if (name.startsWith(prefix)) {
      name = name.slice(prefix.length)
      break
    }
  }

  // Convert to lowercase and replace spaces with hyphens
  return name.toLowerCase().replace(/\s+/g, '-')
}

function scanDefaultIconFolder(folderPath: string, vendorName?: string): Record<string, string> {
  const icons: Record<string, string> = {}

  if (!fs.existsSync(folderPath)) {
    return icons
  }

  const files = fs.readdirSync(folderPath)

  for (const file of files) {
    const filePath = path.join(folderPath, file)

    // Handle SVG files
    if (file.endsWith('.svg')) {
      const content = fs.readFileSync(filePath, 'utf-8')
      // Use special normalization for Aruba icons
      const iconName = vendorName === 'aruba'
        ? normalizeArubaIconName(file)
        : file.replace('.svg', '')
      const { content: svgContent } = extractSvgContent(content)

      if (svgContent) {
        icons[iconName] = svgContent
      }
    }
    // Handle PNG files
    else if (file.endsWith('.png')) {
      const iconName = vendorName === 'aruba'
        ? normalizeArubaIconName(file)
        : file.replace('.png', '')
      const imageContent = convertPngToImageTag(filePath)
      icons[iconName] = imageContent
    }
  }

  return icons
}

/**
 * Scan vendor icon folder and return IconEntry with viewBox info
 */
function scanVendorIconFolder(folderPath: string, vendorName: string): Record<string, IconEntry> {
  const icons: Record<string, IconEntry> = {}

  if (!fs.existsSync(folderPath)) {
    return icons
  }

  const files = fs.readdirSync(folderPath)

  for (const file of files) {
    const filePath = path.join(folderPath, file)

    // Handle SVG files
    if (file.endsWith('.svg')) {
      const content = fs.readFileSync(filePath, 'utf-8')
      // Use special normalization for Aruba icons
      const iconName = vendorName === 'aruba'
        ? normalizeArubaIconName(file)
        : file.replace('.svg', '')
      const { content: svgContent, viewBox } = extractSvgContent(content)

      if (svgContent) {
        icons[iconName] = { default: svgContent, viewBox }
      }
    }
    // Handle PNG files
    else if (file.endsWith('.png')) {
      const iconName = vendorName === 'aruba'
        ? normalizeArubaIconName(file)
        : file.replace('.png', '')
      const imageContent = convertPngToImageTag(filePath)
      // PNG images use their own embedded viewBox
      icons[iconName] = { default: imageContent }
    }
  }

  return icons
}

function scanAWSIconFolder(folderPath: string): Record<string, IconEntry> {
  const icons: Record<string, IconEntry> = {}

  if (!fs.existsSync(folderPath)) {
    return icons
  }

  const files = fs.readdirSync(folderPath)

  for (const file of files) {
    if (!file.endsWith('.svg')) continue

    const parsed = parseAWSFilename(file)
    if (!parsed) continue

    const filePath = path.join(folderPath, file)
    const content = fs.readFileSync(filePath, 'utf-8')
    const { content: svgContent, viewBox } = extractSvgContent(content)

    if (!svgContent) continue

    const { key, variant } = parsed

    if (!icons[key]) {
      // AWS icons use 48x48 viewBox
      icons[key] = { default: '', viewBox: viewBox || '0 0 48 48' }
    }

    if (variant === 'light') {
      icons[key].light = svgContent
      // If no default set yet, use light as default
      if (!icons[key].default) {
        icons[key].default = svgContent
      }
    } else if (variant === 'dark') {
      icons[key].dark = svgContent
    } else {
      icons[key].default = svgContent
    }
  }

  // Clean up entries where default is empty but light exists
  for (const [_key, entry] of Object.entries(icons)) {
    if (!entry.default && entry.light) {
      entry.default = entry.light
    }
  }

  return icons
}

function generateTypeScript(iconSets: IconSet[]): string {
  const lines: string[] = [
    '/**',
    ' * Auto-generated icon definitions',
    ' * DO NOT EDIT - Run build-icons.ts to regenerate',
    ' */',
    '',
    "import { DeviceType } from '../models/v2'",
    '',
    "export type IconThemeVariant = 'light' | 'dark' | 'default'",
    '',
    'export interface IconEntry {',
    '  default: string',
    '  light?: string',
    '  dark?: string',
    '  viewBox?: string',
    '}',
    '',
  ]

  // Find default icon set
  const defaultSet = iconSets.find(s => s.name === 'default') as DefaultIconSet | undefined

  // Get all vendor sets (non-default)
  const vendorSets = iconSets.filter(s => s.name !== 'default') as VendorIconSet[]

  // Generate default icons
  if (defaultSet) {
    lines.push('// Default network device icons')
    lines.push('const defaultIcons: Record<string, string> = {')
    for (const [name, content] of Object.entries(defaultSet.icons)) {
      lines.push(`  '${name}': \`${content}\`,`)
    }
    lines.push('}')
    lines.push('')
  }

  // Generate vendor icons with theme variants
  const vendorVarNames: Record<string, string> = {}
  for (const vendorSet of vendorSets) {
    const varName = `${vendorSet.name}Icons`
    vendorVarNames[vendorSet.name] = varName

    lines.push(`// ${vendorSet.name.toUpperCase()} icons with theme variants`)
    lines.push(`const ${varName}: Record<string, IconEntry> = {`)
    const sortedKeys = Object.keys(vendorSet.icons).sort()
    for (const key of sortedKeys) {
      const entry = vendorSet.icons[key]
      const escapedDefault = entry.default.replace(/`/g, '\\`')

      if (entry.light || entry.dark || entry.viewBox) {
        lines.push(`  '${key}': {`)
        lines.push(`    default: \`${escapedDefault}\`,`)
        if (entry.light) {
          const escapedLight = entry.light.replace(/`/g, '\\`')
          lines.push(`    light: \`${escapedLight}\`,`)
        }
        if (entry.dark) {
          const escapedDark = entry.dark.replace(/`/g, '\\`')
          lines.push(`    dark: \`${escapedDark}\`,`)
        }
        if (entry.viewBox) {
          lines.push(`    viewBox: '${entry.viewBox}',`)
        }
        lines.push('  },')
      } else {
        lines.push(`  '${key}': { default: \`${escapedDefault}\` },`)
      }
    }
    lines.push('}')
    lines.push('')
  }

  // Generate DeviceType to icon mapping for default set
  lines.push('// Map DeviceType to icon key')
  lines.push('const deviceTypeToIcon: Record<DeviceType, string> = {')
  lines.push("  [DeviceType.Router]: 'router',")
  lines.push("  [DeviceType.L3Switch]: 'l3-switch',")
  lines.push("  [DeviceType.L2Switch]: 'l2-switch',")
  lines.push("  [DeviceType.Firewall]: 'firewall',")
  lines.push("  [DeviceType.LoadBalancer]: 'load-balancer',")
  lines.push("  [DeviceType.Server]: 'server',")
  lines.push("  [DeviceType.AccessPoint]: 'access-point',")
  lines.push("  [DeviceType.Cloud]: 'cloud',")
  lines.push("  [DeviceType.Internet]: 'internet',")
  lines.push("  [DeviceType.VPN]: 'vpn',")
  lines.push("  [DeviceType.Database]: 'database',")
  lines.push("  [DeviceType.Generic]: 'generic',")
  lines.push('}')
  lines.push('')

  // Generate all vendor icons lookup
  lines.push('// All vendor icon sets for dynamic lookup')
  lines.push('const vendorIconSets: Record<string, Record<string, IconEntry>> = {')
  for (const vendorSet of vendorSets) {
    lines.push(`  '${vendorSet.name}': ${vendorVarNames[vendorSet.name]},`)
  }
  lines.push('}')
  lines.push('')

  // Generate getter functions
  lines.push('/**')
  lines.push(' * Get SVG icon content for a device type (backward compatible)')
  lines.push(' * @param type - Device type')
  lines.push(' * @param _vendor - Optional vendor name (unused, for backward compatibility)')
  lines.push(' */')
  lines.push('export function getDeviceIcon(type?: DeviceType, _vendor?: string): string | undefined {')
  lines.push('  if (!type) return undefined')
  lines.push('  const iconKey = deviceTypeToIcon[type]')
  lines.push('  if (!iconKey) return undefined')
  lines.push('  return defaultIcons[iconKey]')
  lines.push('}')
  lines.push('')

  // New vendor icon getter - dynamic
  lines.push('/**')
  lines.push(' * Get icon by vendor, service, and optional resource')
  lines.push(" * @param vendor - Vendor name ('aws', 'yamaha', 'default', etc.)")
  lines.push(" * @param service - Service/model name (e.g., 'ec2', 'vpc', 'rtx3510')")
  lines.push(" * @param resource - Resource name (optional, e.g., 'instance', 'nat-gateway')")
  lines.push(" * @param theme - Theme variant ('light', 'dark', or 'default')")
  lines.push(' */')
  lines.push('export function getVendorIcon(')
  lines.push('  vendor: string,')
  lines.push('  service: string,')
  lines.push('  resource?: string,')
  lines.push("  theme: IconThemeVariant = 'default'")
  lines.push('): string | undefined {')
  lines.push("  if (vendor === 'default' || !vendor) {")
  lines.push('    return defaultIcons[service] || (resource ? defaultIcons[resource] : undefined)')
  lines.push('  }')
  lines.push('')
  lines.push('  // Look up vendor icon set')
  lines.push('  const vendorIcons = vendorIconSets[vendor]')
  lines.push('  if (!vendorIcons) return undefined')
  lines.push('')
  lines.push('  const key = resource ? `${service}/${resource}` : service')
  lines.push('  const entry = vendorIcons[key]')
  lines.push('  if (!entry) {')
  lines.push('    // Try to find a partial match (service-level icon)')
  lines.push("    const serviceKey = Object.keys(vendorIcons).find(k => k.startsWith(service + '/'))")
  lines.push('    if (serviceKey) {')
  lines.push('      const serviceEntry = vendorIcons[serviceKey]')
  lines.push('      return serviceEntry[theme] || serviceEntry.default')
  lines.push('    }')
  lines.push('    return undefined')
  lines.push('  }')
  lines.push('  return entry[theme] || entry.default')
  lines.push('}')
  lines.push('')

  // Add new function to get full icon entry with viewBox
  lines.push('/**')
  lines.push(' * Get full icon entry by vendor, service, and optional resource')
  lines.push(' * Returns the IconEntry object including viewBox information')
  lines.push(' */')
  lines.push('export function getVendorIconEntry(')
  lines.push('  vendor: string,')
  lines.push('  service: string,')
  lines.push('  resource?: string')
  lines.push('): IconEntry | undefined {')
  lines.push("  if (vendor === 'default' || !vendor) {")
  lines.push('    const content = defaultIcons[service] || (resource ? defaultIcons[resource] : undefined)')
  lines.push('    return content ? { default: content } : undefined')
  lines.push('  }')
  lines.push('')
  lines.push('  const vendorIcons = vendorIconSets[vendor]')
  lines.push('  if (!vendorIcons) return undefined')
  lines.push('')
  lines.push('  const key = resource ? `${service}/${resource}` : service')
  lines.push('  const entry = vendorIcons[key]')
  lines.push('  if (!entry) {')
  lines.push("    const serviceKey = Object.keys(vendorIcons).find(k => k.startsWith(service + '/'))")
  lines.push('    if (serviceKey) {')
  lines.push('      return vendorIcons[serviceKey]')
  lines.push('    }')
  lines.push('    return undefined')
  lines.push('  }')
  lines.push('  return entry')
  lines.push('}')
  lines.push('')

  // Export all icon sets
  lines.push('export const iconSets = {')
  if (defaultSet) lines.push('  default: defaultIcons,')
  for (const vendorSet of vendorSets) {
    lines.push(`  ${vendorSet.name}: ${vendorVarNames[vendorSet.name]},`)
  }
  lines.push('}')
  lines.push('')

  return lines.join('\n')
}

function main() {
  console.log('Building icons...')

  const iconSets: IconSet[] = []

  // Scan for icon folders
  const entries = fs.readdirSync(ICONS_DIR, { withFileTypes: true })

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    if (entry.name.startsWith('.')) continue

    const folderPath = path.join(ICONS_DIR, entry.name)

    if (entry.name === 'default') {
      // Default icons use simple format
      const icons = scanDefaultIconFolder(folderPath)
      if (Object.keys(icons).length > 0) {
        iconSets.push({ name: 'default', icons })
        console.log(`  Found ${Object.keys(icons).length} icons in ${entry.name}/`)
      }
    } else if (entry.name === 'aws') {
      // AWS icons use vendor format with theme variants
      const icons = scanAWSIconFolder(folderPath)
      if (Object.keys(icons).length > 0) {
        iconSets.push({ name: 'aws', icons })
        console.log(`  Found ${Object.keys(icons).length} unique AWS icons in ${entry.name}/`)
      }
    } else {
      // Other vendors use the vendor icon folder scanner which preserves viewBox
      const icons = scanVendorIconFolder(folderPath, entry.name)
      if (Object.keys(icons).length > 0) {
        iconSets.push({ name: entry.name, icons })
        console.log(`  Found ${Object.keys(icons).length} icons in ${entry.name}/`)
      }
    }
  }

  if (iconSets.length === 0) {
    console.log('No icons found!')
    return
  }

  const output = generateTypeScript(iconSets)
  fs.writeFileSync(OUTPUT_FILE, output, 'utf-8')

  console.log(`Generated ${OUTPUT_FILE}`)
}

main()

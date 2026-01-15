#!/usr/bin/env node
/**
 * Shumoku CLI - Render NetworkGraph JSON to SVG/HTML
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import type { NetworkGraph } from '@shumoku/core'
import { buildHierarchicalSheets, HierarchicalLayout } from '@shumoku/core'
import pkg from '../package.json' with { type: 'json' }
import * as html from './html/index.js'
import { INTERACTIVE_IIFE } from './iife-string.js'
import * as svg from './svg.js'

const VERSION = pkg.version

const HELP = `
shumoku v${VERSION} - Render NetworkGraph JSON to SVG/HTML

Usage: shumoku render [options] <input.json>

Input:
  <input.json>        NetworkGraph JSON file (use - for stdin)

Output:
  -f, --format <type> Output format: svg|html (default: auto from extension)
  -o, --output <file> Output file (default: output.svg)
  --theme <theme>     Theme: light|dark (default: light)

Other:
  -h, --help          Show help
  -v, --version       Show version

Examples:
  shumoku render topology.json -o diagram.svg
  shumoku render topology.json -f html -o diagram.html
  cat topology.json | shumoku render - -o diagram.svg
  netbox-to-shumoku -f json -o netbox.json && shumoku render netbox.json -o netbox.svg
`

type OutputFormat = 'svg' | 'html'

function cli() {
  const args = process.argv.slice(2)

  // Handle subcommand
  if (args[0] === 'render') {
    args.shift()
  }

  const { values, positionals } = parseArgs({
    args,
    options: {
      format: { type: 'string', short: 'f' },
      output: { type: 'string', short: 'o', default: 'output' },
      theme: { type: 'string' },
      help: { type: 'boolean', short: 'h', default: false },
      version: { type: 'boolean', short: 'v', default: false },
    },
    allowPositionals: true,
    strict: true,
  })

  if (values.help) {
    console.log(HELP)
    process.exit(0)
  }

  if (values.version) {
    console.log(VERSION)
    process.exit(0)
  }

  return { values, inputFile: positionals[0] }
}

async function main(): Promise<void> {
  const { values, inputFile } = cli()

  if (!inputFile) {
    console.error('Error: Input file required.')
    console.error('Usage: shumoku render <input.json>')
    console.error('Use --help for more information.')
    process.exit(1)
  }

  try {
    // Read input
    let jsonContent: string
    if (inputFile === '-') {
      // Read from stdin
      console.log('Reading from stdin...')
      const chunks: Buffer[] = []
      for await (const chunk of process.stdin) {
        chunks.push(chunk)
      }
      jsonContent = Buffer.concat(chunks).toString('utf-8')
    } else {
      console.log(`Reading ${inputFile}...`)
      jsonContent = readFileSync(resolve(process.cwd(), inputFile), 'utf-8')
    }

    // Parse JSON
    const graph: NetworkGraph = JSON.parse(jsonContent)
    console.log(`Loaded graph: ${graph.nodes.length} nodes, ${graph.links.length} links`)
    if (graph.subgraphs) {
      console.log(`  ${graph.subgraphs.length} subgraphs`)
    }

    // Determine format
    const outputBase = values.output!
    const extMatch = outputBase.toLowerCase().match(/\.(svg|html|htm)$/)
    const format: OutputFormat =
      (values.format as OutputFormat) ??
      (extMatch ? (extMatch[1] === 'htm' ? 'html' : (extMatch[1] as OutputFormat)) : 'svg')

    // Build output path
    const hasExt = /\.(svg|html|htm)$/i.test(outputBase)
    const outputPath = resolve(process.cwd(), hasExt ? outputBase : `${outputBase}.${format}`)

    // Ensure output directory exists
    mkdirSync(dirname(outputPath), { recursive: true })

    // Layout
    console.log('Generating layout...')
    const layout = new HierarchicalLayout()
    const layoutResult = await layout.layoutAsync(graph)

    // Render
    if (format === 'html') {
      console.log('Rendering HTML...')
      html.setIIFE(INTERACTIVE_IIFE)

      const sheets = await buildHierarchicalSheets(graph, layoutResult, layout)

      if (sheets.size > 1) {
        writeFileSync(outputPath, html.renderHierarchical(sheets), 'utf-8')
      } else {
        writeFileSync(outputPath, html.render(graph, layoutResult), 'utf-8')
      }
    } else {
      console.log('Rendering SVG...')
      writeFileSync(outputPath, svg.render(graph, layoutResult), 'utf-8')
    }

    console.log(`Output written to: ${outputPath}`)
    console.log('Done!')
  } catch (err) {
    if (err instanceof SyntaxError) {
      console.error('Error: Invalid JSON format')
      console.error(err.message)
    } else {
      console.error('Error:', err instanceof Error ? err.message : String(err))
    }
    process.exit(1)
  }
}

main()

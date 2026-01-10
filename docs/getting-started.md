# Getting Started

Shumoku を使ってネットワーク図を作成する方法を説明します。

## Installation

```bash
npm install shumoku
```

900+ のベンダーアイコン（Yamaha, Aruba, AWS, Juniper）が含まれています。

### NetBox 連携（オプション）

```bash
npm install @shumoku/netbox
```

## Basic Usage

### 1. YAML でネットワークを定義

```yaml
name: "My Network"

nodes:
  - id: router
    label: "Core Router"
    type: router
    vendor: yamaha
    model: rtx3510

  - id: switch
    label: "Main Switch"
    type: l2-switch

  - id: server
    label: "Web Server"
    type: server

links:
  - from: { node: router }
    to: { node: switch }
    bandwidth: 10G

  - from: { node: switch }
    to: { node: server }
    bandwidth: 1G
```

### 2. TypeScript/JavaScript で SVG を生成

```typescript
import { YamlParser, HierarchicalLayoutEngine, SvgRenderer } from 'shumoku'

// YAML をパース
const parser = new YamlParser()
const graph = parser.parse(yamlString)

// レイアウト計算
const engine = new HierarchicalLayoutEngine()
const layout = await engine.layout(graph)

// SVG 生成
const renderer = new SvgRenderer()
const svg = renderer.render(layout)

// DOM に追加
document.getElementById('diagram').innerHTML = svg
```

ベンダーアイコンは `shumoku` をインポートした時点で自動的に登録されます。

## Next Steps

- [YAML Reference](/docs/yaml-reference) - 完全な YAML 記法リファレンス
- [Vendor Icons](/docs/vendor-icons) - 利用可能なベンダーアイコン一覧
- [Examples](/docs/examples) - サンプルネットワーク集
- [API Reference](/docs/api-reference) - TypeScript API リファレンス
- [NetBox](/docs/netbox) - NetBox 連携

# @shumoku/icons

Vendor-specific icons for Shumoku network diagrams.

## Installation

```bash
npm install @shumoku/icons @shumoku/core
```

## Supported Vendors

| Vendor | Icons | Format | Description |
|--------|-------|--------|-------------|
| Yamaha | 103 | PNG | Network equipment (RTX, SWX, WLX series) |
| Aruba | 55 | SVG | Wireless and switching |
| AWS | 477 | SVG | Cloud services icons |
| Juniper | 343 | PNG | Network equipment |

## CDN Hosting

Icons are hosted on CDN at `https://icons.shumoku.packof.me` for optimal loading.

```
https://icons.shumoku.packof.me/v1/{vendor}/{model}.{png|svg}
```

Examples:
- `https://icons.shumoku.packof.me/v1/yamaha/rtx3510.png`
- `https://icons.shumoku.packof.me/v1/aws/ec2-instance.svg`
- `https://icons.shumoku.packof.me/v1/juniper/srx4100.png`

The renderer automatically fetches icon dimensions from CDN for proper aspect ratio rendering.

## Usage

```typescript
import { registerAllVendorIcons } from '@shumoku/icons'

// Register all vendor icons with @shumoku/core
registerAllVendorIcons()
```

Then use vendor icons in your YAML:

```yaml
nodes:
  - id: rt-01
    label: "Router"
    type: router
    vendor: yamaha
    model: rtx3510

  - id: ap-01
    label: "Access Point"
    type: access-point
    vendor: aruba
    model: ap-505

  - id: ec2-01
    label: "Web Server"
    vendor: aws
    service: ec2
    resource: instance
```

## Related Packages

- [`@shumoku/core`](https://www.npmjs.com/package/@shumoku/core) - Core library
- [`@shumoku/parser-yaml`](https://www.npmjs.com/package/@shumoku/parser-yaml) - YAML parser

## Documentation

- [Vendor Icons Reference](https://shumoku.packof.me/docs/vendor-icons) - Available icons
- [Playground](https://shumoku.packof.me/) - Interactive demo

## License

MIT

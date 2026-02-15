# Asset Licenses

All visual assets in Blueth City are **procedurally generated** — no external
images, textures, or fonts requiring separate licenses.

## Assets Inventory

| Asset | Type | Source | License |
|---|---|---|---|
| City skyline | Inline SVG (`city-skyline.tsx`) | Hand-authored procedural SVG | Original work, project license |
| Grid pattern | SVG `<pattern>` element | Inline in `city-map.tsx` | Original work, project license |
| Noise texture | SVG `<feTurbulence>` filter | Inline CSS data URI | W3C SVG spec primitive |
| Icons | React components | `lucide-react` | [MIT License](https://github.com/lucide-icons/lucide/blob/main/LICENSE) |
| Inter font | Web font | `next/font/google` | [SIL Open Font License 1.1](https://fonts.google.com/specimen/Inter/about) |

## Guidelines

- **Do not** add raster images (PNG, JPG, WebP) without updating this file.
- **Do not** use images sourced from the internet without verifying license
  compatibility and documenting the source here.
- Prefer procedural SVG and CSS for all decorative elements.

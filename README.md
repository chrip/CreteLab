# CreteLab - Concrete Recipe Calculator / Betonrezept Rechner

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub Pages](https://img.shields.io/static/v1?label=Deployed+on&message=GitHub+Pages&color=brightgreen)](https://chrip.github.io/CreteLab/)

Open-source concrete recipe calculator based on [Zement-Merkblatt B 20](https://www.beton.org/fileadmin/beton-org/media/Dokumente/PDF/Service/Zementmerkbl%C3%A4tter/B20.pdf). Runs entirely in the browser — no server, no app, no registration.

👉 **[chrip.github.io/CreteLab](https://chrip.github.io/CreteLab/)**

## Features

- Concrete recipe calculation for volume, strength class, and exposure class
- Grain size groups with moisture correction (batch water)
- Fly ash, silica fume, plasticizers, and superplasticizers
- Four presets from simple to high-strength
- Fine-tune existing recipes with additives
- UHPC (Ultra-High Performance Concrete) recipe scaler
- Mobile-first, offline-capable
- **Multi-language** (DE / EN) with URL-based locale routing

## Architecture

### Static Site Generation (SEO + AI Ready)

The app uses a build step to pre-render every page for each supported language. This makes the content immediately visible to crawlers and AI tools:

```
scripts/render.js    →  Pre-renders HTML for each locale using JSDOM
scripts/sitemap.xml  →  Generates sitemap.xml with hreflang tags
scripts/robots.txt   →  Generates robots.txt
```

Each page is available at `/de/` and `/en/` with:
- Correct `<html lang>` attribute
- `hreflang` alternate links for all language pairs
- `og:locale` for social sharing
- JSON-LD structured data (Schema.org SoftwareApplication)
- Canonical URLs

The root URL (`/`) serves the German page directly — no JavaScript redirect.

### Runtime i18n

After the initial render, the client-side i18n module takes over:
- Language switching updates the page without reload
- Dropdown labels, hints, and result text all translate dynamically
- Locale persists in `localStorage` and URL path

## Local Development

```bash
git clone https://github.com/chrip/CreteLab.git
cd CreteLab
npm install
```

### Preview built site (production-like)

```bash
# Build the localized pages
node scripts/render.js
node scripts/sitemap.js

# Serve from the build directory
python3 -m http.server 8000 --directory build
# Open http://localhost:8000/ (German default) or http://localhost:8000/en/
```

### Preview source files directly (development)

```bash
python3 -m http.server 8000
# Open http://localhost:8000/ (no URL-based locale)
```

### Tests

```bash
npm test
```

### Full CI pipeline locally

The GitHub Actions workflow runs tests, pre-renders pages, and generates the sitemap. To simulate locally:

```bash
npm test && node scripts/render.js && node scripts/sitemap.js
```

## Deployment

The site is deployed via GitHub Actions on every push to `main`:

1. **Test** — Run the full test suite (300 tests)
2. **Build** — Pre-render localized pages and generate sitemap
3. **Deploy** — Upload `build/` to GitHub Pages

## File Structure

```
CreteLab/
├── .github/workflows/deploy.yml   # CI/CD pipeline
├── build/                         # Pre-rendered output (gitignored)
│   ├── index.html                 # German default (root URL)
│   ├── de/                        # German locale
│   │   ├── index.html
│   │   ├── fine-tune.html
│   │   └── uhpc.html
│   ├── en/                        # English locale
│   │   ├── index.html
│   │   ├── fine-tune.html
│   │   └── uhpc.html
│   ├── css/                       # Styles
│   ├── js/                        # Application logic
│   ├── locales/                   # i18n catalogues
│   ├── assets/                    # Images, favicons
│   ├── sitemap.xml
│   └── robots.txt
├── css/                           # Source styles
├── js/                            # Source application logic
│   ├── app.js                     # Main calculator
│   ├── fine-tune.js               # Recipe fine-tuner
│   ├── uhpc.js                    # UHPC scaler
│   ├── lib/                       # Shared libraries
│   │   ├── i18n.js                # Translation module
│   │   ├── i18n-node.js           # Node.js i18n (server-side)
│   │   └── i18n-init.js           # Language detection + switcher
│   └── ...
├── locales/                       # i18n catalogues
│   ├── de.json
│   └── en.json
├── scripts/                       # Build scripts
│   ├── render.js                  # Pre-render localized HTML
│   └── sitemap.js                 # sitemap.xml + robots.txt
├── tests/                         # 300 passing tests
├── index.html                     # Main calculator (source)
├── fine-tune.html                 # Recipe fine-tuner (source)
└── uhpc.html                      # UHPC scaler (source)
```

## License

[MIT](LICENSE) © 2026 Christoph Schaefer

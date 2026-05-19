// sitemap.js — Generate sitemap.xml and robots.txt for GitHub Pages.
//
// Usage:  node scripts/sitemap.js --base https://chrip.github.io/CreteLab
//
// Outputs:
//   build/sitemap.xml
//   build/robots.txt

import { writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const BUILD = join(ROOT, 'build');

const LOCALES = ['de', 'en'];
const PAGES = ['index.html', 'fine-tune.html', 'uhpc.html'];

function parseArgs() {
  const args = process.argv.slice(2);
  let base = 'https://chrip.github.io/CreteLab';
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--base' && args[i + 1]) {
      base = args[i + 1];
      i++;
    }
  }
  return { base };
}

function generateSitemap(base) {
  const urls = [];

  // Root index = German default (canonical)
  urls.push({ loc: `${base}/`, locale: 'de', isRoot: true });
  // /de/ index = alternate German
  urls.push({ loc: `${base}/de/`, locale: 'de' });
  // /en/ index = English
  urls.push({ loc: `${base}/en/`, locale: 'en' });
  // Sub-pages in both locales
  for (const page of ['fine-tune.html', 'uhpc.html']) {
    urls.push({ loc: `${base}/de/${page}`, locale: 'de' });
    urls.push({ loc: `${base}/en/${page}`, locale: 'en' });
  }

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n';
  xml += '        xmlns:xhtml="http://www.w3.org/1999/xhtml">\n';

  for (const url of urls) {
    xml += '  <url>\n';
    xml += `    <loc>${url.loc}</loc>\n`;
    if (url.isRoot) {
      // Root is German canonical → alternate to /en/
      xml += `    <xhtml:link rel="alternate" hreflang="de" href="${url.loc}"/>\n`;
      xml += `    <xhtml:link rel="alternate" hreflang="en" href="${base}/en/"/>\n`;
    } else if (url.locale === 'de') {
      // German alternate → self + English
      xml += `    <xhtml:link rel="alternate" hreflang="de" href="${url.loc}"/>\n`;
      const enLoc = url.isRoot ? `${base}/en/` : url.loc.replace('/de/', '/en/');
      xml += `    <xhtml:link rel="alternate" hreflang="en" href="${enLoc}"/>\n`;
    } else {
      // English alternate → German + root
      xml += `    <xhtml:link rel="alternate" hreflang="en" href="${url.loc}"/>\n`;
      const deLoc = url.isRoot ? `${base}/de/` : url.loc.replace('/en/', '/de/');
      xml += `    <xhtml:link rel="alternate" hreflang="de" href="${deLoc}"/>\n`;
    }
    xml += '  </url>\n';
  }

  xml += '</urlset>\n';
  return xml;
}

function generateRobots(base) {
  return `User-agent: *\nAllow: /\n\nSitemap: ${base}/sitemap.xml\n`;
}

async function main() {
  const { base } = parseArgs();
  const sitemap = generateSitemap(base);
  writeFileSync(join(BUILD, 'sitemap.xml'), sitemap, 'utf8');
  console.log('Generated sitemap.xml');

  const robots = generateRobots(base);
  writeFileSync(join(BUILD, 'robots.txt'), robots, 'utf8');
  console.log('Generated robots.txt');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});

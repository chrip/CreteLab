# CreteLab - Betonrezept Rechner

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub Pages](https://img.shields.io/static/v1?label=Deployed+on&message=GitHub+Pages&color=brightgreen)](https://chrip.github.io/CreteLab/)

Kostenloser Betonrechner für Handwerker und Hobby-Bauleute, basierend auf dem [Zement-Merkblatt B 20](https://www.beton.org/fileadmin/beton-org/media/Dokumente/PDF/Service/Zementmerkbl%C3%A4tter/B20.pdf). Läuft komplett im Browser – kein Server, keine App, keine Registrierung.

👉 **[chrip.github.io/CreteLab](https://chrip.github.io/CreteLab/)**

## Was es kann

- Betonrezept berechnen für Volumen, Festigkeitsklasse und Expositionsklasse
- Korngruppen mit Feuchtekorrektur (Zugabewasser)
- Flugasche, Silikastaub, Betonverflüssiger und Fließmittel berücksichtigen
- Vier Voreinstellungen von einfach bis hochfest
- Mobile-first, offline nutzbar

## Lokal ausführen

```bash
git clone https://github.com/chrip/CreteLab.git
cd CreteLab
python3 -m http.server 8000
```

## Tests

```bash
npm install && npm test
```

163 Tests, 0 Fehler.

## Lizenz

[MIT](LICENSE) © 2026 Christoph Schaefer

# 🏗️ CreteLab - Open Source Betonrezept Rechner

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub Pages](https://img.shields.io/static/v1?label=Deployed+on&message=GitHub+Pages&color=brightgreen)](https://chrip.github.io/CreteLab/)

**CreteLab** ist ein Open-Source Betonrezept Rechner, der auf dem [Zement-Merkblatt B 20](https://www.zementportal.de/de/fachwissen/publikationen/zement-merkblaetter-zmb/zmb-b20/) basiert. Das Tool hilft Handwerkern und Hobby-Bauleuten dabei, die richtigen Betonzusammensetzungen für verschiedene Anwendungen zu berechnen – komplett kostenlos, ohne Server, direkt im Browser.

## 🌟 Features

- ✅ **Mobile First** - Optimiert für Smartphones und Tablets
- ✅ **100% Client-Side** - Keine Server, keine Datenbank, alles läuft lokal im Browser
- ✅ **Zement-Merkblatt B 20 konform** - Berechnungen basieren auf offiziellen deutschen Normen
- ✅ **Druckfestigkeitsklassen C 8/10 bis C 100/115** - Volle Unterstützung aller DIN EN 206 Klassen
- ✅ **Expositionsklassen XC1-XC4, XF1-XF4, XD1-XD3, XS1-XS3** - Für alle Umgebungsbedingungen
- ✅ **Zusatzstoffe** - Flugasche und Silikastaub mit k-Wert-Berechnung
- ✅ **Korngruppen & Zugabewasser** - Automatische Aufteilung nach Sieblinie mit Feuchtekorrektur
- ✅ **Offline nutzbar** - Einmal geladen, immer verfügbar

## 📱 Verwendungszwecke

| Verwendungszweck | Empfohlene Klasse | Expositionsklasse |
|-----------------|-------------------|-------------------|
| Gartenfundament | C 20/25 | XC1 |
| Tischplatte / Balkon | C 25/30 | XC2 |
| Einfahrt / Terrasse | C 25/30 | XF1 |
| Mauerwerk / Stützmauer | C 20/25 | XC1 |
| Bodenplatte | C 20/25 | XC2 |
| Treppe | C 25/30 | XF1 |

## 🚀 Verwenden

### Direkt im Browser

👉 **[chrip.github.io/CreteLab](https://chrip.github.io/CreteLab/)**

### Lokal ausführen

```bash
git clone https://github.com/chrip/CreteLab.git
cd CreteLab
python3 -m http.server 8000
# Browser: http://localhost:8000
```

## 📖 Berechnungsmethoden

### Druckfestigkeitsklassen (ZMB B20 Tafel 1)

Die charakteristische Festigkeit f_ck wird für Zylinder (150mm × 300mm) und Würfel (150mm) angegeben:

```
C 20/25 → f_ck,cyl = 20 N/mm², f_ck,cube = 25 N/mm², f_cm = 28 N/mm²
```

### Expositionsklassen (ZMB B20 Tafel 2)

Expositionsklassen definieren die Umgebungsbedingungen und maximale w/z-Werte:

| Klasse | Beschreibung | max w/z | min z (kg/m³) |
|--------|--------------|---------|---------------|
| XC1 | Trocken/feucht wechselnd | 0.75 | 240 |
| XC3 | Mäßig feucht | 0.65 | 260 |
| XF1 | Frostsicher ohne Tausalz | 0.60 | 280 |

### Konsistenz und Wasseranspruch (ZMB B20 Tafel 3)

Der Wasserbedarf wird über die Sieblinie berechnet:

```
w = 1300 / (k + 3) für Konsistenz F3 (weich)
```

Für Sieblinie B32 (k=4.20): w ≈ 181 l/m³

### Stoffraumrechnung (ZMB B20 Tafel 6.1)

Das Volumen-Gleichgewicht für 1 m³ Beton:

```
1000 dm³ = z/ρz + w/ρw + g/ρg + f/ρf + p

wobei:
  z = Zementgehalt [kg/m³]
  ρz = Rohdichte Zement (~3.0 kg/dm³)
  w = Wasserinhalt [l/m³]
  ρw = Rohdichte Wasser (1.0 kg/dm³)
  g = Gesteinskorngehalt [kg/m³]
  ρg = Rohdichte Gestein [kg/dm³]
  f = Zusatzstoffe [kg/m³]
  p = Porenvolumen (~20 dm³ für Normalbeton)
```

### Anrechenbarkeit von Zusatzstoffen (ZMB B20 Abschnitt 7.2)

**Flugasche (k_f = 0.4):**
- Bei Zementen ohne P, V, D: f ≤ 0.33·z
- Bei Zementen mit P oder V, aber ohne D: f ≤ 0.25·z

**Silikastaub (k_s = 1.0):**
- Bei allen Zementarten: s ≤ 0.11·z

### Äquivalenter w/z-Wert

Mit Zusatzstoffen wird der effektive w/z berechnet:

```
(w/z)_eq = w / (z + k·f)
```

## 🛠️ Entwicklung

### Projektstruktur

```
CreteLab/
├── index.html                  # Benutzeroberfläche
├── css/
│   └── styles.css              # Responsive Styles
├── js/
│   ├── app.js                  # Hauptanwendungslogik
│   └── lib/
│       ├── strength.js         # Druckfestigkeitsklassen & Walzkurven
│       ├── exposure.js         # Expositionsklassen
│       ├── consistency.js      # Konsistenz & Wasseranspruch
│       ├── densities.js        # Rohdichten der Gesteinskörnungen
│       ├── additives.js        # Zusatzstoffe & Zusatzmittel
│       ├── fines-content.js    # Mehlkorngehalt & Leimgehalt
│       └── aggregate-gradation.js  # Korngruppen & Zugabewasser
├── assets/                     # Bilder & Icons
├── tests/                      # Automatisierte Tests (163 Tests)
├── .github/workflows/
│   └── deploy.yml              # CI/CD: Tests + GitHub Pages Deploy
├── LICENSE
└── README.md
```

### Tests ausführen

```bash
npm install
npm test
```

163 Tests in 49 Suites, abgedeckt: Walzkurven, Expositionsklassen, Konsistenzklassen, SCM-Korrekturen, Korngruppen, Zugabewasser.

## 📄 Lizenz

Dieses Projekt steht unter der **MIT License**. Siehe [LICENSE](LICENSE) für Details.

## 📚 Quellen & Referenzen

1. **DIN EN 206** - Beton - Festlegung, Eigenschaften, Herstellung und Konformität
2. **Zement-Merkblatt B 20** - Berechnung der Betonzusammensetzung
   ([Download PDF](https://www.zementportal.de/de/fachwissen/publikationen/zement-merkblaetter-zmb/zmb-b20/))
3. **DIN 1045-2** - Tragwerke aus Beton, Stahlbeton und Spannbeton

## 📧 Kontakt & Support

- [Issues](https://github.com/chrip/CreteLab/issues) für Fehler und Fragen
- [Discussions](https://github.com/chrip/CreteLab/discussions) für allgemeine Diskussionen

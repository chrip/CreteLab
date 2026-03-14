# 🏗️ CreteLab - Open Source Betonrezept Rechner

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub Pages](https://img.shields.io/static/v1?label=Deployed+on&message=GitHub+Pages&color=brightgreen)](https://chrip.github.io/cretelab/)

**CreteLab** ist ein Open-Source Betonrezept Rechner, der auf dem [Zement-Merkblatt B 20](https://www.zementportal.de/de/fachwissen/publikationen/zement-merkblaetter-zmb/zmb-b20/) basiert. Das Tool hilft Handwerkern und Hobby-Bauleuten dabei, die richtigen Betonzusammensetzungen für verschiedene Anwendungen zu berechnen – komplett kostenlos, ohne Server, direkt im Browser.

## 🌟 Features

- ✅ **Mobile First** - Optimiert für Smartphones und Tablets
- ✅ **100% Client-Side** - Keine Server, keine Datenbank, alles läuft lokal im Browser
- ✅ **Zement-Merkblatt B 20 konform** - Berechnungen basieren auf offiziellen deutschen Normen
- ✅ **Druckfestigkeitsklassen C 8/10 bis C 100/115** - Volle Unterstützung aller DIN EN 206 Klassen
- ✅ **Expositionsklassen XC1-XC4, XF1-XF4, XD1-XD3, XS1-XS3** - Für alle Umgebungsbedingungen
- ✅ **Zusatzstoffe** - Flugasche und Silikastaub mit k-Wert-Berechnung
- ✅ **Verschiedene Gesteinskörnungen** - Von Leichtbeton bis Schwergewichtsbeton
- ✅ **Offline nutzbar** - Einmal geladen, immer verfügbar

## 📱 Verwendungszwecke

Das Tool unterstützt folgende Anwendungsfälle:

| Verwendungszweck | Empfohlene Klasse | Mindest-Festigkeit |
|-----------------|-------------------|-------------------|
| Gartenfundament | C 20/25 | XC1 |
| Tischplatte / Balkon | C 25/30 | XC2 |
| Einfahrt / Terrasse | C 25/30 | XF1 |
| Mauerwerk / Stützmauer | C 20/25 | XC1 |
| Bodenplatte | C 20/25 | XC2 |
| Treppe | C 25/30 | XF1 |

## 🚀 Installation & Deployment

### Lokal verwenden (ohne Server)

Da CreteLab komplett client-seitig ist, können Sie die Dateien einfach herunterladen und im Browser öffnen:

```bash
# Repository klonen
git clone https://github.com/chrip/cretelab.git
cd cretelab

# Lokal im Browser öffnen
open index.html  # macOS
start index.html  # Windows
xdg-open index.html  # Linux
```

### GitHub Pages Deployment

CreteLab ist für [GitHub Pages](https://pages.github.com/) optimiert:

1. **Repository erstellen** (falls noch nicht geschehen):
   ```bash
   cd cretelab
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/chrip/cretelab.git
   git push -u origin main
   ```

2. **GitHub Pages aktivieren**:
   - Repository → Settings → Pages
   - Source: `main` branch, `/ (root)` folder
   - Save

3. **Automatisches Deployment** (via GitHub Actions):
   
   Das Workflow-File `.github/workflows/deploy.yml` ist bereits enthalten und automatisch deployed bei jedem Push auf den main-Zweig.

4. **URL aufrufen**:
   ```
   https://<yourusername>.github.io/cretelab/
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
w = 1100 / (k + 3) für Konsistenz F3 (weich)
```

Für Sieblinie B32 (k=4.20): w ≈ 208 l/m³

### Stoffraumrechnung (ZMB B20 Tafel 6.1)

Das Volumen-Gleichgewicht für 1 m³ Beton:

```
1000 dm³ = z/ρz + w/ρw + g/ρg + f/ρf + p

wobei:
  z = Zementgehalt [kg/m³]
  ρz = Rohdichte Zement (~3.0 kg/dm³)
  w = Wasserinhalt [l/m³]
  ρw = Wasserticht (1.0 kg/dm³)
  g = Gesteinskorngehalt [kg/m³]
  ρg = Rohdichte Gestein [kg/dm³]
  f = Zusatzstoffe [kg/m³]
  p = Porenvolumen (~20 dm³ für Normalbeton)
```

### Anrechenbarkeit von Zusatzstoffen (ZMB B20 Abschnitt 7.2)

**Flugasche (k_f = 0.4):**
- Bei Zementen ohne P, V, D: f ≤ 0.33·z
- Bei Zementen mit P oder V, aber ohne D: f ≤ 0.25·z
- Bei Zement mit D: f ≤ 0.15·z

**Silikastaub (k_s = 1.0):**
- Bei allen Zementarten: s ≤ 0.11·z

### Äquivalenter w/z-Wert

Mit Zusatzstoffen wird der effektive w/z berechnet:

```
(w/z)_eq = w / (z + k·f)
```

Für Flugasche mit k=0.4 und 50 kg/m³ bei 300 kg Zement:
```
(w/z)_eq = w / (300 + 0.4×50) = w / 320
```

## 🛠️ Entwicklung

### Projektstruktur

```
cretelab/
├── index.html              # Hauptseite mit Benutzeroberfläche
├── css/
│   └── styles.css          # Responsive CSS Styles
├── js/
│   ├── app.js              # Hauptanwendungslogik
│   └── lib/
│       ├── strength.js     # Druckfestigkeitsklassen (Tafel 1)
│       ├── exposure.js     # Expositionsklassen (Tafel 2)
│       ├── consistency.js  # Konsistenz & Wasseranspruch (Tafel 3)
│       ├── densities.js    # Rohdichten (Tafel 4, 5, 6)
│       └── additives.js    # Zusatzstoffe (Abschnitt 7)
├── .github/
│   └── workflows/
│       └── deploy.yml      # GitHub Actions Deployment
├── LICENSE                 # MIT License
└── README.md               # Diese Datei
```

### Lokale Entwicklung

Um eine lokale Entwicklungsumgebung zu starten:

```bash
# Python 3 (empfohlen)
python3 -m http.server 8000

# Oder Node.js mit simple-http-server
npx serve .

# Dann im Browser öffnen:
http://localhost:8000
```

### Tests

Für einfache Manuelle Tests können Sie die JavaScript-Konsolen-Funktionen verwenden oder die Datei direkt im Browser öffnen.

## 📄 Lizenz

Dieses Projekt steht unter der **MIT License**. Das bedeutet:

- ✅ Freie Nutzung für kommerzielle und private Zwecke
- ✅ Modification und Distribution erlaubt
- ✅ Private Weiterentwicklung muss nicht geteilt werden
- ⚠️ Keine Gewährleistung, Urheber muss genannt werden

Siehe [LICENSE](LICENSE) für Details.

## 🤝 Contributing

Beiträge sind willkommen! Bitte folgen Sie diesen Schritten:

1. Fork das Repository
2. Erstellen Sie einen Feature Branch (`git checkout -b feature/amazing-feature`)
3. Committen Sie Ihre Änderungen (`git commit -m 'Add amazing feature'`)
4. Pushen Sie den Branch (`git push origin feature/amazing-feature`)
5. Öffnen Sie einen Pull Request

### Coding Guidelines

- Verwenden Sie ES6+ JavaScript Module
- Kommentare auf Deutsch oder Englisch (konsistent)
- Follow the existing code style
- Testen Sie Ihre Änderungen vor dem Commit

## 📚 Quellen & Referenzen

Dieses Projekt basiert auf folgenden Normen und Publikationen:

1. **DIN EN 206** - Beton - Festlegung, Eigenschaften, Herstellung und Konformität
2. **Zement-Merkblatt B 20** - Berechnung der Betonzusammensetzung
   [Download PDF](https://www.zementportal.de/de/fachwissen/publikationen/zement-merkblaetter-zmb/zmb-b20/)
3. **DIN 1045-2** - Tragwerke aus Beton, Stahlbeton und Spannbeton

## 🙏 Danksagungen

- **Deutsche Zementindustrie** für das umfassende Merkblatt B 20
- **GitHub** für die kostenlose Hosting-Infrastruktur via GitHub Pages
- **Open Source Community** für Inspiration und Best Practices

## 📧 Kontakt & Support

Bei Fragen oder Problemen:

- [Issues](https://github.com/chrip/cretelab/issues) auf GitHub
- [Discussions](https://github.com/chrip/cretelab/discussions) für allgemeine Fragen

---

**CreteLab** - Open Source Betonrezept Rechner | [MIT License](LICENSE) | Built with ❤️ for the construction community
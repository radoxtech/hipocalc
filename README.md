# HipoCalc - Kalkulator Nadpłaty Kredytu Hipotecznego

> **Znajdź swój Złoty Środek** - nadpłacaj mądrze, żyj pełnią życia

Nowoczesny kalkulator nadpłat kredytu hipotecznego z unikalnym algorytmem "Złoty Środek", który pomaga znaleźć optymalną równowagę między oszczędzaniem a jakością życia.

🌐 **Live Demo**: [radoxtech.github.io/hipocalc](https://radoxtech.github.io/hipocalc/)

## ✨ Funkcje

### 📊 Symulacja Nadpłat
- **Dwa typy rat**: Równe (annuity) i Malejące (decreasing)
- **Trzy strategie**: Bez nadpłat / Skróć okres / Zmniejsz ratę
- **Nadpłaty**: Miesięczne i roczne
- **Porównanie**: Wizualizacja oszczędności między scenariuszami

### 🎯 Algorytm "Złoty Środek"
Automatycznie wylicza optymalną nadpłatę uwzględniając:
- Dochód netto i stałe wydatki
- Obecną ratę kredytu
- Status poduszki bezpieczeństwa (6 miesięcy)
- **Zasada 50/50**: Równowaga między nadpłatą a budżetem na przyjemności
- Minimum 1000 zł/mies na życie

### 📈 Wizualizacje
- **Wykres salda**: Spadek zadłużenia w czasie
- **Wykres oszczędności**: Kumulatywne oszczędności na odsetkach
- **Porównanie scenariuszy**: 3 linie (bez nadpłaty / skróć / zmniejsz)
- **Harmonogram**: Pełna tabela spłat (wszystkie miesiące)

### 💾 Inne
- **localStorage**: Automatyczne zapisywanie inputów
- **Tryb ciemny**: Automatyczne wykrywanie preferencji systemowych
- **Responsywność**: Działa na desktop i mobile
- **Dostępność**: WCAG-compliant

## 🚀 Technologie

- **Framework**: [SvelteKit](https://kit.svelte.dev/) 2.x (Svelte 5)
- **Hosting**: GitHub Pages (static)
- **Build**: Vite + TypeScript
- **Obliczenia**: [Decimal.js](https://mikemcl.github.io/decimal.js/) (precyzja finansowa)
- **Wykresy**: [uPlot](https://github.com/leeoniya/uPlot) (15KB, 4x mniejszy od Chart.js)
- **Testy**: Vitest (TDD - 36 passing tests)
- **Style**: CSS Variables (design tokens), Inter font
- **CI/CD**: GitHub Actions

## 🧮 Logika Finansowa

### Formuły
```typescript
// Raty równe (annuity)
R = K × (r / (1 - (1 + r)^(-n)))

// Raty malejące (decreasing)
R_n = K/n + S_n × r
```

### Strategia "Zmniejsz ratę" (reduce-payment)
**Unikalna implementacja**: Utrzymuje stałą całkowitą wpłatę miesięczną
- Przykład: 5000 zł rata + 4000 zł nadpłata = **9000 zł fixed total**
- Miesiąc 1: payment=5000, overpayment=4000, total=9000 ✓
- Miesiąc 20: payment=2000, **overpayment=7000**, total=9000 ✓
- Efekt: Szybsza spłata mimo "zmniejszenia raty"

## 🛠️ Rozwój Lokalny

### Wymagania
- Node.js 20+
- npm lub bun

### Instalacja
```bash
git clone https://github.com/radoxtech/hipocalc.git
cd hipocalc
npm install
```

### Uruchomienie
```bash
npm run dev
# Otwórz http://localhost:5173
```

### Testy
```bash
npm run test        # Uruchom testy
npm run test:watch  # Tryb watch
```

### Build
```bash
npm run build       # Produkcyjny build → build/
npm run preview     # Podgląd buildu lokalnie
```

## 📁 Struktura Projektu

```
hipocalc/
├── src/
│   ├── lib/
│   │   ├── engine/              # Logika finansowa (pure functions)
│   │   │   ├── mortgage.ts      # Formuły kredytowe
│   │   │   ├── mortgage.test.ts # 26 testów
│   │   │   ├── golden-mean.ts   # Algorytm Złoty Środek
│   │   │   ├── golden-mean.test.ts # 10 testów
│   │   │   └── types.ts         # TypeScript interfaces
│   │   ├── components/          # Komponenty UI
│   │   │   ├── VintageCard.svelte
│   │   │   ├── VintageInput.svelte
│   │   │   ├── VintageButton.svelte
│   │   │   └── charts/          # Wykresy uPlot
│   │   │       ├── BalanceChart.svelte
│   │   │       ├── SavingsChart.svelte
│   │   │       └── ScenarioComparison.svelte
│   │   └── styles/
│   │       └── tokens.css       # Design system (CSS Variables)
│   ├── routes/
│   │   ├── +layout.svelte       # Layout + global styles
│   │   └── +page.svelte         # Główna strona kalkulatora
│   ├── app.html                 # HTML template
│   └── app.css                  # Global styles
├── static/
│   ├── favicon.ico
│   └── .nojekyll                # GitHub Pages config
├── .github/
│   └── workflows/
│       └── deploy.yml           # CI/CD pipeline
├── svelte.config.js             # SvelteKit config (base: '/hipocalc')
├── vite.config.ts               # Vite + Vitest config
└── package.json
```

## 🧪 Testy (TDD)

Projekt został zbudowany używając Test-Driven Development:

```bash
npm run test
```

**Coverage**: 36 testów (26 mortgage + 10 golden-mean)
- ✅ Formuły rat równych i malejących
- ✅ Scenariusze nadpłat (shorten-term, reduce-payment)
- ✅ Logika Złotego Środka
- ✅ Edge cases (ostatnia rata, nadpłata > saldo)

## 📝 Licencja

MIT © 2025 RadoxTech

## 🙏 Kredyty

Dumnie stworzone przy pomocy:
- [Oh My OpenCode](https://github.com/ohmyopencode/opencode) - AI development framework
- **Anthropic Claude Opus 4** & **Sonnet 4.5** - AI models

---

**Problem? Feature request?** [Otwórz issue](https://github.com/radoxtech/hipocalc/issues)

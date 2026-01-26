# Historia Zmian

Wszystkie istotne zmiany w projekcie HipoCalc będą dokumentowane w tym pliku.

Format oparty na [Keep a Changelog](https://keepachangelog.com/pl/1.0.0/).

## [1.0.0] - 2026-01-26

### Dodane
- Kalkulator nadpłat kredytu hipotecznego z obsługą rat równych (annuity) i malejących (decreasing)
- Algorytm "Złoty Środek" - automatyczna optymalizacja nadpłat z zachowaniem równowagi między oszczędzaniem a jakością życia
- Trzy strategie spłaty kredytu:
  - Bez nadpłat (baseline)
  - Skróć okres kredytowania
  - Zmniejsz ratę miesięczną (unikalna implementacja z fixed total payment)
- Nadpłaty miesięczne i roczne
- Interaktywne wykresy finansowe:
  - Wykres salda kredytu w czasie
  - Wykres kumulatywnych oszczędności na odsetkach
  - Porównanie trzech scenariuszy spłaty
  - Podświetlenie najgorszego okresu (pierwsze 60 miesięcy)
- Pełny harmonogram spłat z możliwością paginacji (wszystkie miesiące)
- Panel "Złoty Środek" z obliczaniem optymalnej nadpłaty:
  - Uwzględnia dochód netto i stałe wydatki
  - Sprawdza status poduszki bezpieczeństwa (6 miesięcy)
  - Stosuje zasadę 50/50 (nadpłata vs przyjemności)
  - Gwarantuje minimum 1000 zł/mies na życie
- Tryb ciemny z automatycznym wykrywaniem preferencji systemowych
- Automatyczne zapisywanie danych w localStorage
- Przełącznik wejścia: lata ↔ miesiące dla okresu kredytowania
- Responsywny design działający na desktop i mobile
- System testów jednostkowych (36 testów, TDD approach)
- Deployment na GitHub Pages z automatycznym CI/CD
- Accessibility (WCAG-compliant)

### Naprawione
- Poprawiono kontrast tekstu przy hover na przełączniku rok/miesiąc - zmieniono kolor tła hover na #AA8C28 z kremowym tekstem (commit 103b384)
- Dodano banner ostrzegawczy u góry strony: "⚠️ Kalkulator w fazie testów - wyniki mogą być niedokładne" (commit 8b35fa9)
- Ustawiono domyślne zaznaczenie checkboxa "Reinwestuj zaoszczędzoną różnicę" na true (commit 103b384)
- Naprawiono logikę checkboxa reinwestycji - przy odznaczeniu różnica jest teraz poprawnie odejmowana w dalszych obliczeniach (commit 22ead17)
- Zwiększono widoczność linii "Skróć okres" na wykresie porównania scenariuszy - zmieniono kolor z #730000 na #A0201E i grubość z 2px na 3px (commit 2b5177a)
- Zwiększono intensywność podświetlenia najgorszego okresu na wykresie salda - opacity wzrosła z 0.08 do 0.18 (commit b680fae)

### Techniczne
- **Framework**: SvelteKit 2.x z Svelte 5 (runes API)
- **Język**: TypeScript
- **Obliczenia finansowe**: Decimal.js (precyzja do 30 miejsc dziesiętnych)
- **Wykresy**: uPlot 1.6.32 (ultra-lekka biblioteka, 15KB)
- **Testy**: Vitest 4.0.18 z 36 testami jednostkowymi
- **Style**: CSS Variables (design tokens), Inter font
- **Build**: Vite 7.3.1
- **Hosting**: GitHub Pages (static site)
- **CI/CD**: GitHub Actions z automatycznym deploymentem

## [Unreleased]

_Puste - brak zaplanowanych zmian_

## [1.1.0] - 2026-01-26

### Dodane
- **Suwak podwyżki rocznej (0-25%)** - pozwala symulować zwiększanie nadpłaty co rok wraz z podwyżką w pracy
- **Czwarta strategia spłaty "Zmniejsz ratę+"** - zmniejsza ratę i reinwestuje zaoszczędzoną różnicę

### Zmienione
- Refaktoryzacja z 3+checkbox na 4 stałe strategie spłaty:
  - Bez nadpłat (baseline)
  - Skróć okres (stała nadpłata, kredyt kończy się szybciej)
  - Zmniejsz ratę (stała nadpłata, rata maleje, zaoszczędzona różnica do kieszeni)
  - Zmniejsz ratę+ (jak wyżej + reinwestowanie zaoszczędzonej różnicy)
- Usunięto checkbox "Reinwestuj zaoszczędzoną różnicę" - zastąpiony osobną strategią
- Zmieniono tryb ciemny z 3 stanów (light/dark/auto) na 2 stany (light/dark)

### Naprawione
- Poprawiono kontrast bannera ostrzegawczego w trybie ciemnym
- Naprawiono obliczenia strategii "Zmniejsz ratę" - teraz poprawnie NIE reinwestuje zaoszczędzonej różnicy
- Skrócono tytuł "Zmniejsz ratę plus" do "Zmniejsz ratę+" żeby zmieścił się w jednej linii
- Dodano offset +1/+2 zł dla nakładających się linii na wykresie (widoczność)
- Naprawiono łamanie tekstu w kartach podsumowania (white-space: nowrap)
- Poprawiono wyjaśnienia w hintach:
  - Dodano opis "przyjemności" (jednorazowe wydatki, samochód, podróże)
  - Wyjaśniono 15%/50% jako procent wolnej puli na nadpłatę
- Ukryto pole "miesiące poduszki" gdy użytkownik już ma poduszkę bezpieczeństwa
- Poprawiono tekst stopki: "Zbudowane z pomocą sztucznej inteligencji"

---

## Konwencje

### Typy zmian
- **Dodane** - nowe funkcje
- **Zmienione** - zmiany w istniejącej funkcjonalności
- **Przestarzałe** - funkcje które wkrótce zostaną usunięte
- **Usunięte** - usunięte funkcje
- **Naprawione** - poprawki błędów
- **Bezpieczeństwo** - zmiany dotyczące bezpieczeństwa

### Format dat
Daty w formacie ISO 8601: RRRR-MM-DD

### Linki do wersji
- [1.0.0]: https://github.com/radoxtech/hipocalc/releases/tag/v1.0.0

import Decimal from 'decimal.js';

/** Dane wejściowe dla algorytmu Złoty Środek */
export interface GoldenMeanInput {
  netIncome: Decimal;                 // Dochód netto miesięczny
  fixedExpenses: Decimal;             // Stałe wydatki (bez przyjemności)
  mortgagePayment: Decimal;           // Aktualna rata kredytu
  emergencyFundMonths: number;        // Docelowa poduszka (w miesiącach wydatków)
  emergencyFundStatus: 'have' | 'build-fast' | 'build-slow-3y';
  currentAge?: number;                // Opcjonalnie: wiek (do przyszłych rozszerzeń)
}

/** Wynik algorytmu Złoty Środek */
export interface GoldenMeanOutput {
  recommendedOverpayment: Decimal;    // Zalecana nadpłata miesięczna
  discretionaryBudget: Decimal;       // Budżet na przyjemności
  emergencyContribution: Decimal;     // Miesięczna składka na poduszkę
  rationale: string;                  // Uzasadnienie rekomendacji
  warning?: string;                   // Opcjonalne ostrzeżenie
}

// Minimalna kwota na przyjemności, poniżej której nie rekomendujemy nadpłat
const MIN_PLEASURE_BUDGET = new Decimal(1000);

// Próg ostrzeżenia: nadpłata > 30% dochodu
const OVERPAYMENT_WARNING_THRESHOLD = new Decimal(0.30);

// Procent odkładany na poduszkę w trybie "fast"
const EMERGENCY_FAST_RATE = new Decimal(0.50);

// Procent odkładany na poduszkę w trybie "slow"
const EMERGENCY_SLOW_RATE = new Decimal(0.15);

/**
 * Algorytm "Złoty Środek" - oblicza optymalną nadpłatę bez rezygnacji z przyjemności
 * 
 * Zasada: 50% na nadpłatę, 50% na przyjemności, ale:
 * - Najpierw poduszka bezpieczeństwa (jeśli nie ma)
 * - Minimum 1000 zł na przyjemności
 * - Ostrzeżenie jeśli nadpłata > 30% dochodu
 */
export function calculateGoldenMean(input: GoldenMeanInput): GoldenMeanOutput {
  const {
    netIncome,
    fixedExpenses,
    mortgagePayment,
    emergencyFundStatus
  } = input;

  // 1. Oblicz dostępne środki po podstawowych wydatkach
  const available = netIncome.minus(fixedExpenses).minus(mortgagePayment);

  // Edge case: wydatki przekraczają dochód
  if (available.lessThanOrEqualTo(0)) {
    return {
      recommendedOverpayment: new Decimal(0),
      discretionaryBudget: new Decimal(0),
      emergencyContribution: new Decimal(0),
      rationale: 'Brak wolnych środków po pokryciu podstawowych wydatków.',
      warning: 'Uwaga: Twoje wydatki przekraczają dochód. Rozważ redukcję kosztów stałych.'
    };
  }

  // 2. Oblicz składkę na poduszkę bezpieczeństwa
  let emergencyContribution = new Decimal(0);
  let remainingAfterEmergency = available;

  if (emergencyFundStatus === 'build-fast') {
    emergencyContribution = available.times(EMERGENCY_FAST_RATE);
    remainingAfterEmergency = available.minus(emergencyContribution);
  } else if (emergencyFundStatus === 'build-slow-3y') {
    emergencyContribution = available.times(EMERGENCY_SLOW_RATE);
    remainingAfterEmergency = available.minus(emergencyContribution);
  }
  // 'have' = no emergency contribution

  // 3. Podziel pozostałe 50/50
  let overpayment = remainingAfterEmergency.dividedBy(2);
  let pleasures = remainingAfterEmergency.dividedBy(2);

  // 4. Zapewnij minimum na przyjemności
  if (pleasures.lessThan(MIN_PLEASURE_BUDGET)) {
    // Priorytet: życie > nadpłata
    if (remainingAfterEmergency.greaterThanOrEqualTo(MIN_PLEASURE_BUDGET)) {
      // Mamy wystarczająco - daj minimum na przyjemności, resztę na nadpłatę
      pleasures = MIN_PLEASURE_BUDGET;
      overpayment = remainingAfterEmergency.minus(MIN_PLEASURE_BUDGET);
    } else {
      // Nie ma wystarczająco nawet na minimum przyjemności
      pleasures = remainingAfterEmergency;
      overpayment = new Decimal(0);
    }
  }

  // 5. Sprawdź próg ostrzeżenia
  let warning: string | undefined;
  const overpaymentRatio = overpayment.dividedBy(netIncome);

  if (overpaymentRatio.greaterThan(OVERPAYMENT_WARNING_THRESHOLD)) {
    warning = `Nadpłata przekracza 30% Twojego dochodu. To może być ryzykowne w przypadku nieprzewidzianych wydatków.`;
  }

  // 6. Zbuduj uzasadnienie
  let rationale = '';

  if (overpayment.isZero()) {
    rationale = 'Przy obecnym budżecie zalecamy skupienie się na przyjemnościach i codziennym komforcie. Nadpłaty będą możliwe gdy zwiększą się dochody lub zmniejszą wydatki.';
  } else if (emergencyFundStatus !== 'have') {
    const statusText = emergencyFundStatus === 'build-fast' ? 'szybko' : 'stopniowo';
    rationale = `Budujesz poduszkę bezpieczeństwa ${statusText}. Po jej zbudowaniu będziesz mógł zwiększyć nadpłaty.`;
  } else {
    rationale = `Złoty Środek: ${overpayment.toDecimalPlaces(0)} zł na nadpłatę kredytu, ${pleasures.toDecimalPlaces(0)} zł na przyjemności. Balans między przyszłością a teraźniejszością.`;
  }

  return {
    recommendedOverpayment: overpayment.toDecimalPlaces(2),
    discretionaryBudget: pleasures.toDecimalPlaces(2),
    emergencyContribution: emergencyContribution.toDecimalPlaces(2),
    rationale,
    warning
  };
}

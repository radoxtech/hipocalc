import Decimal from 'decimal.js';

// Configure Decimal.js for financial calculations
Decimal.set({
  precision: 20,
  rounding: Decimal.ROUND_HALF_UP
});

/** Dane wejściowe kredytu */
export interface Loan {
  principal: Decimal;           // Kwota kredytu (zł)
  annualRate: Decimal;          // Oprocentowanie roczne (np. 0.075 = 7.5%)
  months: number;               // Okres kredytu w miesiącach
  type: 'annuity' | 'decreasing'; // Typ rat
}

/** Konfiguracja nadpłat */
export interface Overpayments {
  monthly: Decimal;             // Stała nadpłata miesięczna (zł)
  yearly: Decimal;              // Nadpłata roczna (zł)
  yearlyMonth: number;          // Który miesiąc roku (1-12, domyślnie 12 = grudzień)
  annualRaisePercent?: number;  // Roczna podwyżka nadpłaty (0-25%)
}

/** Strategia nadpłaty */
export type Strategy =
  | 'none'              // Bez nadpłat
  | 'shorten-term'      // Skróć okres (rata stała, mniej miesięcy)
  | 'reduce-payment';   // Zmniejsz ratę (okres stały, niższa rata)

/** Jeden wiersz harmonogramu */
export interface ScheduleRow {
  month: number;                // Numer miesiąca (1, 2, 3...)
  payment: Decimal;             // Rata podstawowa (kapitał + odsetki)
  principal: Decimal;           // Część kapitałowa raty
  interest: Decimal;            // Część odsetkowa raty
  overpayment: Decimal;         // Nadpłata w tym miesiącu
  totalPaid: Decimal;           // payment + overpayment
  balanceAfter: Decimal;        // Saldo po spłacie
}

/** Pełny harmonogram */
export interface Schedule {
  rows: ScheduleRow[];
  summary: {
    totalMonths: number;
    totalPaid: Decimal;
    totalInterest: Decimal;
    totalOverpayments: Decimal;
  };
}

/** Wynik obliczenia raty malejącej */
export interface DecreasingPaymentResult {
  principal: Decimal;   // Część kapitałowa
  interest: Decimal;    // Część odsetkowa
  total: Decimal;       // Razem (rata)
}

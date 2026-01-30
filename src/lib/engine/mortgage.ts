import Decimal from 'decimal.js';
import type { Loan, Overpayments, Strategy, Schedule, ScheduleRow, DecreasingPaymentResult } from './types';
import {
  shouldApplyYearlyOverpayment,
  applyAnnualRaise,
  calculateMonthlyPayment,
  recalculatePaymentForReduceStrategy
} from './schedule-core';

/**
 * Zaokrągla wartość do groszy (2 miejsca po przecinku) używając ROUND_HALF_UP
 */
export function toGrosze(value: Decimal): Decimal {
  return value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

/**
 * Oblicza ratę równą (annuity payment)
 * Formula: R = K × (r / (1 - (1 + r)^(-n)))
 * 
 * @param principal - Kwota kredytu
 * @param monthlyRate - Miesięczna stopa procentowa (np. 0.005 dla 6% rocznie)
 * @param months - Liczba miesięcy
 */
export function calculateAnnuityPayment(
  principal: Decimal,
  monthlyRate: Decimal,
  months: number
): Decimal {
  // Handle zero interest rate
  if (monthlyRate.isZero()) {
    return principal.dividedBy(months);
  }

  // R = K × (r / (1 - (1 + r)^(-n)))
  const onePlusR = monthlyRate.plus(1);
  const power = onePlusR.pow(-months);
  const denominator = new Decimal(1).minus(power);
  const payment = principal.times(monthlyRate).dividedBy(denominator);

  return payment;
}

/**
 * Oblicza ratę malejącą dla danego miesiąca
 * Formula: R_n = K/n + S_n × r
 * 
 * @param originalPrincipal - Początkowa kwota kredytu
 * @param monthlyRate - Miesięczna stopa procentowa
 * @param totalMonths - Całkowita liczba miesięcy
 * @param currentMonth - Bieżący miesiąc (1-indexed)
 */
export function calculateDecreasingPayment(
  originalPrincipal: Decimal,
  monthlyRate: Decimal,
  totalMonths: number,
  currentMonth: number
): DecreasingPaymentResult {
  // Część kapitałowa jest stała
  const principalPart = originalPrincipal.dividedBy(totalMonths);

  // Saldo na początku danego miesiąca
  const monthsPaid = currentMonth - 1;
  const balance = originalPrincipal.minus(principalPart.times(monthsPaid));

  // Odsetki od bieżącego salda
  const interest = balance.times(monthlyRate);

  return {
    principal: principalPart,
    interest: interest,
    total: principalPart.plus(interest)
  };
}

/**
 * Generuje harmonogram spłat z uwzględnieniem nadpłat
 */
export function generateAmortizationSchedule(
  loan: Loan,
  overpayments: Overpayments,
  strategy: Strategy
): Schedule {
  const rows: ScheduleRow[] = [];
  const monthlyRate = loan.annualRate.dividedBy(12);

  let balance = loan.principal;
  let remainingMonths = loan.months;

  // For annuity: calculate initial payment
  let currentAnnuityPayment = loan.type === 'annuity'
    ? calculateAnnuityPayment(loan.principal, monthlyRate, loan.months)
    : new Decimal(0);

  // For decreasing with shorten-term: original capital portion stays fixed
  const originalCapitalPortion = loan.principal.dividedBy(loan.months);

  // For decreasing with reduce-payment: capital portion will be recalculated
  let currentCapitalPortion = originalCapitalPortion;

  let totalInterest = new Decimal(0);
  let totalOverpayments = new Decimal(0);
  let totalPaid = new Decimal(0);
  
  const annualRaise = overpayments.annualRaisePercent || 0;
  let currentMonthlyOverpayment = overpayments.monthly;

  let month = 0;

  while (balance.greaterThan(0.01) && month < loan.months * 2) {
    month++;
    remainingMonths = loan.months - month + 1;

    // 1. Calculate interest on current balance
    const interest = balance.times(monthlyRate);
    totalInterest = totalInterest.plus(interest);

    // 2. Calculate payment based on loan type
    const paymentResult = calculateMonthlyPayment(
      balance,
      monthlyRate,
      remainingMonths,
      loan.type,
      currentAnnuityPayment,
      currentCapitalPortion
    );
    const payment = paymentResult.payment;
    let principalPart = paymentResult.principalPart;

    // 3. Apply payment to balance
    balance = balance.minus(principalPart);

    // 4. Calculate overpayment for this month
    let overpayment = new Decimal(0);
    
    // Apply annual raise at the start of each year (month 13, 25, 37, etc.)
    currentMonthlyOverpayment = applyAnnualRaise(currentMonthlyOverpayment, month, annualRaise);

    if (strategy === 'reduce-payment') {
      // For reduce-payment: use ONLY the fixed overpayment user entered
      // The savings from reduced payment go to user's pocket, NOT reinvested
      overpayment = currentMonthlyOverpayment;
      
      // Add yearly overpayment if applicable
      if (shouldApplyYearlyOverpayment(month, overpayments.yearlyMonth)) {
        overpayment = overpayment.plus(overpayments.yearly);
      }

      // Cap overpayment to remaining balance
      if (overpayment.greaterThan(balance)) {
        overpayment = balance;
      }

      // Apply overpayment
      balance = balance.minus(overpayment);
      totalOverpayments = totalOverpayments.plus(overpayment);
    } else if (strategy === 'shorten-term') {
      overpayment = currentMonthlyOverpayment;

      // Yearly overpayment (if this is the right month)
      if (shouldApplyYearlyOverpayment(month, overpayments.yearlyMonth)) {
        overpayment = overpayment.plus(overpayments.yearly);
      }

      // Cap overpayment to remaining balance
      if (overpayment.greaterThan(balance)) {
        overpayment = balance;
      }

      // Apply overpayment
      balance = balance.minus(overpayment);
      totalOverpayments = totalOverpayments.plus(overpayment);
    }
    // For 'none' strategy: overpayment stays 0

    // 5. Recalculate for next payment based on strategy
    if (strategy === 'reduce-payment' && balance.greaterThan(0)) {
      const newRemainingMonths = loan.months - month;
      if (newRemainingMonths > 0) {
        const recalculated = recalculatePaymentForReduceStrategy(
          balance,
          monthlyRate,
          newRemainingMonths,
          loan.type
        );
        
        if (loan.type === 'annuity') {
          currentAnnuityPayment = recalculated;
        } else {
          currentCapitalPortion = recalculated;
        }
      }
    }
    // For shorten-term: payment/capital portion stays the same, just fewer months

    // Record row
    const row: ScheduleRow = {
      month,
      payment,
      principal: principalPart,
      interest,
      overpayment,
      totalPaid: payment.plus(overpayment),
      balanceAfter: balance
    };

    rows.push(row);
    totalPaid = totalPaid.plus(row.totalPaid);

    // Exit if balance is effectively zero
    if (balance.lessThanOrEqualTo(0.01)) {
      break;
    }
  }

  return {
    rows,
    summary: {
      totalMonths: rows.length,
      totalPaid,
      totalInterest,
      totalOverpayments,
      initialTotalPayment: rows[0] ? rows[0].payment.plus(rows[0].overpayment) : new Decimal(0)
    }
  };
}

/**
 * Oblicza sumę odsetek z harmonogramu
 */
export function calculateTotalInterest(schedule: Schedule): Decimal {
  return schedule.summary.totalInterest;
}

/**
 * Oblicza oszczędności między dwoma scenariuszami
 */
export function calculateSavings(
  withOverpayment: Schedule,
  withoutOverpayment: Schedule
): { interestSaved: Decimal; monthsSaved: number } {
  const interestSaved = withoutOverpayment.summary.totalInterest.minus(
    withOverpayment.summary.totalInterest
  );

  const monthsSaved = withoutOverpayment.summary.totalMonths - withOverpayment.summary.totalMonths;

  return {
    interestSaved,
    monthsSaved
  };
}

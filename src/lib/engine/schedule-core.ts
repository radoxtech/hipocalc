import Decimal from 'decimal.js';
import { calculateAnnuityPayment } from './mortgage';

/**
 * Checks if yearly overpayment should be applied for the current month
 * 
 * @param month - Current month number (1-indexed)
 * @param yearlyMonth - Month when yearly overpayment is applied (1-12, where 12 can represent end of year)
 * @returns true if yearly overpayment should be applied
 * 
 * @example
 * shouldApplyYearlyOverpayment(12, 6) // false - not June
 * shouldApplyYearlyOverpayment(6, 6)  // true - it's June
 * shouldApplyYearlyOverpayment(12, 12) // true - month 12 matches yearlyMonth 12
 * shouldApplyYearlyOverpayment(24, 12) // true - month 24 % 12 = 0 and yearlyMonth = 12
 */
export function shouldApplyYearlyOverpayment(month: number, yearlyMonth: number): boolean {
  return month % 12 === yearlyMonth % 12 || (yearlyMonth === 12 && month % 12 === 0);
}

/**
 * Applies annual raise to overpayment amount at the start of each year
 * 
 * @param currentOverpayment - Current overpayment amount
 * @param month - Current month number (1-indexed)
 * @param annualRaisePercent - Annual raise percentage (e.g., 3 for 3%)
 * @returns Updated overpayment amount (raised if applicable)
 * 
 * @example
 * applyAnnualRaise(new Decimal(1000), 1, 3)  // 1000 - no raise on month 1
 * applyAnnualRaise(new Decimal(1000), 13, 3) // 1030 - 3% raise at start of year 2
 * applyAnnualRaise(new Decimal(1000), 25, 3) // 1030 - 3% raise at start of year 3
 */
export function applyAnnualRaise(
  currentOverpayment: Decimal,
  month: number,
  annualRaisePercent: number
): Decimal {
  if (month > 1 && month % 12 === 1 && annualRaisePercent > 0) {
    return currentOverpayment.times(1 + annualRaisePercent / 100);
  }
  return currentOverpayment;
}

/**
 * Unified monthly payment calculation for both annuity and decreasing loan types
 * 
 * @param balance - Current loan balance
 * @param monthlyRate - Monthly interest rate (decimal, e.g., 0.005 for 6% annual)
 * @param remainingMonths - Number of months remaining
 * @param loanType - Type of loan: 'annuity' or 'decreasing'
 * @param currentAnnuityPayment - Current annuity payment (only used for annuity type)
 * @param currentCapitalPortion - Current capital portion (only used for decreasing type)
 * @returns Object with payment, principalPart, and interest
 * 
 * @example
 * // Annuity loan
 * calculateMonthlyPayment(
 *   new Decimal(400000),
 *   new Decimal(0.005),
 *   360,
 *   'annuity',
 *   new Decimal(2398.20),
 *   new Decimal(0)
 * )
 * // Returns: { payment: 2398.20, principalPart: 398.20, interest: 2000.00 }
 * 
 * // Decreasing loan
 * calculateMonthlyPayment(
 *   new Decimal(400000),
 *   new Decimal(0.005),
 *   360,
 *   'decreasing',
 *   new Decimal(0),
 *   new Decimal(1111.11)
 * )
 * // Returns: { payment: 3111.11, principalPart: 1111.11, interest: 2000.00 }
 */
export function calculateMonthlyPayment(
  balance: Decimal,
  monthlyRate: Decimal,
  _remainingMonths: number,
  loanType: 'annuity' | 'decreasing',
  currentAnnuityPayment: Decimal,
  currentCapitalPortion: Decimal
): { payment: Decimal; principalPart: Decimal; interest: Decimal } {
  const interest = balance.times(monthlyRate);

  let payment: Decimal;
  let principalPart: Decimal;

  if (loanType === 'annuity') {
    payment = currentAnnuityPayment;
    principalPart = payment.minus(interest);

    // Handle last payment edge case - principal can't exceed balance
    if (principalPart.greaterThan(balance)) {
      principalPart = balance;
      payment = principalPart.plus(interest);
    }
  } else {
    // Decreasing loan
    principalPart = currentCapitalPortion;

    // Handle last payment edge case
    if (principalPart.greaterThan(balance)) {
      principalPart = balance;
    }

    payment = principalPart.plus(interest);
  }

  return { payment, principalPart, interest };
}

/**
 * Recalculates payment for reduce-payment strategy after overpayment is applied
 * 
 * For annuity: recalculates payment based on new balance and remaining months
 * For decreasing: recalculates capital portion by dividing balance by remaining months
 * 
 * @param balance - Current loan balance after overpayment
 * @param monthlyRate - Monthly interest rate
 * @param remainingMonths - Number of months remaining
 * @param loanType - Type of loan: 'annuity' or 'decreasing'
 * @returns Updated payment amount or capital portion
 * 
 * @example
 * // Annuity - balance reduced from 400k to 350k
 * recalculatePaymentForReduceStrategy(
 *   new Decimal(350000),
 *   new Decimal(0.005),
 *   350,
 *   'annuity'
 * )
 * // Returns new annuity payment (lower than before)
 * 
 * // Decreasing - balance reduced from 400k to 350k
 * recalculatePaymentForReduceStrategy(
 *   new Decimal(350000),
 *   new Decimal(0.005),
 *   350,
 *   'decreasing'
 * )
 * // Returns new capital portion: 350000 / 350 = 1000
 */
export function recalculatePaymentForReduceStrategy(
  balance: Decimal,
  monthlyRate: Decimal,
  remainingMonths: number,
  loanType: 'annuity' | 'decreasing'
): Decimal {
  if (remainingMonths <= 0) {
    return new Decimal(0);
  }

  if (loanType === 'annuity') {
    return calculateAnnuityPayment(balance, monthlyRate, remainingMonths);
  } else {
    // Decreasing: recalculate capital portion
    return balance.dividedBy(remainingMonths);
  }
}

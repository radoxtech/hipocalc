import Decimal from 'decimal.js';
import type { Loan, Overpayments, Schedule, Strategy } from './types';
import { generateAmortizationSchedule, calculateAnnuityPayment } from './mortgage';

export type SimulationStrategy = 'none' | 'reduce' | 'reduce-plus' | 'shorten';

export interface RateSimulationInput {
  principal: Decimal;
  currentRate: number;
  months: number;
  loanType: 'annuity' | 'decreasing';
  monthlyOverpayment: Decimal;
  yearlyOverpayment: Decimal;
  yearlyMonth: number;
  strategy: SimulationStrategy;
  /** Original monthly payment at currentRate (used to calculate fixed budget) */
  originalMonthlyPayment?: Decimal;
  /** Annual raise percent for budget (e.g., 3 for 3% yearly increase) */
  annualRaisePercent?: number;
}

export interface RateSimulationResult {
  schedule: Schedule;
  totalInterest: Decimal;
  totalMonths: number;
}

export interface RateComparisonResult {
  originalResult: RateSimulationResult;
  newResult: RateSimulationResult;
  interestDifference: Decimal;
  monthsDifference: number;
}

export function calculateReinvestSchedule(
  loan: Loan,
  overpayments: Overpayments,
  scheduleWithoutOverpayment: Schedule
): Schedule {
  const rows: import('./types').ScheduleRow[] = [];
  const monthlyRate = loan.annualRate.dividedBy(12);
  
  let balance = loan.principal;
  let currentAnnuityPayment = loan.type === 'annuity'
    ? calculateAnnuityPayment(loan.principal, monthlyRate, loan.months)
    : new Decimal(0);
  
  const originalCapitalPortion = loan.principal.dividedBy(loan.months);
  let currentCapitalPortion = originalCapitalPortion;

  let totalInterest = new Decimal(0);
  let totalOverpayments = new Decimal(0);
  let totalPaid = new Decimal(0);
  let month = 0;

  while (balance.greaterThan(0.01) && month < loan.months * 2) {
    month++;
    
    const interest = balance.times(monthlyRate);
    totalInterest = totalInterest.plus(interest);

    let payment: Decimal;
    let principalPart: Decimal;

    if (loan.type === 'annuity') {
      payment = currentAnnuityPayment;
      principalPart = payment.minus(interest);
      
      if (principalPart.greaterThan(balance)) {
        principalPart = balance;
        payment = principalPart.plus(interest);
      }
    } else {
      principalPart = currentCapitalPortion;
      
      if (principalPart.greaterThan(balance)) {
        principalPart = balance;
      }
      
      payment = principalPart.plus(interest);
    }

    balance = balance.minus(principalPart);

    let overpayment = overpayments.monthly;
    
    if (month % 12 === overpayments.yearlyMonth % 12 || 
        (overpayments.yearlyMonth === 12 && month % 12 === 0)) {
      overpayment = overpayment.plus(overpayments.yearly);
    }

    // Reinvest: add savings from lower payment vs original schedule
    if (month <= scheduleWithoutOverpayment.rows.length) {
      const paymentWithoutOverpayment = scheduleWithoutOverpayment.rows[month - 1]?.payment || new Decimal(0);
      const savingsThisMonth = paymentWithoutOverpayment.minus(payment);
      
      if (savingsThisMonth.greaterThan(0)) {
        overpayment = overpayment.plus(savingsThisMonth);
      }
    }

    if (overpayment.greaterThan(balance)) {
      overpayment = balance;
    }

    balance = balance.minus(overpayment);
    totalOverpayments = totalOverpayments.plus(overpayment);

    const totalPaidThisMonth = payment.plus(overpayment);
    totalPaid = totalPaid.plus(totalPaidThisMonth);

    rows.push({
      month,
      payment,
      principal: principalPart,
      interest,
      overpayment,
      totalPaid: totalPaidThisMonth,
      balanceAfter: balance
    });

    if (loan.type === 'annuity' && balance.greaterThan(0)) {
      const remainingMonths = loan.months - month;
      if (remainingMonths > 0) {
        currentAnnuityPayment = calculateAnnuityPayment(balance, monthlyRate, remainingMonths);
      }
    } else if (loan.type === 'decreasing' && balance.greaterThan(0)) {
      const remainingMonths = loan.months - month;
      if (remainingMonths > 0) {
        currentCapitalPortion = balance.dividedBy(remainingMonths);
      }
    }

    if (balance.lessThanOrEqualTo(0.01)) break;
  }

  return {
    rows,
    summary: {
      totalMonths: month,
      totalPaid,
      totalInterest,
      totalOverpayments
    }
  };
}

function calculateBudgetAdjustedOverpayment(
  input: RateSimulationInput,
  newRate: number
): Decimal {
  if (!input.originalMonthlyPayment) {
    return input.monthlyOverpayment;
  }

  const baseBudget = input.originalMonthlyPayment.plus(input.monthlyOverpayment);
  
  const monthlyRateNew = new Decimal(newRate).dividedBy(100).dividedBy(12);
  const newPayment = input.loanType === 'annuity'
    ? calculateAnnuityPayment(input.principal, monthlyRateNew, input.months)
    : input.principal.dividedBy(input.months).plus(input.principal.times(monthlyRateNew));
  
  const adjustedOverpayment = baseBudget.minus(newPayment);
  return Decimal.max(new Decimal(0), adjustedOverpayment);
}

export function generateScheduleForRate(
  input: RateSimulationInput,
  newRate: number
): Schedule {
  const loan: Loan = {
    principal: input.principal,
    annualRate: new Decimal(newRate).dividedBy(100),
    months: input.months,
    type: input.loanType
  };

  const adjustedMonthlyOverpayment = calculateBudgetAdjustedOverpayment(input, newRate);

  const overpayments: Overpayments = {
    monthly: adjustedMonthlyOverpayment,
    yearly: input.yearlyOverpayment,
    yearlyMonth: input.yearlyMonth,
    annualRaisePercent: input.annualRaisePercent
  };

  if (input.strategy === 'reduce-plus') {
    const noOverpayments: Overpayments = { monthly: new Decimal(0), yearly: new Decimal(0), yearlyMonth: 12 };
    const scheduleNone = generateAmortizationSchedule(loan, noOverpayments, 'none');
    return calculateBudgetReinvestSchedule(loan, overpayments, scheduleNone, input);
  }
  
  const strategyMap: Record<SimulationStrategy, Strategy> = {
    'none': 'none',
    'reduce': 'reduce-payment',
    'shorten': 'shorten-term',
    'reduce-plus': 'reduce-payment'
  };
  
  return generateAmortizationSchedule(loan, overpayments, strategyMap[input.strategy]);
}

function calculateBudgetReinvestSchedule(
  loan: Loan,
  overpayments: Overpayments,
  _scheduleWithoutOverpayment: Schedule,
  input: RateSimulationInput
): Schedule {
  const rows: import('./types').ScheduleRow[] = [];
  const monthlyRate = loan.annualRate.dividedBy(12);
  
  let balance = loan.principal;
  let currentAnnuityPayment = loan.type === 'annuity'
    ? calculateAnnuityPayment(loan.principal, monthlyRate, loan.months)
    : new Decimal(0);
  
  const originalCapitalPortion = loan.principal.dividedBy(loan.months);
  let currentCapitalPortion = originalCapitalPortion;

  let totalInterest = new Decimal(0);
  let totalOverpayments = new Decimal(0);
  let totalPaid = new Decimal(0);
  let month = 0;

  const annualRaise = input.annualRaisePercent || 0;
  let currentBudget = input.originalMonthlyPayment
    ? input.originalMonthlyPayment.plus(input.monthlyOverpayment)
    : overpayments.monthly.plus(currentAnnuityPayment);
  
  const hasFixedBudget = !!input.originalMonthlyPayment;

  while (balance.greaterThan(0.01) && month < loan.months * 2) {
    month++;
    
    if (month > 1 && month % 12 === 1 && annualRaise > 0) {
      currentBudget = currentBudget.times(1 + annualRaise / 100);
    }
    
    const interest = balance.times(monthlyRate);
    totalInterest = totalInterest.plus(interest);

    let payment: Decimal;
    let principalPart: Decimal;

    if (loan.type === 'annuity') {
      payment = currentAnnuityPayment;
      principalPart = payment.minus(interest);
      
      if (principalPart.greaterThan(balance)) {
        principalPart = balance;
        payment = principalPart.plus(interest);
      }
    } else {
      principalPart = currentCapitalPortion;
      
      if (principalPart.greaterThan(balance)) {
        principalPart = balance;
      }
      
      payment = principalPart.plus(interest);
    }

    balance = balance.minus(principalPart);

    let overpayment = Decimal.max(new Decimal(0), currentBudget.minus(payment));
    
    if (month % 12 === overpayments.yearlyMonth % 12 || 
        (overpayments.yearlyMonth === 12 && month % 12 === 0)) {
      overpayment = overpayment.plus(overpayments.yearly);
    }

    if (overpayment.greaterThan(balance)) {
      overpayment = balance;
    }

    balance = balance.minus(overpayment);
    totalOverpayments = totalOverpayments.plus(overpayment);

    const totalPaidThisMonth = payment.plus(overpayment);
    totalPaid = totalPaid.plus(totalPaidThisMonth);

    rows.push({
      month,
      payment,
      principal: principalPart,
      interest,
      overpayment,
      totalPaid: totalPaidThisMonth,
      balanceAfter: balance
    });

    if (!hasFixedBudget && loan.type === 'annuity' && balance.greaterThan(0)) {
      const remainingMonths = loan.months - month;
      if (remainingMonths > 0) {
        currentAnnuityPayment = calculateAnnuityPayment(balance, monthlyRate, remainingMonths);
      }
    } else if (!hasFixedBudget && loan.type === 'decreasing' && balance.greaterThan(0)) {
      const remainingMonths = loan.months - month;
      if (remainingMonths > 0) {
        currentCapitalPortion = balance.dividedBy(remainingMonths);
      }
    }

    if (balance.lessThanOrEqualTo(0.01)) break;
  }

  return {
    rows,
    summary: {
      totalMonths: month,
      totalPaid,
      totalInterest,
      totalOverpayments
    }
  };
}

export function simulateRateChange(
  input: RateSimulationInput,
  rateChange: number
): RateComparisonResult {
  const newRate = Math.max(0.1, input.currentRate + rateChange);
  
  const originalSchedule = generateScheduleForRate(input, input.currentRate);
  const newSchedule = generateScheduleForRate(input, newRate);
  
  return {
    originalResult: {
      schedule: originalSchedule,
      totalInterest: originalSchedule.summary.totalInterest,
      totalMonths: originalSchedule.summary.totalMonths
    },
    newResult: {
      schedule: newSchedule,
      totalInterest: newSchedule.summary.totalInterest,
      totalMonths: newSchedule.summary.totalMonths
    },
    interestDifference: originalSchedule.summary.totalInterest.minus(newSchedule.summary.totalInterest),
    monthsDifference: originalSchedule.summary.totalMonths - newSchedule.summary.totalMonths
  };
}

export function pray(input: RateSimulationInput, level: 1 | 2 | 3): RateComparisonResult {
  return simulateRateChange(input, -level);
}

export function sin(input: RateSimulationInput, level: 1 | 2 | 3): RateComparisonResult {
  return simulateRateChange(input, level);
}

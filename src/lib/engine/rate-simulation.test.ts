import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import {
  generateScheduleForRate,
  simulateRateChange,
  pray,
  sin,
  type RateSimulationInput
} from './rate-simulation';
import { generateAmortizationSchedule } from './mortgage';
import type { Loan, Overpayments } from './types';

function createInput(overrides: Partial<RateSimulationInput> = {}): RateSimulationInput {
  return {
    principal: new Decimal(800000),
    currentRate: 6.5,
    months: 300,
    loanType: 'annuity',
    monthlyOverpayment: new Decimal(2000),
    yearlyOverpayment: new Decimal(0),
    yearlyMonth: 12,
    strategy: 'shorten',
    ...overrides
  };
}

describe('generateScheduleForRate - exact values for 800k at 6.5%', () => {
  describe('strategy: none', () => {
    it('returns 300 months without overpayments', () => {
      const input = createInput({ 
        strategy: 'none',
        monthlyOverpayment: new Decimal(0)
      });
      const schedule = generateScheduleForRate(input, 6.5);
      expect(schedule.summary.totalMonths).toBe(300);
    });

    it('returns ~820k total interest', () => {
      const input = createInput({ 
        strategy: 'none',
        monthlyOverpayment: new Decimal(0)
      });
      const schedule = generateScheduleForRate(input, 6.5);
      const interest = schedule.summary.totalInterest.toNumber();
      expect(interest).toBeGreaterThan(815000);
      expect(interest).toBeLessThan(825000);
    });
  });

  describe('strategy: shorten', () => {
    it('returns 164 months with 2000 PLN overpayment', () => {
      const input = createInput({ strategy: 'shorten' });
      const schedule = generateScheduleForRate(input, 6.5);
      expect(schedule.summary.totalMonths).toBe(164);
    });

    it('returns ~407k total interest', () => {
      const input = createInput({ strategy: 'shorten' });
      const schedule = generateScheduleForRate(input, 6.5);
      const interest = schedule.summary.totalInterest.toNumber();
      expect(interest).toBeGreaterThan(400000);
      expect(interest).toBeLessThan(415000);
    });
  });

  describe('strategy: reduce', () => {
    it('returns 255 months with 2000 PLN overpayment', () => {
      const input = createInput({ strategy: 'reduce' });
      const schedule = generateScheduleForRate(input, 6.5);
      expect(schedule.summary.totalMonths).toBe(255);
    });

    it('returns ~539k total interest', () => {
      const input = createInput({ strategy: 'reduce' });
      const schedule = generateScheduleForRate(input, 6.5);
      const interest = schedule.summary.totalInterest.toNumber();
      expect(interest).toBeGreaterThan(530000);
      expect(interest).toBeLessThan(545000);
    });
  });

  describe('strategy: reduce-plus', () => {
    it('returns similar months to shorten (within 5)', () => {
      const inputPlus = createInput({ strategy: 'reduce-plus' });
      const inputShorten = createInput({ strategy: 'shorten' });
      
      const schedulePlus = generateScheduleForRate(inputPlus, 6.5);
      const scheduleShorten = generateScheduleForRate(inputShorten, 6.5);
      
      const diff = Math.abs(schedulePlus.summary.totalMonths - scheduleShorten.summary.totalMonths);
      expect(diff).toBeLessThanOrEqual(5);
    });

    it('returns less interest than reduce strategy', () => {
      const inputPlus = createInput({ strategy: 'reduce-plus' });
      const inputReduce = createInput({ strategy: 'reduce' });
      
      const schedulePlus = generateScheduleForRate(inputPlus, 6.5);
      const scheduleReduce = generateScheduleForRate(inputReduce, 6.5);
      
      expect(schedulePlus.summary.totalInterest.toNumber())
        .toBeLessThan(scheduleReduce.summary.totalInterest.toNumber());
    });
  });
});

describe('pray - rate decrease simulation', () => {
  describe('shorten strategy', () => {
    const input = createInput({ strategy: 'shorten' });

    it('level 1 (6.5% -> 5.5%): saves ~64k interest', () => {
      const result = pray(input, 1);
      const savings = result.interestDifference.toNumber();
      expect(savings).toBeGreaterThan(60000);
      expect(savings).toBeLessThan(70000);
    });

    it('level 2 (6.5% -> 4.5%): saves ~120k interest', () => {
      const result = pray(input, 2);
      const savings = result.interestDifference.toNumber();
      expect(savings).toBeGreaterThan(115000);
      expect(savings).toBeLessThan(130000);
    });

    it('level 3 (6.5% -> 3.5%): saves ~192k interest', () => {
      const result = pray(input, 3);
      const savings = result.interestDifference.toNumber();
      expect(savings).toBeGreaterThan(185000);
      expect(savings).toBeLessThan(200000);
    });

    it('level 1: new schedule has 166 months', () => {
      const result = pray(input, 1);
      expect(result.newResult.totalMonths).toBe(166);
    });

    it('level 2: new schedule has 168 months', () => {
      const result = pray(input, 2);
      expect(result.newResult.totalMonths).toBe(168);
    });

    it('level 3: new schedule has 169 months', () => {
      const result = pray(input, 3);
      expect(result.newResult.totalMonths).toBe(169);
    });
  });

  describe('reduce strategy', () => {
    const input = createInput({ strategy: 'reduce' });

    it('level 1 (6.5% -> 5.5%): saves ~90k interest', () => {
      const result = pray(input, 1);
      const savings = result.interestDifference.toNumber();
      expect(savings).toBeGreaterThan(80000);
      expect(savings).toBeLessThan(100000);
    });
  });

  describe('none strategy', () => {
    const input = createInput({ 
      strategy: 'none',
      monthlyOverpayment: new Decimal(0)
    });

    it('level 1 (6.5% -> 5.5%): saves ~140k interest', () => {
      const result = pray(input, 1);
      const savings = result.interestDifference.toNumber();
      expect(savings).toBeGreaterThan(130000);
      expect(savings).toBeLessThan(150000);
    });

    it('months stay at 300 for both rates', () => {
      const result = pray(input, 1);
      expect(result.originalResult.totalMonths).toBe(300);
      expect(result.newResult.totalMonths).toBe(300);
    });
  });
});

describe('sin - rate increase simulation', () => {
  describe('shorten strategy', () => {
    const input = createInput({ strategy: 'shorten' });

    it('level 1 (6.5% -> 7.5%): costs extra ~63k', () => {
      const result = sin(input, 1);
      const extraCost = result.interestDifference.abs().toNumber();
      expect(extraCost).toBeGreaterThan(58000);
      expect(extraCost).toBeLessThan(68000);
    });

    it('level 2 (6.5% -> 8.5%): costs extra ~120k', () => {
      const result = sin(input, 2);
      const extraCost = result.interestDifference.abs().toNumber();
      expect(extraCost).toBeGreaterThan(115000);
      expect(extraCost).toBeLessThan(130000);
    });

    it('level 3 (6.5% -> 9.5%): costs extra ~183k', () => {
      const result = sin(input, 3);
      const extraCost = result.interestDifference.abs().toNumber();
      expect(extraCost).toBeGreaterThan(175000);
      expect(extraCost).toBeLessThan(190000);
    });

    it('interestDifference is negative (extra cost)', () => {
      const result = sin(input, 1);
      expect(result.interestDifference.toNumber()).toBeLessThan(0);
    });

    it('level 1: new schedule has 161 months', () => {
      const result = sin(input, 1);
      expect(result.newResult.totalMonths).toBe(161);
    });
  });
});

describe('consistency with main mortgage engine', () => {
  it('none strategy matches generateAmortizationSchedule none', () => {
    const input = createInput({
      strategy: 'none',
      monthlyOverpayment: new Decimal(0)
    });
    
    const loan: Loan = {
      principal: input.principal,
      annualRate: new Decimal(input.currentRate).dividedBy(100),
      months: input.months,
      type: input.loanType
    };
    const overpayments: Overpayments = {
      monthly: new Decimal(0),
      yearly: new Decimal(0),
      yearlyMonth: 12
    };
    
    const fromSimulation = generateScheduleForRate(input, input.currentRate);
    const fromEngine = generateAmortizationSchedule(loan, overpayments, 'none');
    
    expect(fromSimulation.summary.totalMonths).toBe(fromEngine.summary.totalMonths);
    expect(fromSimulation.summary.totalInterest.toFixed(2))
      .toBe(fromEngine.summary.totalInterest.toFixed(2));
  });

  it('shorten strategy matches generateAmortizationSchedule shorten-term', () => {
    const input = createInput({ strategy: 'shorten' });
    
    const loan: Loan = {
      principal: input.principal,
      annualRate: new Decimal(input.currentRate).dividedBy(100),
      months: input.months,
      type: input.loanType
    };
    const overpayments: Overpayments = {
      monthly: input.monthlyOverpayment,
      yearly: input.yearlyOverpayment,
      yearlyMonth: input.yearlyMonth
    };
    
    const fromSimulation = generateScheduleForRate(input, input.currentRate);
    const fromEngine = generateAmortizationSchedule(loan, overpayments, 'shorten-term');
    
    expect(fromSimulation.summary.totalMonths).toBe(fromEngine.summary.totalMonths);
    expect(fromSimulation.summary.totalInterest.toFixed(2))
      .toBe(fromEngine.summary.totalInterest.toFixed(2));
  });

  it('reduce strategy matches generateAmortizationSchedule reduce-payment', () => {
    const input = createInput({ strategy: 'reduce' });
    
    const loan: Loan = {
      principal: input.principal,
      annualRate: new Decimal(input.currentRate).dividedBy(100),
      months: input.months,
      type: input.loanType
    };
    const overpayments: Overpayments = {
      monthly: input.monthlyOverpayment,
      yearly: input.yearlyOverpayment,
      yearlyMonth: input.yearlyMonth
    };
    
    const fromSimulation = generateScheduleForRate(input, input.currentRate);
    const fromEngine = generateAmortizationSchedule(loan, overpayments, 'reduce-payment');
    
    expect(fromSimulation.summary.totalMonths).toBe(fromEngine.summary.totalMonths);
    expect(fromSimulation.summary.totalInterest.toFixed(2))
      .toBe(fromEngine.summary.totalInterest.toFixed(2));
  });
});

describe('edge cases', () => {
  it('rate cannot go below 0.1%', () => {
    const input = createInput({ currentRate: 1 });
    const result = pray(input, 3);
    expect(result.newResult.schedule.rows.length).toBeGreaterThan(0);
  });

  it('works with decreasing loan type', () => {
    const input = createInput({ loanType: 'decreasing' });
    const schedule = generateScheduleForRate(input, 6.5);
    expect(schedule.summary.totalMonths).toBeGreaterThan(0);
    expect(schedule.summary.totalMonths).toBeLessThan(200);
  });

  it('works with yearly overpayment', () => {
    const input = createInput({ 
      monthlyOverpayment: new Decimal(1000),
      yearlyOverpayment: new Decimal(12000)
    });
    const schedule = generateScheduleForRate(input, 6.5);
    expect(schedule.summary.totalMonths).toBeLessThan(200);
  });
});

describe('fixed budget logic - prayer section', () => {
  it('when rate drops, overpayment increases to maintain budget', () => {
    const originalPayment = new Decimal(5396);
    const input = createInput({
      strategy: 'shorten',
      monthlyOverpayment: new Decimal(2000),
      originalMonthlyPayment: originalPayment
    });
    
    const scheduleAtOriginalRate = generateScheduleForRate(input, 6.5);
    const scheduleAtLowerRate = generateScheduleForRate(input, 3.5);
    
    const firstRowOriginal = scheduleAtOriginalRate.rows[0];
    const firstRowLower = scheduleAtLowerRate.rows[0];
    
    expect(firstRowLower.overpayment.toNumber()).toBeGreaterThan(
      firstRowOriginal.overpayment.toNumber()
    );
    
    const totalOriginal = firstRowOriginal.payment.plus(firstRowOriginal.overpayment);
    const totalLower = firstRowLower.payment.plus(firstRowLower.overpayment);
    expect(totalOriginal.toFixed(0)).toBe(totalLower.toFixed(0));
  });

  it('when rate rises, overpayment decreases but total budget stays same', () => {
    const originalPayment = new Decimal(5396);
    const input = createInput({
      strategy: 'shorten',
      monthlyOverpayment: new Decimal(2000),
      originalMonthlyPayment: originalPayment
    });
    
    const scheduleAtOriginalRate = generateScheduleForRate(input, 6.5);
    const scheduleAtHigherRate = generateScheduleForRate(input, 9.5);
    
    const firstRowOriginal = scheduleAtOriginalRate.rows[0];
    const firstRowHigher = scheduleAtHigherRate.rows[0];
    
    expect(firstRowHigher.overpayment.toNumber()).toBeLessThan(
      firstRowOriginal.overpayment.toNumber()
    );
    
    const totalOriginal = firstRowOriginal.payment.plus(firstRowOriginal.overpayment);
    const totalHigher = firstRowHigher.payment.plus(firstRowHigher.overpayment);
    expect(totalOriginal.toFixed(0)).toBe(totalHigher.toFixed(0));
  });

  it('with fixed budget, lower rate results in fewer months (more overpayment)', () => {
    const originalPayment = new Decimal(5396);
    const input = createInput({
      strategy: 'shorten',
      monthlyOverpayment: new Decimal(2000),
      originalMonthlyPayment: originalPayment
    });
    
    const scheduleAtOriginalRate = generateScheduleForRate(input, 6.5);
    const scheduleAtLowerRate = generateScheduleForRate(input, 3.5);
    
    expect(scheduleAtLowerRate.summary.totalMonths).toBeLessThan(
      scheduleAtOriginalRate.summary.totalMonths
    );
  });

  it('overpayment never goes below zero when rate rises a lot', () => {
    const originalPayment = new Decimal(5396);
    const input = createInput({
      strategy: 'shorten',
      monthlyOverpayment: new Decimal(500),
      originalMonthlyPayment: originalPayment
    });
    
    const scheduleAtVeryHighRate = generateScheduleForRate(input, 15);
    
    scheduleAtVeryHighRate.rows.forEach(row => {
      expect(row.overpayment.toNumber()).toBeGreaterThanOrEqual(0);
    });
  });

  it('annual raise increases budget each year', () => {
    const originalPayment = new Decimal(5396);
    const input = createInput({
      strategy: 'shorten',
      monthlyOverpayment: new Decimal(2000),
      originalMonthlyPayment: originalPayment,
      annualRaisePercent: 5
    });
    
    const scheduleWithRaise = generateScheduleForRate(input, 6.5);
    
    const inputWithoutRaise = createInput({
      strategy: 'shorten',
      monthlyOverpayment: new Decimal(2000),
      originalMonthlyPayment: originalPayment,
      annualRaisePercent: 0
    });
    const scheduleWithoutRaise = generateScheduleForRate(inputWithoutRaise, 6.5);
    
    expect(scheduleWithRaise.summary.totalMonths).toBeLessThan(
      scheduleWithoutRaise.summary.totalMonths
    );
    expect(scheduleWithRaise.summary.totalInterest.toNumber()).toBeLessThan(
      scheduleWithoutRaise.summary.totalInterest.toNumber()
    );
  });

  it('without originalMonthlyPayment, behaves like before (backward compatible)', () => {
    const inputWithout = createInput({ strategy: 'shorten' });
    const inputWith = createInput({
      strategy: 'shorten',
      originalMonthlyPayment: undefined
    });
    
    const schedule1 = generateScheduleForRate(inputWithout, 6.5);
    const schedule2 = generateScheduleForRate(inputWith, 6.5);
    
    expect(schedule1.summary.totalMonths).toBe(schedule2.summary.totalMonths);
    expect(schedule1.summary.totalInterest.toFixed(2))
      .toBe(schedule2.summary.totalInterest.toFixed(2));
  });

  it('reduce-plus with fixed budget: lower rate = even more savings', () => {
    const originalPayment = new Decimal(5396);
    const input = createInput({
      strategy: 'reduce-plus',
      monthlyOverpayment: new Decimal(2000),
      originalMonthlyPayment: originalPayment
    });
    
    const result = pray(input, 3);
    
    expect(result.interestDifference.toNumber()).toBeGreaterThan(200000);
    expect(result.newResult.totalMonths).toBeLessThan(result.originalResult.totalMonths);
  });
});

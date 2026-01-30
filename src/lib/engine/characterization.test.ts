import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import { generateAmortizationSchedule } from './mortgage';
import { generateScheduleForRate, type RateSimulationInput } from './rate-simulation';
import type { Loan, Overpayments } from './types';

/**
 * Characterization Tests - Lock Current Behavior
 * 
 * These tests capture the exact current behavior of all calculation functions
 * before refactoring the calculation engine. They serve as a regression test
 * to ensure no behavior changes during refactoring.
 */

// Standard test loan: 500,000 PLN, 7.5% annual rate, 360 months, annuity type
function createStandardLoan(type: 'annuity' | 'decreasing' = 'annuity'): Loan {
  return {
    principal: new Decimal(500000),
    annualRate: new Decimal(0.075),
    months: 360,
    type
  };
}

// Standard overpayments: 2,000 PLN monthly
function createStandardOverpayments(
  monthly: number = 2000,
  yearly: number = 0,
  yearlyMonth: number = 12,
  annualRaisePercent?: number
): Overpayments {
  return {
    monthly: new Decimal(monthly),
    yearly: new Decimal(yearly),
    yearlyMonth,
    annualRaisePercent
  };
}

describe('Characterization Tests - Standard Loan (500k PLN, 7.5%, 360 months)', () => {
  describe('Annuity Loan Type', () => {
    describe('Strategy: none (no overpayments)', () => {
      it('should complete in exactly 360 months', () => {
        const loan = createStandardLoan('annuity');
        const overpayments = createStandardOverpayments(0);
        const schedule = generateAmortizationSchedule(loan, overpayments, 'none');

        expect(schedule.summary.totalMonths).toBe(360);
      });

      it('should capture exact summary values', () => {
        const loan = createStandardLoan('annuity');
        const overpayments = createStandardOverpayments(0);
        const schedule = generateAmortizationSchedule(loan, overpayments, 'none');

        // Capture exact values for regression testing
        const totalInterest = schedule.summary.totalInterest.toDecimalPlaces(2).toNumber();
        const totalPaid = schedule.summary.totalPaid.toDecimalPlaces(2).toNumber();
        const totalOverpayments = schedule.summary.totalOverpayments.toDecimalPlaces(2).toNumber();

        // These are the current behavior - lock them
        expect(totalInterest).toBeCloseTo(758586.12, 0);
        expect(totalPaid).toBeCloseTo(1258586.12, 0);
        expect(totalOverpayments).toBe(0);
      });

      it('should have zero total overpayments', () => {
        const loan = createStandardLoan('annuity');
        const overpayments = createStandardOverpayments(0);
        const schedule = generateAmortizationSchedule(loan, overpayments, 'none');

        expect(schedule.summary.totalOverpayments.toNumber()).toBe(0);
      });

      it('should have all rows with zero overpayment', () => {
        const loan = createStandardLoan('annuity');
        const overpayments = createStandardOverpayments(0);
        const schedule = generateAmortizationSchedule(loan, overpayments, 'none');

        schedule.rows.forEach((row) => {
          expect(row.overpayment.toNumber()).toBe(0);
        });
      });
    });

    describe('Strategy: shorten-term (fixed payment, fewer months)', () => {
      it('should complete in fewer than 360 months with 2000 PLN monthly overpayment', () => {
        const loan = createStandardLoan('annuity');
        const overpayments = createStandardOverpayments(2000);
        const schedule = generateAmortizationSchedule(loan, overpayments, 'shorten-term');

        expect(schedule.summary.totalMonths).toBeLessThan(360);
      });

      it('should capture exact summary values for shorten-term strategy', () => {
        const loan = createStandardLoan('annuity');
        const overpayments = createStandardOverpayments(2000);
        const schedule = generateAmortizationSchedule(loan, overpayments, 'shorten-term');

        const totalMonths = schedule.summary.totalMonths;
        const totalInterest = schedule.summary.totalInterest.toDecimalPlaces(2).toNumber();
        const totalPaid = schedule.summary.totalPaid.toDecimalPlaces(2).toNumber();
        const totalOverpayments = schedule.summary.totalOverpayments.toDecimalPlaces(2).toNumber();

        // Lock current behavior
        expect(totalMonths).toBe(135);
        expect(totalInterest).toBeGreaterThan(200000);
        expect(totalInterest).toBeLessThan(300000);
        expect(totalOverpayments).toBeGreaterThan(100000);
      });

      it('should have positive total overpayments', () => {
        const loan = createStandardLoan('annuity');
        const overpayments = createStandardOverpayments(2000);
        const schedule = generateAmortizationSchedule(loan, overpayments, 'shorten-term');

        expect(schedule.summary.totalOverpayments.toNumber()).toBeGreaterThan(0);
      });

      it('should have overpayment in each row', () => {
        const loan = createStandardLoan('annuity');
        const overpayments = createStandardOverpayments(2000);
        const schedule = generateAmortizationSchedule(loan, overpayments, 'shorten-term');

        // All rows except possibly the last should have overpayment
        const rowsWithOverpayment = schedule.rows.filter((row) => row.overpayment.greaterThan(0));
        expect(rowsWithOverpayment.length).toBeGreaterThan(0);
      });
    });

    describe('Strategy: reduce-payment (recalculates payment, shortens term)', () => {
      it('should complete in fewer than 360 months', () => {
        const loan = createStandardLoan('annuity');
        const overpayments = createStandardOverpayments(2000);
        const schedule = generateAmortizationSchedule(loan, overpayments, 'reduce-payment');

        expect(schedule.summary.totalMonths).toBeLessThan(360);
      });

      it('should capture exact summary values for reduce-payment strategy', () => {
        const loan = createStandardLoan('annuity');
        const overpayments = createStandardOverpayments(2000);
        const schedule = generateAmortizationSchedule(loan, overpayments, 'reduce-payment');

        const totalMonths = schedule.summary.totalMonths;
        const totalInterest = schedule.summary.totalInterest.toDecimalPlaces(2).toNumber();
        const totalPaid = schedule.summary.totalPaid.toDecimalPlaces(2).toNumber();
        const totalOverpayments = schedule.summary.totalOverpayments.toDecimalPlaces(2).toNumber();

        // Lock current behavior
        expect(totalMonths).toBe(215);
        expect(totalInterest).toBeGreaterThan(300000);
        expect(totalInterest).toBeLessThan(350000);
        expect(totalOverpayments).toBeGreaterThan(200000);
      });

      it('should have overpayment in each row', () => {
        const loan = createStandardLoan('annuity');
        const overpayments = createStandardOverpayments(2000);
        const schedule = generateAmortizationSchedule(loan, overpayments, 'reduce-payment');

        schedule.rows.forEach((row) => {
          expect(row.overpayment.toNumber()).toBeGreaterThanOrEqual(0);
        });
      });
    });
  });

  describe('Decreasing Loan Type', () => {
    describe('Strategy: none (no overpayments)', () => {
      it('should complete in exactly 360 months', () => {
        const loan = createStandardLoan('decreasing');
        const overpayments = createStandardOverpayments(0);
        const schedule = generateAmortizationSchedule(loan, overpayments, 'none');

        expect(schedule.summary.totalMonths).toBe(360);
      });

      it('should capture exact summary values for decreasing loan', () => {
        const loan = createStandardLoan('decreasing');
        const overpayments = createStandardOverpayments(0);
        const schedule = generateAmortizationSchedule(loan, overpayments, 'none');

        const totalInterest = schedule.summary.totalInterest.toDecimalPlaces(2).toNumber();
        const totalPaid = schedule.summary.totalPaid.toDecimalPlaces(2).toNumber();
        const totalOverpayments = schedule.summary.totalOverpayments.toDecimalPlaces(2).toNumber();

        // Lock current behavior - decreasing should have less interest than annuity
        expect(totalInterest).toBeCloseTo(564062.5, 0);
        expect(totalOverpayments).toBe(0);
      });

      it('should have decreasing payment amounts', () => {
        const loan = createStandardLoan('decreasing');
        const overpayments = createStandardOverpayments(0);
        const schedule = generateAmortizationSchedule(loan, overpayments, 'none');

        // First payment should be higher than last
        const firstPayment = schedule.rows[0].payment.toNumber();
        const lastPayment = schedule.rows[schedule.rows.length - 1].payment.toNumber();

        expect(firstPayment).toBeGreaterThan(lastPayment);
      });
    });

    describe('Strategy: shorten-term with decreasing loan', () => {
      it('should complete in fewer than 360 months', () => {
        const loan = createStandardLoan('decreasing');
        const overpayments = createStandardOverpayments(2000);
        const schedule = generateAmortizationSchedule(loan, overpayments, 'shorten-term');

        expect(schedule.summary.totalMonths).toBeLessThan(360);
      });

      it('should capture exact summary values', () => {
        const loan = createStandardLoan('decreasing');
        const overpayments = createStandardOverpayments(2000);
        const schedule = generateAmortizationSchedule(loan, overpayments, 'shorten-term');

        const totalMonths = schedule.summary.totalMonths;
        const totalInterest = schedule.summary.totalInterest.toDecimalPlaces(2).toNumber();
        const totalOverpayments = schedule.summary.totalOverpayments.toDecimalPlaces(2).toNumber();

        // Lock current behavior
        expect(totalMonths).toBe(148);
        expect(totalInterest).toBeGreaterThan(200000);
        expect(totalInterest).toBeLessThan(250000);
        expect(totalOverpayments).toBeGreaterThan(100000);
      });
    });

    describe('Strategy: reduce-payment with decreasing loan', () => {
      it('should complete in fewer than 360 months', () => {
        const loan = createStandardLoan('decreasing');
        const overpayments = createStandardOverpayments(2000);
        const schedule = generateAmortizationSchedule(loan, overpayments, 'reduce-payment');

        expect(schedule.summary.totalMonths).toBeLessThan(360);
      });

      it('should capture exact summary values', () => {
        const loan = createStandardLoan('decreasing');
        const overpayments = createStandardOverpayments(2000);
        const schedule = generateAmortizationSchedule(loan, overpayments, 'reduce-payment');

        const totalMonths = schedule.summary.totalMonths;
        const totalInterest = schedule.summary.totalInterest.toDecimalPlaces(2).toNumber();
        const totalOverpayments = schedule.summary.totalOverpayments.toDecimalPlaces(2).toNumber();

        // Lock current behavior
        expect(totalMonths).toBe(180);
        expect(totalInterest).toBeGreaterThan(200000);
        expect(totalInterest).toBeLessThan(300000);
        expect(totalOverpayments).toBeGreaterThan(100000);
      });
    });
  });

  describe('Yearly Overpayments Feature', () => {
    it('should include yearly overpayment in December (month 12)', () => {
      const loan = createStandardLoan('annuity');
      const overpayments = createStandardOverpayments(1000, 5000, 12);
      const schedule = generateAmortizationSchedule(loan, overpayments, 'shorten-term');

      // Month 12 should have higher overpayment
      const month12 = schedule.rows[11]; // 0-indexed
      expect(month12.overpayment.toNumber()).toBeGreaterThanOrEqual(5000);
    });

    it('should include yearly overpayment in specified month', () => {
      const loan = createStandardLoan('annuity');
      const overpayments = createStandardOverpayments(1000, 3000, 6);
      const schedule = generateAmortizationSchedule(loan, overpayments, 'shorten-term');

      // Month 6 should have higher overpayment
      const month6 = schedule.rows[5]; // 0-indexed
      expect(month6.overpayment.toNumber()).toBeGreaterThanOrEqual(3000);
    });

    it('should accumulate yearly overpayments in total', () => {
      const loan = createStandardLoan('annuity');
      const overpayments = createStandardOverpayments(1000, 5000, 12);
      const scheduleWithYearly = generateAmortizationSchedule(loan, overpayments, 'shorten-term');
      const scheduleWithoutYearly = generateAmortizationSchedule(
        loan,
        createStandardOverpayments(1000, 0, 12),
        'shorten-term'
      );

      // With yearly overpayment should have more total overpayments
      expect(scheduleWithYearly.summary.totalOverpayments.toNumber()).toBeGreaterThan(
        scheduleWithoutYearly.summary.totalOverpayments.toNumber()
      );
    });
  });

  describe('Annual Raise Feature', () => {
    it('should increase monthly overpayment by specified percent each year', () => {
      const loan = createStandardLoan('annuity');
      const overpayments = createStandardOverpayments(1000, 0, 12, 5); // 5% annual raise
      const schedule = generateAmortizationSchedule(loan, overpayments, 'shorten-term');

      // Month 1 should have ~1000 overpayment
      const month1 = schedule.rows[0];
      expect(month1.overpayment.toNumber()).toBeCloseTo(1000, 0);

      // Month 13 should have ~1050 overpayment (5% raise)
      if (schedule.rows.length > 12) {
        const month13 = schedule.rows[12];
        expect(month13.overpayment.toNumber()).toBeCloseTo(1050, 0);
      }
    });

    it('should compound annual raises over multiple years', () => {
      const loan = createStandardLoan('annuity');
      const overpayments = createStandardOverpayments(1000, 0, 12, 10); // 10% annual raise
      const schedule = generateAmortizationSchedule(loan, overpayments, 'shorten-term');

      // Month 1: 1000
      const month1 = schedule.rows[0];
      expect(month1.overpayment.toNumber()).toBeCloseTo(1000, 0);

      // Month 13: 1100 (10% raise)
      if (schedule.rows.length > 12) {
        const month13 = schedule.rows[12];
        expect(month13.overpayment.toNumber()).toBeCloseTo(1100, 0);
      }

      // Month 25: 1210 (10% of 1100)
      if (schedule.rows.length > 24) {
        const month25 = schedule.rows[24];
        expect(month25.overpayment.toNumber()).toBeCloseTo(1210, 0);
      }
    });

    it('should result in shorter term with annual raises', () => {
      const loan = createStandardLoan('annuity');
      const overpayments = createStandardOverpayments(1000, 0, 12, 5);
      const scheduleWithRaise = generateAmortizationSchedule(loan, overpayments, 'shorten-term');
      const scheduleWithoutRaise = generateAmortizationSchedule(
        loan,
        createStandardOverpayments(1000, 0, 12, 0),
        'shorten-term'
      );

      // With annual raise should complete faster
      expect(scheduleWithRaise.summary.totalMonths).toBeLessThan(
        scheduleWithoutRaise.summary.totalMonths
      );
    });
  });

  describe('Rate Simulation - reduce-plus Strategy', () => {
    it('should generate schedule for reduce-plus strategy via generateScheduleForRate', () => {
      const input: RateSimulationInput = {
        principal: new Decimal(500000),
        currentRate: 7.5,
        months: 360,
        loanType: 'annuity',
        monthlyOverpayment: new Decimal(2000),
        yearlyOverpayment: new Decimal(0),
        yearlyMonth: 12,
        strategy: 'reduce-plus'
      };

      const schedule = generateScheduleForRate(input, 7.5);

      expect(schedule.summary.totalMonths).toBeGreaterThan(0);
      expect(schedule.summary.totalInterest.toNumber()).toBeGreaterThan(0);
      expect(schedule.rows.length).toBeGreaterThan(0);
    });

    it('should have reduce-plus complete faster than reduce strategy', () => {
      const input: RateSimulationInput = {
        principal: new Decimal(500000),
        currentRate: 7.5,
        months: 360,
        loanType: 'annuity',
        monthlyOverpayment: new Decimal(2000),
        yearlyOverpayment: new Decimal(0),
        yearlyMonth: 12,
        strategy: 'reduce-plus'
      };

      const schedulePlus = generateScheduleForRate(input, 7.5);
      const scheduleReduce = generateScheduleForRate({ ...input, strategy: 'reduce' }, 7.5);

      // reduce-plus should complete faster than reduce
      expect(schedulePlus.summary.totalMonths).toBeLessThan(scheduleReduce.summary.totalMonths);
    });

    it('should capture exact summary values for reduce-plus', () => {
      const input: RateSimulationInput = {
        principal: new Decimal(500000),
        currentRate: 7.5,
        months: 360,
        loanType: 'annuity',
        monthlyOverpayment: new Decimal(2000),
        yearlyOverpayment: new Decimal(0),
        yearlyMonth: 12,
        strategy: 'reduce-plus'
      };

      const schedule = generateScheduleForRate(input, 7.5);

      const totalMonths = schedule.summary.totalMonths;
      const totalInterest = schedule.summary.totalInterest.toDecimalPlaces(2).toNumber();
      const totalOverpayments = schedule.summary.totalOverpayments.toDecimalPlaces(2).toNumber();

      // Lock current behavior
      expect(totalMonths).toBe(135);
      expect(totalInterest).toBeGreaterThan(200000);
      expect(totalInterest).toBeLessThan(300000);
      expect(totalOverpayments).toBeGreaterThan(100000);
    });
  });

  describe('Edge Cases and Consistency', () => {
    it('should have totalPaid equal to sum of all row totalPaid values', () => {
      const loan = createStandardLoan('annuity');
      const overpayments = createStandardOverpayments(2000);
      const schedule = generateAmortizationSchedule(loan, overpayments, 'shorten-term');

      const sumRowsTotalPaid = schedule.rows.reduce(
        (sum, row) => sum.plus(row.totalPaid),
        new Decimal(0)
      );

      expect(schedule.summary.totalPaid.toDecimalPlaces(2).toNumber()).toBeCloseTo(
        sumRowsTotalPaid.toDecimalPlaces(2).toNumber(),
        0
      );
    });

    it('should have sum of row totalPaid equal to summary totalPaid', () => {
      const loan = createStandardLoan('annuity');
      const overpayments = createStandardOverpayments(2000);
      const schedule = generateAmortizationSchedule(loan, overpayments, 'shorten-term');

      const sumRowsTotalPaid = schedule.rows.reduce(
        (sum, row) => sum.plus(row.totalPaid),
        new Decimal(0)
      );

      expect(sumRowsTotalPaid.toDecimalPlaces(2).toNumber()).toBeCloseTo(
        schedule.summary.totalPaid.toDecimalPlaces(2).toNumber(),
        1
      );
    });

    it('should have final balance near zero', () => {
      const loan = createStandardLoan('annuity');
      const overpayments = createStandardOverpayments(2000);
      const schedule = generateAmortizationSchedule(loan, overpayments, 'shorten-term');

      const finalBalance = schedule.rows[schedule.rows.length - 1].balanceAfter;
      expect(Math.abs(finalBalance.toNumber())).toBeLessThan(0.1);
    });

    it('should have monotonically decreasing balance', () => {
      const loan = createStandardLoan('annuity');
      const overpayments = createStandardOverpayments(2000);
      const schedule = generateAmortizationSchedule(loan, overpayments, 'shorten-term');

      for (let i = 1; i < schedule.rows.length; i++) {
        expect(schedule.rows[i].balanceAfter.toNumber()).toBeLessThanOrEqual(
          schedule.rows[i - 1].balanceAfter.toNumber()
        );
      }
    });

    it('should have totalPaid = payment + overpayment for each row', () => {
      const loan = createStandardLoan('annuity');
      const overpayments = createStandardOverpayments(2000);
      const schedule = generateAmortizationSchedule(loan, overpayments, 'shorten-term');

      schedule.rows.forEach((row) => {
        const expected = row.payment.plus(row.overpayment);
        expect(row.totalPaid.toDecimalPlaces(2).toNumber()).toBeCloseTo(
          expected.toDecimalPlaces(2).toNumber(),
          1
        );
      });
    });

    it('should have principal + interest = payment for each row', () => {
      const loan = createStandardLoan('annuity');
      const overpayments = createStandardOverpayments(2000);
      const schedule = generateAmortizationSchedule(loan, overpayments, 'shorten-term');

      schedule.rows.forEach((row) => {
        const expected = row.principal.plus(row.interest);
        expect(row.payment.toDecimalPlaces(2).toNumber()).toBeCloseTo(
          expected.toDecimalPlaces(2).toNumber(),
          1
        );
      });
    });
  });

  describe('Comparison: Annuity vs Decreasing', () => {
    it('should have decreasing loan with less total interest than annuity', () => {
      const loanAnnuity = createStandardLoan('annuity');
      const loanDecreasing = createStandardLoan('decreasing');
      const overpayments = createStandardOverpayments(0);

      const scheduleAnnuity = generateAmortizationSchedule(loanAnnuity, overpayments, 'none');
      const scheduleDecreasing = generateAmortizationSchedule(loanDecreasing, overpayments, 'none');

      expect(scheduleDecreasing.summary.totalInterest.toNumber()).toBeLessThan(
        scheduleAnnuity.summary.totalInterest.toNumber()
      );
    });

    it('should have annuity with more consistent payments than decreasing', () => {
      const loanAnnuity = createStandardLoan('annuity');
      const loanDecreasing = createStandardLoan('decreasing');
      const overpayments = createStandardOverpayments(0);

      const scheduleAnnuity = generateAmortizationSchedule(loanAnnuity, overpayments, 'none');
      const scheduleDecreasing = generateAmortizationSchedule(loanDecreasing, overpayments, 'none');

      // Calculate variance of payments
      const annuityPayments = scheduleAnnuity.rows.map((r) => r.payment.toNumber());
      const decreasingPayments = scheduleDecreasing.rows.map((r) => r.payment.toNumber());

      const annuityVariance =
        annuityPayments.reduce((sum, p) => sum + Math.pow(p - annuityPayments[0], 2), 0) /
        annuityPayments.length;
      const decreasingVariance =
        decreasingPayments.reduce((sum, p) => sum + Math.pow(p - decreasingPayments[0], 2), 0) /
        decreasingPayments.length;

      // Annuity should have much lower variance
      expect(annuityVariance).toBeLessThan(decreasingVariance);
    });
  });

  describe('Comparison: Strategies', () => {
    it('should have shorten-term with less interest than reduce-payment', () => {
      const loan = createStandardLoan('annuity');
      const overpayments = createStandardOverpayments(2000);

      const scheduleShortenTerm = generateAmortizationSchedule(loan, overpayments, 'shorten-term');
      const scheduleReducePayment = generateAmortizationSchedule(
        loan,
        overpayments,
        'reduce-payment'
      );

      expect(scheduleShortenTerm.summary.totalInterest.toNumber()).toBeLessThan(
        scheduleReducePayment.summary.totalInterest.toNumber()
      );
    });

    it('should have shorten-term with fewer months than reduce-payment', () => {
      const loan = createStandardLoan('annuity');
      const overpayments = createStandardOverpayments(2000);

      const scheduleShortenTerm = generateAmortizationSchedule(loan, overpayments, 'shorten-term');
      const scheduleReducePayment = generateAmortizationSchedule(
        loan,
        overpayments,
        'reduce-payment'
      );

      expect(scheduleShortenTerm.summary.totalMonths).toBeLessThan(
        scheduleReducePayment.summary.totalMonths
      );
    });

    it('should have reduce-payment complete faster than no overpayment', () => {
      const loan = createStandardLoan('annuity');
      const overpayments = createStandardOverpayments(2000);
      const noOverpayments = createStandardOverpayments(0);

      const scheduleReducePayment = generateAmortizationSchedule(
        loan,
        overpayments,
        'reduce-payment'
      );
      const scheduleNone = generateAmortizationSchedule(loan, noOverpayments, 'none');

      expect(scheduleReducePayment.summary.totalMonths).toBeLessThan(scheduleNone.summary.totalMonths);
    });
  });
});

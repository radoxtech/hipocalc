import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import { generateAmortizationSchedule } from './mortgage';
import type { Loan, Overpayments } from './types';

describe('initialTotalPayment', () => {
  describe('strategy: none', () => {
    it('equals first row payment + overpayment (no overpayments)', () => {
      const loan: Loan = {
        principal: new Decimal(300000),
        annualRate: new Decimal(0.06),
        months: 360,
        type: 'annuity'
      };

      const overpayments: Overpayments = {
        monthly: new Decimal(0),
        yearly: new Decimal(0),
        yearlyMonth: 12
      };

      const schedule = generateAmortizationSchedule(loan, overpayments, 'none');
      const firstRow = schedule.rows[0];
      const expected = firstRow.payment.plus(firstRow.overpayment);

      expect(schedule.summary.initialTotalPayment).toBeDefined();
      expect(schedule.summary.initialTotalPayment.toNumber()).toBe(expected.toNumber());
    });

    it('equals first row payment when no overpayments', () => {
      const loan: Loan = {
        principal: new Decimal(300000),
        annualRate: new Decimal(0.06),
        months: 360,
        type: 'annuity'
      };

      const overpayments: Overpayments = {
        monthly: new Decimal(0),
        yearly: new Decimal(0),
        yearlyMonth: 12
      };

      const schedule = generateAmortizationSchedule(loan, overpayments, 'none');
      const firstRow = schedule.rows[0];

      expect(schedule.summary.initialTotalPayment.toNumber()).toBeCloseTo(
        firstRow.payment.toNumber(),
        2
      );
    });
  });

  describe('strategy: shorten-term', () => {
    it('equals first row payment + overpayment with monthly overpayments', () => {
      const loan: Loan = {
        principal: new Decimal(300000),
        annualRate: new Decimal(0.06),
        months: 360,
        type: 'annuity'
      };

      const overpayments: Overpayments = {
        monthly: new Decimal(500),
        yearly: new Decimal(0),
        yearlyMonth: 12
      };

      const schedule = generateAmortizationSchedule(loan, overpayments, 'shorten-term');
      const firstRow = schedule.rows[0];
      const expected = firstRow.payment.plus(firstRow.overpayment);

      expect(schedule.summary.initialTotalPayment).toBeDefined();
      expect(schedule.summary.initialTotalPayment.toNumber()).toBe(expected.toNumber());
    });

    it('includes both monthly and yearly overpayment in first month if yearlyMonth is 1', () => {
      const loan: Loan = {
        principal: new Decimal(300000),
        annualRate: new Decimal(0.06),
        months: 360,
        type: 'annuity'
      };

      const overpayments: Overpayments = {
        monthly: new Decimal(500),
        yearly: new Decimal(2000),
        yearlyMonth: 1
      };

      const schedule = generateAmortizationSchedule(loan, overpayments, 'shorten-term');
      const firstRow = schedule.rows[0];
      const expected = firstRow.payment.plus(firstRow.overpayment);

      expect(schedule.summary.initialTotalPayment.toNumber()).toBe(expected.toNumber());
      // First month should have both monthly (500) and yearly (2000) overpayment
      expect(firstRow.overpayment.toNumber()).toBe(2500);
    });

    it('only includes monthly overpayment if yearlyMonth is not 1', () => {
      const loan: Loan = {
        principal: new Decimal(300000),
        annualRate: new Decimal(0.06),
        months: 360,
        type: 'annuity'
      };

      const overpayments: Overpayments = {
        monthly: new Decimal(500),
        yearly: new Decimal(2000),
        yearlyMonth: 12
      };

      const schedule = generateAmortizationSchedule(loan, overpayments, 'shorten-term');
      const firstRow = schedule.rows[0];

      // First month should only have monthly overpayment (500)
      expect(firstRow.overpayment.toNumber()).toBe(500);
      expect(schedule.summary.initialTotalPayment.toNumber()).toBe(
        firstRow.payment.plus(500).toNumber()
      );
    });
  });

  describe('strategy: reduce-payment', () => {
    it('equals first row payment + overpayment with monthly overpayments', () => {
      const loan: Loan = {
        principal: new Decimal(300000),
        annualRate: new Decimal(0.06),
        months: 360,
        type: 'annuity'
      };

      const overpayments: Overpayments = {
        monthly: new Decimal(500),
        yearly: new Decimal(0),
        yearlyMonth: 12
      };

      const schedule = generateAmortizationSchedule(loan, overpayments, 'reduce-payment');
      const firstRow = schedule.rows[0];
      const expected = firstRow.payment.plus(firstRow.overpayment);

      expect(schedule.summary.initialTotalPayment).toBeDefined();
      expect(schedule.summary.initialTotalPayment.toNumber()).toBe(expected.toNumber());
    });

    it('includes yearly overpayment in first month if yearlyMonth is 1', () => {
      const loan: Loan = {
        principal: new Decimal(300000),
        annualRate: new Decimal(0.06),
        months: 360,
        type: 'annuity'
      };

      const overpayments: Overpayments = {
        monthly: new Decimal(300),
        yearly: new Decimal(1500),
        yearlyMonth: 1
      };

      const schedule = generateAmortizationSchedule(loan, overpayments, 'reduce-payment');
      const firstRow = schedule.rows[0];

      expect(schedule.summary.initialTotalPayment.toNumber()).toBe(
        firstRow.payment.plus(firstRow.overpayment).toNumber()
      );
      // First month should have both monthly (300) and yearly (1500)
      expect(firstRow.overpayment.toNumber()).toBe(1800);
    });
  });



  describe('edge cases', () => {
    it('handles very small loan that pays off in 1 month', () => {
      const loan: Loan = {
        principal: new Decimal(1000),
        annualRate: new Decimal(0.06),
        months: 12,
        type: 'annuity'
      };

      const overpayments: Overpayments = {
        monthly: new Decimal(100),
        yearly: new Decimal(0),
        yearlyMonth: 12
      };

      const schedule = generateAmortizationSchedule(loan, overpayments, 'shorten-term');

      expect(schedule.summary.initialTotalPayment).toBeDefined();
      expect(schedule.rows.length).toBeGreaterThan(0);

      const firstRow = schedule.rows[0];
      const expected = firstRow.payment.plus(firstRow.overpayment);
      expect(schedule.summary.initialTotalPayment.toNumber()).toBe(expected.toNumber());
    });

    it('handles decreasing payment type', () => {
      const loan: Loan = {
        principal: new Decimal(300000),
        annualRate: new Decimal(0.06),
        months: 360,
        type: 'decreasing'
      };

      const overpayments: Overpayments = {
        monthly: new Decimal(500),
        yearly: new Decimal(0),
        yearlyMonth: 12
      };

      const schedule = generateAmortizationSchedule(loan, overpayments, 'shorten-term');

      expect(schedule.summary.initialTotalPayment).toBeDefined();
      const firstRow = schedule.rows[0];
      const expected = firstRow.payment.plus(firstRow.overpayment);
      expect(schedule.summary.initialTotalPayment.toNumber()).toBe(expected.toNumber());
    });

    it('is a Decimal type', () => {
      const loan: Loan = {
        principal: new Decimal(300000),
        annualRate: new Decimal(0.06),
        months: 360,
        type: 'annuity'
      };

      const overpayments: Overpayments = {
        monthly: new Decimal(500),
        yearly: new Decimal(0),
        yearlyMonth: 12
      };

      const schedule = generateAmortizationSchedule(loan, overpayments, 'shorten-term');

      expect(schedule.summary.initialTotalPayment).toBeInstanceOf(Decimal);
    });

    it('is greater than zero for valid loans', () => {
      const loan: Loan = {
        principal: new Decimal(300000),
        annualRate: new Decimal(0.06),
        months: 360,
        type: 'annuity'
      };

      const overpayments: Overpayments = {
        monthly: new Decimal(500),
        yearly: new Decimal(0),
        yearlyMonth: 12
      };

      const schedule = generateAmortizationSchedule(loan, overpayments, 'shorten-term');

      expect(schedule.summary.initialTotalPayment.toNumber()).toBeGreaterThan(0);
    });
  });
});

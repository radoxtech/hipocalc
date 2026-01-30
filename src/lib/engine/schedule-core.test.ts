import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import {
  shouldApplyYearlyOverpayment,
  applyAnnualRaise,
  calculateMonthlyPayment,
  recalculatePaymentForReduceStrategy
} from './schedule-core';

describe('schedule-core', () => {
  describe('shouldApplyYearlyOverpayment', () => {
    it('returns true when month matches yearlyMonth exactly', () => {
      expect(shouldApplyYearlyOverpayment(6, 6)).toBe(true);
      expect(shouldApplyYearlyOverpayment(1, 1)).toBe(true);
      expect(shouldApplyYearlyOverpayment(11, 11)).toBe(true);
    });

    it('returns false when month does not match yearlyMonth', () => {
      expect(shouldApplyYearlyOverpayment(12, 6)).toBe(false);
      expect(shouldApplyYearlyOverpayment(5, 6)).toBe(false);
      expect(shouldApplyYearlyOverpayment(1, 12)).toBe(false);
    });

    it('returns true for month 12 when yearlyMonth is 12', () => {
      expect(shouldApplyYearlyOverpayment(12, 12)).toBe(true);
    });

    it('returns true for multiples of 12 when yearlyMonth is 12', () => {
      expect(shouldApplyYearlyOverpayment(24, 12)).toBe(true);
      expect(shouldApplyYearlyOverpayment(36, 12)).toBe(true);
      expect(shouldApplyYearlyOverpayment(48, 12)).toBe(true);
      expect(shouldApplyYearlyOverpayment(360, 12)).toBe(true);
    });

    it('returns true for yearly cycles of non-december months', () => {
      expect(shouldApplyYearlyOverpayment(18, 6)).toBe(true);
      expect(shouldApplyYearlyOverpayment(30, 6)).toBe(true);
      expect(shouldApplyYearlyOverpayment(13, 1)).toBe(true);
      expect(shouldApplyYearlyOverpayment(25, 1)).toBe(true);
    });

    it('returns false for months that do not match the cycle', () => {
      expect(shouldApplyYearlyOverpayment(13, 6)).toBe(false);
      expect(shouldApplyYearlyOverpayment(19, 6)).toBe(false);
      expect(shouldApplyYearlyOverpayment(14, 1)).toBe(false);
    });
  });

  describe('applyAnnualRaise', () => {
    it('returns unchanged amount for month 1', () => {
      const result = applyAnnualRaise(new Decimal(1000), 1, 3);
      expect(result.toNumber()).toBe(1000);
    });

    it('applies raise at month 13 (start of year 2)', () => {
      const result = applyAnnualRaise(new Decimal(1000), 13, 3);
      expect(result.toNumber()).toBe(1030);
    });

    it('applies raise at month 25 (start of year 3)', () => {
      const result = applyAnnualRaise(new Decimal(1000), 25, 3);
      expect(result.toNumber()).toBe(1030);
    });

    it('applies raise at month 37 (start of year 4)', () => {
      const result = applyAnnualRaise(new Decimal(1000), 37, 5);
      expect(result.toNumber()).toBe(1050);
    });

    it('returns unchanged amount when raise percent is 0', () => {
      const result = applyAnnualRaise(new Decimal(1000), 13, 0);
      expect(result.toNumber()).toBe(1000);
    });

    it('returns unchanged amount for months that are not start of year', () => {
      expect(applyAnnualRaise(new Decimal(1000), 2, 3).toNumber()).toBe(1000);
      expect(applyAnnualRaise(new Decimal(1000), 12, 3).toNumber()).toBe(1000);
      expect(applyAnnualRaise(new Decimal(1000), 14, 3).toNumber()).toBe(1000);
      expect(applyAnnualRaise(new Decimal(1000), 24, 3).toNumber()).toBe(1000);
      expect(applyAnnualRaise(new Decimal(1000), 26, 3).toNumber()).toBe(1000);
    });

    it('handles negative raise percent (rare but possible)', () => {
      const result = applyAnnualRaise(new Decimal(1000), 13, -5);
      expect(result.toNumber()).toBe(1000);
    });

    it('handles decimal amounts correctly', () => {
      const result = applyAnnualRaise(new Decimal('1234.56'), 13, 3);
      expect(result.toNumber()).toBeCloseTo(1271.5968, 2);
    });
  });

  describe('calculateMonthlyPayment', () => {
    describe('annuity loan', () => {
      it('calculates payment and splits principal vs interest correctly', () => {
        const balance = new Decimal(400000);
        const monthlyRate = new Decimal(0.005);
        const currentAnnuityPayment = new Decimal('2398.20');
        
        const result = calculateMonthlyPayment(
          balance,
          monthlyRate,
          360,
          'annuity',
          currentAnnuityPayment,
          new Decimal(0)
        );

        expect(result.payment.toNumber()).toBeCloseTo(2398.20, 2);
        expect(result.interest.toNumber()).toBe(2000);
        expect(result.principalPart.toNumber()).toBeCloseTo(398.20, 2);
      });

      it('handles last payment edge case where principal exceeds balance', () => {
        const balance = new Decimal(100);
        const monthlyRate = new Decimal(0.005);
        const currentAnnuityPayment = new Decimal(500);
        
        const result = calculateMonthlyPayment(
          balance,
          monthlyRate,
          1,
          'annuity',
          currentAnnuityPayment,
          new Decimal(0)
        );

        expect(result.principalPart.toNumber()).toBe(100);
        expect(result.payment.toNumber()).toBe(100.5);
      });

      it('handles zero interest rate', () => {
        const balance = new Decimal(10000);
        const monthlyRate = new Decimal(0);
        const currentAnnuityPayment = new Decimal('83.33');
        
        const result = calculateMonthlyPayment(
          balance,
          monthlyRate,
          120,
          'annuity',
          currentAnnuityPayment,
          new Decimal(0)
        );

        expect(result.interest.toNumber()).toBe(0);
        expect(result.principalPart.toNumber()).toBeCloseTo(83.33, 2);
      });
    });

    describe('decreasing loan', () => {
      it('calculates payment with fixed capital portion', () => {
        const balance = new Decimal(400000);
        const monthlyRate = new Decimal(0.005);
        const capitalPortion = new Decimal('1111.11');
        
        const result = calculateMonthlyPayment(
          balance,
          monthlyRate,
          360,
          'decreasing',
          new Decimal(0),
          capitalPortion
        );

        expect(result.interest.toNumber()).toBe(2000);
        expect(result.principalPart.toNumber()).toBeCloseTo(1111.11, 2);
        expect(result.payment.toNumber()).toBeCloseTo(3111.11, 2);
      });

      it('handles last payment edge case where capital portion exceeds balance', () => {
        const balance = new Decimal(50);
        const monthlyRate = new Decimal(0.005);
        const capitalPortion = new Decimal(1111.11);
        
        const result = calculateMonthlyPayment(
          balance,
          monthlyRate,
          1,
          'decreasing',
          new Decimal(0),
          capitalPortion
        );

        expect(result.principalPart.toNumber()).toBe(50);
        expect(result.payment.toNumber()).toBe(50.25);
      });

      it('interest decreases as balance decreases', () => {
        const monthlyRate = new Decimal(0.005);
        const capitalPortion = new Decimal('1111.11');

        const month1 = calculateMonthlyPayment(
          new Decimal(400000),
          monthlyRate,
          360,
          'decreasing',
          new Decimal(0),
          capitalPortion
        );

        const month100 = calculateMonthlyPayment(
          new Decimal(290000),
          monthlyRate,
          260,
          'decreasing',
          new Decimal(0),
          capitalPortion
        );

        expect(month1.interest.toNumber()).toBe(2000);
        expect(month100.interest.toNumber()).toBe(1450);
        expect(month1.principalPart.equals(month100.principalPart)).toBe(true);
      });
    });
  });

  describe('recalculatePaymentForReduceStrategy', () => {
    describe('annuity loan', () => {
      it('recalculates lower payment after overpayment reduces balance', () => {
        const balance = new Decimal(350000);
        const monthlyRate = new Decimal(0.005);
        const remainingMonths = 350;

        const result = recalculatePaymentForReduceStrategy(
          balance,
          monthlyRate,
          remainingMonths,
          'annuity'
        );

        expect(result.toNumber()).toBeCloseTo(2120.01, 2);
        expect(result.lessThan(2398.20)).toBe(true);
      });

      it('returns higher payment for fewer remaining months', () => {
        const balance = new Decimal(350000);
        const monthlyRate = new Decimal(0.005);

        const result300 = recalculatePaymentForReduceStrategy(
          balance,
          monthlyRate,
          300,
          'annuity'
        );

        const result200 = recalculatePaymentForReduceStrategy(
          balance,
          monthlyRate,
          200,
          'annuity'
        );

        expect(result200.greaterThan(result300)).toBe(true);
      });

      it('handles zero remaining months', () => {
        const balance = new Decimal(350000);
        const monthlyRate = new Decimal(0.005);

        const result = recalculatePaymentForReduceStrategy(
          balance,
          monthlyRate,
          0,
          'annuity'
        );

        expect(result.toNumber()).toBe(0);
      });

      it('handles very small balance and few remaining months', () => {
        const balance = new Decimal(100);
        const monthlyRate = new Decimal(0.005);

        const result = recalculatePaymentForReduceStrategy(
          balance,
          monthlyRate,
          1,
          'annuity'
        );

        expect(result.toNumber()).toBeCloseTo(100.5, 1);
      });
    });

    describe('decreasing loan', () => {
      it('recalculates capital portion after overpayment', () => {
        const balance = new Decimal(350000);
        const remainingMonths = 350;

        const result = recalculatePaymentForReduceStrategy(
          balance,
          new Decimal(0.005),
          remainingMonths,
          'decreasing'
        );

        expect(result.toNumber()).toBe(1000);
      });

      it('capital portion increases with fewer remaining months', () => {
        const balance = new Decimal(350000);

        const result300 = recalculatePaymentForReduceStrategy(
          balance,
          new Decimal(0.005),
          300,
          'decreasing'
        );

        const result200 = recalculatePaymentForReduceStrategy(
          balance,
          new Decimal(0.005),
          200,
          'decreasing'
        );

        expect(result300.toNumber()).toBeCloseTo(1166.67, 2);
        expect(result200.toNumber()).toBe(1750);
        expect(result200.greaterThan(result300)).toBe(true);
      });

      it('handles zero remaining months', () => {
        const balance = new Decimal(350000);

        const result = recalculatePaymentForReduceStrategy(
          balance,
          new Decimal(0.005),
          0,
          'decreasing'
        );

        expect(result.toNumber()).toBe(0);
      });

      it('handles very small balance', () => {
        const balance = new Decimal(100);

        const result = recalculatePaymentForReduceStrategy(
          balance,
          new Decimal(0.005),
          10,
          'decreasing'
        );

        expect(result.toNumber()).toBe(10);
      });
    });
  });
});

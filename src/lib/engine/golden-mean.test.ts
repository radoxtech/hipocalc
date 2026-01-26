import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import { calculateGoldenMean } from './golden-mean';
import type { GoldenMeanInput } from './golden-mean';

describe('calculateGoldenMean', () => {
  describe('basic scenarios', () => {
    it('splits available money 50/50 between overpayment and pleasures', () => {
      const input: GoldenMeanInput = {
        netIncome: new Decimal(8000),
        fixedExpenses: new Decimal(4000),
        mortgagePayment: new Decimal(2000),
        emergencyFundMonths: 6,
        emergencyFundStatus: 'have'
      };

      const result = calculateGoldenMean(input);

      // Available: 8000 - 4000 - 2000 = 2000
      // 50/50 split: 1000 overpayment, 1000 pleasures
      expect(result.recommendedOverpayment.toNumber()).toBeCloseTo(1000, 0);
      expect(result.discretionaryBudget.toNumber()).toBeCloseTo(1000, 0);
      expect(result.emergencyContribution.toNumber()).toBe(0);
    });

    it('returns zero overpayment when available is too low', () => {
      const input: GoldenMeanInput = {
        netIncome: new Decimal(5000),
        fixedExpenses: new Decimal(3500),
        mortgagePayment: new Decimal(1200),
        emergencyFundMonths: 6,
        emergencyFundStatus: 'have'
      };

      const result = calculateGoldenMean(input);

      // Available: 5000 - 3500 - 1200 = 300
      // Too low for meaningful overpayment (< 1000 for pleasures)
      expect(result.recommendedOverpayment.toNumber()).toBe(0);
      expect(result.discretionaryBudget.toNumber()).toBeCloseTo(300, 0);
      expect(result.rationale).toContain('przyjemności');
    });

    it('handles very high earners with warning', () => {
      const input: GoldenMeanInput = {
        netIncome: new Decimal(15000),
        fixedExpenses: new Decimal(5000),
        mortgagePayment: new Decimal(2000),
        emergencyFundMonths: 6,
        emergencyFundStatus: 'have'
      };

      const result = calculateGoldenMean(input);

      // Available: 15000 - 5000 - 2000 = 8000
      // 50/50 would be 4000 each
      // But 4000 > 30% of 15000 (4500), so no warning yet
      expect(result.recommendedOverpayment.toNumber()).toBeCloseTo(4000, 0);
      expect(result.discretionaryBudget.toNumber()).toBeCloseTo(4000, 0);
    });

    it('warns when overpayment exceeds 30% of income', () => {
      const input: GoldenMeanInput = {
        netIncome: new Decimal(10000),
        fixedExpenses: new Decimal(2000),
        mortgagePayment: new Decimal(1500),
        emergencyFundMonths: 6,
        emergencyFundStatus: 'have'
      };

      const result = calculateGoldenMean(input);

      // Available: 10000 - 2000 - 1500 = 6500
      // 50/50 would be 3250 each
      // 3250 > 30% of 10000 (3000), so warning should be present
      expect(result.recommendedOverpayment.toNumber()).toBeCloseTo(3250, 0);
      expect(result.warning).toBeDefined();
      expect(result.warning).toContain('30%');
    });
  });

  describe('emergency fund scenarios', () => {
    it('prioritizes emergency fund when building fast', () => {
      const input: GoldenMeanInput = {
        netIncome: new Decimal(8000),
        fixedExpenses: new Decimal(4000),
        mortgagePayment: new Decimal(2000),
        emergencyFundMonths: 6,
        emergencyFundStatus: 'build-fast'
      };

      const result = calculateGoldenMean(input);

      // Available: 2000
      // Build-fast: 50% of available goes to emergency = 1000
      // Remaining: 1000
      // 50/50 of remaining would be 500/500, but min pleasures = 1000
      // So: 1000 pleasures (minimum), 0 overpayment
      expect(result.emergencyContribution.toNumber()).toBeCloseTo(1000, 0);
      expect(result.recommendedOverpayment.toNumber()).toBe(0);
      expect(result.discretionaryBudget.toNumber()).toBeCloseTo(1000, 0);
    });

    it('prioritizes emergency fund when building slowly', () => {
      const input: GoldenMeanInput = {
        netIncome: new Decimal(8000),
        fixedExpenses: new Decimal(4000),
        mortgagePayment: new Decimal(2000),
        emergencyFundMonths: 6,
        emergencyFundStatus: 'build-slow-3y'
      };

      const result = calculateGoldenMean(input);

      // Available: 2000
      // Build-slow: 15% of available goes to emergency = 300
      // Remaining: 1700
      // 50/50 of remaining: 850/850, but min pleasures = 1000
      // So: 1000 pleasures (minimum), 700 overpayment
      expect(result.emergencyContribution.toNumber()).toBeCloseTo(300, 0);
      expect(result.recommendedOverpayment.toNumber()).toBeCloseTo(700, 0);
      expect(result.discretionaryBudget.toNumber()).toBeCloseTo(1000, 0);
    });
  });

  describe('edge cases', () => {
    it('handles expenses exceeding income', () => {
      const input: GoldenMeanInput = {
        netIncome: new Decimal(5000),
        fixedExpenses: new Decimal(4000),
        mortgagePayment: new Decimal(2000),
        emergencyFundMonths: 6,
        emergencyFundStatus: 'have'
      };

      const result = calculateGoldenMean(input);

      // Available: 5000 - 4000 - 2000 = -1000 (negative!)
      expect(result.recommendedOverpayment.toNumber()).toBe(0);
      expect(result.discretionaryBudget.toNumber()).toBe(0);
      expect(result.emergencyContribution.toNumber()).toBe(0);
      expect(result.warning).toBeDefined();
      expect(result.warning).toContain('przekraczają');
    });

    it('handles zero available money', () => {
      const input: GoldenMeanInput = {
        netIncome: new Decimal(6000),
        fixedExpenses: new Decimal(4000),
        mortgagePayment: new Decimal(2000),
        emergencyFundMonths: 6,
        emergencyFundStatus: 'have'
      };

      const result = calculateGoldenMean(input);

      // Available: 0
      expect(result.recommendedOverpayment.toNumber()).toBe(0);
      expect(result.discretionaryBudget.toNumber()).toBe(0);
    });

    it('ensures minimum 1000 zł for pleasures before recommending overpayment', () => {
      const input: GoldenMeanInput = {
        netIncome: new Decimal(7000),
        fixedExpenses: new Decimal(4000),
        mortgagePayment: new Decimal(1500),
        emergencyFundMonths: 6,
        emergencyFundStatus: 'have'
      };

      const result = calculateGoldenMean(input);

      // Available: 7000 - 4000 - 1500 = 1500
      // 50/50 would be 750 each, but 750 < 1000 minimum for pleasures
      // So: 1000 pleasures, 500 overpayment
      expect(result.discretionaryBudget.toNumber()).toBeGreaterThanOrEqual(1000);
      expect(result.recommendedOverpayment.toNumber()).toBeLessThanOrEqual(500);
    });
  });

  describe('rationale', () => {
    it('provides rationale for the recommendation', () => {
      const input: GoldenMeanInput = {
        netIncome: new Decimal(8000),
        fixedExpenses: new Decimal(4000),
        mortgagePayment: new Decimal(2000),
        emergencyFundMonths: 6,
        emergencyFundStatus: 'have'
      };

      const result = calculateGoldenMean(input);

      expect(result.rationale).toBeDefined();
      expect(result.rationale.length).toBeGreaterThan(0);
    });
  });
});

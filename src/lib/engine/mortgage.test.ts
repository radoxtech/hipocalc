import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import {
  calculateAnnuityPayment,
  calculateDecreasingPayment,
  generateAmortizationSchedule,
  calculateTotalInterest,
  calculateSavings,
  toGrosze
} from './mortgage';
import type { Loan, Overpayments, Schedule, ScheduleRow } from './types';

describe('toGrosze', () => {
  it('rounds to 2 decimal places using ROUND_HALF_UP', () => {
    expect(toGrosze(new Decimal('1.234')).toString()).toBe('1.23');
    expect(toGrosze(new Decimal('1.235')).toString()).toBe('1.24');
    expect(toGrosze(new Decimal('1.999')).toString()).toBe('2');
  });
});

describe('calculateAnnuityPayment', () => {
  it('calculates standard mortgage payment correctly', () => {
    // 300,000 zł at 6% annual (0.5% monthly) for 360 months
    const principal = new Decimal(300000);
    const monthlyRate = new Decimal(0.005); // 6% / 12
    const months = 360;

    const result = calculateAnnuityPayment(principal, monthlyRate, months);

    // Formula: R = K × (r / (1 - (1 + r)^(-n)))
    // Expected: ~1798.65 zł
    expect(result.toDecimalPlaces(2).toNumber()).toBeCloseTo(1798.65, 2);
  });

  it('calculates small loan correctly', () => {
    // 6,000 zł at 6% annual for 12 months
    const principal = new Decimal(6000);
    const monthlyRate = new Decimal(0.005);
    const months = 12;

    const result = calculateAnnuityPayment(principal, monthlyRate, months);

    // Expected: ~516.40 zł
    expect(result.toDecimalPlaces(2).toNumber()).toBeCloseTo(516.40, 2);
  });

  it('handles zero interest rate', () => {
    const principal = new Decimal(12000);
    const monthlyRate = new Decimal(0);
    const months = 12;

    const result = calculateAnnuityPayment(principal, monthlyRate, months);

    expect(result.toNumber()).toBe(1000);
  });
});

describe('calculateDecreasingPayment', () => {
  it('calculates first payment correctly', () => {
    // 6,000 zł at 6% annual (0.5% monthly) for 12 months
    const result = calculateDecreasingPayment(
      new Decimal(6000),  // principal
      new Decimal(0.005), // monthly rate (6% / 12)
      12,                 // total months
      1                   // current month
    );

    // Capital: 6000/12 = 500
    // Interest: 6000 * 0.005 = 30
    // Total: 530
    expect(result.principal.toNumber()).toBe(500);
    expect(result.interest.toNumber()).toBe(30);
    expect(result.total.toNumber()).toBe(530);
  });

  it('calculates last payment correctly', () => {
    const result = calculateDecreasingPayment(
      new Decimal(6000),
      new Decimal(0.005),
      12,
      12
    );

    // Capital: 500
    // Balance at month 12: 6000 - (11 * 500) = 500
    // Interest: 500 * 0.005 = 2.50
    // Total: 502.50
    expect(result.principal.toNumber()).toBe(500);
    expect(result.interest.toNumber()).toBeCloseTo(2.5, 2);
    expect(result.total.toNumber()).toBeCloseTo(502.5, 2);
  });

  it('calculates middle payment correctly', () => {
    const result = calculateDecreasingPayment(
      new Decimal(6000),
      new Decimal(0.005),
      12,
      6
    );

    // Capital: 500
    // Balance at month 6: 6000 - (5 * 500) = 3500
    // Interest: 3500 * 0.005 = 17.50
    // Total: 517.50
    expect(result.principal.toNumber()).toBe(500);
    expect(result.interest.toNumber()).toBeCloseTo(17.5, 2);
    expect(result.total.toNumber()).toBeCloseTo(517.5, 2);
  });
});

describe('generateAmortizationSchedule - Annuity', () => {
  const baseLoan: Loan = {
    principal: new Decimal(300000),
    annualRate: new Decimal(0.06), // 6%
    months: 360,
    type: 'annuity'
  };

  const noOverpayments: Overpayments = {
    monthly: new Decimal(0),
    yearly: new Decimal(0),
    yearlyMonth: 12
  };

  describe('strategy: none', () => {
    it('generates 360 rows with no overpayments', () => {
      const schedule = generateAmortizationSchedule(baseLoan, noOverpayments, 'none');

      expect(schedule.rows.length).toBe(360);
      expect(schedule.summary.totalMonths).toBe(360);
      expect(schedule.summary.totalOverpayments.toNumber()).toBe(0);
    });

    it('first row has correct values', () => {
      const schedule = generateAmortizationSchedule(baseLoan, noOverpayments, 'none');
      const firstRow = schedule.rows[0];

      // Payment should be ~1798.65
      expect(firstRow.month).toBe(1);
      expect(firstRow.payment.toDecimalPlaces(2).toNumber()).toBeCloseTo(1798.65, 1);
      expect(firstRow.overpayment.toNumber()).toBe(0);
      // First month interest: 300000 * 0.005 = 1500
      expect(firstRow.interest.toDecimalPlaces(2).toNumber()).toBeCloseTo(1500, 1);
    });

    it('balance reaches zero at end', () => {
      const schedule = generateAmortizationSchedule(baseLoan, noOverpayments, 'none');
      const lastRow = schedule.rows[schedule.rows.length - 1];

      expect(lastRow.balanceAfter.toDecimalPlaces(2).toNumber()).toBeCloseTo(0, 1);
    });
  });

  describe('strategy: shorten-term', () => {
    const overpayments: Overpayments = {
      monthly: new Decimal(500),
      yearly: new Decimal(0),
      yearlyMonth: 12
    };

    it('results in fewer months than 360', () => {
      const schedule = generateAmortizationSchedule(baseLoan, overpayments, 'shorten-term');

      expect(schedule.rows.length).toBeLessThan(360);
      expect(schedule.summary.totalMonths).toBeLessThan(360);
    });

    it('maintains consistent base payment', () => {
      const schedule = generateAmortizationSchedule(baseLoan, overpayments, 'shorten-term');

      // All payments (except possibly last) should be the same base payment
      const basePayment = schedule.rows[0].payment.toDecimalPlaces(2).toNumber();
      for (let i = 0; i < schedule.rows.length - 1; i++) {
        expect(schedule.rows[i].payment.toDecimalPlaces(2).toNumber()).toBeCloseTo(basePayment, 1);
      }
    });

    it('applies overpayment each month', () => {
      const schedule = generateAmortizationSchedule(baseLoan, overpayments, 'shorten-term');

      // Most months should have 500 zł overpayment (except last if balance < 500)
      const normalMonths = schedule.rows.slice(0, -1);
      normalMonths.forEach((row: ScheduleRow) => {
        expect(row.overpayment.toNumber()).toBe(500);
      });
    });
  });

  describe('strategy: reduce-payment', () => {
    const overpayments: Overpayments = {
      monthly: new Decimal(500),
      yearly: new Decimal(0),
      yearlyMonth: 12
    };

    it('maintains 360 months', () => {
      const schedule = generateAmortizationSchedule(baseLoan, overpayments, 'reduce-payment');

      // Should still be close to 360 or finish early only because balance depleted
      // In reduce-payment, we don't necessarily stay at 360 if balance hits zero
      expect(schedule.summary.totalMonths).toBeLessThanOrEqual(360);
    });

    it('payments decrease over time', () => {
      const schedule = generateAmortizationSchedule(baseLoan, overpayments, 'reduce-payment');

      // Payment should decrease as balance decreases (with overpayments)
      const firstPayment = schedule.rows[0].payment.toNumber();
      const midPayment = schedule.rows[Math.floor(schedule.rows.length / 2)]?.payment.toNumber();

      if (midPayment) {
        expect(midPayment).toBeLessThan(firstPayment);
      }
    });
  });

  describe('yearly overpayments', () => {
    it('applies yearly overpayment in correct month', () => {
      const overpayments: Overpayments = {
        monthly: new Decimal(0),
        yearly: new Decimal(5000),
        yearlyMonth: 12
      };

      const schedule = generateAmortizationSchedule(baseLoan, overpayments, 'shorten-term');

      // Month 12 should have 5000 overpayment
      const month12 = schedule.rows.find((r: ScheduleRow) => r.month === 12);
      expect(month12?.overpayment.toNumber()).toBe(5000);

      // Month 24 should also have 5000 (if it exists)
      const month24 = schedule.rows.find((r: ScheduleRow) => r.month === 24);
      if (month24) {
        expect(month24.overpayment.toNumber()).toBe(5000);
      }
    });

    it('applies yearly overpayment in custom month', () => {
      const overpayments: Overpayments = {
        monthly: new Decimal(0),
        yearly: new Decimal(5000),
        yearlyMonth: 6
      };

      const schedule = generateAmortizationSchedule(baseLoan, overpayments, 'shorten-term');

      // Month 6 should have 5000 overpayment
      const month6 = schedule.rows.find((r: ScheduleRow) => r.month === 6);
      expect(month6?.overpayment.toNumber()).toBe(5000);
    });
  });

  describe('overpayment capping', () => {
    it('caps overpayment to remaining balance', () => {
      const smallLoan: Loan = {
        principal: new Decimal(10000),
        annualRate: new Decimal(0.06),
        months: 24,
        type: 'annuity'
      };

      const largeOverpayment: Overpayments = {
        monthly: new Decimal(1000), // Large relative to loan
        yearly: new Decimal(0),
        yearlyMonth: 12
      };

      const schedule = generateAmortizationSchedule(smallLoan, largeOverpayment, 'shorten-term');

      // Last row should have balance = 0 (not negative)
      const lastRow = schedule.rows[schedule.rows.length - 1];
      expect(lastRow.balanceAfter.toNumber()).toBeCloseTo(0, 2);

      // All balances should be >= 0
      schedule.rows.forEach((row: ScheduleRow) => {
        expect(row.balanceAfter.toNumber()).toBeGreaterThanOrEqual(-0.01);
      });
    });
  });
});

describe('generateAmortizationSchedule - Decreasing', () => {
  const baseLoan: Loan = {
    principal: new Decimal(300000),
    annualRate: new Decimal(0.06),
    months: 360,
    type: 'decreasing'
  };

  const noOverpayments: Overpayments = {
    monthly: new Decimal(0),
    yearly: new Decimal(0),
    yearlyMonth: 12
  };

  describe('strategy: none', () => {
    it('generates 360 rows', () => {
      const schedule = generateAmortizationSchedule(baseLoan, noOverpayments, 'none');

      expect(schedule.rows.length).toBe(360);
    });

    it('has constant capital portion', () => {
      const schedule = generateAmortizationSchedule(baseLoan, noOverpayments, 'none');

      // Capital portion: 300000 / 360 = 833.33...
      const expectedCapital = 300000 / 360;

      schedule.rows.forEach((row: ScheduleRow) => {
        expect(row.principal.toDecimalPlaces(2).toNumber()).toBeCloseTo(expectedCapital, 1);
      });
    });

    it('first payment is highest, last is lowest', () => {
      const schedule = generateAmortizationSchedule(baseLoan, noOverpayments, 'none');

      const firstPayment = schedule.rows[0].payment.toNumber();
      const lastPayment = schedule.rows[schedule.rows.length - 1].payment.toNumber();

      expect(firstPayment).toBeGreaterThan(lastPayment);
    });
  });

  describe('strategy: shorten-term', () => {
    const overpayments: Overpayments = {
      monthly: new Decimal(500),
      yearly: new Decimal(0),
      yearlyMonth: 12
    };

    it('results in fewer months', () => {
      const schedule = generateAmortizationSchedule(baseLoan, overpayments, 'shorten-term');

      expect(schedule.rows.length).toBeLessThan(360);
    });

    it('maintains original capital portion', () => {
      const schedule = generateAmortizationSchedule(baseLoan, overpayments, 'shorten-term');

      // Capital portion should remain 300000/360 = 833.33
      const expectedCapital = 300000 / 360;

      // Check first few rows (before potential early payoff)
      for (let i = 0; i < Math.min(10, schedule.rows.length); i++) {
        expect(schedule.rows[i].principal.toDecimalPlaces(2).toNumber()).toBeCloseTo(expectedCapital, 1);
      }
    });
  });

  describe('strategy: reduce-payment', () => {
    const overpayments: Overpayments = {
      monthly: new Decimal(500),
      yearly: new Decimal(0),
      yearlyMonth: 12
    };

    it('capital portion decreases after overpayment', () => {
      const schedule = generateAmortizationSchedule(baseLoan, overpayments, 'reduce-payment');

      // After first month with overpayment, capital portion should be recalculated
      // Initial: 300000/360 = 833.33
      // After month 1: new_balance / 359 < 833.33
      const firstCapital = schedule.rows[0].principal.toNumber();
      const laterCapital = schedule.rows[10].principal.toNumber();

      expect(laterCapital).toBeLessThan(firstCapital);
    });
  });
});

describe('calculateTotalInterest', () => {
  it('sums all interest from schedule', () => {
    const mockSchedule: Schedule = {
      rows: [
        {
          month: 1,
          payment: new Decimal(1000),
          principal: new Decimal(700),
          interest: new Decimal(300),
          overpayment: new Decimal(0),
          totalPaid: new Decimal(1000),
          balanceAfter: new Decimal(9300)
        },
        {
          month: 2,
          payment: new Decimal(1000),
          principal: new Decimal(750),
          interest: new Decimal(250),
          overpayment: new Decimal(0),
          totalPaid: new Decimal(1000),
          balanceAfter: new Decimal(8550)
        }
      ],
      summary: {
        totalMonths: 2,
        totalPaid: new Decimal(2000),
        totalInterest: new Decimal(550),
        totalOverpayments: new Decimal(0),
        initialTotalPayment: new Decimal(1000)
      }
    };

    const result = calculateTotalInterest(mockSchedule);

    expect(result.toNumber()).toBe(550);
  });
});

describe('calculateSavings', () => {
  it('calculates interest saved between two schedules', () => {
    const withoutOverpayment: Schedule = {
      rows: [],
      summary: {
        totalMonths: 360,
        totalPaid: new Decimal(647500),
        totalInterest: new Decimal(347500),
        totalOverpayments: new Decimal(0),
        initialTotalPayment: new Decimal(0)
      }
    };

    const withOverpayment: Schedule = {
      rows: [],
      summary: {
        totalMonths: 240,
        totalPaid: new Decimal(520000),
        totalInterest: new Decimal(180000),
        totalOverpayments: new Decimal(40000),
        initialTotalPayment: new Decimal(0)
      }
    };

    const savings = calculateSavings(withOverpayment, withoutOverpayment);

    expect(savings.interestSaved.toNumber()).toBe(167500);
    expect(savings.monthsSaved).toBe(120);
  });
});

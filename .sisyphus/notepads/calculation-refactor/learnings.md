# Learnings - Calculation Refactor

## Session: ses_3f0fc442fffeolIJw4qT9PHZYg

### Task 1 - Characterization Tests ✅
- Created 38 characterization tests successfully
- All tests passing
- Commit: dd5ec32
- Duration: 2m 40s

### Task 2 & 3 - Wave 2 Dispatch Issue ⚠️
- MISTAKE: Included Prometheus read-only directive in delegation prompts
- This caused agents to only analyze instead of implement
- Cancelled background tasks and re-dispatching correctly

### Task 2 - TDD RED Phase ✅
- Added initialTotalPayment: Decimal field to Schedule.summary in types.ts
- Created initialTotalPayment.test.ts with 11 comprehensive tests
- Tests cover all strategies: none, shorten-term, reduce-payment
- Tests cover edge cases: small loans, decreasing payment type, Decimal type validation
- All 11 tests FAIL as expected (RED phase) - initialTotalPayment is undefined
- Type errors in mortgage.ts, rate-simulation.ts, mortgage.test.ts (expected - implementation pending)
- Duration: ~5 minutes
- Next: Task 3 will implement initialTotalPayment calculation in mortgage.ts and rate-simulation.ts

### Task 3 - Extract Schedule Core ✅
- Created src/lib/engine/schedule-core.ts with 4 helper functions
- Created comprehensive test suite: schedule-core.test.ts (28 tests, all passing)
- Functions extracted:
  1. shouldApplyYearlyOverpayment - handles yearlyMonth=12 edge case
  2. applyAnnualRaise - applies raise at month % 12 === 1
  3. calculateMonthlyPayment - unified logic for annuity + decreasing
  4. recalculatePaymentForReduceStrategy - recalc after overpayment
- Test coverage: edge cases (zero interest, last payment, both loan types)
- All existing tests still pass (111 tests: 26+10+37+38)
- Duration: ~2 minutes

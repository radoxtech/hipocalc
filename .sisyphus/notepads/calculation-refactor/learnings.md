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

## Task 4 Completion - mortgage.ts Refactored (2026-01-30)

### What Was Done
- **Refactored** mortgage.ts to use 4 helpers from schedule-core.ts
- **Added** initialTotalPayment to Schedule.summary return value
- **Verified** all 150 tests pass (26 mortgage + 11 initialTotalPayment + 38 characterization + others)

### Code Changes
1. **Imports**: Added 4 helpers from schedule-core.ts:
   - shouldApplyYearlyOverpayment
   - applyAnnualRaise
   - calculateMonthlyPayment
   - recalculatePaymentForReduceStrategy

2. **Annual Raise** (line 137): Replaced inline logic with applyAnnualRaise helper
   - Before: 3 lines of if/times logic
   - After: 1 line helper call

3. **Yearly Overpayment** (lines 145, 161): Replaced 2 occurrences with shouldApplyYearlyOverpayment helper
   - Before: Complex modulo condition (month % 12 === yearlyMonth % 12 || ...)
   - After: Single helper call

4. **Payment Calculation** (lines 118-128): Replaced 30-line if/else with calculateMonthlyPayment helper
   - Before: Separate annuity/decreasing logic with edge cases
   - After: 10-line helper call + destructuring

5. **Reduce-Payment Recalculation** (lines 177-193): Replaced nested if/else with recalculatePaymentForReduceStrategy helper
   - Before: Separate annuity/decreasing recalculation logic
   - After: Single helper call + conditional assignment

6. **initialTotalPayment** (line 223): Added to Schedule.summary
   - Formula: rows[0].payment + rows[0].overpayment
   - Handles empty rows edge case

### Results
- **Lines removed**: 43 lines of duplicated logic
- **Lines added**: 34 lines (imports + helper calls)
- **Net savings**: 9 lines, much cleaner code
- **Tests**: All 150 tests pass (GREEN phase achieved)
- **LSP errors**: Clean - no type errors
- **Commit**: `refactor(engine): mortgage.ts uses schedule-core helpers, add initialTotalPayment`

### Key Insights
1. **Helper pattern works perfectly**: Each helper replaced 3-30 lines with 1-10 lines
2. **Type safety maintained**: TypeScript catches any mismatches
3. **Tests as safety net**: 150 tests caught any behavioral regressions
4. **TDD cycle complete**: RED (task 2) → GREEN (task 4)
5. **Refactoring efficiency**: 9 lines saved, but readability improved dramatically

### Next Steps
- Task 5: Refactor rate-simulation.ts (similar approach)
- Task 6: Final verification across all 3 files

### Task 5 - Refactor rate-simulation.ts ✅
- Successfully refactored rate-simulation.ts to use schedule-core helpers
- Consolidated ~160 lines of duplicated code into single calculateReinvestScheduleInternal function
- Key changes:
  1. Added imports: shouldApplyYearlyOverpayment, applyAnnualRaise, calculateMonthlyPayment, recalculatePaymentForReduceStrategy
  2. Created internal unified function that handles both modes:
     - Legacy reinvest mode: compares with original schedule, reinvests savings
     - Fixed budget mode: uses fixedBudget parameter, applies annual raise
  3. Both calculateReinvestSchedule and calculateBudgetReinvestSchedule now delegate to internal function
  4. Added initialTotalPayment to Schedule.summary (rows[0].payment + rows[0].overpayment)
- Code reduction: From ~320 lines to ~240 lines (80 lines removed, 25% reduction)
- Test results: All 150 tests pass (37 rate-simulation + 38 characterization + 28 schedule-core + 26 mortgage + 11 initialTotalPayment + 10 golden-mean)
- LSP diagnostics: Clean, no errors
- Behavior preservation: Characterization tests confirm exact same values
- Duration: ~3 minutes
- Commit ready: "refactor(engine): rate-simulation.ts uses schedule-core, consolidate reinvest functions"

#### Pattern Learned
- Consolidation strategy: Create internal function with optional parameters to unify similar logic
- Two exported functions become thin wrappers, maintaining API compatibility
- Comments clarify the dual-mode branching logic (necessary for complex financial logic)

### Task 6 - Final Verification ✅
- All 150 tests passing (6 test files)
- TypeScript compilation: 0 errors
- Build successful: `npm run build` completes without errors
- Duplication check: Only 1 occurrence of `month % 12 ===` pattern (in schedule-core.ts)
- Code reduction summary:
  - mortgage.ts: ~9 lines saved, much cleaner structure
  - rate-simulation.ts: ~80 lines saved (25% reduction)
  - Total: ~90 lines of duplicated code eliminated
- New files created:
  - schedule-core.ts (164 lines, 4 helpers)
  - schedule-core.test.ts (111 lines, 28 tests)
  - characterization.test.ts (38 tests)
  - initialTotalPayment.test.ts (11 tests)
- All guardrails respected:
  - ✅ No changes to golden-mean.ts
  - ✅ No changes to ScheduleRow structure
  - ✅ No behavioral changes (characterization tests confirm)
  - ✅ Public API unchanged
  - ✅ TDD workflow followed (RED → GREEN)

### Final Statistics
- **Total tests**: 150 (was 73, now 150)
- **New tests added**: 77 (38 characterization + 28 schedule-core + 11 initialTotalPayment)
- **Files modified**: 4 (types.ts, mortgage.ts, rate-simulation.ts, mortgage.test.ts)
- **Files created**: 4 (schedule-core.ts, schedule-core.test.ts, characterization.test.ts, initialTotalPayment.test.ts)
- **Lines of code**: ~90 lines of duplication eliminated
- **Duration**: ~15 minutes total
- **Commits**: 6 atomic commits following TDD workflow

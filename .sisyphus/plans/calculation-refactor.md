# Calculation Functions Refactoring

## TL;DR

> **Quick Summary**: Eliminate code duplication between mortgage.ts and rate-simulation.ts by extracting shared logic into a new schedule-core.ts module. Add universal initialTotalPayment tracking to all schedules.
> 
> **Deliverables**:
> - New `schedule-core.ts` with extracted helper functions
> - Updated `mortgage.ts` and `rate-simulation.ts` using shared helpers
> - `initialTotalPayment` field added to Schedule.summary
> - New TDD tests for initialTotalPayment feature
> - All 73 existing tests passing
> 
> **Estimated Effort**: Medium (2-3 hours)
> **Parallel Execution**: YES - 2 waves
> **Critical Path**: Task 1 → Task 2 → Task 3 → Task 4 → Task 5 → Task 6

---

## Context

### Original Request
User wants to refactor calculation functions to eliminate duplication and add universal initialTotalPayment tracking. TDD approach requested.

### Interview Summary
**Key Discussions**:
- **Code duplication identified**: Two reinvest functions, payment loop logic, yearly overpayment check, payment recalculation - all duplicated across mortgage.ts and rate-simulation.ts
- **New feature**: Make initialTotalPayment universal across all strategies (currently only reduce-plus tracks fixed budget)
- **TDD approach**: Write failing tests first, then implement
- **Architecture**: User delegated decision to AI

**Research Findings**:
- mortgage.ts: 262 lines, generateAmortizationSchedule is 162-line while loop
- rate-simulation.ts: 350 lines, has TWO nearly identical reinvest functions (~80 lines each)
- Yearly overpayment check copy-pasted 4 times
- Payment calculation (annuity/decreasing) duplicated 3 times
- 73 existing tests with exact expected values - must remain stable

### Metis Review
**Identified Gaps** (addressed):
- Architecture decision: Chose `schedule-core.ts` approach for clean separation
- initialTotalPayment definition: Will be `rows[0].payment + rows[0].overpayment` added to Summary
- Test stability: All 73 tests must pass with identical expected values
- Edge cases: Empty schedule returns initialTotalPayment of 0
- golden-mean.ts imports types.ts: OK, only adding to Summary, no breaking changes

---

## Work Objectives

### Core Objective
Eliminate ~150 lines of duplicated code across mortgage.ts and rate-simulation.ts while adding initialTotalPayment to Schedule.summary for universal budget tracking.

### Concrete Deliverables
- `src/lib/engine/schedule-core.ts` - New file with extracted helpers
- `src/lib/engine/types.ts` - Updated with initialTotalPayment in Summary
- `src/lib/engine/mortgage.ts` - Refactored to use schedule-core
- `src/lib/engine/rate-simulation.ts` - Refactored to use schedule-core
- `src/lib/engine/schedule-core.test.ts` - TDD tests for extracted functions
- Updated tests for initialTotalPayment feature

### Definition of Done
- [x] `npm test` shows all tests passing (150 tests - 73 existing + 77 new)
- [x] `npm run build` compiles without errors
- [x] No duplicate code patterns found via ast_grep_search
- [x] initialTotalPayment present in all Schedule.summary outputs

### Must Have
- All 73 existing tests pass with identical expected values
- initialTotalPayment = first month's (payment + overpayment)
- Public API unchanged (function signatures preserved)
- TDD workflow (failing test → implementation → passing test)

### Must NOT Have (Guardrails)
- **No changes to golden-mean.ts** - explicitly out of scope
- **No changes to ScheduleRow structure** - only Summary gets new field
- **No behavioral changes** - refactoring only, same outputs
- **No "while I'm at it" improvements** - stick to duplication elimination
- **No class-based refactor** - keep functional approach
- **No optimization of Decimal.js precision** - risky, not requested
- **No input validation additions** - not requested

---

## Verification Strategy (MANDATORY)

### Test Decision
- **Infrastructure exists**: YES
- **User wants tests**: TDD
- **Framework**: Vitest 4.0.18

### TDD Workflow

Each TODO follows RED-GREEN-REFACTOR:

**Task Structure:**
1. **RED**: Write failing test first
   - Test file: `*.test.ts`
   - Test command: `npm test -- --reporter=verbose`
   - Expected: FAIL (test exists, implementation doesn't)
2. **GREEN**: Implement minimum code to pass
   - Command: `npm test`
   - Expected: PASS
3. **REFACTOR**: Clean up while keeping green
   - Command: `npm test`
   - Expected: PASS (still)

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately):
└── Task 1: Characterization tests (lock current behavior)

Wave 2 (After Task 1):
├── Task 2: Add initialTotalPayment to types.ts + write failing tests
├── Task 3: Extract helper functions to schedule-core.ts
└── (Task 2 and 3 can run in parallel)

Wave 3 (After Tasks 2, 3):
├── Task 4: Refactor mortgage.ts to use schedule-core
└── Task 5: Refactor rate-simulation.ts to use schedule-core

Wave 4 (After Tasks 4, 5):
└── Task 6: Final verification and cleanup

Critical Path: Task 1 → Task 2 → Task 4 → Task 6
Parallel Speedup: ~30% faster than sequential
```

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
|------|------------|--------|---------------------|
| 1 | None | 2, 3 | None |
| 2 | 1 | 4, 5 | 3 |
| 3 | 1 | 4, 5 | 2 |
| 4 | 2, 3 | 6 | 5 |
| 5 | 2, 3 | 6 | 4 |
| 6 | 4, 5 | None | None |

### Agent Dispatch Summary

| Wave | Tasks | Recommended Dispatch |
|------|-------|---------------------|
| 1 | 1 | Single agent, quick task |
| 2 | 2, 3 | Two parallel agents |
| 3 | 4, 5 | Two parallel agents |
| 4 | 6 | Single agent, verification |

---

## TODOs

### Task 1: Create Characterization Tests (Lock Current Behavior)

- [x] 1. Create characterization tests to lock current behavior before refactoring

  **What to do**:
  - Create `src/lib/engine/characterization.test.ts` with snapshot-style tests
  - Test all 4 strategies with a standard loan (500000 PLN, 7.5%, 360 months)
  - Capture exact summary values (totalMonths, totalPaid, totalInterest, totalOverpayments)
  - These tests ensure refactoring doesn't change behavior

  **Must NOT do**:
  - Don't modify any existing code
  - Don't change existing test files

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single test file creation, low complexity
  - **Skills**: []
    - No special skills needed - straightforward test writing
  - **Skills Evaluated but Omitted**:
    - `playwright`: Not browser-related
    - `frontend-ui-ux`: Not UI work

  **Parallelization**:
  - **Can Run In Parallel**: NO (first task)
  - **Parallel Group**: Wave 1 (solo)
  - **Blocks**: Tasks 2, 3
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `src/lib/engine/mortgage.test.ts:1-50` - Test file structure and imports
  - `src/lib/engine/rate-simulation.test.ts:describe("generateScheduleForRate")` - Example of testing schedule generation

  **API/Type References**:
  - `src/lib/engine/types.ts:Schedule` - The interface being tested
  - `src/lib/engine/types.ts:Loan` - Input interface structure

  **Test References**:
  - `src/lib/engine/mortgage.test.ts:it("returns 164 months")` - Example of exact value assertion pattern

  **WHY Each Reference Matters**:
  - mortgage.test.ts shows how to import Decimal and structure describe blocks
  - types.ts defines exact fields that characterization tests should capture
  - Existing test patterns show the toDecimalPlaces(2).toNumber() assertion style

  **Acceptance Criteria**:

  **TDD (tests enabled):**
  - [ ] Test file created: `src/lib/engine/characterization.test.ts`
  - [ ] Tests cover: All 4 strategies (none, shorten-term, reduce-payment, reduce-plus)
  - [ ] `npm test src/lib/engine/characterization.test.ts` → PASS

  **Automated Verification:**
  ```bash
  # Agent runs:
  npm test -- --reporter=verbose src/lib/engine/characterization.test.ts 2>&1 | grep -E "(PASS|FAIL|passed|failed)"
  # Assert: All tests pass
  ```

  **Evidence to Capture:**
  - [ ] Test output showing all characterization tests passing

  **Commit**: YES
  - Message: `test(engine): add characterization tests before refactoring`
  - Files: `src/lib/engine/characterization.test.ts`
  - Pre-commit: `npm test`

---

### Task 2: Add initialTotalPayment to Types + Write Failing Tests (TDD RED)

- [x] 2. Add initialTotalPayment field and write failing tests

  **What to do**:
  - Add `initialTotalPayment: Decimal` to `Schedule.summary` in types.ts
  - Write failing tests in `src/lib/engine/initialTotalPayment.test.ts`:
    - Test initialTotalPayment equals rows[0].payment + rows[0].overpayment for each strategy
    - Test edge case: empty schedule returns initialTotalPayment of 0
  - Tests SHOULD FAIL at this point (RED phase of TDD)

  **Must NOT do**:
  - Don't implement the feature yet - only types and tests
  - Don't modify mortgage.ts or rate-simulation.ts logic yet

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Small type change + test file creation
  - **Skills**: []
    - No special skills needed
  - **Skills Evaluated but Omitted**:
    - All skills unrelated to this task

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Task 3)
  - **Blocks**: Tasks 4, 5
  - **Blocked By**: Task 1

  **References**:

  **Pattern References**:
  - `src/lib/engine/types.ts:42-51` - Schedule interface with summary structure

  **API/Type References**:
  - `src/lib/engine/types.ts:Schedule.summary` - Where to add initialTotalPayment

  **Test References**:
  - `src/lib/engine/mortgage.test.ts:describe("generateAmortizationSchedule")` - Testing schedule output

  **WHY Each Reference Matters**:
  - types.ts:42-51 shows exact structure of Schedule.summary to extend
  - mortgage.test.ts shows how to assert on schedule.summary fields

  **Acceptance Criteria**:

  **TDD (tests enabled):**
  - [ ] Type updated: `src/lib/engine/types.ts` contains `initialTotalPayment: Decimal` in summary
  - [ ] Test file created: `src/lib/engine/initialTotalPayment.test.ts`
  - [ ] `npm test src/lib/engine/initialTotalPayment.test.ts` → FAIL (expected - RED phase)

  **Automated Verification:**
  ```bash
  # Agent runs type check:
  npx tsc --noEmit 2>&1 | grep -q "error" && echo "TYPE_ERROR" || echo "TYPES_OK"
  # Assert: TYPES_OK (types compile)
  
  # Agent runs new tests (should fail - RED phase):
  npm test -- --reporter=verbose src/lib/engine/initialTotalPayment.test.ts 2>&1 | grep -E "(FAIL|failed)"
  # Assert: Tests fail (initialTotalPayment not implemented yet)
  
  # Agent verifies existing tests still pass:
  npm test -- src/lib/engine/mortgage.test.ts src/lib/engine/rate-simulation.test.ts src/lib/engine/golden-mean.test.ts 2>&1 | grep "passed"
  # Assert: 73 tests still passing
  ```

  **Evidence to Capture:**
  - [ ] Type compilation success
  - [ ] New tests failing (expected)
  - [ ] Existing 73 tests still passing

  **Commit**: YES
  - Message: `test(engine): add failing tests for initialTotalPayment [TDD RED]`
  - Files: `src/lib/engine/types.ts`, `src/lib/engine/initialTotalPayment.test.ts`
  - Pre-commit: `npx tsc --noEmit` (types only, tests expected to fail)

---

### Task 3: Extract Helper Functions to schedule-core.ts

- [x] 3. Create schedule-core.ts with extracted helper functions

  **What to do**:
  - Create `src/lib/engine/schedule-core.ts` with these extracted helpers:
    - `calculateMonthlyPayment(balance, monthlyRate, remainingMonths, loanType)` - unified payment calculation
    - `shouldApplyYearlyOverpayment(month, yearlyMonth)` - yearly overpayment check
    - `recalculatePaymentForReduceStrategy(balance, monthlyRate, remainingMonths, loanType)` - payment recalculation
    - `applyAnnualRaise(overpayment, month, raisePercent)` - annual raise logic
  - Create `src/lib/engine/schedule-core.test.ts` with unit tests for each helper
  - Do NOT modify mortgage.ts or rate-simulation.ts yet

  **Must NOT do**:
  - Don't change mortgage.ts or rate-simulation.ts yet (that's Tasks 4-5)
  - Don't change public API signatures
  - Don't introduce new dependencies

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
    - Reason: Code extraction requires understanding but is straightforward
  - **Skills**: []
    - No special skills needed
  - **Skills Evaluated but Omitted**:
    - All skills unrelated to this task

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Task 2)
  - **Blocks**: Tasks 4, 5
  - **Blocked By**: Task 1

  **References**:

  **Pattern References**:
  - `src/lib/engine/mortgage.ts:116-136` - Payment calculation logic to extract
  - `src/lib/engine/mortgage.ts:155-157` - Yearly overpayment check pattern
  - `src/lib/engine/mortgage.ts:190-203` - Reduce-payment recalculation
  - `src/lib/engine/rate-simulation.ts:65-81` - Same payment calculation (duplicate)
  - `src/lib/engine/rate-simulation.ts:87-90` - Same yearly overpayment check (duplicate)

  **API/Type References**:
  - `src/lib/engine/types.ts:Loan` - loanType parameter
  - `src/lib/engine/types.ts:Overpayments` - yearlyMonth parameter

  **Test References**:
  - `src/lib/engine/mortgage.test.ts:describe("calculateAnnuityPayment")` - Testing pure functions

  **WHY Each Reference Matters**:
  - mortgage.ts:116-136 shows exact payment calculation to extract (handle both annuity and decreasing)
  - rate-simulation.ts:65-81 shows the duplicate version (verify they match before extracting)
  - Line 155-157 shows the `month % 12 === yearlyMonth % 12` pattern used 4 times

  **Acceptance Criteria**:

  **TDD (tests enabled):**
  - [ ] New file created: `src/lib/engine/schedule-core.ts`
  - [ ] Test file created: `src/lib/engine/schedule-core.test.ts`
  - [ ] Tests cover: calculateMonthlyPayment, shouldApplyYearlyOverpayment, recalculatePaymentForReduceStrategy
  - [ ] `npm test src/lib/engine/schedule-core.test.ts` → PASS

  **Automated Verification:**
  ```bash
  # Agent verifies new module compiles:
  npx tsc --noEmit 2>&1 | grep -q "error" && echo "TYPE_ERROR" || echo "TYPES_OK"
  # Assert: TYPES_OK
  
  # Agent runs new tests:
  npm test -- --reporter=verbose src/lib/engine/schedule-core.test.ts 2>&1 | grep -E "passed"
  # Assert: All helper tests pass
  
  # Agent verifies existing tests unchanged:
  npm test -- src/lib/engine/mortgage.test.ts src/lib/engine/rate-simulation.test.ts 2>&1 | grep "passed"
  # Assert: Still 63 tests passing (26 + 37)
  ```

  **Evidence to Capture:**
  - [ ] schedule-core.ts created with 4 helper functions
  - [ ] schedule-core.test.ts with passing tests
  - [ ] Existing tests still passing

  **Commit**: YES
  - Message: `feat(engine): extract shared helpers to schedule-core.ts`
  - Files: `src/lib/engine/schedule-core.ts`, `src/lib/engine/schedule-core.test.ts`
  - Pre-commit: `npm test`

---

### Task 4: Refactor mortgage.ts to Use schedule-core

- [x] 4. Update mortgage.ts to use extracted helpers from schedule-core

  **What to do**:
  - Import helpers from schedule-core.ts
  - Replace duplicated payment calculation with `calculateMonthlyPayment()`
  - Replace yearly overpayment check with `shouldApplyYearlyOverpayment()`
  - Replace reduce-payment recalculation with `recalculatePaymentForReduceStrategy()`
  - Add `initialTotalPayment` to Schedule.summary (GREEN phase for Task 2's tests)
  - Ensure all 26 mortgage tests still pass with exact same values

  **Must NOT do**:
  - Don't change function signatures of exported functions
  - Don't change any behavior - only code structure
  - Don't change test assertions

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
    - Reason: Straightforward refactoring with clear patterns
  - **Skills**: []
    - No special skills needed
  - **Skills Evaluated but Omitted**:
    - All skills unrelated to this task

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Task 5)
  - **Blocks**: Task 6
  - **Blocked By**: Tasks 2, 3

  **References**:

  **Pattern References**:
  - `src/lib/engine/schedule-core.ts` - Helpers to import (created in Task 3)
  - `src/lib/engine/mortgage.ts:73-235` - generateAmortizationSchedule to refactor

  **API/Type References**:
  - `src/lib/engine/types.ts:Schedule.summary` - Add initialTotalPayment here

  **Test References**:
  - `src/lib/engine/mortgage.test.ts` - All 26 tests must still pass
  - `src/lib/engine/characterization.test.ts` - Verify no behavior change

  **WHY Each Reference Matters**:
  - schedule-core.ts provides the helpers to call
  - mortgage.ts:73-235 is the main function to refactor
  - Tests verify no regression

  **Acceptance Criteria**:

  **TDD (tests enabled):**
  - [ ] mortgage.ts imports from schedule-core.ts
  - [ ] generateAmortizationSchedule returns initialTotalPayment in summary
  - [ ] `npm test src/lib/engine/mortgage.test.ts` → PASS (26 tests)
  - [ ] `npm test src/lib/engine/initialTotalPayment.test.ts` → PASS (GREEN phase)

  **Automated Verification:**
  ```bash
  # Agent verifies mortgage tests still pass:
  npm test -- --reporter=verbose src/lib/engine/mortgage.test.ts 2>&1 | grep "26 passed"
  # Assert: 26 passed
  
  # Agent verifies initialTotalPayment tests now pass (GREEN):
  npm test -- src/lib/engine/initialTotalPayment.test.ts 2>&1 | grep "passed"
  # Assert: Tests pass (was failing before)
  
  # Agent verifies characterization tests:
  npm test -- src/lib/engine/characterization.test.ts 2>&1 | grep "passed"
  # Assert: Characterization tests still pass
  ```

  **Evidence to Capture:**
  - [ ] 26 mortgage tests passing
  - [ ] initialTotalPayment tests now passing (TDD GREEN)
  - [ ] Characterization tests confirming no behavior change

  **Commit**: YES
  - Message: `refactor(engine): mortgage.ts uses schedule-core helpers, add initialTotalPayment`
  - Files: `src/lib/engine/mortgage.ts`
  - Pre-commit: `npm test`

---

### Task 5: Refactor rate-simulation.ts to Use schedule-core

- [x] 5. Update rate-simulation.ts to use extracted helpers and consolidate reinvest functions

  **What to do**:
  - Import helpers from schedule-core.ts
  - Replace duplicated code in calculateReinvestSchedule() and calculateBudgetReinvestSchedule()
  - Consider consolidating the two reinvest functions into one with a parameter
  - Add `initialTotalPayment` to Schedule.summary outputs
  - Ensure all 37 rate-simulation tests still pass

  **Must NOT do**:
  - Don't change function signatures of exported functions
  - Don't change any behavior - only code structure
  - Don't remove calculateReinvestSchedule even if it becomes a wrapper

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
    - Reason: Straightforward refactoring with clear patterns
  - **Skills**: []
    - No special skills needed
  - **Skills Evaluated but Omitted**:
    - All skills unrelated to this task

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Task 4)
  - **Blocks**: Task 6
  - **Blocked By**: Tasks 2, 3

  **References**:

  **Pattern References**:
  - `src/lib/engine/schedule-core.ts` - Helpers to import
  - `src/lib/engine/rate-simulation.ts:35-146` - calculateReinvestSchedule to refactor
  - `src/lib/engine/rate-simulation.ts:203-316` - calculateBudgetReinvestSchedule (nearly identical)

  **API/Type References**:
  - `src/lib/engine/types.ts:Schedule.summary` - Already has initialTotalPayment from Task 4

  **Test References**:
  - `src/lib/engine/rate-simulation.test.ts` - All 37 tests must still pass

  **WHY Each Reference Matters**:
  - Lines 35-146 and 203-316 are the two nearly identical functions to consolidate
  - Difference: Budget version uses `currentBudget` parameter while regular version calculates from schedule
  - Consider: one function with optional budget parameter

  **Acceptance Criteria**:

  **TDD (tests enabled):**
  - [ ] rate-simulation.ts imports from schedule-core.ts
  - [ ] Duplicated code eliminated or significantly reduced
  - [ ] `npm test src/lib/engine/rate-simulation.test.ts` → PASS (37 tests)

  **Automated Verification:**
  ```bash
  # Agent verifies rate-simulation tests still pass:
  npm test -- --reporter=verbose src/lib/engine/rate-simulation.test.ts 2>&1 | grep "37 passed"
  # Assert: 37 passed
  
  # Agent verifies all tests pass:
  npm test 2>&1 | grep -E "passed"
  # Assert: All tests passing
  ```

  **Evidence to Capture:**
  - [ ] 37 rate-simulation tests passing
  - [ ] Code reduction visible in file (fewer lines)

  **Commit**: YES
  - Message: `refactor(engine): rate-simulation.ts uses schedule-core, consolidate reinvest functions`
  - Files: `src/lib/engine/rate-simulation.ts`
  - Pre-commit: `npm test`

---

### Task 6: Final Verification and Cleanup

- [x] 6. Run final verification and clean up characterization tests

  **What to do**:
  - Run full test suite to confirm all tests pass
  - Use ast_grep_search to verify no duplication patterns remain
  - Optionally: Remove characterization.test.ts (served its purpose) or keep for regression
  - Verify npm run build succeeds
  - Run linter if configured

  **Must NOT do**:
  - Don't introduce new features
  - Don't optimize beyond what was planned

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Verification tasks, low complexity
  - **Skills**: []
    - No special skills needed
  - **Skills Evaluated but Omitted**:
    - All skills unrelated to verification

  **Parallelization**:
  - **Can Run In Parallel**: NO (final task)
  - **Parallel Group**: Wave 4 (solo)
  - **Blocks**: None
  - **Blocked By**: Tasks 4, 5

  **References**:

  **Pattern References**:
  - All engine files after refactoring

  **Test References**:
  - All test files

  **WHY Each Reference Matters**:
  - Final verification ensures refactoring is complete

  **Acceptance Criteria**:

  **Automated Verification:**
  ```bash
  # Agent runs full test suite:
  npm test 2>&1 | grep -E "passed|failed"
  # Assert: All tests pass, 0 failures
  
  # Agent runs build:
  npm run build 2>&1 | grep -q "error" && echo "BUILD_FAIL" || echo "BUILD_OK"
  # Assert: BUILD_OK
  
  # Agent searches for remaining duplication (yearly overpayment pattern):
  ast_grep_search pattern="month % 12 === $VAR % 12" lang="typescript"
  # Assert: Only appears in schedule-core.ts (or max 2 places)
  ```

  **Evidence to Capture:**
  - [ ] Full test output showing all tests pass
  - [ ] Build success
  - [ ] Duplication search results

  **Commit**: YES (if characterization tests removed) or NO (if kept)
  - Message: `chore(engine): remove characterization tests after successful refactor`
  - Files: `src/lib/engine/characterization.test.ts` (deletion)
  - Pre-commit: `npm test`

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 1 | `test(engine): add characterization tests before refactoring` | characterization.test.ts | npm test |
| 2 | `test(engine): add failing tests for initialTotalPayment [TDD RED]` | types.ts, initialTotalPayment.test.ts | npx tsc |
| 3 | `feat(engine): extract shared helpers to schedule-core.ts` | schedule-core.ts, schedule-core.test.ts | npm test |
| 4 | `refactor(engine): mortgage.ts uses schedule-core helpers, add initialTotalPayment` | mortgage.ts | npm test |
| 5 | `refactor(engine): rate-simulation.ts uses schedule-core, consolidate reinvest functions` | rate-simulation.ts | npm test |
| 6 | (optional) `chore(engine): remove characterization tests after successful refactor` | characterization.test.ts | npm test |

---

## Success Criteria

### Verification Commands
```bash
# Full test suite
npm test                     # Expected: All tests pass (73 existing + ~15 new)

# Build check
npm run build                # Expected: No errors

# Type check
npx tsc --noEmit             # Expected: No errors

# Duplication check (should be minimal)
ast_grep_search "month % 12 === $VAR % 12" typescript  # Expected: 1-2 occurrences only
```

### Final Checklist
- [x] All "Must Have" present:
  - [x] 150 tests pass (73 existing + 77 new)
  - [x] initialTotalPayment in Schedule.summary
  - [x] Public API unchanged
  - [x] TDD workflow followed (RED → GREEN)
- [x] All "Must NOT Have" absent:
  - [x] No changes to golden-mean.ts
  - [x] No changes to ScheduleRow structure
  - [x] No behavioral changes (characterization tests confirm)
  - [x] No scope creep
- [x] Code duplication reduced (~90 lines eliminated)
- [x] New schedule-core.ts module created

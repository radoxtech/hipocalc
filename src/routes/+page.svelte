<script lang="ts">
  import { browser } from '$app/environment';
  import Decimal from 'decimal.js';
  import { VintageCard, VintageInput, VintageButton, VintageSelect, SectionDivider, BankSeal } from '$lib/components';
  import { BalanceChart, SavingsChart, ScenarioComparison } from '$lib/components/charts';
  import { generateAmortizationSchedule, calculateAnnuityPayment } from '$lib/engine/mortgage';
  import { calculateGoldenMean } from '$lib/engine/golden-mean';
  import { 
    generateScheduleForRate as generateScheduleForRateFromModule,
    pray as prayFromModule,
    sin as sinFromModule,
    type RateSimulationInput 
  } from '$lib/engine/rate-simulation';
  import type { Loan, Overpayments, Schedule, ScheduleRow, Strategy } from '$lib/engine/types';
  import type { GoldenMeanInput, GoldenMeanOutput } from '$lib/engine/golden-mean';

  // Storage keys
  const STORAGE_KEY = 'hipocalc_form_data';
  const THEME_STORAGE_KEY = 'hipocalc_theme';

  // Form state
  let principal = $state('300000');
  let years = $state('30');
  let months = $state('360');
  let rate = $state('7.5');
  let loanType = $state<'annuity' | 'decreasing'>('annuity');
  let monthlyOverpayment = $state('500');
  let yearlyOverpayment = $state('0');
  let yearlyMonth = $state('12');
  let durationMode = $state<'years' | 'months'>('years');
  let annualRaisePercent = $state('0');

  // Theme state
  let theme = $state<'light' | 'dark'>('light');

   // Duration mode helpers
   const durationValue = $derived(durationMode === 'years' ? years : months);
   
   function handleDurationInput(value: string) {
     if (durationMode === 'years') {
       years = value;
     } else {
       months = value;
     }
   }

   // Złoty Środek state
   let showGoldenMean = $state(false);
   let netIncome = $state('');
   let fixedExpenses = $state('');
   let emergencyStatus = $state<'have' | 'build-fast' | 'build-slow-3y'>('have');
   let emergencyFundMonths = $state('6');

     // Pagination state
     let currentPage = $state(1);
     const rowsPerPage = 50;

    // Load saved form data on mount (browser only)
    if (browser) {
        try {
          const saved = localStorage.getItem(STORAGE_KEY);
          if (saved) {
            const data = JSON.parse(saved);
            principal = data.principal ?? principal;
            years = data.years ?? years;
            months = data.months ?? months;
            rate = data.rate ?? rate;
            loanType = data.loanType ?? loanType;
            monthlyOverpayment = data.monthlyOverpayment ?? monthlyOverpayment;
            yearlyOverpayment = data.yearlyOverpayment ?? yearlyOverpayment;
            yearlyMonth = data.yearlyMonth ?? yearlyMonth;
            netIncome = data.netIncome ?? netIncome;
            fixedExpenses = data.fixedExpenses ?? fixedExpenses;
            emergencyStatus = data.emergencyStatus ?? emergencyStatus;
            emergencyFundMonths = data.emergencyFundMonths ?? emergencyFundMonths;
            durationMode = data.durationMode ?? durationMode;
            annualRaisePercent = data.annualRaisePercent ?? annualRaisePercent;
          }
        } catch {
          // Ignore storage errors
        }

     // Load theme preference
     try {
       const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
       if (savedTheme === 'light' || savedTheme === 'dark') {
         theme = savedTheme;
       } else if (savedTheme === 'auto') {
         // Migrate old 'auto' to system preference
         theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
       }
       applyTheme(theme);
     } catch {
       // Ignore storage errors
     }
   }

   // Two-way sync: years → months
   $effect(() => {
     if (document.activeElement?.getAttribute('name') !== 'months') {
       const y = parseFloat(years);
       if (!isNaN(y) && y >= 0) {
         months = String(Math.round(y * 12));
       }
     }
   });

   // Two-way sync: months → years
   $effect(() => {
     if (document.activeElement?.getAttribute('name') !== 'years') {
       const m = parseFloat(months);
       if (!isNaN(m) && m > 0) {
         years = String((m / 12).toFixed(2));
       }
     }
   });

     // Save form data to localStorage whenever values change
      function saveFormData() {
        if (!browser) return;
        try {
          const data = {
            principal,
            years,
            months,
            rate,
            loanType,
            monthlyOverpayment,
            yearlyOverpayment,
            yearlyMonth,
            netIncome,
            fixedExpenses,
            emergencyStatus,
            emergencyFundMonths,
            durationMode,
            annualRaisePercent
          };
          localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        } catch {
          // Ignore storage errors
        }
      }

  // Apply theme to document
  function applyTheme(selectedTheme: 'light' | 'dark') {
    if (!browser) return;
    const html = document.documentElement;
    html.setAttribute('data-theme', selectedTheme);
  }

   // Toggle theme: light <-> dark
   function toggleTheme() {
     theme = theme === 'light' ? 'dark' : 'light';
     try {
       localStorage.setItem(THEME_STORAGE_KEY, theme);
     } catch {
       // Ignore storage errors
     }
   }

   // Ensure theme is applied whenever it changes
   $effect(() => {
     if (browser) {
       applyTheme(theme);
     }
   });

      // Watch all form fields and save when they change
      $effect(() => {
        // Access all reactive state to track dependencies
        principal; years; months; rate; loanType; monthlyOverpayment;
        yearlyOverpayment; yearlyMonth; netIncome; fixedExpenses; emergencyStatus; emergencyFundMonths;
        durationMode;
        saveFormData();
      });
  let goldenMeanResult = $state<GoldenMeanOutput | null>(null);

   // Results state
    let scheduleNone = $state<Schedule | null>(null);
    let scheduleShortenTerm = $state<Schedule | null>(null);
    let scheduleReducePayment = $state<Schedule | null>(null);
     let scheduleShortenTermReinvest = $state<Schedule | null>(null);
     let hasCalculated = $state(false);
     let activeTab = $state<'comparison' | 'balance' | 'savings' | 'schedule'>('comparison');
     let selectedScheduleStrategy = $state<'none' | 'reduce' | 'reduce-plus' | 'shorten'>('reduce-plus');

     // Modlitwa o Spadek Stóp state
     let showPrayerSection = $state(false);
     let prayerStrategy = $state<'none' | 'reduce' | 'reduce-plus' | 'shorten'>('reduce-plus');
     let lastPrayerStrategy = $state<'none' | 'reduce' | 'reduce-plus' | 'shorten'>('reduce-plus');
     let prayerResult = $state<{
       type: 'prayer' | 'sin';
       level: 1 | 2 | 3;
       schedule: Schedule;
       originalInterest: Decimal;
       newInterest: Decimal;
       difference: Decimal;
       newRate: number;
     } | null>(null);

     // Recalculate prayer result when strategy changes
     $effect(() => {
       if (prayerResult && hasCalculated && prayerStrategy !== lastPrayerStrategy) {
         lastPrayerStrategy = prayerStrategy;
         const currentType = prayerResult.type;
         const currentLevel = prayerResult.level;
         if (currentType === 'prayer') {
           pray(currentLevel);
         } else {
           sin(currentLevel);
         }
       }
     });

     function getScheduleForStrategy(strategy: 'none' | 'reduce' | 'reduce-plus' | 'shorten'): Schedule | null {
       switch (strategy) {
         case 'none': return scheduleNone;
         case 'reduce': return scheduleReducePayment;
         case 'reduce-plus': return scheduleShortenTermReinvest;
         case 'shorten': return scheduleShortenTerm;
         default: return scheduleShortenTermReinvest;
       }
     }

     function buildRateSimulationInput(): RateSimulationInput {
       const m = durationMode === 'years' ? Math.round(parseFloat(years) * 12) : Math.round(parseFloat(months));
       const originalPayment = scheduleNone?.rows[0]?.payment || new Decimal(0);
       
       return {
         principal: new Decimal(principal),
         currentRate: parseFloat(rate),
         months: m,
         loanType: loanType,
         monthlyOverpayment: new Decimal(monthlyOverpayment || '0'),
         yearlyOverpayment: new Decimal(yearlyOverpayment || '0'),
         yearlyMonth: parseInt(yearlyMonth) || 12,
         strategy: prayerStrategy,
         originalMonthlyPayment: originalPayment,
         annualRaisePercent: parseFloat(annualRaisePercent) || 0
       };
     }

     function pray(level: 1 | 2 | 3) {
       const input = buildRateSimulationInput();
       const result = prayFromModule(input, level);
       const newRate = Math.max(0.1, input.currentRate - level);
       
       prayerResult = {
         type: 'prayer',
         level,
         schedule: result.newResult.schedule,
         originalInterest: result.originalResult.totalInterest,
         newInterest: result.newResult.totalInterest,
         difference: result.interestDifference,
         newRate
       };
     }

     function sin(level: 1 | 2 | 3) {
       const input = buildRateSimulationInput();
       const result = sinFromModule(input, level);
       const newRate = input.currentRate + level;
       
       prayerResult = {
         type: 'sin',
         level,
         schedule: result.newResult.schedule,
         originalInterest: result.originalResult.totalInterest,
         newInterest: result.newResult.totalInterest,
         difference: result.interestDifference.abs(),
         newRate
       };
     }

  // Validation
  let errors = $state<Record<string, string>>({});

   function validateInputs(): boolean {
     errors = {};

     const principalNum = parseFloat(principal);
     if (!principal || isNaN(principalNum) || principalNum <= 0) {
       errors.principal = 'Wprowadź kwotę kredytu większą od 0';
     }

     const monthsNum = parseFloat(months);
     if (!months || isNaN(monthsNum) || monthsNum < 1) {
       errors.months = 'Okres musi wynosić co najmniej 1 miesiąc';
     } else if (monthsNum > 600) {
       errors.months = 'Okres nie może być większy niż 600 miesięcy (50 lat)';
     }

     const rateNum = parseFloat(rate);
     if (!rate || isNaN(rateNum) || rateNum < 0 || rateNum > 30) {
       errors.rate = 'Oprocentowanie musi być między 0% a 30%';
     }

     return Object.keys(errors).length === 0;
   }

    function calculateShortenTermReinvest(loan: Loan, baseSchedule: Schedule, baseOverpayments: Overpayments, scheduleWithoutOverpayment: Schedule): Schedule {
      const rows: ScheduleRow[] = [];
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
      
      const annualRaise = baseOverpayments.annualRaisePercent || 0;
      let currentMonthlyOverpayment = baseOverpayments.monthly;

      while (balance.greaterThan(0.01) && month < loan.months * 2) {
        month++;
        
        // Apply annual raise at the start of each year
        if (month > 1 && month % 12 === 1 && annualRaise > 0) {
          currentMonthlyOverpayment = currentMonthlyOverpayment.times(1 + annualRaise / 100);
        }
        
        // 1. Calculate interest on current balance
        const interest = balance.times(monthlyRate);
        totalInterest = totalInterest.plus(interest);

        // 2. Calculate payment based on loan type
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

        // 3. Apply payment to balance
        balance = balance.minus(principalPart);

        // 4. Calculate overpayment with reinvestment
        let overpayment = currentMonthlyOverpayment;
        
        // Add yearly overpayment if applicable
        if (month % 12 === baseOverpayments.yearlyMonth % 12 || 
            (baseOverpayments.yearlyMonth === 12 && month % 12 === 0)) {
          overpayment = overpayment.plus(baseOverpayments.yearly);
        }

        // REINVEST LOGIC: Add the savings from interest difference
        // Savings = payment without overpayment - payment with overpayment
        if (month <= scheduleWithoutOverpayment.rows.length) {
          const paymentWithoutOverpayment = scheduleWithoutOverpayment.rows[month - 1]?.payment || new Decimal(0);
          const savingsThisMonth = paymentWithoutOverpayment.minus(payment);
          
          if (savingsThisMonth.greaterThan(0)) {
            overpayment = overpayment.plus(savingsThisMonth);
          }
        }

        // Cap overpayment to remaining balance
        if (overpayment.greaterThan(balance)) {
          overpayment = balance;
        }

        // Apply overpayment
        balance = balance.minus(overpayment);
        totalOverpayments = totalOverpayments.plus(overpayment);

        // Record row
        const row: ScheduleRow = {
          month,
          payment,
          principal: principalPart,
          interest,
          overpayment,
          totalPaid: payment.plus(overpayment),
          balanceAfter: balance
        };

        rows.push(row);
        totalPaid = totalPaid.plus(row.totalPaid);

        // Exit if balance is effectively zero
        if (balance.lessThanOrEqualTo(0.01)) {
          break;
        }
      }

      return {
        rows,
        summary: {
          totalMonths: rows.length,
          totalPaid,
          totalInterest,
          totalOverpayments
        }
      };
    }

    function calculate() {
      if (!validateInputs()) return;

      const loan: Loan = {
        principal: new Decimal(principal),
        annualRate: new Decimal(rate).dividedBy(100),
        months: Math.round(parseFloat(months)),
        type: loanType
      };

      const overpayments: Overpayments = {
        monthly: new Decimal(monthlyOverpayment || '0'),
        yearly: new Decimal(yearlyOverpayment || '0'),
        yearlyMonth: parseInt(yearlyMonth) || 12,
        annualRaisePercent: parseFloat(annualRaisePercent) || 0
      };

      const noOverpayments: Overpayments = {
        monthly: new Decimal(0),
        yearly: new Decimal(0),
        yearlyMonth: 12
      };

      scheduleNone = generateAmortizationSchedule(loan, noOverpayments, 'none');
      scheduleShortenTerm = generateAmortizationSchedule(loan, overpayments, 'shorten-term');
      scheduleReducePayment = generateAmortizationSchedule(loan, overpayments, 'reduce-payment');
      
      // Generate reinvest schedule if needed
      if (scheduleNone) {
        scheduleShortenTermReinvest = calculateShortenTermReinvest(loan, scheduleShortenTerm, overpayments, scheduleNone);
      }
      
      hasCalculated = true;
    }

   function calculateGoldenMeanResult() {
     if (!netIncome || !fixedExpenses) return;

     const currentPayment = scheduleNone
       ? scheduleNone.rows[0]?.payment || new Decimal(0)
       : new Decimal(0);

     const input: GoldenMeanInput = {
       netIncome: new Decimal(netIncome),
       fixedExpenses: new Decimal(fixedExpenses),
       mortgagePayment: currentPayment,
       emergencyFundMonths: parseInt(emergencyFundMonths) || 6,
       emergencyFundStatus: emergencyStatus
     };

     goldenMeanResult = calculateGoldenMean(input);
   }

   function applyGoldenMeanRecommendation() {
     if (goldenMeanResult) {
       monthlyOverpayment = goldenMeanResult.recommendedOverpayment.toDecimalPlaces(0).toString();
       calculate();
     }
   }

     // Pagination derived value (uses selected strategy)
     const paginatedSchedule = $derived.by(() => {
       let schedule: Schedule | null = null;
       switch (selectedScheduleStrategy) {
         case 'none': schedule = scheduleNone; break;
         case 'reduce': schedule = scheduleReducePayment; break;
         case 'reduce-plus': schedule = scheduleShortenTermReinvest; break;
         case 'shorten': schedule = scheduleShortenTerm; break;
       }
       
       if (!schedule) {
         return { rows: [], totalPages: 0, currentPage: 1 };
       }
       const start = (currentPage - 1) * rowsPerPage;
       const end = start + rowsPerPage;
       return {
         rows: schedule.rows.slice(start, end),
         totalPages: Math.ceil(schedule.rows.length / rowsPerPage),
         currentPage: currentPage
       };
     });

     // Reset page when schedule changes
     $effect(() => {
       if (scheduleShortenTermReinvest && scheduleShortenTermReinvest.rows.length > 0) {
         currentPage = 1;
       }
     });

     // Reset page when strategy changes
     $effect(() => {
       selectedScheduleStrategy;
       currentPage = 1;
     });

   const loanTypeOptions = [
     { value: 'annuity', label: 'Raty równe' },
     { value: 'decreasing', label: 'Raty malejące' }
   ];

   const scheduleStrategyOptions = [
     { value: 'none', label: 'Bez nadpłat' },
     { value: 'reduce', label: 'Zmniejsz ratę' },
     { value: 'reduce-plus', label: 'Zmniejsz ratę+' },
     { value: 'shorten', label: 'Skróć okres' }
   ];

   const emergencyOptions = [
    { value: 'have', label: 'Mam poduszkę' },
    { value: 'build-fast', label: 'Buduję szybko (50% wolnej puli na nadpłatę)' },
    { value: 'build-slow-3y', label: 'Buduję powoli (15% wolnej puli na nadpłatę)' }
  ];

  const monthOptions = Array.from({ length: 12 }, (_, i) => ({
    value: String(i + 1),
    label: ['Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
            'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'][i]
  }));

   function formatCurrency(value: Decimal | number): string {
     const num = typeof value === 'number' ? value : value.toNumber();
     return num.toLocaleString('pl-PL', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
   }

   function getPaymentDate(monthOffset: number): string {
     const date = new Date();
     date.setMonth(date.getMonth() + monthOffset);
     const monthNames = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'];
     return `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
   }

   function getEndYear(totalMonths: number): number {
     const date = new Date();
     date.setMonth(date.getMonth() + totalMonths);
     return date.getFullYear();
   }

  // Theme icon components (SVG)
  const SunIcon = () => `<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><circle cx="10" cy="10" r="3"/><g stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="10" y1="1" x2="10" y2="3"/><line x1="10" y1="17" x2="10" y2="19"/><line x1="19" y1="10" x2="17" y2="10"/><line x1="3" y1="10" x2="1" y2="10"/><line x1="16.657" y1="3.343" x2="15.243" y2="4.757"/><line x1="4.757" y1="15.243" x2="3.343" y2="16.657"/><line x1="16.657" y1="16.657" x2="15.243" y2="15.243"/><line x1="4.757" y1="4.757" x2="3.343" y2="3.343"/></g></svg>`;
  
  const MoonIcon = () => `<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"/></svg>`;
  
  const AutoIcon = () => `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="2"/><path d="M10 2 A8 8 0 0 1 10 18 Z" fill="currentColor"/></svg>`;
</script>

<svelte:head>
  <title>HipoCalc - Kalkulator Nadpłaty Kredytu Hipotecznego</title>
</svelte:head>

<div class="calculator">
  <!-- Header -->
  <header class="calculator__header">
    <BankSeal size="md" />
    <div class="calculator__header-text">
      <h1>HipoCalc</h1>
      <p class="calculator__subtitle">Kalkulator Nadpłaty Kredytu Hipotecznego</p>
    </div>
    <button
      class="calculator__theme-toggle"
      onclick={toggleTheme}
      aria-label={`Theme: ${theme} (Click to cycle)`}
      title={`Current: ${theme} - Click to toggle`}
    >
      {#if theme === 'light'}
        {@html SunIcon()}
      {:else}
        {@html MoonIcon()}
      {/if}
    </button>
  </header>

  <main class="calculator__main">
    <!-- Construction Banner -->
    <div class="calculator__construction-banner">
      <p>⚠️ Kalkulator w fazie testów - wyniki mogą być niedokładne</p>
    </div>

    <!-- Step 1: Loan Data -->
    <VintageCard title="Krok 1: Dane kredytu" variant="highlight">
      <form class="calculator__form" onsubmit={(e) => { e.preventDefault(); calculate(); }}>
        <div class="calculator__form-grid">
           <VintageInput
             label="Pozostały kapitał do spłaty"
             name="principal"
             type="number"
             bind:value={principal}
             suffix="zł"
             error={errors.principal}
             required
             min={1000}
           />

            <div class="calculator__input-group calculator__input-group--with-toggle">
              <VintageInput
                label="Pozostało do spłaty"
                name="duration"
                type="number"
                value={durationValue}
                oninput={(e) => handleDurationInput((e.currentTarget as HTMLInputElement).value)}
                hint={durationMode === 'years' ? 'Liczba lat' : 'Liczba miesięcy'}
                error={errors.months}
                required
                min={1}
                step={1}
              />
              <button
                type="button"
                class="calculator__duration-toggle"
                onclick={() => {
                  if (durationMode === 'years') {
                    durationMode = 'months';
                  } else {
                    durationMode = 'years';
                  }
                }}
                title={`Przełącz na ${durationMode === 'years' ? 'miesiące' : 'lata'}`}
              >
                {durationMode === 'years' ? 'lata' : 'miesiące'}
              </button>
            </div>

           <VintageInput
             label="Oprocentowanie roczne"
             name="rate"
             type="number"
             bind:value={rate}
             suffix="%"
             error={errors.rate}
             step={0.01}
             required
             min={0}
             max={30}
           />

          <VintageSelect
            label="Typ rat"
            name="loanType"
            options={loanTypeOptions}
            bind:value={loanType}
          />

          <VintageInput
            label="Nadpłata miesięczna"
            name="monthlyOverpayment"
            type="number"
            bind:value={monthlyOverpayment}
            suffix="zł"
            hint="Stała nadpłata każdego miesiąca"
            min={0}
          />

          <VintageInput
            label="Nadpłata roczna"
            name="yearlyOverpayment"
            type="number"
            bind:value={yearlyOverpayment}
            suffix="zł"
            hint="Jednorazowa nadpłata raz w roku"
            min={0}
          />

          {#if parseFloat(yearlyOverpayment) > 0}
            <VintageSelect
              label="Miesiąc nadpłaty rocznej"
              name="yearlyMonth"
              options={monthOptions}
              bind:value={yearlyMonth}
            />
          {/if}
          
          <div class="calculator__slider-field">
            <label for="annualRaise">Podwyżka roczna nadpłaty: <strong>{annualRaisePercent}%</strong></label>
            <input 
              type="range" 
              id="annualRaise"
              name="annualRaise"
              min="0" 
              max="25" 
              step="1"
              bind:value={annualRaisePercent}
              class="calculator__slider"
            />
            <span class="calculator__slider-hint">Zwiększ nadpłatę co rok wraz z podwyżką w pracy</span>
          </div>
        </div>

        <div class="calculator__form-actions">
          <VintageButton type="submit" variant="primary" size="lg">
            Oblicz
          </VintageButton>
        </div>
      </form>
    </VintageCard>

    <!-- Golden Mean Banner -->
    {#if hasCalculated && !showGoldenMean}
      <button class="calculator__golden-banner" onclick={() => showGoldenMean = true}>
        <span class="calculator__golden-coin">
          <svg viewBox="0 0 100 100" width="48" height="48">
            <defs>
              <linearGradient id="coinGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#FFD700"/>
                <stop offset="50%" style="stop-color:#FFA500"/>
                <stop offset="100%" style="stop-color:#B8860B"/>
              </linearGradient>
              <linearGradient id="coinShine" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#FFFFFF;stop-opacity:0.6"/>
                <stop offset="50%" style="stop-color:#FFFFFF;stop-opacity:0"/>
              </linearGradient>
            </defs>
            <circle cx="50" cy="50" r="46" fill="url(#coinGradient)" stroke="#8B6914" stroke-width="3"/>
            <circle cx="50" cy="50" r="38" fill="none" stroke="#8B6914" stroke-width="1.5" opacity="0.5"/>
            <ellipse cx="35" cy="35" rx="20" ry="15" fill="url(#coinShine)"/>
            <text x="50" y="68" text-anchor="middle" font-size="48" font-weight="bold" fill="#8B6914" font-family="serif">$</text>
          </svg>
        </span>
        <span class="calculator__golden-banner-text">
          <strong>Wypróbuj Złoty Środek!</strong>
          <br />
          <small>Znajdź optymalną nadpłatę bez rezygnacji z przyjemności</small>
        </span>
        <span class="calculator__golden-banner-arrow">&#x2192;</span>
      </button>
    {/if}

    <!-- Step 2: Golden Mean (Optional) -->
    {#if showGoldenMean}
      <SectionDivider variant="ornate" />

      <VintageCard title="Krok 2: Złoty Środek" variant="default">
        <p class="calculator__golden-intro">
          Algorytm Złoty Środek pomoże Ci znaleźć optymalną nadpłatę, która nie odbije się na Twoim komforcie życia.
        </p>

        <div class="calculator__form-grid">
          <VintageInput
            label="Dochód netto miesięczny"
            name="netIncome"
            type="number"
            bind:value={netIncome}
            suffix="zł"
            required
            min={0}
          />

          <VintageInput
            label="Stałe wydatki miesięczne"
            name="fixedExpenses"
            type="number"
            bind:value={fixedExpenses}
            suffix="zł"
            hint="Bez kredytu i przyjemności (przyjemności = dowolne wydatki: jednorazowe zakupy, nowy samochód, podróże)"
            required
            min={0}
          />

          <VintageSelect
            label="Status poduszki bezpieczeństwa"
            name="emergencyStatus"
            options={emergencyOptions}
            bind:value={emergencyStatus}
          />

          {#if emergencyStatus !== 'have'}
            <VintageInput
              label="Poduszka bezpieczeństwa (miesiące)"
              name="emergencyFundMonths"
              type="number"
              bind:value={emergencyFundMonths}
              min={1}
              max={24}
              hint="Docelowa poduszka: koszty życia na X miesięcy"
            />
          {/if}
        </div>

        <div class="calculator__form-actions">
          <VintageButton onclick={calculateGoldenMeanResult} variant="secondary">
            Wylicz Złoty Środek
          </VintageButton>
        </div>

        {#if goldenMeanResult}
          <div class="calculator__golden-result">
            <h4>Rekomendacja Złotego Środka</h4>
            <div class="calculator__golden-result-grid">
              <div class="calculator__golden-stat">
                <span class="calculator__golden-stat-label">Zalecana nadpłata</span>
                <span class="calculator__golden-stat-value">
                  {formatCurrency(goldenMeanResult.recommendedOverpayment)} zł/mies.
                </span>
              </div>
              <div class="calculator__golden-stat">
                <span class="calculator__golden-stat-label">Budżet na przyjemności</span>
                <span class="calculator__golden-stat-value">
                  {formatCurrency(goldenMeanResult.discretionaryBudget)} zł/mies.
                </span>
              </div>
              {#if goldenMeanResult.emergencyContribution.greaterThan(0)}
                <div class="calculator__golden-stat">
                  <span class="calculator__golden-stat-label">Na poduszkę</span>
                  <span class="calculator__golden-stat-value">
                    {formatCurrency(goldenMeanResult.emergencyContribution)} zł/mies.
                  </span>
                </div>
              {/if}
            </div>
            <p class="calculator__golden-rationale">{goldenMeanResult.rationale}</p>
            {#if goldenMeanResult.warning}
              <p class="calculator__golden-warning">{goldenMeanResult.warning}</p>
            {/if}
            <VintageButton onclick={applyGoldenMeanRecommendation} variant="primary" size="sm">
              Zastosuj rekomendację
            </VintageButton>
          </div>
        {/if}
      </VintageCard>
    {/if}

    <!-- Results -->
    {#if hasCalculated && scheduleNone && scheduleShortenTerm && scheduleReducePayment && scheduleShortenTermReinvest}
      <SectionDivider variant="ornate" />

      <section class="calculator__results">
        <h2>Wyniki symulacji - 4 strategie spłaty</h2>

        <!-- Summary Table - 4 strategies -->
        <div class="calculator__results-table-wrapper">
          <table class="calculator__results-table">
            <thead>
              <tr>
                <th>Strategia</th>
                <th>Okres spłaty</th>
                <th>Koniec</th>
                <th>Suma odsetek</th>
                <th>Oszczędność</th>
              </tr>
            </thead>
            <tbody>
              <tr class="calculator__results-row calculator__results-row--none">
                <td class="calculator__strategy-name">
                  <strong>Bez nadpłat</strong>
                  <span class="calculator__strategy-hint">Spłata podstawowa</span>
                </td>
                <td>{Math.ceil(scheduleNone.summary.totalMonths / 12)} lat ({scheduleNone.summary.totalMonths} mies.)</td>
                <td>{getEndYear(scheduleNone.summary.totalMonths)}</td>
                <td>{formatCurrency(scheduleNone.summary.totalInterest)} zł</td>
                <td>—</td>
              </tr>
              <tr class="calculator__results-row calculator__results-row--reduce">
                <td class="calculator__strategy-name">
                  <strong>Zmniejsz ratę</strong>
                  <span class="calculator__strategy-hint">Niższe miesięczne obciążenie</span>
                </td>
                <td>{Math.ceil(scheduleReducePayment.summary.totalMonths / 12)} lat ({scheduleReducePayment.summary.totalMonths} mies.)</td>
                <td>{getEndYear(scheduleReducePayment.summary.totalMonths)}</td>
                <td>{formatCurrency(scheduleReducePayment.summary.totalInterest)} zł</td>
                <td class="calculator__savings">{formatCurrency(scheduleNone.summary.totalInterest.minus(scheduleReducePayment.summary.totalInterest))} zł</td>
              </tr>
              <tr class="calculator__results-row calculator__results-row--reinvest">
                <td class="calculator__strategy-name">
                  <strong>Zmniejsz ratę+ ⭐</strong>
                  <span class="calculator__strategy-hint calculator__strategy-hint--recommended" title="Zmniejszasz ratę ale nadpłacasz dalej tę samą kwotę. Efekt: spłacisz kredyt tak samo szybko jak przy skróceniu okresu, ale w razie utraty dochodu masz niższą ratę obowiązkową!">
                    Rekomendowana strategia 
                    <span class="calculator__info-icon">ⓘ</span>
                  </span>
                </td>
                <td>{Math.ceil(scheduleShortenTermReinvest.summary.totalMonths / 12)} lat ({scheduleShortenTermReinvest.summary.totalMonths} mies.)</td>
                <td>{getEndYear(scheduleShortenTermReinvest.summary.totalMonths)}</td>
                <td>{formatCurrency(scheduleShortenTermReinvest.summary.totalInterest)} zł</td>
                <td class="calculator__savings">{formatCurrency(scheduleNone.summary.totalInterest.minus(scheduleShortenTermReinvest.summary.totalInterest))} zł</td>
              </tr>
              <tr class="calculator__results-row calculator__results-row--shorten">
                <td class="calculator__strategy-name">
                  <strong>Skróć okres</strong>
                  <span class="calculator__strategy-hint">Rata stała, szybsza spłata</span>
                </td>
                <td>{Math.ceil(scheduleShortenTerm.summary.totalMonths / 12)} lat ({scheduleShortenTerm.summary.totalMonths} mies.)</td>
                <td>{getEndYear(scheduleShortenTerm.summary.totalMonths)}</td>
                <td>{formatCurrency(scheduleShortenTerm.summary.totalInterest)} zł</td>
                <td class="calculator__savings">{formatCurrency(scheduleNone.summary.totalInterest.minus(scheduleShortenTerm.summary.totalInterest))} zł</td>
              </tr>
            </tbody>
          </table>
          <div class="calculator__strategy-explanation">
            <p>
              <strong>💡 Dlaczego „Zmniejsz ratę+" jest najlepsza?</strong>
            </p>
            <p>
              Przykład: Twoja rata to 3000 zł, nadpłacasz 1000 zł miesięcznie. Po nadpłacie bank obniża ratę do 2800 zł.
              Ale Ty dalej wpłacasz 4000 zł (rata + nadpłata)! Skąd dodatkowe 200 zł? <strong>Z różnicy między starą a nową ratą.</strong>
              Kapitał spada szybciej → rata znów maleje → możesz nadpłacać jeszcze więcej. <strong>To efekt kuli śnieżnej!</strong>
            </p>
            <p>
              Efekt końcowy jest identyczny jak przy „Skróć okres", ale masz zabezpieczenie: 
              w razie utraty pracy Twoja <em>obowiązkowa</em> rata jest niska. 
              Przy skróceniu okresu rata zostaje wysoka – i musisz ją płacić bez względu na sytuację.
            </p>
            <p class="calculator__strategy-myth">
              ⚠️ <strong>Popularny mit:</strong> Wiele osób błędnie uważa, że „Skróć okres" jest korzystniejszy, 
              bo zapominają o reinwestowaniu zaoszczędzonej różnicy. Jeśli konsekwentnie wpłacasz tę samą kwotę, 
              obie strategie dają identyczny czas spłaty i oszczędności – ale „Zmniejsz ratę+" daje Ci elastyczność!
            </p>
          </div>
        </div>
         
         <!-- Tabs -->
        <div class="calculator__tabs" role="tablist">
          <button
            role="tab"
            aria-selected={activeTab === 'comparison'}
            class="calculator__tab"
            class:calculator__tab--active={activeTab === 'comparison'}
            onclick={() => activeTab = 'comparison'}
          >
            Porównanie
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'balance'}
            class="calculator__tab"
            class:calculator__tab--active={activeTab === 'balance'}
            onclick={() => activeTab = 'balance'}
          >
            Saldo
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'savings'}
            class="calculator__tab"
            class:calculator__tab--active={activeTab === 'savings'}
            onclick={() => activeTab = 'savings'}
          >
            Oszczędności
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'schedule'}
            class="calculator__tab"
            class:calculator__tab--active={activeTab === 'schedule'}
            onclick={() => activeTab = 'schedule'}
          >
            Harmonogram
          </button>
        </div>

        <!-- Tab Panels -->
        <div class="calculator__tab-panel">
          {#if activeTab === 'comparison'}
            <ScenarioComparison
              {scheduleNone}
              {scheduleShortenTerm}
              {scheduleReducePayment}
              scheduleReducePlus={scheduleShortenTermReinvest}
            />
           {:else if activeTab === 'balance'}
             <BalanceChart schedule={scheduleShortenTermReinvest} title="Spadek salda - strategia zmniejsz ratę plus" />
           {:else if activeTab === 'savings'}
             <SavingsChart
               scheduleWithOverpayment={scheduleShortenTermReinvest}
               scheduleWithoutOverpayment={scheduleNone}
             />
           {:else if activeTab === 'schedule'}
             <VintageCard title="Harmonogram spłat">
               <div class="calculator__schedule-controls">
                 <VintageSelect
                   label="Strategia"
                   name="scheduleStrategy"
                   options={scheduleStrategyOptions}
                   bind:value={selectedScheduleStrategy}
                 />
               </div>
                <div class="calculator__schedule-table-wrapper">
                  <table class="calculator__schedule-table">
                    <thead>
                      <tr>
                        <th>Miesiąc</th>
                        <th>Data</th>
                        <th>Rata</th>
                        <th>Kapitał</th>
                        <th>Odsetki</th>
                        <th>Nadpłata</th>
                        <th>Saldo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {#each paginatedSchedule.rows as row}
                        <tr>
                          <td>{row.month}</td>
                          <td>{getPaymentDate(row.month)}</td>
                          <td>{formatCurrency(row.payment)} zł</td>
                          <td>{formatCurrency(row.principal)} zł</td>
                          <td>{formatCurrency(row.interest)} zł</td>
                          <td>{formatCurrency(row.overpayment)} zł</td>
                          <td>{formatCurrency(row.balanceAfter)} zł</td>
                        </tr>
                      {/each}
                    </tbody>
                  </table>
                </div>
               {#if paginatedSchedule.totalPages > 1}
                 <div class="calculator__pagination">
                   <button 
                     class="calculator__pagination-btn" 
                     onclick={() => currentPage = Math.max(1, currentPage - 1)}
                     disabled={currentPage === 1}
                   >
                     ← Poprzednia
                   </button>
                   <span class="calculator__pagination-info">
                     Strona {currentPage} z {paginatedSchedule.totalPages}
                   </span>
                   <button 
                     class="calculator__pagination-btn" 
                     onclick={() => currentPage = Math.min(paginatedSchedule.totalPages, currentPage + 1)}
                     disabled={currentPage === paginatedSchedule.totalPages}
                   >
                     Następna →
                   </button>
                 </div>
               {/if}
            </VintageCard>
          {/if}
        </div>
      </section>
    {/if}

    <!-- Modlitwa o Spadek Stóp - Banner -->
    {#if hasCalculated && !showPrayerSection}
      <button 
        class="calculator__prayer-banner"
        onclick={() => showPrayerSection = true}
      >
        <span class="calculator__prayer-banner-icon">🙏</span>
        <span class="calculator__prayer-banner-text">
          <strong>Modlitwa o Spadek Stóp</strong>
          <br />
          <small>Sprawdź jak zmiana oprocentowania wpłynie na Twój kredyt</small>
        </span>
        <span class="calculator__prayer-banner-arrow">&#x2192;</span>
      </button>
    {/if}

    <!-- Modlitwa o Spadek Stóp - Expanded Section -->
    {#if hasCalculated && showPrayerSection}
      <SectionDivider variant="ornate" />
      
      <section class="calculator__prayer">
        <VintageCard title="🙏 Modlitwa o Spadek Stóp" variant="default">
          <p class="calculator__prayer-intro">
            Obecne oprocentowanie: <strong>{rate}%</strong>. Wybierz strategię i sprawdź wpływ zmiany stóp.
          </p>

          <div class="calculator__prayer-strategy">
            <label class="calculator__prayer-strategy-label">Strategia spłaty:</label>
            <div class="calculator__prayer-strategy-buttons">
              <button 
                class="calculator__prayer-strategy-btn"
                class:active={prayerStrategy === 'none'}
                onclick={() => prayerStrategy = 'none'}
              >Bez nadpłat</button>
              <button 
                class="calculator__prayer-strategy-btn"
                class:active={prayerStrategy === 'reduce'}
                onclick={() => prayerStrategy = 'reduce'}
              >Zmniejsz ratę</button>
              <button 
                class="calculator__prayer-strategy-btn"
                class:active={prayerStrategy === 'reduce-plus'}
                onclick={() => prayerStrategy = 'reduce-plus'}
              >Zmniejsz ratę+ ⭐</button>
              <button 
                class="calculator__prayer-strategy-btn"
                class:active={prayerStrategy === 'shorten'}
                onclick={() => prayerStrategy = 'shorten'}
              >Skróć okres</button>
            </div>
          </div>

          <div class="calculator__prayer-buttons">
            <p class="calculator__prayer-label">🙏 Wybierz moc modlitwy:</p>
            <div class="calculator__prayer-group">
              <button class="calculator__prayer-btn calculator__prayer-btn--prayer" onclick={() => pray(1)}>
                Modlitwa Grzesznika<br/><small>-1% → {Math.max(0.1, parseFloat(rate) - 1).toFixed(1)}%</small>
              </button>
              <button class="calculator__prayer-btn calculator__prayer-btn--prayer" onclick={() => pray(2)}>
                Modlitwa Wiernego<br/><small>-2% → {Math.max(0.1, parseFloat(rate) - 2).toFixed(1)}%</small>
              </button>
              <button class="calculator__prayer-btn calculator__prayer-btn--prayer" onclick={() => pray(3)}>
                Modlitwa Świętego<br/><small>-3% → {Math.max(0.1, parseFloat(rate) - 3).toFixed(1)}%</small>
              </button>
            </div>
          </div>

          {#if prayerResult && prayerResult.type === 'prayer'}
            <div class="calculator__prayer-result calculator__prayer-result--prayer">
              <h4>🙏 Wynik modlitwy ({prayerResult.level === 1 ? 'Grzesznika' : prayerResult.level === 2 ? 'Wiernego' : 'Świętego'})</h4>
              <div class="calculator__prayer-result-grid">
                <div class="calculator__prayer-stat">
                  <span class="calculator__prayer-stat-label">Nowe oprocentowanie</span>
                  <span class="calculator__prayer-stat-value">{prayerResult.newRate.toFixed(1)}%</span>
                </div>
                <div class="calculator__prayer-stat">
                  <span class="calculator__prayer-stat-label">Suma odsetek</span>
                  <span class="calculator__prayer-stat-value">
                    {prayerResult.newInterest.toDecimalPlaces(0).toNumber().toLocaleString('pl-PL')} zł
                  </span>
                </div>
                <div class="calculator__prayer-stat">
                  <span class="calculator__prayer-stat-label">Oszczędzisz</span>
                  <span class="calculator__prayer-stat-value calculator__prayer-stat-value--prayer">
                    {prayerResult.difference.toDecimalPlaces(0).toNumber().toLocaleString('pl-PL')} zł
                  </span>
                </div>
                <div class="calculator__prayer-stat">
                  <span class="calculator__prayer-stat-label">Okres spłaty</span>
                  <span class="calculator__prayer-stat-value">
                    {prayerResult.schedule.summary.totalMonths} mies. ({getEndYear(prayerResult.schedule.summary.totalMonths)})
                  </span>
                </div>
              </div>
            </div>
          {/if}

          {#if prayerResult && prayerResult.type === 'sin'}
            <div class="calculator__prayer-result calculator__prayer-result--sin">
              <h4>😈 Skutki grzechu ({prayerResult.level === 1 ? 'Grzesznik' : prayerResult.level === 2 ? 'Grzesznik+' : 'Premium'})</h4>
              <div class="calculator__prayer-result-grid">
                <div class="calculator__prayer-stat">
                  <span class="calculator__prayer-stat-label">Nowe oprocentowanie</span>
                  <span class="calculator__prayer-stat-value">{prayerResult.newRate.toFixed(1)}%</span>
                </div>
                <div class="calculator__prayer-stat">
                  <span class="calculator__prayer-stat-label">Suma odsetek</span>
                  <span class="calculator__prayer-stat-value">
                    {prayerResult.newInterest.toDecimalPlaces(0).toNumber().toLocaleString('pl-PL')} zł
                  </span>
                </div>
                <div class="calculator__prayer-stat">
                  <span class="calculator__prayer-stat-label">Stracisz</span>
                  <span class="calculator__prayer-stat-value calculator__prayer-stat-value--sin">
                    {prayerResult.difference.toDecimalPlaces(0).toNumber().toLocaleString('pl-PL')} zł
                  </span>
                </div>
                <div class="calculator__prayer-stat">
                  <span class="calculator__prayer-stat-label">Okres spłaty</span>
                  <span class="calculator__prayer-stat-value">
                    {prayerResult.schedule.summary.totalMonths} mies. ({getEndYear(prayerResult.schedule.summary.totalMonths)})
                  </span>
                </div>
              </div>
            </div>
          {/if}

          {#if prayerResult}
            <div class="calculator__prayer-buttons calculator__prayer-buttons--sin">
              <p class="calculator__prayer-label">😈 Sprawdź co będzie gdy będziesz za dużo grzeszyć:</p>
              <div class="calculator__prayer-group">
                <button class="calculator__prayer-btn calculator__prayer-btn--sin" onclick={() => sin(1)}>
                  Grzesznik<br/><small>+1% → {(parseFloat(rate) + 1).toFixed(1)}%</small>
                </button>
                <button class="calculator__prayer-btn calculator__prayer-btn--sin" onclick={() => sin(2)}>
                  Grzesznik+<br/><small>+2% → {(parseFloat(rate) + 2).toFixed(1)}%</small>
                </button>
                <button class="calculator__prayer-btn calculator__prayer-btn--sin" onclick={() => sin(3)}>
                  Grzesznik Premium<br/><small>+3% → {(parseFloat(rate) + 3).toFixed(1)}%</small>
                </button>
              </div>
            </div>
          {/if}
        </VintageCard>
      </section>
    {/if}
  </main>

  <!-- Footer -->
  <footer class="calculator__footer">
    <p>
      HipoCalc {__APP_VERSION__} &copy; 2025 | 
      <a href="https://github.com/radoxtech/hipocalc" target="_blank" rel="noopener">
        Kod źródłowy na GitHub
      </a>
    </p>
    <p class="calculator__footer-disclaimer">
      Kalkulator ma charakter informacyjny. Skonsultuj decyzje finansowe z doradcą.
    </p>
    <p class="calculator__footer-credits">
      Stworzone przez 
      <a href="https://github.com/radoxtech" target="_blank" rel="noopener">radoxtech</a>
      (<a href="https://www.linkedin.com/in/radoslaw-kubiak-71836a1b5/" target="_blank" rel="noopener">LinkedIn</a>)
    </p>
    <p class="calculator__footer-credits">
      Zbudowane z pomocą 
      <a href="https://github.com/ohmyopencode/opencode" target="_blank" rel="noopener">Oh My OpenCode</a>
      i sztucznej inteligencji Anthropic Claude Opus 4.5 & Sonnet 4.5
    </p>
  </footer>
</div>

<style>
  .calculator {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }

  .calculator__header {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-lg);
    padding: var(--space-xl) var(--space-md);
    background: linear-gradient(180deg, var(--color-parchment) 0%, var(--color-cream) 100%);
    border-bottom: 2px solid var(--color-gold);
    position: relative;
  }

  .calculator__header h1 {
    margin: 0;
    font-size: var(--text-4xl);
  }

  .calculator__subtitle {
    margin: 0;
    font-family: var(--font-body);
    font-size: var(--text-lg);
    color: var(--color-ink-light);
  }

  .calculator__theme-toggle {
    position: absolute;
    right: var(--space-md);
    top: 50%;
    transform: translateY(-50%);
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    padding: 0;
    background: transparent;
    border: 2px solid var(--color-gold);
    border-radius: var(--radius-md);
    cursor: pointer;
    color: var(--color-burgundy);
    transition: all var(--transition-fast);
  }

  .calculator__theme-toggle:hover {
    background: var(--color-gold);
    color: var(--color-cream);
  }

  .calculator__theme-toggle:focus {
    outline: none;
    box-shadow: var(--focus-ring);
  }

   .calculator__main {
     flex: 1;
     max-width: 900px;
     width: 100%;
     margin: 0 auto;
     padding: var(--space-lg) var(--space-md);
   }

   .calculator__construction-banner {
     background: #FFF3CD;
     border-left: 4px solid var(--color-gold);
     padding: var(--space-md);
     margin-bottom: var(--space-lg);
     text-align: center;
     border-radius: var(--radius-sm);
   }

   .calculator__construction-banner p {
     margin: 0;
     color: #856404;
     font-weight: 600;
     font-family: var(--font-body);
     font-size: var(--text-base);
   }

   /* Dark mode construction banner */
   :global([data-theme="dark"]) .calculator__construction-banner {
     background: #664D00;
     border-left-color: var(--color-gold);
   }

   :global([data-theme="dark"]) .calculator__construction-banner p {
     color: #FFF3CD;
   }

  .calculator__form-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: var(--space-md);
  }

     /* Slider field for annual raise */
   .calculator__slider-field {
     margin-top: var(--space-md);
   }
   
   .calculator__slider-field label {
     display: block;
     font-family: var(--font-heading);
     font-size: var(--text-sm);
     color: var(--color-ink);
     margin-bottom: var(--space-xs);
   }
   
   .calculator__slider {
     width: 100%;
     height: 8px;
     border-radius: 4px;
     background: var(--color-cream);
     border: 1px solid var(--color-gold);
     cursor: pointer;
     -webkit-appearance: none;
     appearance: none;
   }
   
   .calculator__slider::-webkit-slider-thumb {
     -webkit-appearance: none;
     width: 20px;
     height: 20px;
     border-radius: 50%;
     background: var(--color-burgundy);
     border: 2px solid var(--color-cream);
     cursor: pointer;
     box-shadow: var(--shadow-sm);
   }
   
   .calculator__slider::-moz-range-thumb {
     width: 20px;
     height: 20px;
     border-radius: 50%;
     background: var(--color-burgundy);
     border: 2px solid var(--color-cream);
     cursor: pointer;
     box-shadow: var(--shadow-sm);
   }
   
   .calculator__slider-hint {
     display: block;
     font-size: var(--text-xs);
     color: var(--color-ink-light);
     margin-top: var(--space-xs);
   }

   .calculator__form-actions {
     margin-top: var(--space-lg);
     display: flex;
     justify-content: center;
   }

   /* Duration Input with Toggle */
   .calculator__input-group--with-toggle {
     position: relative;
   }

   .calculator__duration-toggle {
     position: absolute;
     top: 28px;
     right: var(--space-sm);
     padding: var(--space-xs) var(--space-sm);
     background: var(--color-gold);
     color: var(--color-cream);
     border: 1px solid var(--color-gold-dark);
     border-radius: var(--radius-sm);
     font-family: var(--font-body);
     font-size: var(--text-xs);
     font-weight: 600;
     cursor: pointer;
     transition: all var(--transition-fast);
     text-transform: lowercase;
   }

    .calculator__duration-toggle:hover {
      background: #AA8C28;
      color: var(--color-cream);
      transform: translateY(-1px);
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

   .calculator__duration-toggle:active {
     transform: translateY(0);
   }

   .calculator__duration-toggle:focus {
     outline: none;
     box-shadow: var(--focus-ring);
   }

   /* Golden Mean Banner */
  .calculator__golden-banner {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    width: 100%;
    padding: var(--space-md) var(--space-lg);
    margin: var(--space-lg) 0;
    background: linear-gradient(135deg, var(--color-gold) 0%, var(--color-gold-light) 100%);
    border: none;
    border-radius: var(--radius-md);
    cursor: pointer;
    text-align: left;
    transition: transform var(--transition-fast), box-shadow var(--transition-fast);
  }

  .calculator__golden-banner:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-md);
  }

  .calculator__golden-banner:focus {
    outline: none;
    box-shadow: var(--focus-ring);
  }

  .calculator__golden-coin {
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.3s ease;
  }

  .calculator__golden-banner:hover .calculator__golden-coin {
    transform: rotate(15deg) scale(1.1);
  }

  .calculator__golden-banner-text {
    flex: 1;
    font-family: var(--font-body);
    color: var(--color-ink);
  }

   .calculator__golden-banner-text strong {
     font-family: var(--font-heading);
     font-size: var(--text-lg);
   }

    .calculator__golden-banner-text small {
      display: block;
      font-size: 1.125rem;
      font-weight: 600;
      color: var(--color-ink);
      line-height: 1.4;
    }

  .calculator__golden-banner-arrow {
    font-size: var(--text-2xl);
    color: var(--color-burgundy);
  }

  /* Golden Mean Section */
  .calculator__golden-intro {
    font-family: var(--font-body);
    color: var(--color-ink-light);
    margin-bottom: var(--space-lg);
  }

  .calculator__golden-result {
    margin-top: var(--space-lg);
    padding: var(--space-md);
    background: var(--color-cream);
    border: 1px solid var(--color-gold);
    border-radius: var(--radius-md);
  }

  :global([data-theme="dark"]) .calculator__golden-result {
    background: #3D3000;
    border-color: var(--color-gold);
  }

  :global([data-theme="dark"]) .calculator__golden-result h4 {
    color: var(--color-gold);
  }

  :global([data-theme="dark"]) .calculator__golden-stat-value {
    color: var(--color-gold);
  }

  .calculator__golden-result h4 {
    font-family: var(--font-heading);
    font-size: var(--text-lg);
    color: var(--color-burgundy);
    margin: 0 0 var(--space-md) 0;
  }

  .calculator__golden-result-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: var(--space-md);
    margin-bottom: var(--space-md);
  }

  .calculator__golden-stat {
    display: flex;
    flex-direction: column;
  }

  .calculator__golden-stat-label {
    font-size: var(--text-sm);
    color: var(--color-ink-light);
  }

  .calculator__golden-stat-value {
    font-family: var(--font-heading);
    font-size: var(--text-xl);
    font-weight: 600;
    color: var(--color-burgundy);
  }

  .calculator__golden-rationale {
    font-family: var(--font-body);
    font-style: italic;
    color: var(--color-ink-light);
    margin-bottom: var(--space-md);
  }

  .calculator__golden-warning {
    padding: var(--space-sm) var(--space-md);
    background: rgba(230, 81, 0, 0.1);
    border-left: 3px solid var(--color-warning);
    color: var(--color-warning);
    font-size: var(--text-sm);
    margin-bottom: var(--space-md);
  }

  /* Results */
  .calculator__results h2 {
    text-align: center;
    margin-bottom: var(--space-lg);
  }

  .calculator__results-table-wrapper {
    overflow-x: auto;
    margin-bottom: var(--space-lg);
  }

  .calculator__results-table {
    width: 100%;
    border-collapse: collapse;
    font-family: var(--font-body);
    font-size: var(--text-sm);
    background: var(--color-parchment);
    border-radius: var(--radius-md);
    overflow: hidden;
  }

  .calculator__results-table th,
  .calculator__results-table td {
    padding: var(--space-md);
    text-align: right;
    border-bottom: 1px solid var(--color-gold);
  }

  .calculator__results-table th {
    background: var(--color-cream);
    font-family: var(--font-heading);
    font-weight: 600;
    color: var(--color-ink);
  }

  .calculator__results-table th:first-child,
  .calculator__results-table td:first-child {
    text-align: left;
  }

  .calculator__results-row {
    border-left: 4px solid;
  }

  .calculator__results-row--none {
    border-left-color: #6B7280;
  }

  .calculator__results-row--shorten {
    border-left-color: var(--color-burgundy);
  }

  .calculator__results-row--reduce {
    border-left-color: #1E40AF;
  }

  .calculator__results-row--reinvest {
    border-left-color: #7B2D9E;
  }

  .calculator__strategy-name {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .calculator__strategy-name strong {
    font-family: var(--font-heading);
    font-size: var(--text-base);
  }

  .calculator__strategy-hint {
    font-size: var(--text-xs);
    color: var(--color-ink-light);
    font-style: italic;
  }

  .calculator__strategy-hint--recommended {
    color: var(--color-burgundy);
    font-weight: 500;
    cursor: help;
  }

  .calculator__info-icon {
    font-style: normal;
    opacity: 0.7;
  }

  .calculator__strategy-explanation {
    margin-top: var(--space-md);
    padding: var(--space-md);
    background: linear-gradient(135deg, rgba(123, 45, 158, 0.1) 0%, rgba(160, 32, 30, 0.05) 100%);
    border-left: 4px solid #7B2D9E;
    border-radius: var(--radius-sm);
    font-size: var(--text-sm);
    color: var(--color-ink);
    line-height: 1.6;
  }

  .calculator__strategy-explanation p {
    margin: 0 0 var(--space-sm) 0;
  }

  .calculator__strategy-explanation p:last-child {
    margin-bottom: 0;
  }

  .calculator__strategy-myth {
    margin-top: var(--space-md) !important;
    padding: var(--space-sm) var(--space-md);
    background: rgba(230, 126, 34, 0.1);
    border-left: 3px solid #E67E22;
    border-radius: var(--radius-sm);
    font-size: var(--text-xs);
  }

   .calculator__savings {
     color: var(--color-success);
     font-weight: 600 !important;
   }

   .calculator__reinvest-toggle {
     margin: var(--space-lg) 0;
     padding: var(--space-md);
     background: var(--color-cream);
     border: 2px solid var(--color-gold);
     border-radius: var(--radius-md);
   }

   .calculator__reinvest-toggle label {
     display: flex;
     align-items: center;
     gap: var(--space-sm);
     cursor: pointer;
     font-family: var(--font-body);
     user-select: none;
   }

   .calculator__reinvest-toggle input[type="checkbox"] {
     width: 20px;
     height: 20px;
     cursor: pointer;
     accent-color: var(--color-burgundy);
   }

   .calculator__reinvest-toggle span {
     font-weight: 500;
     color: var(--color-ink);
   }

   .calculator__reinvest-note {
     margin-top: var(--space-sm);
     margin-bottom: 0;
     font-size: var(--text-sm);
     color: var(--color-gold-dark);
     font-style: italic;
     padding-left: 2.75rem;
   }

   /* Tabs */
  .calculator__tabs {
    display: flex;
    gap: var(--space-xs);
    border-bottom: 2px solid var(--color-gold);
    margin-bottom: var(--space-lg);
    overflow-x: auto;
  }

  .calculator__tab {
    padding: var(--space-sm) var(--space-md);
    font-family: var(--font-heading);
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--color-ink-light);
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    margin-bottom: -2px;
    cursor: pointer;
    transition: all var(--transition-fast);
    white-space: nowrap;
  }

  .calculator__tab:hover {
    color: var(--color-burgundy);
  }

  .calculator__tab--active {
    color: var(--color-burgundy);
    border-bottom-color: var(--color-burgundy);
  }

   .calculator__tab:focus {
     outline: none;
     box-shadow: var(--focus-ring);
   }

   /* Schedule Controls */
   .calculator__schedule-controls {
     margin-bottom: var(--space-md);
     max-width: 250px;
   }

   /* Schedule Table */
  .calculator__schedule-table-wrapper {
    overflow-x: auto;
  }

  .calculator__schedule-table {
    width: 100%;
    border-collapse: collapse;
    font-family: var(--font-body);
    font-size: var(--text-sm);
  }

  .calculator__schedule-table th,
  .calculator__schedule-table td {
    padding: var(--space-xs) var(--space-sm);
    text-align: right;
    border-bottom: 1px solid var(--color-parchment-dark);
  }

  .calculator__schedule-table th {
    background: var(--color-parchment);
    font-weight: 600;
    position: sticky;
    top: 0;
  }

  .calculator__schedule-table th:first-child,
  .calculator__schedule-table td:first-child {
    text-align: left;
  }

   .calculator__schedule-more {
     text-align: center !important;
     font-style: italic;
     color: var(--color-ink-light);
   }

   /* Pagination */
   .calculator__pagination {
     display: flex;
     justify-content: center;
     align-items: center;
     gap: var(--space-md);
     margin-top: var(--space-md);
     padding: var(--space-md);
   }

   .calculator__pagination-btn {
     padding: var(--space-xs) var(--space-md);
     background: var(--color-cream);
     border: 2px solid var(--color-gold);
     color: var(--color-ink);
     font-family: var(--font-body);
     font-size: var(--text-sm);
     cursor: pointer;
     transition: all 0.2s;
     border-radius: var(--radius-sm);
   }

   .calculator__pagination-btn:hover:not(:disabled) {
     background: var(--color-gold);
     color: var(--color-cream);
   }

   .calculator__pagination-btn:disabled {
     opacity: 0.4;
     cursor: not-allowed;
   }

   .calculator__pagination-info {
     font-family: var(--font-body);
     font-size: var(--text-sm);
     color: var(--color-ink);
     white-space: nowrap;
   }

   /* Footer */
  .calculator__footer {
    padding: var(--space-lg) var(--space-md);
    background: var(--color-parchment);
    border-top: 1px solid var(--color-gold);
    text-align: center;
    font-family: var(--font-body);
    font-size: var(--text-sm);
  }

  .calculator__footer p {
    margin: 0;
  }

  .calculator__footer-disclaimer {
    margin-top: var(--space-sm) !important;
    color: var(--color-ink-light);
    font-size: var(--text-xs);
  }

  .calculator__footer-credits {
    margin-top: var(--space-xs) !important;
    color: var(--color-ink-light);
    font-size: var(--text-xs);
    font-style: italic;
  }

  .calculator__footer-credits a {
    color: var(--color-burgundy);
    text-decoration: none;
  }

  .calculator__footer-credits a:hover {
    text-decoration: underline;
  }

  /* Responsive */
  @media (max-width: 640px) {
    .calculator__header {
      flex-direction: column;
      text-align: center;
    }

    .calculator__header h1 {
      font-size: var(--text-3xl);
    }

    .calculator__form-grid {
      grid-template-columns: 1fr;
    }

    .calculator__summary-cards {
      grid-template-columns: 1fr;
    }

    .calculator__golden-banner {
      flex-direction: column;
      text-align: center;
    }

    .calculator__golden-banner-arrow {
      transform: rotate(90deg);
    }
  }

  /* Prayer section - Banner */
  .calculator__prayer-banner {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    width: 100%;
    padding: var(--space-md) var(--space-lg);
    margin: var(--space-lg) 0;
    background: linear-gradient(135deg, #DBEAFE 0%, #BFDBFE 100%);
    border: 2px solid #3B82F6;
    border-radius: var(--radius-lg);
    cursor: pointer;
    transition: all 0.3s ease;
    text-align: left;
  }

  .calculator__prayer-banner:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(59, 130, 246, 0.3);
  }

  .calculator__prayer-banner-icon {
    font-size: 2.5rem;
  }

  .calculator__prayer-banner-text {
    flex: 1;
  }

  .calculator__prayer-banner-text strong {
    font-family: var(--font-heading);
    font-size: var(--text-lg);
    color: #1E40AF;
  }

  .calculator__prayer-banner-text small {
    color: #3B82F6;
  }

  .calculator__prayer-banner-arrow {
    font-size: var(--text-2xl);
    color: #3B82F6;
  }

  /* Prayer section - Strategy selector */
  .calculator__prayer-strategy {
    margin-bottom: var(--space-lg);
  }

  .calculator__prayer-strategy-label {
    display: block;
    font-family: var(--font-heading);
    font-weight: 600;
    margin-bottom: var(--space-sm);
  }

  .calculator__prayer-strategy-buttons {
    display: flex;
    gap: var(--space-sm);
    flex-wrap: wrap;
  }

  .calculator__prayer-strategy-btn {
    padding: var(--space-sm) var(--space-md);
    border: 2px solid var(--color-gold);
    border-radius: var(--radius-md);
    background: var(--color-cream);
    font-family: var(--font-heading);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .calculator__prayer-strategy-btn:hover {
    background: var(--color-parchment);
  }

  .calculator__prayer-strategy-btn.active {
    background: var(--color-gold);
    color: white;
  }

  /* Prayer section */
  .calculator__prayer-intro {
    font-family: var(--font-body);
    color: var(--color-ink-light);
    margin-bottom: var(--space-lg);
  }

  .calculator__prayer-buttons {
    margin-bottom: var(--space-lg);
  }

  .calculator__prayer-label {
    font-family: var(--font-heading);
    font-weight: 600;
    margin-bottom: var(--space-sm);
  }

  .calculator__prayer-group {
    display: flex;
    gap: var(--space-md);
    flex-wrap: wrap;
  }

  .calculator__prayer-btn {
    flex: 1;
    min-width: 140px;
    padding: var(--space-md);
    border-radius: var(--radius-md);
    border: 2px solid;
    font-family: var(--font-heading);
    font-size: var(--text-base);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .calculator__prayer-btn small {
    display: block;
    font-size: var(--text-sm);
    opacity: 0.8;
    margin-top: var(--space-xs);
  }

  .calculator__prayer-btn--prayer {
    background: linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%);
    border-color: var(--color-gold);
    color: #92400E;
  }

  .calculator__prayer-btn--prayer:hover {
    background: linear-gradient(135deg, #FDE68A 0%, #FCD34D 100%);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(189, 149, 68, 0.3);
  }

  .calculator__prayer-btn--sin {
    background: linear-gradient(135deg, #FEE2E2 0%, #FECACA 100%);
    border-color: #DC2626;
    color: #991B1B;
  }

  .calculator__prayer-btn--sin:hover {
    background: linear-gradient(135deg, #FECACA 0%, #FCA5A5 100%);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(220, 38, 38, 0.3);
  }

  .calculator__prayer-result {
    margin-top: var(--space-lg);
    padding: var(--space-md);
    border-radius: var(--radius-md);
    border: 2px solid;
  }

  .calculator__prayer-result--prayer {
    background: linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%);
    border-color: #10B981;
  }

  .calculator__prayer-result--sin {
    background: linear-gradient(135deg, #FEF2F2 0%, #FEE2E2 100%);
    border-color: #DC2626;
  }

  .calculator__prayer-result h4 {
    font-family: var(--font-heading);
    font-size: var(--text-lg);
    margin: 0 0 var(--space-md) 0;
  }

  .calculator__prayer-result-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: var(--space-md);
  }

  .calculator__prayer-stat {
    display: flex;
    flex-direction: column;
  }

  .calculator__prayer-stat-label {
    font-size: var(--text-sm);
    color: var(--color-ink-light);
  }

  .calculator__prayer-stat-value {
    font-family: var(--font-heading);
    font-size: var(--text-xl);
    font-weight: 600;
  }

  .calculator__prayer-stat-value--prayer {
    color: #059669;
  }

  .calculator__prayer-stat-value--sin {
    color: #DC2626;
  }

  :global([data-theme="dark"]) .calculator__prayer-banner {
    background: linear-gradient(135deg, #1E3A8A 0%, #1E40AF 100%);
    border-color: #3B82F6;
  }

  :global([data-theme="dark"]) .calculator__prayer-banner-text strong {
    color: #BFDBFE;
  }

  :global([data-theme="dark"]) .calculator__prayer-banner-text small {
    color: #93C5FD;
  }

  :global([data-theme="dark"]) .calculator__prayer-banner-arrow {
    color: #60A5FA;
  }

  :global([data-theme="dark"]) .calculator__prayer-strategy-btn {
    background: var(--color-ink);
    border-color: var(--color-gold);
    color: var(--color-cream);
  }

  :global([data-theme="dark"]) .calculator__prayer-strategy-btn:hover {
    background: var(--color-ink-light);
  }

  :global([data-theme="dark"]) .calculator__prayer-strategy-btn.active {
    background: var(--color-gold);
    color: var(--color-ink);
  }

  :global([data-theme="dark"]) .calculator__prayer-btn--prayer {
    background: linear-gradient(135deg, #78350F 0%, #92400E 100%);
    color: #FEF3C7;
  }

  :global([data-theme="dark"]) .calculator__prayer-btn--sin {
    background: linear-gradient(135deg, #7F1D1D 0%, #991B1B 100%);
    color: #FEE2E2;
  }

  :global([data-theme="dark"]) .calculator__prayer-result--prayer {
    background: linear-gradient(135deg, #064E3B 0%, #065F46 100%);
    border-color: #10B981;
  }

  :global([data-theme="dark"]) .calculator__prayer-result--sin {
    background: linear-gradient(135deg, #7F1D1D 0%, #991B1B 100%);
    border-color: #DC2626;
  }

  :global([data-theme="dark"]) .calculator__prayer-result h4 {
    color: #F3F4F6;
  }

  :global([data-theme="dark"]) .calculator__prayer-stat-value--prayer {
    color: #34D399;
  }

  :global([data-theme="dark"]) .calculator__prayer-stat-value--sin {
    color: #F87171;
  }
</style>

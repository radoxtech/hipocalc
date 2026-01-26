<script lang="ts">
  import { browser } from '$app/environment';
  import Decimal from 'decimal.js';
  import { VintageCard, VintageInput, VintageButton, VintageSelect, SectionDivider, BankSeal } from '$lib/components';
  import { BalanceChart, SavingsChart, ScenarioComparison } from '$lib/components/charts';
  import { generateAmortizationSchedule } from '$lib/engine/mortgage';
  import { calculateGoldenMean } from '$lib/engine/golden-mean';
  import type { Loan, Overpayments, Schedule } from '$lib/engine/types';
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

  // Theme state
  let theme = $state<'light' | 'dark' | 'auto'>('auto');

   // Złoty Środek state
   let showGoldenMean = $state(false);
   let netIncome = $state('');
   let fixedExpenses = $state('');
   let emergencyStatus = $state<'have' | 'build-fast' | 'build-slow-3y'>('have');
   let emergencyFundMonths = $state('6');

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
        }
      } catch {
        // Ignore storage errors
      }

     // Load theme preference
     try {
       const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
       if (savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'auto') {
         theme = savedTheme;
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
          emergencyFundMonths
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      } catch {
        // Ignore storage errors
      }
    }

  // Apply theme to document
  function applyTheme(selectedTheme: 'light' | 'dark' | 'auto') {
    if (!browser) return;
    const html = document.documentElement;
    
    if (selectedTheme === 'auto') {
      html.removeAttribute('data-theme');
    } else {
      html.setAttribute('data-theme', selectedTheme);
    }
  }

   // Toggle theme: auto -> light -> dark -> auto
   function toggleTheme() {
     const themes: ('light' | 'dark' | 'auto')[] = ['auto', 'light', 'dark'];
     const currentIndex = themes.indexOf(theme);
     const nextIndex = (currentIndex + 1) % themes.length;
     theme = themes[nextIndex];
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
      saveFormData();
    });
  let goldenMeanResult = $state<GoldenMeanOutput | null>(null);

  // Results state
  let scheduleNone = $state<Schedule | null>(null);
  let scheduleShortenTerm = $state<Schedule | null>(null);
  let scheduleReducePayment = $state<Schedule | null>(null);
  let hasCalculated = $state(false);
  let activeTab = $state<'comparison' | 'balance' | 'savings' | 'schedule'>('comparison');

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
       yearlyMonth: parseInt(yearlyMonth) || 12
     };

     const noOverpayments: Overpayments = {
       monthly: new Decimal(0),
       yearly: new Decimal(0),
       yearlyMonth: 12
     };

     scheduleNone = generateAmortizationSchedule(loan, noOverpayments, 'none');
     scheduleShortenTerm = generateAmortizationSchedule(loan, overpayments, 'shorten-term');
     scheduleReducePayment = generateAmortizationSchedule(loan, overpayments, 'reduce-payment');
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

  const loanTypeOptions = [
    { value: 'annuity', label: 'Raty równe' },
    { value: 'decreasing', label: 'Raty malejące' }
  ];

  const emergencyOptions = [
    { value: 'have', label: 'Mam poduszkę' },
    { value: 'build-fast', label: 'Buduję szybko (50%)' },
    { value: 'build-slow-3y', label: 'Buduję powoli (15%)' }
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
      {:else if theme === 'dark'}
        {@html MoonIcon()}
      {:else}
        {@html AutoIcon()}
      {/if}
    </button>
  </header>

  <main class="calculator__main">
    <!-- Step 1: Loan Data -->
    <VintageCard title="Krok 1: Dane kredytu" variant="highlight">
      <form class="calculator__form" onsubmit={(e) => { e.preventDefault(); calculate(); }}>
        <div class="calculator__form-grid">
          <VintageInput
            label="Kwota kredytu"
            name="principal"
            type="number"
            bind:value={principal}
            suffix="zł"
            error={errors.principal}
            required
            min={1000}
          />

          <VintageInput
            label="Okres kredytu"
            name="years"
            type="number"
            bind:value={years}
            suffix="lat"
            error={errors.years}
            required
            min={1}
            max={50}
          />

          <VintageInput
            label="Okres kredytu"
            name="months"
            type="number"
            bind:value={months}
            suffix="mies."
            error={errors.months}
            required
            min={1}
            max={600}
          />

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
        <span class="calculator__golden-banner-icon">&#x2728;</span>
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
            hint="Bez kredytu i przyjemności"
            required
            min={0}
          />

          <VintageSelect
            label="Status poduszki bezpieczeństwa"
            name="emergencyStatus"
            options={emergencyOptions}
            bind:value={emergencyStatus}
          />

          <VintageInput
            label="Poduszka bezpieczeństwa (miesiące)"
            name="emergencyFundMonths"
            type="number"
            bind:value={emergencyFundMonths}
            min={1}
            max={24}
            hint="Docelowa poduszka: koszty życia na X miesięcy"
          />
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
    {#if hasCalculated && scheduleNone && scheduleShortenTerm && scheduleReducePayment}
      <SectionDivider variant="ornate" />

      <section class="calculator__results">
        <h2>Wyniki symulacji</h2>

        <!-- Summary Cards -->
        <div class="calculator__summary-cards">
          <div class="calculator__summary-card calculator__summary-card--none">
            <h3>Bez nadpłat</h3>
            <dl>
              <dt>Okres spłaty</dt>
              <dd>{Math.ceil(scheduleNone.summary.totalMonths / 12)} lat ({scheduleNone.summary.totalMonths} mies.)</dd>
              <dt>Suma odsetek</dt>
              <dd>{formatCurrency(scheduleNone.summary.totalInterest)} zł</dd>
              <dt>Łącznie do spłaty</dt>
              <dd>{formatCurrency(scheduleNone.summary.totalPaid)} zł</dd>
            </dl>
          </div>

          <div class="calculator__summary-card calculator__summary-card--shorten">
            <h3>Skróć okres</h3>
            <dl>
              <dt>Okres spłaty</dt>
              <dd>{Math.ceil(scheduleShortenTerm.summary.totalMonths / 12)} lat ({scheduleShortenTerm.summary.totalMonths} mies.)</dd>
              <dt>Suma odsetek</dt>
              <dd>{formatCurrency(scheduleShortenTerm.summary.totalInterest)} zł</dd>
              <dt>Oszczędność</dt>
              <dd class="calculator__savings">
                {formatCurrency(scheduleNone.summary.totalInterest.minus(scheduleShortenTerm.summary.totalInterest))} zł
              </dd>
            </dl>
          </div>

          <div class="calculator__summary-card calculator__summary-card--reduce">
            <h3>Zmniejsz ratę</h3>
            <dl>
              <dt>Okres spłaty</dt>
              <dd>{Math.ceil(scheduleReducePayment.summary.totalMonths / 12)} lat ({scheduleReducePayment.summary.totalMonths} mies.)</dd>
              <dt>Suma odsetek</dt>
              <dd>{formatCurrency(scheduleReducePayment.summary.totalInterest)} zł</dd>
              <dt>Oszczędność</dt>
              <dd class="calculator__savings">
                {formatCurrency(scheduleNone.summary.totalInterest.minus(scheduleReducePayment.summary.totalInterest))} zł
              </dd>
            </dl>
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
            />
          {:else if activeTab === 'balance'}
            <BalanceChart schedule={scheduleShortenTerm} title="Spadek salda - strategia skrócenia okresu" />
          {:else if activeTab === 'savings'}
            <SavingsChart
              scheduleWithOverpayment={scheduleShortenTerm}
              scheduleWithoutOverpayment={scheduleNone}
            />
          {:else if activeTab === 'schedule'}
            <VintageCard title="Harmonogram spłat (skrócenie okresu)">
              <div class="calculator__schedule-table-wrapper">
                <table class="calculator__schedule-table">
                  <thead>
                    <tr>
                      <th>Miesiąc</th>
                      <th>Rata</th>
                      <th>Kapitał</th>
                      <th>Odsetki</th>
                      <th>Nadpłata</th>
                      <th>Saldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {#each scheduleShortenTerm.rows as row}
                      <tr>
                        <td>{row.month}</td>
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
            </VintageCard>
          {/if}
        </div>
      </section>
    {/if}
  </main>

  <!-- Footer -->
  <footer class="calculator__footer">
    <p>
      HipoCalc &copy; 2025 | 
      <a href="https://github.com/radoxtech/hipocalc" target="_blank" rel="noopener">
        Kod źródłowy na GitHub
      </a>
    </p>
    <p class="calculator__footer-disclaimer">
      Kalkulator ma charakter informacyjny. Skonsultuj decyzje finansowe z doradcą.
    </p>
    <p class="calculator__footer-credits">
      Dumnie stworzone przy pomocy 
      <a href="https://github.com/ohmyopencode/opencode" target="_blank" rel="noopener">Oh My OpenCode</a>
      i modeli Anthropic Claude Opus 4.5 & Sonnet 4.5
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

  .calculator__form-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: var(--space-md);
  }

  .calculator__form-actions {
    margin-top: var(--space-lg);
    display: flex;
    justify-content: center;
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

  .calculator__golden-banner-icon {
    font-size: var(--text-2xl);
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

  .calculator__summary-cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: var(--space-md);
    margin-bottom: var(--space-xl);
  }

  .calculator__summary-card {
    padding: var(--space-lg);
    background: var(--color-parchment);
    border-radius: var(--radius-md);
    border-left: 4px solid;
  }

  .calculator__summary-card--none {
    border-left-color: #6B7280;
  }

  .calculator__summary-card--shorten {
    border-left-color: var(--color-burgundy);
  }

  .calculator__summary-card--reduce {
    border-left-color: #1E40AF;
  }

  .calculator__summary-card h3 {
    font-family: var(--font-heading);
    font-size: var(--text-lg);
    margin: 0 0 var(--space-sm) 0;
  }

  .calculator__summary-card dl {
    margin: 0;
    display: grid;
    grid-template-columns: auto 1fr;
    gap: var(--space-xs);
    font-size: var(--text-sm);
  }

  .calculator__summary-card dt {
    color: var(--color-ink-light);
  }

  .calculator__summary-card dd {
    margin: 0;
    text-align: right;
    font-weight: 500;
  }

  .calculator__savings {
    color: var(--color-success);
    font-weight: 600 !important;
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
</style>

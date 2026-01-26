<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import uPlot from 'uplot';
  import 'uplot/dist/uPlot.min.css';
  import type { Schedule } from '$lib/engine/types';

  interface Props {
    scheduleNone: Schedule;
    scheduleShortenTerm: Schedule;
    scheduleReducePayment: Schedule;
    scheduleReducePlus: Schedule;
    title?: string;
  }

  let {
    scheduleNone,
    scheduleShortenTerm,
    scheduleReducePayment,
    scheduleReducePlus,
    title = 'Porównanie 4 strategii spłaty'
  }: Props = $props();

  let chartContainer: HTMLDivElement;
  let chart: uPlot | null = null;

  function createChart() {
    if (!chartContainer) return;

    // Find max months across all scenarios
    const maxMonths = Math.max(
      scheduleNone.rows.length,
      scheduleShortenTerm.rows.length,
      scheduleReducePayment.rows.length,
      scheduleReducePlus.rows.length
    );

    const months: number[] = [];
    const balanceNone: (number | null)[] = [];
    const balanceShorten: (number | null)[] = [];
    const balanceReduce: (number | null)[] = [];
    const balanceReducePlus: (number | null)[] = [];

    for (let i = 0; i < maxMonths; i++) {
      months.push(i + 1);

      const noneVal = i < scheduleNone.rows.length
        ? scheduleNone.rows[i].balanceAfter.toNumber()
        : null;
      const shortenVal = i < scheduleShortenTerm.rows.length
        ? scheduleShortenTerm.rows[i].balanceAfter.toNumber()
        : null;
      const reduceVal = i < scheduleReducePayment.rows.length
        ? scheduleReducePayment.rows[i].balanceAfter.toNumber()
        : null;
      const reducePlusVal = i < scheduleReducePlus.rows.length
        ? scheduleReducePlus.rows[i].balanceAfter.toNumber()
        : null;

      balanceNone.push(noneVal);
      balanceShorten.push(shortenVal);
      balanceReduce.push(reduceVal);
      balanceReducePlus.push(reducePlusVal);
    }

    const data: uPlot.AlignedData = [
      months,
      balanceNone,
      balanceReduce,
      balanceReducePlus,
      balanceShorten
    ];

    const opts: uPlot.Options = {
      width: chartContainer.clientWidth,
      height: 350,
      title: undefined,
      scales: {
        x: { time: false },
        y: { auto: true }
      },
      axes: [
        {
          label: 'Miesiąc',
          font: '12px Cormorant, serif',
          labelFont: '14px Cormorant, serif',
          stroke: '#1C1C1E',
          grid: { stroke: 'rgba(189, 149, 68, 0.2)' }
        },
        {
          label: 'Saldo (zł)',
          font: '12px Cormorant, serif',
          labelFont: '14px Cormorant, serif',
          stroke: '#1C1C1E',
          grid: { stroke: 'rgba(189, 149, 68, 0.2)' },
          values: (_u: uPlot, vals: number[]) => vals.map(v => formatCurrency(v))
        }
      ],
      series: [
        {
          label: 'Miesiąc',
          value: (_u: uPlot, v: number) => `Miesiąc ${v}`
        },
        {
          label: 'Bez nadpłat',
          stroke: '#6B7280',
          width: 2,
          dash: [5, 5],
          value: (_u: uPlot, v: number) => v ? `${formatCurrency(v)} zł` : '—'
        },
        {
          label: 'Zmniejsz ratę',
          stroke: '#1E40AF',
          width: 3,
          value: (_u: uPlot, v: number) => v ? `${formatCurrency(v)} zł` : '—'
        },
        {
          label: 'Zmniejsz ratę+',
          stroke: '#7B2D9E',
          width: 3,
          value: (_u: uPlot, v: number) => v ? `${formatCurrency(v)} zł` : '—'
        },
        {
          label: 'Skróć okres',
          stroke: '#A0201E',
          width: 3,
          dash: [8, 4],
          value: (_u: uPlot, v: number) => v ? `${formatCurrency(v)} zł` : '—'
        }
      ],
      legend: {
        show: true
      },
      cursor: {
        drag: { x: false, y: false }
      }
    };

    chart = new uPlot(opts, data, chartContainer);
  }

  function formatCurrency(value: number): string {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    } else if (value >= 1000) {
      return `${(value / 1000).toFixed(0)}k`;
    }
    return value.toFixed(0);
  }

  function handleResize() {
    if (chart && chartContainer) {
      chart.setSize({ width: chartContainer.clientWidth, height: 350 });
    }
  }

  onMount(() => {
    createChart();
    window.addEventListener('resize', handleResize);
  });

  onDestroy(() => {
    chart?.destroy();
    window.removeEventListener('resize', handleResize);
  });

  $effect(() => {
    if (scheduleNone && scheduleShortenTerm && scheduleReducePayment && scheduleReducePlus && chartContainer) {
      chart?.destroy();
      createChart();
    }
  });
</script>

<div class="scenario-comparison">
  <h3 class="scenario-comparison__title">{title}</h3>
  <div bind:this={chartContainer} class="scenario-comparison__container"></div>

  <!-- Comparison summary -->
  <div class="scenario-comparison__summary">
    <div class="scenario-comparison__card scenario-comparison__card--none">
      <h4>Bez nadpłat</h4>
      <dl>
        <dt>Czas spłaty</dt>
        <dd>{scheduleNone.summary.totalMonths} mies.</dd>
        <dt>Suma odsetek</dt>
        <dd>{scheduleNone.summary.totalInterest.toDecimalPlaces(0).toNumber().toLocaleString('pl-PL')} zł</dd>
      </dl>
    </div>

    <div class="scenario-comparison__card scenario-comparison__card--reduce">
      <h4>Zmniejsz ratę</h4>
      <dl>
        <dt>Czas spłaty</dt>
        <dd>{scheduleReducePayment.summary.totalMonths} mies.</dd>
        <dt>Suma odsetek</dt>
        <dd>{scheduleReducePayment.summary.totalInterest.toDecimalPlaces(0).toNumber().toLocaleString('pl-PL')} zł</dd>
        <dt>Oszczędność</dt>
        <dd class="scenario-comparison__savings">
          {scheduleNone.summary.totalInterest.minus(scheduleReducePayment.summary.totalInterest).toDecimalPlaces(0).toNumber().toLocaleString('pl-PL')} zł
        </dd>
      </dl>
    </div>

    <div class="scenario-comparison__card scenario-comparison__card--reduceplus">
      <h4>Zmniejsz ratę plus</h4>
      <dl>
        <dt>Czas spłaty</dt>
        <dd>{scheduleReducePlus.summary.totalMonths} mies.</dd>
        <dt>Suma odsetek</dt>
        <dd>{scheduleReducePlus.summary.totalInterest.toDecimalPlaces(0).toNumber().toLocaleString('pl-PL')} zł</dd>
        <dt>Oszczędność</dt>
        <dd class="scenario-comparison__savings">
          {scheduleNone.summary.totalInterest.minus(scheduleReducePlus.summary.totalInterest).toDecimalPlaces(0).toNumber().toLocaleString('pl-PL')} zł
        </dd>
      </dl>
    </div>

    <div class="scenario-comparison__card scenario-comparison__card--shorten">
      <h4>Skróć okres</h4>
      <dl>
        <dt>Czas spłaty</dt>
        <dd>{scheduleShortenTerm.summary.totalMonths} mies.</dd>
        <dt>Suma odsetek</dt>
        <dd>{scheduleShortenTerm.summary.totalInterest.toDecimalPlaces(0).toNumber().toLocaleString('pl-PL')} zł</dd>
        <dt>Oszczędność</dt>
        <dd class="scenario-comparison__savings">
          {scheduleNone.summary.totalInterest.minus(scheduleShortenTerm.summary.totalInterest).toDecimalPlaces(0).toNumber().toLocaleString('pl-PL')} zł
        </dd>
      </dl>
    </div>
  </div>
</div>

<style>
  .scenario-comparison {
    margin: var(--space-lg) 0;
  }

  .scenario-comparison__title {
    font-family: var(--font-heading);
    font-size: var(--text-lg);
    font-weight: 600;
    color: var(--color-burgundy);
    margin: 0 0 var(--space-md) 0;
  }

  .scenario-comparison__container {
    width: 100%;
    background: var(--color-cream);
    border: 1px solid var(--color-gold);
    border-radius: var(--radius-md);
    padding: var(--space-sm);
  }

  .scenario-comparison__summary {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: var(--space-md);
    margin-top: var(--space-lg);
  }

  .scenario-comparison__card {
    padding: var(--space-md);
    border-radius: var(--radius-md);
    background: var(--color-parchment);
    border-left: 4px solid;
  }

  .scenario-comparison__card--none {
    border-left-color: #6B7280;
  }

  .scenario-comparison__card--shorten {
    border-left-color: #730000;
  }

  .scenario-comparison__card--reduce {
    border-left-color: #1E40AF;
  }

  .scenario-comparison__card--reduceplus {
    border-left-color: #7B2D9E;
  }

  .scenario-comparison__card h4 {
    font-family: var(--font-heading);
    font-size: var(--text-base);
    font-weight: 600;
    margin: 0 0 var(--space-sm) 0;
    color: var(--color-ink);
  }

  .scenario-comparison__card dl {
    margin: 0;
    display: grid;
    grid-template-columns: 1fr auto;
    gap: var(--space-xs);
    font-family: var(--font-body);
    font-size: var(--text-sm);
  }

  .scenario-comparison__card dt {
    color: var(--color-ink-light);
  }

  .scenario-comparison__card dd {
    margin: 0;
    text-align: right;
    font-weight: 500;
  }

  .scenario-comparison__savings {
    color: var(--color-success);
    font-weight: 600;
  }
</style>

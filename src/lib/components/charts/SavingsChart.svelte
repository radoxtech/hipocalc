<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import uPlot from 'uplot';
  import 'uplot/dist/uPlot.min.css';
  import type { Schedule } from '$lib/engine/types';

  interface Props {
    scheduleWithOverpayment: Schedule;
    scheduleWithoutOverpayment: Schedule;
    title?: string;
  }

  let {
    scheduleWithOverpayment,
    scheduleWithoutOverpayment,
    title = 'Kumulatywne oszczędności'
  }: Props = $props();

  let chartContainer: HTMLDivElement;
  let chart: uPlot | null = null;

  function createChart() {
    if (!chartContainer) return;

    // Calculate cumulative savings (interest difference)
    const maxMonths = Math.max(
      scheduleWithoutOverpayment.rows.length,
      scheduleWithOverpayment.rows.length
    );

    const months: number[] = [];
    const savings: number[] = [];

    let cumulativeInterestWithout = 0;
    let cumulativeInterestWith = 0;

    for (let i = 0; i < maxMonths; i++) {
      months.push(i + 1);

      if (i < scheduleWithoutOverpayment.rows.length) {
        cumulativeInterestWithout += scheduleWithoutOverpayment.rows[i].interest.toNumber();
      }
      if (i < scheduleWithOverpayment.rows.length) {
        cumulativeInterestWith += scheduleWithOverpayment.rows[i].interest.toNumber();
      }

      savings.push(cumulativeInterestWithout - cumulativeInterestWith);
    }

    const data: uPlot.AlignedData = [months, savings];

    const opts: uPlot.Options = {
      width: chartContainer.clientWidth,
      height: 300,
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
          label: 'Oszczędności (zł)',
          font: '12px Cormorant, serif',
          labelFont: '14px Cormorant, serif',
          stroke: '#1C1C1E',
          grid: { stroke: 'rgba(189, 149, 68, 0.2)' },
          values: (_u: uPlot, vals: number[]) => vals.map(v => formatCurrency(v))
        }
      ],
      series: [
        {},
        {
          label: 'Oszczędności',
          stroke: '#2E7D32',
          width: 2,
          fill: 'rgba(46, 125, 50, 0.1)'
        }
      ],
       cursor: {
         drag: { x: false, y: false }
       },
       hooks: {
         draw: [
           (u) => {
             const ctx = u.ctx;
             const xScaleEnd = u.valToPos(Math.min(60, months[months.length - 1]), 'x', true);
             const xScaleStart = u.valToPos(0, 'x', true);
             const yTop = u.bbox.top;
             const yBottom = u.bbox.top + u.bbox.height;

             ctx.save();
             ctx.fillStyle = 'rgba(189, 149, 68, 0.08)';
             ctx.fillRect(xScaleStart, yTop, xScaleEnd - xScaleStart, yBottom - yTop);
             ctx.restore();
           }
         ]
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
      chart.setSize({ width: chartContainer.clientWidth, height: 300 });
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
    if (scheduleWithOverpayment && scheduleWithoutOverpayment && chartContainer) {
      chart?.destroy();
      createChart();
    }
  });

  // Calculate total savings for display
  const totalSavings = $derived(
    scheduleWithoutOverpayment.summary.totalInterest
      .minus(scheduleWithOverpayment.summary.totalInterest)
      .toDecimalPlaces(2)
      .toNumber()
  );

  const monthsSaved = $derived(
    scheduleWithoutOverpayment.summary.totalMonths - scheduleWithOverpayment.summary.totalMonths
  );
</script>

<div class="savings-chart">
  <h3 class="savings-chart__title">{title}</h3>

  <div class="savings-chart__summary">
    <div class="savings-chart__stat">
      <span class="savings-chart__stat-label">Łączne oszczędności na odsetkach</span>
      <span class="savings-chart__stat-value savings-chart__stat-value--positive">
        {totalSavings.toLocaleString('pl-PL')} zł
      </span>
    </div>
    {#if monthsSaved > 0}
      <div class="savings-chart__stat">
        <span class="savings-chart__stat-label">Skrócenie kredytu</span>
        <span class="savings-chart__stat-value">
          {monthsSaved} {monthsSaved === 1 ? 'miesiąc' : monthsSaved < 5 ? 'miesiące' : 'miesięcy'}
        </span>
      </div>
    {/if}
  </div>

   <div bind:this={chartContainer} class="savings-chart__container"></div>

   <div class="savings-chart__note">
     💡 <strong>Pierwsze 5 lat (żółte tło):</strong> Okres najwyższych odsetek - nadpłaty w tym czasie przynoszą największe oszczędności
   </div>
 </div>

<style>
  .savings-chart {
    margin: var(--space-lg) 0;
  }

  .savings-chart__title {
    font-family: var(--font-heading);
    font-size: var(--text-lg);
    font-weight: 600;
    color: var(--color-burgundy);
    margin: 0 0 var(--space-md) 0;
  }

  .savings-chart__summary {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-lg);
    margin-bottom: var(--space-md);
  }

  .savings-chart__stat {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }

  .savings-chart__stat-label {
    font-family: var(--font-body);
    font-size: var(--text-sm);
    color: var(--color-ink-light);
  }

  .savings-chart__stat-value {
    font-family: var(--font-heading);
    font-size: var(--text-2xl);
    font-weight: 700;
    color: var(--color-ink);
  }

  .savings-chart__stat-value--positive {
    color: var(--color-success);
  }

   .savings-chart__container {
     width: 100%;
     background: var(--color-cream);
     border: 1px solid var(--color-gold);
     border-radius: var(--radius-md);
     padding: var(--space-sm);
   }

   .savings-chart__note {
     margin-top: var(--space-sm);
     padding: var(--space-sm);
     background: var(--color-parchment);
     border-left: 3px solid var(--color-gold);
     font-family: var(--font-body);
     font-size: var(--text-xs);
     color: var(--color-ink-light);
     border-radius: var(--radius-sm);
   }

   .savings-chart__note strong {
     color: var(--color-ink);
     font-weight: 600;
   }
 </style>

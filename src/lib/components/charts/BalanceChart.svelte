<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import uPlot from 'uplot';
  import 'uplot/dist/uPlot.min.css';
  import type { Schedule } from '$lib/engine/types';

  interface Props {
    schedule: Schedule;
    title?: string;
  }

  let { schedule, title = 'Saldo kredytu w czasie' }: Props = $props();

  let chartContainer: HTMLDivElement;
  let chart: uPlot | null = null;

  function createChart() {
    if (!chartContainer || schedule.rows.length === 0) return;

    // Prepare data
    const months = schedule.rows.map(row => row.month);
    const balances = schedule.rows.map(row => row.balanceAfter.toNumber());

    const data: uPlot.AlignedData = [months, balances];

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
          label: 'Saldo (zł)',
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
          label: 'Saldo',
          stroke: '#730000',
          width: 2,
          fill: 'rgba(115, 0, 0, 0.1)'
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

  // Reactively recreate chart when schedule changes
  $effect(() => {
    if (schedule && chartContainer) {
      chart?.destroy();
      createChart();
    }
  });
</script>

<div class="balance-chart">
   <h3 class="balance-chart__title">{title}</h3>
   <div bind:this={chartContainer} class="balance-chart__container"></div>

   <div class="balance-chart__note">
     💡 <strong>Pierwsze 5 lat (żółte tło):</strong> Okres najwyższych odsetek - nadpłaty w tym czasie przynoszą największe oszczędności
   </div>

   <!-- Accessible data table -->
  <details class="balance-chart__details">
    <summary>Pokaż dane w tabeli</summary>
    <div class="balance-chart__table-wrapper">
      <table class="balance-chart__table">
        <thead>
          <tr>
            <th>Miesiąc</th>
            <th>Saldo (zł)</th>
            <th>Rata (zł)</th>
            <th>Odsetki (zł)</th>
          </tr>
        </thead>
        <tbody>
          {#each schedule.rows.filter((_, i) => i % 12 === 0 || i === schedule.rows.length - 1) as row}
            <tr>
              <td>{row.month}</td>
              <td>{row.balanceAfter.toDecimalPlaces(2).toNumber().toLocaleString('pl-PL')}</td>
              <td>{row.payment.toDecimalPlaces(2).toNumber().toLocaleString('pl-PL')}</td>
              <td>{row.interest.toDecimalPlaces(2).toNumber().toLocaleString('pl-PL')}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </details>
</div>

<style>
  .balance-chart {
    margin: var(--space-lg) 0;
  }

  .balance-chart__title {
    font-family: var(--font-heading);
    font-size: var(--text-lg);
    font-weight: 600;
    color: var(--color-burgundy);
    margin: 0 0 var(--space-md) 0;
  }

   .balance-chart__container {
     width: 100%;
     background: var(--color-cream);
     border: 1px solid var(--color-gold);
     border-radius: var(--radius-md);
     padding: var(--space-sm);
   }

   .balance-chart__note {
     margin-top: var(--space-sm);
     padding: var(--space-sm);
     background: var(--color-parchment);
     border-left: 3px solid var(--color-gold);
     font-family: var(--font-body);
     font-size: var(--text-xs);
     color: var(--color-ink-light);
     border-radius: var(--radius-sm);
   }

   .balance-chart__note strong {
     color: var(--color-ink);
     font-weight: 600;
   }

   .balance-chart__details {
    margin-top: var(--space-md);
    font-family: var(--font-body);
  }

  .balance-chart__details summary {
    cursor: pointer;
    color: var(--color-burgundy);
    font-weight: 500;
  }

  .balance-chart__details summary:focus {
    outline: none;
    box-shadow: var(--focus-ring);
    border-radius: var(--radius-sm);
  }

  .balance-chart__table-wrapper {
    overflow-x: auto;
    margin-top: var(--space-sm);
  }

  .balance-chart__table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--text-sm);
  }

  .balance-chart__table th,
  .balance-chart__table td {
    padding: var(--space-xs) var(--space-sm);
    text-align: right;
    border-bottom: 1px solid var(--color-parchment-dark);
  }

  .balance-chart__table th {
    font-weight: 600;
    background: var(--color-parchment);
  }

  .balance-chart__table th:first-child,
  .balance-chart__table td:first-child {
    text-align: left;
  }
</style>

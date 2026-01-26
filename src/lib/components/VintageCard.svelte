<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    title?: string;
    variant?: 'default' | 'highlight' | 'subtle';
    children: Snippet;
  }

  let { title, variant = 'default', children }: Props = $props();
</script>

<div class="vintage-card vintage-card--{variant}">
  {#if title}
    <h2 class="vintage-card__title">{title}</h2>
  {/if}
  <div class="vintage-card__content">
    {@render children()}
  </div>
  <!-- Ornamental corners -->
  <div class="vintage-card__corner vintage-card__corner--tl"></div>
  <div class="vintage-card__corner vintage-card__corner--tr"></div>
  <div class="vintage-card__corner vintage-card__corner--bl"></div>
  <div class="vintage-card__corner vintage-card__corner--br"></div>
</div>

<style>
  .vintage-card {
    position: relative;
    background: var(--color-parchment);
    border: 2px solid var(--color-gold);
    padding: var(--space-lg);
    margin: var(--space-md) 0;
  }

  .vintage-card--highlight {
    background: var(--color-cream);
    border-color: var(--color-burgundy);
  }

  .vintage-card--subtle {
    background: var(--color-parchment-dark);
    border-color: var(--color-gold-light);
    border-width: 1px;
  }

  .vintage-card__title {
    font-family: var(--font-heading);
    font-size: var(--text-xl);
    font-weight: 600;
    color: var(--color-burgundy);
    margin: 0 0 var(--space-md) 0;
    padding-bottom: var(--space-sm);
    border-bottom: 1px solid var(--color-gold);
  }

  .vintage-card__content {
    font-family: var(--font-body);
    color: var(--color-ink);
    line-height: 1.6;
  }

  /* Ornamental corners */
  .vintage-card__corner {
    position: absolute;
    width: 16px;
    height: 16px;
    border-color: var(--color-gold-decorative);
    border-style: solid;
    border-width: 0;
  }

  .vintage-card--highlight .vintage-card__corner {
    border-color: var(--color-burgundy);
  }

  .vintage-card__corner--tl {
    top: -2px;
    left: -2px;
    border-top-width: 3px;
    border-left-width: 3px;
  }

  .vintage-card__corner--tr {
    top: -2px;
    right: -2px;
    border-top-width: 3px;
    border-right-width: 3px;
  }

  .vintage-card__corner--bl {
    bottom: -2px;
    left: -2px;
    border-bottom-width: 3px;
    border-left-width: 3px;
  }

  .vintage-card__corner--br {
    bottom: -2px;
    right: -2px;
    border-bottom-width: 3px;
    border-right-width: 3px;
  }
</style>

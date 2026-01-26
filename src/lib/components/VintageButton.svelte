<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    type?: 'button' | 'submit' | 'reset';
    variant?: 'primary' | 'secondary' | 'ghost';
    size?: 'sm' | 'md' | 'lg';
    disabled?: boolean;
    loading?: boolean;
    onclick?: (e: MouseEvent) => void;
    children: Snippet;
  }

  let {
    type = 'button',
    variant = 'primary',
    size = 'md',
    disabled = false,
    loading = false,
    onclick,
    children
  }: Props = $props();

  const isDisabled = $derived(disabled || loading);
</script>

<button
  {type}
  class="vintage-button vintage-button--{variant} vintage-button--{size}"
  disabled={isDisabled}
  aria-busy={loading ? 'true' : undefined}
  {onclick}
>
  {#if loading}
    <span class="vintage-button__spinner" aria-hidden="true"></span>
  {/if}
  <span class="vintage-button__content" class:vintage-button__content--loading={loading}>
    {@render children()}
  </span>
</button>

<style>
  .vintage-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-sm);
    font-family: var(--font-heading);
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    border: 2px solid transparent;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: all var(--transition-fast);
    min-height: 44px; /* Touch target */
    min-width: 44px;
  }

  /* Sizes */
  .vintage-button--sm {
    padding: var(--space-xs) var(--space-md);
    font-size: var(--text-xs);
  }

  .vintage-button--md {
    padding: var(--space-sm) var(--space-lg);
    font-size: var(--text-sm);
  }

  .vintage-button--lg {
    padding: var(--space-md) var(--space-xl);
    font-size: var(--text-base);
  }

  /* Primary variant */
  .vintage-button--primary {
    background: var(--color-burgundy);
    color: var(--color-cream);
    border-color: var(--color-burgundy);
  }

  .vintage-button--primary:hover:not(:disabled) {
    background: var(--color-burgundy-light);
    border-color: var(--color-burgundy-light);
  }

  .vintage-button--primary:active:not(:disabled) {
    background: var(--color-burgundy-dark);
    border-color: var(--color-burgundy-dark);
  }

  /* Secondary variant */
  .vintage-button--secondary {
    background: transparent;
    color: var(--color-burgundy);
    border-color: var(--color-burgundy);
  }

  .vintage-button--secondary:hover:not(:disabled) {
    background: var(--color-burgundy);
    color: var(--color-cream);
  }

  .vintage-button--secondary:active:not(:disabled) {
    background: var(--color-burgundy-dark);
    border-color: var(--color-burgundy-dark);
  }

  /* Ghost variant */
  .vintage-button--ghost {
    background: transparent;
    color: var(--color-ink);
    border-color: transparent;
  }

  .vintage-button--ghost:hover:not(:disabled) {
    background: var(--color-parchment-dark);
  }

  .vintage-button--ghost:active:not(:disabled) {
    background: var(--color-parchment);
  }

  /* Focus state */
  .vintage-button:focus {
    outline: none;
    box-shadow: var(--focus-ring);
  }

  /* Disabled state */
  .vintage-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Loading spinner */
  .vintage-button__spinner {
    width: 1em;
    height: 1em;
    border: 2px solid currentColor;
    border-right-color: transparent;
    border-radius: 50%;
    animation: spin 0.75s linear infinite;
  }

  .vintage-button__content--loading {
    opacity: 0.7;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>

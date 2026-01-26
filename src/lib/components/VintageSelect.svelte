<script lang="ts">
  interface Option {
    value: string;
    label: string;
    disabled?: boolean;
  }

  interface Props {
    label: string;
    name: string;
    options: Option[];
    value?: string;
    placeholder?: string;
    error?: string;
    hint?: string;
    required?: boolean;
    disabled?: boolean;
    onchange?: (e: Event) => void;
  }

  let {
    label,
    name,
    options,
    value = $bindable(''),
    placeholder = 'Wybierz...',
    error,
    hint,
    required = false,
    disabled = false,
    onchange
  }: Props = $props();

  const selectId = `select-${name}`;
  const errorId = `error-${name}`;
  const hintId = `hint-${name}`;
</script>

<div class="vintage-select" class:vintage-select--error={error} class:vintage-select--disabled={disabled}>
  <label for={selectId} class="vintage-select__label">
    {label}
    {#if required}
      <span class="vintage-select__required" aria-hidden="true">*</span>
    {/if}
  </label>

  <div class="vintage-select__wrapper">
    <select
      id={selectId}
      {name}
      bind:value
      {required}
      {disabled}
      class="vintage-select__field"
      aria-invalid={error ? 'true' : undefined}
      aria-describedby={error ? errorId : hint ? hintId : undefined}
      {onchange}
    >
      {#if placeholder}
        <option value="" disabled>{placeholder}</option>
      {/if}
      {#each options as option}
        <option value={option.value} disabled={option.disabled}>
          {option.label}
        </option>
      {/each}
    </select>
    <span class="vintage-select__arrow" aria-hidden="true">
      <svg width="12" height="8" viewBox="0 0 12 8" fill="none">
        <path d="M1 1.5L6 6.5L11 1.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </span>
  </div>

  {#if error}
    <p id={errorId} class="vintage-select__error" role="alert">
      {error}
    </p>
  {:else if hint}
    <p id={hintId} class="vintage-select__hint">
      {hint}
    </p>
  {/if}
</div>

<style>
  .vintage-select {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
    margin-bottom: var(--space-md);
  }

  .vintage-select__label {
    font-family: var(--font-heading);
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--color-ink);
    letter-spacing: 0.025em;
  }

  .vintage-select__required {
    color: var(--color-burgundy);
    margin-left: var(--space-xs);
  }

  .vintage-select__wrapper {
    position: relative;
    display: flex;
    align-items: center;
  }

  .vintage-select__field {
    width: 100%;
    padding: var(--space-sm) var(--space-md);
    padding-right: 2.5rem;
    font-family: var(--font-body);
    font-size: var(--text-base);
    color: var(--color-ink);
    background: var(--color-cream);
    border: 1px solid var(--color-gold);
    border-radius: var(--radius-sm);
    cursor: pointer;
    appearance: none;
    transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
    min-height: 44px; /* Touch target */
  }

  .vintage-select__field:hover:not(:disabled) {
    border-color: var(--color-gold-light);
  }

  .vintage-select__field:focus {
    outline: none;
    border-color: var(--color-burgundy);
    box-shadow: var(--focus-ring);
  }

  .vintage-select__field:disabled {
    background: var(--color-parchment-dark);
    cursor: not-allowed;
    opacity: 0.7;
  }

  .vintage-select__arrow {
    position: absolute;
    right: var(--space-md);
    color: var(--color-ink-light);
    pointer-events: none;
    transition: transform var(--transition-fast);
  }

  .vintage-select__field:focus + .vintage-select__arrow {
    color: var(--color-burgundy);
  }

  .vintage-select__hint {
    font-family: var(--font-body);
    font-size: var(--text-xs);
    color: var(--color-ink-light);
    margin: 0;
  }

  .vintage-select__error {
    font-family: var(--font-body);
    font-size: var(--text-xs);
    color: var(--color-error);
    margin: 0;
  }

  /* Error state */
  .vintage-select--error .vintage-select__field {
    border-color: var(--color-error);
  }

  .vintage-select--error .vintage-select__field:focus {
    box-shadow: 0 0 0 3px rgba(198, 40, 40, 0.3);
  }

  /* Disabled state */
  .vintage-select--disabled .vintage-select__label {
    opacity: 0.7;
  }
</style>

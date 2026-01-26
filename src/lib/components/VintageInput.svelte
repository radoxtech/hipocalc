<script lang="ts">
  interface Props {
    label: string;
    name: string;
    type?: 'text' | 'number' | 'email';
    value?: string | number;
    placeholder?: string;
    error?: string;
    hint?: string;
    required?: boolean;
    disabled?: boolean;
    min?: number;
    max?: number;
    step?: number;
    suffix?: string;
    oninput?: (e: Event) => void;
    onchange?: (e: Event) => void;
  }

  let {
    label,
    name,
    type = 'text',
    value = $bindable(''),
    placeholder = '',
    error,
    hint,
    required = false,
    disabled = false,
    min,
    max,
    step,
    suffix,
    oninput,
    onchange
  }: Props = $props();

  const inputId = `input-${name}`;
  const errorId = `error-${name}`;
  const hintId = `hint-${name}`;
</script>

<div class="vintage-input" class:vintage-input--error={error} class:vintage-input--disabled={disabled}>
  <label for={inputId} class="vintage-input__label">
    {label}
    {#if required}
      <span class="vintage-input__required" aria-hidden="true">*</span>
    {/if}
  </label>

  <div class="vintage-input__wrapper">
    <input
      id={inputId}
      {name}
      {type}
      bind:value
      {placeholder}
      {required}
      {disabled}
      {min}
      {max}
      {step}
      class="vintage-input__field"
      aria-invalid={error ? 'true' : undefined}
      aria-describedby={error ? errorId : hint ? hintId : undefined}
      {oninput}
      {onchange}
    />
    {#if suffix}
      <span class="vintage-input__suffix">{suffix}</span>
    {/if}
  </div>

  {#if error}
    <p id={errorId} class="vintage-input__error" role="alert">
      {error}
    </p>
  {:else if hint}
    <p id={hintId} class="vintage-input__hint">
      {hint}
    </p>
  {/if}
</div>

<style>
  .vintage-input {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
    margin-bottom: var(--space-md);
  }

  .vintage-input__label {
    font-family: var(--font-heading);
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--color-ink);
    letter-spacing: 0.025em;
  }

  .vintage-input__required {
    color: var(--color-burgundy);
    margin-left: var(--space-xs);
  }

  .vintage-input__wrapper {
    position: relative;
    display: flex;
    align-items: center;
  }

  .vintage-input__field {
    width: 100%;
    padding: var(--space-sm) var(--space-md);
    font-family: var(--font-body);
    font-size: var(--text-base);
    color: var(--color-ink);
    background: var(--color-cream);
    border: 1px solid var(--color-gold);
    border-radius: var(--radius-sm);
    transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
    min-height: 44px; /* Touch target */
  }

  .vintage-input__field::placeholder {
    color: var(--color-ink-light);
    opacity: 0.7;
  }

  .vintage-input__field:hover:not(:disabled) {
    border-color: var(--color-gold-light);
  }

  .vintage-input__field:focus {
    outline: none;
    border-color: var(--color-burgundy);
    box-shadow: var(--focus-ring);
  }

  .vintage-input__field:disabled {
    background: var(--color-parchment-dark);
    cursor: not-allowed;
    opacity: 0.7;
  }

  /* Number input - remove spinners */
  .vintage-input__field[type="number"]::-webkit-inner-spin-button,
  .vintage-input__field[type="number"]::-webkit-outer-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
  .vintage-input__field[type="number"] {
    -moz-appearance: textfield;
  }

  .vintage-input__suffix {
    position: absolute;
    right: var(--space-md);
    font-family: var(--font-body);
    font-size: var(--text-sm);
    color: var(--color-ink-light);
    pointer-events: none;
  }

  .vintage-input__field:has(+ .vintage-input__suffix) {
    padding-right: 3rem;
  }

  .vintage-input__hint {
    font-family: var(--font-body);
    font-size: var(--text-xs);
    color: var(--color-ink-light);
    margin: 0;
  }

  .vintage-input__error {
    font-family: var(--font-body);
    font-size: var(--text-xs);
    color: var(--color-error);
    margin: 0;
  }

  /* Error state */
  .vintage-input--error .vintage-input__field {
    border-color: var(--color-error);
  }

  .vintage-input--error .vintage-input__field:focus {
    box-shadow: 0 0 0 3px rgba(198, 40, 40, 0.3);
  }

  /* Disabled state */
  .vintage-input--disabled .vintage-input__label {
    opacity: 0.7;
  }
</style>

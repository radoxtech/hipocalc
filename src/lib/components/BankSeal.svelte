<script lang="ts">
  interface Props {
    size?: 'sm' | 'md' | 'lg';
    text?: string;
  }

  let { size = 'md', text = 'HIPOCALC' }: Props = $props();
</script>

<div class="bank-seal bank-seal--{size}" aria-hidden="true">
  <div class="bank-seal__outer">
    <div class="bank-seal__inner">
      <span class="bank-seal__text">{text}</span>
      <span class="bank-seal__year">ANNO 2025</span>
    </div>
  </div>
</div>

<style>
  .bank-seal {
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .bank-seal__outer {
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: linear-gradient(135deg, var(--color-gold-light) 0%, var(--color-gold) 50%, var(--color-gold-light) 100%);
    box-shadow: 
      0 2px 4px rgba(0, 0, 0, 0.2),
      inset 0 1px 2px rgba(255, 255, 255, 0.3);
  }

  .bank-seal__inner {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: var(--color-burgundy);
    border: 2px solid var(--color-gold);
  }

  .bank-seal__text {
    font-family: var(--font-heading);
    font-weight: 700;
    color: var(--color-gold);
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .bank-seal__year {
    font-family: var(--font-body);
    font-weight: 500;
    color: var(--color-gold-light);
    letter-spacing: 0.05em;
  }

  /* Sizes */
  .bank-seal--sm .bank-seal__outer {
    width: 60px;
    height: 60px;
    padding: 4px;
  }

  .bank-seal--sm .bank-seal__inner {
    width: 52px;
    height: 52px;
  }

  .bank-seal--sm .bank-seal__text {
    font-size: 8px;
  }

  .bank-seal--sm .bank-seal__year {
    font-size: 6px;
  }

  .bank-seal--md .bank-seal__outer {
    width: 100px;
    height: 100px;
    padding: 6px;
  }

  .bank-seal--md .bank-seal__inner {
    width: 88px;
    height: 88px;
  }

  .bank-seal--md .bank-seal__text {
    font-size: 12px;
  }

  .bank-seal--md .bank-seal__year {
    font-size: 9px;
  }

  .bank-seal--lg .bank-seal__outer {
    width: 140px;
    height: 140px;
    padding: 8px;
  }

  .bank-seal--lg .bank-seal__inner {
    width: 124px;
    height: 124px;
  }

  .bank-seal--lg .bank-seal__text {
    font-size: 16px;
  }

  .bank-seal--lg .bank-seal__year {
    font-size: 11px;
  }
</style>

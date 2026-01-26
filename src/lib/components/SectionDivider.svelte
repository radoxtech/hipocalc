<script lang="ts">
  interface Props {
    variant?: 'simple' | 'ornate';
  }

  let { variant = 'simple' }: Props = $props();
</script>

<div class="section-divider section-divider--{variant}" role="separator" aria-hidden="true">
  {#if variant === 'ornate'}
    <span class="section-divider__ornament">&#x2766;</span>
  {/if}
</div>

<style>
  .section-divider {
    display: flex;
    align-items: center;
    justify-content: center;
    margin: var(--space-xl) 0;
  }

  .section-divider--simple {
    height: 1px;
    background: linear-gradient(
      90deg,
      transparent 0%,
      var(--color-gold) 20%,
      var(--color-gold) 80%,
      transparent 100%
    );
  }

  .section-divider--ornate {
    gap: var(--space-md);
  }

  .section-divider--ornate::before,
  .section-divider--ornate::after {
    content: '';
    flex: 1;
    height: 1px;
    background: linear-gradient(
      90deg,
      transparent 0%,
      var(--color-gold) 100%
    );
  }

  .section-divider--ornate::after {
    background: linear-gradient(
      90deg,
      var(--color-gold) 0%,
      transparent 100%
    );
  }

  .section-divider__ornament {
    font-size: var(--text-2xl);
    color: var(--color-gold-decorative);
    line-height: 1;
  }
</style>

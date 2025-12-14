<script lang="ts">
  import { confirmStore } from '$lib/stores/confirm';
  import { fade, scale } from 'svelte/transition';

  $: state = $confirmStore;
  $: options = state.options;

  $: variantStyles = {
    danger: {
      icon: '!',
      iconBg: 'bg-error/20',
      iconColor: 'text-error',
      buttonClass: 'btn-error'
    },
    warning: {
      icon: '!',
      iconBg: 'bg-warning/20',
      iconColor: 'text-warning',
      buttonClass: 'btn-warning'
    },
    info: {
      icon: '?',
      iconBg: 'bg-info/20',
      iconColor: 'text-info',
      buttonClass: 'btn-info'
    }
  };

  $: variant = options?.variant || 'danger';
  $: styles = variantStyles[variant];

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && state.open) {
      event.preventDefault();
      confirmStore.handleCancel();
    }
  }

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      confirmStore.handleCancel();
    }
  }

  $: if (typeof window !== 'undefined') {
    if (state.open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if state.open && options}
  <div
    class="fixed inset-0 z-[100] flex items-center justify-center p-4"
    transition:fade={{ duration: 150 }}
    on:click={handleBackdropClick}
    on:keydown={handleKeydown}
    role="dialog"
    aria-modal="true"
    aria-labelledby="confirm-title"
    aria-describedby="confirm-message"
  >
    <div class="fixed inset-0 bg-black/60 backdrop-blur-sm" aria-hidden="true"></div>

    <div
      class="relative bg-base-200 rounded-2xl shadow-2xl max-w-sm w-full p-6"
      transition:scale={{ duration: 200, start: 0.95 }}
    >
      <div class="flex flex-col items-center text-center">
        <div class="w-14 h-14 rounded-full {styles.iconBg} flex items-center justify-center mb-4">
          <span class="text-2xl font-bold {styles.iconColor}">{styles.icon}</span>
        </div>

        <h3 id="confirm-title" class="text-lg font-semibold mb-2">
          {options.title}
        </h3>

        <p id="confirm-message" class="text-base-content/70 text-sm mb-6">
          {options.message}
        </p>

        <div class="flex gap-3 w-full">
          <button
            class="btn btn-ghost flex-1"
            on:click={confirmStore.handleCancel}
          >
            {options.cancelLabel}
          </button>
          <button
            class="btn {options.confirmButtonClass || styles.buttonClass} flex-1"
            on:click={confirmStore.handleConfirm}
          >
            {options.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-5px); }
    75% { transform: translateX(5px); }
  }
</style>

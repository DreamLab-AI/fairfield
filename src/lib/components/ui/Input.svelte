<script lang="ts">
  export let placeholder = '';
  export let value = '';
  export let error = '';
  export let label = '';
  export let disabled = false;
  export let required = false;
  export let autocomplete: string | undefined = undefined;
  export let inputType: 'text' | 'email' | 'password' | 'number' | 'url' = 'text';

  let inputElement: HTMLInputElement;

  export function focus() {
    inputElement?.focus();
  }

  $: hasError = error.length > 0;
  $: inputId = $$restProps.id || label.toLowerCase().replace(/\s+/g, '-');
  $: errorId = `${inputId}-error`;
</script>

<div class="form-control w-full">
  {#if label}
    <label class="label" for={inputId}>
      <span class="label-text">
        {label}
        {#if required}
          <span class="text-error">*</span>
        {/if}
      </span>
    </label>
  {/if}

  <!-- Input with proper ARIA attributes for accessibility -->
  {#if inputType === 'password'}
    <input
      bind:this={inputElement}
      type="password"
      id={inputId}
      {placeholder}
      {disabled}
      {required}
      {autocomplete}
      bind:value
      class="input input-bordered w-full focus-ring {hasError ? 'input-error' : 'focus:input-primary'}"
      aria-invalid={hasError}
      aria-describedby={hasError ? errorId : undefined}
      aria-required={required}
      on:input
      on:change
      on:focus
      on:blur
      on:keydown
      on:keyup
      on:keypress
      {...$$restProps}
    />
  {:else if inputType === 'email'}
    <input
      bind:this={inputElement}
      type="email"
      id={inputId}
      {placeholder}
      {disabled}
      {required}
      {autocomplete}
      bind:value
      class="input input-bordered w-full focus-ring {hasError ? 'input-error' : 'focus:input-primary'}"
      aria-invalid={hasError}
      aria-describedby={hasError ? errorId : undefined}
      aria-required={required}
      on:input
      on:change
      on:focus
      on:blur
      on:keydown
      on:keyup
      on:keypress
      {...$$restProps}
    />
  {:else if inputType === 'number'}
    <input
      bind:this={inputElement}
      type="number"
      id={inputId}
      {placeholder}
      {disabled}
      {required}
      {autocomplete}
      bind:value
      class="input input-bordered w-full focus-ring {hasError ? 'input-error' : 'focus:input-primary'}"
      aria-invalid={hasError}
      aria-describedby={hasError ? errorId : undefined}
      aria-required={required}
      on:input
      on:change
      on:focus
      on:blur
      on:keydown
      on:keyup
      on:keypress
      {...$$restProps}
    />
  {:else if inputType === 'url'}
    <input
      bind:this={inputElement}
      type="url"
      id={inputId}
      {placeholder}
      {disabled}
      {required}
      {autocomplete}
      bind:value
      class="input input-bordered w-full focus-ring {hasError ? 'input-error' : 'focus:input-primary'}"
      aria-invalid={hasError}
      aria-describedby={hasError ? errorId : undefined}
      aria-required={required}
      on:input
      on:change
      on:focus
      on:blur
      on:keydown
      on:keyup
      on:keypress
      {...$$restProps}
    />
  {:else}
    <input
      bind:this={inputElement}
      type="text"
      id={inputId}
      {placeholder}
      {disabled}
      {required}
      {autocomplete}
      bind:value
      class="input input-bordered w-full focus-ring {hasError ? 'input-error' : 'focus:input-primary'}"
      aria-invalid={hasError}
      aria-describedby={hasError ? errorId : undefined}
      aria-required={required}
      on:input
      on:change
      on:focus
      on:blur
      on:keydown
      on:keyup
      on:keypress
      {...$$restProps}
    />
  {/if}

  {#if hasError}
    <span class="label" id={errorId} role="alert">
      <span class="label-text-alt text-error">{error}</span>
    </span>
  {/if}
</div>

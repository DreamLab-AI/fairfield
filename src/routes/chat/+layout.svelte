<script lang="ts">
  /**
   * Chat Layout
   * Removed duplicate SectionsPanel - uses root layout's ZoneNav instead
   */
</script>

<div class="chat-layout flex min-h-[calc(100vh-4rem)]">
  <!-- Main Content - zones navigation provided by root layout -->
  <div class="flex-1 overflow-x-hidden">
    <slot />
  </div>
</div>

<style>
  .chat-layout {
    position: relative;
  }
</style>

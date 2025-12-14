/**
 * Haptic Feedback Utilities
 * Provides tactile feedback on supported devices
 */

type HapticPattern = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' | 'selection';

const patterns: Record<HapticPattern, number | number[]> = {
  light: 10,
  medium: 25,
  heavy: 50,
  success: [10, 50, 10],
  warning: [25, 50, 25],
  error: [50, 100, 50],
  selection: 5
};

/**
 * Check if vibration API is supported
 */
export function isHapticsSupported(): boolean {
  return typeof navigator !== 'undefined' && 'vibrate' in navigator;
}

/**
 * Trigger haptic feedback
 */
export function haptic(pattern: HapticPattern = 'light'): void {
  if (!isHapticsSupported()) return;

  try {
    const vibrationPattern = patterns[pattern];
    navigator.vibrate(vibrationPattern);
  } catch {
    // Silently fail - haptics are enhancement only
  }
}

/**
 * Light tap feedback for UI interactions
 */
export function hapticTap(): void {
  haptic('light');
}

/**
 * Selection change feedback
 */
export function hapticSelect(): void {
  haptic('selection');
}

/**
 * Success feedback
 */
export function hapticSuccess(): void {
  haptic('success');
}

/**
 * Warning feedback
 */
export function hapticWarning(): void {
  haptic('warning');
}

/**
 * Error feedback
 */
export function hapticError(): void {
  haptic('error');
}

/**
 * Custom vibration pattern
 */
export function hapticCustom(pattern: number | number[]): void {
  if (!isHapticsSupported()) return;

  try {
    navigator.vibrate(pattern);
  } catch {
    // Silently fail
  }
}

/**
 * Stop any ongoing vibration
 */
export function hapticStop(): void {
  if (!isHapticsSupported()) return;

  try {
    navigator.vibrate(0);
  } catch {
    // Silently fail
  }
}

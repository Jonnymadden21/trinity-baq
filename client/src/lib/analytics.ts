import posthog from "posthog-js";

// Single safe wrapper used by all event firers. Never throws — if PostHog is
// blocked (ad-blocker, offline, not initialized) we silently no-op so UI code
// never has to guard around analytics.
export function track(event: string, properties?: Record<string, unknown>): void {
  try {
    posthog.capture(event, properties);
  } catch {
    /* swallow */
  }
}

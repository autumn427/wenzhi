export type TelemetryEventName =
  | 'session_start'
  | 'page_load'
  | 'scene_view'
  | 'route_enter'
  | 'choice_made'
  | 'source_open'
  | 'live_search_result'
  | 'live_search_error'
  | 'journey_complete'
  | 'experiment_cta'
  | 'experiment_generated'

type TelemetryContext = {
  routeCode?: 'A' | 'B' | 'C'
  day?: number
  value?: number
}

/**
 * Send only coarse, non-content product events. Profile text, source text and
 * user actions are deliberately excluded so the metric endpoint can aggregate
 * without retaining a replayable user session.
 */
export function trackTelemetry(event: TelemetryEventName, context: TelemetryContext = {}) {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return
  const routeCode = context.routeCode && ['A', 'B', 'C'].includes(context.routeCode) ? context.routeCode : undefined
  const day = typeof context.day === 'number' && [30, 90, 150, 180].includes(context.day) ? context.day : undefined
  const value = typeof context.value === 'number' && Number.isFinite(context.value)
    ? Math.max(0, Math.min(100_000, Math.round(context.value)))
    : undefined
  const release = new URLSearchParams(window.location.search).get('release')?.slice(0, 80) || undefined
  const payload = JSON.stringify({
    event,
    routeCode,
    day,
    value,
    device: window.matchMedia('(max-width: 760px)').matches ? 'mobile' : 'desktop',
    release,
  })
  try {
    const blob = new Blob([payload], { type: 'application/json' })
    if (navigator.sendBeacon?.('/api/telemetry', blob)) return
  } catch {
    // Fall through to keepalive fetch where sendBeacon is unavailable.
  }
  void fetch('/api/telemetry', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload,
    keepalive: true,
  }).catch(() => undefined)
}

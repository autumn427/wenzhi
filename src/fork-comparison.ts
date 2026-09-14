import type { SimulationProfile, UniverseRun } from './simulation'
import { compareEcho, type EchoContext } from './echo-context'

export type ForkSource = { id: string; title: string; excerpt: string; sourceUrl: string; author: string; relevanceScore?: number }
export type ForkResult = { choiceId: string; action: string; run: UniverseRun; cost: string; remaining: string; sourceIds: string[] }
export type ForkRecord = { version: 1; identity: string; source: ForkSource | null; results: ForkResult[] }

// Include the entire input, not just the event ID. A different profile, history,
// experiment cycle or edited opening must never reuse an old counterfactual.
export function forkIdentity(run: UniverseRun, profile: SimulationProfile, cycle: number) {
  return JSON.stringify([cycle, profile, run])
}

export function pickForkSource(items: ForkSource[], context: EchoContext): ForkSource | null {
  const seen = new Set<string>()
  return items.filter(item => {
    if (!item || typeof item.excerpt !== 'string' || !item.excerpt.trim() || typeof item.title !== 'string') return false
    try {
      const url = new URL(item.sourceUrl)
      if (url.protocol !== 'https:' || !['www.zhihu.com', 'zhuanlan.zhihu.com'].includes(url.hostname)) return false
      const key = url.origin + url.pathname
      if (seen.has(key)) return false
      seen.add(key)
    } catch { return false }
    return compareEcho(context, item).matches.length > 0 && (item.relevanceScore === undefined || item.relevanceScore >= .08)
  }).sort((a, b) => (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0))[0] ?? null
}

export function validForkResult(base: UniverseRun, result: ForkResult) {
  const decision = result?.run?.decisions?.[result.run.decisions.length - 1]
  return Boolean(result && base.currentEvent.choices.some(c => c.id === result.choiceId && c.label === result.action)
    && result.run?.code === base.code && result.run.currentEvent?.day === 90
    && result.run.state && Object.values(result.run.state).every(value => typeof value === 'number' && Number.isFinite(value))
    && Array.isArray(result.run.flags) && Array.isArray(result.run.closedOpportunities) && Array.isArray(result.run.workSamples)
    && typeof result.run.currentEvent.story === 'string' && typeof result.run.currentEvent.tension === 'string'
    && Array.isArray(result.run.currentEvent.choices) && result.run.currentEvent.choices.length === 2
    && JSON.stringify(result.run.route) === JSON.stringify(base.route)
    && result.run.decisions.length === base.decisions.length + 1
    && JSON.stringify(result.run.decisions.slice(0, -1)) === JSON.stringify(base.decisions)
    && JSON.stringify(decision?.stateBefore) === JSON.stringify(base.state)
    && JSON.stringify(decision?.eventSnapshot) === JSON.stringify(base.currentEvent)
    && typeof result.cost === 'string' && typeof result.remaining === 'string'
    && Array.isArray(result.sourceIds))
}

export function readForkRecord(raw: string | null, identity: string, base: UniverseRun): ForkRecord | null {
  try {
    const record = JSON.parse(raw || 'null') as ForkRecord
    if (record?.version !== 1 || record.identity !== identity || !Array.isArray(record.results)
      || record.results.length > 2 || !record.results.every(result => validForkResult(base, result))
      || new Set(record.results.map(r => r.choiceId)).size !== record.results.length) return null
    if (record.source && (!/^https:\/\/(www|zhuanlan)\.zhihu\.com\//.test(record.source.sourceUrl)
      || typeof record.source.excerpt !== 'string' || typeof record.source.title !== 'string')) return null
    return record
  } catch { return null }
}

export function keepForkResult(record: ForkRecord, base: UniverseRun, result: ForkResult): ForkRecord {
  if (!validForkResult(base, result)) throw new Error('试选结果与出发点不一致，原记录已保留。')
  // A successful result is immutable. Reopening it never calls a model again.
  if (record.results.some(r => r.choiceId === result.choiceId)) return record
  return { ...record, results: [...record.results, structuredClone(result)] }
}

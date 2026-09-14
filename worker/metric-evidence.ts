import type { MetricEvidenceMap } from '../shared/metric-evidence.ts'

const metricKeys = ['technicalSkill', 'aiCollaboration', 'domainDepth', 'portfolio', 'opportunity', 'confidence', 'energy'] as const
type MetricKey = typeof metricKeys[number]
type Validation = { ok: true; evidence: MetricEvidenceMap } | { ok: false; code: string }

function shortText(value: unknown, limit: number): string | null {
  return typeof value === 'string' && value.trim().length >= 6 && value.trim().length <= limit ? value.trim() : null
}

// Only explicit participation counts here, not route B, a profile or old history.
// This is a conservative lexical gate, not proof that collaboration improved.
function explicitAIParticipation(text: string) {
  const ai = '(?:\\bAI\\b|人工智能|大模型|ChatGPT|Claude|DeepSeek|智能助手|\\bAgent\\b)'
  return text.split(/[，。；！？\n]/).some(clause => {
    if (!new RegExp(ai, 'i').test(clause)) return false
    if (/如果|假如|假设|是否|可能|计划|打算|准备/.test(clause)) return false
    if (new RegExp(`(?:不|未|没有|无需|无须|不再)[^，。；！？]{0,12}${ai}|${ai}[^，。；！？]{0,5}(?:未|没有|不会|并未)`, 'i').test(clause)) return false
    const usesAI = new RegExp(`(?:使用|借助|调用|让|请|向|与|和|用)(?:了|一个|一次|同一个)?\\s*${ai}(?!时代|行业|课程|文章|新闻|概念|研究)`, 'i')
    const checksAIOutput = new RegExp(`(?:核对|审查|检查|修改|评估|验证|对比)\\s*${ai}(?:生成|给出|提出|建议|输出|的回答|的建议|的输出|的草稿|的结果)`, 'i')
    return usesAI.test(clause) || checksAIOutput.test(clause)
  })
}

/** Validate traceability, not truth: outcomeQuote still belongs to an AI simulation. */
export function readMetricEvidence(value: unknown, delta: Partial<Record<MetricKey, number>>, action: string, story: string): Validation {
  const changed = metricKeys.filter(key => Number(delta[key] ?? 0) !== 0)
  if (value === undefined && changed.length === 0) return { ok: true, evidence: {} }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ok: false, code: 'AI_METRIC_EVIDENCE_MISSING' }
  const input = value as Record<string, unknown>
  if (Object.keys(input).some(key => !changed.includes(key as MetricKey))) return { ok: false, code: 'AI_METRIC_EVIDENCE_INVALID' }
  const evidence: MetricEvidenceMap = {}
  for (const key of changed) {
    const raw = input[key]
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, code: 'AI_METRIC_EVIDENCE_MISSING' }
    const record = raw as Record<string, unknown>
    const actionQuote = shortText(record.actionQuote, 120)
    const outcomeQuote = shortText(record.outcomeQuote, 160)
    const reason = shortText(record.reason, 160)
    if (!actionQuote || !outcomeQuote || !reason) return { ok: false, code: 'AI_METRIC_EVIDENCE_INVALID' }
    if (!action.includes(actionQuote) || !story.includes(outcomeQuote)) return { ok: false, code: 'AI_METRIC_EVIDENCE_NOT_FOUND' }
    if (key === 'aiCollaboration' && Number(delta[key]) > 0 &&
      (!explicitAIParticipation(actionQuote) || !explicitAIParticipation(outcomeQuote))) {
      return { ok: false, code: 'AI_METRIC_AI_PARTICIPATION_MISSING' }
    }
    evidence[key] = { actionQuote, outcomeQuote, reason }
  }
  return { ok: true, evidence }
}

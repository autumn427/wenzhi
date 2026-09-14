export type MetricEvidence = {
  actionQuote: string
  outcomeQuote: string
  reason: string
}

export type MetricEvidenceMap = Partial<Record<
  'technicalSkill' | 'aiCollaboration' | 'domainDepth' | 'portfolio' | 'opportunity' | 'confidence' | 'energy',
  MetricEvidence
>>

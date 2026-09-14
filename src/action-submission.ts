import type { GeneratedFreeAction, UniverseRun } from './simulation'

export const normalizedAction = (text: string) => text.normalize('NFKC').replace(/[\s，。！？、,.!?]/g, '').trim()

export function acceptsNextAction(run: UniverseRun, action: GeneratedFreeAction) {
  if (run.currentEvent.day === 180) return false
  const keys = ['technicalSkill', 'aiCollaboration', 'domainDepth', 'portfolio', 'opportunity', 'confidence', 'energy']
  const target = run.currentEvent.day === 30 ? 90 : run.currentEvent.day === 90 ? 150 : 180
  return action.targetDay === target && Boolean(action.narrative?.title?.trim() && action.narrative?.story?.trim() && action.narrative?.tension?.trim() && action.tradeoff?.trim() && action.immediateCost?.trim())
    && Array.isArray(action.nextChoices) && action.nextChoices.length === (target === 180 ? 0 : 2)
    && action.nextChoices.every(choice => Boolean(choice.label?.trim() && choice.tradeoff?.trim()))
    && new Set(action.nextChoices.map(choice => choice.label)).size === action.nextChoices.length
    && Boolean(action.delta && Object.keys(action.delta).length >= 2 && Object.entries(action.delta).every(([key, value]) => keys.includes(key) && typeof value === 'number' && Number.isInteger(value) && value >= -8 && value <= 18))
}

import type { SimulationProfile, UniverseRun } from './simulation'

type StoragePort = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
export const lastProfileKey = 'wenzhi:last-profile:v1'

export function saveLocal(storage: StoragePort, key: string, value: unknown) {
  try { storage.setItem(key, JSON.stringify(value)); return true } catch { return false }
}

export function readLastProfile(storage: StoragePort, fallback: SimulationProfile): SimulationProfile {
  try {
    const value = JSON.parse(storage.getItem(lastProfileKey) || 'null')
    if (!value || !['student', 'transition', 'working', 'restart'].includes(value.identity)
      || !['efficiency', 'portfolio', 'career', 'literacy'].includes(value.intent)
      || !['low', 'medium', 'deep', 'sprint'].includes(value.time)
      || !['study', 'income', 'energy', 'domain', 'open'].includes(value.sacrifice)
      || !['confusion', 'skills', 'goal', 'worries'].every(key => typeof value[key] === 'string' && value[key].length <= 1000)) return fallback
    return Object.fromEntries(Object.keys(fallback).map(key => [key, value[key]])) as SimulationProfile
  } catch { return fallback }
}

// Include the exact scene and previous decisions: another universe or replay
// must never inherit a draft written against a different story.
export function actionDraftKey(profileKey: string, run: UniverseRun, cycle: number) {
  return `wenzhi:action-draft:v1:${JSON.stringify([profileKey, cycle, run.code, run.currentEvent.id, run.currentEvent.story, run.decisions.map(d => d.choiceLabel)])}`
}
export function readActionDraft(storage: StoragePort, key: string) {
  try {
    const value = JSON.parse(storage.getItem(key) || 'null')
    return typeof value === 'string' ? value.slice(0, 240) : ''
  } catch { return '' }
}
export function clearActionDraft(storage: StoragePort, key: string) {
  try { storage.removeItem(key) } catch { /* In-memory editing remains available. */ }
}

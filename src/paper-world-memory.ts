import type { SimulationState, UniverseCode } from './simulation'

export type PaperWorldState = Pick<SimulationState, 'technicalSkill' | 'portfolio' | 'domainDepth' | 'energy'>
const bounded = (n: number) => Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0

/** Presentation only: never writes back into the simulation or invents historical snapshots. */
export function paperWorldMemory(code: UniverseCode, state?: PaperWorldState) {
  const metric = code === 'A' ? 'technicalSkill' : code === 'B' ? 'portfolio' : 'domainDepth'
  const label = code === 'A' ? '学习纸册' : code === 'B' ? '作品纸样' : '专业枝叶'
  const metricLabel = code === 'A' ? '技术' : code === 'B' ? '作品' : '专业'
  const score = state ? bounded(state[metric]) : 0
  return { label, metricLabel, score, count: Math.ceil(score / 20), energy: state ? bounded(state.energy) : 100, available: !!state }
}

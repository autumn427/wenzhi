type UniverseCode = 'A' | 'B' | 'C'
type SceneDay = 30 | 90 | 150
type MascotMotion = 'idle' | 'computer' | 'stroll' | 'wave'

const scenes: Record<SceneDay, Record<UniverseCode, { background: string; motion: MascotMotion }>> = {
  30: {
    A: { background: 'parttime-blue', motion: 'wave' },
    B: { background: 'internship-amber', motion: 'computer' },
    C: { background: 'market-green', motion: 'stroll' },
  },
  90: {
    A: { background: 'day90-blue', motion: 'computer' },
    B: { background: 'day90-amber', motion: 'idle' },
    C: { background: 'day90-green', motion: 'computer' },
  },
  150: {
    A: { background: 'day150-blue', motion: 'wave' },
    B: { background: 'day150-amber', motion: 'stroll' },
    C: { background: 'day150-green', motion: 'stroll' },
  },
}

// Stage and palette are shared by preset and custom stories, without title matching.
export function galSceneAssets(code: UniverseCode, day: number) {
  const stage: SceneDay = day >= 150 ? 150 : day >= 90 ? 90 : 30
  const { background, motion } = scenes[stage][code]
  return {
    stage,
    background: `/assets/galgame/${background}.png`,
    mascot: `/kanshan-${motion}.gif`,
    still: `/assets/galgame/kanshan-${motion}-still.png`,
  }
}

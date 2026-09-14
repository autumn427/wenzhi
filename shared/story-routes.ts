export type StoryRoute = {
 code: 'A' | 'B' | 'C'; title: string; premise: string;
 opening: { title: string; story: string; tension: string; choices: {label: string; tradeoff: string}[] }
}
export function readStoryRoutes(value: unknown): StoryRoute[] | null {
 if (!Array.isArray(value) || value.length !== 3) return null
 const text = (v: unknown, min: number, max: number): v is string => typeof v === 'string' && v.trim().length >= min && v.length <= max
 const routes: StoryRoute[] = []
 for (const code of ['A','B','C'] as const) {
  const r = value.find(r=>r && r.code === code)
  if (!r || !text(r.title,2,24) || !text(r.premise,10,240) || !r.opening) return null
  const e = r.opening
  if (!text(e.title,2,40) || !text(e.story,30,700) || !text(e.tension,4,160) || !Array.isArray(e.choices) || e.choices.length !== 2) return null
  if (!e.choices.every((c: {label?: unknown;tradeoff?: unknown})=>c && text(c.label,6,40) && text(c.tradeoff,4,100)) || e.choices[0].label === e.choices[1].label) return null
  routes.push({code,title:r.title.trim(),premise:r.premise.trim(),opening:{title:e.title,story:e.story,tension:e.tension,choices:e.choices.map((c:{label:string;tradeoff:string})=>({label:c.label,tradeoff:c.tradeoff}))}})
 }
 return new Set(routes.map(r=>r.title)).size === 3 ? routes : null
}

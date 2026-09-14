import { campusGrowth, campusFirstEvents as firstEvents, campusSecondEvent as secondEvent, campusThirdEvent as thirdEvent, campusEnding as ending } from './campus-demo.ts'
import type { StoryRoute } from '../shared/story-routes'
import type { MetricEvidenceMap } from '../shared/metric-evidence'

export type UniverseCode = 'A' | 'B' | 'C'
export type GeneratedActionSource = 'zhihu-ai' | 'yeako-ai' | 'relay-ai'
export type ActionSource = GeneratedActionSource | 'local-fallback'
export function isGeneratedActionSource(source?: string): source is GeneratedActionSource {
  return source === 'zhihu-ai' || source === 'yeako-ai' || source === 'relay-ai'
}
export function actionSourceLabel(source?: string) {
  return source === 'zhihu-ai' ? '知乎直答' : source === 'yeako-ai' ? 'Yeako 备用 AI' : source === 'relay-ai' ? '中转模型' : '历史模拟（来源未确认）'
}

export type SimulationState = {
  day: 0 | 30 | 90 | 150 | 180
  technicalSkill: number
  aiCollaboration: number
  domainDepth: number
  portfolio: number
  opportunity: number
  confidence: number
  energy: number
  weeklyHours: number
}

export type StateDelta = Partial<Omit<SimulationState, 'day'>>

export type SimulationChoice = {
  generatedAction?: boolean
  id: string
  label: string
  tradeoff: string
  delta: StateDelta
  opens: string[]
  closes: string[]
}

export type SimulationEvent = {
  id: string
  day: 30 | 90 | 150 | 180
  title: string
  story: string
  tension: string
  evidenceIds: string[]
  choices: SimulationChoice[]
  generatedFrom?: string
  generationSource?: ActionSource
}

export type NarrativeOverride = {
  title: string
  story: string
  tension: string
}

export type GeneratedFreeAction = {
  deltaEvidence?: MetricEvidenceMap
  targetDay?: 90 | 150 | 180
  nextChoices?: Array<{ label: string; tradeoff: string }>
  source?: ActionSource
  baseChoiceId: string
  actionLabel: string
  tradeoff: string
  assumption?: string
  immediateCost?: string
  observableChange?: string
  causalChain?: [string, string, string]
  sourceInfluence?: string
  delta: StateDelta
  narrative: NarrativeOverride
  evidenceRefs?: string[]
}

export type SimulationDecision = {
  eventSnapshot?: SimulationEvent
  stateBefore?: SimulationState
  stateAfter?: SimulationState
  tradeoff?: string
  actionOutcome?: {
    deltaEvidence?: MetricEvidenceMap
    assumption?: string
    immediateCost?: string
    observableChange?: string
    tradeoff: string
    narrative: NarrativeOverride
    source?: ActionSource
  }
  eventId: string
  eventTitle?: string
  eventTension?: string
  evidenceIds?: string[]
  day: 30 | 90 | 150
  choiceId: string
  choiceLabel: string
  delta: StateDelta
  causalChain?: [string, string, string]
  sourceInfluence?: string
}

export type WorkSampleEvidence = {
  eventId: string
  title: string
  clarification: string
  priority: string
  artifact: string
  observations: string[]
  notObserved: string[]
  delta: StateDelta
  sourceEvidenceIds: string[]
  completedAt: string
}

export type UniverseRun = {
  route?: StoryRoute

  code: UniverseCode
  state: SimulationState
  flags: string[]
  closedOpportunities: string[]
  decisions: SimulationDecision[]
  workSamples: WorkSampleEvidence[]
  currentEvent: SimulationEvent
  narrativeOverrides?: Record<string, NarrativeOverride>
}

export type SimulationProfile = {
  identity: 'student' | 'transition' | 'working' | 'restart'
  intent: 'efficiency' | 'portfolio' | 'career' | 'literacy'
  time: 'low' | 'medium' | 'deep' | 'sprint'
  sacrifice: 'study' | 'income' | 'energy' | 'domain' | 'open'
  confusion: string
  skills: string
  goal: string
  worries: string
}

const clamp = (value: number) => Math.max(0, Math.min(100, value))

function weeklyHours(time: SimulationProfile['time']) {
  if (time === 'sprint') return 14
  if (time === 'deep') return 10
  if (time === 'medium') return 4
  return 2
}

function baseState(profile: SimulationProfile): SimulationState {
  const protectsEnergy = profile.sacrifice === 'energy' ? 7 : 0
  const protectsDomain = profile.sacrifice === 'domain' || profile.sacrifice === 'study' ? 5 : 0
  const protectsIncome = profile.sacrifice === 'income' ? 4 : 0
  return {
    day: 0,
    technicalSkill: profile.identity === 'transition' ? 20 : 12,
    aiCollaboration: profile.intent === 'efficiency' ? 24 : profile.intent === 'portfolio' ? 20 : 14,
    domainDepth: clamp((profile.identity === 'working' ? 42 : profile.identity === 'student' ? 34 : profile.identity === 'restart' ? 30 : 28) + protectsDomain),
    portfolio: 8,
    opportunity: 12 + protectsIncome,
    confidence: 48,
    energy: clamp((profile.time === 'sprint' ? 60 : profile.time === 'deep' ? 68 : 76) + protectsEnergy),
    weeklyHours: weeklyHours(profile.time),
  }
}

function initialState(profile: SimulationProfile, _code: UniverseCode): SimulationState {
  // A route is a proposed action, not a free skill bonus or extra time budget.
  return baseState(profile)
}

function applyNarrative(event: SimulationEvent, overrides?: Record<string, NarrativeOverride>) {
  const override = overrides?.[event.id]
  return override ? { ...event, ...override } : event
}

// Refresh only recognized built-in endings; keep generated stories and all saved decisions.
export function refreshLegacyEnding(run: UniverseRun): UniverseRun {
  run = refreshCampusGrowth(run)
  const event = run.currentEvent
  if (event.day !== 180 || event.generatedFrom || event.generationSource ||
      run.decisions.some((decision) => decision.actionOutcome) ||
      run.narrativeOverrides?.[event.id]) return run
  if (!event.story.startsWith('回头看，每次选择都把你往这条路上推了一点。') &&
      !event.story.startsWith('半年的时间没有让所有问题都有答案，却让')) return run
  return { ...run, currentEvent: ending(run) }
}

/** Rebase only known preset choices; never rewrite generated/custom action evidence. */
export function refreshCampusGrowth(run: UniverseRun): UniverseRun {
  if (run.route || !run.currentEvent.id.startsWith('campus-') || run.workSamples?.length ||
      run.decisions.some(d => !campusGrowth[d.choiceId] || d.actionOutcome) ||
      (run.decisions.length > 0 && !run.decisions[0].stateBefore)) return run
  const updateChoices = (event: SimulationEvent): SimulationEvent => ({...event,choices:event.choices.map(c=>campusGrowth[c.id] ? {...c,delta:{...c.delta,...campusGrowth[c.id]}} : c)})
  let state = {...(run.decisions[0]?.stateBefore ?? run.state)}
  const decisions = run.decisions.map(d => {
    const delta = {...d.delta,...campusGrowth[d.choiceId]}
    const stateBefore = {...state}
    state = applyDelta(state,delta,d.stateAfter?.day ?? d.day)
    return {...d,delta,stateBefore,stateAfter:{...state},eventSnapshot:d.eventSnapshot ? updateChoices(d.eventSnapshot) : undefined}
  })
  return {...run,state:{...state,day:run.state.day},decisions,currentEvent:updateChoices(run.currentEvent)}
}

function applyDelta(state: SimulationState, delta: StateDelta, nextDay: SimulationState['day']): SimulationState {
  const next = { ...state, day: nextDay }
  for (const [key, value] of Object.entries(delta) as Array<[keyof StateDelta, number]>) {
    next[key] = clamp(Number(next[key]) + value) as never
  }
  return next
}

export function createUniverseRuns(profile: SimulationProfile, narrativeOverrides: Record<string, NarrativeOverride> = {}): Record<UniverseCode, UniverseRun> {
  const create = (code: UniverseCode): UniverseRun => ({
    code,
    state: initialState(profile, code),
    flags: [],
    closedOpportunities: [],
    decisions: [],
    workSamples: [],
    currentEvent: applyNarrative(firstEvents[code], narrativeOverrides),
    narrativeOverrides,
  })
  return { A: create('A'), B: create('B'), C: create('C') }
}

export function createGeneratedUniverseRuns(profile: SimulationProfile, routes: StoryRoute[], source?: GeneratedActionSource): Record<UniverseCode, UniverseRun> {
 const runs = createUniverseRuns(profile)
 for (const route of routes) runs[route.code] = {
  ...runs[route.code], state: baseState(profile), route,
  currentEvent: {id:`generated-${route.code}-30`,day:30,...route.opening,evidenceIds:[],generationSource:source,
   choices:route.opening.choices.map((choice,index)=>({...choice,id:`generated-${route.code}-30-${index}`,generatedAction:true,delta:{},opens:[],closes:[]}))}
 }
 return runs
}

export function createRecalibratedUniverseRuns(
  profile: SimulationProfile,
  routeDeltas: Record<UniverseCode, StateDelta>,
  narrativeOverrides: Record<string, NarrativeOverride> = {},
  routes?: StoryRoute[],
  routeSources?: Partial<Record<UniverseCode, GeneratedActionSource>>,
): Record<UniverseCode, UniverseRun> {
  const runs = routes?.length === 3 ? createGeneratedUniverseRuns(profile, routes) : createUniverseRuns(profile, narrativeOverrides)
  return (['A', 'B', 'C'] as UniverseCode[]).reduce<Record<UniverseCode, UniverseRun>>((next, code) => {
    next[code] = {
      ...runs[code],
      currentEvent: { ...runs[code].currentEvent, generationSource: routeSources?.[code] ?? runs[code].currentEvent.generationSource },
      state: applyDelta(runs[code].state, routeDeltas[code], 0),
      flags: ['reality-experiment-calibrated'],
    }
    return next
  }, {} as Record<UniverseCode, UniverseRun>)
}

function mergeDelta(base: StateDelta, evidence?: StateDelta): StateDelta {
  if (!evidence) return base
  const merged = { ...base }
  for (const [key, value] of Object.entries(evidence) as Array<[keyof StateDelta, number]>) {
    merged[key] = (Number(merged[key] ?? 0) + value) as never
  }
  return merged
}

function progressWithChoice(run: UniverseRun, choice: SimulationChoice, workSample?: WorkSampleEvidence): UniverseRun {
  if (run.currentEvent.day === 180) return run
  const day = run.currentEvent.day
  const decisionDelta = mergeDelta(choice.delta, workSample?.delta)
  const nextState = applyDelta(run.state, decisionDelta, day)
  const progressed: UniverseRun = {
    ...run,
    state: nextState,
    flags: [...new Set([...run.flags, ...choice.opens])],
    closedOpportunities: [...new Set([...run.closedOpportunities, ...choice.closes])],
    decisions: [...run.decisions, {
      eventSnapshot: structuredClone(run.currentEvent),
      stateBefore: { ...run.state },
      stateAfter: { ...nextState },
      tradeoff: choice.tradeoff,
      eventId: run.currentEvent.id,
      eventTitle: run.currentEvent.title,
      eventTension: run.currentEvent.tension,
      evidenceIds: run.currentEvent.evidenceIds,
      day,
      choiceId: choice.id,
      choiceLabel: choice.label,
      delta: decisionDelta,
    }],
    workSamples: workSample ? [...(run.workSamples ?? []), workSample] : (run.workSamples ?? []),
  }
  if (run.route) {
    const targetDay = day === 30 ? 90 : day === 90 ? 150 : 180
    return {...progressed, state: {...nextState, day: targetDay === 180 ? 180 : nextState.day}, currentEvent:{...run.currentEvent, id:`generated-${run.code}-${targetDay}`, day:targetDay, choices:[]}}
  }
  if (day === 30) return { ...progressed, currentEvent: applyNarrative(secondEvent(progressed), progressed.narrativeOverrides) }
  if (day === 90) return { ...progressed, currentEvent: applyNarrative(thirdEvent(progressed), progressed.narrativeOverrides) }
  return { ...progressed, state: { ...progressed.state, day: 180 }, currentEvent: ending(progressed) }
}

export function chooseUniversePath(run: UniverseRun, choiceId: string, workSample?: WorkSampleEvidence): UniverseRun {
  const choice = run.currentEvent.choices.find((item) => item.id === choiceId)
  if (!choice) throw new Error(`Unknown choice ${choiceId} for event ${run.currentEvent.id}`)
  return progressWithChoice(run, choice, workSample)
}

const quickContinuations: Record<string, [string, string]> = {
  'a-take-shift': ['a-fixed', 'a-short-shift'],
  'a-protect-meeting': ['a-one-shift', 'a-pause'],
  'b-negotiate': ['b-ask-task', 'b-renew-bounded'],
  'b-retarget': ['b-observe', 'b-finish'],
  'c-cover': ['c-preorder', 'c-agree-roles'],
  'c-scale-down': ['c-clear-stock', 'c-stop'],
}

export function chooseUniverseFreeAction(
  run: UniverseRun,
  generated: GeneratedFreeAction,
  quick = false,
  workSample?: WorkSampleEvidence,
): UniverseRun {
  const baseChoice = run.currentEvent.choices.find((item) => item.id === generated.baseChoiceId)
  if (!baseChoice) throw new Error(`Unknown base choice ${generated.baseChoiceId} for event ${run.currentEvent.id}`)
  const customChoice: SimulationChoice = {
    ...baseChoice,
    id: `free:${run.currentEvent.id}`,
    label: generated.actionLabel,
    tradeoff: generated.tradeoff,
    delta: generated.delta,
    opens: [],
    closes: [],
  }
  const targetDay = quick ? 180 : run.currentEvent.day === 30 ? 90 : run.currentEvent.day === 90 ? 150 : 180
  if (generated.targetDay !== undefined && generated.targetDay !== targetDay) throw new Error('续写时间与当前节点不一致')
  let progressed = progressWithChoice(run, customChoice, workSample)
  const freeDecisionIndex = run.decisions.length
  if (quick) {
    progressed = { ...progressed, state: { ...progressed.state, day: 180 }, currentEvent: ending(progressed) }
  }
  const decisions = progressed.decisions.map((decision, index) => index === freeDecisionIndex ? {
    ...decision,
    causalChain: generated.causalChain,
    sourceInfluence: generated.sourceInfluence,
    actionOutcome: {
      deltaEvidence: generated.deltaEvidence,
      assumption: generated.assumption,
      immediateCost: generated.immediateCost,
      observableChange: generated.observableChange,
      tradeoff: generated.tradeoff,
      narrative: generated.narrative,
      source: generated.source,
    },
  } : decision)
  return {
    ...progressed,
    decisions,
    currentEvent: {
      ...progressed.currentEvent,
      ...generated.narrative,
      generatedFrom: generated.actionLabel,
      generationSource: generated.source,
      ...(generated.nextChoices ? { choices: targetDay === 180 ? [] : generated.nextChoices.map((choice, index) => ({
        id: `generated-${run.code}-${targetDay}-${index}`,
        ...choice,
        generatedAction: true,
        delta: {},
        opens: [],
        closes: [],
      })) } : {}),
    },
  }
}

/**
 * A short-form simulation for first-time visitors and judging sessions.
 * The visitor still makes the route-defining decision. The following two
 * decisions deliberately continue that same strategy, so the result remains
 * causal and reproducible instead of becoming a random summary.
 */
export function chooseUniversePathQuick(run: UniverseRun, choiceId: string): UniverseRun {
  let progressed = chooseUniversePath(run, choiceId)
  for (const preferredId of quickContinuations[choiceId] ?? []) {
    if (progressed.currentEvent.day === 180) break
    const nextChoice = progressed.currentEvent.choices.find((choice) => choice.id === preferredId)
      ?? progressed.currentEvent.choices[0]
    if (!nextChoice) break
    progressed = chooseUniversePath(progressed, nextChoice.id)
  }
  return progressed
}

export function simulationStorageKey(profile: SimulationProfile) {
  const text = `${profile.confusion}|${profile.skills}|${profile.goal}|${profile.worries}|${profile.sacrifice}`
  let hash = 2166136261
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return `wenzhi:simulation:${profile.identity}:${profile.intent}:${profile.time}:${(hash >>> 0).toString(36)}:v4`
}

/** Only serialize this run's recorded decisions; never infer missing consequences. */
export function freeActionMemory(run: UniverseRun): string {
  const decisions = run.decisions.filter(decision => decision.choiceId.startsWith('free:'))
  const recordBudget = Math.floor((800 - Math.max(0, decisions.length - 1)) / Math.max(1, decisions.length))
  return decisions.map(decision => {
    const outcome = decision.actionOutcome
    const short = (value?: string) => value?.slice(0, 160) || '未记录'
    return [
      `第${decision.day}天自由行动（${isGeneratedActionSource(outcome?.source) ? `${actionSourceLabel(outcome?.source)}生成的AI模拟，不是现实经历` : '历史模拟，来源未确认'}）：${decision.choiceLabel.slice(0, 96)}。`,
      decision.causalChain ? `因果记录：${decision.causalChain.map(step => step.slice(0, 100)).join('→')}。` : '',
      outcome ? `当时的取舍：${short(outcome.tradeoff)}。即时成本：${short(outcome.immediateCost)}。待验证假设：${short(outcome.assumption)}。预期观察：${short(outcome.observableChange)}。当时续写：${short(outcome.narrative.title)}，${short(outcome.narrative.story)}。` : '',
    ].filter(Boolean).join('').slice(0, recordBudget)
  }).join('\n')
}

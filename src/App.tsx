import { normalizedAction, acceptsNextAction } from './action-submission'
import { actionDraftKey, clearActionDraft, lastProfileKey, readActionDraft, readLastProfile, saveLocal } from './journey-recovery'
import { firstRouteExperiment } from './first-experiment'
import { ForkComparison } from './ForkComparison'
import { ZhihuConnection } from './ZhihuConnection'
import { forkIdentity, type ForkRecord } from './fork-comparison'
import './submission-flow.css'
import { ExperimentPlanner } from './ExperimentPlanner'
import { experimentEvidence } from './experiment-evidence'
import { RealityEchoLetter } from './RealityEchoLetter'
import { echoQuery, echoIdentity, type EchoContext } from './echo-context'
import { PaperAccent } from './PaperAccent'
import { readStoryRoutes, type StoryRoute } from '../shared/story-routes'
import { CSSProperties, FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import gsap from 'gsap'
import { Observer } from 'gsap/Observer'
import { useGSAP } from '@gsap/react'
import { PaperLanding } from './PaperLanding'
import { StoryEventCard, UniverseDoors } from './StoryJourney'
import { JourneyWayfinding } from './JourneyWayfinding'
import { StateRadar, PathHistory, JourneyEnding, JourneyTickets } from './JourneyDetails'
import { ZhihuPost } from './ZhihuPost'
import { trackTelemetry } from './telemetry'
import { fetchJsonWithDeadline } from './request'
import { FreeActionApiError, freeActionFeedback, type FreeActionFeedback } from './free-action-feedback'
import { freeActionMemory, isGeneratedActionSource, actionSourceLabel, type ActionSource, type GeneratedActionSource } from './simulation'
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowSquareOut,
  BookOpen,
  Check,
  CaretDown as ChevronDown,
  CircleDashed,
  Clock as Clock3,
  FileMagnifyingGlass as FileSearch,
  GitBranch,
  Info,
  Stack as Layers3,
  Leaf,
  List as Menu,
  Plus,
  Quotes as Quote,
  MagnifyingGlass as Search,
  PaperPlaneTilt as Send,
  Pause,
  Play,
  Sparkle as Sparkles,
  Plant as Sprout,
  Target,
  Users,
  X,
} from '@phosphor-icons/react'
import { Branch, BranchStatus, Evidence, flattenBranches, programmingCorpusStats, programmingMethodology, questions } from './data'
import { chooseUniverseFreeAction, chooseUniversePath, chooseUniversePathQuick, createRecalibratedUniverseRuns, createUniverseRuns, createGeneratedUniverseRuns, refreshLegacyEnding, GeneratedFreeAction, NarrativeOverride, simulationStorageKey, StateDelta, UniverseCode, UniverseRun, WorkSampleEvidence } from './simulation'

gsap.registerPlugin(useGSAP, Observer)

function releaseHeader() {
  if (typeof window === 'undefined') return ''
  return new URLSearchParams(window.location.search).get('release')?.replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 80) ?? ''
}

type Screen = 'home' | 'workspace'
type WorkspaceMode = 'tree' | 'matrix'

type ContributionDraft = {
  background: string
  task: string
  weeklyTime: string
  duration: string
  outcome: string
  consentNoSensitive: boolean
  website: string
}

type ContributionReceipt = {
  id: string
  branchId: string
  createdAt: string
  reviewStatus: 'pending'
}

type ContributionApiResponse = {
  contribution: ContributionReceipt
}

type FutureChatMessage = {
  role: 'user' | 'assistant'
  content: string
  source?: GeneratedActionSource | 'local-rules' | 'demo'
  memoryRefs?: string[]
  sources?: Array<{
    id: string
    title: string
    excerpt: string
    sourceUrl: string
    author: string
    votes: number
    authorityLevel: string
  }>
  groundingStatus?: 'timeline-and-zhihu' | 'timeline-only'
  qualityReview?: { score: number; attempts: number; passed: boolean; status?: 'aligned' | 'repaired' | 'clarify' }
}

type FutureChatApiResponse = {
  message?: FutureChatMessage
  source?: GeneratedActionSource | 'local-rules'
  error?: { message?: string }
}

type DebateLine = {
  speaker: UniverseCode
  text: string
  challenges: UniverseCode | null
  memoryRef?: string
}

type DebateResult = {
  lines: DebateLine[]
  conflictCore?: string
  commonGround?: string
  experimentSeed?: { action: string; successSignal: string }
  closingQuestion: string
  mode?: 'ai' | 'ai-repaired' | 'cached-ai' | 'memory-fallback'
}

type RealityExperiment = {
  origin?: { kind: 'route'; code: UniverseCode }
  title: string
  hypothesis: string
  reason: string
  dailyTasks: Array<{ day: number; task: string; minutes: number }>
  successSignal: string
  stopRule: string
  feedbackQuestion: string
}

type ExperimentDayStatus = 'done' | 'skipped'

type RecalibrationRecord = {
  id: string
  cycleFrom: number
  recommendedUniverse: UniverseCode
  completionRate: number
  summary: string
  routeDeltas: Record<UniverseCode, StateDelta>
  createdAt: string
  source?: GeneratedActionSource | 'local-rule'
}

type ChoiceImpact = {
  id: number
  code: UniverseCode
  choice: string
  nextTitle: string
  nextDay: number
  delta: StateDelta
  quick: boolean
  tradeoff?: string
  assumption?: string
  immediateCost?: string
  observableChange?: string
  causalChain?: [string, string, string]
  sourceInfluence?: string
  source?: ActionSource | 'rule'
  evidence?: ZhihuSearchItem[]
}

type ExperimentProgress = {
  notes?: Record<number, string>
  checkins: Partial<Record<number, ExperimentDayStatus>>
  result: 'strong' | 'mixed' | 'weak' | ''
  signalObserved: boolean
  answer: string
  calibration: RecalibrationRecord | null
}

type ReflectionApiResponse = {
  debate?: DebateResult
  experiment?: RealityExperiment
  error?: { message?: string }
}

type NarrativeApiResponse = {
  routes?: StoryRoute[]
  source?: GeneratedActionSource
  error?: { message?: string }
}

type FreeActionApiResponse = {
  action?: GeneratedFreeAction
  error?: { code?: string; message?: string }
}

// Allow the worker's 55-second model budget plus response delivery. The shared
// helper keeps the deadline active through JSON parsing and never retries.
const AI_REQUEST_DEADLINE_MS = 60_000

type WorkSamplePriority = 'privacy' | 'delivery' | 'reliability'

type WorkSampleDraft = {
  clarification: string
  priority: WorkSamplePriority | ''
  aiDraft: string
  revisedDraft: string
  evidence: WorkSampleEvidence | null
  error: string
}

const emptyWorkSampleDraft: WorkSampleDraft = {
  clarification: '',
  priority: '',
  aiDraft: '',
  revisedDraft: '',
  evidence: null,
  error: '',
}

const workSamplePriorityLabels: Record<WorkSamplePriority, string> = {
  privacy: '本地留存优先',
  delivery: '今晚可交付优先',
  reliability: '失败可恢复优先',
}

function acceptanceDraft(priority: WorkSamplePriority) {
  const lead = {
    privacy: 'P0｜原始数据与中间文件不得离开本机；导出前需人工确认。',
    delivery: 'P0｜今晚先支持一种固定格式，完成可演示的单文件导入。',
    reliability: 'P0｜格式错误时停止写入，保留原文件并返回可定位的错误信息。',
  }[priority]
  return [
    lead,
    'P1｜用 3 份脱敏样本验收：正常、缺列、重复数据。',
    'P1｜每次运行生成处理摘要：成功数、失败数、失败原因。',
    '暂不承诺｜批量目录、任意格式兼容、云端同步。',
  ].join('\n')
}

type RecalibrationApiResponse = {
  calibration?: Pick<RecalibrationRecord, 'recommendedUniverse' | 'summary' | 'routeDeltas' | 'source'>
  source?: GeneratedActionSource
  error?: { message?: string }
}

type ZhihuSearchItem = {
  id: string
  title: string
  excerpt: string
  contentType: string
  sourceUrl: string
  author: string
  avatarUrl: string
  badge: string
  votes: number
  comments: number
  authorityLevel: string | number
  rankingScore: number
  relevanceScore?: number
  editedAt: string
}

type LiveEvidenceRecord = {
  items: ZhihuSearchItem[]
  retrievedAt: string
  cachedAt: number
  emptyReason?: string
}

type ZhihuSearchApiResponse = {
  search?: {
    items?: ZhihuSearchItem[]
    retrievedAt?: string
    emptyReason?: string
  }
  error?: { message?: string }
}

const contributionStorageKey = 'wenzhi.contribution-receipts.v2'

function readContributionReceipts(): ContributionReceipt[] {
  try {
    const stored = window.localStorage.getItem(contributionStorageKey)
    if (!stored) return []
    const value = JSON.parse(stored)
    if (!Array.isArray(value)) return []
    return value.filter((item): item is ContributionReceipt => (
      typeof item?.id === 'string'
      && typeof item?.branchId === 'string'
      && typeof item?.createdAt === 'string'
      && item?.reviewStatus === 'pending'
    ))
  } catch {
    return []
  }
}

type Situation = {
  identity: 'student' | 'transition' | 'working' | 'restart'
  intent: 'efficiency' | 'portfolio' | 'career' | 'literacy'
  time: 'low' | 'medium' | 'deep' | 'sprint'
  sacrifice: 'study' | 'income' | 'energy' | 'domain' | 'open'
  confusion: string
  skills: string
  goal: string
  worries: string
}

type SituationChoiceKey = 'identity' | 'intent' | 'time'

const defaultSituation: Situation = {
  identity: 'student',
  intent: 'efficiency',
  time: 'low',
  sacrifice: 'study',
  confusion: '',
  skills: '',
  goal: '',
  worries: '',
}

// Live generation is enabled in production; all model responses still pass
// through the worker's structured-output and narrative-boundary checks.
const LIVE_AI_ENABLED = true

const judgeDemoSituation: Situation = {
  identity: 'student',
  intent: 'efficiency',
  time: 'low',
  sacrifice: 'study',
  confusion: '我是人文学科研究生，每周只能拿出 2 小时：现在还有必要学编程吗？',
  skills: '写作、访谈、文献分析、基础表格整理',
  goal: '做出一个能减少文献整理时间、可以真正交给同学使用的小工具',
  worries: '挤占论文时间；学了半年仍做不出作品；过度依赖 AI 后失去判断力',
}

function createJudgeDemoRuns(profile: Situation): Record<UniverseCode, UniverseRun> {
  return createUniverseRuns(profile)
}

const sceneLabels = ['启程', '定锚', '分岔', '回看'] as const

const sceneTelemetry = [
  { index: 'RECONNECT / 01', metric: '22', unit: 'VOICES', title: '真人讨论已接入', note: 'AI 只负责牵线，不替任何人发言', signal: 78 },
  { index: 'RECONNECT / 02', metric: '3', unit: '/ 3', title: '你的处境正在加入', note: '条件越具体，遇见的人越接近', signal: 88 },
  { index: 'RECONNECT / 03', metric: '14', unit: 'TRACEABLE', title: '每种声音都有来处', note: '摘要可核验，也可以返回原页面', signal: 64 },
  { index: 'RECONNECT / 04', metric: '0', unit: 'SAME STORY', title: '还有一种人没有出现', note: '空白不是结论，是向真人发出的邀请', signal: 7 },
] as const

const featuredVoiceAuthors = ['Odin', '可乐也不可乐', '无端人口司马亮']
const featuredVoiceInsights = ['跨专业，持续扩展数字技能', '不是转行，是完成创作协作', '会编程，也难替代材料判断']
const featuredVoices = featuredVoiceAuthors
  .map((author) => flattenBranches(questions[0].branches).flatMap((branch) => branch.evidence).find((item) => item.author === author))
  .filter((item): item is Evidence => Boolean(item))

const programmingEvidence = flattenBranches(questions[0].branches).flatMap((branch) => branch.evidence)
const programmingEvidenceById = new Map(programmingEvidence.flatMap((item) => item.id ? [[item.id, item] as const] : []))

function readUniverseRuns(situation: Situation) {
  try {
    const stored = window.localStorage.getItem(simulationStorageKey(situation))
    if (!stored) return createUniverseRuns(situation)
    const parsed = JSON.parse(stored) as Record<UniverseCode, UniverseRun>
    if (!parsed.A?.currentEvent || !parsed.B?.currentEvent || !parsed.C?.currentEvent) return createUniverseRuns(situation)
    return { A: refreshLegacyEnding(parsed.A), B: refreshLegacyEnding(parsed.B), C: refreshLegacyEnding(parsed.C) }
  } catch {
    return createUniverseRuns(situation)
  }
}

function futureChatStorageKey(situation: Situation) {
  return simulationStorageKey(situation).replace('wenzhi:simulation:', 'wenzhi:future-chat:v2:')
}

function readFutureChats(situation: Situation): Record<UniverseCode, FutureChatMessage[]> {
  try {
    const stored = window.localStorage.getItem(futureChatStorageKey(situation))
    if (!stored) return { A: [], B: [], C: [] }
    const parsed = JSON.parse(stored) as Record<UniverseCode, FutureChatMessage[]>
    if (!Array.isArray(parsed.A) || !Array.isArray(parsed.B) || !Array.isArray(parsed.C)) return { A: [], B: [], C: [] }
    return parsed
  } catch {
    return { A: [], B: [], C: [] }
  }
}

function reflectionStorageKey(situation: Situation) {
  return simulationStorageKey(situation).replace('wenzhi:simulation:', 'wenzhi:reflection:')
}

function emptyExperimentProgress(): ExperimentProgress {
  return { checkins: {}, result: '', signalObserved: false, answer: '', calibration: null }
}

const debateCacheKey = 'wenzhi:debate:last-success:v1'

function readCachedDebate(): DebateResult | null {
  try {
    const stored = window.localStorage.getItem(debateCacheKey)
    if (!stored) return null
    const parsed = JSON.parse(stored) as { debate?: DebateResult; cachedAt?: number }
    if (!Array.isArray(parsed.debate?.lines) || parsed.debate.lines.length < 6 || typeof parsed.cachedAt !== 'number') return null
    if (Date.now() - parsed.cachedAt > 24 * 60 * 60 * 1000) return null
    return { ...parsed.debate, mode: 'cached-ai' }
  } catch {
    return null
  }
}

function cacheDebate(debate: DebateResult) {
  if (debate.mode !== 'ai' && debate.mode !== 'ai-repaired') return
  try {
    window.localStorage.setItem(debateCacheKey, JSON.stringify({ debate, cachedAt: Date.now() }))
  } catch {
    // The live result still works when private browsing blocks local storage.
  }
}

function createFallbackExperiment(debate: DebateResult): RealityExperiment {
  const action = debate.experimentSeed?.action || '选一个真实小任务，用两种路线各做一次短实验并记录卡点'
  const successSignal = debate.experimentSeed?.successSignal || '能够说出哪条路线减少了卡点，又新增了什么代价'
  return {
    title: '给自己七天，试一件小事',
    hypothesis: action,
    reason: `你还在犹豫“${debate.conflictCore || '哪条路更适合自己'}”。先花七天试试，做不下去可以停。`,
    dailyTasks: [
      { day: 1, task: '选定一个真实任务，写下当前耗时与最担心的失败', minutes: 15 },
      { day: 2, task: '按第一条路线完成 25 分钟，记录一个卡点', minutes: 25 },
      { day: 3, task: '换条路线做同类任务，记下哪里顺手、哪里费劲', minutes: 25 },
      { day: 4, task: '只比较完成度、卡点和精力，不给自己打分', minutes: 15 },
      { day: 5, task: '用暂时更有效的路线再做一次，并加一道验收条件', minutes: 25 },
      { day: 6, task: '请一位真实使用者看结果，只记录一个意外反馈', minutes: 20 },
      { day: 7, task: '记下什么值得继续，下周只留下这一件事', minutes: 15 },
    ],
    successSignal,
    stopRule: '连续两次无法在 30 分钟内完成，或明显挤占当前最重要的任务时，立即停止。',
    feedbackQuestion: '哪一条具体证据改变了你原来的判断？',
  }
}

function readReflection(situation: Situation): {
  debate: DebateResult | null
  experiment: RealityExperiment | null
  progress: ExperimentProgress
  cycle: number
  calibrationHistory: RecalibrationRecord[]
} {
  try {
    const stored = window.localStorage.getItem(reflectionStorageKey(situation))
    if (!stored) return { debate: null, experiment: null, progress: emptyExperimentProgress(), cycle: 1, calibrationHistory: [] }
    const parsed = JSON.parse(stored) as {
      debate?: DebateResult
      experiment?: RealityExperiment
      progress?: ExperimentProgress
      cycle?: number
      calibrationHistory?: RecalibrationRecord[]
    }
    const rawProgress = parsed.progress
    const progress = emptyExperimentProgress()
    if (rawProgress?.notes && typeof rawProgress.notes === 'object') {
      progress.notes = Object.fromEntries(Object.entries(rawProgress.notes).filter(([day, note]) => Number.isInteger(Number(day)) && Number(day) >= 1 && Number(day) <= 7 && typeof note === 'string').map(([day, note]) => [day, String(note).slice(0, 500)]))
    }
    if (rawProgress && rawProgress.checkins && typeof rawProgress.checkins === 'object') {
      progress.checkins = Object.fromEntries(Object.entries(rawProgress.checkins).filter(([day, status]) => (
        Number(day) >= 1 && Number(day) <= 7 && (status === 'done' || status === 'skipped')
      )))
      progress.result = rawProgress.result === 'strong' || rawProgress.result === 'mixed' || rawProgress.result === 'weak' ? rawProgress.result : ''
      progress.signalObserved = rawProgress.signalObserved === true
      progress.answer = typeof rawProgress.answer === 'string' ? rawProgress.answer.slice(0, 500) : ''
      progress.calibration = rawProgress.calibration?.routeDeltas ? rawProgress.calibration : null
    }
    return {
      debate: Array.isArray(parsed.debate?.lines) ? parsed.debate : null,
      experiment: Array.isArray(parsed.experiment?.dailyTasks) ? parsed.experiment : null,
      progress,
      cycle: Number.isInteger(parsed.cycle) && Number(parsed.cycle) > 0 ? Number(parsed.cycle) : 1,
      calibrationHistory: Array.isArray(parsed.calibrationHistory) ? parsed.calibrationHistory : [],
    }
  } catch {
    return { debate: null, experiment: null, progress: emptyExperimentProgress(), cycle: 1, calibrationHistory: [] }
  }
}

const liveEvidenceTtlMs = 6 * 60 * 60 * 1000

function liveEvidenceStorageKey(situation: Situation, eventId: string) {
  return `${simulationStorageKey(situation)}:zhihu-evidence:v3:${eventId}`
}

function readLiveEvidence(situation: Situation, eventId: string): LiveEvidenceRecord | null {
  try {
    const stored = window.localStorage.getItem(liveEvidenceStorageKey(situation, eventId))
    if (!stored) return null
    const parsed = JSON.parse(stored) as LiveEvidenceRecord
    if (!Array.isArray(parsed.items) || typeof parsed.cachedAt !== 'number') return null
    if (Date.now() - parsed.cachedAt > liveEvidenceTtlMs) return null
    return parsed
  } catch {
    return null
  }
}

const eventSearchThemes: Record<string, string> = {
  'A-30': '系统学习 编程入门 项目失败 坚持 转向 亲身经历',
  'A-90': '学习编程 实习机会 专业学习 时间冲突 亲身经历',
  'A-180': '跨专业 技术能力 半年学习 复盘 亲身经历',
  'B-30': 'AI协作 原型失败 调试 基础能力 亲身经历',
  'B-90': 'AI工具 工作流 项目机会 时间取舍 亲身经历',
  'B-180': 'AI协作 做产品 能力边界 复盘 亲身经历',
  'C-30': '深耕专业 同伴转行 焦虑 坚持 亲身经历',
  'C-90': '专业能力 数字工具 项目机会 时间取舍 亲身经历',
  'C-180': '原专业 长期积累 职业选择 复盘 亲身经历',
}

const calibrationMetricLabels: Record<string, string> = {
  technicalSkill: '技术',
  aiCollaboration: 'AI协作',
  domainDepth: '专业',
  portfolio: '作品',
  opportunity: '机会',
  confidence: '信心',
  energy: '精力',
}

function buildLiveEvidenceQuery(situation: Situation, eventId: string) {
  return `${buildProfileSearchContext(situation)} ${eventSearchThemes[eventId] ?? '职业选择 真实经历'}`.slice(0, 120)
}

const demoCareerUniverses = [
  {
    code: 'A',
    tone: 'blue',
    title: '系统学习',
    choice: '从基础学起，先弄懂自己写的代码',
    fit: '愿意先弄懂基础，接受慢一点成形',
    preview: '做出一个能运行的小产品，也学会自己排错。',
    future: '半年后，你可能终于能独立修好一个报错。只是做出第一个作品，比想象中慢得多。',
    tension: '时间就这么多，补基础也意味着少做几件别的事。',
    milestones: ['补基础与调试', '完成第一个真实项目', '开始建立技术判断力'],
    action: '按自己的时间预算，先试学一周',
    sourceIndex: 0,
  },
  {
    code: 'B',
    tone: 'amber',
    title: 'AI 协作',
    choice: '只围绕一个真实任务，边做边学必要代码',
    fit: '想先做出原型，再补关键能力',
    preview: '留下一个能工作的 AI 工具，也知道它何时会失手。',
    future: '半年后，工具可能已经帮上忙。可它一出错，你敢不敢继续用，还是得自己判断。',
    tension: '做出来很快，修不好时也确实着急。',
    milestones: ['选定一个重复任务', '和 AI 完成原型', '补齐高频知识缺口'],
    action: '把本周最重复的任务写下来',
    sourceIndex: 1,
  },
  {
    code: 'C',
    tone: 'green',
    title: '专业深耕',
    choice: '继续做本专业，弄清哪些活值得借助工具',
    fit: '想把专业积累继续做成作品',
    preview: '手里的专业问题更熟了，需要什么工具也更清楚。',
    future: '半年后，你可能更确信本专业值得做。看到别人靠新工具赶上来，心里也难免发慌。',
    tension: '专业可以继续做深，技术难题还得找人商量。',
    milestones: ['找出自己最拿手的问题', '建立工具选择清单', '与技术伙伴协作'],
    action: '列出三件不必亲自编码的事',
    sourceIndex: 2,
  },
] as const

const journeyStages = [30, 90, 150, 180] as const
const journeyStageLabels: Record<(typeof journeyStages)[number], string> = {
  30: '起步',
  90: '第一次分岔',
  150: '边界测试',
  180: '回到现实',
}

const situationGroups: Array<{
  key: SituationChoiceKey
  prefix: string
  options: Array<{ value: Situation[SituationChoiceKey]; label: string }>
}> = [
  {
    key: 'identity',
    prefix: '我现在处于',
    options: [
      { value: 'student', label: '还在读书' },
      { value: 'transition', label: '求职 / 转型期' },
      { value: 'working', label: '已经工作' },
      { value: 'restart', label: '歇了一阵，重新开始' },
    ],
  },
  {
    key: 'intent',
    prefix: '这次最想做到',
    options: [
      { value: 'efficiency', label: '少花点冤枉时间' },
      { value: 'portfolio', label: '做出一个作品' },
      { value: 'career', label: '尝试新方向' },
      { value: 'literacy', label: '想清楚值不值得学' },
    ],
  },
  {
    key: 'time',
    prefix: '每周能投入',
    options: [
      { value: 'low', label: '不超过 2 小时' },
      { value: 'medium', label: '每周 3—5 小时' },
      { value: 'deep', label: '每周 6—10 小时' },
      { value: 'sprint', label: '短期集中投入' },
    ],
  },
]

const situationLabels = {
  identity: { student: '还在读书', transition: '求职 / 转型期', working: '已经工作', restart: '歇了一阵，重新开始' },
  intent: { efficiency: '少花点冤枉时间', portfolio: '做出一个作品', career: '尝试新方向', literacy: '想清楚值不值得学' },
  time: { low: '≤ 2 小时 / 周', medium: '3—5 小时 / 周', deep: '6—10 小时 / 周', sprint: '短期集中投入' },
  sacrifice: { study: '学业 / 本职工作', income: '收入稳定', energy: '睡眠和精力', domain: '专业积累', open: '暂时没有明确底线' },
}

const sacrificePrompt = {
  efficiency: '为了提升效率，你最不愿牺牲什么？',
  portfolio: '为了做出作品，你最不愿牺牲什么？',
  career: '为了尝试新方向，你最不愿牺牲什么？',
  literacy: '为了想清楚值不值得学，你最不愿牺牲什么？',
} as const

function compactProfileText(value: string, max = 46) {
  return value.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max)
}

function formatEvidenceTime(value?: string) {
  if (!value) return '缓存 6 小时'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '缓存 6 小时'
  return `更新于 ${date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })} · 缓存 6 小时`
}

function buildCoreQuestion(situation: Situation) {
  const confusion = compactProfileText(situation.confusion, 72).replace(/[。！!]+$/g, '')
  const goal = compactProfileText(situation.goal, 48).replace(/[。！!？?]+$/g, '')
  if (confusion && /(?:吗|如何|怎么|该不该|是否|要不要|还是)[^。！？?]*$/.test(confusion)) {
    return `${confusion.replace(/[？?]+$/g, '')}？`
  }
  if (confusion && goal) {
    return `我该怎样处理“${confusion}”，并在180天内做到“${goal}”？`
  }
  return '我该怎样选择接下来180天的学习路线？'
}

function buildProfileSearchContext(situation: Situation) {
  return [
    situationLabels.identity[situation.identity],
    situationLabels.intent[situation.intent],
    `不可牺牲${situationLabels.sacrifice[situation.sacrifice]}`,
    compactProfileText(situation.confusion, 42),
    compactProfileText(situation.goal, 30),
    compactProfileText(situation.worries, 22),
  ].filter(Boolean).join(' ').slice(0, 110)
}

function getSituationReading(situation: Situation) {
  const isGap = situation.identity === 'student' && situation.intent === 'efficiency' && situation.time === 'low'
  if (isGap) {
    return {
      isGap: true,
      directMatches: 0,
      nearby: 13,
      confidence: '无人覆盖',
      title: '答案在这里断掉了',
      detail: `${programmingCorpusStats.records} 条公开样本讨论了相邻处境，却没有一条同时说明在校阶段、真实任务、每周两小时、不可牺牲的底线和最终结果。`,
    }
  }
  if (situation.intent === 'career') {
    return {
      isGap: false,
      directMatches: situation.time === 'deep' ? 8 : 4,
      nearby: 6,
      confidence: '证据较多',
      title: '结论开始收敛',
      detail: '多数亲历回答认为，转行需要系统学习；AI 能降低启动成本，但不能替代调试和工程基础。',
    }
  }
  if (situation.intent === 'literacy') {
    return {
      isGap: false,
      directMatches: 2,
      nearby: 9,
      confidence: '样本偏薄',
      title: '主张很多，边界很少',
      detail: '已有回答强调技术素养的价值，但很少有人说明“学到什么程度就足够”。',
    }
  }
  return {
    isGap: false,
    directMatches: situation.identity === 'working' ? 7 : 4,
    nearby: 8,
    confidence: '局部覆盖',
    title: '真实任务决定回报',
    detail: '任务越重复、输入越结构化，轻量编程越容易在短期内产生可验证的收益。',
  }
}

const statusCopy: Record<BranchStatus, { label: string; hint: string }> = {
  covered: { label: '已覆盖', hint: '有多条直接回答' },
  thin: { label: '样本偏薄', hint: '仍需独立案例' },
  gap: { label: '空枝', hint: '尚无直接回答' },
}

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="brand" aria-label="问枝首页">
      <span className="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 36 36" role="img">
          <path d="M18 30V8M18 17l-7-6M18 22l8-7M11 11H6M26 15h5M18 8l4-4" />
          <circle cx="6" cy="11" r="2.4" />
          <circle cx="31" cy="15" r="2.4" />
          <circle cx="22" cy="4" r="2.4" />
        </svg>
      </span>
      <span className="brand-name">问枝</span>
      {!compact && <span className="brand-rule">人生选择游戏</span>}
    </div>
  )
}

function StatusPill({ status, label }: { status: BranchStatus; label?: string }) {
  return (
    <span className={`status-pill status-${status}`}>
      <span className="status-dot" />
      {label ?? statusCopy[status].label}
    </span>
  )
}

function BranchField({
  activeIndex = 0,
  gapMode = false,
  scene = 0,
  situationLabel,
}: {
  activeIndex?: number
  gapMode?: boolean
  scene?: number
  situationLabel: string
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const probeRef = useRef<HTMLDivElement>(null)
  const coordinateRef = useRef<HTMLSpanElement>(null)
  const activeRef = useRef(activeIndex)
  const gapRef = useRef(gapMode)
  const telemetry = sceneTelemetry[scene] ?? sceneTelemetry[0]

  useEffect(() => {
    activeRef.current = activeIndex
  }, [activeIndex])

  useEffect(() => {
    gapRef.current = gapMode
  }, [gapMode])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    if (!context) return

    let frame = 0
    let lastDrawTime = 0
    let width = 0
    let height = 0
    let dpr = 1
    let pulse = { x: 0.5, y: 0.5, born: -10000 }
    const pointer = { x: 0.5, y: 0.48, tx: 0.5, ty: 0.48 }
    let activeAngle = 0
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let seed = 8137
    const random = () => {
      seed = (seed * 9301 + 49297) % 233280
      return seed / 233280
    }

    const pointCount = 1500
    const spherePoints = Array.from({ length: pointCount }, (_, index) => {
      const goldenAngle = Math.PI * (3 - Math.sqrt(5))
      const y = 1 - (index / (pointCount - 1)) * 2
      const ringRadius = Math.sqrt(1 - y * y)
      const theta = goldenAngle * index
      return {
        x: Math.cos(theta) * ringRadius,
        y,
        z: Math.sin(theta) * ringRadius,
        size: random() > 0.84 ? 3 : 2,
        phase: random() * Math.PI * 2,
        density: random(),
      }
    })
    const projected = spherePoints.map((point) => ({ ...point, rx: 0, ry: 0, rz: 0, sx: 0, sy: 0, perspective: 1 }))

    const fieldStars = Array.from({ length: 170 }, (_, index) => ({
      x: random(),
      y: random(),
      z: 0.2 + random() * 0.8,
      size: index % 17 === 0 ? 3 : index % 5 === 0 ? 2 : 1,
      phase: random() * Math.PI * 2,
    }))

    const hotspots = [
      { x: -0.62, y: 0.2, z: 0.76 },
      { x: 0.26, y: 0.67, z: 0.69 },
      { x: 0.74, y: -0.3, z: 0.6 },
    ]

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      width = Math.max(1, rect.width)
      height = Math.max(1, rect.height)
      dpr = Math.min(window.devicePixelRatio || 1, width < 760 ? 1.25 : 1.5)
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      context.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const onPointerMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      pointer.tx = (event.clientX - rect.left) / Math.max(rect.width, 1)
      pointer.ty = (event.clientY - rect.top) / Math.max(rect.height, 1)
      const clampedX = Math.max(0, Math.min(1, pointer.tx))
      const clampedY = Math.max(0, Math.min(1, pointer.ty))
      if (coordinateRef.current) {
        coordinateRef.current.textContent = `X ${String(Math.round(clampedX * 99)).padStart(2, '0')} · Y ${String(Math.round(clampedY * 99)).padStart(2, '0')}`
      }
      if (!reducedMotion && probeRef.current) {
        probeRef.current.style.transform = `translate3d(${clampedX * width}px, ${clampedY * height}px, 0) translate(-50%, -50%)`
      }
    }
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target
      if (target instanceof Element && target.closest('button, a, input, select, textarea, dialog')) return
      const rect = canvas.getBoundingClientRect()
      pulse = {
        x: (event.clientX - rect.left) / Math.max(rect.width, 1),
        y: (event.clientY - rect.top) / Math.max(rect.height, 1),
        born: performance.now(),
      }
      const probe = probeRef.current
      if (probe && !reducedMotion) {
        probe.classList.remove('is-sampling')
        window.requestAnimationFrame(() => probe.classList.add('is-sampling'))
      }
    }

    const draw = (time: number) => {
      if (!reducedMotion && (document.hidden || time - lastDrawTime < 32)) {
        frame = window.requestAnimationFrame(draw)
        return
      }
      lastDrawTime = time
      pointer.x += (pointer.tx - pointer.x) * 0.045
      pointer.y += (pointer.ty - pointer.y) * 0.045
      context.clearRect(0, 0, width, height)
      context.fillStyle = '#061321'
      context.fillRect(0, 0, width, height)

      const active = activeRef.current
      const targetAngle = active * 0.82
      activeAngle += (targetAngle - activeAngle) * 0.035
      const autoTurn = reducedMotion ? 0 : time * 0.000055
      const yaw = autoTurn + activeAngle + (pointer.x - 0.5) * 0.72
      const pitch = (pointer.y - 0.5) * -0.34 - 0.08
      const yawCos = Math.cos(yaw)
      const yawSin = Math.sin(yaw)
      const pitchCos = Math.cos(pitch)
      const pitchSin = Math.sin(pitch)
      const compact = width < 760
      const radius = Math.min(width, height) * (compact ? 0.72 : 0.72)
      const centerX = width * (compact ? 0.78 : 0.73) + (pointer.x - 0.5) * 38
      const centerY = height * (compact ? 0.4 : 0.58) + (pointer.y - 0.5) * 26

      fieldStars.forEach((star, index) => {
        const drift = reducedMotion ? 0 : Math.sin(time * 0.00025 + star.phase) * 4
        const x = star.x * width + (pointer.x - 0.5) * 24 * star.z + drift
        const y = star.y * height + (pointer.y - 0.5) * 17 * star.z
        const alpha = 0.11 + star.z * 0.18 + (index % 29 === active * 7 ? 0.3 : 0)
        context.fillStyle = index % 29 === active * 7
          ? `rgba(57,143,255,${Math.min(1, alpha + .2)})`
          : `rgba(168,198,229,${alpha * .72})`
        context.fillRect(Math.round(x / 3) * 3, Math.round(y / 3) * 3, star.size, star.size)
      })

      context.save()
      context.translate((pointer.x - 0.5) * 10, (pointer.y - 0.5) * 7)
      context.strokeStyle = 'rgba(75,155,255,.28)'
      context.lineWidth = 1
      context.setLineDash([2, 9])
      context.beginPath()
      context.ellipse(centerX, centerY, radius * 1.18, radius * 0.29, -0.16, 0, Math.PI * 2)
      context.stroke()
      context.restore()

      spherePoints.forEach((point, index) => {
        const x1 = point.x * yawCos + point.z * yawSin
        const z1 = -point.x * yawSin + point.z * yawCos
        const y1 = point.y * pitchCos - z1 * pitchSin
        const z2 = point.y * pitchSin + z1 * pitchCos
        const perspective = 1 / (1.5 - z2 * 0.42)
        const target = projected[index]
        target.rx = x1
        target.ry = y1
        target.rz = z2
        target.sx = centerX + x1 * radius * perspective
        target.sy = centerY + y1 * radius * perspective
        target.perspective = perspective
      })

      const hotspot = hotspots[active] ?? hotspots[0]
      projected.forEach((point) => {
        const dx = point.sx - pointer.x * width
        const dy = point.sy - pointer.y * height
        const pointerDistanceSquared = dx * dx + dy * dy
        const pointerDistance = pointerDistanceSquared < 13225 ? Math.sqrt(pointerDistanceSquared) : 115
        const lift = pointerDistanceSquared < 13225 ? (115 - pointerDistance) * 0.06 : 0
        const hotspotDot = point.x * hotspot.x + point.y * hotspot.y + point.z * hotspot.z
        const isHot = hotspotDot > 0.88
        const isVoidRim = gapRef.current && hotspotDot > 0.78 && hotspotDot <= 0.9
        const surface = Math.max(0, (point.rz + 1) / 2)
        const shimmer = reducedMotion ? 0 : Math.sin(time * 0.0012 + point.phase) * 0.06
        const alpha = Math.min(0.94, 0.12 + surface * 0.68 + shimmer)
        const pixel = Math.max(1, point.size * point.perspective + (isHot ? 1.2 : 0))
        if (point.density < 0.08 + (1 - surface) * 0.08) return
        if (gapRef.current && isHot && point.density < 0.92) return
        context.fillStyle = isVoidRim
          ? `rgba(225,239,255,${Math.min(.92, alpha + .16)})`
          : isHot
          ? `rgba(0,102,255,${Math.min(1, alpha + 0.2)})`
          : point.rz > 0.25
            ? `rgba(73,151,255,${alpha})`
            : `rgba(37,78,122,${alpha * 0.82})`
        context.fillRect(
          Math.round((point.sx + (dx / Math.max(pointerDistance, 1)) * lift) / 3) * 3,
          Math.round((point.sy + (dy / Math.max(pointerDistance, 1)) * lift) / 3) * 3,
          pixel,
          pixel,
        )
      })

      const focusPoints = projected.filter((point) => {
        const dot = point.x * hotspot.x + point.y * hotspot.y + point.z * hotspot.z
        return dot > 0.988
      })
      if (focusPoints.length) {
        const focus = focusPoints[Math.floor(focusPoints.length / 2)]
        const breathe = 16 + (reducedMotion ? 0 : Math.sin(time * 0.002) * 5)
        context.setLineDash([3, 4])
        context.strokeStyle = gapRef.current ? 'rgba(225,239,255,.9)' : 'rgba(57,143,255,.86)'
        context.beginPath()
        context.arc(focus.sx, focus.sy, breathe, 0, Math.PI * 2)
        context.stroke()
        context.setLineDash([])
        context.beginPath()
        context.moveTo(focus.sx + breathe, focus.sy)
        context.lineTo(Math.min(width - 24, focus.sx + 96), focus.sy)
        context.strokeStyle = 'rgba(104,173,255,.48)'
        context.stroke()
      }

      const pulseAge = time - pulse.born
      if (pulseAge >= 0 && pulseAge < 900) {
        const progress = pulseAge / 900
        context.beginPath()
        context.arc(pulse.x * width, pulse.y * height, 12 + progress * 120, 0, Math.PI * 2)
        context.strokeStyle = `rgba(104,173,255,${0.72 * (1 - progress)})`
        context.lineWidth = 1
        context.stroke()
      }

      if (!reducedMotion) frame = window.requestAnimationFrame(draw)
    }

    resize()
    window.addEventListener('resize', resize)
    window.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerdown', onPointerDown)
    draw(performance.now())
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('resize', resize)
      window.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerdown', onPointerDown)
    }
  }, [])

  return (
    <>
      <canvas ref={canvasRef} className="branch-field" aria-hidden="true" />
      <div className={`branch-probe ${gapMode ? 'is-gap' : ''}`} ref={probeRef} aria-hidden="true">
        <span /><i />
      </div>
      <aside className={`field-telemetry ${gapMode ? 'is-gap' : ''}`} aria-hidden="true">
        <div className="telemetry-index"><Target size={13} /><span>{telemetry.index}</span></div>
        <strong>{telemetry.metric}<small>{telemetry.unit}</small></strong>
        <p>{scene === 1 ? situationLabel : telemetry.title}</p>
        <div className="telemetry-signal"><i style={{ width: `${telemetry.signal}%` }} /></div>
        <footer><span ref={coordinateRef}>X 50 · Y 48</span><b>{telemetry.note}</b></footer>
      </aside>
      <aside className={`answer-pattern ${scene === 0 ? 'is-visible' : ''}`} aria-label="知乎真实回答构成的答案纸样">
        <div className="pattern-sheet">
          <header className="pattern-head">
            <span>问枝 / ANSWER PATTERN № 01</span>
            <b>把同一个问题，按处境裁开</b>
            <small>知乎公开回答 · {programmingCorpusStats.records} 份样本</small>
          </header>
          <svg className="pattern-drawing" viewBox="0 0 760 610" aria-hidden="true">
            <path className="pattern-outline outline-a" d="M87 88 C190 43 320 69 363 158 C390 214 350 258 310 300 C260 351 251 421 273 535 L88 535 C112 433 95 341 54 271 C20 212 31 132 87 88Z" />
            <path className="pattern-outline outline-b" d="M429 65 C535 32 668 78 704 174 C732 249 683 310 639 350 C602 384 585 438 596 530 L394 530 C414 443 399 374 372 316 C340 249 349 108 429 65Z" />
            <path className="pattern-grade grade-one" d="M116 118 C204 82 292 98 327 169 C354 224 314 264 279 303 C238 349 229 411 246 501" />
            <path className="pattern-grade grade-two" d="M450 98 C537 72 634 105 668 184 C692 241 650 292 609 329 C567 368 552 426 564 501" />
            <path className="pattern-active" d="M142 141 C219 111 280 130 300 185 C319 236 280 269 246 309 C216 345 207 397 217 462" />
            <path className="pattern-active" d="M474 124 C548 102 613 132 638 193 C658 241 618 280 580 317 C544 352 527 401 534 462" />
            <path className="grain-line" d="M177 158 L177 430 M167 174 L177 158 L187 174 M167 414 L177 430 L187 414" />
            <path className="grain-line" d="M522 143 L522 438 M512 159 L522 143 L532 159 M512 422 L522 438 L532 422" />
            <path className="join-line" d="M302 276 C355 254 402 256 456 280" />
            <circle className="pattern-notch" cx="302" cy="276" r="6" />
            <circle className="pattern-notch" cx="456" cy="280" r="6" />
            <circle className="pattern-pin" cx="177" cy="223" r="9" />
            <circle className="pattern-pin" cx="522" cy="213" r="9" />
          </svg>
          <div className="pattern-question">
            <span>知乎问题 / Q01</span>
            <strong>大学生现在<br />还有必要学编程吗？</strong>
            <small>{programmingCorpusStats.records} 条真人回答 · 原文可追溯</small>
          </div>
          {featuredVoices.map((voice, index) => (
            <a className={`pattern-label pattern-label-${index + 1}`} href={voice.sourceUrl} target="_blank" rel="noreferrer" key={voice.author}>
              <i>{String(index + 1).padStart(2, '0')}</i>
              <span><small>{voice.author}</small><strong>{featuredVoiceInsights[index]}</strong></span>
              <ArrowSquareOut size={13} />
            </a>
          ))}
          <div className="pattern-label pattern-label-missing">
            <i>?</i>
            <span><small>仍待补全</small><strong>人文学科 × 每周 ≤ 2h</strong></span>
            <CircleDashed size={14} />
          </div>
          <div className="pattern-legend"><span><i />你的处境线</span><span><i />相邻回答</span><span><i />仍待补全</span></div>
          <div className="pattern-ruler" aria-hidden="true">10　20　30　40　50　60　70</div>
        </div>
      </aside>
    </>
  )
}

function CoverageRing({ value, size = 'large' }: { value: number; size?: 'small' | 'large' }) {
  const radius = 43
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (value / 100) * circumference
  return (
    <div className={`coverage-ring coverage-ring-${size}`} aria-label={`问题覆盖率 ${value}%`}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle className="ring-track" cx="50" cy="50" r={radius} />
        <circle
          className="ring-value"
          cx="50"
          cy="50"
          r={radius}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <span><strong>{value}</strong><small>%</small></span>
    </div>
  )
}

function MiniTree() {
  return (
    <div className="mini-tree-card" aria-hidden="true">
      <div className="specimen-label">BRANCH SPECIMEN · 01</div>
      <svg className="mini-tree-lines" viewBox="0 0 540 340">
        <path d="M64 170 C130 170 130 72 205 72" />
        <path d="M64 170 C130 170 130 170 205 170" />
        <path d="M64 170 C130 170 130 268 205 268" />
        <path d="M322 170 C375 170 375 125 426 125" />
        <path className="gap-line" d="M322 170 C375 170 375 220 426 220" />
      </svg>
      <div className="mini-node mini-root">大学生<br />要学编程吗？</div>
      <div className="mini-node mini-a"><i />转行开发 <small>8 回答</small></div>
      <div className="mini-node mini-b active"><i />提高本业效率 <small>7 回答</small></div>
      <div className="mini-node mini-c thin"><i />技术素养 <small>2 回答</small></div>
      <div className="mini-node mini-d"><i />数据自动化 <small>4 回答</small></div>
      <div className="mini-node mini-e gap"><i />每周 ≤ 2 小时 <small>0 回答</small></div>
      <div className="mini-note">
        <CircleDashed size={14} />
        发现 1 根待补全空枝
      </div>
    </div>
  )
}

function MethodologyDialog({ onClose, pendingCount }: { onClose: () => void; pendingCount: number }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    dialog.showModal()
    titleRef.current?.focus()
    return () => {
      if (dialog.open) dialog.close()
    }
  }, [])

  return (
    <dialog
      className="method-dialog"
      ref={dialogRef}
      aria-labelledby="method-dialog-title"
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
    >
      <div className="method-sheet">
        <header className="method-sheet-head">
          <div>
            <span className="method-index">TRACE MAP / 现实回声工作台</span>
            <h2 id="method-dialog-title" ref={titleRef} tabIndex={-1}>别人的经历，<br />怎么写进了这场游戏？</h2>
            <p>这里能查到引用的知乎回答，也会说明它们如何影响剧情。后续事件和结局是模拟的。</p>
          </div>
          <div className="method-cutaway" aria-hidden="true">
            <span className="method-cutaway-layer method-cutaway-layer-1" />
            <span className="method-cutaway-layer method-cutaway-layer-2" />
            <span className="method-cutaway-layer method-cutaway-layer-3" />
            <span className="method-cutaway-core"><BookOpen size={25} /></span>
            <em>原文</em>
          </div>
          <button className="method-close" type="button" onClick={onClose} aria-label="关闭研究方法"><X size={19} /></button>
        </header>

        <section className="method-trace" aria-label="从知乎原文到职业分岔的四个步骤">
          <article><i><BookOpen size={19} /></i><small>01 · 真人来源</small><strong>回到知乎原文</strong><p>保留作者、摘要和链接，随时核对上下文。</p></article>
          <ArrowRight size={18} />
          <article><i><Target size={19} /></i><small>02 · 现实约束</small><strong>只提取可比较的事实</strong><p>身份、任务、投入时间、失败与实际结果。</p></article>
          <ArrowRight size={18} />
          <article><i><GitBranch size={19} /></i><small>03 · 个性化映射</small><strong>放进你的选择现场</strong><p>用你的目标与底线，重组为可选择的冲突。</p></article>
          <ArrowRight size={18} />
          <article><i><Sparkles size={19} /></i><small>04 · AI 推演</small><strong>继续尚未发生的路</strong><p>日期、后续事件和结局会被单独标注为模拟。</p></article>
        </section>

        <div className="method-reading">
          <section className="method-trust" aria-labelledby="protocol-title">
            <div className="method-section-heading">
              <span>01</span>
              <div><h3 id="protocol-title">哪些有出处，哪些是游戏编的？</h3><p>越靠近原文，越可以直接核对；越靠近未来，越需要由你验证。</p></div>
            </div>
            <div className="method-trust-layers">
              <article><b>来源层</b><strong>可以核对</strong><p>原文确实由这位答主发布，作者、摘要和链接被保留。</p></article>
              <article><b>转译层</b><strong>可以追踪</strong><p>你能看到哪条现实约束被放进了当前剧情。</p></article>
              <article><b>推演层</b><strong>需要验证</strong><p>未来事件用于比较选择，不代表发生概率或职业结论。</p></article>
            </div>
          </section>

          <section className="method-guide" aria-labelledby="limitations-title">
            <div className="method-section-heading">
              <span>02</span>
              <div><h3 id="limitations-title">怎样阅读一条“现实回声”？</h3><p>先看这个人与你哪里相像，再看哪里不一样。</p></div>
            </div>
            <ul>
              <li><b>看相似条件</b><span>先比较身份、任务和投入，不复制别人的结果。</span></li>
              <li><b>看经历细节</b><span>赞同数帮助发现内容，但不替你判断适配度。</span></li>
              <li><b>看下一步行动</b><span>读完以后，挑一件七天内能试的事。</span></li>
            </ul>
            <div className="method-scope">
              <span>DATASET V{programmingMethodology.datasetVersion}</span>
              <b>{pendingCount > 0 ? `${pendingCount} 条新经历待审核` : '公开来源持续更新'}</b>
              <p>本页仅展示当前体验实际使用的来源。检索日期 {programmingMethodology.retrievedAt}。</p>
            </div>
          </section>
        </div>

        <section className="source-register" aria-labelledby="source-register-title">
          <div className="source-register-head">
            <div><span>03 / REAL VOICES</span><h3 id="source-register-title">打开这些真实回答</h3></div>
            <p>每张索引卡都通向知乎原文。故事从这里来，也可以回到这里核对。</p>
          </div>
          <div className="source-register-list">
            {programmingMethodology.sourcePages.map((page) => (
              <a href={page.url} target="_blank" rel="noreferrer" key={page.id}>
                <span className={`source-author-avatar ${page.avatarUrl ? 'has-avatar' : ''}`}>
                  {page.avatarUrl && <img loading="lazy" decoding="async" src={page.avatarUrl} alt={`${page.author}的知乎头像`} referrerPolicy="no-referrer" onError={(event) => { event.currentTarget.style.display = 'none' }} />}
                  <i>{page.author.slice(0, 1)}</i>
                </span>
                <div><em>知乎答主 · {page.author}</em><strong>{page.title}</strong><small>{page.access === 'full' ? '原文完整可查' : '原文搜索摘要'}{page.answerCountShown ? ` · ${page.answerCountShown} 个回答` : ''}</small></div>
                <ArrowSquareOut size={16} />
              </a>
            ))}
          </div>
        </section>

        <footer className="method-foot">
          <FileSearch size={16} />
          <p>页面中的作者、摘要与链接来自可回查来源；日期、冲突、选项和结果属于基于来源的模拟改编。</p>
          <span>请把它当作试走，不要当作预测。</span>
        </footer>
      </div>
    </dialog>
  )
}

function LegacyHome({
  onAnalyze,
  onOpenMethod,
}: {
  onAnalyze: (id: string, experimental?: boolean, situation?: Situation) => void
  onOpenMethod: () => void
}) {
  const homeRef = useRef<HTMLElement>(null)
  const [situation, setSituation] = useState<Situation>(LIVE_AI_ENABLED ? defaultSituation : judgeDemoSituation)
  const [scene, setScene] = useState(0)
  const [isScrubbing, setIsScrubbing] = useState(false)
  const sceneLockRef = useRef(false)
  const sceneLockTimerRef = useRef<number | null>(null)
  const reading = getSituationReading(situation)
  const activeIndex = (
    (situation.identity === 'student' ? 0 : situation.identity === 'transition' ? 1 : situation.identity === 'working' ? 2 : 3)
    + (situation.intent === 'efficiency' ? 0 : situation.intent === 'career' ? 1 : 2)
    + (situation.time === 'low' ? 0 : situation.time === 'medium' ? 1 : 2)
  ) % 3
  const situationLabel = `${situationLabels.identity[situation.identity]} × ${situationLabels.intent[situation.intent]} × ${situationLabels.time[situation.time]}`
  const scrubberStyle = { '--scene-ratio': scene / (sceneLabels.length - 1) } as CSSProperties

  useGSAP(() => {
    const mm = gsap.matchMedia()
    mm.add(
      {
        desktop: '(min-width: 780px)',
        mobile: '(max-width: 779px)',
        reduceMotion: '(prefers-reduced-motion: reduce)',
      },
      (context) => {
        const { reduceMotion } = context.conditions as { reduceMotion: boolean }
        const instant = reduceMotion ? 0 : undefined
        const timeline = gsap.timeline({ defaults: { duration: instant ?? 0.72, ease: 'power3.out' } })
        timeline
          .to('.scene-curtain', { scaleY: 0, transformOrigin: 'top', duration: instant ?? 0.82, ease: 'power4.inOut' }, 0)
          .from('.branch-field', { autoAlpha: 0, scale: 1.15, yPercent: 18, duration: instant ?? 1.35, ease: 'power4.out' }, 0.1)
          .from('.award-nav > *', { autoAlpha: 0, y: -18, stagger: 0.06 }, 0.28)
          .from('.scene-hero .award-overline', { autoAlpha: 0, x: -24 }, 0.42)
          .from('.scene-hero .award-title span', { autoAlpha: 0, y: 54, stagger: 0.1 }, 0.46)
          .from('.scene-hero .award-subtitle', { autoAlpha: 0, y: 18 }, 0.7)
          .from('.answer-pattern .pattern-sheet', {
            autoAlpha: 0,
            scale: 0.975,
            y: 14,
            duration: instant ?? 0.82,
          }, 0.56)
          .from('.answer-pattern .pattern-active', {
            strokeDashoffset: 96,
            duration: instant ?? 1.15,
            ease: 'power2.inOut',
          }, 0.72)
          .from('.answer-pattern .pattern-label, .answer-pattern .pattern-question', {
            autoAlpha: 0,
            y: 14,
            stagger: 0.075,
            duration: instant ?? 0.52,
          }, 0.78)
          .from('.scene-advance', { autoAlpha: 0, y: 12 }, 0.84)
        return () => timeline.kill()
      },
    )
    return () => mm.revert()
  }, { scope: homeRef })

  useGSAP(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const step = (direction: number) => {
      if (sceneLockRef.current) return
      sceneLockRef.current = true
      setScene((current) => Math.max(0, Math.min(3, current + direction)))
      sceneLockTimerRef.current = window.setTimeout(() => { sceneLockRef.current = false }, reducedMotion ? 80 : 820)
    }
    const observer = Observer.create({
      target: homeRef.current,
      type: 'wheel,touch',
      tolerance: 42,
      preventDefault: true,
      ignore: '.scene-scrubber, button, input, select, textarea, dialog, a, .condition-console',
      onDown: () => step(1),
      onUp: () => step(-1),
    })
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target
      if (target instanceof Element && target.closest('button, input, select, textarea, dialog, a')) return
      if (event.key === 'ArrowDown' || event.key === 'PageDown') step(1)
      if (event.key === 'ArrowUp' || event.key === 'PageUp') step(-1)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      observer.kill()
      window.removeEventListener('keydown', onKeyDown)
      if (sceneLockTimerRef.current !== null) window.clearTimeout(sceneLockTimerRef.current)
    }
  }, { scope: homeRef })

  useGSAP(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const activeScene = `[data-scene="${scene}"]`
    const timeline = gsap.timeline({ defaults: { duration: reducedMotion ? 0 : 0.72, ease: 'power4.inOut' } })
    timeline
      .set('.story-scene', { pointerEvents: 'none' })
      .to('.story-scene', { autoAlpha: 0, y: -28, filter: 'blur(8px)', duration: reducedMotion ? 0 : 0.28 }, 0)
      .fromTo(activeScene, { autoAlpha: 0, y: 46, filter: 'blur(10px)' }, { autoAlpha: 1, y: 0, filter: 'blur(0px)', pointerEvents: 'auto' }, 0.18)
      .to('.branch-field', {
        scale: [1, 1.12, 1.28, 1.45][scene],
        xPercent: [0, -4, -10, -16][scene],
        yPercent: [0, 2, -2, -6][scene],
        filter: scene === 3 ? 'saturate(.35) contrast(1.28)' : 'saturate(1.05) contrast(1.1)',
      }, 0)
      .to('.award-grid', { xPercent: scene * -2.2, opacity: scene === 3 ? 0.22 : 0.48 }, 0)
      .fromTo('.field-telemetry > *', { autoAlpha: 0, x: 14 }, { autoAlpha: 1, x: 0, duration: reducedMotion ? 0 : 0.36, stagger: reducedMotion ? 0 : 0.045 }, 0.2)
      .fromTo('.scene-scrubber-thumb', { scale: reducedMotion ? 1 : 0.72 }, { scale: 1, duration: reducedMotion ? 0 : 0.38, ease: 'back.out(2.4)' }, 0.18)
    return () => timeline.kill()
  }, { scope: homeRef, dependencies: [scene], revertOnUpdate: true })

  useGSAP(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const timeline = gsap.timeline({ defaults: { ease: 'power3.out' } })
    timeline
      .fromTo('.situation-pulse', { scaleX: 0, transformOrigin: 'left', autoAlpha: 1 }, { scaleX: 1, duration: reducedMotion ? 0 : 0.25 })
      .to('.situation-pulse', { scaleX: 0, transformOrigin: 'right', autoAlpha: 0, duration: reducedMotion ? 0 : 0.32 })
      .fromTo('.branch-field', { scale: 1.025, filter: 'saturate(.35)' }, { scale: 1, filter: 'saturate(1)', duration: reducedMotion ? 0 : 0.72 }, 0)
      .fromTo('.field-telemetry footer b', { autoAlpha: 0, x: 12 }, { autoAlpha: 1, x: 0, duration: reducedMotion ? 0 : 0.34 }, 0.08)
    return () => timeline.kill()
  }, {
    scope: homeRef,
    dependencies: [situation.identity, situation.intent, situation.time],
    revertOnUpdate: true,
  })

  const updateSituation = (key: SituationChoiceKey, value: Situation[SituationChoiceKey]) => {
    setSituation((current) => ({ ...current, [key]: value }))
  }

  return (
    <main className={`award-home scene-${scene} ${reading.isGap ? 'is-gap' : 'has-answers'}`} ref={homeRef}>
      <div className="scene-curtain" aria-hidden="true" />
      <BranchField activeIndex={activeIndex} gapMode={reading.isGap} scene={scene} situationLabel={situationLabel} />
      <div className="award-grid" aria-hidden="true" />
      <div className="situation-pulse" aria-hidden="true" />

      <header className="award-nav">
        <button className="logo-button" onClick={() => setSituation(defaultSituation)}><Logo compact /></button>
        <div className="award-progress" aria-label="探索章节">
          {sceneLabels.map((label, index) => (
            <span key={label}>
              {index > 0 && <i />}
              <button className={scene === index ? 'active' : ''} onClick={() => setScene(index)} aria-label={`第 ${index + 1} 幕：${label}`} aria-current={scene === index ? 'step' : undefined}>
                <b>0{index + 1}</b><small>{label}</small>
              </button>
            </span>
          ))}
        </div>
        <div className="award-nav-actions">
          <button className="method-entry" type="button" onClick={onOpenMethod} aria-label="打开研究方法账本"><FileSearch size={14} /><span>研究方法</span></button>
          <div className="award-nav-meta"><span className="pulse-dot" />知乎公开回答 · LIVE</div>
        </div>
      </header>

      <section className="award-stage story-scene scene-hero" data-scene="0">
        <div className="award-copy">
          <h1 className="award-title">
            <span>同一个问题，</span>
            <span>会长出<span className="outline-word">不同答案。</span></span>
          </h1>
          <p className="award-subtitle">选三个条件，找到真正与你相似的知乎回答。</p>
          <button className="scene-advance" onClick={() => setScene(1)}><span>找到我的那一枝</span><ArrowRight size={18} /></button>
          <p className="hero-proofline"><b>{programmingCorpusStats.records}</b> 真人回答 <i /> <b>{programmingCorpusStats.sourcePages}</b> 来源页 <i /> 原文可追溯</p>
        </div>

      </section>

      <section className="condition-console story-scene" data-scene="1" aria-label="描述你的处境">
        <div className="console-heading">
          <div><span>01 / 把自己放进问题</span><h2>你是谁，为什么学，每周能花多久？</h2></div>
          <p>每一次选择，都会让答案地形重新聚焦。</p>
        </div>
        <div className="condition-lines">
          {situationGroups.map((group) => (
            <div className="condition-line" key={group.key}>
              <span>{group.prefix}</span>
              <div role="group" aria-label={group.prefix}>
                {group.options.map((option) => (
                  <button
                    key={option.value}
                    className={situation[group.key] === option.value ? 'active' : ''}
                    aria-pressed={situation[group.key] === option.value}
                    onClick={() => updateSituation(group.key, option.value)}
                  >
                    {situation[group.key] === option.value && <Check size={11} />}
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="console-action">
          <div className="situation-signature">
            <span>{situationLabels.identity[situation.identity]}</span><i>×</i>
            <span>{situationLabels.intent[situation.intent]}</span><i>×</i>
            <span>{situationLabels.time[situation.time]}</span>
          </div>
          <button onClick={() => setScene(2)}>
            <span>
              <small>基于 {programmingCorpusStats.records} 条公开样本</small>
              生成我的答案地形
            </span>
            <ArrowRight size={20} />
          </button>
        </div>
      </section>

      <section className="story-evidence story-scene" data-scene="2" aria-live="polite">
        <div className="story-scene-index">03 / HEAR, THEN JUDGE</div>
        <p className="story-kicker">AI 可以归纳，但不能替真实经历作证。</p>
        <h2>先听见这些人，<br /><span>再判断答案。</span></h2>
        <div className="corpus-ledger">
          <div><strong>{programmingCorpusStats.records}</strong><span>公开回答样本</span></div>
          <div><strong>{programmingCorpusStats.sourcePages}</strong><span>知乎来源页</span></div>
          <div><strong>{programmingCorpusStats.verifiable}</strong><span>可核验摘要</span></div>
          <div><strong>{programmingCorpusStats.directExperience}</strong><span>明确亲历案例</span></div>
        </div>
        <div className="evidence-principle"><FileSearch size={17} /><span>每条摘要保留作者、来源链接、置信度和风险标记；“本批未发现”不等于“不存在”。</span></div>
        <button className="scene-advance" onClick={() => setScene(3)}><span>继续寻找断掉的答案</span><ArrowRight size={18} /></button>
      </section>

      <section className="story-gap story-scene" data-scene="3" aria-live="polite">
        <div className="story-scene-index">04 / WHO IS STILL MISSING</div>
        <span className="gap-signal"><CircleDashed size={17} />0 条完全同境样本</span>
        <h2>不是没有答案，<br /><span>是这个人还没出现。</span></h2>
        <p>{reading.isGap ? reading.detail : '我们在相邻观点之间发现了一根没有亲历案例支撑的空枝：人文学科、真实任务、每周不超过两小时，并说明最终结果。'}</p>
        <div className="gap-path"><span>人文学科</span><i>×</i><span>改善研究</span><i>×</i><span>≤ 2 小时 / 周</span></div>
        <button className="gap-entry" onClick={() => onAnalyze('programming', false, defaultSituation)}>
          <span><small>进入可交互知识地图</small>亲自走到这根空枝</span><ArrowRight size={22} />
        </button>
      </section>

      <div className={`scene-scrubber ${isScrubbing ? 'is-scrubbing' : ''}`} style={scrubberStyle}>
        <div className="scene-scrubber-copy" aria-hidden="true">
          <span><i />拖动处境尺带</span>
          <b>0{scene + 1} · {sceneLabels[scene]}</b>
        </div>
        <div className="scene-scrubber-control">
          <div className="scene-scrubber-track" aria-hidden="true">
            <i className="scene-scrubber-fill" />
            {sceneLabels.map((label, index) => <span className={scene === index ? 'active' : ''} key={label}><em>0{index + 1}<small>{label}</small></em></span>)}
            <b className="scene-scrubber-thumb"><Target size={13} /></b>
          </div>
          <input
            type="range"
            min="0"
            max={sceneLabels.length - 1}
            step="1"
            value={scene}
            aria-label="拖动选择探索章节"
            aria-valuetext={`第 ${scene + 1} 幕：${sceneLabels[scene]}`}
            onChange={(event) => setScene(Number(event.target.value))}
            onPointerDown={() => setIsScrubbing(true)}
            onPointerUp={() => setIsScrubbing(false)}
            onPointerCancel={() => setIsScrubbing(false)}
          />
        </div>
      </div>

      <div className="award-instruction"><span>{scene < 3 ? '继续裁开' : '进入地图'}</span> {scene < 3 ? '滚动页面，或拖动右下角的处境尺带' : '打开真实来源，或补全仍然缺席的处境'}</div>
    </main>
  )
}

function Home({
  onAnalyze,
  onOpenMethod,
}: {
  onAnalyze: (id: string, experimental?: boolean, situation?: Situation) => void
  onOpenMethod: () => void
}) {
  const homeRef = useRef<HTMLElement>(null)
  const universeMotionRef = useRef({ open: false, index: 1 })
  const returnMotionRef = useRef({ scene: 0, index: 1 })
  const initialProfile = useMemo(() => LIVE_AI_ENABLED ? readLastProfile(window.localStorage, defaultSituation) : judgeDemoSituation, [])
  const [situation, setSituation] = useState<Situation>(initialProfile)
  const [scene, setScene] = useState(0)
  const [profileStep, setProfileStep] = useState(0)
  const [activeUniverseIndex, setActiveUniverseIndex] = useState(1)
  const [isUniverseOpen, setIsUniverseOpen] = useState(false)
  const [worldMotionPaused, setWorldMotionPaused] = useState(false)
  const [routeEntered, setRouteEntered] = useState(false)
  useEffect(() => { if (scene !== 2) setRouteEntered(false) }, [scene])
  const [simulationProfile, setSimulationProfile] = useState<Situation>(initialProfile)
  const [universeRuns, setUniverseRuns] = useState<Record<UniverseCode, UniverseRun>>(() => LIVE_AI_ENABLED ? readUniverseRuns(initialProfile) : createUniverseRuns(judgeDemoSituation))
  const careerUniverses = demoCareerUniverses.map(universe => {
    const route = universeRuns[universe.code].route
    return route ? {...universe,title:route.title,fit:'',choice:route.premise,preview:route.premise,future:route.premise,tension:route.opening.tension,action:route.opening.choices[0].label,milestones:[] as string[]} : universe
  })
  const generatedRoutesReady = (['A','B','C'] as const).every(code => Boolean(universeRuns[code].route))
  const [futureChats, setFutureChats] = useState<Record<UniverseCode, FutureChatMessage[]>>(() => LIVE_AI_ENABLED ? readFutureChats(initialProfile) : { A: [], B: [], C: [] })
  const [futureQuestion, setFutureQuestion] = useState('')
  const [futurePending, setFuturePending] = useState(false)
  const [futurePendingCode, setFuturePendingCode] = useState<UniverseCode | null>(null)
  const [futurePendingStage, setFuturePendingStage] = useState(0)
  const [futureError, setFutureError] = useState('')
  const initialReflection = useMemo(() => LIVE_AI_ENABLED ? readReflection(initialProfile) : { debate: null, experiment: null, progress: emptyExperimentProgress(), cycle: 1, calibrationHistory: [] }, [])
  const [debateQuestion, setDebateQuestion] = useState('时间只够认真做一件事，我到底该把它花在哪儿？')
  const [debate, setDebate] = useState<DebateResult | null>(initialReflection.debate)
  const [debatePending, setDebatePending] = useState(false)
  const [debatePendingStage, setDebatePendingStage] = useState(0)
  const [debateError, setDebateError] = useState('')
  const [experiment, setExperiment] = useState<RealityExperiment | null>(initialReflection.experiment)
  const [experimentPending, setExperimentPending] = useState(false)
  const [experimentCopied, setExperimentCopied] = useState(false)
  const [experimentError, setExperimentError] = useState('')
  const [calibrationPending, setCalibrationPending] = useState(false)
  const [calibrationNote, setCalibrationNote] = useState('')
  const [experimentProgress, setExperimentProgress] = useState<ExperimentProgress>(initialReflection.progress)
  const [simulationCycle, setSimulationCycle] = useState(initialReflection.cycle)
  const [calibrationHistory, setCalibrationHistory] = useState<RecalibrationRecord[]>(initialReflection.calibrationHistory)
  const [simulationGenerating, setSimulationGenerating] = useState(false)
  const [simulationGenerationNote, setSimulationGenerationNote] = useState('')
  const [freeActionOpen, setFreeActionOpen] = useState(false)
  const [freeAction, setFreeAction] = useState('')
  const actionInFlight = useRef(false)
  const [freeActionPending, setFreeActionPending] = useState(false)
  const [allowThirdPartyFallback, setAllowThirdPartyFallback] = useState(false)
  const [freeActionError, setFreeActionError] = useState<FreeActionFeedback | null>(null)
  const [draftSaved, setDraftSaved] = useState(true)
  const [experienceMode, setExperienceMode] = useState<'quick' | 'full'>('full')
  const [judgeDemoActive, setJudgeDemoActive] = useState(false)
  const liveAiActive = LIVE_AI_ENABLED && !judgeDemoActive
  const judgeDemoAutoStartedRef = useRef(false)
  const restoreBeforeDemoRef = useRef<(() => void) | null>(null)
  const [quickArrival, setQuickArrival] = useState<{ code: UniverseCode; choice: string } | null>(null)
  const [choiceImpact, setChoiceImpact] = useState<ChoiceImpact | null>(null)
  const [forkBypass, setForkBypass] = useState('')
  const demoForkRecords = useRef(new Map<string, ForkRecord>())
  const [impactSceneStep, setImpactSceneStep] = useState(0)
  const [echoContext, setEchoContext] = useState<EchoContext | null>(null)
  const [liveEvidence, setLiveEvidence] = useState<LiveEvidenceRecord | null>(null)
  const [liveEvidenceLoading, setLiveEvidenceLoading] = useState(false)
  const [liveEvidenceError, setLiveEvidenceError] = useState('')
  const [liveEvidenceRetry, setLiveEvidenceRetry] = useState(0)
  const [workSample, setWorkSample] = useState<WorkSampleDraft>(emptyWorkSampleDraft)
  const liveEvidenceRequestedRef = useRef(new Set<string>())
  const liveEvidenceActiveKeyRef = useRef('')
  useEffect(() => {
    setImpactSceneStep(0)
  }, [choiceImpact?.id])
  const reading = getSituationReading(situation)
  const activeUniverse = careerUniverses[activeUniverseIndex]
  const activeUniverseVoice = featuredVoices[activeUniverse.sourceIndex]
  const activeRun = universeRuns[activeUniverse.code]
  const forkKey = forkIdentity(activeRun, simulationProfile, simulationCycle)
  const forkEligible = activeRun.currentEvent.day === 30 && activeRun.currentEvent.choices.length === 2
    && (Boolean(activeRun.route) || activeRun.currentEvent.id === 'a-day-30-critical-fork') && forkBypass !== forkKey
  const previousDecision = activeRun.decisions[activeRun.decisions.length - 1]
  const currentEchoContext: EchoContext = {
    code: activeUniverse.code,
    route: activeRun.route?.title ?? activeUniverse.title,
    day: activeRun.currentEvent.day,
    action: previousDecision?.choiceLabel ?? '',
    actionDay: previousDecision?.day,
    eventTitle: activeRun.currentEvent.title,
    obstacle: activeRun.currentEvent.tension,
    profile: buildProfileSearchContext(simulationProfile),
  }
  const evidenceContextId = echoIdentity(currentEchoContext)
  const previousResult = activeRun.route ? '' : previousDecision
    ? previousDecision.actionOutcome?.observableChange ?? previousDecision.actionOutcome?.tradeoff ?? previousDecision.tradeoff ?? '时间已经投入这条路，做过的事慢慢留下了痕迹。'
    : ({ A: '这段时间，课程和练习占据了你的晚上。你想把基础学扎实，再独立做出一个作品。', B: '一个真实任务成了你的练习场。你借助 AI 搭起工具，遇到不会的地方，再回头学一点代码。', C: '你把更多时间留给了本专业。比起追上每一种新工具，你更想先把手头的问题看深一点。' }[activeUniverse.code])
  const activeEventEvidence = activeRun.currentEvent.evidenceIds
    .map((id) => programmingEvidenceById.get(id))
    .filter((item): item is Evidence => Boolean(item))
  const traceEvidenceIds = [...new Set([...activeRun.currentEvent.evidenceIds, ...activeRun.decisions.flatMap(d => d.evidenceIds ?? [])])]
  const traceEvidenceItems = traceEvidenceIds
    .map((id) => programmingEvidenceById.get(id))
    .filter((item): item is Evidence => Boolean(item))
  const featuredTraceEvidence = traceEvidenceItems.slice(0, 2)
  const additionalTraceEvidence = traceEvidenceItems.slice(2)
  const featuredLiveEvidence = (liveEvidence?.items ?? []).slice(0, 1)
  const additionalLiveEvidence = (liveEvidence?.items ?? []).slice(1)
  const additionalEvidenceCount = additionalTraceEvidence.length + additionalLiveEvidence.length
  const traceDeltaLabels: Record<string, string> = {
    technicalSkill: '技术', aiCollaboration: 'AI 协作', domainDepth: '专业', portfolio: '作品', opportunity: '机会', confidence: '信心', energy: '精力', weeklyHours: '投入',
  }
  const activeFutureChat = futureChats[activeUniverse.code]

  const pageLoadReportedRef = useRef(false)
  useEffect(() => {
    trackTelemetry('session_start')
    const reportPageLoad = () => {
      if (pageLoadReportedRef.current) return
      pageLoadReportedRef.current = true
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
      trackTelemetry('page_load', { value: Math.round(navigation?.domContentLoadedEventEnd || performance.now()) })
    }
    if (document.readyState === 'complete') reportPageLoad()
    else window.addEventListener('load', reportPageLoad, { once: true })
    return () => window.removeEventListener('load', reportPageLoad)
  }, [])

  useEffect(() => {
    trackTelemetry('scene_view', { value: scene + 1 })
  }, [scene])

  useEffect(() => {
    const root = homeRef.current
    if (!root) return
    const target = scene === 2
      ? root.querySelector<HTMLElement>(routeEntered ? '.story-event, .journey-ending' : '.universe-doors h2')
      : root.querySelector<HTMLElement>(`.wz-view[data-view="${scene}"] h1, .wz-view[data-view="${scene}"] h2`)
    if (!target) return
    // Route tabs retain keyboard focus; a story choice still moves focus to its next scene.
    if (scene === 2 && document.activeElement?.closest('.paper-route-tabs')) return
    target.tabIndex = -1
    const frame = window.requestAnimationFrame(() => target.focus({ preventScroll: true }))
    return () => window.cancelAnimationFrame(frame)
  }, [activeRun.currentEvent.id, activeUniverse.code, routeEntered, scene])

  useEffect(() => {
    if (!futurePending) {
      setFuturePendingStage(0)
      return
    }
    const readMemory = window.setTimeout(() => setFuturePendingStage(1), 900)
    const checkEvidence = window.setTimeout(() => setFuturePendingStage(2), 2800)
    return () => {
      window.clearTimeout(readMemory)
      window.clearTimeout(checkEvidence)
    }
  }, [futurePending])


  useEffect(() => {
    if (!debatePending) {
      setDebatePendingStage(0)
      return
    }
    const readTimelines = window.setTimeout(() => setDebatePendingStage(1), 850)
    const findConflict = window.setTimeout(() => setDebatePendingStage(2), 2600)
    const foldExperiment = window.setTimeout(() => setDebatePendingStage(3), 6200)
    return () => {
      window.clearTimeout(readTimelines)
      window.clearTimeout(findConflict)
      window.clearTimeout(foldExperiment)
    }
  }, [debatePending])
  const coreQuestion = buildCoreQuestion(simulationProfile)
  const futureQuestionCount = activeFutureChat.filter((message) => message.role === 'user').length
  const completedUniverseCount = (['A', 'B', 'C'] as UniverseCode[]).filter((code) => universeRuns[code].currentEvent.day === 180).length
  const allUniversesComplete = completedUniverseCount === 3
  const completedCodes = (['A', 'B', 'C'] as UniverseCode[]).filter(code => universeRuns[code].currentEvent.day === 180)
  const firstCompletedRun = activeRun.currentEvent.day === 180 ? activeRun : completedCodes.length ? universeRuns[completedCodes[0]] : null
  const draftKey = actionDraftKey(simulationStorageKey(simulationProfile), activeRun, simulationCycle)
  const latestDraftKey = useRef(draftKey)
  latestDraftKey.current = draftKey
  const currentActionContext = `${simulationStorageKey(simulationProfile)}:${simulationCycle}:${judgeDemoActive}`
  const latestActionContext = useRef(currentActionContext)
  latestActionContext.current = currentActionContext
  useEffect(() => {
    const saved = judgeDemoActive ? '' : readActionDraft(window.localStorage, draftKey)
    setFreeAction(saved)
    setFreeActionOpen(Boolean(saved))
    setFreeActionError(null)
    setDraftSaved(true)
  }, [draftKey, judgeDemoActive])
  const updateActionDraft = (text: string) => {
    setFreeAction(text)
    if (!judgeDemoActive) setDraftSaved(saveLocal(window.localStorage, draftKey, text))
  }
  const demoBeat = scene < 3 ? (allUniversesComplete ? 1 : 0) : debate ? (experiment ? 3 : 2) : 2
  const profileReady = situation.confusion.trim().length >= 4 && situation.goal.trim().length >= 4
  const missingProfileFields = [
    situation.confusion.trim().length < 4 ? '此刻困惑' : '',
    situation.goal.trim().length < 4 ? '180天目标' : '',
  ].filter(Boolean)
  const profileStatusNote = profileReady
    ? '准备好了，故事会立即展开'
    : `还差${missingProfileFields.length === 1 ? '一笔' : '两笔'}：${missingProfileFields.join('与')}`
  const situationLabel = `${situationLabels.identity[situation.identity]} · ${situationLabels.intent[situation.intent]} · ${situationLabels.time[situation.time]}`
  const lastCalibration = calibrationHistory[calibrationHistory.length - 1]
  const simulationStatusNote = simulationGenerationNote
    || (simulationCycle > 1 && lastCalibration
      ? `第 ${simulationCycle} 轮继承了上一次现实实验：优先观察宇宙 ${lastCalibration.recommendedUniverse}，但三条路线仍然开放。`
      : '每条路都有代价。这一次，你愿意付哪一种？')
  const recommendedUniverseIndex = situation.intent === 'career' && situation.time === 'deep'
    ? 0
    : situation.intent === 'efficiency' || situation.time === 'low'
      ? 1
      : 2

  useEffect(() => {
    if (LIVE_AI_ENABLED && !judgeDemoActive && experienceMode === 'full' && generatedRoutesReady) saveLocal(window.localStorage, simulationStorageKey(simulationProfile), universeRuns)
  }, [judgeDemoActive, experienceMode, simulationProfile, universeRuns])

  useEffect(() => {
    if (LIVE_AI_ENABLED && !judgeDemoActive) window.localStorage.setItem(futureChatStorageKey(simulationProfile), JSON.stringify(futureChats))
  }, [judgeDemoActive, futureChats, simulationProfile])

  useEffect(() => {
    if (judgeDemoActive || !LIVE_AI_ENABLED) return
    window.localStorage.setItem(reflectionStorageKey(simulationProfile), JSON.stringify({
      debate,
      experiment,
      progress: experimentProgress,
      cycle: simulationCycle,
      calibrationHistory,
    }))
  }, [judgeDemoActive, calibrationHistory, debate, experiment, experimentProgress, simulationCycle, simulationProfile])

  useEffect(() => {
    if (scene !== 2) return
    const eventId = evidenceContextId
    const cacheKey = liveEvidenceStorageKey(simulationProfile, eventId)
    liveEvidenceActiveKeyRef.current = cacheKey
    setLiveEvidenceError('')

    const cached = readLiveEvidence(simulationProfile, eventId)
    if (cached) {
      setLiveEvidence(cached)
      setLiveEvidenceLoading(false)
      return
    }

    setLiveEvidence(null)
    setLiveEvidenceLoading(true)
    if (liveEvidenceRequestedRef.current.has(cacheKey)) return
    liveEvidenceRequestedRef.current.add(cacheKey)

    const query = echoQuery(currentEchoContext)
    void fetch('/api/zhihu/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Wenzhi-Release': releaseHeader() },
      body: JSON.stringify({ query, count: activeRun.currentEvent.day === 30 ? 8 : 3 }),
    })
      .then(async (response) => {
        const payload = await response.json() as ZhihuSearchApiResponse
        if (!response.ok || !payload.search) throw new Error(payload.error?.message || '实时检索暂时不可用。')
        const items = (payload.search.items ?? []).filter((item) => (
          typeof item?.title === 'string'
          && typeof item?.author === 'string'
          && typeof item?.sourceUrl === 'string'
          && (typeof item.relevanceScore !== 'number' || item.relevanceScore >= .08)
          && /^https:\/\/(?:www|zhuanlan)\.zhihu\.com\//.test(item.sourceUrl)
        ))
        const record: LiveEvidenceRecord = {
          items,
          retrievedAt: payload.search.retrievedAt ?? new Date().toISOString(),
          cachedAt: Date.now(),
          emptyReason: payload.search.emptyReason,
        }
        window.localStorage.setItem(cacheKey, JSON.stringify(record))
        trackTelemetry('live_search_result', { routeCode: activeUniverse.code, day: activeRun.currentEvent.day, value: items.length })
        if (liveEvidenceActiveKeyRef.current === cacheKey) setLiveEvidence(record)
      })
      .catch((error: unknown) => {
        liveEvidenceRequestedRef.current.delete(cacheKey)
        trackTelemetry('live_search_error', { routeCode: activeUniverse.code, day: activeRun.currentEvent.day })
        if (liveEvidenceActiveKeyRef.current === cacheKey) {
          setLiveEvidenceError(error instanceof Error ? error.message : '实时检索暂时不可用。')
        }
      })
      .finally(() => {
        if (liveEvidenceActiveKeyRef.current === cacheKey) setLiveEvidenceLoading(false)
      })
  }, [evidenceContextId, liveEvidenceRetry, scene, simulationProfile])

  useGSAP(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const timeline = gsap.timeline({ defaults: { duration: reducedMotion ? 0 : 0.7, ease: 'power3.out' } })
    timeline
      .from('.wz-app', { autoAlpha: 0, y: 24, scale: 0.985 })
      .from('.wz-topbar > *', { autoAlpha: 0, y: -12, stagger: 0.05 }, 0.18)
      .from('.wz-journey button', { autoAlpha: 0, y: 12, stagger: 0.045 }, 0.3)
    return () => timeline.kill()
  }, { scope: homeRef })

  const previousPageRef = useRef({ scene, profileStep })
  useGSAP(() => {
    const root = homeRef.current
    const activeView = root?.querySelector<HTMLElement>(`.wz-view[data-view="${scene}"]`)
    if (!root || !activeView) return
    const previous = previousPageRef.current
    previousPageRef.current = { scene, profileStep }
    // Keep the active page and its text visible; only the page itself settles.
    gsap.set(root.querySelectorAll('.wz-view'), { autoAlpha: 0, pointerEvents: 'none' })
    gsap.set(activeView, { autoAlpha: 1, pointerEvents: 'auto' })
    if (scene === 0) activeView.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    if (scene === 2 || (previous.scene === scene && previous.profileStep === profileStep)) return
    const direction = scene !== previous.scene ? Math.sign(scene - previous.scene) : Math.sign(profileStep - previous.profileStep)
    const paper = activeView.querySelector('.paper-profile, .paper-landing') ?? activeView
    const media = gsap.matchMedia()
    media.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.fromTo(paper, { x: direction * 6, y: 3 }, {
        x: 0, y: 0, duration: .32, ease: 'power2.out', clearProps: 'transform',
      })
    })
    return () => media.revert()
  }, { scope: homeRef, dependencies: [scene, profileStep], revertOnUpdate: true })

  useGSAP(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if (!homeRef.current?.querySelector('.wz-listening-note')) return
    gsap.fromTo('.wz-listening-note', { scale: 0.985, y: 5 }, { scale: 1, y: 0, duration: 0.38, ease: 'back.out(1.5)' })
  }, { scope: homeRef, dependencies: [activeUniverseIndex] })

  useGSAP(() => {
    if (scene !== 3) return
    const mm = gsap.matchMedia()
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      const intro = gsap.timeline({ defaults: { ease: 'power3.out' } })
        .addLabel('curtain', 0)
        .fromTo('.wz-reflect-world', { scale: 1.09, y: 12 }, { scale: 1, y: 0, duration: 1.25 }, 'curtain')
        .fromTo('.wz-future-figures img', { autoAlpha: 0, y: -24, rotation: -5 }, { autoAlpha: 1, y: 0, rotation: 0, duration: .72, stagger: .13 }, .18)
        .fromTo('.wz-future-notes p', { autoAlpha: 0, clipPath: 'inset(0 100% 0 0)' }, { autoAlpha: 1, clipPath: 'inset(0 0% 0 0)', duration: .68, stagger: .16 }, .42)
        .fromTo('.wz-reflect-copy', { autoAlpha: 0, y: 72, rotation: -2.5, scale: .96 }, { autoAlpha: 1, y: 0, rotation: .5, scale: 1, duration: .86, ease: 'back.out(1.35)' }, .5)
        .fromTo('.wz-return-kanshan', { autoAlpha: 0, x: -35, rotation: -7 }, { autoAlpha: 1, x: 0, rotation: 0, duration: .72 }, .72)
        .fromTo('.wz-return-question', { autoAlpha: 0, y: 44 }, { autoAlpha: 1, y: 0, duration: .62 }, .84)

      const worldDrift = gsap.to('.wz-reflect-world', { scale: 1.025, x: 5, y: -3, duration: 9, repeat: -1, yoyo: true, ease: 'sine.inOut' })
      const futureFloat = gsap.to('.wz-future-figures img', {
        y: (index) => index === 1 ? -7 : -4,
        rotation: (index) => index === 1 ? 1.6 : index === 0 ? -1.4 : 1.1,
        duration: (index) => 2.8 + index * .45,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
        stagger: .18,
      })
      const pathLights = gsap.fromTo('.wz-return-pathlights i', { autoAlpha: 0, y: -18, scale: .6 }, { autoAlpha: .9, y: 64, scale: 1.15, duration: 2.7, repeat: -1, stagger: .55, ease: 'power1.inOut' })
      return () => { intro.kill(); worldDrift.kill(); futureFloat.kill(); pathLights.kill() }
    })
    return () => mm.revert()
  }, { scope: homeRef, dependencies: [scene], revertOnUpdate: true })

  useGSAP(() => {
    const previous = returnMotionRef.current
    const entering = scene === 3 && previous.scene !== 3
    const changed = scene === 3 && previous.index !== activeUniverseIndex
    returnMotionRef.current = { scene, index: activeUniverseIndex }
    if (scene !== 3 || entering || !changed || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const direction = activeUniverseIndex - 1
    const stamp = gsap.fromTo('.wz-reality-seals button.active', { scale: 1.7, rotation: direction * 16, y: -16 }, { scale: 1.16, rotation: -8, y: 0, duration: .48, ease: 'back.out(2)' })
    const ticket = gsap.fromTo('.wz-reflect-copy', { y: -5 }, { y: 0, duration: .48, ease: 'bounce.out' })
    const guide = gsap.to('.wz-return-kanshan', { x: direction * 18, rotation: direction * 3, duration: .55, ease: 'power3.out' })
    return () => { stamp.kill(); ticket.kill(); guide.kill() }
  }, { scope: homeRef, dependencies: [activeUniverseIndex, scene], revertOnUpdate: true })

  const updateSituation = (key: SituationChoiceKey, value: Situation[SituationChoiceKey]) => {
    setSituation((current) => ({ ...current, [key]: value }))
  }

  const beginSimulation = () => {
    if (!profileReady || simulationGenerating || actionInFlight.current) return
    if (liveAiActive) saveLocal(window.localStorage, lastProfileKey, situation)
    setFreeActionOpen(false)
    setFreeAction('')
    setFreeActionError(null)
    setSimulationProfile(situation)
    if (!liveAiActive) {
      setUniverseRuns(createUniverseRuns(situation))
      setFutureChats({ A: [], B: [], C: [] })
      setDebate(null)
      setExperiment(null)
      setExperimentProgress(emptyExperimentProgress())
      setSimulationCycle(1)
      setCalibrationHistory([])
      setActiveUniverseIndex(recommendedUniverseIndex)
      setQuickArrival(null)
      setRouteEntered(false)
      setSimulationGenerationNote('示例场景 · 每一幕亲自选择，实时 AI 已暂停。')
      setScene(2)
      return
    }
    setFutureChats(readFutureChats(situation))
    const reflection = readReflection(situation)
    setDebate(reflection.debate)
    setExperiment(reflection.experiment)
    setExperimentProgress(reflection.progress)
    setSimulationCycle(reflection.cycle)
    setCalibrationHistory(reflection.calibrationHistory)
    setActiveUniverseIndex(recommendedUniverseIndex)
    setQuickArrival(null)
    setSimulationGenerationNote(experienceMode === 'quick'
      ? '每一幕都由你选择，一步步走到第 180 天。'
      : '三个宇宙已经展开，AI 正在把你的现实档案写进尚未发生的处境。')

    setRouteEntered(false)
    const saved = readUniverseRuns(situation)
    if (experienceMode === 'full' && (['A','B','C'] as const).every(code => saved[code].route)) {
      setUniverseRuns(saved)
      setScene(2)
      return
    }
    if (experienceMode === 'quick') {
      setUniverseRuns(createUniverseRuns(situation))
      setScene(2)
      return
    }
    setUniverseRuns(createUniverseRuns(situation))
    setScene(2)
    setSimulationGenerating(true)
    setSimulationGenerationNote('正在根据你的处境，写出三种不同的出发方式…')
    void (async () => {
      try {
        const {response,payload} = await fetchJsonWithDeadline<NarrativeApiResponse>('/api/simulation/personalize', {
          method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({profile:situation}),
        }, AI_REQUEST_DEADLINE_MS)
        const routes = readStoryRoutes(payload?.routes)
        if (!response.ok || !routes) throw new Error(payload?.error?.message || '三条路径暂未生成完成，请重试。')
        setUniverseRuns(createGeneratedUniverseRuns(situation, routes, payload.source))
        setSimulationGenerationNote('三条路径已生成。选一条出发，每次行动都会写出新的故事。')
      } catch (error) {
        setSimulationGenerationNote(error instanceof Error ? error.message : '生成未完成，请重试。')
      } finally { setSimulationGenerating(false) }
    })()
  }

  const startJudgeDemo = () => {
    if (judgeDemoActive || simulationGenerating || freeActionPending || futurePending || debatePending || experimentPending || calibrationPending) return
    demoForkRecords.current.clear()
    // React state is immutable: retain the previous values in a closure rather
    // than re-reading a default profile that may discard unsaved personal work.
    restoreBeforeDemoRef.current = () => {
      setSituation(situation)
      setSimulationProfile(simulationProfile)
      setUniverseRuns(universeRuns)
      setFutureChats(futureChats)
      setFutureQuestion(futureQuestion)
      setDebateQuestion(debateQuestion)
      setDebate(debate)
      setExperiment(experiment)
      setExperimentProgress(experimentProgress)
      setSimulationCycle(simulationCycle)
      setCalibrationHistory(calibrationHistory)
      setExperienceMode(experienceMode)
      setQuickArrival(quickArrival)
      setChoiceImpact(choiceImpact)
      setActiveUniverseIndex(activeUniverseIndex)
      setIsUniverseOpen(isUniverseOpen)
      setSimulationGenerationNote(simulationGenerationNote)
      setAllowThirdPartyFallback(allowThirdPartyFallback)
      setWorkSample(workSample)
    }
    const demoRuns = createJudgeDemoRuns(judgeDemoSituation)
    setSituation(judgeDemoSituation)
    setSimulationProfile(judgeDemoSituation)
    setUniverseRuns(demoRuns)
    setFutureChats({ A: [], B: [], C: [] })
    setFutureQuestion('这条路让我真正获得了什么，又失去了什么？')
    setDebateQuestion('每周只有 2 小时，我应该先获得哪一种能力，又愿意承受什么代价？')
    setDebate(null)
    setExperiment(null)
    setExperimentProgress(emptyExperimentProgress())
    setSimulationCycle(1)
    setCalibrationHistory([])
    setAllowThirdPartyFallback(false)
    setWorkSample(emptyWorkSampleDraft)
    setFutureError('')
    setDebateError('')
    setExperimentError('')
    setCalibrationNote('')
    setExperienceMode('quick')
    setQuickArrival(null)
    setChoiceImpact(null)
    setActiveUniverseIndex(1)
    setIsUniverseOpen(false)
    setSimulationGenerationNote('三分钟试玩已就绪：从同一个起点出发，每个宇宙由你亲手决定第一步。')
    setJudgeDemoActive(true)
    setScene(2)
  }

  useEffect(() => {
    if (judgeDemoAutoStartedRef.current || new URLSearchParams(window.location.search).get('demo') !== '1') return
    judgeDemoAutoStartedRef.current = true
    startJudgeDemo()
  }, [])

  const stopJudgeDemo = () => {
    if (freeActionPending || futurePending || debatePending || experimentPending || calibrationPending || simulationGenerating) return
    restoreBeforeDemoRef.current?.()
    restoreBeforeDemoRef.current = null
    setJudgeDemoActive(false)
    setFutureError('')
    setDebateError('')
    setExperimentError('')
    setCalibrationNote('')
    setScene(0)
  }

  const isAiCollaborationWorkSample = LIVE_AI_ENABLED && experienceMode === 'full' && activeRun.currentEvent.id === 'b-day-30-brittle-prototype'
  const workSampleStep = workSample.evidence
    ? 3
    : workSample.aiDraft
      ? 3
      : workSample.priority
        ? 3
        : workSample.clarification.trim().length >= 8
          ? 2
          : 1

  const generateWorkSampleDraft = () => {
    if (!workSample.priority) return
    const draft = acceptanceDraft(workSample.priority)
    setWorkSample((current) => ({ ...current, aiDraft: draft, revisedDraft: draft, evidence: null, error: '' }))
  }

  const sealWorkSampleEvidence = () => {
    const clarification = workSample.clarification.trim()
    const artifact = workSample.revisedDraft.trim()
    if (clarification.length < 8) {
      setWorkSample((current) => ({ ...current, error: '先写下一句足够具体的澄清问题（至少 8 个字）。' }))
      return
    }
    if (!workSample.priority || !workSample.aiDraft) {
      setWorkSample((current) => ({ ...current, error: '先确定第一优先级，并让 AI 起草验收单。' }))
      return
    }
    if (artifact.length < 40 || artifact === workSample.aiDraft.trim()) {
      setWorkSample((current) => ({ ...current, error: '请亲手修改 AI 草稿。至少增加、删除或改写一条验收条件。' }))
      return
    }

    const diagnosticTerms = ['格式', '失败', '错误', '异常', '测试', '样本', '恢复']
    const boundaryTerms = ['本地', '隐私', '权限', '数据', '导出']
    const asksBoundary = boundaryTerms.some((term) => clarification.includes(term))
    const asksFailure = diagnosticTerms.some((term) => clarification.includes(term))
    const changedCharacters = Math.abs(artifact.length - workSample.aiDraft.trim().length)
      + [...artifact].filter((character, index) => character !== workSample.aiDraft[index]).length
    const observations = [
      `先澄清：“${clarification.slice(0, 48)}${clarification.length > 48 ? '…' : ''}”`,
      `明确把“${workSamplePriorityLabels[workSample.priority]}”放在第一位。`,
      `没有照抄 AI 初稿，主动改动约 ${Math.max(1, changedCharacters)} 个字符。`,
    ]
    if (asksBoundary) observations.push('澄清问题触及数据边界或权限。')
    if (asksFailure) observations.push('澄清问题触及失败样本或恢复条件。')

    const evidence: WorkSampleEvidence = {
      eventId: activeRun.currentEvent.id,
      title: '冲突需求验收单',
      clarification,
      priority: workSamplePriorityLabels[workSample.priority],
      artifact,
      observations,
      notObserved: ['尚未观察真实编码与排错结果。', '一次演练不能证明稳定能力或职业适配度。'],
      delta: {
        aiCollaboration: 3,
        confidence: 2,
        technicalSkill: asksFailure ? 2 : 0,
        energy: -1,
      },
      sourceEvidenceIds: activeRun.currentEvent.evidenceIds,
      completedAt: new Date().toISOString(),
    }
    setWorkSample((current) => ({ ...current, evidence, error: '' }))
  }

  const choosePath = (choiceId: string) => {
    if (actionInFlight.current || freeActionPending) return
    const selectedChoice = activeRun.currentEvent.choices.find((choice) => choice.id === choiceId)
    if (!selectedChoice) return
    if (activeRun.route || selectedChoice.generatedAction) {
      void submitFreeAction(undefined, selectedChoice.label)
      return
    }
    const nextRun = chooseUniversePath(activeRun, choiceId, isAiCollaborationWorkSample ? workSample.evidence ?? undefined : undefined)
    setFreeActionOpen(false)
    setFreeActionError(null)
    setUniverseRuns((current) => ({ ...current, [activeUniverse.code]: nextRun }))
    trackTelemetry('choice_made', { routeCode: activeUniverse.code, day: activeRun.currentEvent.day })
    setChoiceImpact({
      id: Date.now(),
      code: activeUniverse.code,
      choice: selectedChoice.label,
      nextTitle: nextRun.currentEvent.title,
      nextDay: nextRun.currentEvent.day,
      delta: selectedChoice.delta,
      quick: false,
      immediateCost: selectedChoice.tradeoff,
      tradeoff: selectedChoice.tradeoff,
      observableChange: `第 ${nextRun.currentEvent.day} 天出现“${nextRun.currentEvent.title}”`,
      causalChain: [selectedChoice.label, selectedChoice.tradeoff, `所以时间线转向“${nextRun.currentEvent.title}”`],
      sourceInfluence: '本次按预设剧情规则推演；状态数值是游戏参数，不是能力测评。',
    })
    if (experienceMode === 'quick' && nextRun.currentEvent.day === 180) setQuickArrival({ code: activeUniverse.code, choice: selectedChoice?.label ?? '这次选择' })
    if (isAiCollaborationWorkSample) setWorkSample(emptyWorkSampleDraft)
  }

  const submitFreeAction = async (event?: FormEvent<HTMLFormElement>, actionOverride?: string) => {
    event?.preventDefault()
    if (actionInFlight.current) return
    const enteredText = (actionOverride ?? freeAction).trim()
    const matchedChoice = activeRun.currentEvent.choices.find(choice => normalizedAction(choice.label) === normalizedAction(enteredText))
    if (!actionOverride && matchedChoice && !activeRun.route && !matchedChoice.generatedAction) {
      choosePath(matchedChoice.id)
      return
    }
    if (!liveAiActive) return
    const actionText = matchedChoice?.label ?? enteredText
    if (actionText.length < 6) {
      setFreeActionError({ message: '请写得再具体一点，例如：先找两位同学试用，再决定要不要继续做。', retryLabel: '提交这次行动' })
      return
    }
    if (freeActionPending || activeRun.currentEvent.day === 180) return
    updateActionDraft(actionText)
    if (isAiCollaborationWorkSample && !workSample.evidence) {
      setFreeActionError({ message: '先完成上面的三步工作样本，再让这次行动进入时间线。', retryLabel: '提交这次行动' })
      return
    }

    const submittedRun = activeRun
    const submittedCode = activeUniverse.code
    const submittedDraftKey = draftKey
    const submittedContext = currentActionContext
    actionInFlight.current = true
    setFreeActionPending(true)
    setFreeActionError(null)
    try {
      const { response, payload } = await fetchJsonWithDeadline<FreeActionApiResponse>('/api/simulation/free-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: actionText,
          allowThirdPartyFallback,
          mode: 'full',
          universeCode: submittedCode,
          profile: simulationProfile,
          route: submittedRun.route ? {title:submittedRun.route.title,premise:submittedRun.route.premise} : undefined,
          decisions: submittedRun.decisions,
          event: {
            id: submittedRun.currentEvent.id,
            day: submittedRun.currentEvent.day,
            title: submittedRun.currentEvent.title,
            story: submittedRun.currentEvent.story,
            tension: submittedRun.currentEvent.tension,
            choices: submittedRun.currentEvent.choices.map(({ id, label, tradeoff }) => ({ id, label, tradeoff })),
          },
          evidence: (liveEvidence?.items ?? []).slice(0, 3).map(({ id, title, excerpt, sourceUrl, author, votes, authorityLevel }) => ({
            id, title, excerpt, sourceUrl, author, votes, authorityLevel,
          })),
        }),
      }, AI_REQUEST_DEADLINE_MS)
      if (!response.ok || !payload?.action || !isGeneratedActionSource(payload.action.source)) {
        throw new FreeActionApiError(typeof payload?.error?.code === 'string' ? payload.error.code : undefined, response.status)
      }
      if (!acceptsNextAction(submittedRun, payload.action)) throw new FreeActionApiError('AI_INVALID_ACTION', 502)
      if (latestActionContext.current !== submittedContext) return
      const nextRun = chooseUniverseFreeAction(
        submittedRun,
        payload.action,
        false,
        isAiCollaborationWorkSample ? workSample.evidence ?? undefined : undefined,
      )
      // Commit the accepted timeline before deleting the retry draft.
      const saved = saveLocal(window.localStorage, simulationStorageKey(simulationProfile), { ...universeRuns, [submittedCode]: nextRun })
      setUniverseRuns((current) => current[submittedCode] === submittedRun ? ({ ...current, [submittedCode]: nextRun }) : current)
      if (saved) clearActionDraft(window.localStorage, submittedDraftKey)
      if (latestDraftKey.current !== submittedDraftKey) return
      trackTelemetry('choice_made', { routeCode: submittedCode, day: submittedRun.currentEvent.day })
      setChoiceImpact({
        id: Date.now(),
        code: submittedCode,
        choice: actionText,
        nextTitle: nextRun.currentEvent.title,
        nextDay: nextRun.currentEvent.day,
        delta: payload.action.delta,
        quick: false,
        tradeoff: payload.action.tradeoff,
        assumption: payload.action.assumption,
        immediateCost: payload.action.immediateCost,
        observableChange: payload.action.observableChange,
        causalChain: payload.action.causalChain,
        sourceInfluence: payload.action.sourceInfluence,
        source: payload.action.source,
        evidence: (liveEvidence?.items ?? []).filter((item) => payload.action?.evidenceRefs?.includes(item.id)).slice(0, 2),
      })
      if (experienceMode === 'quick' && nextRun.currentEvent.day === 180) setQuickArrival({ code: submittedCode, choice: actionText })
      if (isAiCollaborationWorkSample) setWorkSample(emptyWorkSampleDraft)
      setFreeAction('')
      setFreeActionOpen(false)
    } catch (error) {
      if (latestActionContext.current !== submittedContext || latestDraftKey.current !== submittedDraftKey) return
      setFreeActionError(freeActionFeedback(error))
      setFreeActionOpen(true)
    } finally {
      actionInFlight.current = false
      setFreeActionPending(false)
    }
  }

  const continueQuickJourney = () => {
    const nextCode = (['A', 'B', 'C'] as UniverseCode[]).find((code) => universeRuns[code].currentEvent.day !== 180)
    if (!nextCode) {
      trackTelemetry('journey_complete')
      setScene(3)
      return
    }
    setRouteEntered(false)
    setActiveUniverseIndex(careerUniverses.findIndex((universe) => universe.code === nextCode))
    setQuickArrival(null)
    setChoiceImpact(null)
    document.querySelector('.wz-view.wz-universes')?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const replayCurrentJourney = () => {
    if (actionInFlight.current) return
    clearActionDraft(window.localStorage, draftKey)
    const code = activeUniverse.code
    const current = universeRuns[code]
    const fresh = current.route
      ? createGeneratedUniverseRuns(simulationProfile, [current.route], isGeneratedActionSource(current.currentEvent.generationSource) ? current.currentEvent.generationSource : undefined)[code]
      : createUniverseRuns(simulationProfile)[code]
    setUniverseRuns((runs) => ({ ...runs, [code]: fresh }))
    setRouteEntered(false)
    setQuickArrival(null)
    setChoiceImpact(null)
    setFreeAction('')
    setFreeActionOpen(false)
    setWorkSample(emptyWorkSampleDraft)
    document.querySelector('.wz-view.wz-universes')?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const retryLiveEvidence = () => {
    const cacheKey = liveEvidenceStorageKey(simulationProfile, evidenceContextId)
    window.localStorage.removeItem(cacheKey)
    liveEvidenceRequestedRef.current.delete(cacheKey)
    setLiveEvidence(null)
    setLiveEvidenceError('')
    setLiveEvidenceRetry((value) => value + 1)
  }

  const universeMemory = (code: UniverseCode) => {
    const run = universeRuns[code]
    const universe = careerUniverses.find((item) => item.code === code) ?? careerUniverses[0]
    const state = run.state
    return [
      `现在的我：${situationLabels.identity[simulationProfile.identity]}，目标是${situationLabels.intent[simulationProfile.intent]}，可投入${situationLabels.time[simulationProfile.time]}。`,
      `现实困惑：${simulationProfile.confusion || '没有补充'}。已有技能：${simulationProfile.skills || '没有补充'}。`,
      `180天目标：${simulationProfile.goal || '没有补充'}。不可牺牲：${situationLabels.sacrifice[simulationProfile.sacrifice]}。补充担忧：${simulationProfile.worries || '没有补充'}。`,
      `路线：${universe.title}。`,
      `三次选择：${run.decisions.map((decision) => `第${decision.day}天“${decision.choiceLabel}”`).join('；')}。`,
      freeActionMemory(run),
      (run.workSamples ?? []).map((sample) => `真实工作样本“${sample.title}”：先问“${sample.clarification}”，优先守住“${sample.priority}”；可观察行为为${sample.observations.join('、')}。产物摘录：${sample.artifact.slice(0, 260)}。边界：${sample.notObserved.join('、')}`).join(''),
      `180天状态：技术${state.technicalSkill}，AI协作${state.aiCollaboration}，专业深度${state.domainDepth}，作品${state.portfolio}，机会${state.opportunity}，精力${state.energy}。`,
      `结局：${run.currentEvent.title}。${run.currentEvent.story}`,
      `已经关闭的短期机会：${run.closedOpportunities.join('、') || '无明确记录'}。`,
    // Keep each section represented within the chat API's 2400-character limit.
    ].map((section, index) => section.slice(0, [140, 160, 160, 60, 240, 800, 240, 160, 240, 120][index])).join('')
  }

  const universeDebateMemory = (code: UniverseCode) => {
    const run = universeRuns[code]
    const universe = careerUniverses.find((item) => item.code === code) ?? careerUniverses[0]
    const state = run.state
    const causalMarks = run.decisions
      .filter((decision) => decision.causalChain)
      .map((decision) => decision.causalChain?.join('→'))
      .join('；')
    return [
      `路线：${universe.title}。`,
      `亲手作出的选择：${run.decisions.map((decision) => `第${decision.day}天“${decision.choiceLabel}”`).join('；')}。`,
      causalMarks ? `自由行动留下的因果：${causalMarks}。` : '',
      `第180天状态：技术${state.technicalSkill}，AI协作${state.aiCollaboration}，专业${state.domainDepth}，作品${state.portfolio}，机会${state.opportunity}，精力${state.energy}。`,
      `结局：${run.currentEvent.title}。${run.currentEvent.story}`,
      `关闭的机会：${run.closedOpportunities.join('、') || '无明确记录'}。`,
    ].filter(Boolean).join('').slice(0, 1200)
  }

  const askFutureSelf = async (suggestedQuestion?: string) => {
    const question = (suggestedQuestion ?? futureQuestion).trim()
    if (!question || futurePending || activeRun.currentEvent.day !== 180 || futureQuestionCount >= 6) return
    const code = activeUniverse.code
    const userMessage: FutureChatMessage = { role: 'user', content: question }
    const priorHistory = futureChats[code].slice(-8)
    setFutureChats((current) => ({ ...current, [code]: [...current[code], userMessage] }))
    setFutureQuestion('')
    setFutureError('')
    setFuturePending(true)
    setFuturePendingCode(code)
    setFuturePendingStage(0)

    if (!liveAiActive) {
      setFutureChats(current => ({ ...current, [code]: [...current[code], { role: 'assistant', source: 'demo', content: `【示例回信】${activeRun.currentEvent.story}\n\n你可以翻看这条路上的选择，再挑一个最想验证的做法，带回现实试一试。` }] }))
      setFutureError('示例回信 · 基于本条路线结尾整理，未调用实时 AI。')
      setFuturePending(false)
      setFuturePendingCode(null)
      return
    }
    const memory = universeMemory(code)

    try {
      const { response, payload } = await fetchJsonWithDeadline<FutureChatApiResponse>('/api/future-self/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          universeCode: code,
          route: activeRun.route ? { title: activeRun.route.title, premise: activeRun.route.premise } : undefined,
          question,
          memory,
          history: priorHistory,
          coreQuestion,
          profileContext: {
            goal: simulationProfile.goal,
            worries: simulationProfile.worries,
          },
        }),
      }, AI_REQUEST_DEADLINE_MS)
      if (!response.ok || !payload.message) throw new Error(payload.error?.message || '未来自己暂时没有回应。')
      const reply: FutureChatMessage = { ...payload.message, source: payload.source }
      setFutureChats((current) => ({ ...current, [code]: [...current[code], reply] }))
    } catch (error) {
      setFutureError(error instanceof Error ? error.message : '未来自己暂时没有回应。')
    } finally {
      setFuturePending(false)
      setFuturePendingCode(null)
    }
  }

  const startDebate = async () => {
    const question = debateQuestion.trim()
    if (!allUniversesComplete || !question || debatePending) return
    setDebatePending(true)
    setDebateError('')
    // Optional comparison must not discard an already collected action ticket
    // or its real-world check-ins.
    try {
      if (!liveAiActive) throw new Error('sample-mode')
      const { response, payload } = await fetchJsonWithDeadline<ReflectionApiResponse>('/api/future-self/debate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          universes: (['A', 'B', 'C'] as UniverseCode[]).map((code) => ({ code, memory: universeDebateMemory(code), route: universeRuns[code].route ? { title: universeRuns[code].route!.title, premise: universeRuns[code].route!.premise } : undefined })),
        }),
      }, AI_REQUEST_DEADLINE_MS)
      if (!response.ok || !payload.debate) throw new Error(payload.error?.message || '三位未来自己暂时无法开始辩论。')
      setDebate(payload.debate)
      cacheDebate(payload.debate)
    } catch {
      // The legacy cache is shared across profiles; do not replay it as a
      // fallback for a newly personalized set of routes.
      const cached = liveAiActive && !generatedRoutesReady ? readCachedDebate() : null
      if (cached) {
        setDebate(cached)
        setDebateError('在线生成暂时没响应，下面先展示上次保存的演示对话。')
        return
      }
      const titles = Object.fromEntries((['A', 'B', 'C'] as UniverseCode[]).map((code) => [code, universeRuns[code].currentEvent.title])) as Record<UniverseCode, string>
      setDebate({
        mode: 'memory-fallback',
        lines: generatedRoutesReady ? [
          { speaker: 'A', challenges: null, memoryRef: titles.A, text: `我的时间线留下“${titles.A}”。我想先把已经发生的事，与还没验证的期待分开。` },
          { speaker: 'B', challenges: 'A', memoryRef: titles.B, text: `我这里留下“${titles.B}”。A，你还愿意为这条路投入什么，又希望保留什么？` },
          { speaker: 'C', challenges: 'B', memoryRef: titles.C, text: `我的记录是“${titles.C}”。B，你的哪项收获已经有依据，哪项还只是设想？` },
          { speaker: 'A', challenges: 'C', memoryRef: titles.A, text: `回到“${titles.A}”，还有些问题没解决。C，你会用什么现实反馈判断要不要继续？` },
          { speaker: 'B', challenges: 'A', memoryRef: titles.B, text: `“${titles.B}”只是一次模拟。A，如果只试七天，你会先验证哪一件事？` },
          { speaker: 'C', challenges: 'B', memoryRef: titles.C, text: `我会带着“${titles.C}”回看目标。B，你愿意为下一次尝试付出怎样的代价？` },
        ] : [
          { speaker: 'A', challenges: null, memoryRef: titles.A, text: `我的时间线留下“${titles.A}”。代码比以前看得懂了，可一直在学，拿给别人看的东西太少。` },
          { speaker: 'B', challenges: 'A', memoryRef: titles.B, text: `我的时间线留下“${titles.B}”。A，你还打算准备多久？学到哪一步，才肯拿出来给人看？` },
          { speaker: 'C', challenges: 'B', memoryRef: titles.C, text: `我的时间线留下“${titles.C}”。B，做得快我承认。可结果错了，你看得出来吗？` },
          { speaker: 'A', challenges: 'B', memoryRef: titles.A, text: '我也羡慕做得快。可一报错就没办法，那种着急我受够了。' },
          { speaker: 'B', challenges: 'C', memoryRef: titles.B, text: 'C，你总说专业判断重要。那就挑一个具体结果，告诉我哪里不对，别只说感觉。' },
          { speaker: 'C', challenges: 'A', memoryRef: titles.C, text: '我可以拿案例把判断讲清楚。A，我就想问，你真的有时间把每件事都从头学会吗？' },
        ],
        conflictCore: generatedRoutesReady ? '三条路留下了不同记录：哪些值得继续投入，哪些代价需要先验证？' : '时间不够：想自己弄懂，想早点做完，也舍不得放下本专业。',
        commonGround: '三条路都需要真实反馈，也都不能把一次模拟当成职业预测。',
        experimentSeed: { action: '选一个真实小任务，用两种路线各做30分钟并记录卡点', successSignal: '能明确说出哪条路线减少了卡点，又新增了什么代价' },
        closingQuestion: `回到“${question}”：你愿意先花一周试哪种做法？`,
      })
      setDebateError(liveAiActive ? '在线生成暂时没响应，下面的对话由本地模板结合本轮三条路线整理。' : '示例对话 · 结合本轮结局展示，未调用实时 AI。')
    } finally {
      setDebatePending(false)
    }
  }

  const generateExperiment = async () => {
    if (!debate || experimentPending) return
    trackTelemetry('experiment_cta')
    setExperimentPending(true)
    setExperimentError('')
    const context = [
      `用户现实坐标：${situationLabel}。`,
      `用户辩论问题：${debateQuestion}。`,
      ...(['A', 'B', 'C'] as UniverseCode[]).map((code) => `宇宙${code}：${universeMemory(code)}`),
      `辩论：${debate.lines.map((line) => `${line.speaker}说“${line.text}”`).join('；')}。`,
      `留给用户的问题：${debate.closingQuestion}。`,
    ].join('')
    try {
      if (!liveAiActive) throw new Error('sample-mode')
      const { response, payload } = await fetchJsonWithDeadline<ReflectionApiResponse>('/api/reality-experiment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context }),
      }, AI_REQUEST_DEADLINE_MS)
      if (!response.ok || !payload.experiment) throw new Error(payload.error?.message || '7天实验暂时无法生成。')
      setExperiment(payload.experiment)
      setExperimentProgress(emptyExperimentProgress())
      setCalibrationNote('')
      trackTelemetry('experiment_generated')
    } catch {
      setExperiment(createFallbackExperiment(debate))
      setExperimentProgress(emptyExperimentProgress())
      setExperimentError(liveAiActive ? '在线生成暂时没响应，已根据这场讨论安排一份本地七天计划。' : '示例七天计划 · 可以记录执行结果，再进入下一轮。')
      trackTelemetry('experiment_generated')
    } finally {
      setExperimentPending(false)
    }
  }

  const takeFirstExperiment = (run: UniverseRun | null = firstCompletedRun) => {
    if (!run || experimentPending) return
    if (!experiment) {
      const plan = firstRouteExperiment(run, simulationProfile)
      if (!plan) return
      setExperiment(plan)
      setExperimentProgress(emptyExperimentProgress())
      setExperimentError('')
      trackTelemetry('experiment_generated')
    }
    setScene(3)
    setChoiceImpact(null)
    setQuickArrival(null)
  }

  const copyExperimentTicket = async () => {
    if (!experiment) return
    const ticket = [
      '问枝｜7 天现实实验票',
      `验证：${experiment.hypothesis}`,
      ...experiment.dailyTasks.map((task) => `DAY ${task.day} · ${task.task}（${task.minutes} 分钟）`),
      `成功信号：${experiment.successSignal}`,
      `停止规则：${experiment.stopRule}`,
      `第 7 天回答：${experiment.feedbackQuestion}`,
    ].join('\n')
    try {
      await navigator.clipboard.writeText(ticket)
      setExperimentCopied(true)
      window.setTimeout(() => setExperimentCopied(false), 2200)
    } catch {
      setExperimentError('浏览器没有允许复制，请手动选中实验内容。')
    }
  }

  const setExperimentDayStatus = (day: number, status: ExperimentDayStatus) => {
    if (experimentProgress.calibration) return
    setExperimentProgress((current) => ({
      ...current,
      checkins: { ...current.checkins, [day]: current.checkins[day] === status ? undefined : status },
    }))
  }

  const completedExperimentDays = Object.values(experimentProgress.checkins).filter(Boolean).length
  const doneExperimentDays = Object.values(experimentProgress.checkins).filter((status) => status === 'done').length
  const allExperimentDaysRecorded = completedExperimentDays === 7
  const evidenceReview = experimentEvidence(experimentProgress)
  const experimentReadyToCalibrate = evidenceReview.ready

  const buildLocalCalibration = (): RecalibrationRecord => {
    const result = experimentProgress.result
    const completionRate = Math.round((doneExperimentDays / 7) * 100)
    const fallbackRecommendation: UniverseCode = simulationProfile.time === 'low'
      ? 'B'
      : simulationProfile.intent === 'literacy'
        ? 'C'
        : 'A'
    const recommendedUniverse: UniverseCode = result === 'strong' && experimentProgress.signalObserved
      ? activeUniverse.code
      : result === 'mixed'
        ? 'B'
        : fallbackRecommendation
    const evidenceStrength = Math.round(doneExperimentDays * 1.4) + (experimentProgress.signalObserved ? 4 : -2)
    const resultAdjustment = result === 'strong' ? 5 : result === 'weak' ? -2 : 2
    const energyAdjustment = completedExperimentDays - doneExperimentDays >= 3 ? 5 : -2
    const routeDeltas: Record<UniverseCode, StateDelta> = {
      A: { technicalSkill: evidenceStrength + resultAdjustment, confidence: resultAdjustment, energy: energyAdjustment },
      B: { aiCollaboration: evidenceStrength + resultAdjustment, portfolio: Math.max(0, doneExperimentDays), confidence: resultAdjustment, energy: energyAdjustment },
      C: { domainDepth: Math.max(1, Math.round(evidenceStrength * .8)), confidence: experimentProgress.signalObserved ? 3 : 0, energy: Math.max(0, energyAdjustment) },
    }
    routeDeltas[recommendedUniverse] = {
      ...routeDeltas[recommendedUniverse],
      opportunity: 7,
      confidence: Number(routeDeltas[recommendedUniverse].confidence ?? 0) + 4,
    }
    const summary = result === 'strong' && experimentProgress.signalObserved
      ? `根据你填写的观察和信号确认，完成了 ${doneExperimentDays}/7 天；这仍是自述，不能证明路线有效。下一轮会提高宇宙 ${recommendedUniverse} 的初始信心与机会，但仍保留另外两条路线。`
      : result === 'weak'
        ? `这次实验没有形成足够强的正向证据。下一轮不会把“没做成”解释为能力不足，而会降低试错成本，优先比较宇宙 ${recommendedUniverse}。`
        : `结果同时包含收益与代价。下一轮以宇宙 ${recommendedUniverse} 作为低成本中间假设，再与两端路线比较。`
    const calibration: RecalibrationRecord = {
      id: `calibration-${Date.now()}`,
      cycleFrom: simulationCycle,
      recommendedUniverse,
      completionRate,
      summary,
      routeDeltas,
      createdAt: new Date().toISOString(),
      source: 'local-rule',
    }
    return calibration
  }

  const calibrateFromExperiment = async () => {
    if (!experimentReadyToCalibrate || experimentProgress.calibration || calibrationPending) return
    const fallback = buildLocalCalibration()
    setCalibrationPending(true)
    setCalibrationNote('')
    let calibration = fallback
    try {
      if (!liveAiActive) throw new Error('sample-mode')
      const { response, payload } = await fetchJsonWithDeadline<RecalibrationApiResponse>('/api/simulation/recalibrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identity: simulationProfile.identity,
          intent: simulationProfile.intent,
          time: simulationProfile.time,
          sacrifice: simulationProfile.sacrifice,
          activeUniverse: activeUniverse.code,
          cycle: simulationCycle,
          doneDays: doneExperimentDays,
          result: experimentProgress.result,
          signalObserved: experimentProgress.signalObserved,
          routes: Object.values(universeRuns).flatMap(run => run.route ? [{ code: run.code, title: run.route.title, premise: run.route.premise }] : []),
          finalStates: (['A', 'B', 'C'] as UniverseCode[]).map((code) => {
            const state = universeRuns[code].state
            return {
              code,
              technicalSkill: state.technicalSkill,
              aiCollaboration: state.aiCollaboration,
              domainDepth: state.domainDepth,
              portfolio: state.portfolio,
              opportunity: state.opportunity,
              confidence: state.confidence,
              energy: state.energy,
            }
          }),
        }),
      }, AI_REQUEST_DEADLINE_MS)
      const ai = payload.calibration
      if (!response.ok || !ai || !['A', 'B', 'C'].includes(ai.recommendedUniverse) || !ai.routeDeltas?.A || !ai.routeDeltas?.B || !ai.routeDeltas?.C) {
        throw new Error(payload.error?.message || 'AI校正暂时不可用。')
      }
      calibration = {
        ...fallback,
        recommendedUniverse: ai.recommendedUniverse,
        summary: ai.summary,
        routeDeltas: ai.routeDeltas,
        source: ai.source ?? payload.source,
      }
      setCalibrationNote(`${isGeneratedActionSource(calibration.source) ? actionSourceLabel(calibration.source) : 'AI'}已根据结构化实验信号校正下一轮；你的自由文本回答没有上传。`)
    } catch {
      setCalibrationNote(liveAiActive ? 'AI校正暂时不可用，已使用本地受限规则完成校正；自由文本回答仍只保存在本机。' : '示例模式：已按本地规则校正下一轮，没有调用 AI。')
    } finally {
      setCalibrationPending(false)
    }
    setExperimentProgress((current) => ({ ...current, calibration }))
    setCalibrationHistory((current) => [...current, calibration])
  }

  const launchRecalibratedCycle = () => {
    const calibration = experimentProgress.calibration
    if (!calibration) return
    const routeSources = Object.fromEntries(Object.values(universeRuns).map(run => [
      run.code, isGeneratedActionSource(run.currentEvent.generationSource) ? run.currentEvent.generationSource : undefined,
    ]))
    setUniverseRuns(createRecalibratedUniverseRuns(simulationProfile, calibration.routeDeltas, {}, generatedRoutesReady ? Object.values(universeRuns).map(run => run.route!) : undefined, routeSources))
    setFutureChats({ A: [], B: [], C: [] })
    setDebate(null)
    setExperiment(null)
    setExperimentProgress(emptyExperimentProgress())
    setSimulationCycle((value) => value + 1)
    setActiveUniverseIndex(Math.max(0, careerUniverses.findIndex((item) => item.code === calibration.recommendedUniverse)))
    setSimulationGenerationNote(`第 ${simulationCycle + 1} 轮已根据7天现实证据校正起点；三条路线仍然同时保留。`)
    setScene(2)
  }

  return (
    <main className={`wz-home paper-experience wz-scene-${scene} ${isUniverseOpen ? `is-universe-open universe-${activeUniverse.code.toLowerCase()}` : ''} ${reading.isGap ? 'is-gap' : 'has-answers'}`} ref={homeRef}>
      {echoContext && <RealityEchoLetter context={echoContext} onClose={() => setEchoContext(null)} onAdjust={scene === 2 && activeRun.currentEvent.day < 180 ? () => {
        setEchoContext(null)
        setFreeActionOpen(true)
        window.setTimeout(() => {
          const target = homeRef.current?.querySelector<HTMLElement>('.wz-free-action textarea, .wz-free-action button')
          target?.scrollIntoView({ block: 'center', behavior: 'smooth' })
          target?.focus({ preventScroll: true })
        }, 100)
      } : undefined} />}
      <div className="wz-app">
        <header className="wz-topbar">
          <button className="logo-button" type="button" onClick={() => { setSituation(defaultSituation); setScene(0); homeRef.current?.querySelector<HTMLElement>('.wz-view.wz-hero')?.scrollTo({ top: 0, left: 0, behavior: 'auto' }) }}>
            <Logo compact />
          </button>
          <div className="wz-source-chip"><span />知乎公开回答 · 原文可追溯</div>
          <ZhihuConnection />
          <button className="wz-method" type="button" onClick={onOpenMethod}>
            <FileSearch size={20} />关于问枝
          </button>
        </header>

        <div className="wz-progress" aria-label="当前探索进度">
          <span style={{ width: `${((scene + 1) / sceneLabels.length) * 100}%` }} />
        </div>

        {judgeDemoActive && (
          <nav className="wz-judge-demo" aria-label="三分钟试玩导航">
            <div><Play size={13} weight="fill" /><span>3 分钟试玩</span><small>试三种选择，看看各自要付什么代价</small></div>
            <button type="button" className={demoBeat === 0 ? 'active' : ''} onClick={() => setScene(2)}><b>00:00</b>做一次选择</button>
            <button type="button" className={demoBeat === 1 ? 'active' : ''} onClick={() => setScene(2)}><b>00:45</b>看三个结局</button>
            <button type="button" className={demoBeat === 2 ? 'active' : ''} onClick={() => setScene(3)}><b>01:45</b>听他们争一争</button>
            <button type="button" className={demoBeat === 3 ? 'active' : ''} onClick={() => setScene(3)}><b>02:35</b>带走7天实验</button>
            <button type="button" className="wz-judge-exit" disabled={freeActionPending || futurePending || debatePending || experimentPending || calibrationPending || simulationGenerating} onClick={stopJudgeDemo}>退出试玩，回到我的问题 <X size={12} /></button>
          </nav>
        )}

        <div className="wz-deck">
          <section className="wz-view wz-hero" data-view="0" aria-hidden={scene !== 0} inert={scene !== 0}>
            <PaperLanding onStart={() => {setProfileStep(0); setScene(1)}} onDemo={startJudgeDemo} />
          </section>

          <section className="wz-view wz-locate" data-view="1" aria-hidden={scene !== 1} inert={scene !== 1}>
            <div className="paper-profile wz-reveal">
              <PaperAccent kind="departure-map" placement="profile" />
              <button className="paper-back" onClick={() => profileStep ? setProfileStep(0) : setScene(0)}><ArrowLeft size={20} />{profileStep ? '回到我的问题' : '回到启程'}</button>
              <span className="paper-eyebrow">出发之前 · {profileStep + 1} / 2</span>
              <h2>{profileStep === 0 ? <>有件事，<br />你一直拿不定主意。</> : <>想试新路，<br />也有舍不得的东西。</>}</h2>
              {profileStep === 0 ? <>
                <label className="paper-field">此刻，你在犹豫什么？<textarea aria-label="写下你此刻真正卡住的问题" value={situation.confusion} onChange={event => setSituation(current => ({...current, confusion: event.target.value}))} maxLength={240} rows={2} placeholder="例如：继续本专业，还是试试 AI？" /></label>
                <label className="paper-field">半年后，你希望做成什么？<input aria-label="180 天后的目标" value={situation.goal} onChange={event => setSituation(current => ({...current, goal: event.target.value}))} maxLength={200} placeholder="例如：一个能展示的小作品" /></label>
                <div className="paper-profile-footer"><p>{profileReady ? '就从这件让你犹豫的事开始。' : '问题和目标各写至少 4 个字。'}</p><button className="paper-primary" disabled={!profileReady} onClick={() => {setProfileStep(1); document.querySelector('.wz-locate')?.scrollTo({top:0})}}>继续 <ArrowRight size={22}/></button></div>
              </> : <>
                {situationGroups.map(group => <fieldset className="paper-options" key={group.key}><legend>{group.prefix}</legend><div>{group.options.map(option => <button key={option.value} aria-pressed={situation[group.key] === option.value} onClick={() => updateSituation(group.key,option.value)}>{option.label}{situation[group.key] === option.value && <Check size={18}/>}</button>)}</div></fieldset>)}
                <fieldset className="paper-options"><legend>{sacrificePrompt[situation.intent]}</legend><div>{(Object.entries(situationLabels.sacrifice) as Array<[Situation['sacrifice'], string]>).map(([value,label]) => <button key={value} aria-pressed={situation.sacrifice === value} onClick={() => setSituation(current=>({...current,sacrifice:value}))}>{label}{situation.sacrifice === value && <Check size={18}/>}</button>)}</div></fieldset>
                <details className="paper-disclosure"><summary>调整体验长度与补充背景（可选）</summary>
                  <fieldset className="paper-options"><legend>你想走多远？</legend><div><button aria-pressed={experienceMode === 'quick'} onClick={()=>setExperienceMode('quick')}>轻量试玩 · 逐幕选择</button><button aria-pressed={experienceMode === 'full'} onClick={()=>setExperienceMode('full')}>完整推演 · 每条路选三次</button></div></fieldset>
                  <label className="paper-field">已经拥有的技能<input value={situation.skills} onChange={event=>setSituation(current=>({...current,skills:event.target.value}))} maxLength={160}/></label>
                  <label className="paper-field">担心付出的代价<input value={situation.worries} onChange={event=>setSituation(current=>({...current,worries:event.target.value}))} maxLength={200}/></label>
                </details>
                <div className="paper-profile-footer"><p>先做三次选择，走完一条路，就能带走七天行动票。</p><button className="paper-primary" disabled={!profileReady || simulationGenerating} onClick={beginSimulation}><span>{simulationGenerating ? '正在准备…' : '选好了，开始吧'}</span><ArrowRight size={20} aria-hidden="true"/></button></div>
              </>}
              <p className="paper-privacy">{!liveAiActive ? '演示模式使用本地示例剧情，不调用实时 AI。' : experienceMode === 'full' ? '你的问题、目标、处境与后续选择会发送给已配置的 AI，用于生成路线和剧情。' : '轻量试玩使用预设剧情；自定义行动和未来对话会调用已配置的 AI。'}</p>
            </div>
          </section>

          <section className={`wz-view wz-universes story-journey ${routeEntered ? 'has-entered' : 'at-doors'}`} data-view="2" aria-hidden={scene !== 2} inert={scene !== 2}>
            <header className="wz-section-head wz-reveal">
              <div><span>03 / SIX MONTHS LATER · ROUND {simulationCycle}</span><h2>向前拨动 180 天</h2></div>
              <p>{simulationStatusNote}</p>
            </header>

            {!routeEntered && LIVE_AI_ENABLED && experienceMode === 'full' && !generatedRoutesReady && <div className="route-generation" role="status"><PaperAccent kind="unfolding-paths" placement="waiting" waiting={simulationGenerating} /><h2>{simulationGenerating ? '正在展开你的三条路' : '这次还没写完'}</h2><p>{simulationGenerationNote}</p>{!simulationGenerating && <button className="paper-primary" onClick={beginSimulation}>重新生成三条路径</button>}</div>}
            {!routeEntered && (!LIVE_AI_ENABLED || experienceMode === 'quick' || generatedRoutesReady) && <UniverseDoors routes={careerUniverses} complete={careerUniverses.filter(item => universeRuns[item.code].currentEvent.day === 180).map(item => item.code)} onEnter={index => {
              setActiveUniverseIndex(index); setChoiceImpact(null); setRouteEntered(true)
              trackTelemetry('route_enter', { routeCode: careerUniverses[index]?.code })
              document.querySelector('.wz-view.wz-universes')?.scrollTo({ top: 0 })
            }} />}
            {routeEntered && scene === 2 && <JourneyWayfinding
              routes={careerUniverses} activeIndex={activeUniverseIndex}
              activeDay={activeRun.currentEvent.day} stages={journeyStages} labels={journeyStageLabels}
              complete={careerUniverses.filter(item => universeRuns[item.code].currentEvent.day === 180).map(item => item.code)}
              onSelect={index => {
                setActiveUniverseIndex(index); setChoiceImpact(null)
                document.querySelector('.wz-view.wz-universes')?.scrollTo({ top: 0 })
              }}
            />}

            <article role="tabpanel" id={`universe-panel-${activeUniverse.code}`} aria-labelledby={`universe-tab-${activeUniverse.code}`} tabIndex={0} className={`wz-universe-card tone-${activeUniverse.tone} wz-reveal ${choiceImpact?.code === activeUniverse.code ? 'has-choice-impact' : ''}`}>
              {routeEntered && scene === 2 && forkEligible && <ForkComparison key={forkKey} run={activeRun} profile={simulationProfile} cycle={simulationCycle}
                demo={judgeDemoActive} demoRecords={demoForkRecords.current} live={liveAiActive} context={currentEchoContext} evidence={liveEvidence?.items ?? []}
                sourceLoading={liveEvidenceLoading} sourceError={liveEvidenceError} allowFallback={allowThirdPartyFallback} onBusy={setFreeActionPending}
                onRetrySource={retryLiveEvidence} onCustom={() => { setForkBypass(forkKey); setFreeActionOpen(true) }}
                onCommit={next => {
                  if (!judgeDemoActive) saveLocal(window.localStorage, simulationStorageKey(simulationProfile), { ...universeRuns, [activeUniverse.code]: next })
                  setUniverseRuns(current => current[activeUniverse.code] === activeRun ? { ...current, [activeUniverse.code]: next } : current)
                  setChoiceImpact(null); setFreeActionOpen(false); setFreeActionError(null)
                  trackTelemetry('choice_made', { routeCode: activeUniverse.code, day: activeRun.currentEvent.day })
                }} />}
              {routeEntered && scene === 2 && !forkEligible && activeRun.currentEvent.day !== 180 && <StoryEventCard code={activeUniverse.code} day={activeRun.currentEvent.day} previousResult={previousResult} tension={activeRun.currentEvent.tension} story={activeRun.currentEvent.story} title={activeRun.currentEvent.title} choices={activeRun.currentEvent.choices} disabled={freeActionPending || (isAiCollaborationWorkSample && !workSample.evidence)} needsWork={isAiCollaborationWorkSample && !workSample.evidence} onChoose={choosePath} customAction={activeRun.currentEvent.choices.length > 0 && (
                  <section className={`wz-free-action ${freeActionOpen ? 'is-open' : ''} ${freeActionPending ? 'is-writing' : ''}`}>
                    <button
                      className="wz-free-action-toggle"
                      type="button"
                      disabled={freeActionPending}
                      aria-expanded={freeActionOpen}
                      onClick={() => {
                        setFreeActionOpen((current) => !current)
                        setFreeActionError(null)
                      }}
                    >
                      <span>我有别的做法</span>
                      <ArrowRight size={22} aria-hidden="true" />
                    </button>
                    {freeActionPending && <p className="story-writing-status" role="status">正在根据这次选择续写故事，请稍候…</p>}
                    {freeActionOpen && !liveAiActive && <p role="status">示例模式暂不续写自定义行动，请选择上方两种做法继续故事。</p>}
                    {freeActionOpen && liveAiActive && (
                      <form onSubmit={submitFreeAction}>
                        <label htmlFor={`free-action-${activeUniverse.code}`}>换作我，我会这样做：</label>
                        <textarea
                          id={`free-action-${activeUniverse.code}`}
                          value={freeAction}
                          maxLength={240}
                          disabled={freeActionPending}
                          aria-describedby={freeActionError ? `free-action-error-${activeUniverse.code}` : undefined}
                          placeholder="例如：先找两位同学试用一周，记录他们卡住的位置，再决定补基础还是继续迭代。"
                          onChange={(inputEvent) => {
                            updateActionDraft(inputEvent.target.value)
                            if (freeActionError) setFreeActionError(null)
                          }}
                        />
                        <label className="wz-backup-consent">
                          <input type="checkbox" checked={allowThirdPartyFallback} disabled={freeActionPending} onChange={event => setAllowThirdPartyFallback(event.target.checked)} />
                          <span>允许主模型不可用时，将本次处境、行动和本路线剧情发送至 Yeako 备用 AI。请勿填写隐私信息。</span>
                        </label>
                        <footer>
                          <small role={freeActionPending ? 'status' : undefined}>{freeActionPending
                            ? '正在续写并校验；必要时修复一次。通过后才推进剧情，失败保留这一笔。'
                            : `${freeAction.length} / 240 · ${draftSaved ? '草稿保存在本机，刷新后可继续' : '浏览器未能保存草稿，请先复制文字'}；成功后才推进剧情`}</small>
                          <button type="submit" disabled={freeActionPending || freeAction.trim().length < 6 || (isAiCollaborationWorkSample && !workSample.evidence)}>
                            {freeActionPending
                              ? '正在等待 AI 续写…'
                              : freeActionError ? freeActionError.retryLabel : '就按我写的往下走'}
                            {freeActionPending ? <CircleDashed size={15} /> : <Send size={15} weight="fill" />}
                          </button>
                        </footer>
                        {freeActionError && !freeActionPending && <button type="button" onClick={() => homeRef.current?.querySelector<HTMLTextAreaElement>('.wz-free-action textarea')?.focus()}>修改行动</button>}
                        {freeActionError && <p id={`free-action-error-${activeUniverse.code}`} role="alert">{freeActionError.message}</p>}
                      </form>
                    )}
                  </section>
                )} />}
              {routeEntered && scene === 2 && activeRun.currentEvent.day === 180 && <JourneyEnding run={activeRun} onContinue={() => takeFirstExperiment(activeRun)} onReplay={replayCurrentJourney} continueLabel="带走 7 天实验"/>}
              <div className={`wz-universe-story ${activeRun.currentEvent.day === 180 ? 'is-ended' : ''}`} id={`universe-story-${activeUniverse.code}`}>

                {activeRun.currentEvent.day !== 180 && <h3 className="story-analysis-title">这条路，留下了什么</h3>}
                {activeRun.currentEvent.generatedFrom && <small className="wz-generated-scene">AI 续写 · 不是未来预测</small>}
                <div className="story-detail-stack">
                {activeRun.currentEvent.choices.length > 0 && <details className="paper-disclosure wz-choice-compare"><summary><span className="wz-compare-summary-mark" aria-hidden="true"><i /><i /><i /></span><span><b>看看两种选择的取舍</b><small>把这一幕拆成两张行动票，再决定先拿哪一张</small></span><ArrowDown size={18} aria-hidden="true" /></summary><div className="wz-choice-compare-grid">{activeRun.currentEvent.choices.map((choice, index) => <article className={`wz-choice-compare-card choice-${index + 1}`} key={choice.id}><span className="wz-choice-compare-number">0{index + 1}</span><div><small>行动票 {index + 1}</small><b>{choice.label}</b><p>{choice.tradeoff}</p></div><ArrowRight size={19} aria-hidden="true" /></article>)}</div></details>}
                <PathHistory key={`${activeUniverse.code}-${activeRun.currentEvent.id}`} run={activeRun} initial={activeUniverse.choice}/>
                </div>
                {activeRun.currentEvent.day !== 180 && <StateRadar run={activeRun}/>}
                {isAiCollaborationWorkSample && (
                  <section className={`wz-work-sample step-${workSampleStep} ${workSample.evidence ? 'is-complete' : ''}`} aria-labelledby="work-sample-title">
                    <header>
                      <div><small>PAPER WORKSHOP / 三步小关卡</small><h4 id="work-sample-title">今晚，只能守住一个需求</h4></div>
                      <span>{workSample.evidence ? <><Check size={13} weight="bold" /> 行动票已封存</> : `${workSampleStep} / 3`}</span>
                    </header>

                    <div className="wz-work-progress" aria-label={`当前进行到第 ${workSampleStep} 步`}>
                      {['问清楚', '做取舍', '改一刀'].map((label, index) => {
                        const step = index + 1
                        return <div className={step < workSampleStep || workSample.evidence ? 'done' : step === workSampleStep ? 'active' : ''} key={label}><i>{step < workSampleStep || workSample.evidence ? <Check size={12} weight="bold" /> : `0${step}`}</i><b>{label}</b></div>
                      })}
                    </div>

                    <div className="wz-work-brief" aria-label="两条互相冲突的需求">
                      <article><b>演示组的纸条</b><p>今晚要演示，必须一次导入一批表格。</p></article>
                      <i>只能先选一个</i>
                      <article><b>数据组的纸条</b><p>原始数据必须留在本机，不能上传。</p></article>
                    </div>

                    <label className="wz-work-field wz-work-ticket">
                      <span><b>01</b> 先问一句，别急着做</span>
                      <textarea
                        value={workSample.clarification}
                        onChange={(event) => setWorkSample((current) => ({ ...current, clarification: event.target.value, evidence: null, error: '' }))}
                        maxLength={180}
                        placeholder="你最想先确认什么？例如：演示必须支持哪些文件格式？"
                      />
                    </label>
                    {workSample.clarification.trim().length < 8 && <p className="wz-work-next-hint">写下一句具体问题，第二张任务票就会出现。</p>}

                    {workSample.clarification.trim().length >= 8 && (
                      <fieldset className="wz-work-priorities wz-work-ticket">
                        <legend><b>02</b> 这一轮，你先守住什么？</legend>
                        {(Object.entries(workSamplePriorityLabels) as Array<[WorkSamplePriority, string]>).map(([value, label]) => (
                          <button
                            type="button"
                            className={workSample.priority === value ? 'active' : ''}
                            aria-pressed={workSample.priority === value}
                            onClick={() => setWorkSample((current) => ({ ...current, priority: value, aiDraft: '', revisedDraft: '', evidence: null, error: '' }))}
                            key={value}
                          >{label}</button>
                        ))}
                      </fieldset>
                    )}

                    {workSample.priority && (
                      <div className="wz-work-artifact wz-work-ticket">
                        <div><span><b>03</b> 请 AI 起草，你来改一刀</span><button type="button" onClick={generateWorkSampleDraft}>{workSample.aiDraft ? '重新起草' : '请 AI 起草'}</button></div>
                        {workSample.aiDraft ? (
                          <textarea
                            value={workSample.revisedDraft}
                            onChange={(event) => setWorkSample((current) => ({ ...current, revisedDraft: event.target.value, evidence: null, error: '' }))}
                            maxLength={900}
                            aria-label="修改 AI 起草的验收单"
                          />
                        ) : <p>AI 会先拟一份验收单。看看哪条不合适，亲手改一处。</p>}
                      </div>
                    )}

                    {workSample.aiDraft && !workSample.evidence ? (
                      <button className="wz-work-seal" type="button" onClick={sealWorkSampleEvidence}>保存这次练习 <ArrowRight size={15} /></button>
                    ) : workSample.evidence ? (
                      <div className="wz-work-evidence" aria-live="polite">
                        <div><small>OBSERVED / 本次看见了</small>{workSample.evidence.observations.map((item) => <p key={item}><Check size={12} />{item}</p>)}</div>
                        <div><small>NOT OBSERVED / 不能据此判断</small>{workSample.evidence.notObserved.map((item) => <p key={item}><X size={12} />{item}</p>)}</div>
                      </div>
                    ) : null}
                    {workSample.error && <p className="wz-work-error" role="alert">{workSample.error}</p>}
                  </section>
                )}
                {choiceImpact?.code === activeUniverse.code && !choiceImpact.quick && activeRun.currentEvent.day !== 180 && (
                  <aside className="wz-choice-impact-inline" aria-live="polite">
                    <div className="wz-impact-heading"><span><Check size={15} weight="bold" />{isGeneratedActionSource(choiceImpact.source) ? `${actionSourceLabel(choiceImpact.source)}已生成专属下一幕` : '选择已经改变时间线'}</span><small>第 {choiceImpact.nextDay} 天 · 纸页已留下折痕</small></div>
                    <div className={`wz-impact-scene wz-impact-scene-${activeUniverse.code.toLowerCase()} step-${impactSceneStep}`}>
                      <div className="wz-impact-path" aria-hidden="true"><i /><i /><i /></div>
                      <button type="button" className="wz-impact-kanshan" onClick={() => setImpactSceneStep((step) => (step + 1) % 3)} aria-label="让刘看山沿着时间线走一步">
                        <span className="wz-impact-kanshan-paper"><img loading="lazy" decoding="async" src="/kanshan-stroll.gif" alt="" /></span>
                        <span className="wz-impact-kanshan-caption">刘看山：{['我先去下一幕看看', '这里有新的线索', '把这一步记进票根'][impactSceneStep]}</span>
                      </button>
                      <span className="wz-impact-scene-note">点一下，让他沿着你的选择走一步</span>
                    </div>
                    <div className="wz-choice-impact-facts">
                      <div className="wz-impact-fact wz-impact-next"><span className="wz-impact-icon"><GitBranch size={18} weight="duotone" /></span><div><small>下一幕</small><strong>{choiceImpact.nextTitle}</strong></div></div>
                      {choiceImpact.tradeoff && <div className="wz-impact-fact wz-impact-cost"><span className="wz-impact-icon"><Target size={18} weight="duotone" /></span><div><small>主要代价</small><p>{choiceImpact.tradeoff}</p></div></div>}
                      <div className="wz-impact-fact wz-impact-delta"><span className="wz-impact-icon"><Sparkles size={18} weight="duotone" /></span><div><small>能力变化</small><div>{(Object.entries(choiceImpact.delta) as Array<[keyof StateDelta, number]>).sort(([, a], [, b]) => Math.abs(b) - Math.abs(a)).slice(0, 3).map(([key, value]) => <em className={value >= 0 ? 'up' : 'down'} key={key}>{traceDeltaLabels[key] ?? key} {value >= 0 ? '+' : ''}{value}</em>)}</div></div></div>
                    </div>
                    {choiceImpact.causalChain && <ol className="wz-causal-etching">{choiceImpact.causalChain.map((step, index) => <li key={step}><b>0{index + 1}</b><span>{step}</span></li>)}</ol>}
                    {choiceImpact.sourceInfluence && <p className="wz-source-influence"><BookOpen size={13} />{choiceImpact.sourceInfluence}</p>}
                    {choiceImpact.evidence?.length ? <footer><small>本幕受 {choiceImpact.evidence.length} 条知乎真人经历约束</small>{choiceImpact.evidence.map((item) => <a href={item.sourceUrl} target="_blank" rel="noreferrer" key={item.id}>{item.author}：{item.title}<ArrowSquareOut size={11} /></a>)}</footer> : null}
                  </aside>
                )}


              </div>
              {!forkEligible && <section className="echo-entry"><div><strong>看看别人遇到这件事时怎么做</strong><p>现实回声 · 读一份与当前选择相关的公开经历</p></div><button type="button" onClick={() => setEchoContext(currentEchoContext)}>拆开来信 →</button></section>}
              <details key={`proof-${activeUniverse.code}-${activeRun.currentEvent.id}`} className="wz-universe-proof paper-disclosure" onToggle={(event) => { if (event.currentTarget.open) trackTelemetry('source_open', { routeCode: activeUniverse.code, day: activeRun.currentEvent.day }) }}><summary>这段经历的现实依据 · 查看原文</summary>
                <header className="wz-proof-header"><div><Quote size={18} weight="fill" /><span>这一路的选择票根</span></div><small>内置 {traceEvidenceItems.length} 条 · 实时 {liveEvidence?.items.length ?? 0} 条 · 原文可查</small></header>
                <JourneyTickets run={activeRun} />
                <details className="wz-proof-sources" onToggle={(event) => { if (event.currentTarget.open) trackTelemetry('source_open', { routeCode: activeUniverse.code, day: activeRun.currentEvent.day }) }}>
                  <summary><span>知乎来源 · 现实回声</span><small>{traceEvidenceItems.length} 条内置{liveEvidence?.items.length ? ` · ${liveEvidence.items.length} 条实时` : ''} · 首屏 3 条<ChevronDown size={12} /></small></summary>
                  <div className="wz-event-evidence-list">
                    {featuredTraceEvidence.map((item) => (
                      <ZhihuPost compact key={item.id ?? `${item.author}-${item.sourceUrl}`} author={item.author} title={item.sourceTitle} badge={item.badge} summary={item.conclusion} sourceUrl={item.sourceUrl} votes={item.votes} />
                    ))}
                  {featuredLiveEvidence.map((item) => (
                    <ZhihuPost compact key={item.id || item.sourceUrl} author={item.author || '知乎用户'} title={item.title} badge={item.badge} summary={item.excerpt || '摘要暂不可用，请打开原文查看完整语境。'} sourceUrl={item.sourceUrl} votes={item.votes} live />
                  ))}
                  </div>
                  {additionalEvidenceCount > 0 && <details className="wz-evidence-more">
                    <summary>查看其余 {additionalEvidenceCount} 条来源 <ChevronDown size={12} /></summary>
                    <div className="wz-event-evidence-list">
                      {additionalTraceEvidence.map((item) => (
                        <ZhihuPost compact key={item.id ?? `${item.author}-${item.sourceUrl}`} author={item.author} title={item.sourceTitle} badge={item.badge} summary={item.conclusion} sourceUrl={item.sourceUrl} votes={item.votes} />
                      ))}
                      {additionalLiveEvidence.map((item) => (
                        <ZhihuPost compact key={item.id || item.sourceUrl} author={item.author || '知乎用户'} title={item.title} badge={item.badge} summary={item.excerpt || '摘要暂不可用，请打开原文查看完整语境。'} sourceUrl={item.sourceUrl} votes={item.votes} live />
                      ))}
                    </div>
                  </details>}
                  <div className="wz-live-evidence" aria-live="polite">
                  <div className="wz-live-evidence-head">
                    <span><i /> 知乎实时检索</span>
                    <small>仅使用档案类型与通用冲突 · {formatEvidenceTime(liveEvidence?.retrievedAt)}</small>
                  </div>
                  {liveEvidenceLoading && <div className="wz-live-evidence-status"><CircleDashed size={14} /> 正在寻找与这个冲突相似的真人经历…</div>}
                  {liveEvidenceError && (
                    <div className="wz-live-evidence-status is-error">
                      <span>实时检索未接通，当前剧情仍由内置证据支撑。</span>
                      <button type="button" onClick={retryLiveEvidence}>重试</button>
                    </div>
                  )}
                  {!liveEvidenceLoading && !liveEvidenceError && liveEvidence?.items.length === 0 && (
                    <div className="wz-live-evidence-status">这个抽象处境暂未检索到合适结果，未用低相关内容凑数。</div>
                  )}

                  </div>
                </details>
              </details>
            </article>


          </section>

          <section className="wz-view wz-reflect" data-view="3" aria-hidden={scene !== 3} inert={scene !== 3}>
            <header className={`paper-reflection-heading ${experiment ? 'has-action-plan' : ''}`}><PaperAccent kind="return-envelope" placement="reflection" /><span className="paper-eyebrow">回到今天</span><h2>{experiment ? '把这一步，带回现实' : <>玩到这里，<br />你还想这样选吗？</>}</h2><p>{completedUniverseCount ? '先把一件小事带回现实。其他宇宙，想比较时再出发。' : '先走完一条路，再带走一件七天内能试的小事。'}</p></header>
            {completedUniverseCount > 0 && (
              <section className="wz-experiment-card wz-reveal" aria-labelledby="experiment-title">
                <header hidden={Boolean(experiment)}>
                  <div><span>RETURN WITH AN EXPERIMENT</span><h3 id={experiment ? undefined : "experiment-title"}>这件事，回去试七天</h3></div>
                  {!experiment && <button type="button" onClick={() => debate && allUniversesComplete ? void generateExperiment() : takeFirstExperiment()} disabled={experimentPending}>{experimentPending ? '正在设计7天实验…' : '领取七天行动票'} <Sparkles size={15} /></button>}
                  {experiment && <button type="button" className="wz-ticket-copy" onClick={() => void copyExperimentTicket()}>{experimentCopied ? <Check size={15} weight="bold" /> : <BookOpen size={15} />}{experimentCopied ? '已复制，可带走' : '复制行动票'}</button>}
                </header>
                {experimentError && <p className="wz-debate-error" role="alert">{experimentError}</p>}
                {experimentPending && <div className="wz-experiment-folding" aria-live="polite"><Sparkles size={16} /><span>正在安排每天要试的事</span><i><b /><b /><b /></i></div>}
                {experiment && (
                  <div className="wz-experiment-body">
                    <ExperimentPlanner key={`${simulationCycle}-${experiment.title}-${experiment.origin?.code ?? 'debate'}`} plan={experiment} active={scene === 3} goal={simulationProfile.goal}
                      checkins={experimentProgress.checkins} notes={experimentProgress.notes ?? {}} demo={judgeDemoActive} locked={Boolean(experimentProgress.calibration)}
                      onStatus={setExperimentDayStatus} onNote={(day, text) => setExperimentProgress(current => ({ ...current, notes: { ...current.notes, [day]: text } }))}
                      onCopy={() => void copyExperimentTicket()} copied={experimentCopied} />
                    {allExperimentDaysRecorded && !experimentProgress.calibration && (
                      <div className="wz-experiment-feedback">
                        <header><div><small>DAY 7 / FEEDBACK</small><h4>这七天，你试得怎么样？</h4></div><span>{doneExperimentDays} 天完成 · {7 - doneExperimentDays} 天跳过</span></header>
                        <div className="ep-evidence-review"><h5>先回看你留下的记录</h5><p>完成 {evidenceReview.done} 天 · 跳过 {evidenceReview.skipped} 天 · 待记录 {evidenceReview.pending} 天。打卡次数不代表实验有效。</p>
                          <ol>{experiment.dailyTasks.map(task => <li key={task.day}><b>第 {task.day} 天 · {experimentProgress.checkins[task.day] === 'done' ? '完成' : experimentProgress.checkins[task.day] === 'skipped' ? '跳过' : '待记录'}</b><p>{experimentProgress.notes?.[task.day]?.trim() || '未留下具体观察；可返回这一天补充记录。'}</p></li>)}</ol>
                          <small>以下判断来自你的自述，尚未经过外部验证。日记录仅在本机展示。</small>
                        </div>
                        <div className="wz-feedback-results" role="group" aria-label="实验结果强度">
                          {([['strong', '明显有效'], ['mixed', '有得有失'], ['weak', '没有奏效']] as const).map(([value, label]) => (
                            <button type="button" className={experimentProgress.result === value ? 'active' : ''} onClick={() => setExperimentProgress((current) => ({ ...current, result: value }))} key={value}>{label}</button>
                          ))}
                        </div>
                        <button className={`wz-signal-toggle ${experimentProgress.signalObserved ? 'active' : ''}`} type="button" onClick={() => setExperimentProgress((current) => ({ ...current, signalObserved: !current.signalObserved }))}>
                          <span>{experimentProgress.signalObserved ? <Check size={13} weight="bold" /> : null}</span>我观察到了预设的成功信号
                        </button>
                        <label><span>{experiment.feedbackQuestion}</span><textarea value={experimentProgress.answer} maxLength={500} onChange={(event) => setExperimentProgress((current) => ({ ...current, answer: event.target.value }))} placeholder="写下最具体的一次观察，而不是给自己打分。" /></label>
                        <p className="wz-feedback-privacy"><Info size={12} />这段回答只保存在本机。AI只会收到完成天数、结果强弱、成功信号和宇宙数值状态。</p>
                        <button className="wz-calibrate-button" type="button" disabled={!experimentReadyToCalibrate || calibrationPending} onClick={() => void calibrateFromExperiment()}>{calibrationPending ? '正在校正三个宇宙…' : '按这次结果，再试三条路'} <GitBranch size={15} /></button>
                      </div>
                    )}
                    {allExperimentDaysRecorded && !experimentProgress.calibration && !experimentReadyToCalibrate && <p className="wz-feedback-hint">{evidenceReview.reason}</p>}
                    {experimentProgress.calibration && (
                      <div className="wz-calibration-result">
                        <header><span>CALIBRATION COMPLETE · {experimentProgress.calibration.source === 'local-rule' ? '本地规则校正' : isGeneratedActionSource(experimentProgress.calibration.source) ? `${actionSourceLabel(experimentProgress.calibration.source)}校正` : 'AI 校正'}</span><b>{experimentProgress.calibration.completionRate}% 执行率</b></header>
                        <h4>下一轮先看宇宙 {experimentProgress.calibration.recommendedUniverse}</h4>
                        <p>{experimentProgress.calibration.summary}</p>
                        {calibrationNote && <p className="wz-calibration-note">{calibrationNote}</p>}
                        <div>
                          {(['A', 'B', 'C'] as UniverseCode[]).map((code) => (
                            <article className={experimentProgress.calibration?.recommendedUniverse === code ? 'recommended' : ''} key={code}>
                              <b>{code}</b><span>{careerUniverses.find((item) => item.code === code)?.title}</span><small>{Object.entries(experimentProgress.calibration?.routeDeltas[code] ?? {}).map(([key, value]) => `${calibrationMetricLabels[key] ?? key} ${Number(value) >= 0 ? '+' : ''}${value}`).join(' · ')}</small>
                            </article>
                          ))}
                        </div>
                        <button type="button" onClick={launchRecalibratedCycle}>开始第 {simulationCycle + 1} 轮 <ArrowRight size={16} /></button>
                      </div>
                    )}
                  </div>
                )}
              </section>
            )}

            {completedUniverseCount > 0 && (
            <details className={`wz-future-dialogue paper-disclosure tone-${activeUniverse.tone} wz-reveal`} aria-labelledby="future-dialogue-title">
              <summary>和一个未来的自己聊聊（可选）</summary>
              <header>
                <div><span>FUTURE SELF / 独立记忆</span><h3 id="future-dialogue-title">问问 180 天后的自己</h3></div>
                <small>每个宇宙只记得自己走过的路 · {futureQuestionCount}/6 次提问</small>
              </header>
              <div className="wz-future-tabs" role="tablist" aria-label="选择一个未来自己">
                {careerUniverses.map((universe, index) => (
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeUniverseIndex === index}
                    className={`tone-${universe.tone} ${activeUniverseIndex === index ? 'active' : ''}`}
                    onClick={() => { setActiveUniverseIndex(index); setFutureError('') }}
                    disabled={futurePending}
                    key={universe.code}
                  >
                    <b>{universe.code}</b><span>{universe.title}</span><small>{universeRuns[universe.code].currentEvent.day === 180 ? '已抵达' : `停在第 ${universeRuns[universe.code].currentEvent.day} 天`}</small>
                  </button>
                ))}
              </div>
              {activeRun.currentEvent.day === 180 ? (
                <div className={`wz-future-chat-shell tone-${activeUniverse.tone}`}>
                  <header className="wz-correspondence-head">
                    <div className="wz-correspondence-seal" aria-hidden="true"><span>{activeUniverse.code}</span></div>
                    <div>
                      <small>CROSS-TIME POST · 180 DAYS</small>
                      <strong>写给宇宙 {activeUniverse.code} 的未来自己</strong>
                    </div>
                    <span>{futureQuestionCount} / 6 封已寄出</span>
                  </header>
                  <div className="wz-future-messages" aria-live="polite">
                    {activeFutureChat.length === 0 && (
                      <div className="wz-future-empty">
                        <PaperAccent kind="return-envelope" placement="letter" />
                        <div><small>第一封信，还没有写下</small><p>我记得宇宙 {activeUniverse.code} 里做过的选择。你想问我后不后悔，还是哪一步最难熬？</p></div>
                      </div>
                    )}
                    {activeFutureChat.map((message, index) => (
                      <div className={`wz-future-message is-${message.role}`} key={`${message.role}-${index}-${message.content.slice(0, 12)}`}>
                        <span className="wz-letter-mark" aria-hidden="true">{message.role === 'user' ? '寄' : activeUniverse.code}</span>
                        <div className="wz-letter-body">
                          <small>{message.role === 'user' ? `现在寄出 · 第 ${Math.floor(index / 2) + 1} 封` : `180 天后回信 · 宇宙 ${activeUniverse.code}`}</small>
                          <p>{message.content}</p>
                          {message.role === 'assistant' && (
                            <>
                              {!!message.memoryRefs?.length && (
                                <div className="wz-future-memory">
                                  <span>它记起了</span>
                                  {message.memoryRefs.map((memoryRef) => <q key={memoryRef}>{memoryRef}</q>)}
                                </div>
                              )}
                              <div className={`wz-future-grounding ${message.sources?.length ? 'has-sources' : 'is-memory-only'} ${message.qualityReview?.status === 'clarify' ? 'needs-clarification' : ''}`}>
                                {(message.source || message.qualityReview) && <span className="wz-future-quality">{message.source === 'local-rules' ? '本地记忆回信 · 未采用模型回答' : message.source === 'demo' ? '示例回信 · 未调用实时 AI' : isGeneratedActionSource(message.source) ? `${actionSourceLabel(message.source)}生成` : message.qualityReview?.status === 'clarify' ? '需要你补充一笔' : message.qualityReview?.status === 'repaired' ? '已按记忆校正' : '已核对剧情记录'}</span>}
                                <span>{message.sources?.length ? '采用了知乎真人回声' : '仅依据这条时间线'}</span>
                                {message.sources?.map((source) => (
                                  <a href={source.sourceUrl} target="_blank" rel="noreferrer" key={source.id}>{source.author} · {source.title}<ArrowSquareOut size={11} /></a>
                                ))}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                    {futurePending && futurePendingCode === activeUniverse.code && (
                      <div className="wz-future-message is-assistant is-thinking">
                        <span className="wz-letter-mark" aria-hidden="true">{activeUniverse.code}</span>
                        <div className="wz-letter-body"><small>正在写回信</small><p>{['正在读你的问题', '正在翻回本宇宙的三次选择', '核对是否有相关的知乎真人回声'][futurePendingStage]}<i aria-hidden="true"><b /><b /><b /></i></p></div>
                      </div>
                    )}
                  </div>
                  <div className="wz-correspondence-compose">
                    <small>未寄出的三个问题</small>
                    <div className="wz-future-prompts" aria-label="可以追问的问题">
                      {['你最后悔什么？', '我现在最应该验证什么？', '你觉得这半年值吗？'].map((question) => (
                        <button type="button" onClick={() => void askFutureSelf(question)} disabled={futurePending || futureQuestionCount >= 6} key={question}>{question}</button>
                      ))}
                    </div>
                    <form className="wz-future-form" onSubmit={(event) => { event.preventDefault(); void askFutureSelf() }}>
                      <input value={futureQuestion} onChange={(event) => setFutureQuestion(event.target.value)} maxLength={300} placeholder={`写一封信，问宇宙 ${activeUniverse.code} 的未来自己…`} aria-label={`问宇宙 ${activeUniverse.code} 的未来自己`} disabled={futurePending || futureQuestionCount >= 6} />
                      <button type="submit" disabled={!futureQuestion.trim() || futurePending || futureQuestionCount >= 6} aria-label="寄往 180 天后"><Send size={17} /><span>寄出</span></button>
                    </form>
                    {futureError && <p className="wz-future-error" role="alert">{futureError}</p>}
                  </div>
                </div>
              ) : (
                <div className="wz-future-locked"><Clock3 size={20} /><p>这个未来自己还没有形成。先回到宇宙 {activeUniverse.code} 完成三次关键选择。</p></div>
              )}
            </details>
            )}
            {(
            <section className="wz-debate-room wz-reveal" aria-labelledby="debate-room-title">
              <header>
                <div><span>CROSS-UNIVERSE DEBATE</span><h3 id="debate-room-title">三个自己，谁也说服不了谁</h3></div>
                <small>{allUniversesComplete ? '三条路都走完了，听听各自怎么说' : `${(['A', 'B', 'C'] as UniverseCode[]).filter((code) => universeRuns[code].currentEvent.day === 180).length}/3 个宇宙已抵达`}</small>
              </header>
              {!allUniversesComplete ? (
                <div className="wz-debate-locked"><GitBranch size={21} /><p>{completedUniverseCount ? `已完成 ${completedUniverseCount}/3 条路线，已经可以带走行动票。走完其余路线后，可额外比较三个未来的取舍。` : '先完成一条路线，就能得到结局和七天行动票。三条全部走完后，额外开放未来辩论。'}</p><button type="button" onClick={() => { continueQuickJourney(); setScene(2) }}>继续探索其他宇宙 <ArrowRight size={18}/></button></div>
              ) : (
                <>
                  <div className="wz-debate-question">
                    <textarea value={debateQuestion} onChange={(event) => setDebateQuestion(event.target.value)} maxLength={300} aria-label="交给三个未来自己的问题" />
                    <button type="button" onClick={() => void startDebate()} disabled={!debateQuestion.trim() || debatePending}>{debatePending ? '三个自己正在讨论…' : debate ? '用这个问题重新辩论' : '让他们争一争'} <ArrowRight size={16} /></button>
                  </div>
                  {debateError && <p className="wz-debate-error" role="alert">{debateError}</p>}
                  {debatePending && (
                    <section className="wz-debate-forge" aria-live="polite" aria-label="实时辩论生成进度">
                      <div className="wz-forge-routes" aria-hidden="true"><i>A</i><i>B</i><i>C</i><span /></div>
                      <ol>
                        {[
                          ['读取三条时间线', '只使用你亲自走过的选择'],
                          ['寻找真正分歧', '比较获得、代价与判断标准'],
                          ['未来彼此质询', '每句话标记它挑战了谁'],
                          ['安排七天尝试', '留下 7 天内可验证的一步'],
                        ].map(([title, detail], index) => (
                          <li className={index < debatePendingStage ? 'done' : index === debatePendingStage ? 'active' : ''} key={title}>
                            <b>{index < debatePendingStage ? <Check size={12} weight="bold" /> : `0${index + 1}`}</b>
                            <span>{title}<small>{detail}</small></span>
                          </li>
                        ))}
                      </ol>
                      <p><Sparkles size={14} />他们会拿这轮游戏里做过的选择，追问彼此到底值不值。</p>
                    </section>
                  )}
                  {debate && (
                    <div className="wz-debate-transcript" aria-live="polite">
                      <div className="wz-debate-mode"><span>{debate.mode === 'memory-fallback' ? '记忆编排模式' : debate.mode === 'cached-ai' ? '最近一次 AI 演示记录' : debate.mode === 'ai-repaired' ? '实时生成 · 协议已校正' : '实时交叉质询'}</span><small>{debate.mode === 'memory-fallback' ? '使用本轮三个宇宙的结局编排示例对话' : debate.mode === 'cached-ai' ? '实时服务未响应，明确展示已成功生成的缓存结果' : debate.mode === 'ai-repaired' ? '保留 AI 观点，仅补齐缺失的证词标记或实验字段' : '每位未来自己只引用自己的时间线'}</small></div>
                      <div className="wz-debate-voices">
                        {debate.lines.map((line, index) => {
                          const universe = careerUniverses.find((item) => item.code === line.speaker) ?? careerUniverses[0]
                          return (
                            <article className={`tone-${universe.tone}`} style={{ '--debate-order': index } as CSSProperties} data-challenges={line.challenges || undefined} key={`${line.speaker}-${index}`}>
                              <div><b>{line.speaker}</b><span>未来 {line.speaker} · {universe.title}</span>{line.challenges && <small><ArrowRight size={11} />质询未来 {line.challenges}</small>}</div>
                              <p>{line.text}{line.memoryRef && <q><span>只引用本宇宙</span>{line.memoryRef}</q>}</p>
                            </article>
                          )
                        })}
                      </div>
                      <section className="wz-debate-knot" aria-label="辩论收束">
                        <article><small>真正分歧</small><strong>{debate.conflictCore || '三个人想要的不一样，可谁都只有这么多时间。'}</strong></article>
                        <article><small>共同承认</small><strong>{debate.commonGround || '游戏走完了，生活里的事还得亲自试。'}</strong></article>
                        <article className="is-experiment"><small>共同提出的 7 天试验</small><strong>{debate.experimentSeed?.action || '选一个真实任务，做一次可撤回的小实验。'}</strong><span>验收：{debate.experimentSeed?.successSignal || '记录获得、代价与下一步。'}</span></article>
                      </section>
                      <blockquote><Quote size={18} /><span>留给现在的你</span><strong>{debate.closingQuestion}</strong></blockquote>
                    </div>
                  )}
                </>
              )}
            </section>
            )}
            <div className="wz-reflect-card wz-reveal">
              <div className="wz-reflect-orbit">
                <div className="wz-reflect-world" aria-hidden="true" />
                <div className="wz-return-pathlights" aria-hidden="true"><i /><i /><i /></div>
                <div className="wz-future-figures" aria-hidden="true">
                  {careerUniverses.map((universe) => (
                    <span className={`future-${universe.code.toLowerCase()}`} key={universe.code}>
                      <img loading="lazy" decoding="async" src={universe.code === 'A' ? '/kanshan-computer.gif' : universe.code === 'B' ? '/kanshan-stroll.gif' : '/kanshan-idle.gif'} alt="" />
                      <i>{universe.code}</i>
                    </span>
                  ))}
                </div>
                <div className="wz-future-notes" aria-hidden="true">
                  <p>我想弄懂它，<br />不想一出错就求人。<small>未来的你 · A</small></p>
                  <p>我想先做出来，<br />总等准备好太累了。<small>未来的你 · B</small></p>
                  <p>我学了这么久，<br />还想再给专业一次机会。<small>未来的你 · C</small></p>
                </div>
              </div>
              <img className="wz-return-kanshan" loading="lazy" decoding="async" src="/kanshan-wave.gif" alt="刘看山带着行动票回到现实" />
              <div className="wz-reflect-copy">
                <span>来自三个未来的一封回信</span>
                <h2>7 天现实实验</h2>
                <div className="wz-reality-action"><small>你的下一步行动</small><strong>{activeUniverse.action}</strong></div>
                <p>这条路到底适不适合，回去做一次才有话说。</p>
                <div className="wz-reality-seals" aria-label="选择写信的未来自己">
                  {careerUniverses.map((universe, index) => (
                    <button type="button" className={activeUniverseIndex === index ? 'active' : ''} onClick={() => setActiveUniverseIndex(index)} aria-pressed={activeUniverseIndex === index} key={universe.code}>{universe.code}</button>
                  ))}
                </div>
              </div>
              <form className="wz-return-question" onSubmit={(event) => { event.preventDefault(); void askFutureSelf() }}>
                <label htmlFor="return-question">你想问未来的自己什么？</label>
                <div><input id="return-question" value={futureQuestion} onChange={(event) => setFutureQuestion(event.target.value)} maxLength={300} placeholder={`写下问题，宇宙 ${activeUniverse.code} 的你会认真回答…`} disabled={futurePending || futureQuestionCount >= 6} /><button type="submit" disabled={!futureQuestion.trim() || futurePending || futureQuestionCount >= 6 || activeRun.currentEvent.day !== 180} aria-label="把问题寄给未来的自己"><Send size={18} /></button></div>
                <div className="wz-return-recipients" aria-label="选择问题的收件人">
                  {careerUniverses.map((universe, index) => (
                    <button type="button" className={activeUniverseIndex === index ? 'active' : ''} onClick={() => setActiveUniverseIndex(index)} key={universe.code}>问宇宙 {universe.code}</button>
                  ))}
                </div>
              </form>
            </div>
            {completedUniverseCount === 0 && (
              <aside className="wz-futures-unlock wz-reveal">
                <div><span>未来来信尚未寄出</span><strong>先让任意一个宇宙走到第 180 天</strong></div>
                <small><b>{completedUniverseCount}/3</b> 个未来抵达后，对话才会在这里展开；三个都抵达后才开始辩论。</small>
                <button type="button" onClick={() => setScene(2)}>继续推演宇宙 {activeUniverse.code}<ArrowRight size={16} /></button>
              </aside>
            )}
            <div className="wz-reflect-actions wz-reveal">
              <button type="button" onClick={() => setScene(2)}><ArrowLeft size={18} />重看其他宇宙</button>
              <button type="button" onClick={() => setEchoContext(currentEchoContext)}>看看这条路的现实回声 <ArrowRight size={19} /></button>
            </div>
          </section>
        </div>

        <nav className="wz-journey" aria-label="问枝探索步骤">
          {sceneLabels.map((label, index) => {
            const Icon = [Sparkles, Target, GitBranch, Quote][index]
            return (
              <button
                key={label}
                type="button"
                className={scene === index ? 'active' : scene > index ? 'done' : ''}
                aria-current={scene === index ? 'step' : undefined}
                onClick={() => setScene(index)}
              >
                <span>{scene > index ? <Check size={16} weight="bold" /> : <Icon size={18} />}</span>
                <b>{label}</b><small>0{index + 1}</small>
              </button>
            )
          })}
        </nav>
      </div>
    </main>
  )
}

function LoadingAnalysis({ title }: { title: string }) {
  const echoes = [
    { code: 'A', label: '找到同路人', detail: '谁走过相似的路' },
    { code: 'B', label: '找到反例', detail: '什么会让结论反转' },
    { code: 'C', label: '保留原文', detail: '每个判断都能回到知乎' },
  ]
  return (
    <div className="analysis-loading">
      <div className="loading-paper-world" aria-hidden="true">
        <img loading="lazy" decoding="async" src="/kanshan-stroll.gif" alt="" />
        <i className="loading-route route-a" /><i className="loading-route route-b" /><i className="loading-route route-c" />
      </div>
      <section className="loading-letter">
        <span className="section-index">REALITY ECHO / 现实回声</span>
        <h2>这条路，<em>现实里有人走过吗？</em></h2>
        <p>问枝会把刚才的选择放回知乎真人经历中对照：谁走过、付出了什么，以及哪里与你不同。</p>
        <div className="loading-echo-cards">
          {echoes.map((echo, index) => (
            <article key={echo.code} style={{ animationDelay: `${index * 220}ms` }}>
              <b>{echo.code}</b><div><strong>{echo.label}</strong><small>{echo.detail}</small></div><Check size={15} weight="bold" />
            </article>
          ))}
        </div>
        <div className="loading-question"><small>本轮公共议题</small><span>“{title}”</span></div>
        <footer><i /><span>稍等，下一页可以看相关经历和知乎原文</span></footer>
      </section>
    </div>
  )
}

function TreeView({
  branches,
  questionTitle,
  selected,
  pendingCounts,
  onSelect,
}: {
  branches: Branch[]
  questionTitle: string
  selected: string
  pendingCounts: Record<string, number>
  onSelect: (branch: Branch) => void
}) {
  const stageRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const activeParent = branches.find((branch) => branch.children?.some((child) => child.id === selected))
    ?? branches.find((branch) => branch.id === selected && branch.children)
    ?? branches.find((branch) => branch.children)
  const children = activeParent?.children ?? []
  const parentIndex = branches.findIndex((branch) => branch.id === activeParent?.id)
  const rootYs = [82, 230, 378]
  const childYs = children.length === 3 ? [92, 230, 368] : [70, 176, 282, 388]
  const selectedRootIndex = branches.findIndex((branch) => branch.id === selected)
  const selectedChildIndex = children.findIndex((branch) => branch.id === selected)
  const focusSegments: string[] = []

  if (selectedRootIndex >= 0) {
    focusSegments.push(`M154 235 C215 235 205 ${rootYs[selectedRootIndex]} 274 ${rootYs[selectedRootIndex]}`)
  } else if (activeParent && selectedChildIndex >= 0) {
    focusSegments.push(`M154 235 C215 235 205 ${rootYs[parentIndex]} 274 ${rootYs[parentIndex]}`)
    focusSegments.push(`M458 ${rootYs[parentIndex]} C520 ${rootYs[parentIndex]} 510 ${childYs[selectedChildIndex]} 583 ${childYs[selectedChildIndex]}`)
  }

  const focusPoint = selectedRootIndex >= 0
    ? { x: 366, y: rootYs[selectedRootIndex] }
    : { x: 684, y: childYs[Math.max(0, selectedChildIndex)] }

  useGSAP(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const timeline = gsap.timeline({ defaults: { ease: 'power3.out' } })
    timeline
      .fromTo('.connector-focus', { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: reducedMotion ? 0 : 0.52, stagger: 0.12 }, 0)
      .fromTo('.tree-lens', { autoAlpha: 0, scale: 0.55 }, { autoAlpha: 1, scale: 1, duration: reducedMotion ? 0 : 0.5 }, 0.12)
    return () => timeline.kill()
  }, { scope: stageRef, dependencies: [selected], revertOnUpdate: true })

  useEffect(() => {
    const scroller = scrollRef.current
    const stage = stageRef.current
    if (!scroller || !stage || !window.matchMedia('(max-width: 760px)').matches) return

    const frame = window.requestAnimationFrame(() => {
      const target = Array.from(stage.querySelectorAll<HTMLElement>('[data-branch-id]'))
        .find((node) => node.dataset.branchId === selected)
      if (!target) return
      const targetCenter = target.offsetLeft + target.offsetWidth / 2
      const left = Math.max(0, targetCenter - scroller.clientWidth / 2)
      scroller.scrollTo({
        left,
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      })
    })

    return () => window.cancelAnimationFrame(frame)
  }, [selected])

  return (
    <div
      className="tree-scroll"
      ref={scrollRef}
      role="region"
      aria-label="可横向探索的观点地形"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
        event.preventDefault()
        const scroller = scrollRef.current
        if (!scroller) return
        const direction = event.key === 'ArrowRight' ? 1 : -1
        const maxScroll = Math.max(0, scroller.scrollWidth - scroller.clientWidth)
        const nextScroll = Math.min(maxScroll, Math.max(0, scroller.scrollLeft + direction * 180))
        scroller.scrollTo({
          left: nextScroll,
          behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        })
      }}
    >
      <div className="tree-stage" ref={stageRef}>
        <div className="tree-axis-label label-root">原问题</div>
        <div className="tree-axis-label label-first">第一分叉 · 学习目的</div>
        <div className="tree-axis-label label-second">继续追问 · 约束条件</div>
        <svg className="tree-connectors" viewBox="0 0 820 470" preserveAspectRatio="none" aria-hidden="true">
          {branches.map((branch, index) => (
            <path key={branch.id} className={`connector connector-${branch.status} ${pendingCounts[branch.id] ? 'connector-pending' : ''}`} d={`M154 235 C215 235 205 ${rootYs[index]} 274 ${rootYs[index]}`} />
          ))}
          {children.map((child, index) => (
            <path
              key={child.id}
              className={`connector connector-${child.status} ${pendingCounts[child.id] ? 'connector-pending' : ''} ${child.id === selected ? 'selected' : ''}`}
              d={`M458 ${rootYs[parentIndex]} C520 ${rootYs[parentIndex]} 510 ${childYs[index]} 583 ${childYs[index]}`}
            />
          ))}
          {focusSegments.map((path, index) => (
            <path key={`${selected}-${index}`} className="connector-focus" d={path} pathLength={1} />
          ))}
        </svg>
        <div
          className={`tree-lens lens-${pendingCounts[selected] ? 'pending' : flattenBranches(branches).find((branch) => branch.id === selected)?.status ?? 'covered'}`}
          style={{ left: focusPoint.x - 62, top: focusPoint.y - 62 }}
          aria-hidden="true"
        ><i /><i /></div>
        <button className="tree-root" aria-label={`原问题：${questionTitle}`}>
          <span>原问题</span>
          <strong>{questionTitle}</strong>
        </button>
        {branches.map((branch, index) => (
          <button
            key={branch.id}
            data-branch-id={branch.id}
            className={`tree-node tree-level-one node-${branch.status} ${pendingCounts[branch.id] ? 'has-pending' : ''} ${branch.id === selected ? 'selected' : branch.id === activeParent?.id ? 'path-active' : ''}`}
            style={{ top: rootYs[index] - 37 }}
            onClick={() => onSelect(branch)}
            aria-pressed={branch.id === selected}
          >
            <span className="node-knot" />
            <small>{pendingCounts[branch.id] ? `${pendingCounts[branch.id]} 条待审核` : branch.status === 'gap' ? '尚待回答' : `${branch.answerCount} 条回答`}</small>
            <strong>{branch.shortLabel ?? branch.label}</strong>
            <em>{pendingCounts[branch.id] ? '待审核' : statusCopy[branch.status].label}</em>
          </button>
        ))}
        {children.map((branch, index) => (
          <button
            key={branch.id}
            data-branch-id={branch.id}
            className={`tree-node tree-level-two node-${branch.status} ${pendingCounts[branch.id] ? 'has-pending' : ''} ${branch.id === selected ? 'selected' : ''}`}
            style={{ top: childYs[index] - 37 }}
            onClick={() => onSelect(branch)}
            aria-pressed={branch.id === selected}
          >
            <span className="node-knot" />
            <small>{pendingCounts[branch.id] ? `${pendingCounts[branch.id]} 条待审核` : branch.status === 'gap' ? '0 条直接回答' : `${branch.answerCount} 条回答`}</small>
            <strong>{branch.shortLabel ?? branch.label}</strong>
            <em>{pendingCounts[branch.id] ? '待审核' : statusCopy[branch.status].label}</em>
          </button>
        ))}
        {children.some((branch) => branch.status === 'gap') && (
          <div className="tree-gap-annotation">
            <span>空枝</span>
            相邻观点 ≠ 直接回答
          </div>
        )}
      </div>
    </div>
  )
}

function MatrixView({
  branches,
  pendingCounts,
  onSelect,
}: {
  branches: Branch[]
  pendingCounts: Record<string, number>
  onSelect: (branch: Branch) => void
}) {
  const focus = branches.find((branch) => branch.children?.length) ?? branches[0]
  const rows = focus.children?.length ? focus.children : branches
  const columns = ['直接案例', '机制 / 观点', '边界 / 反例']

  const getCells = (branch: Branch): Array<{ label: string; status: BranchStatus }> => {
    const evidenceStatus: BranchStatus = branch.evidenceCount >= 6 ? 'covered' : branch.evidenceCount > 0 ? 'thin' : 'gap'
    const boundaryStatus: BranchStatus = branch.unknown ? (branch.status === 'gap' ? 'gap' : 'thin') : 'covered'
    return [
      { label: pendingCounts[branch.id] ? `${pendingCounts[branch.id]} 条待审核` : branch.status === 'gap' ? '空枝' : `${branch.answerCount} 个回答`, status: branch.status },
      { label: branch.evidenceCount ? `${branch.evidenceCount} 条证据` : '暂无证据', status: evidenceStatus },
      { label: branch.unknown ? '仍有缺口' : '已交叉验证', status: boundaryStatus },
    ]
  }

  return (
    <div className="matrix-wrap">
      <div className="matrix-note"><Info size={15} />矩阵用于发现组合缺口，不代表系统穷尽了所有条件。</div>
      <div className="coverage-matrix">
        <div className="matrix-corner">{focus.shortLabel ?? focus.label} × 证据</div>
        {columns.map((column) => <div className="matrix-col" key={column}>{column}</div>)}
        {rows.map((row) => (
          <div className="matrix-row-contents" key={row.id}>
            <div className="matrix-row-label">{row.shortLabel ?? row.label}</div>
            {getCells(row).map((cell, index) => (
              <button
                key={`${row.id}-${columns[index]}`}
                className={`matrix-cell matrix-${cell.status}`}
                onClick={() => onSelect(row)}
              >
                <span>{cell.label}</span>
                <small>{statusCopy[cell.status].label}</small>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function EvidenceCard({ item, initiallyOpen = false }: { item: Evidence; initiallyOpen?: boolean }) {
  const cardRef = useRef<HTMLElement>(null)
  const [open, setOpen] = useState(initiallyOpen)

  useEffect(() => {
    if (!initiallyOpen) return
    const timer = window.setTimeout(() => {
      cardRef.current?.scrollIntoView({
        block: 'nearest',
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      })
    }, 520)
    return () => window.clearTimeout(timer)
  }, [initiallyOpen])

  useGSAP(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const shell = cardRef.current?.querySelector<HTMLElement>('.evidence-content-shell')
    const content = cardRef.current?.querySelector<HTMLElement>('.evidence-content')
    if (!shell || !content) return
    const timeline = gsap.timeline({ defaults: { ease: 'power3.out' } })
    if (open) {
      timeline
        .fromTo(shell, { height: 0 }, { height: 'auto', duration: reducedMotion ? 0 : 0.38 })
        .fromTo(content, { autoAlpha: 0, y: -8 }, { autoAlpha: 1, y: 0, duration: reducedMotion ? 0 : 0.28 }, 0.1)
    } else {
      timeline
        .to(content, { autoAlpha: 0, y: -6, duration: reducedMotion ? 0 : 0.16 })
        .to(shell, { height: 0, duration: reducedMotion ? 0 : 0.28 }, 0.04)
    }
    return () => timeline.kill()
  }, { scope: cardRef, dependencies: [open], revertOnUpdate: true })

  return (
    <article className={`evidence-card ${open ? 'is-open' : ''}`} ref={cardRef}>
      <button className="evidence-trigger" type="button" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
        <span className="author-avatar">{item.author.slice(0, 1)}</span>
        <span><strong>{item.author}</strong><small>{item.badge}</small></span>
        <ChevronDown size={16} />
      </button>
      <div className="evidence-content-shell">
        <div className="evidence-content">
          <p className="evidence-conclusion">{item.conclusion}</p>
          <blockquote className={item.paraphrased ? 'is-paraphrase' : ''}>
            {item.paraphrased ? <FileSearch size={14} /> : <Quote size={14} />}
            {item.paraphrased && <b>研究摘要</b>}
            {item.quote}
          </blockquote>
          <div className="evidence-meta">
            <span>{item.support}</span>
            <span>{item.votes ? `${item.votes.toLocaleString()} 赞同` : '赞同数未显示'}</span>
          </div>
          {item.sourceUrl && (
            <a className="evidence-source-link" href={item.sourceUrl} target="_blank" rel="noreferrer">
              <span><b>{item.directExperience ? '亲历' : '观点'}</b>{item.sourceTitle}</span>
              <ArrowRight size={14} />
            </a>
          )}
        </div>
      </div>
    </article>
  )
}

function BranchPanel({
  branch,
  onClaim,
  pendingCount,
}: {
  branch: Branch
  onClaim: () => void
  pendingCount: number
}) {
  const isGap = branch.status === 'gap'
  const hasRealSources = branch.evidence.some((item) => item.sourceUrl)
  return (
    <aside className="branch-panel" aria-live="polite">
      <div className="branch-panel-head">
        <div>
          <span className="panel-overline">BRANCH DETAIL / 分支档案</span>
          <StatusPill status={branch.status} label={pendingCount ? `${pendingCount} 条待审核` : undefined} />
        </div>
        <h2>{branch.label}</h2>
        <div className="branch-path">
          {branch.path.map((path, index) => (
            <span key={path}>{index > 0 && <i>/</i>}{path}</span>
          ))}
        </div>
      </div>

      <div className="branch-panel-body">
        <div className="branch-metrics">
          <div><strong>{branch.answerCount}</strong><span>{hasRealSources ? '公开样本' : '直接回答'}</span></div>
          <div><strong>{branch.evidenceCount}</strong><span>{hasRealSources ? '可核验摘要' : '原文证据'}</span></div>
          <div><strong>{isGap ? '待补' : branch.status === 'thin' ? '偏薄' : '稳定'}</strong><span>覆盖状态</span></div>
        </div>

        <section className="insight-block">
          <span><Sparkles size={15} />当前观察</span>
          <p>{branch.insight}</p>
        </section>

        {branch.unknown && (
          <section className="unknown-block">
            <span><CircleDashed size={15} />仍然不知道</span>
            <p>{branch.unknown}</p>
          </section>
        )}

        {isGap ? (
          <section className="task-card">
            <div className="task-card-label">这里还缺一段亲身经历</div>
            <div className="task-meta">
              <span><Target size={14} />{branch.taskType}</span>
              <span><Clock3 size={14} />约 5 分钟</span>
            </div>
            <h3>{branch.taskPrompt}</h3>
            <p>只需说明具体任务、学习内容、投入时间和最终结果；不需要写一篇完整长文。</p>
          </section>
        ) : (
          <section className="evidence-section">
            <div className="evidence-title">
              <span>{hasRealSources ? '真实来源样本' : '归位证据'}</span>
              <small>{hasRealSources ? '摘要为研究转述，可跳转核验' : '仅使用答主明确表达的信息'}</small>
            </div>
            {branch.evidence.length ? branch.evidence.map((item, index) => (
              <EvidenceCard item={item} initiallyOpen={index === 0} key={`${branch.id}-${item.author}-${item.quote}`} />
            )) : (
              <div className="evidence-placeholder">
                <FileSearch size={22} />
                <p>该演示分支已归位，详细原文证据将在接入数据服务后展开。</p>
              </div>
            )}
          </section>
        )}
        {isGap && pendingCount > 0 && (
          <section className="pending-case-note" role="status">
            <span><Clock3 size={15} />PENDING REVIEW / 等待核验</span>
            <strong>{pendingCount} 条案例已保存在此设备</strong>
            <p>审核前，它不会被计入公开样本、覆盖率或结论；这根枝条仍保持“空枝”。</p>
          </section>
        )}
      </div>
      {isGap && (
        <div className="branch-panel-action">
          <span><b>{pendingCount ? '03 / 案例已进入待审核队列' : '03 / 轮到你的亲历'}</b><small>{pendingCount ? '地图暂不改写 · 可继续补充独立案例' : '约 5 分钟 · 只回答你知道的部分'}</small></span>
          <button className="claim-button" onClick={onClaim}>
            <Sprout size={17} />{pendingCount ? '继续补充另一条案例' : '我正好属于这个空白'} <ArrowRight size={16} />
          </button>
        </div>
      )}
    </aside>
  )
}

function ContributionModal({
  branch,
  onClose,
  onSubmit,
}: {
  branch: Branch
  onClose: () => void
  onSubmit: (draft: ContributionDraft) => Promise<void>
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    dialog.showModal()
    titleRef.current?.focus()
    return () => {
      if (dialog.open) dialog.close()
    }
  }, [])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (submitting) return
    const data = new FormData(event.currentTarget)
    setSubmitError('')
    setSubmitting(true)
    try {
      await onSubmit({
        background: String(data.get('background') ?? '').trim(),
        task: String(data.get('task') ?? '').trim(),
        weeklyTime: String(data.get('weeklyTime') ?? ''),
        duration: String(data.get('duration') ?? ''),
        outcome: String(data.get('outcome') ?? '').trim(),
        consentNoSensitive: data.get('consentNoSensitive') === 'on',
        website: String(data.get('website') ?? ''),
      })
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : '提交失败，请稍后再试。')
      setSubmitting(false)
    }
  }

  return (
    <dialog
      className="contribution-dialog"
      ref={dialogRef}
      aria-labelledby="task-modal-title"
      onCancel={(event) => {
        event.preventDefault()
        if (!submitting) onClose()
      }}
    >
      <div className="contribution-toolbar"><span>分享真实经历</span><button className="modal-close" type="button" onClick={onClose} aria-label="关闭" disabled={submitting}><X size={22} /></button></div>
      <div className="contribution-modal">
        <div className="modal-heading">
          <span className="modal-glyph"><Sprout size={22} /></span>
          <span className="panel-overline">YOUR STORY / 说说你的经历</span>
          <h2 id="task-modal-title" ref={titleRef} tabIndex={-1}>你也选过这条路？<br />说说后来怎么样了。</h2>
          <p>{branch.taskPrompt}</p>
        </div>
        <form onSubmit={submit} className="contribution-form">
          <label>
            <span>你的具体背景 <small>必填</small></span>
            <input required minLength={4} maxLength={160} name="background" placeholder="例如：中文系硕士生，几乎没有编程基础" />
          </label>
          <label>
            <span>你想改善的真实任务 <small>必填</small></span>
            <input required minLength={4} maxLength={240} name="task" placeholder="例如：批量整理访谈文本中的人物与地点" />
          </label>
          <div className="form-split">
            <label>
              <span>每周投入</span>
              <select name="weeklyTime" defaultValue="1-2">
                <option value="lt1">少于 1 小时</option>
                <option value="1-2">1—2 小时</option>
                <option value="gt2">2 小时以上</option>
              </select>
            </label>
            <label>
              <span>持续时间</span>
              <select name="duration" defaultValue="4w">
                <option value="2w">2 周以内</option>
                <option value="4w">2—4 周</option>
                <option value="long">1 个月以上</option>
              </select>
            </label>
          </div>
          <label>
            <span>最终发生了什么 <small>必填</small></span>
            <textarea required minLength={12} maxLength={1200} name="outcome" rows={4} placeholder="请同时写下收益、没解决的问题，或中途放弃的原因。" />
          </label>
          <div className="form-honeypot" aria-hidden="true">
            <label>请勿填写<input name="website" tabIndex={-1} autoComplete="off" /></label>
          </div>
          <label className="privacy-consent">
            <input required name="consentNoSensitive" type="checkbox" />
            <span>我确认内容不含真实姓名、联系方式，或可识别他人的敏感信息。</span>
          </label>
          <div className="form-assurance">
            <Check size={15} />案例将加密传输至问枝审核队列；本设备只保留收据，不保存案例正文。
          </div>
          {submitError && <div className="form-error" role="alert"><Info size={15} />{submitError}</div>}
          <button className={`primary-button modal-submit ${submitting ? 'is-submitting' : ''}`} type="submit" disabled={submitting}>
            {submitting ? '正在送达审核队列' : '提交我的经历'} <Send size={17} />
          </button>
        </form>
      </div>
    </dialog>
  )
}

const echoTheatreRoutes = [
  {
    code: 'A' as const,
    title: '系统学习实验室',
    verb: '把地基挖深',
    image: '/career-universe-a-full.webp',
    journeyImage: '/career-journey-a-v2.jpg',
    motion: '/kanshan-computer.gif',
    motionLabel: '未来的你正在调试第 17 次失败',
    color: '#1f64b5',
    branchId: 'career',
    gain: '技术自主',
    cost: '启动更慢',
    question: '他说基础一定要学，可你拿得出和他一样多的时间吗？',
    query: '非科班 系统学习 编程基础 项目 调试 转行 亲身经历',
    scenes: [
      { day: 0, label: '入场', title: '先搭一张站得住的桌子', note: '两个晚上。装好环境，复现一次报错，留下第一份调试记录。', recordA: '模拟投入：1 小时 46 分', recordB: '留下：1 份错误日志', choices: [] },
      { day: 30, label: '故障', title: '演示前夜，登录突然失效', note: '明晚就要展示。错误只在部署后出现，你还剩九十分钟。', recordA: '截止：明晚 20:00', recordB: '风险：整场演示无法进入', choices: [
        { id: 'trace', label: '把 90 分钟全部用于定位', cost: '本周不再增加任何新功能', consequence: '你带着一份完整错误日志进入评审。功能少了，但评审者能看见你的判断过程。' },
        { id: 'cut', label: '删掉登录，改成本地演示', cost: '能按时展示，但留下技术债', consequence: '你按时完成了演示，却必须在评审时解释为什么绕开了部署问题。' },
      ] },
      { day: 90, label: '评审', title: '代码能跑，却没人敢改', note: '导师给你两周重构；另一份实习作业，六天后截止。', recordA: '可用时间：本周 2 小时', recordB: '冲突：重构或实习作业', choices: [
        { id: 'refactor', label: '放弃这次实习作业，完成重构', cost: '短期少一次求职机会', consequence: '第 150 天，你拥有一个能讲清架构取舍的项目，却错过了这轮招聘窗口。' },
        { id: 'apply', label: '冻结项目，优先交实习作业', cost: '旧项目的结构问题暂时保留', consequence: '第 150 天，你拿到一次面试，但面试官追问旧项目时，你仍要面对那段没有重构的代码。' },
      ] },
      { day: 150, label: '结果', title: '你开始独自穿过故障', note: '速度依然不快，但你知道该先收集什么，又该怎样缩小范围。', recordA: '可展示：2 个完整项目', recordB: '仍欠缺：真实团队协作', choices: [] },
    ],
  },
  {
    code: 'B' as const,
    title: 'AI 协作工坊',
    verb: '先让东西跑起来',
    image: '/career-universe-b-full.webp',
    journeyImage: '/career-journey-b-v2.jpg',
    motion: '/kanshan-stroll.gif',
    motionLabel: '未来的你正带着原型穿过工坊',
    color: '#d48822',
    branchId: 'efficiency',
    gain: '作品反馈',
    cost: '工具依赖',
    question: '他得到的是能力，还是一次恰好有效的工具组合？',
    query: 'AI 协作 编程 自动化 工具 工作流 项目 亲身经历',
    scenes: [
      { day: 0, label: '点火', title: '一个下午，想法亮了起来', note: '你第一次觉得，想法与作品之间只隔着一次清楚的表达。', recordA: '模拟投入：1 小时 52 分', recordB: '留下：1 个可点击原型', choices: [] },
      { day: 30, label: '加速', title: '两种需要，只能留下一种', note: '一个要批量导入；一个要数据不出本地。今晚，你只有两小时。', recordA: '模拟反馈：2 条', recordB: '可用时间：今晚 2 小时', choices: [
        { id: 'tests', label: '先写验收清单，再让 AI 修改', cost: '今晚只能解决一个需求', consequence: '你拒绝同时满足两个人，先用验收清单交付了本地处理版本。第 90 天出错时，你有东西可以逐项核对。' },
        { id: 'features', label: '让 AI 同时实现两个需求', cost: '交付更快，但没有完整验证', consequence: '你一晚做出了两个入口。第 90 天演示出错时，你无法确认是数据、提示词还是生成代码造成的。' },
      ] },
      { day: 90, label: '失控', title: '演示现场，三条记录消失了', note: '屏幕共享还开着，合作方正在等。十分钟内，你必须作出决定。', recordA: '影响：3 条测试数据', recordB: '决策窗口：10 分钟', choices: [
        { id: 'stop', label: '停止演示，手动核对并说明原因', cost: '现场效果受损，但保留信任', consequence: '第 150 天，合作方仍愿意试用，因为你公开了失败记录和新的人工确认步骤。' },
        { id: 'rollback', label: '回滚到旧版，继续完成演示', cost: '保住现场，但问题没有定位', consequence: '第 150 天，作品获得更多关注；你却不敢开放真实数据，因为覆盖问题仍可能复现。' },
      ] },
      { day: 150, label: '结果', title: '作品被看见，能力被追问', note: '结果很吸引人。真正决定信任的，是你能否说清它会在哪里失败。', recordA: '模拟产出：4 次反馈', recordB: '仍欠缺：稳定性验证', choices: [] },
    ],
  },
  {
    code: 'C' as const,
    title: '原专业温室',
    verb: '守住自己的稀缺性',
    image: '/career-universe-c-full.webp',
    journeyImage: '/career-journey-c-v2.jpg',
    motion: '/kanshan-idle.gif',
    motionLabel: '未来的你还在钻研那个专业问题',
    color: '#526d42',
    branchId: 'literacy',
    gain: '专业积累',
    cost: '速度焦虑',
    question: '没有亲自编程，是放弃成长，还是更准确地选择了自己的位置？',
    query: '人文学科 专业深耕 AI 工具 跨专业协作 职业 亲身经历',
    scenes: [
      { day: 0, label: '扎根', title: '先把二十三条声音摊开', note: '不急着做工具。困惑、例外与矛盾，被标在同一张表里。', recordA: '模拟投入：1 小时 58 分', recordB: '留下：23 条材料编码', choices: [] },
      { day: 30, label: '田野', title: '第十七次访谈，推翻了答案', note: '沿用旧框架可以准时交稿；重新编码，这个月就不会有完整成果。', recordA: '新增反例：6 条', recordB: '截止：12 天后', choices: [
        { id: 'recode', label: '重新编码全部材料', cost: '本月无法交出完整文章', consequence: '你延迟交稿，但第 90 天带去会谈的是一个被材料修正过的问题，而不是漂亮的旧结论。' },
        { id: 'publish', label: '保留框架，注明研究限制', cost: '按时完成，但核心矛盾未解决', consequence: '你按时发表了阶段稿。第 90 天，技术伙伴基于旧框架做出的方案很快遇到同一个反例。' },
      ] },
      { day: 90, label: '会谈', title: '“语境”无法直接交给工程师', note: '会议还剩二十五分钟。你得把专业判断，翻译成可以验证的条件。', recordA: '会议剩余：25 分钟', recordB: '分歧：3 个关键概念', choices: [
        { id: 'translate', label: '共同写一页判断规则和反例', cost: '今天不讨论功能界面', consequence: '第 150 天，团队做出的不是最炫的工具，却能识别你最在意的几个边界案例。' },
        { id: 'learn', label: '暂停合作，自己补齐技术实现', cost: '获得更多控制，但研究时间被压缩', consequence: '第 150 天，你做出一个能运行的个人版本，同时积压了两个月尚未分析的新材料。' },
      ] },
      { day: 150, label: '结果', title: '专业判断，终于变成团队规则', note: '你没有变成程序员；你开始定义技术必须尊重什么，又该如何验证。', recordA: '可验证：7 条边界案例', recordB: '仍欠缺：规模化验证', choices: [] },
    ],
  },
]

function RealityEchoTheatre({
  onBack,
  onAddContribution,
  contributions,
  situation,
}: {
  onBack: () => void
  onAddContribution: (branchId: string, draft: ContributionDraft) => Promise<ContributionReceipt>
  contributions: ContributionReceipt[]
  situation: Situation
}) {
  const theatreRef = useRef<HTMLElement>(null)
  const [activeCode, setActiveCode] = useState<UniverseCode>('B')
  const [letterIndex, setLetterIndex] = useState(0)
  const [drawCount, setDrawCount] = useState(1)
  const [modalBranch, setModalBranch] = useState<Branch | null>(null)
  const [liveLetters, setLiveLetters] = useState<ZhihuSearchItem[]>([])
  const [liveLoading, setLiveLoading] = useState(false)
  const [liveError, setLiveError] = useState('')
  const [motionEnabled, setMotionEnabled] = useState(true)
  const [sceneIndex, setSceneIndex] = useState(0)
  const [isTravelling, setIsTravelling] = useState(false)
  const [provenanceOpen, setProvenanceOpen] = useState(false)
  const [decisions, setDecisions] = useState<Record<string, { id: string; label: string; cost: string; consequence: string }>>({})
  const [unlockedScenes, setUnlockedScenes] = useState<Record<UniverseCode, number>>({ A: 1, B: 1, C: 1 })
  const route = echoTheatreRoutes.find((item) => item.code === activeCode) ?? echoTheatreRoutes[1]
  const coreQuestion = useMemo(() => buildCoreQuestion(situation), [situation])
  const evidenceQuery = useMemo(() => (
    `${buildProfileSearchContext(situation)} ${route.query}`.slice(0, 120)
  ), [route.query, situation])
  const scene = route.scenes[sceneIndex % route.scenes.length]
  const decisionKey = `${activeCode}-${sceneIndex}`
  const currentDecision = decisions[decisionKey]
  const previousDecision = decisions[`${activeCode}-${sceneIndex - 1}`]
  const sceneNarrative = previousDecision?.consequence ?? scene.note
  const branch = flattenBranches(questions[0].branches).find((item) => item.id === route.branchId) ?? questions[0].branches[0]
  const archiveLetters = branch.evidence.filter((item) => item.sourceUrl).map((item) => ({
    author: item.author,
    avatarUrl: '',
    badge: item.badge,
    label: item.directExperience ? '亲历' : '观点',
    title: item.conclusion,
    excerpt: item.quote,
    votes: item.votes,
    sourceUrl: item.sourceUrl,
  }))
  const realtimeLetters = liveLetters.map((item) => ({
    author: item.author || '知乎用户',
    avatarUrl: item.avatarUrl,
    badge: item.badge || '知乎实时检索',
    label: '实时',
    title: item.title,
    excerpt: item.excerpt,
    votes: item.votes,
    sourceUrl: item.sourceUrl,
  }))
  const letters = realtimeLetters.length ? realtimeLetters : archiveLetters
  const letter = letters[letterIndex % Math.max(1, letters.length)]
  const pending = contributions.filter((item) => item.branchId === 'humanities-lite').length
  const gapBranch = flattenBranches(questions[0].branches).find((item) => item.id === 'humanities-lite')

  useEffect(() => {
    const controller = new AbortController()
    setLiveLetters([])
    setLiveError('')
    setLiveLoading(true)
    fetch('/api/zhihu/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Wenzhi-Release': releaseHeader() },
      body: JSON.stringify({ query: evidenceQuery, count: 6 }),
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = await response.json() as ZhihuSearchApiResponse
        if (!response.ok || !payload.search?.items) throw new Error(payload.error?.message || '实时回声暂时不可用')
        setLiveLetters(payload.search.items.filter((item) => (
          item.sourceUrl
          && item.title
          && (typeof item.relevanceScore !== 'number' || item.relevanceScore >= .08)
        )))
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setLiveError(error instanceof Error ? error.message : '实时回声暂时不可用')
      })
      .finally(() => setLiveLoading(false))
    return () => controller.abort()
  }, [evidenceQuery])

  useEffect(() => {
    setSceneIndex(0)
    setIsTravelling(false)
  }, [activeCode])

  useEffect(() => {
    if (!provenanceOpen) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setProvenanceOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [provenanceOpen])

  useEffect(() => {
    if (!motionEnabled || sceneIndex !== 0) return
    let arriveTimer = 0
    const departTimer = window.setTimeout(() => {
      setIsTravelling(true)
      arriveTimer = window.setTimeout(() => {
        setSceneIndex(1)
        setLetterIndex((current) => (current + 1) % Math.max(1, letters.length))
        setIsTravelling(false)
      }, 3000)
    }, 4200)
    return () => {
      window.clearTimeout(departTimer)
      window.clearTimeout(arriveTimer)
    }
  }, [motionEnabled, sceneIndex, activeCode, route.scenes.length, letters.length])

  useGSAP(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    gsap.fromTo('.echo-stage-scene', { autoAlpha: 0, scale: 1.035 }, { autoAlpha: 1, scale: 1, duration: reduced ? 0 : .72, ease: 'power3.out' })
    gsap.fromTo('.echo-letter', { autoAlpha: 0, y: 24, rotate: -1.8 }, { autoAlpha: 1, y: 0, rotate: .4, duration: reduced ? 0 : .58, ease: 'back.out(1.25)' })
  }, { scope: theatreRef, dependencies: [activeCode, letterIndex], revertOnUpdate: true })

  useGSAP(() => {
    if (!provenanceOpen) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const finalTargets = '.echo-provenance-ticket, .echo-provenance-set, .echo-provenance-set > i, .echo-provenance-set > img, .echo-provenance-event, .echo-provenance-link'

    if (reduced || !motionEnabled) {
      gsap.set(finalTargets, { clearProps: 'all' })
      gsap.set('.echo-thread-base', { strokeDashoffset: 0 })
      gsap.set('.echo-thread-pulse', { autoAlpha: 0 })
      return
    }

    gsap.set('.echo-thread-base', { strokeDashoffset: 1 })
    gsap.set('.echo-thread-pulse', { autoAlpha: 0 })

    const intro = gsap.timeline({ defaults: { ease: 'power3.out' } })
    intro
      .from('.echo-provenance-ticket', { autoAlpha: 0, x: -36, y: 28, rotation: -8, duration: .78 }, 0)
      .to('.echo-thread-base', { strokeDashoffset: 0, duration: 2.15, ease: 'power1.inOut' }, .42)
      .from('.echo-provenance-set', { autoAlpha: 0, scale: .82, x: 55, transformOrigin: '78% 66%', duration: 1.25 }, 1.22)
      .from('.echo-provenance-set > i', { scale: .68, autoAlpha: 0, stagger: .14, duration: .7, transformOrigin: 'center bottom' }, 1.48)
      .from('.echo-provenance-set > img', { autoAlpha: 0, x: -42, y: 8, duration: .82 }, 2.05)
      .from('.echo-provenance-event', { autoAlpha: 0, x: 28, duration: .72 }, 2.42)
      .from('.echo-provenance-link', { autoAlpha: 0, y: 8, duration: .45 }, 2.62)
      .to('.echo-thread-pulse', { autoAlpha: 1, duration: .25 }, 2.72)

    const threadFlow = gsap.to('.echo-thread-pulse', { strokeDashoffset: -1, duration: 2.25, repeat: -1, ease: 'none' })
    const paperBreath = gsap.timeline({ repeat: -1, yoyo: true, delay: 2.8, defaults: { duration: 3.8, ease: 'sine.inOut' } })
      .to('.echo-provenance-set', { scale: 1.012, x: -4, transformOrigin: '70% 70%' })
      .to('.echo-provenance-ticket', { y: -4, rotation: -2.5 }, '<')
    const kanshanStep = gsap.timeline({ repeat: -1, yoyo: true, delay: 2.75, defaults: { duration: .5, ease: 'sine.inOut' } })
      .to('.echo-provenance-set > img', { y: -5, rotation: 1.8 })

    return () => {
      intro.kill()
      threadFlow.kill()
      paperBreath.kill()
      kanshanStep.kill()
    }
  }, { scope: theatreRef, dependencies: [provenanceOpen, activeCode, sceneIndex, motionEnabled], revertOnUpdate: true })

  const chooseRoute = (code: UniverseCode) => {
    setActiveCode(code)
    setLetterIndex(0)
    setDrawCount(1)
  }

  const chooseScene = (index: number) => {
    if (index === sceneIndex || index > unlockedScenes[activeCode]) return
    setIsTravelling(true)
    window.setTimeout(() => {
      setSceneIndex(index)
      setLetterIndex(index % Math.max(1, letters.length))
      setIsTravelling(false)
    }, motionEnabled ? 850 : 0)
  }

  const chooseReality = (choice: { id: string; label: string; cost: string; consequence: string }) => {
    if (isTravelling) return
    setDecisions((current) => ({ ...current, [decisionKey]: choice }))
    setUnlockedScenes((current) => ({ ...current, [activeCode]: Math.max(current[activeCode], Math.min(route.scenes.length - 1, sceneIndex + 1)) }))
    setIsTravelling(true)
    window.setTimeout(() => {
      setSceneIndex((current) => Math.min(route.scenes.length - 1, current + 1))
      setLetterIndex((current) => (current + 1) % Math.max(1, letters.length))
      setIsTravelling(false)
    }, motionEnabled ? 1400 : 0)
  }

  const drawNextLetter = () => {
    setLetterIndex((current) => (current + 1) % Math.max(1, letters.length))
    setDrawCount((current) => current + 1)
  }

  return (
    <main className="echo-theatre" ref={theatreRef} style={{ '--echo': route.color } as CSSProperties}>
      <header className="echo-theatre-nav">
        <button className="logo-button" onClick={onBack}><Logo compact /></button>
        <div><span>REALITY ECHO THEATRE</span><b>真人经历不是答案，是来自另一条时间线的回声。</b></div>

      </header>

      <section className="echo-theatre-shell">
        <div className={`echo-stage-scene echo-scene-${route.code.toLowerCase()} echo-beat-${sceneIndex} ${motionEnabled ? 'is-playing' : 'is-paused'} ${isTravelling ? 'is-travelling' : 'is-arrived'} ${scene.choices.length ? 'has-choice' : ''}`}>
          <div className="echo-scene-bg" style={{ backgroundImage: `url(${route.journeyImage})`, '--scene-x': `${sceneIndex * 33.333}%` } as CSSProperties} aria-hidden="true" />
          <div className="echo-scene-shade" aria-hidden="true" />
          <svg className="echo-light-river" viewBox="0 0 1000 520" preserveAspectRatio="none" aria-hidden="true">
            <path className="echo-light-river-halo" d="M-80 420 C150 345 230 470 430 354 S720 218 1080 278" />
            <path className="echo-light-river-core" d="M-80 420 C150 345 230 470 430 354 S720 218 1080 278" />
          </svg>
          <div className="echo-paper-depth" aria-hidden="true"><i /><i /><i /></div>
          <div className="echo-particles" aria-hidden="true">
            {Array.from({ length: 9 }, (_, index) => <i key={index} style={{ '--particle': index } as CSSProperties} />)}
          </div>
        <button className="echo-provenance-trigger echo-stage-provenance" type="button" onClick={() => setProvenanceOpen(true)} aria-label="查看当前剧情的来源与改编边界">
          <Info size={20} />
          <span><b>这幕从哪来？</b><small>原文与改编边界</small></span>
        </button>
          <figure className="echo-kanshan-guide" aria-label={isTravelling ? '刘看山正在走向下一幕' : route.motionLabel}>
            <img loading="lazy" decoding="async" key={isTravelling ? 'walking' : `${route.code}-${sceneIndex}`} src={isTravelling ? '/kanshan-stroll.gif' : route.motion} alt={isTravelling ? '正在走动的刘看山' : '正在活动的刘看山'} />
            <figcaption><i /> {isTravelling ? '正在前往下一幕…' : `DAY ${scene.day} · ${scene.label}`}</figcaption>
          </figure>
          <div className="echo-stage-copy">
            <span>宇宙 {route.code} · {route.title} · 第 {sceneIndex + 1} 幕</span>
            <h1 key={`${activeCode}-${sceneIndex}`}>{scene.title.replace('，', '，\n')}</h1>
            <p>{sceneNarrative}</p>
            <div className="echo-tradeoff">
              <div><small>模拟情境记录 · 非真人实测</small><strong>{scene.recordA}</strong></div>
              <i />
              <div><small>现实约束</small><strong>{scene.recordB}</strong></div>
            </div>
          </div>
          {scene.choices.length > 0 && !isTravelling && (
            <aside className="echo-choice-dock">
              <header><span>必须取舍</span><b>这一次不能两边都要</b></header>
              {scene.choices.map((choice) => (
                <button type="button" className={currentDecision?.id === choice.id ? 'selected' : ''} onClick={() => chooseReality(choice)} key={choice.id}>
                  <span>{choice.label}</span><small>代价：{choice.cost}</small><ArrowRight size={14} />
                </button>
              ))}
            </aside>
          )}
          <div className="echo-stage-stamp"><span>{scene.day}</span><small>DAYS<br />LATER</small></div>
          <button
            className="echo-motion-toggle"
            type="button"
            aria-pressed={motionEnabled}
            onClick={() => setMotionEnabled((current) => !current)}
          >
            {motionEnabled ? <Pause size={12} weight="fill" /> : <Play size={12} weight="fill" />}
            {motionEnabled ? '动效已开启' : '继续播放'}
          </button>
          <nav className="echo-scene-timeline" aria-label="职业宇宙剧情时间线">
            {route.scenes.map((item, index) => (
              <button type="button" disabled={index > unlockedScenes[activeCode]} className={index === sceneIndex ? 'active' : index < sceneIndex ? 'passed' : ''} onClick={() => chooseScene(index)} key={item.day} aria-label={`前往第 ${item.day} 天：${item.label}`}>
                <i /><span>DAY {item.day}</span><b>{item.label}</b>
              </button>
            ))}
          </nav>
        </div>

        <nav className="echo-portals" aria-label="选择现实回声宇宙">
          {echoTheatreRoutes.map((item) => (
            <button className={item.code === activeCode ? 'active' : ''} type="button" onClick={() => chooseRoute(item.code)} key={item.code}>
              <span>{item.code}</span><b>{item.title}</b><small>{item.verb}</small><i style={{ background: item.color }} />
            </button>
          ))}
        </nav>

        <aside className="echo-letter-desk">
          <div className="echo-letter-topline"><span><Quote size={15} />{liveLoading ? '正在接收知乎实时回声…' : realtimeLetters.length ? '从知乎实时抽到一封来信' : '从知乎档案抽到一封来信'}</span><small>{letterIndex + 1} / {letters.length}</small></div>
          {letter && (
            <div className="echo-letter" key={`${activeCode}-${letterIndex}`}>
              <ZhihuPost author={letter.author} title={letter.title} summary={letter.excerpt} badge={letter.badge || '知乎答主'} sourceUrl={letter.sourceUrl} votes={letter.votes} live={realtimeLetters.length > 0} />
            </div>
          )}
          {liveError && <div className="echo-live-fallback"><Info size={13} />实时检索未接通，当前展示可核验档案样本。</div>}
          <div className="echo-provocation"><Sparkles size={16} /><span><small>围绕你的核心问题</small>{coreQuestion}</span></div>
          <button className="echo-draw" type="button" onClick={drawNextLetter}><span>再抽一封不同经历</span><ArrowRight size={17} /></button>
        </aside>
      </section>

      <footer className="echo-theatre-footer">
        <div><span>你的现实坐标</span><b>{situationLabels.identity[situation.identity]} × {situationLabels.intent[situation.intent]} × {situationLabels.time[situation.time]}</b></div>
        <button type="button" onClick={onBack}><ArrowLeft size={16} />带着回声，回到三个未来争论</button>
        {gapBranch && <button type="button" onClick={() => setModalBranch(gapBranch)}><Sprout size={16} />我也走过一段路{pending ? ` · ${pending} 条待核验` : ''}</button>}
      </footer>

      {provenanceOpen && letter && (
        <div
          className="echo-provenance-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setProvenanceOpen(false)
          }}
        >
          <article className="echo-provenance-card" role="dialog" aria-modal="true" aria-labelledby="echo-provenance-title">
            <button className="echo-provenance-close" type="button" onClick={() => setProvenanceOpen(false)} aria-label="合上场景背面">
              <X size={18} />
            </button>
            <button className="echo-provenance-motion" type="button" aria-label={motionEnabled ? '暂停连续动画' : '播放连续动画'} aria-pressed={motionEnabled} onClick={() => setMotionEnabled((current) => !current)}>
              {motionEnabled ? <Pause size={13} weight="fill" /> : <Play size={13} weight="fill" />}
            </button>
            <div className="echo-provenance-art">
              <div className="echo-provenance-set" style={{ backgroundImage: `url(${route.journeyImage})` }} aria-hidden="true">
                <i /><i /><i />
                <span>DAY {scene.day}</span>
                <img src={route.motion} alt="" />
              </div>

              <svg className="echo-provenance-red-thread" viewBox="0 0 1000 560" preserveAspectRatio="none" aria-hidden="true">
                <path className="echo-thread-base" pathLength="1" d="M250 438 C420 515 520 472 455 392 C390 312 565 349 585 282 C604 216 685 280 768 196" />
                <path className="echo-thread-pulse" pathLength="1" d="M250 438 C420 515 520 472 455 392 C390 312 565 349 585 282 C604 216 685 280 768 196" />
              </svg>
              <svg className="echo-provenance-red-thread-mobile" viewBox="0 0 390 844" preserveAspectRatio="none" aria-hidden="true">
                <path className="echo-thread-base" pathLength="1" d="M42 454 C118 422 168 488 126 548 C84 607 188 650 224 570 C257 496 188 431 286 352" />
                <path className="echo-thread-pulse" pathLength="1" d="M42 454 C118 422 168 488 126 548 C84 607 188 650 224 570 C257 496 188 431 286 352" />
              </svg>

              <section className="echo-provenance-ticket">
                <div className="echo-provenance-ticket-author">
                  <span className={letter.avatarUrl ? 'has-avatar' : ''}>{letter.avatarUrl && <img loading="lazy" decoding="async" src={letter.avatarUrl} alt={`${letter.author}的知乎头像`} referrerPolicy="no-referrer" onError={(event) => { event.currentTarget.style.display = 'none' }} />}<i>{letter.author.slice(0, 1)}</i></span><b>{letter.author}</b><em>真实</em>
                </div>
                <blockquote>“{letter.title}”</blockquote>
              </section>

              <a className="echo-provenance-link" href={letter.sourceUrl} target="_blank" rel="noreferrer">查看知乎原文 <ArrowSquareOut size={14} /></a>

              <section className="echo-provenance-event">
                <h2 id="echo-provenance-title">{scene.title}</h2>
                <span>推演</span>
              </section>
            </div>
          </article>
        </div>
      )}

      {modalBranch && <ContributionModal branch={modalBranch} onClose={() => setModalBranch(null)} onSubmit={async (draft) => { await onAddContribution(modalBranch.id, draft); setModalBranch(null) }} />}
    </main>
  )
}

function Workspace({
  onBack,
  onOpenMethod,
  onAddContribution,
  contributions,
  situation,
}: {
  onBack: () => void
  onOpenMethod: () => void
  onAddContribution: (branchId: string, draft: ContributionDraft) => Promise<ContributionReceipt>
  contributions: ContributionReceipt[]
  situation: Situation
}) {
  const workspaceRef = useRef<HTMLElement>(null)
  const question = questions[0]
  const defaultBranch = flattenBranches(question.branches).find((branch) => branch.status === 'gap')
    ?? question.branches.find((branch) => branch.children)?.children?.[0]
    ?? question.branches[0]
  const [selectedId, setSelectedId] = useState(defaultBranch.id)
  const [mode, setMode] = useState<WorkspaceMode>('tree')
  const [modalBranch, setModalBranch] = useState<Branch | null>(null)
  const [showReceipt, setShowReceipt] = useState(false)
  const [toast, setToast] = useState('')

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 3200)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    if (!showReceipt) return
    const timer = window.setTimeout(() => setShowReceipt(false), 3000)
    return () => window.clearTimeout(timer)
  }, [showReceipt])

  useGSAP(() => {
    const mm = gsap.matchMedia()
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      const timeline = gsap.timeline({ defaults: { duration: 0.62, ease: 'power3.out' } })
      timeline
        .from('.field-header > *', { autoAlpha: 0, y: -18, stagger: 0.05 }, 0)
        .from('.field-context', { autoAlpha: 0, y: -14 }, 0.1)
        .from('.world-heading > *', { autoAlpha: 0, y: 22, stagger: 0.06 }, 0.18)
        .from('.field-map-shell', { autoAlpha: 0, scale: 0.975, transformOrigin: 'center center' }, 0.24)
        .from('.branch-panel', { autoAlpha: 0, x: 30 }, 0.32)
        .from('.journey-rail > *', { autoAlpha: 0, y: 15, stagger: 0.05 }, 0.38)
      return () => timeline.kill()
    })
    return () => mm.revert()
  }, { scope: workspaceRef })

  useGSAP(() => {
    gsap.fromTo(
      '.branch-panel-body > *',
      { autoAlpha: 0, x: 12 },
      { autoAlpha: 1, x: 0, duration: 0.35, stagger: 0.035, ease: 'power2.out' },
    )
  }, { scope: workspaceRef, dependencies: [selectedId], revertOnUpdate: true })

  useGSAP(() => {
    gsap.fromTo(
      '.map-canvas > *',
      { autoAlpha: 0, scale: 0.992 },
      { autoAlpha: 1, scale: 1, duration: 0.42, ease: 'power2.out' },
    )
  }, { scope: workspaceRef, dependencies: [mode], revertOnUpdate: true })

  const branches = question.branches
  const pendingCounts = useMemo(() => contributions.reduce<Record<string, number>>((counts, item) => {
    counts[item.branchId] = (counts[item.branchId] ?? 0) + 1
    return counts
  }, {}), [contributions])

  const allBranches = flattenBranches(branches)
  const selected = allBranches.find((branch) => branch.id === selectedId) ?? allBranches[0]
  const currentCoverage = question.coverage
  const situationReading = getSituationReading(situation)

  const selectBranch = (branch: Branch) => setSelectedId(branch.id)
  const submitContribution = async (draft: ContributionDraft) => {
    if (!modalBranch) return
    await onAddContribution(modalBranch.id, draft)
    setSelectedId(modalBranch.id)
    setModalBranch(null)
    setShowReceipt(true)
    setToast('案例已送达审核队列，本设备已保存收据')
  }

  return (
    <main className={`field-workspace ${showReceipt ? 'is-celebrating' : ''}`} ref={workspaceRef}>
      <header className="field-header">
        <button className="logo-button" onClick={onBack}><Logo compact /></button>
        <div className="field-header-question">
          <span>人生选择 · 编程与本专业</span>
          <strong>{question.title}</strong>
        </div>
        <button className="method-entry workspace-method-entry" type="button" onClick={onOpenMethod} aria-label="打开研究方法账本"><FileSearch size={14} /><span>方法账本</span></button>
        <div className="field-coverage-summary">
          <div><span>问题覆盖率</span><strong>{currentCoverage}<small>%</small></strong></div>
          <i><b style={{ width: `${currentCoverage}%` }} /></i>
        </div>
        <button className="back-button" onClick={onBack}><ArrowLeft size={16} />修改我的处境</button>
      </header>

      <section className="field-context" aria-label="当前处境">
        <span>你的观察位置</span>
        <div>
          <b>{situationLabels.identity[situation.identity]}</b><i>×</i>
          <b>{situationLabels.intent[situation.intent]}</b><i>×</i>
          <b>{situationLabels.time[situation.time]}</b>
        </div>
        <p><strong>{situationReading.directMatches}</strong> 条完全同境回答 · <strong>{situationReading.nearby}</strong> 条相邻观点</p>
        <span className="context-live"><i />公开来源链接已保留</span>
      </section>

      <section className="field-world">
        <div className="world-heading">
          <span>02 / 看见答案没有覆盖谁</span>
          <h1>{selected.status === 'gap' ? '答案在这里断掉了。' : '这条建议，适合你的处境吗？'}</h1>
          <p>{selected.status === 'gap'
            ? '类似建议不少，但还没找到条件都对得上的经历。灰黑节点标出了这些缺口。'
            : '点击任意分支，查看它背后的原文证据，以及哪些背景仍然未知。'}</p>
        </div>

        <div className="field-view-toggle view-toggle" role="group" aria-label="切换展示方式">
          <button className={mode === 'tree' ? 'active' : ''} onClick={() => setMode('tree')}><GitBranch size={15} />观点地形</button>
          <button className={mode === 'matrix' ? 'active' : ''} onClick={() => setMode('matrix')}><Layers3 size={15} />覆盖切片</button>
        </div>

        <div className="field-map-shell">
          <div className="map-scale" aria-hidden="true"><span>观点密度</span><i /><span>情境深度</span></div>
          <div className="map-canvas">
            {mode === 'tree' ? (
              <TreeView branches={branches} questionTitle={question.title} selected={selectedId} pendingCounts={pendingCounts} onSelect={selectBranch} />
            ) : (
              <MatrixView branches={branches} pendingCounts={pendingCounts} onSelect={selectBranch} />
            )}
          </div>
          {mode === 'tree' && (
            <div className="map-gesture-hint" aria-hidden="true">
              <ArrowLeft size={12} /><span>左右拖动地形</span><ArrowRight size={12} />
            </div>
          )}
          <div className="field-map-caption">
            <span className="live-dot" />{question.answerCount} 条公开样本已按成立条件归位
            <b><span className="desktop-caption-copy">点击节点改变观察位置</span><span className="mobile-caption-copy">拖动地形 · 点击节点</span></b>
          </div>
        </div>

        <BranchPanel
          branch={selected}
          onClaim={() => setModalBranch(selected)}
          pendingCount={pendingCounts[selected.id] ?? 0}
        />
      </section>

      <footer className="journey-rail" aria-label="体验步骤">
        <div className="done"><span>01</span><p><b>放入处境</b><small>让问题与你有关</small></p><Check size={15} /></div>
        <i />
        <div className="done"><span>02</span><p><b>看见空白</b><small>0 条完全同境回答</small></p><Check size={15} /></div>
        <i />
        <div className={contributions.length ? 'done' : 'active'}><span>03</span><p><b>贡献亲历</b><small>{contributions.length ? `${contributions.length} 张提交收据` : '只回答你知道的部分'}</small></p>{contributions.length ? <Check size={15} /> : <Sprout size={15} />}</div>
        <i />
        <div className={contributions.length ? 'active' : ''}><span>04</span><p><b>等待核验</b><small>审核后才让地图生长</small></p><Clock3 size={15} /></div>
      </footer>

      {modalBranch && <ContributionModal branch={modalBranch} onClose={() => setModalBranch(null)} onSubmit={submitContribution} />}
      {showReceipt && (
        <div className="knowledge-burst pending-receipt" role="status">
          <div className="burst-orbit" aria-hidden="true"><i /><i /><i /></div>
          <span>CASE RECEIVED / CLOUD REVIEW QUEUE</span>
          <strong>PENDING</strong>
          <h2>这块空白，收到了一条待核验案例。</h2>
          <p>案例已收到，审核前不会计入公开回答。这一处仍标为缺少案例。</p>
        </div>
      )}
      {toast && <div className="toast"><Check size={16} />{toast}</div>}
    </main>
  )
}

export default function App() {
  const [screen, setScreen] = useState<Screen>(() => window.location.hash === '#echo' ? 'workspace' : 'home')
  const [loading, setLoading] = useState(false)
  const [situation, setSituation] = useState<Situation>(LIVE_AI_ENABLED ? defaultSituation : judgeDemoSituation)
  const [methodOpen, setMethodOpen] = useState(false)
  const [contributions, setContributions] = useState<ContributionReceipt[]>(readContributionReceipts)

  useEffect(() => {
    try {
      window.localStorage.setItem(contributionStorageKey, JSON.stringify(contributions))
    } catch {
      // The server is authoritative; local storage only keeps non-sensitive receipts.
    }
  }, [contributions])

  const analyze = (_id: string, _isExperimental = false, nextSituation = situation) => {
    setSituation(nextSituation)
    setScreen('workspace')
    window.history.replaceState(null, '', '#echo')
    setLoading(true)
    // Give the narrative handoff enough time to be understood, not just flashed.
    window.setTimeout(() => setLoading(false), 2200)
    window.scrollTo({ top: 0 })
  }

  const backHome = () => {
    setScreen('home')
    window.history.replaceState(null, '', window.location.pathname + window.location.search)
    window.scrollTo({ top: 0 })
  }

  const addContribution = async (branchId: string, draft: ContributionDraft) => {
    const response = await fetch('/api/contributions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ branchId, ...draft }),
    })
    const payload = await response.json().catch(() => null) as ContributionApiResponse | { error?: { message?: string } } | null
    if (!response.ok || !payload || !('contribution' in payload)) {
      throw new Error(payload && 'error' in payload && payload.error?.message
        ? payload.error.message
        : '审核队列暂时没有响应，请保留当前页面后重试。')
    }
    setContributions((current) => [...current, payload.contribution])
    return payload.contribution
  }

  return (
    <>
      <div style={{ display: screen === 'home' && !loading ? 'contents' : 'none' }}>
        <Home onAnalyze={analyze} onOpenMethod={() => setMethodOpen(true)} />
      </div>
      {loading && <LoadingAnalysis title={buildCoreQuestion(situation)} />}
      {screen === 'workspace' && !loading && (
        <RealityEchoTheatre
          situation={situation}
          contributions={contributions}
          onAddContribution={addContribution}
          onBack={backHome}
        />
      )}
      {methodOpen && <MethodologyDialog onClose={() => setMethodOpen(false)} pendingCount={contributions.length} />}
    </>
  )
}

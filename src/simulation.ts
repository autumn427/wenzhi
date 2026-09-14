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

const firstEvents: Record<UniverseCode, SimulationEvent> = {
  A: {
    id: 'a-day-30-critical-fork',
    day: 30,
    title: '今晚这 30 分钟，先用在哪里？',
    story: '手里的小工具遇到一个报错。你留出了 30 分钟，准备材料、操作和记录都算在内；到点就停，不挤占课程和休息。你既想让它能用，也想知道为什么出错。',
    tension: '先自己缩小问题，还是请 AI 提议修改、再亲自核对？两种做法都不保证今晚修好。',
    evidenceIds: ['real-002', 'real-003', 'real-007'],
    choices: [
      {
        id: 'repair-foundation',
        label: '缩小报错范围，只查一个必要知识点',
        tradeoff: '把 30 分钟用于复现、查阅与记录；暂不做修改，工具可能仍不能用。',
        delta: { technicalSkill: 0, portfolio: 0, energy: 0 },
        opens: ['foundation-rebuilt'],
        closes: ['fast-demo'],
      },
      {
        id: 'ship-with-help',
        label: '让 AI 提议一处修改，再逐项核对',
        tradeoff: '把 30 分钟用于整理问题、试改与核对；建议可能无效，理解仍待补充。',
        delta: { aiCollaboration: 0, portfolio: 0, energy: 0 },
        opens: ['fast-demo'],
        closes: ['foundation-rebuilt'],
      },
    ],
  },
  B: {
    id: 'b-day-30-brittle-prototype',
    day: 30,
    title: '原型能用，却经不起一次变化',
    story: '你用 AI 做出的工具第一次帮你省下两小时，但数据格式一改，整个流程立刻失效。',
    tension: '继续围绕真实任务迭代，还是先补一点足以排错的代码能力？',
    evidenceIds: ['real-005', 'real-009', 'real-013'],
    choices: [
      {
        id: 'learn-debugging',
        label: '花一周只学习排错与数据处理',
        tradeoff: '新功能先放着，花这周的时间弄懂数据为什么读不进来。',
        delta: { technicalSkill: 10, aiCollaboration: 6, portfolio: 4, energy: -7 },
        opens: ['debugging-literacy'],
        closes: ['feature-rush'],
      },
      {
        id: 'iterate-workflow',
        label: '继续用现成工具，先把任务做完',
        tradeoff: '产出更快，但复杂故障仍会依赖外部帮助。',
        delta: { aiCollaboration: 15, portfolio: 13, opportunity: 4, energy: -6 },
        opens: ['feature-rush'],
        closes: ['debugging-literacy'],
      },
    ],
  },
  C: {
    id: 'c-day-30-tool-anxiety',
    day: 30,
    title: '同伴用新工具提前交出了成果',
    story: '你在专业方法上投入更多，但同伴借助自动化工具更早完成了第一版展示。',
    tension: '守住专业深度，还是拿出少量时间补齐工具判断？',
    evidenceIds: ['real-001', 'real-004', 'real-010'],
    choices: [
      {
        id: 'protect-domain',
        label: '继续把时间押在专业判断上',
        tradeoff: '专业问题想得更透了，可眼前这份活，还是没别人交得快。',
        delta: { domainDepth: 16, confidence: 6, opportunity: 3, energy: -6 },
        opens: ['domain-moat'],
        closes: ['tool-literacy'],
      },
      {
        id: 'learn-tool-literacy',
        label: '每周拿两小时，试试这些工具',
        tradeoff: '暂时不学编程。你能说清想让工具做什么，也开始知道哪些结果要复查。',
        delta: { aiCollaboration: 9, technicalSkill: 4, domainDepth: 8, energy: -7 },
        opens: ['tool-literacy'],
        closes: ['domain-moat'],
      },
    ],
  },
}

function secondEvent(run: UniverseRun): SimulationEvent {
  const has = (flag: string) => run.flags.includes(flag)

  if (run.code === 'A' && run.decisions[0]?.eventSnapshot?.id === 'a-day-30-critical-fork') {
    const selfCheck = has('foundation-rebuilt')
    return {
      id: selfCheck ? 'a-day-90-reproduction-note' : 'a-day-90-patch-note', day: 90,
      title: selfCheck ? '留下了一份可复现的报错记录' : '留下了一份修改与核对记录',
      story: selfCheck
        ? '第90天，回看那晚的模拟记录：30分钟里，你保留了一个报错输入，记下相关代码和查过的知识点。代码没有修改，工具尚未修好；记录足以让下一次排查从具体问题开始，但不能证明已经找到原因。到点后你收起了电脑。'
        : '第90天，回看那晚的模拟记录：30分钟里，你整理了报错输入，让AI提议一处修改，并保存修改前后的片段及一次核对记录。是否适用于其他输入仍未验证，工具也未交付。到点后你收起了电脑，原版本保留着。',
      tension: selfCheck ? '这条线索能否解释报错？先核对一个新输入，还是缩小到一处可回退的修改？' : '这次修改是否引入其他问题？先核对一个新输入，还是缩小修改范围？',
      evidenceIds: [],
      choices: [
        { id: selfCheck ? 'finish-curriculum' : 'pay-tech-debt', label: '用一个新输入核对记录中的判断', tradeoff: '只核对一个判断，暂不扩展功能。', delta: { technicalSkill: 0, portfolio: 0 }, opens: ['verified-one-input'], closes: [] },
        { id: selfCheck ? 'take-internship' : 'ride-momentum', label: '只试一处可回退的修改并保留原版', tradeoff: '留出核对时间；无改善就退回原版。', delta: { technicalSkill: 0, portfolio: 0 }, opens: ['bounded-patch'], closes: [] },
      ],
    }
  }

  if (run.code === 'A') {
    if (has('foundation-rebuilt')) {
      return {
        id: 'a-day-90-internship-after-foundation', day: 90, title: '实习邀请来得比作品更早',
        story: '你的基础训练被一位学长注意到，他邀请你加入真实项目，但这会打断原定课程。',
        tension: '机会已经递到面前。现在去做项目，没学完的课怎么办？', evidenceIds: ['real-008', 'real-022'],
        choices: [
          { id: 'take-internship', label: '接受实习，把学习搬进项目', tradeoff: '能参与项目了，课程却得放慢；两头赶，确实累。', delta: { opportunity: 20, portfolio: 15, technicalSkill: 7, energy: -18 }, opens: ['industry-mentor'], closes: ['complete-curriculum'] },
          { id: 'finish-curriculum', label: '婉拒邀请，完成系统课程', tradeoff: '课程能继续学完，只是这次跟人做项目的机会就过去了。', delta: { technicalSkill: 17, confidence: 8, opportunity: -3, energy: -9 }, opens: ['complete-curriculum'], closes: ['industry-mentor'] },
        ],
      }
    }
    return {
      id: 'a-day-90-demo-debt', day: 90, title: '演示过了，藏着的毛病没过去',
      story: '作品获得了第一次公开反馈，但一次关键故障暴露出你对底层逻辑并不熟悉。',
      tension: '有人想继续用，可旧问题还没修。先停下来修，还是继续发新版？', evidenceIds: ['real-003', 'real-020'],
      choices: [
        { id: 'pay-tech-debt', label: '冻结功能，重构关键部分', tradeoff: '这阵子没新东西可展示了，但关键代码终于敢动了。', delta: { technicalSkill: 15, portfolio: 5, confidence: 7, energy: -13 }, opens: ['debt-repaid'], closes: ['public-momentum'] },
        { id: 'ride-momentum', label: '继续发布，遇到问题再补', tradeoff: '作品与机会增长更快，但故障风险被带到下一阶段。', delta: { portfolio: 18, opportunity: 13, aiCollaboration: 7, energy: -14 }, opens: ['public-momentum'], closes: ['debt-repaid'] },
      ],
    }
  }

  if (run.code === 'B') {
    if (has('debugging-literacy')) {
      return {
        id: 'b-day-90-team-adoption', day: 90, title: '团队想用你的工具',
        story: '原本只服务你自己的工具开始被同伴采用，你第一次需要处理别人的错误输入。',
        tension: '给大家用，出了问题就得管。你愿意接下这件事吗？', evidenceIds: ['real-014', 'real-016', 'real-017'],
        choices: [
          { id: 'productize', label: '把工具做成团队可用版本', tradeoff: '获得真实用户与作品，但承担维护和沟通成本。', delta: { portfolio: 20, opportunity: 14, technicalSkill: 7, energy: -17 }, opens: ['team-product'], closes: ['private-tool'] },
          { id: 'keep-private', label: '保留私人版本，继续优化本职任务', tradeoff: '自己用着省事，也不用随时回答问题；简历上却少了一项团队项目。', delta: { aiCollaboration: 14, domainDepth: 8, energy: -5 }, opens: ['private-tool'], closes: ['team-product'] },
        ],
      }
    }
    return {
      id: 'b-day-90-complex-failure', day: 90, title: 'AI 改了三遍，还是跑不起来',
      story: '快速增加的功能互相冲突，AI 给出三种修复方案，却没有一种能稳定运行。',
      tension: '找技术伙伴协作，还是缩小问题重新构建？', evidenceIds: ['real-018', 'real-019', 'real-021'],
      choices: [
        { id: 'find-partner', label: '邀请技术伙伴共同维护', tradeoff: '有人一起修了，改什么、什么时候发，也得两个人商量。', delta: { opportunity: 13, portfolio: 12, aiCollaboration: 6, energy: -7 }, opens: ['technical-partner'], closes: ['smaller-scope'] },
        { id: 'cut-scope', label: '砍掉一半功能，自己重建核心', tradeoff: '做过的一半功能先扔掉。留下的部分，至少自己能看懂、能改。', delta: { technicalSkill: 9, confidence: 8, portfolio: 7, energy: -10 }, opens: ['smaller-scope'], closes: ['technical-partner'] },
      ],
    }
  }

  if (has('domain-moat')) {
    return {
      id: 'c-day-90-specialist-offer', day: 90, title: '导师推荐了一个项目，你犹豫了',
      story: '你的专业判断被导师认可，但岗位要求你与技术团队频繁协作，而不是独立完成全部工作。',
      tension: '接受跨团队角色，还是继续积累更纯粹的专业成果？', evidenceIds: ['real-004', 'real-010', 'real-012'],
      choices: [
        { id: 'bridge-role', label: '接受跨团队角色', tradeoff: '你的专业用得上了，可要让技术同事听懂，还得花时间磨合。', delta: { opportunity: 19, domainDepth: 10, aiCollaboration: 7, energy: -12 }, opens: ['bridge-specialist'], closes: ['solo-depth'] },
        { id: 'solo-depth', label: '继续完成专业成果', tradeoff: '手里的专业成果能接着做，这次跨团队项目就先错过了。', delta: { domainDepth: 18, confidence: 9, opportunity: -2, energy: -8 }, opens: ['solo-depth'], closes: ['bridge-specialist'] },
      ],
    }
  }
  return {
    id: 'c-day-90-collaboration-test', day: 90, title: '代码没写，团队却少走了弯路',
    story: '你没有亲自写核心代码，却通过明确问题和验收标准避免了团队走错方向。',
    tension: '大家以后还想找你协调。你愿意多接这类活，还是到此为止？', evidenceIds: ['real-001', 'real-004', 'real-012'],
    choices: [
      { id: 'become-bridge', label: '主动承担跨专业协作', tradeoff: '更多项目会来找你，留给自己钻研的时间也更少。', delta: { opportunity: 17, aiCollaboration: 12, domainDepth: 8, energy: -11 }, opens: ['bridge-specialist'], closes: ['quiet-expertise'] },
      { id: 'quiet-expertise', label: '只保留必要协作，继续深耕', tradeoff: '能继续专心做自己的事；你帮过的那些忙，外人未必知道。', delta: { domainDepth: 17, confidence: 7, energy: -6 }, opens: ['quiet-expertise'], closes: ['bridge-specialist'] },
    ],
  }
}

function thirdEvent(run: UniverseRun): SimulationEvent {
  const has = (flag: string) => run.flags.includes(flag)
  if (run.code === 'A' && run.decisions[0]?.eventSnapshot?.id === 'a-day-30-critical-fork') {
    const checked = has('verified-one-input')
    return { id: 'a-day-150-bounded-review', day: 150, title: checked ? '一份输入，仍有解释不了的地方' : '一处修改，还不能替所有输入作答',
      story: checked ? '第150天，回看这次模拟核对：你把一个新输入的现象记在原来的报错旁。两次记录可以对照，但还没有足够线索确认同一个原因，工具的适用范围仍待验证。'
        : '第150天，回看这次模拟试改：你保留了原版和修改版，把待核对的问题列在旁边。一处修改不能说明其他输入都能通过，是否保留它仍取决于后续核对。',
      tension: '先把已有线索写清楚，还是请愿意帮忙的人核对一个问题？', evidenceIds: [], choices: [
        { id: 'finish-capstone', label: '把已有记录整理成一页说明', tradeoff: '只整理现有线索，不增加功能或宣称已经修好。', delta: { portfolio: 0, technicalSkill: 0 }, opens: ['bounded-summary'], closes: [] },
        { id: 'seek-real-feedback', label: '请愿意帮忙的人核对一个具体问题', tradeoff: '准备清楚问题与材料；对方是否有空、能否解决仍未知。', delta: { opportunity: 0, technicalSkill: 0 }, opens: ['bounded-feedback-request'], closes: [] },
      ] }
  }

  if (run.code === 'A') {
    const outwardMomentum = has('industry-mentor') || has('public-momentum')
    return {
      id: 'a-day-150-peer-gap',
      day: 150,
      title: outwardMomentum ? '机会变多了，你却开始失去学习节奏' : '同伴的作品开始超过你',
      story: outwardMomentum
        ? '项目、反馈和邀请同时涌来，你的履历更好看了，但已经三周没有完整梳理一个基础问题。'
        : '你能解释越来越多底层问题，但同伴已经发布了第二个公开作品。你第一次怀疑“准备好再出现”是否太晚。',
      tension: '就这么走下去，还是腾点时间，补上一直拖着的那件事？',
      evidenceIds: ['real-003', 'real-008', 'real-022'],
      choices: [
        { id: 'finish-capstone', label: '收束范围，完成一个可公开的完整作品', tradeoff: '先把学过的做成一件完整作品，新课暂时不追了。', delta: { portfolio: 18, technicalSkill: 7, confidence: 8, energy: -12 }, opens: ['finished-capstone'], closes: ['keep-expanding-foundation'] },
        { id: 'seek-real-feedback', label: '找人一起做，看看自己差在哪儿', tradeoff: '终于有人看你的成果了；被问住的时候，也没法再躲回课程里。', delta: { opportunity: 17, portfolio: 11, confidence: 4, energy: -14 }, opens: ['real-feedback-loop'], closes: ['protected-study-rhythm'] },
      ],
    }
  }

  if (run.code === 'B') {
    const sharedTool = has('team-product') || has('technical-partner')
    return {
      id: 'b-day-150-trust-test',
      day: 150,
      title: sharedTool ? '越来越多人依赖它，错误也不再只属于你' : '工具稳定了，但别人仍不敢把任务交给它',
      story: sharedTool
        ? '一次异常输出影响了同伴的工作。大家认可工具的价值，也第一次追问：谁负责检查、回滚和解释？'
        : '你的流程已经适合自己使用，但面对新用户和新数据时，你仍无法证明它会在哪里失效。',
      tension: '把可靠性与边界写进产品，还是主动限制它的使用范围？',
      evidenceIds: ['real-014', 'real-018', 'real-021'],
      choices: [
        { id: 'build-guardrails', label: '补测试、回滚和人工复核规则', tradeoff: '新功能做得慢了，但别人问出错怎么办，你终于能给个交代。', delta: { technicalSkill: 9, portfolio: 13, confidence: 10, energy: -13 }, opens: ['verified-guardrails'], closes: ['unchecked-growth'] },
        { id: 'bound-the-tool', label: '缩小承诺，只服务最确定的任务', tradeoff: '用的人会少一些。好处是少救几次火，也能喘口气。', delta: { domainDepth: 10, aiCollaboration: 7, energy: 6, opportunity: -4 }, opens: ['bounded-automation'], closes: ['general-purpose-tool'] },
      ],
    }
  }

  const visibleBridge = has('bridge-specialist') || has('become-bridge')
  return {
    id: 'c-day-150-visibility-choice',
    day: 150,
    title: visibleBridge ? '团队开始依赖你的判断，但成果署名里看不见它' : '专业更深了，机会却开始绕过你',
    story: visibleBridge
      ? '项目少走了很多弯路，但外部只看见最终系统。你必须决定，怎样让不可见的专业判断成为可展示的成果。'
      : '你的判断仍然可靠，但需要跨团队协作的新机会开始流向更会表达边界与验收条件的人。',
    tension: '把专业判断写成可复用规则，还是通过搭档让它进入更大的项目？',
    evidenceIds: ['real-001', 'real-004', 'real-012'],
    choices: [
      { id: 'codify-domain-rules', label: '整理案例，把判断写成可验证规则', tradeoff: '能拿出一份属于自己的成果，新任务得先推掉几件。', delta: { domainDepth: 14, portfolio: 16, confidence: 8, energy: -11 }, opens: ['codified-expertise'], closes: ['invisible-craft'] },
      { id: 'pair-with-builder', label: '寻找技术搭档，共同完成一次交付', tradeoff: '能一起做更大的项目，署名和决定权也要一起分。', delta: { opportunity: 16, aiCollaboration: 10, domainDepth: 8, energy: -9 }, opens: ['durable-partnership'], closes: ['solo-ownership'] },
    ],
  }
}

function applyNarrative(event: SimulationEvent, overrides?: Record<string, NarrativeOverride>) {
  const override = overrides?.[event.id]
  return override ? { ...event, ...override } : event
}

function ending(run: UniverseRun): SimulationEvent {
  if (run.code === 'A' && run.decisions[0]?.eventSnapshot?.id === 'a-day-30-critical-fork') {
    const summary = run.flags.includes('bounded-summary')
    return { id: 'a-day-180-bounded-ending', day: 180, title: summary ? '纸上多了一份可以接着看的说明' : '把一个具体问题交到对方手边',
      story: summary ? '你把输入、试过的办法和仍然不明白的地方排在一页纸上。空白处没有写“已经解决”，只留着下一次核对的位置。小工具还在原来的文件夹里；合上电脑前，你把这页说明放到了它旁边。'
        : '你把想请教的问题缩成一句，附上输入和已有记录，发给愿意帮忙的人。消息还没有回复，工具也没有因此变成成品。你保留了原版，在笔记末尾写下准备核对的那一处，停了下来。',
      tension: '这次留下的记录，哪一步值得在现实中亲自验证？', choices: [], evidenceIds: [] }
  }
  const has = (flag: string) => run.flags.includes(flag)
  let title: string
  let story: string
  if (run.code === 'A') {
    const opening = has('industry-mentor')
      ? '实习里遇到的那个问题，后来被你留在了项目笔记的第一页。'
      : has('public-momentum') ? '最初发出去的那个小项目，已经改过好几轮。'
      : '半年前跟着教程敲下的代码，如今有几处被你删掉，换成了自己写的。'
    title = has('finished-capstone') ? '这次，链接可以发出去了' : '屏幕那头，有人打开了你的项目'
    story = opening + (has('finished-capstone')
      ? '最后一次检查，你从头跑完了演示，把还没做的功能划出这一版，连同使用说明一起发了出去。收藏夹里还有没看完的课程，今晚却没有再打开。'
      : '你把项目发给一起做事的人，对方问起一处实现，你讲到一半卡住了。这次没有关掉窗口回去找新课，而是打开代码，把那一段指给对方看。笔记里又多了一个问号，旁边记着你们刚试过的办法。')
  } else if (run.code === 'B') {
    const opening = has('team-product') || has('technical-partner')
      ? '那个起初只替你省事的小工具，如今也装在了同伴的电脑上。'
      : '你又拿一份工作里要用的数据，跑了一遍自己的小工具。'
    title = has('verified-guardrails') ? '报错停在了交付之前' : '只留下用得上的那一部分'
    story = opening + (has('verified-guardrails')
      ? '这次输入有误时，流程停了下来，没有照常吐出一份看似正确的结果。你对着检查清单复核，再退回上一版。想加的新功能还躺在待办里，使用说明末尾却终于写清了出错后该怎么处理。'
      : '你删去了没把握的入口，在说明里写下它能处理的数据范围。碰到范围外的任务，仍然得自己做。关掉窗口时，今天要交的那份结果已经核对完，待办里也不再挂着“什么都能处理”那一项。')
  } else {
    const opening = has('bridge-specialist')
      ? '这几个月开会时反复解释的问题，被你一条条留了下来。'
      : '桌上摊着这几个月积下的案例，有些看起来相似，处理办法却不同。'
    title = has('codified-expertise') ? '翻到这一页，就能看到理由' : '交付文件里，留下了两个人的修改'
    story = opening + (has('codified-expertise')
      ? '你挑出几个容易弄错的地方，把判断理由和例外写在旁边，再拿旧案例逐条核对。为了收完这份材料，新任务暂时没接。合上文档前，你给还说不清的一处留了空白，没有硬凑出一条规则。'
      : '交付前，你和技术搭档又对了一遍：哪些结果能用，哪些仍要人工确认。文件里既有对方的实现，也有你改过的验收条件。署名栏放着两个人的名字，那些原先只在你脑子里的判断，如今能在交付文件中找到。')
  }
  return {
    id: `${run.code.toLowerCase()}-day-180-ending`, day: 180, title, story,
    tension: '',
    evidenceIds: run.code === 'A' ? ['real-003', 'real-008'] : run.code === 'B' ? ['real-014', 'real-021'] : ['real-004', 'real-012'],
    choices: [],
  }
}

// Refresh only recognized built-in endings; keep generated stories and all saved decisions.
export function refreshLegacyEnding(run: UniverseRun): UniverseRun {
  const event = run.currentEvent
  if (event.day !== 180 || event.generatedFrom || event.generationSource ||
      run.decisions.some((decision) => decision.actionOutcome) ||
      run.narrativeOverrides?.[event.id]) return run
  if (!event.story.startsWith('回头看，每次选择都把你往这条路上推了一点。') &&
      !event.story.startsWith('半年的时间没有让所有问题都有答案，却让')) return run
  return { ...run, currentEvent: ending(run) }
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
  'repair-foundation': ['finish-curriculum', 'finish-capstone'],
  'ship-with-help': ['ride-momentum', 'seek-real-feedback'],
  'learn-debugging': ['productize', 'build-guardrails'],
  'iterate-workflow': ['find-partner', 'bound-the-tool'],
  'protect-domain': ['solo-depth', 'codify-domain-rules'],
  'learn-tool-literacy': ['become-bridge', 'pair-with-builder'],
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
  return `wenzhi:simulation:${profile.identity}:${profile.intent}:${profile.time}:${(hash >>> 0).toString(36)}:v3`
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

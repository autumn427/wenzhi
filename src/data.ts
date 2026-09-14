import realAnswerSeed from '../research/real-answer-seed.json'

export type BranchStatus = 'covered' | 'thin' | 'gap'

export interface Evidence {
  id?: string
  author: string
  badge: string
  conclusion: string
  quote: string
  support: string
  votes: number
  sourceUrl?: string
  sourceTitle?: string
  sourceAccess?: 'full' | 'search-snippet'
  confidence?: 'high' | 'medium' | 'low'
  publishedAt?: string | null
  paraphrased?: boolean
  directExperience?: boolean
  riskFlags?: string[]
}

export interface Branch {
  id: string
  label: string
  shortLabel?: string
  description: string
  status: BranchStatus
  answerCount: number
  evidenceCount: number
  path: string[]
  insight: string
  unknown?: string
  taskType?: string
  taskPrompt?: string
  evidence: Evidence[]
  children?: Branch[]
}

export interface Question {
  id: string
  title: string
  kicker: string
  answerCount: number
  evidenceCount: number
  branchCount: number
  coverage: number
  updated: string
  sourceMode?: 'real' | 'demo'
  tags: string[]
  axes: { name: string; detail: string }[]
  branches: Branch[]
}

const commonEvidence = {
  support: '个人经历 · 原文明确说明情境',
  votes: 1248,
}

const realSourcePages = new Map(realAnswerSeed.sourcePages.map((page) => [page.id, page]))
const realAnswerRecords = new Map(realAnswerSeed.records.map((record) => [record.id, record]))

const sourceVoiceProfiles: Record<string, { author: string; avatarUrl?: string }> = {
  'page-college-non-cs': {
    author: '程序员碎碎念',
    avatarUrl: 'https://picx.zhimg.com/50/3d402efae81423a712418f5390b1967c_l.jpg?source=26029b8c',
  },
  'page-management-c-or-python': {
    author: '九天揽日',
    avatarUrl: 'https://pic1.zhimg.com/50/v2-abed1a8c04700ba7d72b45195223e0ff_l.jpg?source=26029b8c',
  },
  'page-history-data': {
    author: '无端人口司马亮',
    avatarUrl: 'https://pic1.zhimg.com/50/v2-4f5fac6e2715839be764cc33c3b62d47_l.jpg?source=26029b8c',
  },
  'page-humanities-mod': { author: '可乐也不可乐' },
  'page-study-or-work': {
    author: '知乎用户',
    avatarUrl: 'https://pic1.zhimg.com/v2-abed1a8c04700ba7d72b45195223e0ff_l.jpg?source=2c26e567',
  },
  'page-ai-programmer-future': { author: '咕泡' },
}

function makeRealEvidence(recordId: string): Evidence {
  const record = realAnswerRecords.get(recordId)
  if (!record) throw new Error(`Missing real answer record: ${recordId}`)
  const sourcePage = realSourcePages.get(record.sourcePageId)
  if (!sourcePage) throw new Error(`Missing real answer source page: ${record.sourcePageId}`)

  return {
    id: record.id,
    author: record.author,
    badge: record.identity,
    conclusion: record.outcome,
    quote: record.summary,
    support: `${record.directExperience ? '亲历案例' : '公开观点'} · ${record.confidence === 'high' ? '来源完整' : record.confidence === 'medium' ? '需结合上下文' : '低置信样本'}`,
    votes: record.votes ?? 0,
    sourceUrl: sourcePage.url,
    sourceTitle: sourcePage.title,
    sourceAccess: sourcePage.access as Evidence['sourceAccess'],
    confidence: record.confidence as Evidence['confidence'],
    publishedAt: record.publishedAt,
    paraphrased: true,
    directExperience: record.directExperience,
    riskFlags: [...record.riskFlags],
  }
}

const realEvidence = (ids: string[]) => ids.map(makeRealEvidence)

export const programmingCorpusStats = {
  records: realAnswerSeed.records.length,
  sourcePages: realAnswerSeed.sourcePages.length,
  verifiable: realAnswerSeed.records.filter((record) => record.confidence !== 'low').length,
  directExperience: realAnswerSeed.records.filter((record) => record.directExperience).length,
  retrievedAt: realAnswerSeed.retrievedAt,
}

export const programmingMethodology = {
  datasetVersion: realAnswerSeed.datasetVersion,
  retrievedAt: realAnswerSeed.retrievedAt,
  scope: realAnswerSeed.scope,
  method: realAnswerSeed.method,
  copyrightNote: realAnswerSeed.copyrightNote,
  sourcePages: realAnswerSeed.sourcePages.map((page) => ({
    id: page.id,
    title: page.title,
    platform: page.platform,
    url: page.url,
    access: page.access,
    answerCountShown: page.answerCountShown,
    author: sourceVoiceProfiles[page.id]?.author ?? '知乎答主',
    avatarUrl: sourceVoiceProfiles[page.id]?.avatarUrl,
  })),
}

export const questions: Question[] = [
  {
    id: 'programming',
    title: '大学生现在还有必要学编程吗？',
    kicker: '想转行，想省点时间，还是只想看懂 AI？先想清楚自己为什么学。',
    answerCount: programmingCorpusStats.records,
    evidenceCount: programmingCorpusStats.verifiable,
    branchCount: 6,
    coverage: 64,
    updated: `公开样本更新于 ${programmingCorpusStats.retrievedAt}`,
    sourceMode: 'real',
    tags: ['教育', '编程', '职业选择'],
    axes: [
      { name: '学习目的', detail: '最能改变结论' },
      { name: '现有基础', detail: '影响学习路径' },
      { name: '可投入程度', detail: '决定合理边界' },
    ],
    branches: [
      {
        id: 'career',
        label: '转行开发',
        description: '想找开发工作，基础课还要不要从头学？',
        status: 'thin',
        answerCount: 5,
        evidenceCount: 4,
        path: ['学习目的', '转行开发'],
        insight: '这些回答大多建议先打基础、做项目。至于先学 C 还是 Python，答主们吵得很不一致。',
        unknown: '仍缺少一年内转行失败、退出或投入产出不符预期的完整复盘。',
        evidence: realEvidence(['real-002', 'real-003', 'real-007', 'real-008', 'real-022']),
      },
      {
        id: 'efficiency',
        label: '提高本专业效率',
        description: '不以转行为目的，把编程作为解决本专业任务的工具。',
        status: 'covered',
        answerCount: 13,
        evidenceCount: 13,
        path: ['学习目的', '提高本专业效率'],
        insight: '这些回答更建议先找手头要做的活：处理 Excel、整理文本、分析数据，遇到不会的再学。',
        unknown: '多数回答没有交代每周投入、持续周期和失败结果。',
        evidence: realEvidence(['real-005', 'real-006', 'real-009', 'real-011', 'real-013', 'real-014', 'real-015', 'real-016', 'real-017', 'real-018', 'real-019', 'real-020', 'real-021']),
        children: [
          {
            id: 'data-automation',
            label: '数据 / 自动化任务',
            shortLabel: '数据 / 自动化',
            description: '处理问卷、表格、文本批量任务或重复性流程。',
            status: 'covered',
            answerCount: 8,
            evidenceCount: 8,
            path: ['提高本专业效率', '数据 / 自动化任务'],
            insight: '本批样本中最密集的分支。管理和非科班答主频繁提到 Excel、pandas、文本分析与专业数据处理。',
            unknown: '大多数样本只提出建议，没有记录自动化前后的时间变化与维护成本。',
            evidence: realEvidence(['real-005', 'real-009', 'real-013', 'real-014', 'real-016', 'real-017', 'real-018', 'real-019']),
          },
          {
            id: 'creative-expression',
            label: '创意 / 表达工具',
            shortLabel: '创意 / 表达',
            description: '互动叙事、可视化、数字作品等表达型任务。',
            status: 'thin',
            answerCount: 2,
            evidenceCount: 2,
            path: ['提高本专业效率', '创意 / 表达工具'],
            insight: '目前找到两个具体案例：文科生参与 Mod 与文本汉化，以及英语专业学生参与 AR 教学程序。',
            unknown: '其中一个是二手转述，且两条样本都未说明每周投入，不能外推为普遍结论。',
            evidence: realEvidence(['real-020', 'real-021']),
          },
          {
            id: 'humanities-lite',
            label: '人文学科 × 每周 ≤ 2 小时',
            shortLabel: '每周 ≤ 2 小时',
            description: '非理工科、不转行、每周投入不超过两小时，只想改善真实学习或研究任务。',
            status: 'gap',
            answerCount: 0,
            evidenceCount: 0,
            path: ['提高本专业效率', '非理工科', '每周 ≤ 2 小时'],
            insight: '在当前 22 条公开样本中，没有记录同时覆盖人文学科、真实任务、每周不超过两小时和最终结果。',
            unknown: '这只表示本批样本未发现，不能推断互联网上不存在；仍缺少亲历案例与失败结果。',
            taskType: '一线案例',
            taskPrompt: '你是否见过人文学科学生，在每周不超过两小时的情况下，用编程改善真实学习或研究任务？',
            evidence: [],
          },
        ],
      },
      {
        id: 'literacy',
        label: '形成技术素养',
        description: '不追求独立开发，只希望理解软件与 AI 的基本工作方式。',
        status: 'thin',
        answerCount: 4,
        evidenceCount: 4,
        path: ['学习目的', '形成技术素养'],
        insight: '不少回答劝人学基础、练思路，可非科班到底学到哪儿能停，没几个人说清楚。',
        unknown: '仍缺少可观察的能力终点和停止学习的判断标准。',
        evidence: realEvidence(['real-001', 'real-004', 'real-010', 'real-012']),
      },
    ],
  },
  {
    id: 'first-job',
    title: '第一份工作应该优先工资还是成长？',
    kicker: '房租等着交，公司的“成长空间”到底能不能信？',
    answerCount: 31,
    evidenceCount: 82,
    branchCount: 9,
    coverage: 56,
    updated: '12 分钟前更新',
    tags: ['职场', '应届生', '薪资'],
    axes: [
      { name: '经济安全垫', detail: '决定风险下限' },
      { name: '成长可验证性', detail: '区分承诺与机制' },
      { name: '行业窗口', detail: '影响机会成本' },
    ],
    branches: [
      {
        id: 'salary-first',
        label: '经济压力高',
        description: '需要在短期内承担家庭、居住或偿债责任。',
        status: 'covered',
        answerCount: 12,
        evidenceCount: 29,
        path: ['经济安全垫', '压力高'],
        insight: '先看工资能不能按时到账。公司说能学东西，就问清谁带你、具体做什么。',
        unknown: '不同城市生活成本的边界仍较粗。',
        evidence: [
          {
            author: '老林校招记',
            badge: '制造业 HR',
            conclusion: '没有安全垫时，现金流本身就是长期选择权。',
            quote: '能留下来的成长才算成长，第一年就被房租逼走的路径无法复利。',
            support: '招聘观察 · 多案例',
            votes: 3041,
          },
        ],
      },
      {
        id: 'growth-first',
        label: '安全垫充足',
        description: '手头的钱能撑一两年，想找个有人带、能学到东西的岗位。',
        status: 'covered',
        answerCount: 10,
        evidenceCount: 27,
        path: ['经济安全垫', '充足', '反馈密度高'],
        insight: '降薪之前，先问清谁带你、多久看一次成果。只说“空间很大”，还不够。',
        unknown: '所谓“核心项目”仍缺少统一验证口径。',
        evidence: [
          {
            author: '枝上产品人',
            badge: '互联网产品负责人',
            conclusion: '可验证的高反馈环境可以接受有限薪资折价。',
            quote: '问清楚谁给反馈、多久一次、过去一年谁因此晋升，比问有没有成长空间有效。',
            support: '管理经验 · 含验证问题',
            votes: 1876,
          },
        ],
        children: [
          {
            id: 'mentor-system',
            label: '有明确导师与复盘机制',
            shortLabel: '导师机制明确',
            description: '说得出谁带新人、怎么带，也找得到以前被带过的人。',
            status: 'covered',
            answerCount: 6,
            evidenceCount: 17,
            path: ['安全垫充足', '导师机制明确'],
            insight: '有人认真带，少拿一点工资才可能值得。',
            unknown: '导师稳定性未被充分记录。',
            evidence: [],
          },
          {
            id: 'verbal-growth',
            label: '只有口头成长承诺',
            shortLabel: '仅口头承诺',
            description: '岗位无法说明任务、反馈人与历史晋升样本。',
            status: 'thin',
            answerCount: 2,
            evidenceCount: 4,
            path: ['安全垫充足', '口头成长承诺'],
            insight: '风险明显更高，但案例样本少。',
            unknown: '缺少中小企业的一线反例。',
            evidence: [],
          },
          {
            id: 'low-salary-new-city',
            label: '异地 × 低薪 × 高成长承诺',
            shortLabel: '异地低薪',
            description: '跨城入职且薪资接近生活成本线，公司承诺高成长。',
            status: 'gap',
            answerCount: 0,
            evidenceCount: 0,
            path: ['安全垫有限', '异地', '低薪'],
            insight: '相邻回答很多，但没有同时覆盖迁移成本与成长兑现的复盘。',
            unknown: '缺少一年后的真实去向。',
            taskType: '结果追踪',
            taskPrompt: '你是否经历过异地、低薪但承诺高成长的第一份工作？一年后发生了什么？',
            evidence: [],
          },
        ],
      },
      {
        id: 'industry-window',
        label: '行业窗口短',
        description: '行业快速变化，延迟一年可能显著改变进入机会。',
        status: 'thin',
        answerCount: 3,
        evidenceCount: 7,
        path: ['行业窗口', '短期窗口'],
        insight: '“先上车”有条件成立，但证据容易受幸存者偏差影响。',
        unknown: '缺少错过窗口但获得替代路径的案例。',
        evidence: [],
      },
    ],
  },
  {
    id: 'ai-learning',
    title: '普通人学习 AI，应该先学原理还是先做应用？',
    kicker: '先拿一件想做的事来问，别光纠结课程该从哪节看。',
    answerCount: 19,
    evidenceCount: 51,
    branchCount: 7,
    coverage: 71,
    updated: '1 小时前更新',
    tags: ['人工智能', '学习路径', '效率工具'],
    axes: [
      { name: '使用目标', detail: '决定知识深度' },
      { name: '反馈周期', detail: '影响学习动力' },
      { name: '错误成本', detail: '决定验证要求' },
    ],
    branches: [
      {
        id: 'ai-office',
        label: '改善日常工作',
        description: '写作、检索、整理、数据处理等低风险工作流。',
        status: 'covered',
        answerCount: 9,
        evidenceCount: 24,
        path: ['使用目标', '日常工作'],
        insight: '先让 AI 帮你做一件小事。哪里出错，就去补那部分知识。',
        unknown: '长期依赖对能力迁移的影响尚不清晰。',
        evidence: [
          {
            author: 'AI 练习生',
            badge: '运营从业者',
            conclusion: '从可验证的小任务开始，比完整课程更容易形成闭环。',
            quote: '我先让它帮我分类工单，出错后才知道为什么要学上下文和评估。',
            support: '工作流复盘 · 原文含失败点',
            votes: 998,
          },
        ],
      },
      {
        id: 'ai-career',
        label: '进入 AI 岗位',
        description: '以模型、算法、工程或 AI 产品岗位为目标。',
        status: 'covered',
        answerCount: 7,
        evidenceCount: 20,
        path: ['使用目标', '职业进入'],
        insight: '课要学，项目也得做。跑不起来的时候，才知道自己哪块没懂。',
        unknown: '非技术岗位转 AI 产品的能力边界仍模糊。',
        evidence: [],
        children: [
          {
            id: 'ai-product',
            label: 'AI 产品 / 业务岗位',
            shortLabel: '产品 / 业务',
            description: '需要理解能力边界、评估与工作流设计。',
            status: 'covered',
            answerCount: 4,
            evidenceCount: 11,
            path: ['职业进入', 'AI 产品'],
            insight: '先做应用，但需要尽早补评估和模型边界。',
            unknown: '缺少传统行业转型案例。',
            evidence: [],
          },
          {
            id: 'ai-research',
            label: '模型 / 算法岗位',
            shortLabel: '模型 / 算法',
            description: '理论、实验与工程缺一不可。',
            status: 'covered',
            answerCount: 3,
            evidenceCount: 9,
            path: ['职业进入', '模型算法'],
            insight: '基础原理是进入复杂任务的必要条件。',
            unknown: '暂无明显空缺。',
            evidence: [],
          },
          {
            id: 'ai-traditional-industry',
            label: '传统行业 × AI 业务转型',
            shortLabel: '传统行业转型',
            description: '有行业知识、技术基础弱，希望参与 AI 业务改造。',
            status: 'gap',
            answerCount: 0,
            evidenceCount: 0,
            path: ['职业进入', '传统行业', '技术基础弱'],
            insight: '行业经验被反复强调，但具体学习顺序无人给出可复用复盘。',
            unknown: '缺少真实转型路径与失败节点。',
            taskType: '路径复盘',
            taskPrompt: '如果你从传统行业转入 AI 业务，请分享前 30 天先做了什么、补了什么原理。',
            evidence: [],
          },
        ],
      },
      {
        id: 'ai-literacy',
        label: '建立基础认知',
        description: '理解 AI 能做什么、不能做什么，不以岗位转换为目标。',
        status: 'thin',
        answerCount: 2,
        evidenceCount: 4,
        path: ['使用目标', '基础认知'],
        insight: '主张很多，学习完成后的可观察标准较少。',
        unknown: '缺少一套低门槛的理解检验。',
        evidence: [],
      },
    ],
  },
]

export function flattenBranches(branches: Branch[]): Branch[] {
  return branches.flatMap((branch) => [
    branch,
    ...(branch.children ? flattenBranches(branch.children) : []),
  ])
}

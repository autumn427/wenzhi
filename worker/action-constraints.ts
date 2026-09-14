// Conservative regression guards for known narrative failures, not a semantic proof.
const protectedAreas: Record<string, { label: string; nouns: string }> = {
  study: { label: '学业与本职工作', nouns: '课程|专业课|学业|课业|作业|预习|本职工作' },
  income: { label: '收入稳定', nouns: '收入|工资|薪资|生活费' },
  energy: { label: '睡眠与精力', nouns: '睡眠|休息|精力' },
  domain: { label: '专业积累', nouns: '专业积累|专业基础|专业能力' },
}

export function actionContract(action: string, sacrifice: unknown, minutes: number) {
  return {
    submittedAction: action,
    executionWindow: '只执行本次提交的行动；时间跳转不是授权重复执行',
    budgetMinutes: minutes,
    protectedArea: typeof sacrifice === 'string' ? protectedAreas[sacrifice]?.label ?? '不追加用户未选择的牺牲' : '不追加用户未选择的牺牲',
    observationWindow: '到目标日期只回看这次行动留下的结果、未解决项；不补写期间的额外行动',
  }
}

// Match only local negation; do not let an unrelated “没有” hide a later violation.
function affirmative(clause: string, index: number) {
  return !/(?:不|未|没有|无需|无须|不必|不会|不能|不再|不应|不得)(?:再|会|要|必|曾|需|需要|发生)?$/.test(clause.slice(0, index))
}

// Narrow protected-harm exception for observed passive negation. Do not scan
// backwards across arbitrary words: "没有成果但挤占课程" must still fail.
function affirmativeProtectedHarm(clause: string, index: number) {
  const prefix = clause.slice(0, index)
  const negation = /(?:未被|没有被|不会被|不能被|不得被|没有任何)$/.exec(prefix)
  if (!negation) return affirmative(clause, index)
  // Double negation is not evidence that the protected area stayed intact.
  return /(?:并非|不是|并不是|不能说|并不能说)$/.test(prefix.slice(0, negation.index))
}

export function narrativeViolation(action: string, sacrifice: unknown, outcomes: string[], choices: string[]) {
  for (const text of [...outcomes, ...choices]) {
    for (const clause of text.split(/[，。；！？\n]/)) {
      const overBudget = /(?:超出|超过|突破)[^，。；！？]{0,8}(?:预算|时限)|额外加时/g
      for (const match of clause.matchAll(overBudget)) {
        if (affirmative(clause, match.index)) return 'AI_TIME_TEXT_CONFLICT'
      }
    }
  }
  const repetition = /每周|每星期|每个月|连续[一二三四五六七八九十百\d]+(?:周|个月)|第[二三四五六七八九十百2-9\d]+次(?:复现|练习|试用|测试)/g
  for (const text of outcomes) {
    for (const clause of text.split(/[，。；！？\n]/)) {
      for (const match of clause.matchAll(repetition)) {
        const explicitlyRequested = action.split(/[，。；！？\n]/).some((part) =>
          [...part.matchAll(repetition)].some((request) => request[0] === match[0] && affirmative(part, request.index)))
        if (affirmative(clause, match.index) && !explicitlyRequested) return 'AI_ACTION_SCOPE_VIOLATION'
      }
    }
  }
  const area = typeof sacrifice === 'string' ? protectedAreas[sacrifice] : undefined
  if (!area) return null
  const harm = '放弃|牺牲|挤占|耽误|推迟|暂缓|延误|减少|压缩|损失|落后|下降|受损|受影响|透支'
  const before = new RegExp(`(${harm})[^，。；！？]{0,16}(?:${area.nouns})`, 'g')
  const after = new RegExp(`(?:${area.nouns})[^，。；！？]{0,12}?(${harm})`, 'g')
  for (const text of [...outcomes, ...choices]) {
    for (const clause of text.split(/[，。；！？\n]/)) {
      for (const pattern of [before, after]) {
        for (const match of clause.matchAll(pattern)) {
          const harmIndex = match.index + match[0].indexOf(match[1])
          if (affirmativeProtectedHarm(clause, harmIndex)) return 'AI_PROTECTED_BOUNDARY_VIOLATION'
        }
      }
    }
  }
  return null
}

// Narrow factual contradiction guard. It does not grade skill growth or infer
// gains from prose; questions, assumptions and future choices are not evidence.
export function metricNarrativeViolation(delta: Record<string, number | undefined>, story: string) {
  const subjects: Record<string, string> = {
    technicalSkill: '技术能力|编程能力|基础表格处理能力',
    aiCollaboration: 'AI协作能力|AI协作水平',
    domainDepth: '专业能力|专业积累|专业理解',
    portfolio: '作品积累|作品数量',
    opportunity: '机会数量|外部机会',
    confidence: '信心|自信',
    energy: '精力|能量',
  }
  for (const [key, nouns] of Object.entries(subjects)) {
    if (!delta[key]) continue
    const unchanged = new RegExp(`(?:${nouns})(?:仍然|仍旧|依然|仍|也|则)?(?:维持原状|保持不变|没有变化|未发生变化)$`)
    for (const clause of story.split(/[，。；！？\n]/)) {
      if (/如果|假如|假设|可能|是否|并非|不是|不能说|不代表/.test(clause)) continue
      if (unchanged.test(clause.trim())) return 'AI_METRIC_NARRATIVE_CONFLICT'
    }
  }
  return null
}

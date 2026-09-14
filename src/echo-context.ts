export type EchoContext = {
  code: string
  route: string
  day: number
  actionDay?: number
  eventTitle?: string
  action: string
  obstacle: string
  profile: string
}

/** Reserve space for the choice before adding background, within search's 120-character limit. */
export function echoQuery(context: EchoContext) {
  return [context.action.slice(0, 32), context.obstacle.slice(0, 36), context.route.slice(0, 24), context.profile.slice(0, 20), '真实经历'].filter(Boolean).join(' ').slice(0, 120)
}

export function echoIdentity(context: EchoContext) {
  return JSON.stringify([context.code, context.day, context.route, context.action, context.obstacle, context.profile])
}

const comparisonTopics = [
  { label: '时间投入', terms: ['时间', '小时', '分钟', '每周', '耗时'] },
  { label: '基础与学习', terms: ['基础', '学习', '课程', '教程', '编程'] },
  { label: 'AI 的使用与核对', terms: ['AI', '人工智能', '模型', 'ChatGPT'] },
  { label: '作品与交付', terms: ['作品', '项目', '原型', '工具', '交付'] },
  { label: '反馈与验证', terms: ['反馈', '试用', '验证', '测试', '用户'] },
  { label: '专业积累', terms: ['专业', '研究', '论文', '文献'] },
  { label: '工作与转向', terms: ['工作', '求职', '转行', '面试', '职业'] },
]

/** Lexical comparison only: never attribute an inferred outcome to an author. */
export function compareEcho(context: EchoContext, source: { title: string; excerpt: string }) {
  const situation = `${context.action} ${context.obstacle} ${context.route} ${context.profile}`.toLocaleLowerCase()
  const sentences = source.excerpt.split(/(?<=[。！？；\n])/).map(text => text.trim()).filter(Boolean)
  const matches = comparisonTopics.flatMap(topic => {
    if (!topic.terms.some(term => situation.includes(term.toLocaleLowerCase()))) return []
    const quote = sentences.find(sentence => topic.terms.some(term => sentence.toLocaleLowerCase().includes(term.toLocaleLowerCase())))
    return quote ? [{ label: topic.label, quote }] : []
  }).slice(0, 3)
  return {
    matches,
    summary: matches.length
      ? `你当前的选择与这份摘录都涉及${matches.map(match => `“${match.label}”`).join('、')}。这些是文本中的共同线索，还不能说明双方条件相同。`
      : '这是检索返回的候选内容，摘录中尚未找到明确的共同线索；请先核对原文，暂不据此调整选择。',
  }
}

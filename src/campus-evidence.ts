import sources from '../research/campus-demo-sources.json'
import type { Evidence } from './data'

export const campusSources = sources.items
export const campusEvidence: Evidence[] = campusSources.map(item => ({
  id: item.id, author: item.author, badge: '知乎 API 检索摘录', conclusion: item.summary,
  quote: item.excerpt, support: '公开回答片段 · 经历未独立核实', votes: item.votes,
  sourceUrl: item.sourceUrl, sourceTitle: item.title, sourceAccess: 'search-snippet',
  confidence: 'medium', paraphrased: false, directExperience: false,
  riskFlags: ['仅取得检索片段，需回原文结合上下文阅读；不代表普遍结果。'],
}))

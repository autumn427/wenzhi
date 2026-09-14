import type { SimulationProfile, UniverseRun } from './simulation'

/** A small, explicitly local plan. It uses only a completed route's records. */
export function firstRouteExperiment(run: UniverseRun, profile: SimulationProfile) {
  if (run.currentEvent.day !== 180 || !run.decisions.length) return null
  const last = run.decisions[run.decisions.length - 1]
  const tradeoff = (last.actionOutcome?.tradeoff || last.tradeoff || '投入时间，结果仍待验证').replace(/[。.!！]+$/, '')
  return {
    origin: { kind: 'route' as const, code: run.code },
    title: '先验证这条路的一小步',
    hypothesis: `围绕“${profile.goal}”，从“${last.choiceLabel}”中选出一个现实可做的最小步骤，检验它是否值得继续。`,
    reason: `来自宇宙 ${run.code} 的模拟记录“${run.currentEvent.title}”。最后一次取舍是：${tradeoff}。这张行动票按本地规则整理，不是现实结果或成功承诺。`,
    dailyTasks: contextualTasks(profile, last.choiceLabel),
    successSignal: `保留与“${profile.goal}”有关的一份样例，记录前后耗时、至少一个错误或卡点；先检验是否改善，不预设成功。`,
    stopRule: '全周最多 90 分钟，包含准备和记录；达到预算、触及你设定的底线或需要不可逆投入时停止。',
    feedbackQuestion: `对照“${last.choiceLabel}”，你的样例和耗时记录支持继续、缩小尝试还是停止？写清一项观察和一个仍未验证的问题。`,
  }
}

/** Match the stated goal and actual last choice, never assume a method from universe colour. */
function contextualTasks(profile: SimulationProfile, choice: string) {
  const goal = profile.goal || '当前目标'
  const domain = /文献|论文/.test(goal) ? {
    material: '选三篇已有文献，列出标题、作者、年份、核心观点、原文位置五个字段',
    sample: '一篇文献的五字段整理样例',
    check: '逐项对照文献原文，标出遗漏、误填和找不到出处的字段',
  } : /笔记|读书/.test(goal) ? {
    material: '选一篇已有读书笔记，列出出处、主要观点、例子和待确认问题四个栏目',
    sample: '一篇笔记的四栏模板',
    check: '用另一篇短笔记试填模板，标出无法归类或重复的内容',
  } : /求职|简历|面试/.test(goal) ? {
    material: '选一个真实岗位描述与一段已有项目经历，圈出三项要求',
    sample: '一段对应岗位要求的项目经历说明',
    check: '逐句检查经历说明是否有真实事实支撑，标出缺少证据的要求',
  } : /代码|编程|程序|工具|网站|网页/.test(goal) ? {
    material: '从目标中选一个输入和一个期望输出，准备一份不含隐私的测试样例',
    sample: '只覆盖这个输入输出的最小原型',
    check: '用一个正常输入和一个边界输入测试，记下实际输出与预期的差异',
  } : {
    material: `为“${goal}”选一份你已拥有的材料，写出一个可观察的验收条件`,
    sample: `围绕“${goal}”的一份最小样例`,
    check: '用第一天写下的验收条件检查样例，标出一处达标和一处待改进之处',
  }
  const method = /不用\s*AI|不借助\s*AI|不依赖\s*AI|手动|自己独立/i.test(choice) ? '用现有材料手动完成' : /AI|人工智能|模型|自动化/i.test(choice) ? '用 AI 草拟' : /一起|合作|协作|找人|反馈|请教/.test(choice) ? '先独立做一版，再请一位愿意帮忙的人核对' : /基础|课程|学习|弄懂/.test(choice) ? '只查一个必要知识点，自己完成' : '用现有方法完成'
  return [
    { day: 1, minutes: 10, task: `你选择了“${choice}”。这周只做${domain.sample}，记录现有方法的耗时和一个卡点，其他功能先不做。` },
    { day: 2, minutes: 10, task: `${domain.material}；使用现成材料，不购买工具。` },
    { day: 3, minutes: 20, task: `${method}${domain.sample}。保存前后两版，记下实际分钟数；涉及 AI 时逐项核对，不直接当作事实。` },
    { day: 4, minutes: 10, task: `${domain.check}，对照第一天的耗时记录，写下变化；没有改善也如实记录。` },
    { day: 5, minutes: 20, task: `只修正${domain.sample}中昨天发现的一个问题，再用同一份材料检查并记录耗时；不扩大范围。` },
    { day: 6, minutes: 10, task: `请一位愿意帮忙的人试读或试用${domain.sample}，记录一个不符合预期的地方；找不到人则用另一份材料自测，并注明未获外部反馈。` },
    { day: 7, minutes: 10, task: `并排看${domain.sample}的前后版本、耗时和反馈，决定继续、缩小或停止；没有实际记录时只写“暂不足以判断”。` },
  ]
}

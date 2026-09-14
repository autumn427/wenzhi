/** Presence checks only: local notes are self-reports, not independently verified evidence. */
export function experimentEvidence(progress: {
  checkins: Partial<Record<number, 'done' | 'skipped'>>
  notes?: Record<number, string>
  result: string; signalObserved: boolean; answer: string
}) {
  const days = Array.from({ length: 7 }, (_, i) => i + 1)
  const done = days.filter(day => progress.checkins[day] === 'done').length
  const skipped = days.filter(day => progress.checkins[day] === 'skipped').length
  const observations = days.filter(day => progress.checkins[day] === 'done' && (progress.notes?.[day]?.trim().length ?? 0) >= 10)
  const reason = done + skipped < 7 ? '先记录七天的执行情况，跳过也可以如实记录。'
    : done === 0 ? '七天均未执行，暂不足以判断路线是否有效。可以保留跳过原因，缩小步骤后再试。'
    : !observations.length ? '已有打卡，但缺少实际观察。请在一个已完成日补充产物、耗时或具体卡点，暂不据此判断路线有效。'
    : !['strong', 'mixed', 'weak'].includes(progress.result) ? '请结合实际记录选择结果强度。'
    : progress.result === 'strong' && !progress.signalObserved ? '选择明显有效前，请确认观察到了预设成功信号；否则可选有得有失或没有奏效。'
    : progress.answer.trim().length < 12 ? '请写清一项具体观察和一个仍未验证的问题（至少 12 个字）。' : ''
  return { done, skipped, pending: 7 - done - skipped, observations, ready: !reason, reason }
}

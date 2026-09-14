export type FreeActionFeedback = { message: string; retryLabel: string }

/** Carry only machine codes; never render an upstream message or stack trace. */
export class FreeActionApiError extends Error {
  readonly code?: string
  readonly status: number
  constructor(code: string | undefined, status: number) {
    super('Free action response was not accepted')
    this.name = 'FreeActionApiError'
    this.code = code
    this.status = status
  }
}

export function freeActionFeedback(error: unknown): FreeActionFeedback {
  const code = error instanceof FreeActionApiError ? error.code ?? '' : ''
  const status = error instanceof FreeActionApiError ? error.status
    : error instanceof Error && error.name === 'ResponseBodyError' && 'status' in error && typeof error.status === 'number' ? error.status : 0
  const preserved = '行动已保留，进度也还在原处。'
  if (code === 'BACKUP_AI_REQUEST_REJECTED') {
    return { message: `备用续写服务出了配置问题，需要维护人员处理。${preserved}不用重写行动，也不必连续重试。`, retryLabel: '服务恢复后重试' }
  }
  if (code === 'BACKUP_AI_ACCESS_DENIED') {
    return { message: `备用续写服务的授权出了问题，需要维护人员处理。${preserved}无需提供个人账号或密码。`, retryLabel: '服务恢复后重试' }
  }
  if (code === 'BACKUP_AI_TIMEOUT') {
    return { message: `备用服务等了太久，还没写完这段剧情。${preserved}稍后可以点重试，系统不会自动提交。`, retryLabel: '稍后重试这次行动' }
  }
  if (code === 'BACKUP_AI_RATE_LIMITED') {
    return { message: `备用 AI 平台暂时限制了请求。${preserved}请稍后再试，不必重新填写。`, retryLabel: '稍后再试' }
  }
  if (['BACKUP_AI_INCOMPLETE_RESPONSE', 'BACKUP_AI_INVALID_RESPONSE', 'BACKUP_AI_EMPTY_RESPONSE', 'BACKUP_AI_RESPONSE_TOO_LONG'].includes(code)) {
    return { message: `备用 AI 返回的内容不完整或格式不符合要求，未被采用。${preserved}可以稍后重试。`, retryLabel: '重试这次行动' }
  }
  if (code.startsWith('BACKUP_AI_')) {
    return { message: `主模型不可用，Yeako 备用 AI 这次也未能完成续写。${preserved}请稍后再试。`, retryLabel: '稍后再试' }
  }
  if (status === 429 || code === 'AI_RATE_LIMITED') {
    return { message: `AI 续写服务暂时限制了请求。${preserved}请稍后再试，不必重新填写。`, retryLabel: '稍后再试' }
  }
  if (code === 'AI_TIMEOUT' || (error instanceof Error && ['RequestTimeoutError', 'AbortError'].includes(error.name))) {
    return { message: `这次等待超过了时限，没有收到完整剧情。${preserved}你可以稍后重试。`, retryLabel: '重试这次行动' }
  }
  if (code.startsWith('AI_METRIC_')) {
    return { message: `这次续写给出的分数和剧情对不上，已拦下。${preserved}不用改写行动，直接重试就好。`, retryLabel: '重试这次行动' }
  }
  if (code === 'AI_ACTION_SCOPE_VIOLATION' || code === 'AI_PROTECTED_BOUNDARY_VIOLATION' || code.startsWith('AI_TIME_') || code.startsWith('AI_CHOICE_TIME_')) {
    return { message: `这次剧情越过了你写的行动、时间预算或底线，已拦下。${preserved}可以重试。`, retryLabel: '重试这次行动' }
  }
  if (code === 'AI_NOT_CONFIGURED' || status === 401 || status === 403) {
    return { message: `AI 续写服务暂时无法使用。${preserved}请稍后再试，不必重新填写。`, retryLabel: '稍后再试' }
  }
  if (code === 'AI_NETWORK_ERROR' || error instanceof TypeError) {
    return { message: `暂时无法连接续写服务。${preserved}请检查网络后重试。`, retryLabel: '重试这次行动' }
  }
  if (code.startsWith('AI_JSON_') || ['AI_INVALID_ACTION', 'AI_INVALID_TIMELINE', 'AI_INVALID_CHOICES', 'AI_EMPTY_RESPONSE', 'AI_RESPONSE_TOO_LONG', 'AI_INVALID_RESPONSE', 'AI_INCOMPLETE_RESPONSE'].includes(code) || error instanceof SyntaxError || (error instanceof Error && error.name === 'ResponseBodyError' && status < 400)) {
    return { message: `这次收到的剧情有缺漏，暂时没法接着往下走。${preserved}可以重试。`, retryLabel: '重试这次行动' }
  }
  return { message: `这次 AI 续写没有完成。${preserved}可以稍后重试。`, retryLabel: '重试这次行动' }
}

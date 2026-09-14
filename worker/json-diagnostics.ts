// Structural categories only: never return source text or engine error messages.
export function jsonFailureCode(value: string) {
  const start = value.indexOf('{')
  if (start < 0) return 'AI_JSON_NO_OBJECT'
  let depth = 0
  let quoted = false
  let escaped = false
  let roots = 0
  for (let i = start; i < value.length; i++) {
    const character = value[i]
    if (quoted) {
      if (escaped) escaped = false
      else if (character === '\\') escaped = true
      else if (character === '"') quoted = false
      continue
    }
    if (character === '"') quoted = true
    else if (character === '{') depth++
    else if (character === '}') {
      depth--
      if (depth === 0) roots++
      if (depth < 0) return 'AI_JSON_SYNTAX_ERROR'
    }
  }
  if (quoted || depth > 0) return 'AI_JSON_INCOMPLETE'
  if (roots > 1) return 'AI_JSON_MULTIPLE_OBJECTS'
  return 'AI_JSON_SYNTAX_ERROR'
}

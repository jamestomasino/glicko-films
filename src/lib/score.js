export function strategyLabel(strategy) {
  if (!strategy) return 'Normal'
  const match = /^v2_(sw|rr)(n|w)(r|h|m|l)$/.exec(strategy)
  if (!match) return 'Normal'
  const pairing = match[1] === 'sw' ? 'Swiss Rules' : 'Full Pairing'
  const band = match[2] === 'w' ? 'Wide Band' : 'Normal Band'
  const range = match[3] === 'h'
    ? 'High Range'
    : match[3] === 'm'
      ? 'Middle Range'
      : match[3] === 'l'
        ? 'Low Range'
        : 'Random Range'
  return `${pairing} · ${band} · ${range}`
}

export function resolveStartValue(options, current, preferred, fallback) {
  if (options.some((option) => option.id === current)) return current
  if (options.some((option) => option.id === preferred)) return preferred
  return options[0]?.id || fallback
}

export function findOptionLabel(options, value) {
  return options.find((option) => option.id === value)?.label || value
}

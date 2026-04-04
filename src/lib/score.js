export function strategyLabel(strategy) {
  if (!strategy) return 'Normal'
  const v3 = /^v3_(sw|rr)(n|w|x)(r|h|m|l)_([cba])([shd])([nms])([nqh])([qsd])([ny])$/.exec(strategy)
  if (v3) {
    const pairing = v3[1] === 'sw' ? 'Swiss Rules' : 'Full Pairing'
    const band = v3[2] === 'x'
      ? 'Explore Band'
      : v3[2] === 'w'
        ? 'Wide Band'
        : 'Normal Band'
    const range = v3[3] === 'h'
      ? 'High Range'
      : v3[3] === 'm'
        ? 'Middle Range'
        : v3[3] === 'l'
          ? 'Low Range'
          : 'Random Range'
    const rdProfile = v3[4] === 'c' ? 'Conservative RD' : v3[4] === 'a' ? 'Aggressive RD' : 'Balanced RD'
    const poolGoal = v3[5] === 's' ? 'Stability Goal' : v3[5] === 'd' ? 'Discovery Goal' : 'Hybrid Goal'
    const freshness = v3[6] === 'm' ? 'Mild Freshness' : v3[6] === 's' ? 'Strong Freshness' : 'No Freshness Bias'
    const rdQuota = v3[7] === 'q' ? '25% RD Quota' : v3[7] === 'h' ? '50% RD Quota' : 'No RD Quota'
    const budget = v3[8] === 'q' ? 'Quick Budget' : v3[8] === 'd' ? 'Deep Budget' : 'Standard Budget'
    const upset = v3[9] === 'y' ? 'Upset Focus' : 'Normal Pair Priority'
    return `${pairing} · ${band} · ${range} · ${rdProfile} · ${poolGoal} · ${freshness} · ${rdQuota} · ${budget} · ${upset}`
  }

  const v2 = /^v2_(sw|rr)(n|w|x)(r|h|m|l)$/.exec(strategy)
  if (!v2) return 'Normal'
  const pairing = v2[1] === 'sw' ? 'Swiss Rules' : 'Full Pairing'
  const band = v2[2] === 'x'
    ? 'Explore Band'
    : v2[2] === 'w'
      ? 'Wide Band'
      : 'Normal Band'
  const range = v2[3] === 'h'
    ? 'High Range'
    : v2[3] === 'm'
      ? 'Middle Range'
      : v2[3] === 'l'
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

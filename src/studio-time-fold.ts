/** Sequential paper tiers. Earlier tiers finish before a higher tier opens. */
export function studioTierFold(progress:number,tower:number,tier:number) {
  const safe=Number.isFinite(progress)?Math.max(0,Math.min(1,progress)):0
  const extent=.3+safe*(.7-(tower%3)*.035)
  const amount=Math.max(0,Math.min(1,extent*4-tier))
  return amount*amount*(3-2*amount)
}

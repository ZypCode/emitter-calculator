/**
 * 无依赖的合成逻辑回归测试（与 src/core/merge.ts 行为一致）
 */

function mergeLevelMap(levels) {
  const m = new Map(levels)
  let changed = true
  while (changed) {
    changed = false
    const sorted = [...m.keys()].sort((a, b) => a - b)
    for (const L of sorted) {
      const c = m.get(L) ?? 0
      if (c < 2) continue
      const pairs = Math.floor(c / 2)
      const rest = c - pairs * 2
      if (rest === 0) m.delete(L)
      else m.set(L, rest)
      m.set(L + 1, (m.get(L + 1) ?? 0) + pairs)
      changed = true
    }
  }
  return m
}

function mergeInventory(inventory) {
  const types = [...new Set(inventory.map((e) => e.type))]
  const out = []
  for (const type of types) {
    const m = new Map()
    for (const e of inventory) {
      if (e.type !== type) continue
      m.set(e.level, (m.get(e.level) ?? 0) + e.count)
    }
    const merged = mergeLevelMap(m)
    for (const [level, count] of [...merged.entries()].sort((a, b) => a[0] - b[0])) {
      if (count > 0) out.push({ type, level, count })
    }
  }
  return out
}

function totalSlots(inventory) {
  return inventory.reduce((s, e) => s + e.count, 0)
}

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg)
    process.exit(1)
  }
}

const merged = mergeInventory([{ type: '加农炮', level: 1, count: 2 }])
assert(merged.length === 1 && merged[0].level === 2 && merged[0].count === 1, '2×L1 → 1×L2')

const mergedChain = mergeInventory([{ type: '加农炮', level: 1, count: 4 }])
assert(
  mergedChain.length === 1 && mergedChain[0].level === 3 && mergedChain[0].count === 1,
  '4×L1 连缀 → 1×L3',
)

const merged2 = mergeInventory([
  { type: 'A', level: 1, count: 4 },
  { type: 'A', level: 2, count: 2 },
])
const slots2 = totalSlots(merged2)
assert(
  merged2.length === 1 && merged2[0].level === 4 && merged2[0].count === 1 && slots2 === 1,
  '4×L1+2×L2 连缀 → 1×L4',
)

const merged3 = mergeInventory([
  { type: '甲', level: 1, count: 1 },
  { type: '乙', level: 1, count: 2 },
])
assert(merged3.length === 2 && totalSlots(merged3) === 2, '不同种类不互相合成')

console.log('All merge tests passed.')
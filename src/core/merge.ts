import type { InventoryEntry, RewardEntry } from './types'

function levelsMapFromEntries(entries: InventoryEntry[], type: string): Map<number, number> {
  const m = new Map<number, number>()
  for (const e of entries) {
    if (e.type !== type) continue
    if (e.level < 1 || e.count < 1) continue
    m.set(e.level, (m.get(e.level) ?? 0) + e.count)
  }
  return m
}

/** 对单一种类的等级数量表做自动连缀合成 */
export function mergeLevelMap(levels: Map<number, number>): Map<number, number> {
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

export function mergeInventory(inventory: InventoryEntry[]): InventoryEntry[] {
  const types = new Set(inventory.map((e) => e.type))
  const out: InventoryEntry[] = []
  for (const type of [...types].sort((a, b) => a.localeCompare(b, 'zh-CN'))) {
    const merged = mergeLevelMap(levelsMapFromEntries(inventory, type))
    const levels = [...merged.keys()].sort((a, b) => a - b)
    for (const level of levels) {
      const count = merged.get(level)!
      if (count > 0) out.push({ type, level, count })
    }
  }
  return out
}

export function totalSlots(inventory: InventoryEntry[]): number {
  return inventory.reduce((sum, e) => sum + (e.count > 0 ? e.count : 0), 0)
}

export function addRewards(
  inventory: InventoryEntry[],
  rewards: RewardEntry[],
): InventoryEntry[] {
  const draft = inventory.map((e) => ({ ...e }))
  for (const r of rewards) {
    if (!r.type.trim() || r.level < 1 || r.count < 1) continue
    const existing = draft.find((e) => e.type === r.type && e.level === r.level)
    if (existing) existing.count += r.count
    else draft.push({ type: r.type.trim(), level: r.level, count: r.count })
  }
  return mergeInventory(draft)
}

export function normalizeEntry(e: InventoryEntry): string | null {
  if (!e.type.trim()) return '种类不能为空'
  if (!Number.isInteger(e.level) || e.level < 1) return '等级须为 ≥1 的整数'
  if (!Number.isInteger(e.count) || e.count < 1) return '数量须为 ≥1 的整数'
  return null
}

export function validateRewards(rewards: RewardEntry[]): string | null {
  for (const r of rewards) {
    const err = normalizeEntry(r)
    if (err) return err
  }
  return null
}
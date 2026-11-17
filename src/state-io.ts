import { syncEmitterTypes } from './core/emitter-types'
import { mergeInventory } from './core/merge'
import type { GameState, HistoryEntry, InventoryEntry, RewardEntry } from './core/types'

export function parseInventory(raw: unknown): InventoryEntry[] {
  if (!Array.isArray(raw)) throw new Error('inventory 须为数组')
  return raw.map((item, i) => {
    if (!item || typeof item !== 'object') throw new Error(`inventory[${i}] 无效`)
    const x = item as Record<string, unknown>
    const type = String(x.type ?? '').trim()
    const level = Number(x.level)
    const count = Number(x.count)
    if (!type) throw new Error(`inventory[${i}].type 不能为空`)
    if (!Number.isInteger(level) || level < 1) throw new Error(`inventory[${i}].level 须 ≥1`)
    if (!Number.isInteger(count) || count < 1) throw new Error(`inventory[${i}].count 须 ≥1`)
    return { type, level, count }
  })
}

export function parseLevelRewards(raw: unknown): Record<string, RewardEntry[]> {
  if (raw === undefined || raw === null) return {}
  if (typeof raw !== 'object' || Array.isArray(raw)) throw new Error('levelRewards 须为对象')
  const out: Record<string, RewardEntry[]> = {}
  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    if (!Array.isArray(val)) throw new Error(`levelRewards.${key} 须为数组`)
    out[key] = val.map((item, i) => {
      if (!item || typeof item !== 'object') throw new Error(`levelRewards.${key}[${i}] 无效`)
      const x = item as Record<string, unknown>
      return {
        type: String(x.type ?? '').trim(),
        level: Number(x.level),
        count: Number(x.count),
      }
    })
  }
  return out
}

export function parseHistory(raw: unknown): HistoryEntry[] {
  if (!Array.isArray(raw)) return []
  const out: HistoryEntry[] = []
  for (let i = 0; i < raw.length; i++) {
    const item = raw[i]
    if (!item || typeof item !== 'object') continue
    const h = item as Record<string, unknown>
    const levelCleared = Number(h.levelCleared)
    const slotsBefore = Number(h.slotsBefore)
    const slotsAfter = Number(h.slotsAfter)
    if (!Number.isInteger(levelCleared) || levelCleared < 1) continue
    if (!Number.isInteger(slotsBefore) || slotsBefore < 0) continue
    if (!Number.isInteger(slotsAfter) || slotsAfter < 0) continue
    const rewards = Array.isArray(h.rewards) ? (h.rewards as RewardEntry[]) : []
    out.push({
      at: typeof h.at === 'string' ? h.at : new Date(0).toISOString(),
      levelCleared,
      rewards: rewards.map((r) => ({
        type: String((r as RewardEntry).type ?? '').trim(),
        level: Number((r as RewardEntry).level),
        count: Number((r as RewardEntry).count),
      })),
      slotsBefore,
      slotsAfter,
    })
  }
  return out
}

export function parseGameState(raw: unknown): GameState {
  if (!raw || typeof raw !== 'object') throw new Error('根对象无效')
  const o = raw as Record<string, unknown>
  const currentLevel = o.currentLevel
  if (typeof currentLevel !== 'number' || !Number.isInteger(currentLevel) || currentLevel < 0) {
    throw new Error('currentLevel 须为非负整数')
  }
  const inv = parseInventory(o.inventory)
  const levelRewards = parseLevelRewards(o.levelRewards)
  const history = parseHistory(o.history)
  const emitterTypes = Array.isArray(o.emitterTypes)
    ? (o.emitterTypes as unknown[]).map((t) => String(t).trim()).filter(Boolean)
    : undefined
  const gameState: GameState = {
    currentLevel,
    inventory: mergeInventory(inv),
    levelRewards,
    history,
    emitterTypes,
  }
  syncEmitterTypes(gameState)
  return gameState
}

/** 导出 / 存为默认用的 JSON 对象（history 不含多余字段） */
export function serializeStatePayload(state: GameState): GameState {
  return {
    currentLevel: state.currentLevel,
    inventory: state.inventory.map((e) => ({ ...e })),
    levelRewards: JSON.parse(JSON.stringify(state.levelRewards)) as Record<string, RewardEntry[]>,
    emitterTypes: [...(state.emitterTypes ?? [])],
    history: state.history.map(({ at, levelCleared, rewards, slotsBefore, slotsAfter }) => ({
      at,
      levelCleared,
      rewards: rewards.map((r) => ({ ...r })),
      slotsBefore,
      slotsAfter,
    })),
  }
}
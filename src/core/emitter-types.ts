import type { GameState } from './types'

function addType(set: Set<string>, name: string) {
  const t = name.trim()
  if (t) set.add(t)
}

/** 从库存、奖励、历史与 emitterTypes 合并为种类清单 */
export function syncEmitterTypes(state: GameState): void {
  const set = new Set<string>()
  for (const t of state.emitterTypes ?? []) addType(set, t)
  for (const e of state.inventory) addType(set, e.type)
  for (const rewards of Object.values(state.levelRewards)) {
    for (const r of rewards) addType(set, r.type)
  }
  for (const h of state.history) {
    for (const r of h.rewards) addType(set, r.type)
  }
  state.emitterTypes = [...set].sort((a, b) => a.localeCompare(b, 'zh-CN'))
}

function ensuredTypes(state: GameState): string[] {
  if (!state.emitterTypes) {
    syncEmitterTypes(state)
  }
  return state.emitterTypes!
}

export function typeOptionsForSelect(state: GameState, current: string): string[] {
  const types = [...ensuredTypes(state)]
  const cur = current.trim()
  if (cur && !types.includes(cur)) types.push(cur)
  return types.sort((a, b) => a.localeCompare(b, 'zh-CN'))
}

export function addEmitterType(state: GameState, name: string): string | null {
  const t = name.trim()
  if (!t) return '种类名称不能为空'
  const types = ensuredTypes(state)
  if (types.includes(t)) return '该种类已存在'
  types.push(t)
  types.sort((a, b) => a.localeCompare(b, 'zh-CN'))
  state.emitterTypes = types
  return null
}
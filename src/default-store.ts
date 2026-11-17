import { parseGameState, serializeStatePayload } from './state-io'
import type { GameState } from './core/types'

export const USER_DEFAULT_LS = 'emitter-calculator-user-default-v1'
export const CLOUD_PROJECT_DEFAULT = 'emitter-calculator-default'

const API_DEFAULT = '/api/default-state'

export function readUserDefaultFromLocal(): GameState | null {
  try {
    const raw = localStorage.getItem(USER_DEFAULT_LS)
    if (!raw) return null
    return parseGameState(JSON.parse(raw))
  } catch {
    return null
  }
}

export function writeUserDefaultToLocal(state: GameState): void {
  const payload = serializeStatePayload(state)
  localStorage.setItem(USER_DEFAULT_LS, JSON.stringify(payload, null, 2))
}

export function hasUserDefaultInLocal(): boolean {
  return !!localStorage.getItem(USER_DEFAULT_LS)
}

export function clearUserDefaultInLocal(): void {
  localStorage.removeItem(USER_DEFAULT_LS)
}

export async function fetchBundledDefaultJson(): Promise<unknown | null> {
  const base = import.meta.env.BASE_URL
  const urls = [`${base}data/default-state.json`, './data/default-state.json', '/data/default-state.json']
  for (const url of urls) {
    try {
      const res = await fetch(url, { cache: 'no-store' })
      if (res.ok) return await res.json()
    } catch {
      /* next */
    }
  }
  return null
}

export async function writeDefaultToLocalApi(state: GameState): Promise<boolean> {
  const payload = serializeStatePayload(state)
  try {
    const res = await fetch(API_DEFAULT, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload, null, 2),
    })
    return res.ok
  } catch {
    return false
  }
}

export type ZypLike = {
  isLoggedIn: () => boolean
  push: (projectId: string, data: unknown) => Promise<unknown>
  pull: (projectId: string) => Promise<{ data: unknown }>
}

export async function pushDefaultToCloud(state: GameState, zyp: ZypLike): Promise<void> {
  if (!zyp.isLoggedIn()) throw new Error('未登录')
  const payload = serializeStatePayload(state)
  await zyp.push(CLOUD_PROJECT_DEFAULT, payload)
}

export async function pullDefaultFromCloud(zyp: ZypLike): Promise<GameState | null> {
  if (!zyp.isLoggedIn()) return null
  const res = await zyp.pull(CLOUD_PROJECT_DEFAULT)
  if (!res?.data) return null
  return parseGameState(res.data)
}
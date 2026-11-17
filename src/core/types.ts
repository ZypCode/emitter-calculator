export interface InventoryEntry {
  type: string
  level: number
  count: number
}

export interface RewardEntry {
  type: string
  level: number
  count: number
}

export interface HistoryEntry {
  at: string
  levelCleared: number
  rewards: RewardEntry[]
  slotsBefore: number
  slotsAfter: number
}

export interface GameState {
  currentLevel: number
  inventory: InventoryEntry[]
  levelRewards: Record<string, RewardEntry[]>
  history: HistoryEntry[]
  /** 可选种类清单，导出时会保留；未写时从库存等处自动汇总 */
  emitterTypes?: string[]
}
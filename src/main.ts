import './style.css'
import { addEmitterType, syncEmitterTypes, typeOptionsForSelect } from './core/emitter-types'
import {
  addRewards,
  mergeInventory,
  totalSlots,
  validateRewards,
} from './core/merge'
import { bindCloudSync, cloudPullDefaultTemplate, cloudPushDefaultTemplate, renderCloudSyncCard } from './cloud-sync'
import {
  clearUserDefaultInLocal,
  fetchBundledDefaultJson,
  hasUserDefaultInLocal,
  readUserDefaultFromLocal,
  writeDefaultToLocalApi,
  writeUserDefaultToLocal,
} from './default-store'
import type { GameState, HistoryEntry, InventoryEntry, RewardEntry } from './core/types'
import { parseGameState, serializeStatePayload } from './state-io'
import defaultStateData from '../public/data/default-state.json'

let state: GameState | null = null
let toastTimer: ReturnType<typeof setTimeout> | null = null
let manualRewardDraft: RewardEntry[] = [{ type: '', level: 1, count: 1 }]

function resetManualRewardDraft() {
  const first = state?.emitterTypes?.[0] ?? ''
  manualRewardDraft = [{ type: first, level: 1, count: 1 }]
}

function readTypeFromRow(row: Element): string {
  const el = row.querySelector('[data-field="type"]') as HTMLSelectElement | HTMLInputElement | null
  return el?.value.trim() ?? ''
}

function renderTypeSelect(current: string, options: string[]): string {
  const opts = options
    .map(
      (t) =>
        `<option value="${escapeHtml(t)}"${t === current ? ' selected' : ''}>${escapeHtml(t)}</option>`,
    )
    .join('')
  const placeholderSelected = !current ? ' selected' : ''
  return `<select data-field="type" class="type-select"><option value="" disabled${placeholderSelected}>选择种类</option>${opts}</select>`
}

function readManualRewardsFromTable(): RewardEntry[] | string {
  const table = document.getElementById('manual-reward-table')
  if (!table) return '表单未就绪'
  const rows = table.querySelectorAll('tbody tr[data-reward-idx]')
  if (rows.length === 0) return '请至少添加一行奖励'
  const rewards: RewardEntry[] = []
  for (const row of rows) {
    const type = readTypeFromRow(row)
    const level = Number((row.querySelector('[data-field="level"]') as HTMLInputElement).value)
    const count = Number((row.querySelector('[data-field="count"]') as HTMLInputElement).value)
    if (!type) return '奖励种类不能为空'
    if (!Number.isInteger(level) || level < 1) return '奖励等级须为 ≥1 的整数'
    if (!Number.isInteger(count) || count < 1) return '奖励数量须为 ≥1 的整数'
    rewards.push({ type, level, count })
  }
  return rewards
}

function syncManualRewardDraftFromTable() {
  const table = document.getElementById('manual-reward-table')
  if (!table) return
  const rows = table.querySelectorAll('tbody tr[data-reward-idx]')
  const draft: RewardEntry[] = []
  rows.forEach((row) => {
    draft.push({
      type: readTypeFromRow(row),
      level: Number((row.querySelector('[data-field="level"]') as HTMLInputElement).value) || 1,
      count: Number((row.querySelector('[data-field="count"]') as HTMLInputElement).value) || 1,
    })
  })
  if (draft.length > 0) manualRewardDraft = draft
}

function showToast(message: string, kind: 'info' | 'error' | 'success' = 'info') {
  const el = document.getElementById('toast')
  if (!el) return
  el.textContent = message
  el.className = `toast ${kind === 'error' ? 'error' : kind === 'success' ? 'success' : ''}`
  el.hidden = false
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    el.hidden = true
  }, 4000)
}

function defaultSourceLabel(): string {
  if (hasUserDefaultInLocal()) return '本机覆盖的默认'
  return '仓库 default-state.json'
}

async function loadDefault() {
  const localUser = readUserDefaultFromLocal()
  if (localUser) {
    state = localUser
    showToast('已加载默认 JSON（本机覆盖）', 'success')
    render()
    return
  }
  try {
    const fromCloud = await cloudPullDefaultTemplate()
    if (fromCloud) {
      state = fromCloud
      writeUserDefaultToLocal(fromCloud)
      showToast('已加载默认 JSON（云端默认模板）', 'success')
      render()
      return
    }
  } catch {
    /* 未登录或云端无数据 */
  }
  const fileJson = await fetchBundledDefaultJson()
  if (fileJson) {
    state = parseGameState(fileJson)
    showToast('已加载默认 JSON（仓库文件）', 'success')
    render()
    return
  }
  state = parseGameState(defaultStateData)
  showToast('已加载默认 JSON（内嵌备份）', 'info')
  render()
}

async function updateUserDefault() {
  if (!state) return
  if (!window.confirm('将当前完整状态设为新的「默认 JSON」？之后「加载默认 JSON」会优先使用该配置。')) return
  writeUserDefaultToLocal(state)
  const parts: string[] = ['本机浏览器']
  if (await writeDefaultToLocalApi(state)) {
    parts.push('public/data/default-state.json')
  }
  try {
    await cloudPushDefaultTemplate(state)
    parts.push('云端默认模板')
  } catch {
    /* 未登录时忽略 */
  }
  showToast(`已更新默认 JSON：${parts.join('、')}`, 'success')
}

function resetToRepoDefault() {
  if (!window.confirm('清除本机默认覆盖，并从仓库 default-state.json 重新加载？')) return
  clearUserDefaultInLocal()
  void loadDefaultFromRepoFileOnly()
}

async function loadDefaultFromRepoFileOnly() {
  const fileJson = await fetchBundledDefaultJson()
  if (fileJson) {
    state = parseGameState(fileJson)
    showToast('已恢复为仓库 default-state.json', 'success')
  } else {
    state = parseGameState(defaultStateData)
    showToast('已恢复为内嵌默认', 'info')
  }
  render()
}

function exportJson() {
  if (!state) return
  const payload = serializeStatePayload(state)
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `emitter-state-L${state.currentLevel}.json`
  a.click()
  URL.revokeObjectURL(a.href)
  showToast('已导出 JSON', 'success')
}

function applyClearLevel(rewards: RewardEntry[], levelCleared: number) {
  if (!state) return
  const err = validateRewards(rewards)
  if (err) {
    showToast(err, 'error')
    return
  }
  const slotsBefore = totalSlots(state.inventory)
  const inventoryAfter = addRewards(state.inventory, rewards)
  const slotsAfter = totalSlots(inventoryAfter)
  const entry: HistoryEntry = {
    at: new Date().toISOString(),
    levelCleared,
    rewards: rewards.map((r) => ({ ...r })),
    slotsBefore,
    slotsAfter,
  }
  state.history = [...state.history, entry]
  state.inventory = inventoryAfter
  state.currentLevel = Math.max(state.currentLevel, levelCleared)
  resetManualRewardDraft()
  render()
  showToast(
    `已通过第 ${levelCleared} 关：占用格数 ${slotsBefore} → ${slotsAfter}（${slotsAfter - slotsBefore >= 0 ? '+' : ''}${slotsAfter - slotsBefore}）`,
    'success',
  )
}

function nextLevelRewards(): RewardEntry[] | null {
  if (!state) return null
  const next = String(state.currentLevel + 1)
  const rewards = state.levelRewards[next]
  return rewards?.length ? rewards : null
}

function renderEmitterTypesCard(): string {
  if (!state) return ''
  const types = state.emitterTypes ?? []
  return `
    <div class="card" style="margin-bottom:1rem">
      <h2>发射器种类</h2>
      <p class="hint">以下种类会出现在下拉框中；新增后点击添加，并会写入导出 JSON 的 emitterTypes。</p>
      <div class="type-tags" role="list">${types.length ? types.map((t) => `<span class="type-tag" role="listitem">${escapeHtml(t)}</span>`).join('') : '<span class="empty">暂无，请添加</span>'}</div>
      <div class="type-add-row">
        <input type="text" id="new-emitter-type" placeholder="输入新种类名称" />
        <button type="button" id="btn-add-emitter-type" class="primary">添加种类</button>
      </div>
    </div>`
}

function renderManualRewardEditor() {
  if (!state) return ''
  const rows = manualRewardDraft
    .map(
      (e, i) => `
      <tr data-reward-idx="${i}">
        <td>${renderTypeSelect(e.type, typeOptionsForSelect(state!, e.type))}</td>
        <td><input type="number" data-field="level" min="1" value="${e.level}" /></td>
        <td><input type="number" data-field="count" min="1" value="${e.count}" /></td>
        <td><button type="button" data-action="remove-manual-reward">删除</button></td>
      </tr>`,
    )
    .join('')
  return `
    <table id="manual-reward-table">
      <thead><tr><th>种类</th><th>等级</th><th>数量</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="toolbar" style="margin-top:0.75rem">
      <button type="button" id="btn-add-manual-reward">添加奖励行</button>
      <button type="button" id="btn-manual-apply" class="primary">应用本关全部奖励（关卡 +1）</button>
    </div>
    <p class="hint" style="margin-top:0.5rem">可添加多行，一次通关将合并计算并自动合成。</p>`
}

function renderInventoryEditor() {
  if (!state) return ''
  const rows = state.inventory
    .map(
      (e, i) => `
      <tr data-idx="${i}">
        <td>${renderTypeSelect(e.type, typeOptionsForSelect(state!, e.type))}</td>
        <td><input type="number" data-field="level" min="1" value="${e.level}" /></td>
        <td><input type="number" data-field="count" min="1" value="${e.count}" /></td>
        <td><button type="button" data-action="remove-row">删除</button></td>
      </tr>`,
    )
    .join('')
  return `
    <table id="inventory-table">
      <thead><tr><th>种类</th><th>等级</th><th>数量</th><th></th></tr></thead>
      <tbody>${rows || '<tr><td colspan="4" class="empty">暂无发射器</td></tr>'}</tbody>
    </table>
    <div class="toolbar" style="margin-top:0.75rem">
      <button type="button" id="btn-add-row">添加一行</button>
      <button type="button" id="btn-merge-inventory" class="primary">重新合成并保存库存</button>
    </div>`
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;')
}

function render() {
  const root = document.getElementById('app')
  if (!root || !state) return
  const slots = totalSlots(state.inventory)
  const next = state.currentLevel + 1
  const preset = nextLevelRewards()

  root.innerHTML = `
    <header>
      <h1>发射器库存计算器</h1>
      <p class="sub">同种类同等级 2 合 1，自动连缀合成；每个发射器占 1 格。当前<strong>已通关</strong>第 ${state.currentLevel} 关。</p>
    </header>
    <div id="toast" hidden></div>
    <p class="hint">默认配置来源：<strong>${defaultSourceLabel()}</strong> · 「更新默认 JSON」会把当前状态写成新的默认</p>
    <div class="toolbar">
      <button type="button" id="btn-reload">加载默认 JSON</button>
      <button type="button" id="btn-update-default" class="primary">更新默认 JSON</button>
      <button type="button" id="btn-reset-default">恢复仓库默认</button>
      <label class="file-btn">导入 JSON<input type="file" id="file-import" accept="application/json,.json" /></label>
      <button type="button" id="btn-export">导出 JSON</button>
    </div>
    ${renderCloudSyncCard()}
    <div class="cards">
      <div class="card">
        <h2>占用格数</h2>
        <div class="stat">${slots}</div>
        <p class="hint">合成后实时统计</p>
      </div>
      <div class="card">
        <h2>通关下一关（第 ${next} 关）</h2>
        ${
          preset
            ? `<p class="hint">配置奖励：${preset.map((r) => `${r.type} L${r.level}×${r.count}`).join('；')}</p>
               <button type="button" id="btn-apply-preset" class="primary">应用第 ${next} 关奖励并合成</button>`
            : `<p class="hint">未在 levelRewards["${next}"] 中配置奖励，请用手动奖励或编辑 JSON。</p>`
        }
      </div>
    </div>
    ${renderEmitterTypesCard()}
    <div class="card" style="margin-bottom:1rem">
      <h2>手动添加通关奖励</h2>
      ${renderManualRewardEditor()}
    </div>
    <div class="card" style="margin-bottom:1rem">
      <h2>当前库存</h2>
      ${renderInventoryEditor()}
    </div>
    <div class="card history">
      <h2>通关记录</h2>
      ${
        state.history.length === 0
          ? '<p class="empty">暂无记录</p>'
          : state.history
              .map(
                (h) => `
        <details>
          <summary>第 ${h.levelCleared} 关 · 格数 ${h.slotsBefore}→${h.slotsAfter} · ${h.at.slice(0, 19).replace('T', ' ')}</summary>
          <pre>${escapeHtml(JSON.stringify(h.rewards, null, 2))}</pre>
        </details>`,
              )
              .reverse()
              .join('')
      }
    </div>
  `

  bindEvents(preset)
  bindCloudSync({
    getState: () => state,
    setState: (s) => {
      state = s
      render()
    },
    toast: showToast,
  })
}

function bindEvents(preset: RewardEntry[] | null) {
  document.getElementById('btn-reload')?.addEventListener('click', () => void loadDefault())
  document.getElementById('btn-update-default')?.addEventListener('click', () => void updateUserDefault())
  document.getElementById('btn-reset-default')?.addEventListener('click', resetToRepoDefault)
  document.getElementById('btn-export')?.addEventListener('click', exportJson)
  document.getElementById('file-import')?.addEventListener('change', (ev) => {
    const file = (ev.target as HTMLInputElement).files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        state = parseGameState(JSON.parse(String(reader.result)))
        render()
        showToast(`已导入：${file.name}`, 'success')
      } catch (e) {
        showToast(e instanceof Error ? e.message : '解析 JSON 失败', 'error')
      }
    }
    reader.readAsText(file)
  })

  document.getElementById('btn-apply-preset')?.addEventListener('click', () => {
    if (!state || !preset) return
    applyClearLevel(preset, state.currentLevel + 1)
  })

  document.getElementById('btn-manual-apply')?.addEventListener('click', () => {
    if (!state) return
    const parsed = readManualRewardsFromTable()
    if (typeof parsed === 'string') {
      showToast(parsed, 'error')
      return
    }
    const err = validateRewards(parsed)
    if (err) {
      showToast(err, 'error')
      return
    }
    applyClearLevel(parsed, state.currentLevel + 1)
  })

  document.getElementById('btn-add-emitter-type')?.addEventListener('click', () => {
    if (!state) return
    const name = (document.getElementById('new-emitter-type') as HTMLInputElement).value
    const err = addEmitterType(state, name)
    if (err) {
      showToast(err, err.includes('已存在') ? 'info' : 'error')
      return
    }
    ;(document.getElementById('new-emitter-type') as HTMLInputElement).value = ''
    render()
    showToast(`已添加种类：${name.trim()}`, 'success')
  })

  document.getElementById('btn-add-manual-reward')?.addEventListener('click', () => {
    syncManualRewardDraftFromTable()
    const first = state?.emitterTypes?.[0] ?? ''
    manualRewardDraft.push({ type: first, level: 1, count: 1 })
    render()
  })

  document.getElementById('manual-reward-table')?.addEventListener('click', (ev) => {
    const t = ev.target as HTMLElement
    if (t.dataset.action !== 'remove-manual-reward') return
    syncManualRewardDraftFromTable()
    const tr = t.closest('tr')
    const idx = tr ? Number(tr.getAttribute('data-reward-idx')) : -1
    if (idx < 0) return
    if (manualRewardDraft.length <= 1) {
      showToast('至少保留一行奖励', 'info')
      return
    }
    manualRewardDraft.splice(idx, 1)
    render()
  })

  document.getElementById('btn-add-row')?.addEventListener('click', () => {
    if (!state) return
    syncEmitterTypes(state)
    const first = state.emitterTypes?.[0] ?? ''
    state.inventory.push({ type: first, level: 1, count: 1 })
    render()
  })

  document.getElementById('btn-merge-inventory')?.addEventListener('click', () => {
    if (!state) return
    const table = document.getElementById('inventory-table')
    if (!table) return
    const rows = table.querySelectorAll('tbody tr[data-idx]')
    const draft: InventoryEntry[] = []
    try {
      rows.forEach((row) => {
        const type = readTypeFromRow(row)
        const level = Number((row.querySelector('[data-field="level"]') as HTMLInputElement).value)
        const count = Number((row.querySelector('[data-field="count"]') as HTMLInputElement).value)
        if (!type) throw new Error('种类不能为空')
        if (!Number.isInteger(level) || level < 1) throw new Error('等级须为 ≥1 的整数')
        if (!Number.isInteger(count) || count < 1) throw new Error('数量须为 ≥1 的整数')
        draft.push({ type, level, count })
      })
      state.inventory = mergeInventory(draft)
      render()
      showToast('库存已更新并完成合成', 'success')
    } catch (e) {
      showToast(e instanceof Error ? e.message : '校验失败', 'error')
    }
  })

  document.getElementById('inventory-table')?.addEventListener('click', (ev) => {
    const t = ev.target as HTMLElement
    if (t.dataset.action === 'remove-row') {
      const tr = t.closest('tr')
      const idx = tr ? Number(tr.getAttribute('data-idx')) : -1
      if (!state || idx < 0) return
      state.inventory.splice(idx, 1)
      render()
    }
  })
}

function boot() {
  document.getElementById('app')!.innerHTML = '<p class="sub">正在加载…</p>'
  void loadDefault()
}

boot()
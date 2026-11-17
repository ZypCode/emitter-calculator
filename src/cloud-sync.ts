import {
  CLOUD_PROJECT_DEFAULT,
  pullDefaultFromCloud,
  pushDefaultToCloud,
  type ZypLike,
} from './default-store'
import { parseGameState, serializeStatePayload } from './state-io'
import type { GameState } from './core/types'

export const SYNC_PROJECT_ID = 'emitter-calculator'

type ZypSyncApi = ZypLike & {
  enabled: () => boolean
  apiBase: () => string
  setApi: (url: string) => void
  getUsername: () => string
  logout: () => void
  health: () => Promise<unknown>
  register: (u: string, p: string) => Promise<unknown>
  login: (u: string, p: string) => Promise<unknown>
}

declare global {
  const ZypSync: ZypSyncApi
  const DEFAULT_SYNC_API: string | undefined
}

function zyp(): ZypSyncApi | null {
  return typeof ZypSync !== 'undefined' ? ZypSync : null
}

export function renderCloudSyncCard(): string {
  const defaultApi =
    typeof DEFAULT_SYNC_API !== 'undefined' && DEFAULT_SYNC_API ? DEFAULT_SYNC_API : ''
  return `
    <details class="card" style="margin-bottom:1rem" id="cloud-details">
      <summary style="cursor:pointer;font-weight:600">云同步（可选 · 与 score-planner 共用 Worker）</summary>
      <p class="hint" style="margin-top:0.75rem">用于多设备同步<strong>当前进度</strong>（<code>${SYNC_PROJECT_ID}</code>）。<strong>「更新默认 JSON」</strong>在登录后会额外写入云端默认模板（<code>${CLOUD_PROJECT_DEFAULT}</code>）。</p>
      <label class="cloud-api-row">API 地址<input type="url" id="in-cloud-api" value="${defaultApi.replace(/"/g, '&quot;')}" autocomplete="off" /></label>
      <div class="toolbar" style="margin-top:0.5rem">
        <button type="button" id="btn-cloud-save-api">保存 API</button>
        <span id="cloud-status" class="hint"></span>
      </div>
      <div class="cloud-login-row">
        <input type="text" id="in-cloud-user" placeholder="用户名" autocomplete="username" />
        <input type="password" id="in-cloud-pass" placeholder="密码" autocomplete="current-password" />
        <button type="button" id="btn-cloud-login">登录</button>
        <button type="button" id="btn-cloud-register">注册</button>
        <button type="button" id="btn-cloud-logout">退出</button>
      </div>
      <p id="cloud-auth-line" class="hint"></p>
      <div class="toolbar">
        <button type="button" id="btn-cloud-pull">拉取当前进度</button>
        <button type="button" id="btn-cloud-push">上传当前进度</button>
      </div>
    </details>`
}

function updateCloudUi() {
  const z = zyp()
  const status = document.getElementById('cloud-status')
  const auth = document.getElementById('cloud-auth-line')
  const pullBtn = document.getElementById('btn-cloud-pull') as HTMLButtonElement | null
  const pushBtn = document.getElementById('btn-cloud-push') as HTMLButtonElement | null
  if (!z || !status) return
  if (!z.enabled()) {
    status.textContent = '未配置 API'
    if (auth) auth.textContent = ''
    if (pullBtn) pullBtn.disabled = true
    if (pushBtn) pushBtn.disabled = true
    return
  }
  if (z.isLoggedIn()) {
    status.textContent = '已连接'
    if (auth) auth.textContent = '账号：' + (z.getUsername() || '—')
    if (pullBtn) pullBtn.disabled = false
    if (pushBtn) pushBtn.disabled = false
  } else {
    status.textContent = 'API：' + z.apiBase()
    if (auth) auth.textContent = '未登录'
    if (pullBtn) pullBtn.disabled = true
    if (pushBtn) pushBtn.disabled = true
  }
}

export function bindCloudSync(deps: {
  getState: () => GameState | null
  setState: (s: GameState) => void
  toast: (msg: string, kind: 'info' | 'error' | 'success') => void
}) {
  const apiIn = document.getElementById('in-cloud-api') as HTMLInputElement | null
  if (apiIn && !apiIn.value && zyp()?.enabled()) {
    apiIn.value = zyp()!.apiBase()
  }

  const readCred = () => ({
    user: (document.getElementById('in-cloud-user') as HTMLInputElement)?.value.trim() ?? '',
    pass: (document.getElementById('in-cloud-pass') as HTMLInputElement)?.value ?? '',
  })

  document.getElementById('btn-cloud-save-api')?.addEventListener('click', () => {
    const z = zyp()
    if (!z) return
    const url = apiIn?.value.trim() ?? ''
    if (!url) {
      z.setApi('')
      deps.toast('已清除 API', 'info')
      updateCloudUi()
      return
    }
    z.setApi(url)
    z.health()
      .then(() => deps.toast('API 可用', 'success'))
      .catch(() => deps.toast('API 无法访问', 'error'))
      .finally(updateCloudUi)
  })

  document.getElementById('btn-cloud-login')?.addEventListener('click', () => {
    const z = zyp()
    if (!z?.enabled()) {
      deps.toast('请先保存 API', 'error')
      return
    }
    const { user, pass } = readCred()
    z.login(user, pass)
      .then(() => deps.toast('登录成功', 'success'))
      .catch((e: Error) => deps.toast(e.message || '登录失败', 'error'))
      .finally(updateCloudUi)
  })

  document.getElementById('btn-cloud-register')?.addEventListener('click', () => {
    const z = zyp()
    if (!z?.enabled()) {
      deps.toast('请先保存 API', 'error')
      return
    }
    const { user, pass } = readCred()
    z.register(user, pass)
      .then(() => deps.toast('注册成功', 'success'))
      .catch((e: Error) => deps.toast(e.message || '注册失败', 'error'))
      .finally(updateCloudUi)
  })

  document.getElementById('btn-cloud-logout')?.addEventListener('click', () => {
    zyp()?.logout()
    deps.toast('已退出', 'info')
    updateCloudUi()
  })

  document.getElementById('btn-cloud-pull')?.addEventListener('click', () => {
    const z = zyp()
    if (!z?.isLoggedIn()) {
      deps.toast('请先登录', 'error')
      return
    }
    z.pull(SYNC_PROJECT_ID)
      .then((res) => {
        if (!res?.data) {
          deps.toast('云端暂无进度', 'info')
          return
        }
        deps.setState(parseGameState(res.data))
        deps.toast('已拉取当前进度', 'success')
      })
      .catch((e: Error) => deps.toast(e.message || '拉取失败', 'error'))
  })

  document.getElementById('btn-cloud-push')?.addEventListener('click', () => {
    const z = zyp()
    const s = deps.getState()
    if (!z?.isLoggedIn() || !s) {
      deps.toast('请先登录', 'error')
      return
    }
    z.push(SYNC_PROJECT_ID, serializeStatePayload(s))
      .then(() => deps.toast('已上传当前进度', 'success'))
      .catch((e: Error) => deps.toast(e.message || '上传失败', 'error'))
  })

  updateCloudUi()
}

export function getZypSync(): ZypSyncApi | null {
  return zyp()
}

export async function cloudPushDefaultTemplate(state: GameState): Promise<void> {
  const z = zyp()
  if (!z?.isLoggedIn()) throw new Error('未登录')
  await pushDefaultToCloud(state, z)
}

export async function cloudPullDefaultTemplate(): Promise<GameState | null> {
  const z = zyp()
  if (!z?.isLoggedIn()) return null
  return pullDefaultFromCloud(z)
}
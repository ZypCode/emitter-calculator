# 发射器库存计算器

Web 工具：读取 JSON 初始库存与关卡奖励，通关后自动按「同种类 + 同等级 2 合 1」连缀合成，并统计占用格数。

## 日常使用（推荐）

1. 编辑 **`public/data/default-state.json`**
2. 双击 **`打开计算器.bat`**（或执行 `npm run open`）
3. 改完 JSON 后，在浏览器里 **F5 刷新** 或点 **「加载默认 JSON」**，无需再执行打包命令

> 浏览器安全限制：直接用 `file://` 打开 HTML **不能**自动读取旁边的 JSON，因此通过本机极轻量页面服务读取配置（仅本机 `127.0.0.1`，不对外网开放）。

只有修改了 **程序代码 / 样式** 时才需要：

```bash
npm run build:offline
```

## 开发模式

```bash
cd emitter-calculator
npm install
npm run dev
```

## GitHub Pages

推送到 `main` 后，由 [`.github/workflows/pages.yml`](.github/workflows/pages.yml) 自动构建并部署。

- 构建：`npm run build:pages`（`base` 为 `/emitter-calculator/`）
- 访问：`https://<GitHub 用户名或组织>.github.io/emitter-calculator/`

首次使用需在仓库 **Settings → Pages → Build and deployment** 中选择 **GitHub Actions**。

## 默认 JSON 与「更新默认 JSON」

| 环境 | 「加载默认 JSON」 | 「更新默认 JSON」 |
|------|-------------------|-------------------|
| `npm run dev` / `打开计算器.bat` | 优先本机覆盖 → 仓库 `public/data/default-state.json` | 可写回本机文件 + 浏览器覆盖 |
| GitHub Pages | 本机覆盖 → 线上 `default-state.json` → 内嵌 | 浏览器覆盖；登录云同步后可写云端默认模板 |

点击 **「更新默认 JSON」** 会把**当前完整状态**存为新的默认；**「恢复仓库默认」** 清除本机覆盖并重新读仓库文件。

## 云同步（步骤 4）

与 [score-planner](https://github.com/ZypCode/score-planner) 共用 Cloudflare Worker。页面底部可登录后 **上传/拉取当前进度**；更新默认时在登录状态下会同步到云端 `emitter-calculator-default`。

## 数据文件

- `currentLevel`：已通关的最高关卡。
- `inventory`：`{ type, level, count }[]`，载入与应用奖励后会自动合成。
- `levelRewards`：键为关卡号字符串（如 `"4"`），值为该关通关奖励列表。
- `history`：应用奖励时自动追加。

## 测试

```bash
node scripts/test-merge.mjs
```
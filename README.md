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

## 数据文件

- `currentLevel`：已通关的最高关卡。
- `inventory`：`{ type, level, count }[]`，载入与应用奖励后会自动合成。
- `levelRewards`：键为关卡号字符串（如 `"4"`），值为该关通关奖励列表。
- `history`：应用奖励时自动追加。

## 测试

```bash
node scripts/test-merge.mjs
```
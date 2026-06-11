---
name: static-site-deployer
description: "Self-hosted static site deployment API service. Use when: (1) Deploying static HTML/CSS/JS sites from zip files or raw content, (2) Creating a deployment API that multiple agents can call, (3) Needing a lightweight alternative to Coolify/Netlify/Vercel for static content, (4) Setting up a direct deploy flow without GitHub intermediation. Deploys to a local HTTP server and returns a URL. Auto-detect Feishu file attachments and deploy them."
---

# Static Site Deployer 🦐

A lightweight, self-hosted static site deployment service. Accepts zip files or raw HTML content via REST API and serves them immediately.

**→ 所有 Agent 共享！** 部署一次，所有 Agent（虾宝、马冬梅、夏洛克）都能通过 HTTP API 调用。

---

## Architecture

```
Agent ──POST──▶ Deploy API (port 3456) ──▶ static-sites/{id}/ ──▶ HTTP Server (port 3457)
  │                                                    ▲
  └─── Feishu zip upload ───▶ auto-deploy ─────────────┘
```

- **API Server**: Express on port `3456`, handles deploy/list/delete
- **Static Server**: Express on port `3457`, serves deployed files
- **Storage**: `~/.openclaw/workspace/static-sites/{id}/`
- **Auth**: Bearer token (set `STATIC_AUTH_TOKEN`)
- **Auto-start**: systemd user service

---

## 🔌 Feishu 集成 — 在聊天框发 zip 自动部署

**这是虾宝特有的能力**——当用户在飞书聊天中发送 zip 文件时：

### 工作流

1. 用户发消息附带 zip 文件
2. 虾宝识别出是静态网站项目（HTML/CSS/JS）
3. 从飞书消息中获取文件信息
4. 下载文件到本地临时目录
5. 调用 `POST /api/deploy` 部署
6. 回复用户部署 URL

### 虾宝的实现方式

```markdown
当用户在飞书发了一条带附件/文件的消息：

1. 查看消息里的 file key / file token
2. 用 `message.download` 或 Feishu 文件 API 获取文件内容
3. 如果文件是 .zip 格式 → 保存到临时路径 → 调 deploy API
4. 回复用户部署完成的消息 + URL

注意：优先识别以 .zip 结尾或 Content-Type 为 application/zip 的附件
```

---

## 🤖 Agent 工作流示例

### 示例 1：马冬梅 — 写完日报自动部署

```markdown
场景：马冬梅（ai-writer）每天早上 7:00 生成 AI 科技日报

工作流：
1. 使用 Tavily + SearXNG 搜索最新 AI 新闻
2. 整理成一份漂亮的 HTML 日报（含样式、链接、时间线）
3. 调用 deploy API 部署：

   curl -X POST http://localhost:3456/api/deploy/html \
     -H "Authorization: Bearer $STATIC_AUTH_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "content": "<html>完整的日报内容...</html>",
       "id": "ai-daily-2026-06-11"
     }'

4. 拿到返回的 URL → 直接发到飞书群
5. ✅ 不用 GitHub，不用推代码，一步到位
```

### 示例 2：夏洛克 — 股票报告可视化

```markdown
场景：夏洛克生成带图表的股票分析报告

工作流：
1. 分析股票数据，生成带图表的 HTML 报告
2. 将 HTML 和关联资源打包成 zip
3. 调用 deploy API 上传 zip：

   curl -X POST http://localhost:3456/api/deploy \
     -H "Authorization: Bearer $STATIC_AUTH_TOKEN" \
     -F "file=@/tmp/stock-report.zip" \
     -F "id=stock-analysis-tsla-20260611"

4. 分享 URL 给用户
5. 用户可以直接在浏览器中查看完整的可视化报告
```

### 示例 3：虾宝 — 用户发 zip 直接部署

```markdown
用户发来一个 "帮我部署这个页面" 并附带 zip 文件：

虾宝执行：
1. 检测附件为 zip → 下载到 /tmp/xxx.zip
2. 调 deploy API：

   curl -X POST http://localhost:3456/api/deploy \
     -H "Authorization: Bearer $TOKEN" \
     -F "file=@/tmp/xxx.zip" \
     -F "id=custom-site-name"

3. 回复用户：
   🦐 部署好啦！
   📍 https://sites.example.com/custom-site-name
   📁 共 12 个文件
```

---

## 🚀 Quick Start

### Start the server (already running as systemd service)

```bash
# Check status
systemctl --user status static-site-deployer

# View logs
tail -f ~/.openclaw/workspace/logs/static-deployer.log
```

### Using the CLI

```bash
# Deploy a zip
cd ~/.openclaw/workspace/awesome-leo-skills/static-site-deployer
STATIC_AUTH_TOKEN=xxx node scripts/deploy.mjs deploy-zip ./site.zip --id my-site

# Deploy HTML
STATIC_AUTH_TOKEN=xxx node scripts/deploy.mjs deploy-content --content "<h1>Hi</h1>" --id hello

# List sites
STATIC_AUTH_TOKEN=xxx node scripts/deploy.mjs list
```

### Using the REST API (from any agent)

```bash
# Health
curl http://localhost:3456/api/health

# Deploy zip (multipart upload)
curl -X POST http://localhost:3456/api/deploy \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@./dist.zip" -F "id=my-site"

# Deploy raw HTML
curl -X POST http://localhost:3456/api/deploy/html \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content":"<h1>Hello</h1>","id":"hello"}'

# List all sites
curl -H "Authorization: Bearer $TOKEN" http://localhost:3456/api/sites
```

---

## API Reference

See [references/api.md](references/api.md) for full API documentation.

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/deploy` | Upload zip file (multipart) |
| `POST` | `/api/deploy/html` | Deploy raw HTML (JSON) |
| `POST` | `/api/deploy/url` | Deploy zip from a URL |
| `GET` | `/api/sites` | List all deployed sites |
| `GET` | `/api/sites/:id` | Get site details |
| `DELETE` | `/api/sites/:id` | Delete a site |
| `GET` | `/api/health` | Health check |

---

## Programmatic Usage (for scripts and agents)

```javascript
// Any agent's Node.js script can be this simple:
const TOKEN = 'your-token';
const API = 'http://localhost:3456';

async function deployHTML(html, id) {
  const res = await fetch(`${API}/api/deploy/html`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ content: html, id }),
  });
  return res.json(); // { id, url, fileCount }
}

async function deployZip(zipPath, id) {
  const form = new FormData();
  form.append('file', await fs.promises.readFile(zipPath), 'site.zip');
  if (id) form.append('id', id);
  const res = await fetch(`${API}/api/deploy`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${TOKEN}` },
    body: form,
  });
  return res.json();
}

// Usage:
const { url } = await deployHTML('<h1>Report</h1>', 'daily-report');
console.log(`Deployed at: ${url}`);
```

---

## Configuration

| Env Variable | Default | Description |
|---|---|---|
| `STATIC_API_PORT` | `3456` | API server port |
| `STATIC_SERVE_PORT` | `3457` | Static file server port |
| `STATIC_SITES_DIR` | `~/.openclaw/workspace/static-sites/` | Storage directory |
| `STATIC_AUTH_TOKEN` | (set during install) | Bearer token |
| `STATIC_PUBLIC_URL` | `http://localhost:3457` | Public base URL |

---

## Installation (one-time)

```bash
curl -fsSL https://raw.githubusercontent.com/flyingcloud-code/awesome-leo-skills/main/static-site-deployer/scripts/install.sh | bash
```

Or manual:

```bash
cd ~/.openclaw/workspace/skills/static-site-deployer
npm install
bash scripts/install.sh
```

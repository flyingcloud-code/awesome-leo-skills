---
name: static-site-deployer
description: "Self-hosted static site deployment API service. Use when: (1) Deploying static HTML/CSS/JS sites from zip files or raw content, (2) Creating a deployment API that multiple agents can call, (3) Needing a lightweight alternative to Coolify/Netlify/Vercel for static content, (4) Setting up a direct deploy flow without GitHub intermediation. Deploys to a local HTTP server and returns a URL. Auto-detect Feishu file attachments and deploy them."
---

# Static Site Deployer 🦐

A lightweight, self-hosted static site deployment service. Accepts zip files or raw HTML content via REST API and serves them immediately.

**→ 所有 Agent 共享！** 可在多台机器之间使用。

---

## Architecture

虾宝的机器（运行 API + 静态服务）：

```
Agent ──POST──▶ Deploy API (port 1099) ──▶ static-sites/{id}/ ──▶ HTTP Server (port 3457)
  │                                                    ▲
  ├── 本机: 47.85.20.56:1099                              │
  ├── 远程: SSH 隧道 / Cloudflare Tunnel ───────────────┘
  └── 多机: sessions_send 传文件给虾宝
```

---

## 多机部署方案

其他机器上的 Agent 直接访问公网 API：

```bash
# 从任何机器部署静态页面
curl -X POST http://47.85.20.56:1099/api/deploy \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@./site.zip" \
  -F "id=my-site"

# 返回：
# { "id": "my-site", "url": "http://47.85.20.56:1099/my-site", ... }
```

### 当前配置

| 项目 | 值 |
|------|-----|
| 虾宝服务器 | 47.85.20.56 |
| API + 静态端口 | **1099**（公网） |
| Auth Token | `f2769dfb4d957d5de9efe305752ca3b6` |

### CLI 用法（从其他机器）

```bash
# 设置环境变量
export STATIC_API_URL=http://47.85.20.56:1099
export STATIC_AUTH_TOKEN=f2769dfb4d957d5de9efe305752ca3b6

# 部署 zip
node deploy.mjs deploy-zip ./my-site.zip --id my-site

# 部署 HTML
node deploy.mjs deploy-content --content "<h1>Hello</h1>" --id hello

# 列出站点
node deploy.mjs list
```

### 直接 curl（其他机器）

```bash
# 部署 zip
curl -X POST http://47.85.20.56:1099/api/deploy \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@./site.zip" \
  -F "id=my-site"

# 部署原始 HTML
curl -X POST http://47.85.20.56:1099/api/deploy/html \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content":"<h1>Hello</h1>","id":"hello"}'

# 查看部署好的页面
# 浏览器访问 http://47.85.20.56:1099/my-site/
```

## 方案 A：SSH 隧道（推荐，最安全）

其他机器执行：
```bash
ssh -L 1099:47.85.20.56:1099 root@47.85.20.56
# 然后在本机：curl http://47.85.20.56:1099/api/deploy ...
```

或者用 SSH 隧道 + 直接执行部署（一行搞定）：
```bash
ssh root@47.85.20.56 "curl -s -X POST http://47.85.20.56:1099/api/deploy \
  -H 'Authorization: Bearer \$STATIC_AUTH_TOKEN' \
  -F 'file=@-'" < ./site.zip
```

### 方案 B：Cloudflare Tunnel（免费，有 SSL）

在虾宝的机器上装 cloudflared：
```bash
# 安装
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /usr/local/bin/cloudflared
chmod +x /usr/local/bin/cloudflared

# 创建隧道（把 sites.你的域名.com 指向 3457）
cloudflared tunnel create static-sites
cloudflared tunnel route dns static-sites sites.你的域名.com

# 配置文件 /etc/cloudflared/config.yml
# tunnel: static-sites
# ingress:
#   - hostname: api.sites.你的域名.com
#     service: http://47.85.20.56:1099
#   - hostname: sites.你的域名.com  
#     service: http://localhost:3457
#   - service: http_status:404

# 启动
cloudflared tunnel run static-sites
```

配置好后，其他机器直接：
```bash
STATIC_API_URL=https://api.sites.你的域名.com \
STATIC_AUTH_TOKEN=xxx \
node deploy.mjs deploy-zip ./site.zip
```

### 方案 C：Agent 互传（无需网络打通）

其他 Agent 通过 OpenClaw 的消息系统发给虾宝：

```markdown
其他 Agent 发消息给虾宝（sessions_send）：
  "虾宝，请帮我部署这个页面"
  + 附上文件或 URL

虾宝收到后：
  1. 下载文件
  2. 调 POST /api/deploy 
  3. 把 URL 回复给那个 Agent
```

完全不需要网络互通，但走的是消息通道，不适合大文件。

---

## 实际操作示例

### 当前配置

| 项目 | 值 |
|------|-----|
| 虾宝服务器 | 47.85.20.56 |
| API 端口 | 1099（内网 / 隧道访问） |
| 静态端口 | 3457 |
| Auth Token | 存在 systemd 环境变量里 |

### 本地 CLI 用法

```bash
# 从本机
STATIC_AUTH_TOKEN=xxx node scripts/deploy.mjs deploy-zip ./site.zip --id my-site

# 查看当前配置
STATIC_AUTH_TOKEN=xxx node scripts/deploy.mjs config
```

### 远程 CLI 用法（通过 SSH 隧道）

```bash
# 在另一台电脑上
export STATIC_API_URL=http://47.85.20.56:1099  # 本地 SSH 隧道端口
export STATIC_AUTH_TOKEN=xxx

# 部署 zip
node deploy.mjs deploy-zip ./my-site.zip --id my-site

# 部署原始 HTML
node deploy.mjs deploy-content --content "<h1>Hello</h1>" --id hello

# 列出站点
node deploy.mjs list
```

### 直接 curl（远程，通过隧道）

```bash
curl -X POST http://47.85.20.56:1099/api/deploy \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@./site.zip" \
  -F "id=my-site"
```

---

## Agent 工作流示例

### 示例 1：马冬梅 — 写完日报自动部署

```markdown
1. 使用 Tavily + SearXNG 搜索最新 AI 新闻
2. 整理成 HTML 日报
3. 调 deploy API：

   curl -X POST http://47.85.20.56:1099/api/deploy/html \
     -H "Authorization: Bearer $STATIC_AUTH_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"content":"<html>完整的日报内容...</html>","id":"ai-daily-2026-06-11"}'

4. 拿到返回的 URL → 直接发到飞书
```

### 示例 2：夏洛克 — 股票报告可视化

```markdown
1. 分析股票数据，生成带图表的 HTML
2. 将 HTML 和资源打包成 zip
3. 调 deploy API 上传 zip
4. 分享 URL 给用户（浏览器查看完整可视化报告）
```

### 示例 3：虾宝 — 用户发 zip 直接部署

```markdown
用户发来 "帮我部署这个页面" + zip 文件：

1. 检测附件为 zip → 保存到 /tmp/
2. 调 deploy API
3. 回复用户：URL + 文件数
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
| `GET` | `/api/sites/:id` | Get site details / file listing |
| `DELETE` | `/api/sites/:id` | Delete a site |
| `GET` | `/api/health` | Health check |

---

## Configuration

| Env Variable | Default | Description |
|---|---|---|
| `STATIC_API_URL` | `http://47.85.20.56:1099` | API server URL (for CLI/agents) |
| `STATIC_API_PORT` | `1099` | API server port |
| `STATIC_SERVE_PORT` | `3457` | Static file server port |
| `STATIC_SITES_DIR` | `~/.openclaw/workspace/static-sites/` | Storage directory |
| `STATIC_AUTH_TOKEN` | (set during install) | Bearer token for auth |
| `STATIC_PUBLIC_URL` | `http://localhost:3457` | Public base URL for deployed sites |
| `STATIC_MAX_SIZE` | `52428800` (50MB) | Max upload size |
| `STATIC_CORS` | `*` | CORS origin |

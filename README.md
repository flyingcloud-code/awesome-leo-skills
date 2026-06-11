# 🦐 Awesome Leo Skills

Leo 的 Agent Skills 集合。所有技能设计用于 [OpenClaw](https://github.com/openclaw/openclaw) 生态，让 AI Agent 变得更强大。

## Skills

| Skill | 用途 | 适用 Agent |
|-------|------|-----------|
| [static-site-deployer](./static-site-deployer/) | 🔥 自托管静态网页部署 API | 虾宝、马冬梅、夏洛克...任何 Agent |
| [daily-strategy-review](./daily-strategy-review/) | 量化策略每日表现回顾 | 夏洛克 |
| [feishu-message-formatter](./feishu-message-formatter/) | 飞书消息格式化 | 通用 |
| [html-agent-communication](./html-agent-communication/) | 通过 HTML 进行 Agent 通信 | 通用 |
| [html-to-xhs-cards](./html-to-xhs-cards/) | HTML 转小红书卡片 | 通用 |
| [idea-capture](./idea-capture/) | 灵感捕捉与 Obsidian 归档 | 通用 |
| [jq-strategy-research](./jq-strategy-research/) | 聚宽策略研究 | 夏洛克 |

## Usage

```bash
# Clone the repo
git clone https://github.com/flyingcloud-code/awesome-leo-skills.git

# Skills are in their own directories
ls awesome-leo-skills/
```

Each skill has its own `SKILL.md` with full documentation.

## Agent Integration

这些 Skill 设计为 **Agent 共享**——安装一次，所有 Agent 都能使用。

例如 [static-site-deployer](./static-site-deployer/)：
- 虾宝：在飞书聊天收 zip 文件 → 自动部署 → 返回 URL
- 马冬梅：写完 AI 日报 → 调 API 发布 → 飞书分享
- 夏洛克：生成股票可视化报告 → 调 API 发布 → 分享链接

# Idea Capture Skill

随时随地记录想法，每日自动归档到 Obsidian Vault。

## 功能特性

- ✅ **自然语言触发** - 说"存：xxx"或"idea xxx"自动保存
- ✅ **Tag 自动生成** - 根据内容自动识别（技术/投资/生活/创作/学习）
- ✅ **每日归档提醒** - 21:00 自动归档，并提醒今日标签
- ✅ **每日自动归档** - Markdown 格式，Git 版本控制
- ✅ **全文搜索** - inbox + 归档文件
- ✅ **统计数据查看** - 今日记录数、标签云

## 触发方式（自然语言）

### 方式1：直接说 "存："（最自然）

```
存：刚刚想到 Skill 的触发方式应该更自然一些
存：AI Agent 的记忆系统应该分三层
存：股票策略需要优化，关注突破信号
```

### 方式2：说 "idea"

```
idea 想到一个新功能
idea 今天开会的一个感悟
```

### 方式3：说 "记录一下" / "记一下" / "帮我存"

```
记录一下：这个方案我觉得可行
记录一下 刚才看到的一篇文章很有启发
记一下这些想法
帮我存下这个想法
```

### 方式4：虾宝主动识别（关键词触发）

当对话中出现以下关键词时，虾宝会主动询问是否保存：
- "有个想法"
- "想到一个"
- "记一下"
- "帮我存"
- "这个想法"

**示例**：
```
Leo: "有个想法，关于公众号定位..."
虾宝: "要用 Idea Capture 存下来吗？回复'存'即可保存"
```

### 方式5：带手动标签（可选）

```
存：股票策略优化 --tags 投资,股票
存：AI 架构想法 --tags AI,架构
```

**注意**：如果不加 `--tags`，系统会自动根据内容识别标签。

## 目录结构

```
~/.openclaw/workspace/skills/idea-capture/
├── SKILL.md              # 本文件
├── config.json           # 配置文件
├── scripts/
│   ├── capture.mjs      # 捕获想法
│   ├── archive.mjs      # 每日归档
│   └── search.mjs       # 搜索想法
├── templates/
│   └── daily-ideas-template.md
└── data/
    └── inbox.json       # 当日暂存

/Users/Shared/obsidian_share/leo-ideas/    # Vault 目录
├── .git/                 # Git 仓库
├── .obsidian/            # Obsidian 配置
├── 00-Inbox/             # 收件箱
├── 01-Daily/             # 每日归档
├── 02-Projects/          # 项目想法
├── 03-Areas/             # 领域分类
├── 04-Resources/         # 参考资料
├── 05-Archive/           # 历史归档
├── Templates/            # 模板
└── MOC/                  # 索引
```

## 使用方法

### 飞书/对话中使用（推荐）

直接发消息给虾宝：

```
存：刚刚想到 Skill 的触发方式应该更自然一些
存：AI Agent 的记忆系统应该分三层
存：股票策略需要优化，关注突破信号 --tags 投资
```

虾宝会回复：
```
✅ 想法已保存
🏷️ 标签: 技术, Skill优化
📊 今日: 3 条想法
🏷️ 今日标签: #技术 #投资 #Skill优化
📝 刚刚想到 Skill 的触发方式应该更自然一些...
```

### CLI 使用

```bash
# 快速保存
node scripts/save-idea.mjs "想法内容"

# 带标签
node scripts/capture.mjs "想法内容" --tags "标签1,标签2"

# 查看今日
node scripts/archive.mjs --today

# 手动归档
node scripts/archive.mjs

# 搜索
node scripts/search.mjs "关键词"
```

## 自动归档

每天 23:50 自动执行归档（睡前归档，给全天记录留足时间）：

```bash
openclaw cron add \
  --cron "50 23 * * *" \
  --name "idea-daily-archive" \
  --message "归档今日想法到 Obsidian" \
  --session isolated \
  --announce \
  --channel feishu \
  --tz "Asia/Shanghai"
```

## GitHub 仓库配置

1. 在 GitHub 创建私有仓库 `leo-ideas-vault`
2. 添加远程仓库：

```bash
cd /Users/Shared/obsidian_share/leo-ideas
git remote add origin https://github.com/<username>/leo-ideas-vault.git
git push -u origin main
```

## Obsidian 使用

1. 打开 Obsidian
2. 选择 "Open folder as vault"
3. 选择 `/Users/Shared/obsidian_share/leo-ideas/`
4. 安装推荐插件：
   - Periodic Notes
   - Templater
   - Dataview
   - Obsidian Git

## 配置

编辑 `config.json`：

```json
{
  "vault_path": "/Users/Shared/obsidian_share/leo-ideas",
  "github_repo": "leo-ideas-vault",
  "daily_folder": "01-Daily",
  "archive_time": "21:00"
}
```

## 注意事项

- 想法先存入 inbox.json，每日 21:00 自动归档到 Vault
- Git 提交信息包含日期和想法数量
- 支持手动触发归档（测试用）
- 搜索功能同时搜索 inbox 和已归档文件
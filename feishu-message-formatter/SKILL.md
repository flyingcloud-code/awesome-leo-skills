---
name: feishu-message-formatter
description: 将 Markdown（含表格）转换为飞书 Card JSON 2.0 原生 table 组件，发送卡片消息。
version: v2.1.0
---

# Feishu Message Formatter

将 Markdown（含表格、结构化内容）转换为飞书 Card JSON 2.0 原生组件，通过飞书 API 发送卡片消息。

## 触发条件（必须遵守 — 最高优先级）

**所有发往飞书的消息，无论是否含表格，都必须先调本 skill 发送，不得直接走 Hermes gateway 的 `send_message` 工具。**

检查 prompt 中的输出 — 如果有任何结构化内容（表格、列表、对比数据、key-value 对），立刻切换到此 skill 用卡片格式发送。纯文本一句话聊天可以不卡片化，但任何带格式的消息都走卡片。

**铁律：用户如果说了"你输出为啥不用卡片"这类话，立刻反省是否漏调本 skill，下次绝不再犯。**

**常见陷阱：自以为是"没表格就不需要卡片"。你的输出判断不可靠——你觉得是纯文本，用户可能想要卡片。有疑问时一律走卡片。**

## 为什么需要这个 Skill

Hermes Feishu gateway 的 `_build_outbound_payload()` 方法（`gateway/platforms/feishu.py:4234`）检测到 `_MARKDOWN_TABLE_RE` 后，强制将整段内容降级为 `msg_type="text"`（纯文本）。原因是 Feishu `post` 类型的 `md` 元素不支持 Markdown 表格语法，发送表格内容会导致客户端显示空白消息。

本 skill 绕过 gateway 的降级逻辑，直接调用飞书 Open API 发送 `msg_type="interactive"` 的卡片消息（Card JSON 2.0），表格以原生 `column_set` 组件呈现。

详细技术背景见 `references/feishu-table-rendering.md`。

## 用法

```python
import sys, os
sys.path.insert(0, os.path.expanduser("~/.hermes/skills/feishu-message-formatter"))
from scripts.format import send_markdown_as_card

result = send_markdown_as_card(
    markdown="""| 年份 | 毕业生(万) |
|---|---|
| 2021 | 909 |
| 2022 | 1076 |""",
    title="📊 标题",
    # chat_id 省略时自动使用 FEISHU_HOME_CHANNEL
)
```

## 核心入口

| 函数 | 说明 |
|---|---|
| `send_markdown_as_card(markdown, title, chat_id=None)` | 解析 markdown → 构建 Card JSON → 发送 |
| `markdown_to_card_json(markdown, title)` | 仅生成 Card JSON，不发送（用于预览） |

## 工作流程

1. 解析 markdown 表格（支持多个表格 + 表格前面的说明文字）
2. 构建 Card JSON 2.0：header（蓝色）+ column_set（表头 grey 背景）+ 交替行（白/grey）
3. 获取飞书 tenant_access_token（带缓存，expire 前60s 续期）
4. 通过 `POST /open-apis/im/v1/messages?receive_id_type=chat_id` 发送
5. 检查 `code` 是否为 0

## 技术细节

### 表格解析
- 检测 `| ... |` 开头的行
- 第二行为分隔符（`|---|---|`）
- 后续行作为数据行，直到遇到非 `|` 开头的行
- 支持多个表格（按顺序构建 column_set）

### 卡片布局
- 表头行：`background_style="grey"`，内容是 bold markdown
- 数据行：奇偶交替 `"default"` / `"grey"` 背景，方便阅读
- 标题带蓝色 `template="blue"`

## 预发送检查清单

在调用 send_markdown_as_card() 之前，自问三句：
1. 输出里有表格/列表/结构化内容？→ 必须走卡片
2. 确定不是用 send_message 裸发带格式的内容？
3. 不确定？→ **一律走卡片**

**记忆中的规则不能替代执行时的检查。** 明知要卡片但忘记调 skill，比不知道要卡片更严重。

## 陷阱

### 已知问题
- 列数不一致时自动用 `-` 填充缺少的单元格（尽量在输入中保证对齐）
- 内容含 `**bold**` 可被正确渲染（markdown 类型）
- 过长内容可能被截断，建议每行不超过 30 字符

## 验证

发送后检查 API 返回：`"code": 0, "msg": "success"`。message_id 为 `om_xxx` 格式。

也可以调用后看飞书客户端 — 正常应看到蓝色标题卡片 + 带表头和交替行的表格。

---
name: daily-strategy-review
description: >-
  从 jq_log_analyzer v2 API 拉取量化策略每日执行数据，汇总为中文 Markdown 报告供用户 review。
  支持总览表、指定策略详情、按类别(实盘/模拟盘)筛选。
  触发场景：用户提到"策略表现"、"今日收益"、"策略总览"、"拉取策略"、"看下策略"等。
---

# 策略每日回顾 (Daily Strategy Review)

从 jq_log_analyzer 的 v2 REST API 拉取策略数据，生成中文 Markdown 报告发给用户。

## 核心规则

1. **所有输出必须为中文**
2. 默认只拉取可见策略（visible=1），用户明确说"全部/所有/包含隐藏"时才包含隐藏策略
3. 输出必须严格遵循下方模板格式
4. 金额使用千分位 + ¥ 前缀，正数加 `+`，负数加 `-`
5. 收益率保留 2 位小数 + `%`，正数加 `+`，负数加 `-`
6. 类别图标：🟢实盘 / 🔵模拟 / ⚪回测

## 配置

脚本自动从 skill 目录下的 `.env` 加载配置：

```
~/.cursor/skills/daily-strategy-review/.env
```

内含 `JQ_API_URL` 和 `JQ_API_KEY`。

## 工作流程

### Step 1: 判断意图

| 意图 | 关键词 | 命令 |
|------|--------|------|
| 总览(默认) | "策略表现"/"今日收益" | `python {SCRIPT} report` |
| 全部策略 | "全部"/"所有"/"包含隐藏" | `python {SCRIPT} report --all` |
| 按类别 | "实盘"/"模拟盘"/"回测" | `python {SCRIPT} report --category live` |
| 单策略详情 | 具体策略名 | `python {SCRIPT} report --name "策略名"` |

其中 `{SCRIPT}` = `~/.cursor/skills/daily-strategy-review/scripts/fetch_daily.py`

### Step 2: 执行脚本

脚本直接输出格式化的中文 Markdown 报告，**原样展示给用户即可**，不需要额外格式化。

### Step 3: 后续交互

用户看完总览后可能追问某个策略详情，用 `--name` 参数拉取。

## 输出模板

### 模板A：策略总览报告

```markdown
# 📊 策略每日总览

> 📅 数据日期：{date} | 🕐 生成时间：{now}

## 组合概览

| 指标 | 数值 |
|------|------|
| 总资产 (AUM) | ¥{total_aum} |
| 今日盈亏 | {total_pnl} ({total_return}%) |
| 本周收益 | {wtd_return}% |
| 本月收益 | {mtd_return}% |
| 年初至今 | {ytd_return}% |
| 活跃策略 | {active_count} 个 |
| 告警数量 | {alert_count} 条 |

## 策略表现

| 策略 | 类别 | 今日盈亏 | 今日收益 | 总资产 | 今年收益 | 累计收益 | 最大回撤 | Sharpe | Sortino | 胜率 | 持仓数 |
|------|------|---------|----------|--------|---------|---------|---------|--------|---------|------|--------|
| {name} | {cat} | {pnl} | {ret} | ¥{aum} | {ytd} | {cum} | {dd} | {sharpe} | {sortino} | {wr} | {pos} |

## 策略持仓

### {策略名1}

| 代码 | 名称 | 市值 | 占比 | 盈亏 |
|------|------|------|------|------|
| {code} | {sec_name} | ¥{value} | {pct}% | {pnl_pct}% |

### {策略名2}
（同上格式）

## ⚠️ 告警信息

- 🔴 {critical_alert}
- ⚠️ {warning_alert}

---
> 💡 查看单策略详情请说："看下{策略名}的详情"
```

### 模板B：单策略详情报告

```markdown
# 📈 策略详情：{name}

> 📅 数据日期：{date} | 类别：{category}

## 绩效指标

| 指标 | 数值 |
|------|------|
| 总资产 | ¥{aum} |
| 今日盈亏 | {daily_pnl} ({daily_return}%) |
| 本月收益 | {mtd_return}% |
| 年初至今 | {ytd_return}% |
| 最大回撤 | {max_dd}% |
| Sharpe | {sharpe} |
| Sortino | {sortino} |
| Calmar | {calmar} |
| 年化波动率 | {ann_vol}% |
| 胜率 | {win_rate}% |

## 今日持仓（{pos_count} 只）

| 代码 | 名称 | 市值 | 占比 | 盈亏 |
|------|------|------|------|------|
| {code} | {sec_name} | ¥{value} | {pct}% | {pnl_pct}% |

## 持仓变动

- 🟢 新增：{new_list}
- 🔴 清仓：{removed_list}
- ➡️ 保持：{kept_list}

## 今日交易（{trade_count} 笔）

| 时间 | 方向 | 代码 | 名称 | 数量 | 金额 |
|------|------|------|------|------|------|
| {time} | {side} | {code} | {name} | {amount} | ¥{value} |

---
> 💡 返回总览请说："策略总览"
```

## 错误处理

| 错误 | 输出 |
|------|------|
| 连接失败 | "❌ 无法连接服务，请确认 jq_log_analyzer 已启动" |
| 401 | "❌ API Key 无效，请检查配置" |
| 空数据 | "ℹ️ 今日暂无数据，最近数据日期为 {last_date}" |
| 策略不存在 | "❌ 未找到策略 '{name}'，可用策略：{list}" |

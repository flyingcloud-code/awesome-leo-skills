---
name: jq-strategy-research
description: >
  聚宽(JoinQuant)量化策略的端到端研究技能：方向调研、策略创建、因子调试、回测分析、优化迭代、报告撰写。
  当用户提到以下场景时使用此技能：研究某个量化方向（如小市值、动量、多因子）、优化已有策略、
  分析策略表现、创建新策略、比较两个策略、调试因子参数、回测并出报告。
  即使用户只是模糊地说"研究一下XX方向"或"这个策略能不能优化"，也应该触发此技能。
  涵盖A股、ETF、多因子等所有聚宽支持的策略类型。
---

# 聚宽量化策略研究技能

你是一个资深量化研究员，在独量引擎(DuLiang Engine)平台上进行策略研究。

## 项目上下文

- **项目根目录**: `C:\work\github\jq-invest-system`
- **策略目录**: `jq_trader/strategies/` — 所有策略 `.py` 文件在此
- **文档目录**: `jq_trader/docs/` — 研究报告存放处
- **输出目录**: `jq_trader/output/{策略名}/{开始_结束}/` — 回测结果
- **回测命令**: `.venv\Scripts\python.exe -m jq_trader.main run {策略名} --start {日期} --end {日期}`
- **读取报告**: 回测完成后，用 Python 读取 `.md` 文件（PowerShell 对中文编码有问题）

```
# 读取回测报告的标准方式
.venv\Scripts\python.exe -c "import os; d='jq_trader/output/{策略名}/{开始}_{结束}'; files=[f for f in os.listdir(d) if f.endswith('.md')]; print(open(os.path.join(d, files[0]), encoding='utf-8').read())"
```

## 策略代码模板

聚宽策略必须遵循这个结构才能在平台上运行：

```python
from typing import Any, List
from jqdata import *
import numpy as np
import pandas as pd

class TradingStrategy:
    def __init__(self) -> None:
        # 核心参数定义
        self.stock_num: int = 10
        # ... 其他参数

    def initialize(self, context: Any) -> None:
        set_option('avoid_future_data', True)
        set_benchmark('000001.XSHG')
        set_option('use_real_price', True)
        set_slippage(FixedSlippage(3 / 10000))
        set_order_cost(OrderCost(
            open_tax=0, close_tax=0.001,
            open_commission=2.5 / 10000, close_commission=2.5 / 10000,
            close_today_commission=0, min_commission=5
        ), type='stock')

    # 选股、调仓、风控等方法...

# 全局实例 + 包装函数 + initialize 入口
strategy = TradingStrategy()

def initialize(context):
    strategy.initialize(context)
    run_daily(some_func, time='9:05', reference_security='000001.XSHG')
    run_weekly(weekly_func, 2, time='10:00', reference_security='000001.XSHG')
```

**ETF 策略**可以更简洁（函数式风格），因为 ETF 交易成本结构不同：
```python
set_order_cost(OrderCost(open_tax=0, close_tax=0,
    open_commission=0.0002, close_commission=0.0002,
    close_today_commission=0, min_commission=5), type='fund')
```

## 聚宽关键 API

策略代码运行在聚宽云端，可用的 API 包括（不需要 import，直接调用）：

| API | 用途 |
|-----|------|
| `get_index_stocks(index_code)` | 获取指数成分股列表 |
| `get_fundamentals(query(...))` | 获取基本面数据（市值、利润等） |
| `get_price(security, end_date, frequency, fields, count)` | 获取历史行情 |
| `get_current_data()` | 获取当前实时数据 |
| `get_security_info(code)` | 获取证券信息（上市日期等） |
| `get_industry(code, date)` | 获取行业分类（注意：批量调用很慢，可能导致超时） |
| `attribute_history(code, count, unit, fields)` | 获取历史属性数据 |
| `order_target_value(code, value)` | 按目标金额下单 |
| `order_value(code, value)` | 按金额下单 |

**常用指数代码**：
- `000001.XSHG` — 上证指数
- `000300.XSHG` — 沪深300
- `399101.XSHE` — 中小板指（小市值策略常用选股池）
- `399006.XSHE` — 创业板指

**常用 ETF 代码**：
- `511880.XSHG` — 银华日利（货币ETF，空仓期持有）
- `518880.XSHG` — 黄金ETF
- `513100.XSHG` — 纳指100
- `510300.XSHG` — 沪深300ETF
- `159915.XSHE` — 创业板100

## 研究工作流

根据用户请求的不同，按以下流程执行：

### 模式A：方向调研 + 新策略创建

当用户说"研究XX方向"、"创建一个XX策略"时：

**第1步：调研**
1. 阅读 `jq_trader/docs/` 下的现有报告，了解已有研究
2. 阅读 `jq_trader/strategies/` 下的相关策略，了解已有实现
3. 搜索网络了解该方向的最新研究和社区实践
4. 形成研究思路：核心因子、选股逻辑、风控机制

**第2步：创建基线策略**
1. 在 `jq_trader/strategies/` 下创建策略文件（遵循上面的模板）
2. 参数先用保守值，确保策略能跑通
3. 回测验证：`run {策略名} --start 2023-01-01 --end 2026-04-25`

**第3步：参数调优（对照实验）**
1. 基于基线表现，提出3-5个优化假设，和用户讨论确认
2. 每次只改一个变量，复制策略文件做对照实验
3. 命名规范：`{基线名}_test_{变量名}.py`
4. 同一时间段回测，收集到汇总表后再统一分析

**第4步：汇总分析 + 应用最优参数**
1. 所有实验结果汇总到一张对比表
2. 以 Calmar 比率为首选排序指标
3. 将验证有效的参数更新到正式策略文件

**第5步：撰写研究报告**
1. 报告存放在 `jq_trader/docs/` 下
2. 遵循已有报告的风格和结构（见下方报告模板）

### 模式B：已有策略优化

当用户指定一个策略文件说"优化这个"时：

**第1步：分析基线**
1. 完整阅读策略代码，理解每个参数和逻辑
2. 回测基线：长周期 2023-01-01 ~ 当前日期
3. 记录基线指标

**第2步：识别优化方向**
- 关注：止损/止盈参数、持仓数量、调仓频率、选股因子、空仓月、价格过滤
- 参考已有研究报告中验证过的优化方向
- 提出优化假设并和用户讨论

**第3步：实验 + 对照回测**
- 每个优化方向创建独立实验文件
- 所有实验用相同时间段回测
- 汇总结果对比

**第4步：应用最优参数 + 撰写报告**

### 模式C：策略对比分析

当用户说"对比这两个策略"时：
1. 阅读两个策略代码，提取设计差异
2. 同一时间段回测两个策略
3. 从收益、风险、交易效率多维度对比
4. 给出推荐和改进建议

## 回测操作规范

### 执行回测
```powershell
$env:PYTHONIOENCODING="utf-8"
.venv\Scripts\python.exe -m jq_trader.main run {策略名} --start 2023-01-01 --end 2026-04-25
```
- 工作目录必须是 `C:\work\github\jq-invest-system`
- 回测通常需要 2-3 分钟，设置 `block_until_ms: 0` 后台运行
- 用 Await 等待 `报告已生成` 或 `exit_code` 匹配
- 标准回测区间：`2023-01-01 ~ 当前`（约3年，覆盖牛熊）
- 对照实验统一用一个区间即可，不需要多区间
- 最终确认版本可加年度对照（如单独跑2024年）验证稳定性

### 读取回测结果
PowerShell 直接读中文文件会乱码，必须用 Python：
```powershell
$env:PYTHONIOENCODING="utf-8"
.venv\Scripts\python.exe -c "import os; d='jq_trader/output/{策略名}/{开始}_{结束}'; files=[f for f in os.listdir(d) if f.endswith('.md')]; print(open(os.path.join(d, files[0]), encoding='utf-8').read())"
```

### 核心评估指标
| 指标 | 含义 | 好策略标准 |
|------|------|-----------|
| 总收益率 | 整个区间的累计收益 | 越高越好 |
| 年化收益率 | 换算成年度收益 | >30% 为优秀 |
| 夏普比率 | 单位风险收益 | >1.5 为优秀 |
| 最大回撤 | 最大亏损幅度 | <20% 为可控 |
| Calmar比率 | 年化收益/最大回撤 | >2 为优秀，综合最重要的指标 |
| 胜率 | 盈利交易占比 | >55% |
| 盈亏比 | 平均盈利/平均亏损 | >1.2 |

**Calmar比率是综合评判的首选指标**（兼顾收益和回撤），不要只看总收益。

### 对照实验原则
- 每次实验只改一个变量（单变量控制）
- 所有实验用完全相同的时间区间
- 创建独立策略文件，不修改基线文件
- 命名清晰：`{基线}_test_{改动}.py`

## 研究报告模板

报告存放在 `jq_trader/docs/` 下，使用 Markdown 格式，遵循以下结构：

```markdown
# {策略名} {版本}研究报告

> 研究日期: {日期}
> 基线策略: `{文件名}`
> 回测区间: {开始} ~ {结束}

---

## 一、研究目标
简述研究背景和要验证的假设

## 二、回测结果汇总
核心指标对比表（所有实验一张表）

## 三、各实验详细分析
每个实验：假设 → 结果 → 分析 → 结论（✅有效/❌无效/⚠️有条件有效）

## 四、综合结论
### 实验总结表
### 最终推荐
### 不同风险偏好的建议

## 附录：实验文件清单
```

**关键写作原则**：
- 用数据说话，每个结论都要有回测数据支撑
- 用 ✅❌⚠️ 标记实验有效性，让读者快速扫描
- 分析要解释"为什么"，不仅仅列数据
- 结论要有可操作性：推荐具体参数值

## 已有研究成果（避免重复研究）

以下结论已通过回测验证，新研究应参考而非重做：

### 小市值策略（V2最优版本）
- 纯市值排序优于动量排序（动量对A股小盘为负因子）
- 10只集中持仓优于20只分散
- 1月+4月空仓极其有效（单一最大alpha来源）
- 2月不需要空仓（1月清仓已覆盖春节窗口）
- 7%止损优于8%
- 50元价格上限实际无影响（安全网）
- 反转因子、换手率因子、行业分散在小盘域无效
- 波动率自适应可降低回撤但收益代价大

### ETF动量策略
- `年化收益 × R²` 优于 `年化收益 / 波动率 × ATR`
- R² 天然过滤震荡，不需要额外波动率阈值
- 加权回归（近期权重高）略优于等权回归
- 国债ETF作为防守资产有效

## 注意事项

1. **聚宽API限制**：`get_industry()` 批量调用很慢，可能导致回测超时。涉及行业数据的逻辑要控制调用次数。
2. **回测超时**：聚宽默认超时600秒。如果策略复杂（日频+大量API调用），可能超时。优先使用周频调仓。
3. **中文编码**：所有通过 PowerShell 读写中文文件的操作，都要用 Python 的 `encoding='utf-8'` 处理。
4. **实验文件管理**：测试用的策略文件命名以 `_test_` 或 `_v3x_` 区分，避免污染正式策略。
5. **不要过度优化**：量化策略中"简单即鲁棒"。如果一个因子在小样本上只有微小改善，不要采用。

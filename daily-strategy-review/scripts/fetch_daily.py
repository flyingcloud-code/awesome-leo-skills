# -*- coding: utf-8 -*-
"""
策略每日数据拉取 + 中文 Markdown 报告生成

用法:
    python fetch_daily.py report [--category live|paper|backtest] [--all] [--name "策略名"]

输出格式化的中文 Markdown 报告到 stdout。
"""

import argparse
import json
import os
import sys
from datetime import datetime

try:
    import requests
except ImportError:
    print("❌ requests 库未安装，请运行: pip install requests")
    sys.exit(1)


def _load_env():
    """从 skill 目录 .env 优先加载，回退到项目目录"""
    skill_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    candidates = [
        os.path.join(skill_dir, '.env'),
        os.path.join(os.getcwd(), '.env'),
        os.path.join(os.getcwd(), 'jq_log_analyzer', '.env'),
    ]
    try:
        from dotenv import load_dotenv
        for path in candidates:
            if os.path.exists(path):
                load_dotenv(path)
                break
    except ImportError:
        for path in candidates:
            if os.path.exists(path):
                with open(path, encoding='utf-8') as f:
                    for line in f:
                        line = line.strip()
                        if line and not line.startswith('#') and '=' in line:
                            k, v = line.split('=', 1)
                            os.environ.setdefault(k.strip(), v.strip())
                break

_load_env()

if sys.stdout.encoding and sys.stdout.encoding.lower() not in ('utf-8', 'utf8'):
    sys.stdout.reconfigure(encoding='utf-8')

API_URL = os.environ.get('JQ_API_URL', 'http://localhost:5000')
API_KEY = os.environ.get('JQ_API_KEY', '')

CAT_ICONS = {'live': '🟢实盘', 'paper': '🔵模拟', 'backtest': '⚪回测'}


def _headers():
    return {'Authorization': f'Bearer {API_KEY}'}


def _get(endpoint, params=None, api_ver='v2'):
    url = f"{API_URL.rstrip('/')}/api/{api_ver}/{endpoint}"
    try:
        resp = requests.get(url, headers=_headers(), params=params, timeout=15)
    except requests.ConnectionError:
        return {"error": f"无法连接服务 {API_URL}，请确认 jq_log_analyzer 已启动"}
    except requests.Timeout:
        return {"error": "请求超时(15s)"}
    if resp.status_code == 401:
        return {"error": "API Key 无效，请检查 JQ_API_KEY 配置"}
    if resp.status_code != 200:
        return {"error": f"HTTP {resp.status_code}: {resp.text[:200]}"}
    return resp.json()


def _fmt_money(v):
    """格式化金额：¥1,234,567"""
    try:
        v = float(v)
    except (TypeError, ValueError):
        return "¥0"
    sign = "+" if v > 0 else ""
    return f"{sign}¥{v:,.0f}" if v != 0 else "¥0"


def _fmt_money_plain(v):
    """格式化金额（无正号）"""
    try:
        v = float(v)
    except (TypeError, ValueError):
        return "¥0"
    return f"¥{v:,.0f}"


def _fmt_pct(v):
    """格式化百分比：+1.23%"""
    try:
        v = float(v) * 100
    except (TypeError, ValueError):
        return "0.00%"
    sign = "+" if v > 0 else ""
    return f"{sign}{v:.2f}%"


def _fmt_num(v, decimals=2):
    """格式化数字"""
    try:
        v = float(v)
    except (TypeError, ValueError):
        return "N/A"
    return f"{v:.{decimals}f}"


def _safe_num(v):
    try:
        return float(v) if v is not None else 0.0
    except (TypeError, ValueError):
        return 0.0


def _cat_icon(cat):
    return CAT_ICONS.get(cat or 'paper', '🔵模拟')


def _render_summary(args):
    """生成策略总览报告（含完整指标 + 各策略持仓）"""
    params = {}
    if args.category:
        params['category'] = args.category

    summary = _get('daily-summary', params)
    if 'error' in summary:
        return f"❌ {summary['error']}"

    overview = _get('portfolio/overview', params)
    alerts = _get('alerts', params)

    strategies = summary.get('data', {}).get('strategies', [])
    if not args.all:
        strategies = [s for s in strategies if s.get('visible', 1) != 0]

    date = summary.get('meta', {}).get('date', 'N/A')
    now = datetime.now().strftime('%Y-%m-%d %H:%M')
    port = overview.get('data', {})
    alert_data = alerts.get('data', {}) if isinstance(alerts.get('data'), dict) else {}
    alert_list = alert_data.get('alerts', [])
    alert_count = alert_data.get('alert_count', 0)

    # 为每个策略拉取绩效指标和持仓
    perf_map = {}
    pos_map = {}
    for s in strategies:
        sname = s.get('name', '')
        if not sname:
            continue
        perf = _get(f'strategies/{sname}/performance')
        if 'error' not in perf:
            perf_map[sname] = perf.get('data', {})
        # 使用 v1 接口获取最新持仓
        posdata = _get(f'data/{sname}/positions', api_ver='v1')
        if 'error' not in posdata:
            pos_map[sname] = posdata.get('data', [])

    lines = []
    lines.append(f"# 📊 策略每日总览\n")
    lines.append(f"> 📅 数据日期：{date} | 🕐 生成时间：{now}\n")

    # 组合概览
    lines.append("## 组合概览\n")
    lines.append("| 指标 | 数值 |")
    lines.append("|------|------|")
    lines.append(f"| 总资产 (AUM) | {_fmt_money_plain(port.get('total_aum', 0))} |")
    lines.append(f"| 今日盈亏 | {_fmt_money(port.get('total_daily_pnl', 0))} ({_fmt_pct(port.get('total_daily_return', 0))}) |")
    lines.append(f"| 本周收益 | {_fmt_pct(port.get('wtd_return', 0))} |")
    lines.append(f"| 本月收益 | {_fmt_pct(port.get('mtd_return', 0))} |")
    lines.append(f"| 年初至今 | {_fmt_pct(port.get('ytd_return', 0))} |")
    lines.append(f"| 最大回撤 | {_fmt_pct(port.get('max_drawdown', 0))} |")
    lines.append(f"| 活跃策略 | {port.get('active_strategy_count', len(strategies))} 个 |")
    lines.append(f"| 告警数量 | {alert_count} 条 |")
    lines.append("")

    # 策略表现（丰富版）
    lines.append("## 策略表现\n")
    lines.append("| 策略 | 类别 | 今日盈亏 | 今日收益 | 总资产 | 今年收益 | 累计收益 | 最大回撤 | Sharpe | Sortino | 胜率 | 持仓数 |")
    lines.append("|------|------|---------|----------|--------|---------|---------|---------|--------|---------|------|--------|")
    for s in strategies:
        sname = s.get('name', '?')
        display = s.get('display_name') or sname
        cat = _cat_icon(s.get('category'))
        pnl = _fmt_money(s.get('daily_pnl', 0))
        ret = _fmt_pct(s.get('daily_return', 0))
        aum = _fmt_money_plain(s.get('total_value', 0))
        pos = s.get('num_positions', 0)
        p = perf_map.get(sname, {})
        ytd = _fmt_pct(p.get('ytd_return', 0))
        cum = _fmt_pct(p.get('cum_return', 0))
        dd = _fmt_pct(p.get('max_drawdown', 0))
        sharpe = _fmt_num(p.get('sharpe', 0))
        sortino = _fmt_num(p.get('sortino', 0))
        wr = _fmt_pct(p.get('win_rate', 0))
        lines.append(f"| {display} | {cat} | {pnl} | {ret} | {aum} | {ytd} | {cum} | {dd} | {sharpe} | {sortino} | {wr} | {pos} |")
    lines.append("")

    # 各策略持仓（v1 API 返回的是 list of dict）
    lines.append("## 策略持仓\n")
    for s in strategies:
        sname = s.get('name', '?')
        display = s.get('display_name') or sname
        positions = pos_map.get(sname, [])
        if isinstance(positions, dict):
            positions = positions.get('positions', [])
        lines.append(f"### {display}\n")
        if positions:
            lines.append("| 代码 | 名称 | 数量 | 价格 | 市值 | 占比 | 盈亏 |")
            lines.append("|------|------|------|------|------|------|------|")
            for p in positions:
                code = p.get('security_code') or p.get('code', '?')
                sec_name = p.get('security_name') or p.get('name', '?')
                amount = f"{_safe_num(p.get('amount', 0)):,.0f}"
                price = f"¥{_safe_num(p.get('price', 0)):.3f}" if p.get('price') else '-'
                mv = _fmt_money_plain(p.get('market_value', 0))
                pct_val = p.get('position_pct', 0)
                pct = _fmt_num(_safe_num(pct_val) * 100, 1) + '%'
                pnl_pct = _fmt_pct(p.get('pnl_pct', 0))
                lines.append(f"| {code} | {sec_name} | {amount} | {price} | {mv} | {pct} | {pnl_pct} |")
        else:
            lines.append("暂无持仓数据")
        lines.append("")

    # 告警
    if alert_list:
        lines.append("## ⚠️ 告警信息\n")
        for a in alert_list:
            level = a.get('level', 'info')
            icon = '🔴' if level == 'critical' else '⚠️' if level == 'warning' else 'ℹ️'
            msg = a.get('message', '')
            strategy = a.get('strategy', '')
            lines.append(f"- {icon} **{strategy}**: {msg}")
        lines.append("")

    lines.append("---")
    lines.append('> 💡 查看单策略详情请说："看下 {策略名} 的详情"')

    return "\n".join(lines)


def _render_detail(args):
    """生成单策略详情报告"""
    name = args.name
    if not name:
        return "❌ 请指定策略名称"

    perf = _get(f'strategies/{name}/performance')
    if 'error' in perf:
        return f"❌ {perf['error']}"

    pos_data = _get(f'strategies/{name}/position-changes')
    trade_data = _get(f'strategies/{name}/trades')

    d = perf.get('data', {})
    date = perf.get('meta', {}).get('date', 'N/A')
    cat = _cat_icon(d.get('category', 'paper'))

    lines = []
    lines.append(f"# 📈 策略详情：{name}\n")
    lines.append(f"> 📅 数据日期：{date} | 类别：{cat}\n")

    # 绩效指标
    lines.append("## 绩效指标\n")
    lines.append("| 指标 | 数值 |")
    lines.append("|------|------|")
    lines.append(f"| 总资产 | {_fmt_money_plain(d.get('total_value', 0))} |")
    lines.append(f"| 今日盈亏 | {_fmt_money(d.get('daily_pnl', 0))} ({_fmt_pct(d.get('daily_return', 0))}) |")
    lines.append(f"| 本月收益 | {_fmt_pct(d.get('mtd_return', 0))} |")
    lines.append(f"| 年初至今 | {_fmt_pct(d.get('ytd_return', 0))} |")
    lines.append(f"| 最大回撤 | {_fmt_pct(d.get('max_drawdown', 0))} |")
    lines.append(f"| Sharpe | {_fmt_num(d.get('sharpe', 0))} |")
    lines.append(f"| Sortino | {_fmt_num(d.get('sortino', 0))} |")
    lines.append(f"| Calmar | {_fmt_num(d.get('calmar', 0))} |")
    lines.append(f"| 年化波动率 | {_fmt_pct(d.get('annual_volatility', 0))} |")
    lines.append(f"| 胜率 | {_fmt_pct(d.get('win_rate', 0))} |")
    lines.append("")

    # 持仓
    pd = pos_data.get('data', {}) if 'error' not in pos_data else {}
    current = pd.get('current_positions', [])
    if current:
        lines.append(f"## 今日持仓（{len(current)} 只）\n")
        lines.append("| 代码 | 名称 | 市值 | 占比 | 盈亏 |")
        lines.append("|------|------|------|------|------|")
        for p in current:
            code = p.get('code', '?')
            sec_name = p.get('name', '?')
            mv = _fmt_money_plain(p.get('market_value', 0))
            pct = _fmt_num(p.get('position_pct', 0) * 100 if p.get('position_pct') else 0, 1) + '%'
            pnl = _fmt_pct(p.get('pnl_pct', 0))
            lines.append(f"| {code} | {sec_name} | {mv} | {pct} | {pnl} |")
        lines.append("")

    # 持仓变动
    new_pos = pd.get('new_positions', [])
    removed = pd.get('removed_positions', [])
    kept = pd.get('kept_positions', [])
    if new_pos or removed or kept:
        lines.append("## 持仓变动\n")
        if new_pos:
            names = ", ".join(f"{p.get('name', p.get('code', '?'))}" for p in new_pos)
            lines.append(f"- 🟢 **新增**：{names}")
        else:
            lines.append("- 🟢 **新增**：无")
        if removed:
            names = ", ".join(f"{p.get('name', p.get('code', '?'))}" for p in removed)
            lines.append(f"- 🔴 **清仓**：{names}")
        else:
            lines.append("- 🔴 **清仓**：无")
        if kept:
            names = ", ".join(f"{p.get('name', p.get('code', '?'))}" for p in kept)
            lines.append(f"- ➡️ **保持**：{names}")
        lines.append("")

    # 交易
    td = trade_data.get('data', {}) if 'error' not in trade_data else {}
    trades = td.get('trades', [])
    if trades:
        lines.append(f"## 今日交易（{len(trades)} 笔）\n")
        lines.append("| 时间 | 方向 | 代码 | 名称 | 数量 | 金额 |")
        lines.append("|------|------|------|------|------|------|")
        for t in trades:
            time = t.get('time', '-')
            side = '买入' if t.get('side') == 'buy' else '卖出'
            code = t.get('code', '?')
            tname = t.get('name', '?')
            amount = f"{t.get('amount', 0):,.0f}"
            value = _fmt_money_plain(t.get('value', 0))
            lines.append(f"| {time} | {side} | {code} | {tname} | {amount} | {value} |")
        lines.append("")
    else:
        lines.append("## 今日交易\n")
        lines.append("无交易记录\n")

    lines.append("---")
    lines.append('> 💡 返回总览请说："策略总览"')

    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description='策略每日报告生成')
    sub = parser.add_subparsers(dest='command')

    p_report = sub.add_parser('report', help='生成报告')
    p_report.add_argument('--category', choices=['live', 'paper', 'backtest'], help='按类别筛选')
    p_report.add_argument('--all', action='store_true', help='包含隐藏策略')
    p_report.add_argument('--name', help='指定策略名称（生成详情报告）')

    # 保留旧命令兼容
    p_sum = sub.add_parser('summary', help='(旧) JSON总览')
    p_sum.add_argument('--category', choices=['live', 'paper', 'backtest'])
    p_sum.add_argument('--all', action='store_true')

    p_det = sub.add_parser('detail', help='(旧) JSON详情')
    p_det.add_argument('--name', required=True)

    args = parser.parse_args()

    if args.command == 'report':
        if args.name:
            print(_render_detail(args))
        else:
            print(_render_summary(args))
    elif args.command == 'summary':
        # 旧JSON输出
        params = {}
        if args.category:
            params['category'] = args.category
        result = _get('daily-summary', params)
        print(json.dumps(result, ensure_ascii=False, indent=2))
    elif args.command == 'detail':
        result = {}
        for ep in [f'strategies/{args.name}/performance',
                    f'strategies/{args.name}/position-changes',
                    f'strategies/{args.name}/trades']:
            r = _get(ep)
            result[ep.split('/')[-1]] = r.get('data', {}) if 'error' not in r else {}
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == '__main__':
    main()

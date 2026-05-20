"""
飞书 Markdown → Card 2.0 卡片发送工具
v2.1.0

核心入口：send_markdown_as_card(markdown, title, chat_id=None)
"""

import json
import os
import re
import time
from typing import Optional

# ── Feishu credentials ──────────────────────────────────────────────────
_HERMES_HOME = os.path.expanduser("~/.hermes")
_DOT_ENV_PATH = os.path.join(_HERMES_HOME, ".env")

FEISHU_APP_ID = None
FEISHU_APP_SECRET = None
FEISHU_DOMAIN = "feishu"
FEISHU_HOME_CHANNEL = "oc_4043ea4538218ce6bc189148f707d464"

if os.path.exists(_DOT_ENV_PATH):
    with open(_DOT_ENV_PATH) as f:
        for line in f:
            line = line.strip()
            if line.startswith("FEISHU_APP_ID="):
                FEISHU_APP_ID = line.split("=", 1)[1].strip().strip('"').strip("'")
            elif line.startswith("FEISHU_APP_SECRET="):
                FEISHU_APP_SECRET = line.split("=", 1)[1].strip().strip('"').strip("'")
            elif line.startswith("FEISHU_DOMAIN="):
                FEISHU_DOMAIN = line.split("=", 1)[1].strip().strip('"').strip("'")
            elif line.startswith("FEISHU_HOME_CHANNEL="):
                FEISHU_HOME_CHANNEL = line.split("=", 1)[1].strip().strip('"').strip("'")

_BASE_URL = f"https://open.{FEISHU_DOMAIN}.cn"


# ── Token management ────────────────────────────────────────────────────
_token_cache = {"token": None, "expires_at": 0}


def _get_tenant_token() -> str:
    """获取飞书 tenant_access_token，带缓存"""
    if time.time() < _token_cache["expires_at"] - 60:
        return _token_cache["token"]

    import subprocess
    cmd = [
        "curl", "-s", "-X", "POST",
        f"{_BASE_URL}/open-apis/auth/v3/tenant_access_token/internal",
        "-H", "Content-Type: application/json",
        "-d", json.dumps({
            "app_id": FEISHU_APP_ID,
            "app_secret": FEISHU_APP_SECRET,
        })
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
    data = json.loads(result.stdout)
    token = data.get("tenant_access_token")
    if not token:
        raise RuntimeError(f"Failed to get tenant token: {data}")
    _token_cache["token"] = token
    _token_cache["expires_at"] = time.time() + data.get("expire", 7200)
    return token


# ── Markdown table parsing ─────────────────────────────────────────────
def _parse_markdown_tables(markdown: str) -> list[dict]:
    """
    解析 Markdown 表格，返回 [{headers: [...], rows: [[...]]}]
    """
    tables = []
    lines = markdown.strip().split("\n")
    
    i = 0
    while i < len(lines):
        line = lines[i]
        # Detect table start: | header | header |
        if line.strip().startswith("|") and "|" in line[1:]:
            headers = [h.strip() for h in line.split("|")[1:-1]]
            # Next line should be separator: | --- | --- |
            if i + 1 < len(lines) and re.match(r"^\s*\|[\s\-:|]+\|", lines[i + 1]):
                rows = []
                j = i + 2
                while j < len(lines):
                    row_line = lines[j].strip()
                    if not row_line.startswith("|"):
                        break
                    cells = [c.strip() for c in row_line.split("|")[1:-1]]
                    if cells:
                        rows.append(cells)
                    j += 1
                tables.append({"headers": headers, "rows": rows})
                i = j
                continue
        i += 1
    
    return tables


# ── Card JSON 2.0 builder ──────────────────────────────────────────────
def _build_card_json(markdown: str, title: str = "") -> dict:
    """
    将 Markdown（含表格）转换为飞书 Card JSON 2.0
    """
    tables = _parse_markdown_tables(markdown)
    elements = []

    # Check for non-table intro text
    text_before_table = ""
    for line in markdown.split("\n"):
        if line.strip().startswith("|"):
            break
        text_before_table += line + "\n"
    text_before_table = text_before_table.strip()

    if text_before_table:
        elements.append({
            "tag": "markdown",
            "content": text_before_table,
        })

    for table in tables:
        rows = table["rows"]
        headers = table["headers"]
        num_cols = len(headers)

        # Build table using ColumnSet + Div layout
        # Each row is a column_set with one column per cell
        table_header = {
            "tag": "column_set",
            "flex_mode": "none",
            "background_style": "grey",
            "columns": [
                {
                    "tag": "column",
                    "width": "weighted",
                    "weight": 1,
                    "vertical_align": "center",
                    "elements": [
                        {
                            "tag": "markdown",
                            "content": f"**{h}**",
                        }
                    ],
                }
                for h in headers
            ],
        }
        elements.append(table_header)

        for row_idx, row in enumerate(rows):
            bg = "default" if row_idx % 2 == 0 else "grey"
            row_element = {
                "tag": "column_set",
                "flex_mode": "none",
                "background_style": bg,
                "columns": [
                    {
                        "tag": "column",
                        "width": "weighted",
                        "weight": 1,
                        "vertical_align": "center",
                        "elements": [
                            {
                                "tag": "markdown",
                                "content": cell if cell else "-",
                            }
                        ],
                    }
                    for cell in row[:num_cols]
                ],
            }
            # Pad missing cells
            for _ in range(num_cols - len(row)):
                row_element["columns"].append({
                    "tag": "column",
                    "width": "weighted",
                    "weight": 1,
                    "vertical_align": "center",
                    "elements": [
                        {"tag": "markdown", "content": "-"}
                    ],
                })
            elements.append(row_element)

    card = {
        "config": {"wide_screen_mode": True},
        "elements": elements if elements else [
            {"tag": "markdown", "content": markdown}
        ],
    }

    if title:
        card["header"] = {
            "title": {"tag": "plain_text", "content": title},
            "template": "blue",
        }

    return card


# ── Send via Feishu API ────────────────────────────────────────────────
def send_card(chat_id: str, card: dict) -> dict:
    """通过飞书 API 发送卡片消息"""
    token = _get_tenant_token()
    
    payload = {
        "receive_id": chat_id,
        "msg_type": "interactive",
        "content": json.dumps(card, ensure_ascii=False),
    }

    import subprocess
    tmp = "/tmp/feishu_card_payload.json"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False)

    cmd = [
        "curl", "-s", "-X", "POST",
        f"{_BASE_URL}/open-apis/im/v1/messages?receive_id_type=chat_id",
        "-H", f"Authorization: Bearer {token}",
        "-H", "Content-Type: application/json",
        "--data-binary", f"@{tmp}",
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError:
        return {"error": result.stdout}


# ── Public API ──────────────────────────────────────────────────────────
def markdown_to_card_json(markdown: str, title: str = "") -> dict:
    """仅生成 Card JSON，不发送"""
    return _build_card_json(markdown, title)


def send_markdown_as_card(
    markdown: str,
    title: str = "",
    chat_id: Optional[str] = None,
) -> dict:
    """将 Markdown 转换为飞书卡片并发送

    Args:
        markdown: 含表格的 Markdown 文本
        title: 卡片标题
        chat_id: 飞书聊天 ID，默认 Home 频道

    Returns:
        API 响应 JSON
    """
    if not chat_id:
        chat_id = FEISHU_HOME_CHANNEL
    
    card = _build_card_json(markdown, title)
    return send_card(chat_id, card)

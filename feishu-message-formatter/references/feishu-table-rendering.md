# Feishu Gateway Table Rendering — Internal Detail

## The Problem

Hermes Agent's Feishu gateway (`gateway/platforms/feishu.py`) converts agent responses to Feishu messages. When a response contains a Markdown table, the gateway **downgrades the entire message to plain text**.

## Root Cause

1. **Gateway sends `msg_type="post"` by default** for messages with markdown hints (bold, italic, headers, etc.). The post type uses Feishu's `md` element which renders markdown inline.

2. **Feishu `md` does NOT support tables.** Despite being called "markdown", Feishu's post-element markdown renderer deliberately ignores table syntax. Sending a table as `post` causes the client to show a **blank message** (no visible content at all).

3. **Gateway falls back to `msg_type="text"`** for safety. The regex `_MARKDOWN_TABLE_RE` (defined in `gateway/platforms/feishu.py`) detects lines matching `|...|...|` patterns. When found, `_build_outbound_payload()` returns `("text", {"text": content})` instead of the normal post payload.

4. **Result**: The table renders as raw pipe characters in plain text — ugly and barely readable.

## The Code

```python
# In feishu.py, _build_outbound_payload():
_MARKDOWN_TABLE_RE = re.compile(r'\|.*\|\s*\|')  # simplified representation

def _build_outbound_payload(self, content: str) -> tuple[str, str]:
    # Feishu post-type 'md' elements do not render markdown tables; sending
    # table content as post causes the message to appear blank on the client.
    # Force plain text for anything that looks like a markdown table.
    if _MARKDOWN_TABLE_RE.search(content):
        text_payload = {"text": content}
        return "text", json.dumps(text_payload, ensure_ascii=False)
    if _MARKDOWN_HINT_RE.search(content):
        return "post", _build_markdown_post_payload(content)
    text_payload = {"text": content}
    return "text", json.dumps(text_payload, ensure_ascii=False)
```

## Implications

- **Any** Markdown table in the response triggers the downgrade, even if the table is mixed with other content.
- The gateway has **no Card-via-API** fallback — it only knows `text` and `post` message types.
- This is a deliberate tradeoff in the OpenClaw upstream: blank message > ugly plaintext.

## The Fix

Use `feishu-message-formatter` skill which bypasses the gateway entirely:

1. Authenticates with Feishu Open API directly (tenant token via app_id/app_secret)
2. Builds Card JSON 2.0 with native `column_set` components for tables
3. Sends via `POST /open-apis/im/v1/messages` with `msg_type="interactive"`
4. Tables render as proper alternating-row column layouts

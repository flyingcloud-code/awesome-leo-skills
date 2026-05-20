#!/usr/bin/env python3
"""md-to-html.py — Convert Markdown to simple HTML (no external deps)"""

import sys
import os
import re

def md_to_html(text):
    """Simple markdown to HTML converter — no external dependencies."""
    lines = text.split('\n')
    html = []
    i = 0
    in_code_block = False
    code_buffer = []
    
    while i < len(lines):
        line = lines[i]
        
        # Code block
        if line.strip().startswith('```'):
            if in_code_block:
                html.append('<pre><code>' + '\n'.join(code_buffer) + '</code></pre>')
                code_buffer = []
                in_code_block = False
                i += 1
                continue
            else:
                in_code_block = True
                i += 1
                continue
        if in_code_block:
            code_buffer.append(line)
            i += 1
            continue
        
        # Table
        if line.startswith('|') and i + 2 < len(lines) and lines[i+1].startswith('|---'):
            rows = []
            while i < len(lines) and lines[i].startswith('|'):
                rows.append(lines[i])
                i += 1
            html.append(parse_table(rows))
            continue
        
        # Headings
        if line.startswith('# '):
            html.append(f'<h1>{inline_md(line[2:])}</h1>')
        elif line.startswith('## '):
            html.append(f'<h2>{inline_md(line[3:])}</h2>')
        elif line.startswith('### '):
            html.append(f'<h3>{inline_md(line[4:])}</h3>')
        # Horizontal rule
        elif line.strip() == '---' or line.strip() == '***':
            html.append('<hr>')
        # Unordered list
        elif line.strip().startswith('- ') or line.strip().startswith('* '):
            html.append(f'<li>{inline_md(line.strip()[2:])}</li>')
        # Ordered list
        elif re.match(r'^\d+\.\s', line.strip()):
            stripped = re.sub(r"^\d+\.\s", "", line.strip())
            html.append(f'<li>{inline_md(stripped)}</li>')
        # Blockquote
        elif line.strip().startswith('> '):
            html.append(f'<blockquote><p>{inline_md(line.strip()[2:])}</p></blockquote>')
        # Empty line
        elif line.strip() == '':
            html.append('')
        # Paragraph
        else:
            html.append(f'<p>{inline_md(line)}</p>')
        
        i += 1
    
    # Close any remaining list tags
    result = '\n'.join(html)
    
    # Wrap consecutive <li> in <ul>
    result = re.sub(r'(<li>.*?</li>)(\n<li>.*?</li>)*', 
                    lambda m: '<ul>\n' + m.group(0) + '\n</ul>', result)
    result = re.sub(r'</ul>\n<ul>', '', result)
    
    # Wrap consecutive <blockquote> in single block
    result = re.sub(r'</blockquote>\n<blockquote>', '\n', result)
    
    return result

def inline_md(text):
    """Inline markdown: bold, code, links."""
    text = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', text)
    text = re.sub(r'`(.+?)`', r'<code>\1</code>', text)
    url_repl = r'<a href="\2">\1</a>'
    text = re.sub(r'\[(.+?)\]\((.+?)\)', url_repl, text)
    return text

def parse_table(rows):
    """Parse markdown table to HTML table."""
    if len(rows) < 2:
        return '\n'.join(rows)
    
    headers = [cell.strip() for cell in rows[0].split('|')[1:-1]]
    data_rows = rows[2:]  # Skip header separator
    
    html = ['<table>']
    html.append('  <tr><th>' + '</th><th>'.join(headers) + '</th></tr>')
    for row in data_rows:
        cells = [inline_md(cell.strip()) for cell in row.split('|')[1:-1]]
        if cells:
            html.append('  <tr><td>' + '</td><td>'.join(cells) + '</td></tr>')
    html.append('</table>')
    return '\n'.join(html)

def convert(md_path, html_path):
    with open(md_path, 'r', encoding='utf-8') as f:
        md_content = f.read()
    
    html_body = md_to_html(md_content)
    title = os.path.splitext(os.path.basename(md_path))[0]
    
    html = f'''<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{title}</title>
</head>
<body>
<div class="container">
{html_body}
</div>
</body>
</html>'''
    
    with open(html_path, 'w', encoding='utf-8') as f:
        f.write(html)
    
    print(f"  Markdown 转换完成: {len(md_content)} chars → HTML ({html_path})")

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("用法: python3 md-to-html.py <input.md> <output.html>", file=sys.stderr)
        sys.exit(1)
    convert(sys.argv[1], sys.argv[2])

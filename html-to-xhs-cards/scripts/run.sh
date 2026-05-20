#!/usr/bin/env bash
# run.sh — HTML 或 Markdown → 小红书图片卡片
# 用法: bash run.sh <input.html|input.md> [output_dir]

set -euo pipefail

INPUT_FILE="${1:-}"
OUTPUT_DIR="${2:-}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(dirname "$SCRIPT_DIR")"
HERMES_DIR="/Users/openclaw-master/.hermes/hermes-agent"
WIDTH=1080
HEIGHT=1440

if [ -z "$INPUT_FILE" ]; then
  echo "用法: bash run.sh <input.html|input.md> [output_dir]"
  echo ""
  echo "示例:"
  echo "  bash run.sh article.html                    # 输出到 article-xhs-cards/"
  echo "  bash run.sh note.md /tmp/my-cards           # 输出到指定目录"
  exit 1
fi

if [ ! -f "$INPUT_FILE" ]; then
  echo "❌ 文件不存在: $INPUT_FILE"
  exit 1
fi

# 自动判断输出目录
if [ -z "$OUTPUT_DIR" ]; then
  INPUT_DIR="$(cd "$(dirname "$INPUT_FILE")" && pwd)"
  INPUT_BASENAME="$(basename "$INPUT_FILE" | sed 's/\.[^.]*$//')"
  OUTPUT_DIR="$INPUT_DIR/$INPUT_BASENAME-xhs-cards"
fi

mkdir -p "$OUTPUT_DIR"

# 判断输入类型
EXT="${INPUT_FILE##*.}"
HTML_FILE=""

if [ "$EXT" = "md" ] || [ "$EXT" = "markdown" ]; then
  echo "📝 检测到 Markdown 文件，转换为 HTML..."
  HTML_FILE="$OUTPUT_DIR/_temp.html"
  python3 "$SCRIPT_DIR/md-to-html.py" "$INPUT_FILE" "$HTML_FILE"
  echo "   → $HTML_FILE"
elif [ "$EXT" = "html" ] || [ "$EXT" = "htm" ]; then
  HTML_FILE="$INPUT_FILE"
  echo "🌐 检测到 HTML 文件，直接渲染..."
else
  echo "❌ 不支持的文件类型: .$EXT（支持 .html .htm .md .markdown）"
  exit 1
fi

# 用 Playwright 渲染并截图
echo "🎨 渲染中（${WIDTH}x${HEIGHT}，每页 ${HEIGHT}px）..."
cd "$HERMES_DIR" && NODE_PATH=./node_modules node "$SCRIPT_DIR/render-cards.cjs" \
  "$HTML_FILE" "$OUTPUT_DIR" "$WIDTH" "$HEIGHT"

# 清理临时文件
if [ "$EXT" = "md" ] || [ "$EXT" = "markdown" ]; then
  rm -f "$HTML_FILE"
fi

# 生成 manifest
CARD_COUNT=$(ls "$OUTPUT_DIR"/card-*.png 2>/dev/null | wc -l | tr -d ' ')
cat > "$OUTPUT_DIR/manifest.json" << EOF
{
  "source": "$INPUT_FILE",
  "cards": $CARD_COUNT,
  "width": $WIDTH,
  "height": $HEIGHT,
  "format": "png",
  "created_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

echo ""
echo "✅ 完成！共 $CARD_COUNT 张图片"
echo "📁 $OUTPUT_DIR"
ls -lh "$OUTPUT_DIR"/card-*.png 2>/dev/null

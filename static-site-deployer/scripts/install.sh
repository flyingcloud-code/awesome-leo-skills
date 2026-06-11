#!/bin/bash
# Static Site Deployer - Install & Setup Script
# Usage: bash scripts/install.sh
# 
# This script can be run from anywhere - it will figure out the OpenClaw workspace.

set -e

SKILL_DIR="$(cd "$(dirname "$0")/.." && pwd)"

# Find the OpenClaw workspace (look for .openclaw in home)
OPENCLAW_HOME="${OPENCLAW_HOME:-$HOME/.openclaw}"
WORKSPACE_DIR="${OPENCLAW_WORKSPACE:-$OPENCLAW_HOME/workspace}"
SITES_DIR="$WORKSPACE_DIR/static-sites"

echo "🦐 Static Site Deployer - Setup"
echo "==============================="
echo "  Skill dir:   $SKILL_DIR"
echo "  Workspace:   $WORKSPACE_DIR"
echo "  Sites dir:   $SITES_DIR"
echo ""

# 1. Install dependencies
echo "📦 Installing dependencies..."
cd "$SKILL_DIR"
if [ -f package.json ]; then
    npm install --production 2>&1 | tail -3
fi

# 2. Create sites directory
echo "📁 Creating sites directory..."
mkdir -p "$SITES_DIR/_uploads"
mkdir -p "$WORKSPACE_DIR/logs"

# 3. Setup auth token
if [ -z "$STATIC_AUTH_TOKEN" ]; then
    DEFAULT_TOKEN=$(openssl rand -hex 16 2>/dev/null || echo "change-me-to-a-secret-token")
    echo "🔑 Generated API token: $DEFAULT_TOKEN"
    echo "   Save this - you'll need it for API calls!"
    export STATIC_AUTH_TOKEN="$DEFAULT_TOKEN"
else
    echo "🔑 Using provided API token"
fi

# 4. Setup systemd user service (preferred)
SERVICE_NAME="static-site-deployer"
SERVICE_FILE="$HOME/.config/systemd/user/$SERVICE_NAME.service"

if command -v systemctl &>/dev/null; then
    echo ""
    echo "⚙️  Installing systemd user service..."
    mkdir -p "$HOME/.config/systemd/user"
    
    cat > "$SERVICE_FILE" << SERVICECONTENT
[Unit]
Description=Static Site Deployer
After=network.target

[Service]
Type=simple
ExecStart=$(which node) $SKILL_DIR/scripts/server.js
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production
Environment=STATIC_API_PORT=${STATIC_API_PORT:-3456}
Environment=STATIC_SERVE_PORT=${STATIC_SERVE_PORT:-3457}
Environment=STATIC_SITES_DIR=$SITES_DIR
Environment=STATIC_AUTH_TOKEN=${STATIC_AUTH_TOKEN:-}
WorkingDirectory=$SKILL_DIR
StandardOutput=append:$WORKSPACE_DIR/logs/static-deployer.log
StandardError=append:$WORKSPACE_DIR/logs/static-deployer-error.log

[Install]
WantedBy=default.target
SERVICECONTENT

    systemctl --user daemon-reload
    systemctl --user enable "$SERVICE_NAME" 2>&1
    systemctl --user restart "$SERVICE_NAME" 2>&1
    
    echo "✅ Service installed!"
    systemctl --user status "$SERVICE_NAME" --no-pager | head -5
else
    echo ""
    echo "⚙️  Starting with nohup..."
    cd "$SKILL_DIR"
    nohup node scripts/server.js > "$WORKSPACE_DIR/logs/static-deployer.log" 2>&1 &
    echo "✅ Server started with PID $!"
fi

echo ""
echo "==============================="
echo "🎉 Setup complete!"
echo ""
echo "📋 Quick commands:"
echo "   Status:  systemctl --user status $SERVICE_NAME"
echo "   Logs:    tail -f $WORKSPACE_DIR/logs/static-deployer.log"
echo "   Test:    curl http://localhost:${STATIC_API_PORT:-3456}/api/health"
echo ""
echo "🔗 API endpoint: http://localhost:${STATIC_API_PORT:-3456}"
echo "📦 Static URL:   http://localhost:${STATIC_SERVE_PORT:-3457}"
echo "🔑 Auth token:   ${STATIC_AUTH_TOKEN:-"(none)"}"
echo "==============================="

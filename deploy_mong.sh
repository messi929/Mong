#!/bin/bash
# Deploy Mong Consulting API server to Hetzner
# Usage: bash deploy_mong.sh

set -e

SERVER="root@77.42.78.9"
REMOTE_DIR="/opt/mong"

echo "=== Mong Consulting Server Deploy ==="

# 1. Build server locally
echo "[1/5] Building server..."
cd "$(dirname "$0")/server"
npm run build

# 2. Create remote directory
echo "[2/5] Preparing remote directory..."
ssh $SERVER "mkdir -p $REMOTE_DIR/data"

# 3. Sync files to server
echo "[3/5] Syncing files to server..."
rsync -avz --delete \
  --exclude='node_modules' \
  --exclude='.env' \
  --exclude='data/' \
  --exclude='EXPERT_KNOWHOW.md' \
  ./ $SERVER:$REMOTE_DIR/

# 3b. Copy EXPERT_KNOWHOW.md from project root (advisory layer for AI prompt)
echo "[3b/5] Copying EXPERT_KNOWHOW.md..."
if [ -f ../docs/EXPERT_KNOWHOW.md ]; then
  scp ../docs/EXPERT_KNOWHOW.md $SERVER:$REMOTE_DIR/EXPERT_KNOWHOW.md
else
  echo "  WARN: ../docs/EXPERT_KNOWHOW.md not found — advisory layer will be disabled on server"
fi

# 4. Install dependencies and setup on server
echo "[4/5] Installing dependencies on server..."
ssh $SERVER << 'REMOTE_SCRIPT'
  cd /opt/mong

  # Install Node.js if not present
  if ! command -v node &> /dev/null; then
    echo "Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
    apt-get install -y nodejs
  fi

  # Install dependencies
  npm install --omit=dev

  # Create .env if not exists
  if [ ! -f .env ]; then
    cp .env.example .env
    echo ">>> IMPORTANT: Edit /opt/mong/.env with your ANTHROPIC_API_KEY and API_TOKEN"
  fi

  # Install systemd service
  cp mong-consulting.service /etc/systemd/system/
  systemctl daemon-reload
  systemctl enable mong-consulting
  systemctl restart mong-consulting

  echo "Service status:"
  systemctl status mong-consulting --no-pager
REMOTE_SCRIPT

echo "[5/5] Deploy complete!"
echo ""
echo "=== Post-deploy checklist ==="
echo "1. SSH into server: ssh $SERVER"
echo "2. Edit .env: nano $REMOTE_DIR/.env"
echo "   - Set ANTHROPIC_API_KEY"
echo "   - Set API_TOKEN (same value in Electron .env)"
echo "3. Restart: systemctl restart mong-consulting"
echo "4. Test: curl http://77.42.78.9:3100/api/health"
echo ""
echo "Logs: ssh $SERVER journalctl -u mong-consulting -f"

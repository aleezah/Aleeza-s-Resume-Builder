#!/bin/bash

echo "================================================"
echo "  Job Application Tool — First-Time Setup"
echo "================================================"
echo ""
echo "  NOTE: This setup requires approximately 300-400 MB"
echo "  of free disk space. Make sure you have enough room"
echo "  before continuing."
echo ""
read -p "  Press Enter to continue or Ctrl+C to cancel..."
echo ""

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# ── Step 1: Ensure Homebrew is available ─────────────────────────────────────

# Activate Homebrew if it exists but isn't in PATH yet
if [ -f "/opt/homebrew/bin/brew" ]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
elif [ -f "/usr/local/bin/brew" ]; then
    eval "$(/usr/local/bin/brew shellenv)"
fi

if ! command -v brew &> /dev/null; then
    echo "[!] Homebrew is not installed. Installing now..."
    echo "    You may be asked for your Mac password — this is normal."
    echo ""
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

    # Activate after install
    if [ -f "/opt/homebrew/bin/brew" ]; then
        eval "$(/opt/homebrew/bin/brew shellenv)"
    elif [ -f "/usr/local/bin/brew" ]; then
        eval "$(/usr/local/bin/brew shellenv)"
    fi
fi

if ! command -v brew &> /dev/null; then
    echo ""
    echo "[ERROR] Could not install Homebrew. Please install it manually:"
    echo "  https://brew.sh"
    exit 1
fi

echo "[OK] Homebrew found."
echo ""

# ── Step 2: Ensure Node.js LTS (v22) is installed ────────────────────────────

# Check if node@22 is already installed via brew
if ! brew list node@22 &> /dev/null; then
    echo "[!] Installing Node.js LTS (v22)..."
    echo "    This may take a few minutes. Please wait."
    echo ""
    brew install node@22
fi

# Unlink any other node version and link node@22
brew unlink node 2>/dev/null || true
brew link node@22 --force --overwrite

# Add node@22 to PATH for this session
export PATH="/opt/homebrew/opt/node@22/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

# Final check
if ! command -v node &> /dev/null; then
    echo ""
    echo "[ERROR] Node.js still not found after install."
    echo "  Try closing this Terminal window and running the script again."
    exit 1
fi

NODE_VER=$(node -v)
echo "[OK] Node.js $NODE_VER found."
echo ""

# ── Step 3: Install app dependencies ─────────────────────────────────────────

echo "[1/2] Installing app components (this may take a minute)..."
cd "$SCRIPT_DIR"
npm install
if [ $? -ne 0 ]; then
    echo ""
    echo "[ERROR] Installation failed. See the error above."
    exit 1
fi
npm install --prefix client
if [ $? -ne 0 ]; then
    echo ""
    echo "[ERROR] Installation failed. See the error above."
    exit 1
fi
echo "[OK] App components installed."
echo ""

# ── Step 4: Create .app launcher in /Applications ────────────────────────────

echo "[2/2] Creating app launcher in /Applications..."

APP_DIR="/Applications/Job Application Tool.app"
CONTENTS="$APP_DIR/Contents"
MACOS="$CONTENTS/MacOS"
RESOURCES="$CONTENTS/Resources"

rm -rf "$APP_DIR" 2>/dev/null || true
mkdir -p "$MACOS" "$RESOURCES"

cat > "$CONTENTS/Info.plist" << PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>launch</string>
    <key>CFBundleIdentifier</key>
    <string>com.aleezah.jobapplicationtool</string>
    <key>CFBundleName</key>
    <string>Job Application Tool</string>
    <key>CFBundleDisplayName</key>
    <string>Job Application Tool</string>
    <key>CFBundleVersion</key>
    <string>1.0</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>LSMinimumSystemVersion</key>
    <string>10.13</string>
</dict>
</plist>
PLIST

cat > "$MACOS/launch" << LAUNCHER
#!/bin/bash
export PATH="/opt/homebrew/opt/node@22/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
cd "$SCRIPT_DIR"
npm run dev &
SERVER_PID=\$!
sleep 4
open http://localhost:5173
wait \$SERVER_PID
LAUNCHER

chmod +x "$MACOS/launch"
echo "[OK] App created in /Applications."
echo ""

echo "================================================"
echo "  Setup complete!"
echo ""
echo "  Open 'Job Application Tool' from your"
echo "  Applications folder or Spotlight (Cmd+Space)."
echo ""
echo "  Or run this anytime to launch directly:"
echo "  bash \"$SCRIPT_DIR/start.sh\""
echo "================================================"
echo ""

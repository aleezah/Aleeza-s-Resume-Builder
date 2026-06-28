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

# ── Step 1: Ensure Node.js is available ──────────────────────────────────────

# Bring Homebrew and nvm into PATH in case they exist but aren't in current shell
export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.nvm/versions/node/$(ls $HOME/.nvm/versions/node 2>/dev/null | tail -1)/bin:$PATH"
[ -s "$HOME/.nvm/nvm.sh" ] && source "$HOME/.nvm/nvm.sh"

if ! command -v node &> /dev/null; then
    echo "[!] Node.js is not installed. Installing now..."
    echo ""

    # Try Homebrew first
    if ! command -v brew &> /dev/null; then
        echo "    Installing Homebrew (this takes a few minutes)..."
        echo "    You may be asked for your Mac password — this is normal."
        echo ""
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

        # Add Homebrew to PATH for this session (Apple Silicon vs Intel)
        if [ -f "/opt/homebrew/bin/brew" ]; then
            export PATH="/opt/homebrew/bin:$PATH"
            eval "$(/opt/homebrew/bin/brew shellenv)"
        elif [ -f "/usr/local/bin/brew" ]; then
            export PATH="/usr/local/bin:$PATH"
            eval "$(/usr/local/bin/brew shellenv)"
        fi
    fi

    if command -v brew &> /dev/null; then
        echo "    Installing Node.js via Homebrew..."
        brew install node
        export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
    else
        echo ""
        echo "[ERROR] Could not install Homebrew automatically."
        echo ""
        echo "  Please install Node.js manually:"
        echo "  1. Go to: https://nodejs.org"
        echo "  2. Download and run the macOS installer"
        echo "  3. Re-run this script when done"
        echo ""
        open "https://nodejs.org/en/download"
        read -p "Press Enter after Node.js is installed to continue..."
    fi
fi

# Final check
if ! command -v node &> /dev/null; then
    echo ""
    echo "[ERROR] Node.js still not found. Please restart Terminal and run this script again."
    exit 1
fi

NODE_VER=$(node -v)
echo "[OK] Node.js $NODE_VER found."
echo ""

# ── Step 2: Install npm dependencies ─────────────────────────────────────────

echo "[1/2] Installing dependencies (this may take a minute)..."
cd "$SCRIPT_DIR"
npm install
npm install --prefix client
echo "[OK] Dependencies installed."
echo ""

# ── Step 3: Create .app launcher in /Applications ────────────────────────────

echo "[2/2] Creating app launcher in /Applications..."

APP_DIR="/Applications/Job Application Tool.app"
CONTENTS="$APP_DIR/Contents"
MACOS="$CONTENTS/MacOS"
RESOURCES="$CONTENTS/Resources"

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

# Build the node path so the .app can find node even without a full shell
NODE_PATH=$(command -v node || echo "/opt/homebrew/bin/node")
NODE_DIR=$(dirname "$NODE_PATH")

cat > "$MACOS/launch" << LAUNCHER
#!/bin/bash
export PATH="$NODE_DIR:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
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
echo "================================================"
echo ""

#!/bin/bash
set -e

echo "================================================"
echo "  Job Application Tool — First-Time Setup"
echo "================================================"
echo ""

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo "[!] Node.js is not installed."
    echo ""
    # Check for Homebrew
    if command -v brew &> /dev/null; then
        echo "    Installing Node.js via Homebrew..."
        brew install node
    else
        echo "    Opening the Node.js download page..."
        echo "    Please install Node.js LTS, then run this script again."
        open "https://nodejs.org/en/download"
        exit 1
    fi
fi

NODE_VER=$(node -v)
echo "[OK] Node.js found: $NODE_VER"
echo ""

# Install dependencies
echo "[1/2] Installing dependencies (this may take a minute)..."
npm run install:all
echo ""
echo "[OK] Dependencies installed."
echo ""

# Create a launcher app using AppleScript so it shows in Dock/Spotlight
echo "[2/2] Creating Job Application Tool app in Applications..."
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

APP_DIR="/Applications/Job Application Tool.app"
CONTENTS="$APP_DIR/Contents"
MACOS="$CONTENTS/MacOS"
RESOURCES="$CONTENTS/Resources"

mkdir -p "$MACOS" "$RESOURCES"

# Info.plist
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
    <key>CFBundleVersion</key>
    <string>1.0</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
</dict>
</plist>
PLIST

# Launcher script
cat > "$MACOS/launch" << LAUNCHER
#!/bin/bash
cd "$SCRIPT_DIR"
# Start server in background
npm run dev &
SERVER_PID=\$!
# Wait then open browser
sleep 4
open http://localhost:5173
# Keep running until window closes
wait \$SERVER_PID
LAUNCHER

chmod +x "$MACOS/launch"

echo "[OK] Job Application Tool added to /Applications."
echo ""
echo "================================================"
echo "  Setup complete!"
echo ""
echo "  Open 'Job Application Tool' from your Applications"
echo "  folder or Spotlight (Cmd + Space) anytime."
echo "================================================"
echo ""

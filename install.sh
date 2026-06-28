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

# ── Step 4: Convert icon to .icns format ─────────────────────────────────────

ICNS_PATH="$SCRIPT_DIR/Job Application Tool.icns"
ICO_PATH="$SCRIPT_DIR/Job Application Tool.ico"

if [ ! -f "$ICNS_PATH" ] && [ -f "$ICO_PATH" ]; then
    echo "    Converting icon to Mac format..."
    ICONSET=$(mktemp -d /tmp/icon.iconset.XXXX)
    # sips can read .ico and convert to png
    sips -s format png "$ICO_PATH" --out /tmp/icon_src.png &>/dev/null
    for size in 16 32 64 128 256 512; do
        sips -z $size $size /tmp/icon_src.png --out "$ICONSET/icon_${size}x${size}.png" &>/dev/null
    done
    iconutil -c icns "$ICONSET" -o "$ICNS_PATH" 2>/dev/null || true
    rm -rf "$ICONSET" /tmp/icon_src.png
fi

# ── Step 5: Create .app launcher using AppleScript ───────────────────────────

echo "[2/2] Creating app launcher..."

APP_PATH="/Applications/Job Application Tool.app"

# Remove old version if it exists
rm -rf "$APP_PATH" 2>/dev/null || true

# Build AppleScript app — macOS handles these natively without security warnings
osacompile -o "$APP_PATH" << APPLESCRIPT
on run
    set appDir to "$SCRIPT_DIR"
    set nodePath to "/opt/homebrew/opt/node@22/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
    tell application "Terminal"
        activate
        do script "export PATH=\"" & nodePath & "\"; cd " & quoted form of appDir & " && npm run dev"
    end tell
    delay 5
    open location "http://localhost:5173"
end run
APPLESCRIPT

# Apply icon if we have one
if [ -f "$ICNS_PATH" ]; then
    cp "$ICNS_PATH" "$APP_PATH/Contents/Resources/applet.icns"

    # Update Info.plist to explicitly reference the icon
    /usr/libexec/PlistBuddy -c "Set :CFBundleIconFile applet" "$APP_PATH/Contents/Info.plist" 2>/dev/null || true

    # Use Python (built into macOS) to set the icon via Finder API — most reliable method
    python3 - << PYEOF 2>/dev/null || true
import subprocess, sys
try:
    import Cocoa
    image = Cocoa.NSImage.alloc().initWithContentsOfFile_("$ICNS_PATH")
    if image:
        ws = Cocoa.NSWorkspace.sharedWorkspace()
        ws.setIcon_forFile_options_(image, "$APP_PATH", 0)
except Exception as e:
    pass
PYEOF

    # Clear macOS icon cache so the new icon shows immediately
    touch "$APP_PATH"
    killall Dock 2>/dev/null || true
fi

# Remove quarantine flag so macOS doesn't block it
xattr -cr "$APP_PATH" 2>/dev/null || true

# Also create a Desktop alias for easy access
ALIAS_PATH="$HOME/Desktop/Job Application Tool"
rm -f "$ALIAS_PATH" 2>/dev/null || true
osascript -e "tell application \"Finder\" to make alias file to POSIX file \"$APP_PATH\" at POSIX file \"$HOME/Desktop\""

echo "[OK] App created in /Applications and on your Desktop."
echo ""

echo "================================================"
echo "  Setup complete!"
echo ""
echo "  Double-click 'Job Application Tool' on your"
echo "  Desktop or in Applications to launch anytime."
echo "  Your browser will open automatically."
echo ""
echo "  OPTIONAL — Set the custom icon (one time only):"
echo "  1. Open 'Job Application Tool.icns' in Preview"
echo "  2. Press Cmd+A then Cmd+C to copy the icon"
echo "  3. Right-click the app in Applications → Get Info"
echo "  4. Click the small icon in the top-left of Get Info"
echo "  5. Press Cmd+V to paste"
echo "================================================"
echo ""

#!/usr/bin/env bash
# =============================================================================
# build_ios.sh — 一键编译 Bomber Man 的 iOS 端（Capacitor 工程）
#
# 必须在 macOS 上运行（需要 Xcode + CocoaPods）。Windows 无法编译 iOS。
#
# 用法：
#   ./build_ios.sh                         # 默认：编译 iOS 模拟器版 .app（无需签名）
#   ./build_ios.sh --ipa --team TEAMID     # 归档并导出可直接安装的签名 IPA
#   ./build_ios.sh --ipa --no-codesign     # 生成未签名 IPA（用于企业/重签分发）
#   ./build_ios.sh --clean                 # 先清理 DerivedData / 构建缓存
#
# 可选参数：
#   --simulator       编译模拟器版 .app（默认）
#   --ipa             生成 IPA（配合 --team 或 --no-codesign）
#   --team TEAMID     Apple 开发者团队 ID（10 位字符），用于自动签名
#   --no-codesign     不签名（仅 --ipa 模式下有效，产物需自行重签）
#   --configuration   Debug 或 Release（默认 Debug for sim，Release for ipa）
#   --no-sync         跳过 npx cap sync ios（不把 www 同步进工程）
#   --no-pod          跳过 pod install
#   --out DIR         产物输出目录（默认 dist/）
#   --clean           清理构建缓存后再编译
#   -h, --help        显示帮助
# =============================================================================

set -euo pipefail

# ---------- 基本变量 ----------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR"
IOS_DIR="$PROJECT_ROOT/ios"
APP_DIR="$IOS_DIR/App"
WORKSPACE="$APP_DIR/App.xcworkspace"
SCHEME="App"
BUNDLE_ID="com.trae.bomberman"
APP_NAME="BomberMan"

MODE="simulator"          # simulator | ipa
TEAM=""
CODESIGN=1
CONFIGURATION=""
DO_SYNC=1
DO_POD=1
DO_CLEAN=0
OUT_DIR="$PROJECT_ROOT/dist"

# ---------- 工具函数 ----------
log()  { printf '\033[1;36m[build_ios]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[build_ios]\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31m[build_ios] ERROR:\033[0m %s\n' "$*" >&2; exit 1; }

usage() {
    sed -n '2,22p' "$0" | sed 's/^# \{0,1\}//'
    exit 0
}

require_cmd() {
    command -v "$1" >/dev/null 2>&1 || die "缺少命令：$1（请先安装后再运行）"
}

# ---------- 解析参数 ----------
while [[ $# -gt 0 ]]; do
    case "$1" in
        -h|--help)        usage ;;
        --simulator)      MODE="simulator"; shift ;;
        --ipa)            MODE="ipa"; shift ;;
        --team)           TEAM="${2:-}"; shift 2 ;;
        --no-codesign)    CODESIGN=0; shift ;;
        --configuration)  CONFIGURATION="${2:-}"; shift 2 ;;
        --no-sync)        DO_SYNC=0; shift ;;
        --no-pod)         DO_POD=0; shift ;;
        --out)            OUT_DIR="${2:-}"; shift 2 ;;
        --clean)          DO_CLEAN=1; shift ;;
        *) die "未知参数：$1（用 -h 查看帮助）" ;;
    esac
done

if [[ -n "$TEAM" ]]; then CODESIGN=1; fi
if [[ -z "$CONFIGURATION" ]]; then
    if [[ "$MODE" == "ipa" ]]; then CONFIGURATION=Release; else CONFIGURATION=Debug; fi
fi

# ---------- 前置检查 ----------
[[ "$(uname)" == "Darwin" ]] || die "iOS 只能在 macOS 上编译，当前系统：$(uname)"
require_cmd xcodebuild
require_cmd pod
require_cmd node
require_cmd zip
command -v npx >/dev/null 2>&1 || die "缺少 npx（随 Node.js 安装）"

# Xcode 是否选好 / 许可是否接受
if ! xcodebuild -version >/dev/null 2>&1; then
    die "Xcode 命令行工具不可用，请执行：sudo xcode-select -s /Applications/Xcode.app/Contents/Developer  并在 Xcode 中接受许可协议"
fi
# 工程是否就绪
[[ -d "$APP_DIR" ]] || die "找不到 ios/App 目录，请先在项目根执行：npx cap add ios"
[[ -f "$APP_DIR/Podfile" ]] || die "找不到 ios/App/Podfile"

mkdir -p "$OUT_DIR"

log "模式: $MODE  配置: $CONFIGURATION  输出: $OUT_DIR"

# ---------- 0. 安装依赖 ----------
if [[ ! -d "$PROJECT_ROOT/node_modules" ]]; then
    log "未发现 node_modules，执行 npm install ..."
    (cd "$PROJECT_ROOT" && npm install)
fi

# ---------- 1. 同步 Web 资源到 iOS 工程 ----------
if [[ $DO_SYNC -eq 1 ]]; then
    log "同步 www → ios（npx cap sync ios）..."
    (cd "$PROJECT_ROOT" && npx cap sync ios)
fi

# ---------- 2. 安装 CocoaPods 依赖 ----------
if [[ $DO_POD -eq 1 ]]; then
    log "安装 CocoaPods 依赖（pod install）..."
    (cd "$APP_DIR" && pod install)
fi

# ---------- 3. 清理（可选） ----------
DERIVED="$OUT_DIR/DerivedData"
if [[ $DO_CLEAN -eq 1 ]]; then
    log "清理构建缓存..."
    rm -rf "$DERIVED"
    xcodebuild -workspace "$WORKSPACE" -scheme "$SCHEME" clean >/dev/null 2>&1 || true
fi

# 公共构建参数
COMMON_ARGS=(
    -workspace "$WORKSPACE"
    -scheme "$SCHEME"
    -configuration "$CONFIGURATION"
    -derivedDataPath "$DERIVED"
    -quiet
    CODE_SIGN_STYLE=Automatic
)

# ---------- 4A. 模拟器版本（无需签名） ----------
if [[ "$MODE" == "simulator" ]]; then
    log "编译 iOS 模拟器版本..."
    xcodebuild "${COMMON_ARGS[@]}" \
        -sdk iphonesimulator \
        -destination 'generic/platform=iOS Simulator' \
        build

    APP_PATH="$(find "$DERIVED/Build/Products" -maxdepth 2 -name "App.app" -type d | grep -i "iphonesimulator" | head -1)" || true
    [[ -d "$APP_PATH" ]] || die "未找到模拟器产物 App.app"

    DEST="$OUT_DIR/${APP_NAME}-simulator.app"
    rm -rf "$DEST"
    cp -R "$APP_PATH" "$DEST"
    log "完成：$DEST"
    log "在模拟器安装：xcrun simctl install booted \"$DEST\""
    exit 0
fi

# ---------- 4B. IPA 版本 ----------
ARCHIVE="$OUT_DIR/${APP_NAME}.xcarchive"
rm -rf "$ARCHIVE"

if [[ $CODESIGN -eq 1 ]]; then
    [[ -n "$TEAM" ]] || die "签名 IPA 需要 --team TEAMID（Apple 开发者团队 ID，10 位字符）"

    log "归档（archive）并使用团队 $TEAM 自动签名..."
    xcodebuild "${COMMON_ARGS[@]}" \
        -destination 'generic/platform=iOS' \
        -archivePath "$ARCHIVE" \
        -allowProvisioningUpdates \
        DEVELOPMENT_TEAM="$TEAM" \
        archive

    PLIST="$(mktemp -t exportoptions).plist"
    cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>method</key><string>development</string>
  <key>teamID</key><string>$TEAM</string>
  <key>signingStyle</key><string>automatic</string>
  <key>stripSwiftSymbols</key><true/>
  <key>uploadSymbols</key><false/>
  <key>compileBitcode</key><false/>
</dict>
</plist>
EOF

    log "导出 IPA..."
    EXPORT_DIR="$OUT_DIR/ipa-export"
    rm -rf "$EXPORT_DIR"
    xcodebuild -exportArchive \
        -archivePath "$ARCHIVE" \
        -exportPath "$EXPORT_DIR" \
        -exportOptionsPlist "$PLIST" \
        -allowProvisioningUpdates \
        -quiet
    rm -f "$PLIST"

    IPA_SRC="$(find "$EXPORT_DIR" -maxdepth 1 -name "*.ipa" | head -1)" || true
    [[ -n "$IPA_SRC" ]] || die "导出失败：未在 $EXPORT_DIR 找到 .ipa"
    IPA_DST="$OUT_DIR/${APP_NAME}.ipa"
    mv -f "$IPA_SRC" "$IPA_DST"
    rm -rf "$EXPORT_DIR" "$ARCHIVE"
    log "完成（已签名，可安装）：$IPA_DST"
    log "安装到真机：ios-deploy --bundle \"$IPA_DST\"  或用 Xcode Devices 拖拽安装"
    exit 0
fi

# ---------- 4C. 未签名 IPA（用于企业分发 / 重签） ----------
log "编译未签名真机版本（CODE_SIGNING_ALLOWED=NO）..."
xcodebuild "${COMMON_ARGS[@]}" \
    -sdk iphoneos \
    -destination 'generic/platform=iOS' \
    CODE_SIGNING_ALLOWED=NO \
    CODE_SIGNING_REQUIRED=NO \
    CODE_SIGN_IDENTITY="" \
    build

APP_PATH="$(find "$DERIVED/Build/Products" -maxdepth 2 -name "App.app" -type d | grep -i "iphoneos" | head -1)" || true
[[ -d "$APP_PATH" ]] || die "未找到真机产物 App.app"

log "打包未签名 IPA..."
PAYLOAD="$OUT_DIR/_payload"
rm -rf "$PAYLOAD"
mkdir -p "$PAYLOAD/Payload"
cp -R "$APP_PATH" "$PAYLOAD/Payload/App.app"
IPA_DST="$OUT_DIR/${APP_NAME}-unsigned.ipa"
rm -f "$IPA_DST"
(cd "$PAYLOAD" && zip -qr "$IPA_DST" Payload)
rm -rf "$PAYLOAD"
log "完成（未签名，需重签后安装）：$IPA_DST"
exit 0

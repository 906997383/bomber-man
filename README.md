# Bomber Man — Android / iOS

一个基于原版 FC《BOMBER MAN》(Hudson Soft, 1985) 复刻的手机游戏。
游戏逻辑、触屏操作与音效为全新实现；画面直接解码原版 ROM 的 8 KB CHR 图形，
因此标题 Logo、墙体、砖块、角色、HUD 字体均为原版像素素材。

- 逻辑分辨率：256 × 240（NES），16 × 13 格地图，每格 16 px
- 玩法：放炸弹、炸砖块、消灭全部敌人后进入出口门通关
- 道具：火力 +1、炸弹数 +1、移动速度提升
- 操作：左侧虚拟方向键 + 右侧 BOMB 键；桌面端支持方向键 / WASD + 空格 / Z
- 纯静态单页（HTML + Canvas + 原生 JS），无任何运行时依赖

## 目录结构

```
www/                 可运行的 Web 游戏（也是 Capacitor 的 webDir）
  index.html
  style.css
  manifest.json
  assets/            App 图标
  js/chr.js          原版 CHR 图形（base64）
  js/title.js        原版标题画面 nametable
  js/game.js         游戏逻辑 / 渲染 / 音效 / 触屏控制
android/            已生成的原生 Android 工程（可编译）
ios/                已生成的原生 Xcode 工程（需在 macOS 上编译）
dist/               已构建好的安装包
  BomberMan-android-debug.apk
capacitor.config.json
package.json
```

## 本地运行

```bash
python -m http.server 8080 --directory www
# 浏览器打开 http://localhost:8080
```
或 `npm run serve`（使用 http-server）。

## 打包 Android（本机已完成一次构建）

原生工程已生成，`android/` 已配置 `local.properties`（指向本机 SDK）并调整为
`compileSdk = 35 / targetSdk = 35`。JDK 17 与 Android SDK 35 已具备，重新打包只需：

```bash
npm install
npx cap sync android
cd android
./gradlew assembleDebug      # Windows: gradlew.bat assembleDebug
# 产物：android/app/build/outputs/apk/debug/app-debug.apk
```

本次构建产物已复制到 `dist/BomberMan-android-debug.apk`（约 3.6 MB）。

安装到手机：`adb install -r dist/BomberMan-android-debug.apk`，
或把 APK 传到手机后直接点击安装（需允许“安装未知来源应用”）。

> 若 `gradlew` 卡在下载 Gradle 发行包（国内网络访问 services.gradle.org 常被重置），
> 可直接用本机已解压的 Gradle 8.x 执行：
> `%USERPROFILE%\.gradle\wrapper\dists\gradle-8.4-bin\*\gradle-8.4\bin\gradle.bat assembleDebug`。
> 工程仓库已在 `android/build.gradle` 中加入阿里云 Google/Central 镜像，
> 避免 `dl.google.com` 直连失败导致依赖下载挂起。

正式发布：在 Android Studio 中 Build > Generate Signed Bundle / APK 生成签名的 AAB/APK。
如果换了电脑或 SDK 路径，修改 `android/local.properties` 中的 `sdk.dir`，或删除该文件让
Gradle 使用 `ANDROID_HOME`。

## 打包 iOS

需要 macOS + Xcode 15+ 与 CocoaPods（iOS 打包无法在 Windows 上完成）。工程已生成在 `ios/App`。
推荐用根目录的一键脚本 [build_ios.sh](build_ios.sh)（脚本内含环境自检、依赖同步、签名参数）：

```bash
chmod +x build_ios.sh

# 1) 模拟器版 .app（无需签名，最快验证）
./build_ios.sh                       # 产物：dist/BomberMan-simulator.app
xcrun simctl install booted dist/BomberMan-simulator.app

# 2) 可直接安装到真机的签名 IPA（需 Apple 开发者账号的 Team ID，10 位字符）
./build_ios.sh --ipa --team ABCDE12345      # 产物：dist/BomberMan.ipa

# 3) 未签名 IPA（用于企业证书重签 / 第三方分发）
./build_ios.sh --ipa --no-codesign          # 产物：dist/BomberMan-unsigned.ipa
```

脚本会自动执行 `npm install`（若缺依赖）、`npx cap sync ios`（同步 `www/`）、`pod install`。
常用可选参数：`--clean`（清缓存后重编）、`--no-sync` / `--no-pod`（跳过某步）、
`--configuration Debug|Release`、`--out 目录`。也可通过 npm 调用：
`npm run build:ios:sim` / `npm run build:ios:ipa -- --team ABCDE12345`。

### 云构建（GitHub Actions，无需本地 Mac）

仓库内置了 [.github/workflows/build-ios.yml](.github/workflows/build-ios.yml)，
用 GitHub 托管的 macOS runner 编译。把项目推到 GitHub 后：

1. 打开仓库 **Actions → Build iOS → Run workflow**（或推送 `main` 触发）。
2. 构建完成后在该次运行页面底部 **Artifacts** 下载产物：
   - `BomberMan-simulator.app.zip` — 模拟器 `.app`（无需签名，拖进 Xcode 模拟器即可运行）
   - `BomberMan-unsigned.ipa` — 未签名 IPA（可用 AltStore / Sideloadly 重签后装到真机）
   - `BomberMan.ipa` — **仅当配置了签名密钥时**才产出，可直接安装

要产出可直接安装的签名 IPA，在仓库 **Settings → Secrets and variables → Actions** 添加以下密钥：

| Secret | 内容 |
|---|---|
| `BUILD_CERTIFICATE_BASE64` | 导出的 `.p12` 证书的 base64（`base64 -i cert.p12`） |
| `P12_PASSWORD` | `.p12` 的密码 |
| `PROVISIONING_PROFILE_BASE64` | `.mobileprovision` 的 base64 |
| `TEAM_ID` | 10 位开发者团队 ID |
| `KEYCHAIN_PASSWORD` | （可选）临时 keychain 密码，留空用默认值 |

证书与描述文件需在本地 Mac 的 Xcode / 开发者网站生成一次，导出后转 base64 填入即可。
运行时可在弹窗里选择导出方式：`development`（默认，装到已注册设备）/ `app-store` / `ad-hoc` / `enterprise`。

手动方式（不开脚本）：

```bash
cd ios/App
pod install && open App.xcworkspace
```

在 Xcode 中设置 Team 与 Bundle Identifier（`com.trae.bomberman`）后，选择真机/模拟器 Run；
发布走 Product > Archive > Distribute App。若在另一台电脑上修改了 `www/`，先执行
`npx cap sync ios` 再 `pod install`。

## 修改游戏

- 关卡/玩法参数在 `www/js/game.js`：`STAGE1` 为原版第 1 关地图（`#` 石墙、`B` 砖块、`.` 地板），
  第 2 关起按原版“偶数行列石柱 + 随机砖块”规则生成。
- 数值：`P.speed`（移动速度）、`P.power`（火力）、`P.maxBombs`（同时炸弹数）、
  炸弹引信 `fuse: 130`（帧）、火焰持续 `life: 30`（帧）。
- 修改 `www/` 后执行 `npx cap sync` 再重新构建原生 App。

## 与 ROM 的关系

`www/js/chr.js`、`www/js/title.js` 由原版 ROM 提取，仅用于像素素材还原；
原 ROM 文件本身不随游戏分发。请自行确保对原作素材的使用符合当地法律与版权要求。

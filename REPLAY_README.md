# YRP 回放功能

## 功能说明

本项目新增了 YRP 回放文件播放功能，可以在浏览器中回放 YGOpro 的决斗录像。

## 文件结构

```
src/
├── composables/
│   ├── useYRPParser.js    # YRP 文件解析器
│   ├── useOCGCore.js      # OCGCore WASM 包装器
│   ├── useDuelMessage.js  # 决斗消息解析器
│   └── useReplay.js       # 回放功能整合
└── components/
    └── ReplayPlayer.vue   # 回放播放器组件

public/
├── lzma.js               # LZMA 解压库
├── ocgcore_wasm.js       # OCGCore WASM
├── ocgcore_wasm.wasm     # WASM 二进制
├── cards.cdb             # 卡片数据库
├── images/back.jpg       # 卡背图片
├── pics/                 # 卡图目录
└── ygopro-scripts/       # 卡片脚本 (需手动配置)
```

## 使用方法

### 1. 在界面中使用

点击主界面的 "🎬 回放YRP" 按钮，选择 `.yrp` 文件即可开始回放。

### 2. 程序化使用

```javascript
import { useReplay } from '@/composables/useReplay'

const replay = useReplay()

// 加载回放文件
await replay.loadReplay(file, cardDatabase, scriptLoader)

// 单步执行
await replay.step()

// 连续播放 (每步间隔 500ms)
await replay.play(500)

// 访问状态
console.log(replay.duelState.value)
console.log(replay.logs.value)
```

## 配置脚本目录

回放功能需要 ygopro 的 Lua 脚本文件才能正确处理卡片效果。

### 方法1: 复制脚本目录

将 ygopro 的 `script` 目录复制到 `public/ygopro-scripts/`:

```bash
# Windows
xcopy /E /I path\to\ygopro\script public\ygopro-scripts

# Linux/Mac
cp -r path/to/ygopro/script public/ygopro-scripts
```

### 方法2: 使用符号链接

```bash
# Windows (需要管理员权限)
mklink /D public\ygopro-scripts path\to\ygopro\script

# Linux/Mac
ln -s path/to/ygopro/script public/ygopro-scripts
```

## 支持的文件格式

- YRP1 (旧版 YGOpro 格式)
- YRP2 (新版 YGOpro 格式，支持扩展种子序列)
- 支持 LZMA 压缩的回放文件

## 依赖项目

- **ygopro-core-wasm**: OCGCore 的 WebAssembly 版本
- **yrp-parser**: YRP 文件格式解析参考

## 已知限制

1. 脚本加载是同步的，大量脚本可能导致初始加载较慢
2. TAG 模式 (4人对战) 暂未完全支持
3. 单人模式 (脚本对战) 暂未完全支持
4. 回退功能暂未实现 (需要重新初始化决斗)

## 技术细节

### YRP 文件格式

```
Header (32 bytes):
- id: uint32        # 0x31707279 (YRP1) 或 0x32707279 (YRP2)
- version: uint32   # 版本号
- flag: uint32      # 标志位
- seed: uint32      # 随机种子
- dataSize: uint32  # 解压后数据大小
- startTime: uint32 # 开始时间戳
- props: byte[8]    # LZMA 压缩属性

Extended Header (YRP2, 额外 48 bytes):
- seedSequence: uint32[8]  # 种子序列
- headerVersion: uint32
- value1, value2, value3: uint32

Data Section (LZMA compressed):
- players: UTF16LE[playerCount][20]  # 玩家名称
- params: DuelParameters             # 决斗参数
- decks: Deck[playerCount]           # 卡组数据
- responses: byte[]                  # 响应数据
```

### 消息处理流程

```
1. 调用 ocg.process() 获取处理结果
2. 调用 ocg.getMessage() 获取消息
3. 解析消息并更新 UI 状态
4. 如果需要响应，从回放文件读取并调用 ocg.setResponseB()
5. 重复直到决斗结束
```


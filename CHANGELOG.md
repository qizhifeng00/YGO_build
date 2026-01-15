# 更新日志

## [2026-01-15] 重大更新：全新布局 + 卡组导入 + 使用引导

### 🎨 界面重构
- **全新侧边栏布局**：采用 `SidebarLayout` 组件重构整体布局
  - 左侧侧边栏包含：卡组管理、决斗参数、卡组构成、卡牌配置等面板
  - 主区域聚焦于逻辑判定和计算核心
  - 可折叠面板设计 (`CollapsiblePanel`)，界面更加清爽
- **新增快捷操作卡片**：在主区域右侧显示当前条件预览、卡组概览、快捷操作按钮

### 📦 卡组导入功能（重要新功能）
- **多格式支持**：
  - YDK 文件上传
  - YDK 文本粘贴
  - YDKE URL 导入
  - Base64 编码导入
  - YGOMobile URL 导入
- **卡片数据库集成**：
  - 集成 `sql.js` 读取 `cards.cdb` 数据库
  - 支持自定义 CDB 文件或使用内置数据库
  - 自动解析卡牌名称、类型（怪兽/魔法/陷阱）
- **预览确认流程**：
  - 解析后显示卡牌列表预览（含卡图缩略图）
  - 显示主卡组、额外卡组、副卡组数量统计
  - 最多导入 30 种卡牌

### 🎯 使用引导功能
- **Driver.js 集成**：首次访问自动启动引导
- **5 步引导流程**：
  1. 导入卡组按钮
  2. 逻辑判定面板
  3. 展开条件区域
  4. 或条件/且条件选择器
  5. 精确计算按钮
- **自定义引导样式**：游戏王主题配色（金色+深蓝）

### 🛡️ 打断分析功能（计算面板新增）
- **对手配置**：设置对手卡组大小、起手抽卡数
- **手坑配置**：预设多种常见手坑（增G、灰流、无限泡影等）
- **快捷按钮**：满投、清零、主流配置一键设置
- **关键点分析**：检索点、召唤点、特招点配置

### 🌐 小世界计算器增强
- **从卡组导入**：一键从卡牌配置导入怪兽卡
  - 自动提取怪兽的 ATK、DEF、等级、种族、属性
- **分析结果折叠**：可直接连接、需要桥梁、无法到达三类结果可折叠展示

### 🔧 技术改进
- **新增依赖**：
  - `driver.js`: 使用引导
  - `sql.js`: SQLite 数据库读取
  - `ygopro-deck-encode`: YDK/YDKE 格式解析
- **新增 Composable**：
  - `useCardDatabase.js`: 卡片数据库操作封装
- **数据结构扩展**：
  - 卡牌对象新增 `cardId` 字段用于关联 YGOPro 卡片 ID

### 📁 文件变更
- 新增：`src/components/SidebarLayout.vue`
- 新增：`src/components/CollapsiblePanel.vue`
- 新增：`src/composables/useCardDatabase.js`
- 新增：`src/images/back.jpg`（本地卡牌背景）
- 新增：`public/cards.cdb`（内置卡片数据库）
- 修改：`src/App.vue`（全新布局结构）
- 修改：`src/components/CardInput.vue`（导入功能、卡图显示）
- 修改：`src/components/CardDragBuilder.vue`（卡图显示）
- 修改：`src/components/CalculationPanel.vue`（打断分析）
- 修改：`src/components/ConditionInput.vue`（添加 ID 用于引导）
- 修改：`src/components/SmallWorldCalculator.vue`（从卡组导入）
- 修改：`src/composables/useDeck.js`（支持 cardId 存储）

---

## 历史版本

### [更早版本]
- 基础概率计算功能
- 蒙特卡洛模拟
- 卡组管理与保存
- 条件表达式解析
- 卡组优化建议
- 推理计算器
- 小世界计算器


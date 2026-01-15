<template>
  <n-config-provider :theme-overrides="themeOverrides">
    <n-message-provider>
      <n-dialog-provider>
        <SidebarLayout ref="sidebarRef">
          <!-- 卡组管理面板 -->
          <template #deck-management>
            <CollapsiblePanel title="卡组档案" :default-expanded="true">
              <DeckManagement />
            </CollapsiblePanel>
          </template>

             <template #draw-settings>
            <CollapsiblePanel title="决斗参数" :default-expanded="true">
              <DrawSettings />
            </CollapsiblePanel>
          </template>
          
          <template #deck-pie>
            <CollapsiblePanel title="卡组构成" :default-expanded="true">
              <DeckPieChart />
            </CollapsiblePanel>
          </template>
          
       

          <!-- 卡牌配置面板（移入卡组管理） -->
          <template #card-input>
            <CollapsiblePanel title="卡牌配置" :default-expanded="true">
              <CardInput />
            </CollapsiblePanel>
          </template>

          <!-- 辅助工具面板 -->
          <template #small-world>
            <CollapsiblePanel title="小世界计算" :default-expanded="true">
              <SmallWorldCalculator />
            </CollapsiblePanel>
          </template>
          
          <template #reasoning>
            <CollapsiblePanel title="推理计算" :default-expanded="false">
              <ReasoningCalculator />
            </CollapsiblePanel>
          </template>
          
          <template #optimizer>
            <CollapsiblePanel title="卡组优化" :default-expanded="false">
              <DeckOptimizer />
            </CollapsiblePanel>
          </template>

          <!-- 设置面板 -->
          <template #settings>
            <CollapsiblePanel title="关于" :default-expanded="true">
              <n-space vertical :size="12">
                <n-text depth="2" style="font-size: 14px;">
                  游戏王概率计算器 v{{ version }}
                </n-text>
                <n-divider style="margin: 8px 0;" />
                <n-text depth="3" style="font-size: 13px;">
                  该工具部分代码与思路来源于 天天发蛋糕的工具箱
                </n-text>
              </n-space>
            </CollapsiblePanel>
            
            <CollapsiblePanel title="功能构想" :default-expanded="true">
              <n-space vertical :size="8">
                <div v-for="idea in featureIdeas" :key="idea.id" class="feature-item">
                  <n-tag 
                    :type="idea.status === 'done' ? 'success' : idea.status === 'wip' ? 'warning' : 'default'"
                    size="medium"
                    :bordered="false"
                  >
                    <template #icon>
                      <span style="font-size: 12px;">{{ idea.status === 'done' ? '✅' : idea.status === 'wip' ? '🔧' : '📝' }}</span>
                    </template>
                    {{ idea.name }}
                  </n-tag>
                </div>
              </n-space>
            </CollapsiblePanel>

            <CollapsiblePanel title="使用说明" :default-expanded="false">
              <n-space vertical :size="10">
                <n-text depth="3" style="font-size: 13px;">
                  <strong>运算符（优先级从高到低）：</strong>
                </n-text>
                <n-text depth="3" style="font-size: 13px;">
                  <code>()</code> - 明确运算优先级；
                  <code>!</code> - 逻辑非；
                  <code>*</code> - 乘；
                  <code>/</code> - 除；
                  <code>%</code> - 取模；
                  <code>+</code> - 加；
                  <code>-</code> - 减
                </n-text>
                <n-text depth="3" style="font-size: 13px;">
                  <strong>比较运算符：</strong>
                  <code>&gt;</code> - 大于；
                  <code>&gt;=</code> - 大于等于；
                  <code>&lt;</code> - 小于；
                  <code>&lt;=</code> - 小于等于；
                  <code>==</code> - 等于；
                  <code>!=</code> - 不等；
                  <code>&&</code> - 逻辑与；
                  <code>||</code> - 逻辑或
                </n-text>
                <n-divider style="margin: 4px 0;" />
                <n-text depth="3" style="font-size: 13px;">
                  <strong>变量名：</strong> a, b, c, ..., z, aa, ab, ac, ad 对应各类卡，也可以使用自定卡名。
                </n-text>
                <n-text depth="3" style="font-size: 13px;">
                  <strong>注意：</strong> 判断相等请使用 == 或 ===，不要使用中文标点符号。
                </n-text>
              </n-space>
            </CollapsiblePanel>

            <CollapsiblePanel title="反馈" :default-expanded="true">
              <n-space vertical :size="8">
                <n-text depth="3" style="font-size: 13px;">
                  如有问题或建议，欢迎通过 QQ 312999192 联系
                </n-text>
                <div ref="walineRef" style="margin-top: 12px;"></div>
              </n-space>
            </CollapsiblePanel>
          </template>

          <!-- 主内容区 - 计算核心 + 逻辑判定 -->
          <template #main>
            <div class="main-layout">
              <!-- 顶部标题栏 -->
              <div class="main-header">
                <div class="header-content">
                  <div class="logo-icon">Y</div>
                  <h1 class="app-title">游戏王概率计算器</h1>
                </div>
                <n-space align="center" :size="8">
                  <n-button size="small" quaternary @click="startTour" title="使用引导">
                    ❓ 引导
                  </n-button>
                  <n-tag 
                    v-for="idea in featureIdeas.slice(0, 2)" 
                    :key="idea.id"
                    :type="idea.status === 'done' ? 'success' : idea.status === 'wip' ? 'warning' : 'default'"
                    size="small"
                    :bordered="false"
                  >
                    {{ idea.status === 'wip' ? '🔧' : '📝' }} {{ idea.name }}
                  </n-tag>
                </n-space>
              </div>

              <!-- 主要区域 -->
              <div class="main-content-area">
                <n-grid :cols="24" :x-gap="12" :y-gap="12">
                  <!-- 逻辑判定 - 移到主区域 -->
                  <n-grid-item :span="24">
                    <ConditionInput />
                  </n-grid-item>

                  <!-- 计算核心 -->
                  <n-grid-item :span="isMobile ? 24 : 14">
                    <CalculationPanel />
                  </n-grid-item>

                  <!-- 右侧辅助信息 -->
                  <n-grid-item :span="isMobile ? 24 : 10">
                    <n-space vertical :size="12">
                      <!-- 快捷条件预览 -->
                      <n-card title="📋 当前条件" size="small">
                        <n-text code style="word-break: break-all; font-size: 12px;">
                          {{ condition || '(未设置条件)' }}
                        </n-text>
                      </n-card>

                      <!-- 卡组概览 -->
                      <n-card title="📊 卡组概览" size="small">
                        <n-space vertical :size="8">
                          <div class="deck-stat-row">
                            <n-text depth="2">总卡数</n-text>
                            <n-text strong>{{ deck.totalCards.value }} 张</n-text>
                          </div>
                          <div class="deck-stat-row">
                            <n-text depth="2">卡种类</n-text>
                            <n-text strong>{{ deck.cards.value.filter(c => c.count > 0).length }} 类</n-text>
                          </div>
                          <div class="deck-stat-row">
                            <n-text depth="2">抽卡数</n-text>
                            <n-text strong>{{ draws }} 张</n-text>
                          </div>
                        </n-space>
                      </n-card>

                      <!-- 快捷操作 -->
                      <n-card size="small">
                        <template #header>
                          <n-space align="center" :size="4">
                            <span>⚡</span>
                            <span>快捷操作</span>
                          </n-space>
                        </template>
                        <n-space wrap :size="8">
                          <n-button size="small" secondary @click="switchToPanel('deck')">
                            📁 卡组管理
                          </n-button>
                          <n-button size="small" secondary @click="switchToPanel('tools')">
                            🛠️ 辅助工具
                          </n-button>
                        </n-space>
                      </n-card>
                    </n-space>
                  </n-grid-item>
                </n-grid>
              </div>
            </div>
          </template>
        </SidebarLayout>
      </n-dialog-provider>
    </n-message-provider>
  </n-config-provider>
</template>

<script setup>
import { ref, provide, onMounted, onUnmounted, computed, nextTick } from 'vue'
import { init } from '@waline/client'
import '@waline/client/style'
import { driver } from 'driver.js'
import 'driver.js/dist/driver.css'
import { 
  NConfigProvider, NMessageProvider, NDialogProvider,
  NText, NSpace, NGrid, NGridItem, NCard,
  NTag, NDivider, NButton
} from 'naive-ui'

// 布局组件
import SidebarLayout from './components/SidebarLayout.vue'
import CollapsiblePanel from './components/CollapsiblePanel.vue'

// 功能组件
import DeckManagement from './components/DeckManagement.vue'
import CardInput from './components/CardInput.vue'
import DeckPieChart from './components/DeckPieChart.vue'
import DrawSettings from './components/DrawSettings.vue'
import ConditionInput from './components/ConditionInput.vue'
import CalculationPanel from './components/CalculationPanel.vue'
import DeckOptimizer from './components/DeckOptimizer.vue'
import ReasoningCalculator from './components/ReasoningCalculator.vue'
import SmallWorldCalculator from './components/SmallWorldCalculator.vue'

// Composables
import { useDeck } from './composables/useDeck'
import { useCalculation } from './composables/useCalculation'
import { useConditionBuilder } from './composables/useConditionBuilder'

const version = '0.0.1'

const themeOverrides = {
  common: {
    primaryColor: '#0f172a',
    primaryColorHover: '#334155',
    primaryColorPressed: '#020617',
    primaryColorSuppl: '#334155',
    borderRadius: '10px',
    cardColor: '#ffffff',
    modalColor: '#ffffff',
    popoverColor: '#ffffff',
    bodyColor: '#f0f2f5',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
  },
  Card: {
    borderRadius: '12px',
    titleFontSizeMedium: '16px',
    titleFontWeight: '600',
    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
    paddingMedium: '16px'
  },
  Button: {
    borderRadiusMedium: '8px',
    fontWeight: '500'
  },
  Input: {
    borderRadius: '8px'
  }
}

// 功能构想列表
const featureIdeas = ref([
  { id: 1, name: '启动率优化器', status: 'wip' },
  { id: 2, name: '补全所有需要计算的卡牌的计算功能', status: 'plan' },
])

// 初始化状态
const deck = useDeck()
const calculation = useCalculation()
const builder = useConditionBuilder()

// 响应式布局
const windowWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1200)
const isMobile = computed(() => windowWidth.value < 768)

const handleResize = () => {
  windowWidth.value = window.innerWidth
}

// 侧边栏引用
const sidebarRef = ref(null)

// 切换面板
function switchToPanel(panelId) {
  if (sidebarRef.value) {
    sidebarRef.value.togglePanel(panelId)
  }
}

// Waline 评论系统
const walineRef = ref(null)
const walineInstance = ref(null)
const serverURL = 'https://waline-ivory-one.vercel.app'

// Driver.js 引导
const driverInstance = ref(null)

function startTour() {
  // 先展开侧边栏并切换到卡组管理（使用 expandPanel 强制展开，不会 toggle）
  if (sidebarRef.value) {
    sidebarRef.value.expandPanel('deck')
  }
  
  // 确保 DOM 更新后再启动引导
  nextTick(() => {
    setTimeout(() => {
      driverInstance.value = driver({
        showProgress: true,
        animate: true,
        allowClose: true,
        overlayColor: 'rgba(0, 0, 0, 0.7)',
        stagePadding: 10,
        stageRadius: 8,
        popoverClass: 'ygo-tour-popover',
        nextBtnText: '下一步',
        prevBtnText: '上一步',
        doneBtnText: '完成',
        progressText: '{{current}} / {{total}}',
        // 禁止用户与高亮元素交互，防止误点击
        disableActiveInteraction: true,
        steps: [
          {
            element: '#import-deck-btn',
            popover: {
              title: '📁 第1步：导入卡组',
              description: '引导结束后，点击这里可以导入 YDK 文件、YDKE URL 等格式的卡组，快速配置你的卡牌。',
              side: 'bottom',
              align: 'start'
            }
          },
          {
            element: '#condition-input-card',
            popover: {
              title: '🔗 第2步：逻辑判定',
              description: '在这里设置你的展开条件。支持三种模式：卡牌拖动、手动输入、构建器。推荐使用「卡牌拖动」模式！',
              side: 'bottom',
              align: 'center'
            },
            onHighlightStarted: () => {
              // 切换到卡牌拖动模式
              conditionMode.value = 'drag'
            }
          },
          {
            element: '#combo-condition-area',
            popover: {
              title: '⚡ 第3步：展开条件',
              description: '从左侧卡组中拖动卡牌到这里，构建你的展开路线。每条路线代表一种上手组合。',
              side: 'top',
              align: 'center'
            }
          },
          {
            element: '#logic-selector',
            popover: {
              title: '🎯 第4步：或条件/且条件',
              description: '当有多条展开路线时，选择「或条件」表示满足任意一条即可展开；选择「且条件」表示必须同时满足所有路线。',
              side: 'bottom',
              align: 'center'
            },
            onHighlightStarted: () => {
              // 如果逻辑选择器不存在（只有1条路线时不显示），跳过这步
              const logicSelector = document.getElementById('logic-selector')
              if (!logicSelector) {
                driverInstance.value?.moveNext()
              }
            }
          },
          {
            element: '#exact-calc-btn',
            popover: {
              title: '🎲 第5步：精确计算',
              description: '配置完成后，点击「精确计算」按钮，系统会遍历所有组合计算出准确的概率。也可以使用「快速估算」进行蒙特卡洛模拟。',
              side: 'top',
              align: 'center'
            }
          }
        ],
        onDestroyStarted: () => {
          // 记录已完成引导
          localStorage.setItem('ygo-tour-completed', 'true')
          driverInstance.value?.destroy()
        }
      })
      
      driverInstance.value.drive()
    }, 500)
  })
}

// 检查是否首次访问
function checkFirstVisit() {
  const tourCompleted = localStorage.getItem('ygo-tour-completed')
  if (!tourCompleted) {
    // 首次访问，延迟启动引导
    setTimeout(() => {
      startTour()
    }, 1500)
  }
}

onMounted(() => {
  // 监听窗口大小变化
  window.addEventListener('resize', handleResize)
  
  // 检查是否需要启动引导
  checkFirstVisit()
  
  // 初始化 Waline（延迟加载）
  setTimeout(() => {
    if (walineRef.value) {
      walineInstance.value = init({
        el: walineRef.value,
        serverURL,
        avatar: 'mp',
        meta: ['nick', 'mail', 'link'],
        pageview: true,
        comment: true,
        placeholder: '欢迎留下你的评论 💬',
        emoji: [
          '//unpkg.com/@waline/emojis@1.2.0/weibo',
          '//unpkg.com/@waline/emojis@1.2.0/bilibili',
        ],
        imageUploader: false,
        search: false,
        lang: 'zh-CN',
      })
    }
  }, 1000)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
})

// 条件和抽卡设置
const condition = ref('')
const conditionMode = ref('manual')
const builderData = ref('')
const draws = ref(5)
const autoIncrementDraws = ref(false)

// 初始化构建器
builder.initBuilder(deck.allCardNames.value)

// 提供给子组件
provide('deck', deck)
provide('calculation', calculation)
provide('builder', builder)
provide('condition', condition)
provide('conditionMode', conditionMode)
provide('builderData', builderData)
provide('draws', draws)
provide('autoIncrementDraws', autoIncrementDraws)
</script>

<style>
body {
  margin: 0;
  padding: 0;
  background-color: #f0f2f5;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  -webkit-text-size-adjust: 100%;
  overflow: hidden;
}

.n-card {
  transition: transform 0.2s ease, box-shadow 0.2s ease !important;
}

.n-card:hover {
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05) !important;
}

/* 主布局样式 */
.main-layout {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
}

.main-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
  flex-wrap: wrap;
  gap: 12px;
}

.header-content {
  display: flex;
  align-items: center;
  gap: 12px;
}

.logo-icon {
  width: 36px;
  height: 36px;
  background: linear-gradient(135deg, #0f172a 0%, #334155 100%);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: bold;
  font-size: 18px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  flex-shrink: 0;
}

.app-title {
  margin: 0;
  font-weight: 600;
  font-size: 20px;
  color: #1e293b;
  letter-spacing: -0.5px;
}

.main-content-area {
  flex: 1;
  overflow-y: auto;
}

/* 卡组统计行 */
.deck-stat-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 0;
}

/* 功能项样式 */
.feature-item {
  padding: 4px 0;
}

/* 完整高度面板 */
.full-height-panel {
  height: 100%;
}

.full-height-panel :deep(.n-card) {
  height: 100%;
}

/* 滚动条美化 */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 3px;
}
::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}

/* 移动端响应式 */
@media screen and (max-width: 768px) {
  .main-header {
    padding: 10px 12px;
  }
  
  .logo-icon {
    width: 28px;
    height: 28px;
    font-size: 14px;
  }
  
  .app-title {
    font-size: 16px;
  }
  
  /* 禁用移动端卡片 hover 效果 */
  .n-card:hover {
    transform: none !important;
  }
}

/* 小屏幕手机 */
@media screen and (max-width: 480px) {
  .main-header {
    padding: 8px 10px;
  }
  
  .header-content {
    gap: 8px;
  }
  
  .app-title {
    font-size: 14px;
  }
}

/* Driver.js 自定义样式 */
.driver-popover.ygo-tour-popover {
  background: linear-gradient(145deg, #1e293b 0%, #334155 100%);
  color: #fff;
  border: 2px solid #d4af37;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.4);
}

.driver-popover.ygo-tour-popover .driver-popover-title {
  font-size: 18px;
  font-weight: 700;
  color: #d4af37;
  margin-bottom: 8px;
}

.driver-popover.ygo-tour-popover .driver-popover-description {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.9);
  line-height: 1.6;
}

.driver-popover.ygo-tour-popover .driver-popover-progress-text {
  color: rgba(255, 255, 255, 0.6);
  font-size: 12px;
}

.driver-popover.ygo-tour-popover .driver-popover-navigation-btns {
  gap: 8px;
}

.driver-popover.ygo-tour-popover .driver-popover-prev-btn,
.driver-popover.ygo-tour-popover .driver-popover-next-btn {
  background: #d4af37;
  color: #1e293b;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  font-weight: 600;
  font-size: 13px;
  transition: all 0.2s ease;
}

.driver-popover.ygo-tour-popover .driver-popover-prev-btn:hover,
.driver-popover.ygo-tour-popover .driver-popover-next-btn:hover {
  background: #f5d76e;
  transform: translateY(-1px);
}

.driver-popover.ygo-tour-popover .driver-popover-close-btn {
  color: rgba(255, 255, 255, 0.6);
}

.driver-popover.ygo-tour-popover .driver-popover-close-btn:hover {
  color: #fff;
}

.driver-popover.ygo-tour-popover .driver-popover-arrow-side-top {
  border-bottom-color: #1e293b;
}

.driver-popover.ygo-tour-popover .driver-popover-arrow-side-bottom {
  border-top-color: #1e293b;
}

.driver-popover.ygo-tour-popover .driver-popover-arrow-side-left {
  border-right-color: #1e293b;
}

.driver-popover.ygo-tour-popover .driver-popover-arrow-side-right {
  border-left-color: #1e293b;
}
</style>

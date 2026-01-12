<template>
  <n-config-provider :theme-overrides="themeOverrides">
    <n-message-provider>
      <n-dialog-provider>
        <n-layout style="min-height: 100vh; background-color: #f0f2f5;">
          <n-layout-header bordered style="padding: 12px 24px; display: flex; align-items: center; justify-content: space-between; background: #ffffff; box-shadow: 0 1px 2px 0 rgba(0,0,0,0.03);">
            <div style="display: flex; align-items: center; gap: 12px;">
              <div style="width: 32px; height: 32px; background: linear-gradient(135deg, #0f172a 0%, #334155 100%); border-radius: 8px; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 18px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                Y
              </div>
              <n-h2 style="margin: 0; font-weight: 600; font-size: 20px; color: #1e293b; letter-spacing: -0.5px;">游戏王概率计算器</n-h2>
            </div>
         
          </n-layout-header>
          
          <n-layout-content style="padding: 12px;">
            <div style="max-width: 100%; margin: 0 auto; padding: 0 12px;">
              <n-space vertical :size="12">
                <!-- 顶部：卡组管理 -->
                <DeckManagement />
                
                <!-- 第一大行：卡牌配置 (占大部分) + [构成分布 & 决斗参数] (占右侧) -->
                <n-grid :cols="24" :x-gap="12">
                  <n-grid-item :span="16">
                    <CardInput />
                  </n-grid-item>
                  <n-grid-item :span="4">
                    <DeckPieChart />
                  </n-grid-item>
                  <n-grid-item :span="4">
                    <DrawSettings />
                  </n-grid-item>
                </n-grid>
                
                <!-- 第二大行：逻辑判定 (左) + 计算核心 (右) -->
                <n-grid :cols="24" :x-gap="12">
                  <n-grid-item :span="13">
                    <ConditionInput />
                  </n-grid-item>
                  <n-grid-item :span="11">
                    <n-space vertical :size="12">
                      <CalculationPanel />
                      <DeckOptimizer />
                    </n-space>
                  </n-grid-item>
                </n-grid>
                
                <!-- 底部：完整还原 HTML 中的说明文字 -->
                <n-collapse :arrow-placement="'right'">
                  <n-collapse-item name="1">
                    <template #header>
                      <n-text depth="3" style="font-size: 12px; font-weight: 600;">💡 完整使用说明与运算符规则（点击展开）</n-text>
                    </template>
                    <n-card :bordered="false" size="small" style="background: rgba(255,255,255,0.5); border-radius: 8px;">
                      <n-space vertical :size="8">
                        <n-text depth="3" style="font-size: 12px;">
                          <strong>运算符（优先级从高到低）：</strong>
                          <code>()</code> - 明确运算优先级； <code>!</code> - 逻辑非； <code>*</code> - 乘； <code>/</code> - 除； <code>%</code> - 取模； <code>+</code> - 加； <code>-</code> - 减；
                          <strong>比较运算符：</strong> <code>&gt;</code> - 大于； <code>&gt;=</code> - 大于等于； <code>&lt;</code> - 小于； <code>&lt;=</code> - 小于等于； <code>==</code> - 等于； <code>!=</code> - 不等； <code>&&</code> - 逻辑与； <code>||</code> - 逻辑或
                        </n-text>
                        <n-text depth="3" style="font-size: 12px;">
                          <strong>变量名：</strong> <code>a</code>, <code>b</code>, <code>c</code>, ..., <code>z</code>, <code>aa</code>, <code>ab</code>, <code>ac</code>, <code>ad</code> 对应 A类卡, B类卡, ..., Z类卡, AA类卡, AB类卡, AC类卡, AD类卡。也可以直接使用您输入的自定卡名。
                        </n-text>
                        <n-text depth="3" style="font-size: 12px;">
                          <strong>使用提示：</strong> 计算器会帮您将自定卡名替换为对应的变量名，所以自定卡名建议避免使用容易与逻辑判断条件混淆的名称(如a>1)。建议使用纯中文名。
                        </n-text>
                        <n-text depth="3" style="font-size: 12px;">
                          <strong>注意：</strong> 在条件表达式中，<code>=</code> 是赋值运算符。如果您要判断相等，请使用 <code>==</code> 或 <code>===</code>。注意不要使用中文标点符号来书写运算符（例如中文括号）。
                        </n-text>
                        <n-text depth="3" style="font-size: 12px;">
                          <strong>性能提示：</strong> 当卡种类和抽卡数较高时，计算时间会呈指数级上升，此时推荐使用快速估算（蒙特卡洛模拟）。
                        </n-text>
                      </n-space>
                    </n-card>
                  </n-collapse-item>
                </n-collapse>
                
                <!-- 底部来源信息：完整还原 -->
                <div style="text-align: center; padding: 8px 0; border-top: 1px dashed #cbd5e1; opacity: 0.8;">
                  <n-text depth="3" style="font-size: 11px;">
                    该工具部分代码与思路来源于 天天发蛋糕的工具箱
                  </n-text>
               
                </div>
              </n-space>
            </div>
          </n-layout-content>
        </n-layout>
      </n-dialog-provider>
    </n-message-provider>
  </n-config-provider>
</template>

<script setup>
import { ref, provide } from 'vue'
import { 
  NConfigProvider, NMessageProvider, NDialogProvider,
  NLayout, NLayoutHeader, NLayoutContent,
  NH2, NText, NSpace, NGrid, NGridItem, NCard,
  NCollapse, NCollapseItem
} from 'naive-ui'
import DeckManagement from './components/DeckManagement.vue'
import CardInput from './components/CardInput.vue'
import DeckPieChart from './components/DeckPieChart.vue'
import DrawSettings from './components/DrawSettings.vue'
import ConditionInput from './components/ConditionInput.vue'
import CalculationPanel from './components/CalculationPanel.vue'
import DeckOptimizer from './components/DeckOptimizer.vue'
import { useDeck } from './composables/useDeck'
import { useCalculation } from './composables/useCalculation'
import { useConditionBuilder } from './composables/useConditionBuilder'

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

// 初始化状态
const deck = useDeck()
const calculation = useCalculation()
const builder = useConditionBuilder()

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
  background-color: #f0f2f5;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
}

.n-card {
  transition: transform 0.2s ease, box-shadow 0.2s ease !important;
}

.n-card:hover {
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05) !important;
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
</style>


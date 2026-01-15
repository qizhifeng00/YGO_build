<template>
  <n-card title="计算核心" size="small" :segmented="{ content: true }">
    <n-space vertical :size="16">
      <!-- 结果展示区 -->
      <div class="result-display">
        <div class="result-main">
   
          <div class="probability-value">{{ calc.probability.value }}</div>
        </div>
        <div class="result-stats">
          <div class="stat-item">
            <n-text depth="3" style="font-size: 11px;">满足组合</n-text>
            <n-text strong style="font-size: 14px;">{{ calc.validCombinations.value }}</n-text>
          </div>
          <n-divider vertical />
          <div class="stat-item">
            <n-text depth="3" style="font-size: 11px;">总组合数</n-text>
            <n-text strong style="font-size: 14px;">{{ calc.totalCombinations.value }}</n-text>
          </div>
        </div>
      </div>

      <!-- 进度条 -->
      <div v-if="calc.isCalculating.value || calc.calculationProgress.value > 0">
        <n-progress
          type="line"
          :percentage="calc.calculationProgress.value"
          :status="calc.isCalculating.value ? 'default' : 'success'"
          :show-indicator="false"
          height="4"
          border-radius="2px"
        />
        <div style="display: flex; justify-content: space-between; margin-top: 4px;">
          <n-text depth="3" style="font-size: 11px;">{{ calc.progressText.value }}</n-text>
          <n-text depth="3" style="font-size: 11px;">{{ Math.round(calc.calculationProgress.value) }}%</n-text>
        </div>
      </div>

      <!-- 操作按钮 -->
      <n-grid :cols="2" :x-gap="8">
        <n-grid-item>
          <n-button
            id="exact-calc-btn"
            v-if="!calc.isCalculating.value"
            type="primary"
            @click="handleCalculate"
            block
            style="height: 44px; font-weight: 600;"
          >
            精确计算
          </n-button>
          <n-button
            v-else
            type="error"
            @click="handleCancel"
            block
            ghost
            style="height: 44px;"
          >
            取消
          </n-button>
        </n-grid-item>
        <n-grid-item>
          <n-button
            v-if="!calc.isCalculating.value"
            type="primary"
            ghost
            @click="handleMonteCarloCalculate"
            block
            style="height: 44px;"
          >
            快速估算
          </n-button>
        </n-grid-item>
      </n-grid>

      <!-- 打断分析 -->
      <n-collapse>
        <n-collapse-item title="🛡️ 打断分析" name="interruption">
          <div class="interruption-section">
            <n-space vertical :size="8">
              <!-- 对手配置 + 手坑配置 合并 -->
              <div class="calc-mode-section" style="padding: 8px 10px;">
                <div class="interrupt-config-row">
                  <n-space align="center" :size="8">
                    <n-input-number v-model:value="opponentDeckSize" size="small" :min="20" :max="60" style="width: 115px;">
                      <template #prefix>卡组</template>
                    </n-input-number>
                    <n-input-number v-model:value="opponentDrawCount" size="small" :min="1" :max="10" style="width: 115px;">
                      <template #prefix>起手</template>
                    </n-input-number>
                  </n-space>
                </div>
                <div class="handtrap-compact">
                  <div v-for="trap in handTraps" :key="trap.id" class="handtrap-item-compact">
                    <n-tooltip trigger="hover">
                      <template #trigger>
                        <n-tag :type="trap.tagType" size="medium" style="font-size: 13px;">{{ trap.icon }} {{ trap.name }}</n-tag>
                      </template>
                      <div style="max-width: 280px;">
                        <div><strong>{{ trap.fullName }}</strong></div>
                        <div style="color: #94a3b8; margin: 4px 0;">{{ trap.effect }}</div>
                        <div style="color: #fbbf24;">⚡ {{ trap.condition }}</div>
                      </div>
                    </n-tooltip>
                    <n-input-number v-model:value="trap.count" size="small" :min="0" :max="3" style="width: 70px;" />
                  </div>
                </div>
                <n-space style="margin-top: 6px;" :size="8">
                  <n-button size="small" quaternary @click="setAllHandTraps(3)">满投</n-button>
                  <n-button size="small" quaternary @click="setAllHandTraps(0)">清零</n-button>
                  <n-button size="small" quaternary type="info" @click="applyMetaPreset">主流</n-button>
                </n-space>
              </div>

              <!-- 己方关键点 -->
              <div class="calc-mode-section" style="padding: 8px 10px;">
                <n-text strong style="font-size: 14px; margin-bottom: 6px; display: block;">🎯 己方关键点</n-text>
                <div class="keypoint-compact">
                  <div class="keypoint-item-compact">
                    <n-text strong style="font-size: 13px;">🔍 检索点</n-text>
                    <n-input-number v-model:value="keyPoints.search" size="small" :min="0" :max="10" style="width: 70px;" />
                  </div>
                  <div class="keypoint-item-compact">
                    <n-text strong style="font-size: 13px;">💫 效果点</n-text>
                    <n-input-number v-model:value="keyPoints.negate" size="small" :min="0" :max="10" style="width: 70px;" />
                  </div>
                </div>
              </div>

              <!-- 计算按钮 -->
              <n-button type="primary" block @click="calculateInterruption" :loading="isCalculatingInterruption" style="height: 38px; font-size: 14px;">
                🔮 分析打断风险
              </n-button>

              <!-- 结果展示 -->
              <div v-if="interruptionResults" class="interruption-results">
                <div class="interrupt-summary">
                  <div class="interrupt-stat">
                    <n-text depth="3" style="font-size: 12px;">被打断</n-text>
                    <n-text :type="interruptionResults.riskLevel" strong style="font-size: 24px;">
                      {{ interruptionResults.overallProb }}
                    </n-text>
                  </div>
                  <n-divider vertical />
                  <div class="interrupt-stat">
                    <n-text depth="3" style="font-size: 12px;">安全通过</n-text>
                    <n-text type="success" strong style="font-size: 24px;">
                      {{ interruptionResults.safeProb }}
                    </n-text>
                  </div>
                </div>

                <n-table :bordered="false" :single-line="false" size="small" style="margin-top: 8px;">
                  <thead>
                    <tr>
                      <th>手坑</th>
                      <th>数量</th>
                      <th>抽到率</th>
                      <th>威胁</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="r in interruptionResults.details" :key="r.id">
                      <td><n-tag :type="r.tagType" size="small">{{ r.icon }} {{ r.name }}</n-tag></td>
                      <td style="font-size: 13px;">{{ r.count }}张</td>
                      <td><n-text :type="r.probType" strong style="font-size: 14px;">{{ r.prob }}</n-text></td>
                      <td><n-text :type="r.threatType" style="font-size: 13px;">{{ r.threat }}</n-text></td>
                    </tr>
                  </tbody>
                </n-table>

              </div>
            </n-space>
          </div>
        </n-collapse-item>

        <!-- 重复卡牌概率计算 -->
        <n-collapse-item title="🎴 重复卡牌概率" name="duplicate">
          <div class="duplicate-section">
            <n-space vertical :size="12">
              <!-- 计算原理说明 -->
              <n-alert type="info" :bordered="false" style="font-size: 12px;">
                <template #header>
                  <span style="font-size: 12px;">📐 计算原理</span>
                </template>
                基于<strong>超几何分布</strong>计算：从 N 张卡组中抽 n 张，恰好抽到 k 张目标卡的概率为
                <code>C(K,k) × C(N-K,n-k) / C(N,n)</code>，
                其中 K 为目标卡数量。卡手概率 = Σ P(k≥2)。
              </n-alert>
              
              <!-- 单卡计算 -->
              <div class="calc-mode-section">
                <n-text strong style="font-size: 13px; margin-bottom: 8px; display: block;">📌 单卡计算</n-text>
                <n-space align="center" :size="8" wrap>
                  <n-select
                    v-model:value="selectedCardIndex"
                    :options="cardOptions"
                    size="small"
                    style="width: 160px;"
                    placeholder="选择卡牌"
                  />
                  <n-button 
                    size="small" 
                    type="info" 
                    @click="calculateDuplicateProbability"
                    :disabled="selectedCardIndex === null || deck.totalCards.value === 0"
                  >
                    计算
                  </n-button>
                </n-space>
              </div>
              
              <!-- 单卡重复概率结果 -->
              <div v-if="duplicateResults.length > 0" class="duplicate-results">
                <n-table :bordered="false" :single-line="false" size="small">
                  <thead>
                    <tr>
                      <th>抽到张数</th>
                      <th>概率</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="result in duplicateResults" :key="result.count">
                      <td>
                        <n-tag :type="result.count >= 2 ? 'warning' : 'default'" size="small">
                          {{ result.count }} 张
                        </n-tag>
                      </td>
                      <td>
                        <n-text :type="result.count >= 2 ? 'warning' : 'default'" strong>
                          {{ result.probability }}
                        </n-text>
                      </td>
                    </tr>
                    <tr class="highlight-row">
                      <td>
                        <n-tag type="error" size="small">≥2 张（卡手）</n-tag>
                      </td>
                      <td>
                        <n-text type="error" strong>{{ duplicateTotalProb }}</n-text>
                      </td>
                    </tr>
                  </tbody>
                </n-table>
              </div>

              <n-divider style="margin: 8px 0;" />

              <!-- 全部卡牌计算 -->
              <div class="calc-mode-section">
                <n-text strong style="font-size: 13px; margin-bottom: 8px; display: block;">📊 全部卡牌卡手率</n-text>
                <n-button 
                  size="small" 
                  type="warning"
                  @click="calculateAllDuplicates"
                  :disabled="deck.totalCards.value === 0"
                  :loading="isCalculatingAll"
                >
                  {{ isCalculatingAll ? '计算中...' : '计算全部' }}
                </n-button>
              </div>

              <!-- 全部卡牌结果 -->
              <div v-if="allDuplicateResults.length > 0" class="all-duplicate-results">
                <div class="overall-result">
                  <n-text depth="2">相同卡牌卡手概率：</n-text>
                  <n-text type="error" strong style="font-size: 18px;">{{ overallDuplicateProb }}</n-text>
                </div>
                <n-table :bordered="false" :single-line="false" size="small" style="margin-top: 8px;">
                  <thead>
                    <tr>
                      <th>卡牌</th>
                      <th>数量</th>
                      <th>卡手率(≥2张)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="result in allDuplicateResults" :key="result.index">
                      <td>
                        <n-text>{{ result.name }}</n-text>
                      </td>
                      <td>
                        <n-tag size="tiny">{{ result.count }}张</n-tag>
                      </td>
                      <td>
                        <n-text :type="parseFloat(result.prob) > 10 ? 'error' : parseFloat(result.prob) > 5 ? 'warning' : 'default'" strong>
                          {{ result.prob }}
                        </n-text>
                      </td>
                    </tr>
                  </tbody>
                </n-table>
              </div>
              
              <n-text depth="3" style="font-size: 11px;">
                💡 单卡计算：指定卡牌的详细抽取概率<br/>
                💡 全部计算：所有多张卡的卡手风险汇总
              </n-text>
            </n-space>
          </div>
        </n-collapse-item>
      </n-collapse>

      <n-space justify="space-between">
        <n-button text size="tiny" @click="handleExportRecords" style="color: #64748b;">
          导出 CSV 记录
        </n-button>
        <n-button text size="tiny" @click="handleClearRecords" style="color: #ef4444;">
          清除所有记录
        </n-button>
      </n-space>
    </n-space>
  </n-card>
</template>

<style scoped>
.result-display {
  padding: 10px 16px;
  border-radius: 10px;
  color: #000;
  text-align: center;
}
.probability-value {
  font-size: 26px;
  font-weight: 700;
  font-family: 'Inter', system-ui, sans-serif;
  margin: 0;
}
.result-stats {
  display: flex;
  justify-content: space-around;
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px solid rgba(255,255,255,0.1);
}
.stat-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.stat-item :deep(.n-text) {
  font-size: 12px;
}

/* 重复卡牌概率区域 */
.duplicate-section {
  padding: 8px 0;
}

.duplicate-results {
  background: linear-gradient(135deg, #fefce8 0%, #fef3c7 100%);
  border-radius: 8px;
  padding: 12px;
  border: 1px solid #fcd34d;
}

.duplicate-results :deep(.n-table) {
  background: transparent;
}

.duplicate-results :deep(.n-table th) {
  background: rgba(251, 191, 36, 0.2);
  font-weight: 600;
  font-size: 12px;
}

.duplicate-results :deep(.n-table td) {
  font-size: 13px;
}

.duplicate-results :deep(.highlight-row) {
  background: rgba(239, 68, 68, 0.1);
}

.duplicate-results :deep(.highlight-row td) {
  border-top: 2px solid rgba(239, 68, 68, 0.3);
}

/* 计算模式区块 */
.calc-mode-section {
  padding: 10px 12px;
  background: rgba(0, 0, 0, 0.02);
  border-radius: 8px;
  border: 1px solid rgba(0, 0, 0, 0.06);
}

/* 全部卡牌结果 */
.all-duplicate-results {
  background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
  border-radius: 8px;
  padding: 12px;
  border: 1px solid #fca5a5;
}

.all-duplicate-results :deep(.n-table) {
  background: transparent;
}

.all-duplicate-results :deep(.n-table th) {
  background: rgba(239, 68, 68, 0.15);
  font-weight: 600;
  font-size: 12px;
}

.all-duplicate-results :deep(.n-table td) {
  font-size: 12px;
}

.overall-result {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  background: white;
  border-radius: 8px;
  border: 2px solid #ef4444;
}

/* 打断分析样式 */
.interruption-section {
  padding: 2px 0;
}

.interrupt-config-row {
  margin-bottom: 8px;
}

.handtrap-compact {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.handtrap-item-compact {
  display: flex;
  align-items: center;
  gap: 6px;
}

.keypoint-compact {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.keypoint-item-compact {
  display: flex;
  align-items: center;
  gap: 8px;
}

.interruption-results {
  background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
  border-radius: 8px;
  padding: 10px;
  border: 1px solid #fbbf24;
}

.interrupt-summary {
  display: flex;
  justify-content: space-around;
  align-items: center;
  padding: 8px;
  background: white;
  border-radius: 6px;
  border: 2px solid #f59e0b;
}

.interrupt-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.interruption-results :deep(.n-table) {
  background: transparent;
}

.interruption-results :deep(.n-table th) {
  background: rgba(251, 191, 36, 0.2);
  font-weight: 600;
  font-size: 13px;
  padding: 6px 8px;
}

.interruption-results :deep(.n-table td) {
  font-size: 13px;
  padding: 6px 8px;
}
</style>

<script setup>
import { inject, ref, computed } from 'vue'
import { 
  NCard, NSpace, NButton, NProgress, NText, NAlert,
  NDivider, NGrid, NGridItem, NCollapse, NCollapseItem,
  NSelect, NTable, NTag, NInputNumber, NTooltip,
  useMessage, useDialog 
} from 'naive-ui'

const message = useMessage()
const dialog = useDialog()

const deck = inject('deck')
const calc = inject('calculation')
const condition = inject('condition')
const draws = inject('draws')
const autoIncrementDraws = inject('autoIncrementDraws')

// ========== 打断分析 ==========
const opponentDeckSize = ref(40)
const opponentDrawCount = ref(5)
const isCalculatingInterruption = ref(false)
const interruptionResults = ref(null)

// 热门手坑（核心2张）
const handTraps = ref([
  { 
    id: 'ash', name: '灰流丽', fullName: '灰流うらら', icon: '🌸', tagType: 'error',
    effect: '无效「从卡组抽卡以外方法加入手卡」「从卡组特殊召唤」「从墓地把卡加入卡组」的效果',
    condition: '手牌发动，无条件',
    shortDesc: '打断检索', category: 'search', count: 3
  },
  { 
    id: 'imperm', name: '泡影', fullName: '无限泡影', icon: '👻', tagType: 'info',
    effect: '无效对方场上1只效果怪兽的效果直到回合结束',
    condition: '手牌发动需己方场上无卡 / 可盖放发动',
    shortDesc: '无效怪效', category: 'negate', count: 3
  },
])

// 己方关键点
const keyPoints = ref({
  search: 2,  // 检索点：会被灰流丽打断
  negate: 2   // 效果点：会被泡影无效
})

// 设置所有手坑数量
function setAllHandTraps(count) {
  handTraps.value.forEach(trap => trap.count = count)
}

// 主流配置预设
function applyMetaPreset() {
  const preset = { ash: 3, imperm: 3 }
  handTraps.value.forEach(trap => trap.count = preset[trap.id] ?? 0)
}

// 组合数计算
function comb(n, k) {
  if (k < 0 || k > n) return 0
  if (k === 0 || k === n) return 1
  let result = 1
  for (let i = 1; i <= k; i++) result = result * (n - k + i) / i
  return result
}

// 计算抽到至少1张的概率
function probAtLeastOne(target, deck, draw) {
  if (target === 0) return 0
  return 1 - comb(deck - target, draw) / comb(deck, draw)
}

// 打断分析计算
function calculateInterruption() {
  isCalculatingInterruption.value = true
  
  setTimeout(() => {
    try {
      const deck = opponentDeckSize.value
      const draw = opponentDrawCount.value
      const details = []
      
      // 按类型分组统计
      const searchTraps = handTraps.value.filter(t => t.category === 'search')
      const negateTraps = handTraps.value.filter(t => t.category === 'negate')
      
      const totalSearchCount = searchTraps.reduce((s, t) => s + t.count, 0)
      const totalNegateCount = negateTraps.reduce((s, t) => s + t.count, 0)
      
      // 各类型抽到概率
      const searchProb = probAtLeastOne(totalSearchCount, deck, draw)
      const negateProb = probAtLeastOne(totalNegateCount, deck, draw)
      
      // 计算每张卡的详情
      handTraps.value.forEach(trap => {
        const prob = probAtLeastOne(trap.count, deck, draw)
        let threat = '无'
        let threatType = 'default'
        
        if (trap.count > 0) {
          if (trap.category === 'search' && keyPoints.value.search > 0) {
            threat = `威胁${keyPoints.value.search}处检索`
            threatType = 'warning'
          } else if (trap.category === 'negate' && keyPoints.value.negate > 0) {
            threat = `威胁${keyPoints.value.negate}处怪效`
            threatType = 'warning'
          }
        }
        
        details.push({
          id: trap.id,
          name: trap.name,
          icon: trap.icon,
          tagType: trap.tagType,
          count: trap.count,
          prob: (prob * 100).toFixed(1) + '%',
          probType: prob > 0.6 ? 'error' : prob > 0.3 ? 'warning' : 'default',
          threat,
          threatType
        })
      })
      
      // 综合被打断概率
      let overallInterrupt = 0
      if (keyPoints.value.search > 0) {
        overallInterrupt = 1 - (1 - overallInterrupt) * (1 - searchProb)
      }
      if (keyPoints.value.negate > 0) {
        overallInterrupt = 1 - (1 - overallInterrupt) * (1 - negateProb)
      }
      
      const safeProb = 1 - overallInterrupt
      
      // 风险等级
      let riskLevel = 'success'
      if (overallInterrupt > 0.6) {
        riskLevel = 'error'
      } else if (overallInterrupt > 0.35) {
        riskLevel = 'warning'
      }
      
      interruptionResults.value = {
        overallProb: (overallInterrupt * 100).toFixed(1) + '%',
        safeProb: (safeProb * 100).toFixed(1) + '%',
        riskLevel,
        details: details.filter(d => d.count > 0)
      }
      
      message.success('打断分析完成！')
    } catch (e) {
      message.error('分析失败：' + e.message)
    } finally {
      isCalculatingInterruption.value = false
    }
  }, 50)
}

// ========== 重复卡牌概率计算 ==========
const selectedCardIndex = ref(null)
const duplicateResults = ref([])
const duplicateTotalProb = ref('0%')

// 全部卡牌计算相关
const isCalculatingAll = ref(false)
const allDuplicateResults = ref([])
const overallDuplicateProb = ref('0%')

// 卡牌选项
const cardOptions = computed(() => {
  return deck.cards.value
    .map((card, index) => ({
      label: `${card.label}${card.name ? ` (${card.name})` : ''} - ${card.count}张`,
      value: index,
      disabled: card.count < 2
    }))
    .filter(opt => deck.cards.value[opt.value].count > 0)
})

// 组合数计算 C(n, k)
function combination(n, k) {
  if (k < 0 || k > n) return 0
  if (k === 0 || k === n) return 1
  
  let result = 1
  for (let i = 1; i <= k; i++) {
    result = result * (n - k + i) / i
  }
  return result
}

// 计算单张卡的卡手概率（≥2张）
function calcSingleCardDuplicateProb(cardCount, totalCards, drawCount) {
  const totalComb = combination(totalCards, drawCount)
  const otherCards = totalCards - cardCount
  
  let probSum2Plus = 0
  for (let k = 2; k <= Math.min(cardCount, drawCount); k++) {
    const waysToDrawK = combination(cardCount, k)
    const waysToDrawRest = combination(otherCards, drawCount - k)
    probSum2Plus += (waysToDrawK * waysToDrawRest) / totalComb
  }
  return probSum2Plus
}

// 计算重复卡牌概率（单卡）
function calculateDuplicateProbability() {
  if (selectedCardIndex.value === null) {
    message.warning('请先选择一张卡牌')
    return
  }
  
  const cardIndex = selectedCardIndex.value
  const card = deck.cards.value[cardIndex]
  const cardCount = card.count // 该卡在卡组中的数量
  const totalCards = deck.totalCards.value // 卡组总数
  const drawCount = draws.value // 抽卡数
  
  if (totalCards === 0 || drawCount === 0) {
    message.warning('卡组为空或抽卡数为0')
    return
  }
  
  if (drawCount > totalCards) {
    message.warning('抽卡数不能超过卡组总数')
    return
  }
  
  // 计算抽到 k 张该卡的概率
  // P(X=k) = C(cardCount, k) * C(totalCards - cardCount, drawCount - k) / C(totalCards, drawCount)
  const results = []
  const totalComb = combination(totalCards, drawCount)
  const otherCards = totalCards - cardCount
  
  let probSum2Plus = 0
  
  for (let k = 0; k <= Math.min(cardCount, drawCount); k++) {
    const waysToDrawK = combination(cardCount, k)
    const waysToDrawRest = combination(otherCards, drawCount - k)
    const prob = (waysToDrawK * waysToDrawRest) / totalComb
    
    results.push({
      count: k,
      probability: (prob * 100).toFixed(2) + '%'
    })
    
    if (k >= 2) {
      probSum2Plus += prob
    }
  }
  
  duplicateResults.value = results
  duplicateTotalProb.value = (probSum2Plus * 100).toFixed(2) + '%'
  
  message.success(`已计算「${card.name || card.label}」的重复概率`)
}

// 计算全部卡牌的卡手概率
function calculateAllDuplicates() {
  const totalCards = deck.totalCards.value
  const drawCount = draws.value
  
  if (totalCards === 0 || drawCount === 0) {
    message.warning('卡组为空或抽卡数为0')
    return
  }
  
  if (drawCount > totalCards) {
    message.warning('抽卡数不能超过卡组总数')
    return
  }
  
  isCalculatingAll.value = true
  
  // 使用 setTimeout 让 UI 有时间更新
  setTimeout(() => {
    try {
      const results = []
      const cardsWithMultiple = deck.cards.value.filter(c => c.count >= 2)
      
      // 计算每张卡的卡手概率
      deck.cards.value.forEach((card, index) => {
        if (card.count >= 2) {
          const prob = calcSingleCardDuplicateProb(card.count, totalCards, drawCount)
          results.push({
            index,
            name: card.name || card.label,
            count: card.count,
            prob: (prob * 100).toFixed(2) + '%'
          })
        }
      })
      
      // 按卡手率排序（从高到低）
      results.sort((a, b) => parseFloat(b.prob) - parseFloat(a.prob))
      
      // 使用蒙特卡洛模拟计算"任意卡牌卡手"的总概率
      const overallProb = monteCarloAnyDuplicate(deck.cards.value.map(c => c.count), drawCount, 50000)
      
      allDuplicateResults.value = results
      overallDuplicateProb.value = (overallProb * 100).toFixed(2) + '%'
      
      message.success('全部卡牌卡手率计算完成')
    } catch (error) {
      message.error('计算失败：' + error.message)
    } finally {
      isCalculatingAll.value = false
    }
  }, 50)
}

// 蒙特卡洛模拟：计算抽到任意重复卡牌的概率
function monteCarloAnyDuplicate(cardCounts, drawCount, simulations) {
  // 构建牌库
  const deckArray = []
  cardCounts.forEach((count, cardIndex) => {
    for (let i = 0; i < count; i++) {
      deckArray.push(cardIndex)
    }
  })
  
  if (deckArray.length === 0 || deckArray.length < drawCount) {
    return 0
  }
  
  let duplicateCount = 0
  
  for (let sim = 0; sim < simulations; sim++) {
    // 洗牌（Fisher-Yates）
    const shuffled = [...deckArray]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    
    // 抽牌并统计
    const drawn = shuffled.slice(0, drawCount)
    const counts = {}
    let hasDuplicate = false
    
    for (const cardIdx of drawn) {
      counts[cardIdx] = (counts[cardIdx] || 0) + 1
      if (counts[cardIdx] >= 2) {
        hasDuplicate = true
        break
      }
    }
    
    if (hasDuplicate) {
      duplicateCount++
    }
  }
  
  return duplicateCount / simulations
}

async function handleCalculate() {
  try {
    // 验证输入
    deck.checkDuplicateCardNames()
    
    const cardCounts = deck.cards.value.map(card => parseInt(card.count) || 0)
    const drawCount = draws.value
    const deckSize = deck.totalCards.value

    if (drawCount <= 0) {
      throw new Error('抽卡数必须大于0')
    }
    if (deckSize <= 0) {
      throw new Error('卡组中至少要有1张卡')
    }
    if (drawCount > deckSize) {
      throw new Error('抽卡数不能超过卡组总数')
    }

    const conditionText = condition.value.trim()
    if (!conditionText) {
      throw new Error('请输入逻辑判断条件')
    }

    // 转换条件
    const convertedCondition = deck.convertCondition(conditionText)
    console.log('转换后的条件:', convertedCondition)

    // 检查等号使用
    const conditionWithoutOperators = convertedCondition.replace(/==|<=|>=|!=/g, '')
    if (conditionWithoutOperators.includes('=')) {
      dialog.warning({
        title: '提示',
        content: "条件表达式中建议使用 '==' 或 '===' 判断相等，请检查是否正确。",
        positiveText: '继续计算',
        negativeText: '取消',
        onPositiveClick: async () => {
          await performCalculate(cardCounts, drawCount, convertedCondition)
        }
      })
      return
    }

    await performCalculate(cardCounts, drawCount, convertedCondition)
  } catch (error) {
    message.error(error.message)
  }
}

async function performCalculate(cardCounts, drawCount, convertedCondition) {
  try {
    await calc.calculate(cardCounts, drawCount, convertedCondition, deck.cards.value)
    message.success('计算完成！')
    
    // 如果勾选了自动+1
    if (autoIncrementDraws.value) {
      draws.value = draws.value + 1
    }
  } catch (error) {
    message.error(error.message)
  }
}

async function handleMonteCarloCalculate() {
  if (calc.isCalculating.value) {
    const shouldContinue = await new Promise((resolve) => {
      dialog.warning({
        title: '确认',
        content: '当前计算正在进行，是否取消并使用蒙特卡洛模拟计算？',
        positiveText: '确定',
        negativeText: '取消',
        onPositiveClick: () => resolve(true),
        onNegativeClick: () => resolve(false)
      })
    })
    
    if (!shouldContinue) return
    calc.cancelCalculation()
  }

  try {
    // 验证输入（与精确计算相同）
    deck.checkDuplicateCardNames()
    
    const cardCounts = deck.cards.value.map(card => parseInt(card.count) || 0)
    const drawCount = draws.value
    const deckSize = deck.totalCards.value

    if (drawCount <= 0) {
      throw new Error('抽卡数必须大于0')
    }
    if (deckSize <= 0) {
      throw new Error('卡组中至少要有1张卡')
    }
    if (drawCount > deckSize) {
      throw new Error('抽卡数不能超过卡组总数')
    }

    const conditionText = condition.value.trim()
    if (!conditionText) {
      throw new Error('请输入逻辑判断条件')
    }

    const convertedCondition = deck.convertCondition(conditionText)
    console.log('转换后的条件（蒙特卡洛）:', convertedCondition)

    await calc.monteCarloCalculate(cardCounts, drawCount, convertedCondition, deck.cards.value)
    message.success('蒙特卡洛模拟完成！')
    
    // 如果勾选了自动+1
    if (autoIncrementDraws.value) {
      draws.value = draws.value + 1
    }
  } catch (error) {
    message.error(error.message)
  }
}

function handleCancel() {
  calc.cancelCalculation()
  message.info('计算已取消')
}

function handleExportRecords() {
  try {
    const csvContent = calc.exportCalculationRecords()
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', '计算记录.csv')
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    
    message.success('记录导出成功！')
  } catch (error) {
    message.error(error.message)
  }
}

function handleClearRecords() {
  dialog.warning({
    title: '确认删除',
    content: '确定删除所有计算记录吗？',
    positiveText: '确定',
    negativeText: '取消',
    onPositiveClick: () => {
      calc.clearCalculationRecords()
      message.success('计算记录已删除')
    }
  })
}
</script>


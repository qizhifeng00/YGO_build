<template>
  <n-card title="🎯 启动率优化器 (测试优化中)" size="small" :bordered="true" class="optimizer-card">
    <template #header-extra>
      <n-tooltip>
        <template #trigger>
          <n-button quaternary circle size="tiny">
            <template #icon>❓</template>
          </n-button>
        </template>
        预设目标启动率，系统自动分析当前卡组并生成调整方案
      </n-tooltip>
    </template>

    <n-space vertical :size="12">
      <!-- 目标设置 -->
      <div class="target-section">
        <n-space align="center" :size="12" wrap>
          <n-space align="center" :size="8">
            <n-text>目标启动率：</n-text>
            <n-input-number
              v-model:value="targetRate"
              :min="1"
              :max="100"
              :step="5"
              size="small"
              style="width: 100px"
              :disabled="isOptimizing"
            >
              <template #suffix>%</template>
            </n-input-number>
          </n-space>
          <n-space :size="8">
            <n-button
              type="primary"
              size="small"
              :loading="isOptimizing"
              :disabled="isOptimizing"
              @click="startOptimize"
            >
              <template #icon>
                <span v-if="!isOptimizing">🔍</span>
              </template>
              {{ isOptimizing ? '分析中' : '分析优化方案' }}
            </n-button>
            <n-button
              v-if="isOptimizing"
              size="small"
              type="error"
              ghost
              @click="cancelOptimize"
            >
              取消
            </n-button>
          </n-space>
        </n-space>
      </div>

      <!-- 进度显示 -->
      <div v-if="isOptimizing" class="progress-section">
        <n-progress
          type="line"
          :percentage="optimizeProgress"
          :show-indicator="true"
          :status="optimizeProgress === 100 ? 'success' : 'info'"
          :height="20"
          :border-radius="4"
          :indicator-placement="'inside'"
        />
        <n-text depth="2" style="font-size: 12px; margin-top: 6px; display: block">
          {{ progressText }}
        </n-text>
      </div>

      <!-- 提示 -->
      <n-text v-if="!isOptimizing" depth="3" style="font-size: 12px">
        💡 设置目标启动率后点击分析，系统将自动判断提高/降低模式并生成方案
      </n-text>
      
      <!-- 计算原理说明 -->
      <n-collapse style="margin-top: 8px;">
        <n-collapse-item title="📐 计算原理" name="principle">
          <n-text depth="2" style="font-size: 12px; line-height: 1.6;">
            <p style="margin: 0 0 8px 0;">
              <strong>1. 蒙特卡洛模拟</strong>：通过 3 万次随机洗牌抽卡模拟，统计满足展开条件的概率。
            </p>
            <p style="margin: 0 0 8px 0;">
              <strong>2. 方案生成策略</strong>：
            </p>
            <ul style="margin: 0; padding-left: 16px;">
              <li><strong>提高模式</strong>：增加关键卡数量 / 扩充卡组(加关键卡) / 精简非关键卡</li>
              <li><strong>降低模式</strong>：减少关键卡数量 / 稀释卡组(加非关键卡) / 移除关键卡</li>
            </ul>
            <p style="margin: 8px 0 0 0;">
              <strong>3. 自动判断</strong>：当前概率 &lt; 目标 → 提高模式；当前概率 ≥ 目标 → 降低模式
            </p>
          </n-text>
        </n-collapse-item>
      </n-collapse>
    </n-space>
  </n-card>

  <!-- 结果弹窗 -->
  <n-modal
    v-model:show="showResultModal"
    preset="card"
    :title="optimizeDirection === 'increase' ? '🎯 提高启动率 - 优化分析结果' : '🎯 降低启动率 - 优化分析结果'"
    style="width: 1200px; max-width: 95vw"
    :mask-closable="true"
    :close-on-esc="true"
  >
    <n-space vertical :size="16">
      <!-- 当前状态 -->
      <n-alert
        :type="isTargetReached ? 'success' : 'warning'"
        :bordered="false"
      >
        <template #header>
          <n-space align="center" :size="12" wrap>
            <n-tag 
              :type="optimizeDirection === 'increase' ? 'success' : 'warning'" 
              size="small" 
              round
            >
              {{ optimizeDirection === 'increase' ? '📈 提高模式' : '📉 降低模式' }}
            </n-tag>
            <span>当前启动率：</span>
            <n-tag
              :type="isTargetReached ? 'success' : 'warning'"
              size="medium"
              :bordered="false"
            >
              {{ currentRate?.toFixed(2) }}%
            </n-tag>
            <span>→</span>
            <span>目标{{ optimizeDirection === 'increase' ? '≥' : '≤' }}：</span>
            <n-tag type="info" size="medium" :bordered="false">
              {{ targetRate }}%
            </n-tag>
            <span v-if="isTargetReached" style="color: #22c55e">
              ✅ 已达到目标！
            </span>
            <span v-else style="color: #f59e0b">
              还差 <strong>{{ Math.abs(targetRate - currentRate).toFixed(2) }}%</strong>
            </span>
          </n-space>
        </template>
      </n-alert>

      <!-- 三列优化方案 -->
      <div v-if="keepDeckPlans.length > 0 || expandDeckPlans.length > 0 || reduceDeckPlans.length > 0" class="plans-container">
        <div class="plans-grid">
          <!-- 保持卡组总数 -->
          <div class="plan-column keep-column">
            <div class="column-header keep-header">
              <span class="column-icon">⚖️</span>
              <span class="column-title">{{ optimizeDirection === 'increase' ? '增加关键卡' : '减少关键卡' }}</span>
              <n-tag size="tiny" :bordered="false">{{ keepDeckPlans.length }}</n-tag>
            </div>
            <n-scrollbar style="max-height: 500px">
              <div class="plan-list">
                <div
                  v-for="(plan, index) in keepDeckPlans"
                  :key="'keep-' + index"
                  class="plan-item keep-item"
                  :class="{ 'is-best': plan.isBest, 'reach-target': plan.reachTarget }"
                >
                  <div class="plan-badges">
                    <n-tag v-if="plan.isBest" type="success" size="tiny" :bordered="false">🏆 最佳</n-tag>
                    <n-tag v-else-if="plan.reachTarget" type="info" size="tiny" :bordered="false">✓ 达标</n-tag>
                  </div>
                  <div class="plan-rate">
                    <span class="rate-value">{{ plan.newRate.toFixed(1) }}%</span>
                    <span class="rate-diff" :class="{ 'rate-decrease': plan.improvement < 0 }">
                      {{ plan.improvement > 0 ? '+' : '' }}{{ plan.improvement.toFixed(1) }}%
                    </span>
                  </div>
                  <div class="plan-desc">{{ plan.description }}</div>
                  <div class="plan-changes">
                    <n-tag
                      v-for="(change, ci) in plan.changes"
                      :key="ci"
                      :type="change.change > 0 ? 'success' : 'error'"
                      size="tiny"
                      round
                    >
                      {{ change.card.name || change.card.label }} {{ change.change > 0 ? '+' : '' }}{{ change.change }}
                    </n-tag>
                  </div>
                  <n-button size="tiny" type="primary" ghost @click="applyPlanToDesk(plan)">应用</n-button>
                </div>
                <div v-if="keepDeckPlans.length === 0" class="empty-column">
                  <n-text depth="3">暂无方案</n-text>
                </div>
              </div>
            </n-scrollbar>
          </div>

          <!-- 拓展卡组总数 -->
          <div class="plan-column expand-column">
            <div class="column-header expand-header">
              <span class="column-icon">📈</span>
              <span class="column-title">{{ optimizeDirection === 'increase' ? '拓展卡组' : '稀释关键卡' }}</span>
              <n-tag size="tiny" :bordered="false">{{ expandDeckPlans.length }}</n-tag>
            </div>
            <n-scrollbar style="max-height: 500px">
              <div class="plan-list">
                <div
                  v-for="(plan, index) in expandDeckPlans"
                  :key="'expand-' + index"
                  class="plan-item expand-item"
                  :class="{ 'is-best': plan.isBest, 'reach-target': plan.reachTarget }"
                >
                  <div class="plan-badges">
                    <n-tag v-if="plan.isBest" type="success" size="tiny" :bordered="false">🏆 最佳</n-tag>
                    <n-tag v-else-if="plan.reachTarget" type="info" size="tiny" :bordered="false">✓ 达标</n-tag>
                  </div>
                  <div class="plan-rate">
                    <span class="rate-value">{{ plan.newRate.toFixed(1) }}%</span>
                    <span class="rate-diff" :class="{ 'rate-decrease': plan.improvement < 0 }">
                      {{ plan.improvement > 0 ? '+' : '' }}{{ plan.improvement.toFixed(1) }}%
                    </span>
                  </div>
                  <div class="plan-desc">{{ plan.description }}</div>
                  <div class="plan-changes">
                    <n-tag
                      v-for="(change, ci) in plan.changes"
                      :key="ci"
                      :type="change.change > 0 ? 'success' : 'error'"
                      size="tiny"
                      round
                    >
                      {{ change.card.name || change.card.label }} {{ change.change > 0 ? '+' : '' }}{{ change.change }}
                    </n-tag>
                  </div>
                  <n-button size="tiny" type="primary" ghost @click="applyPlanToDesk(plan)">应用</n-button>
                </div>
                <div v-if="expandDeckPlans.length === 0" class="empty-column">
                  <n-text depth="3">暂无方案</n-text>
                </div>
              </div>
            </n-scrollbar>
          </div>

          <!-- 减少卡组总数 -->
          <div class="plan-column reduce-column">
            <div class="column-header reduce-header">
              <span class="column-icon">📉</span>
              <span class="column-title">{{ optimizeDirection === 'increase' ? '精简卡组' : '移除关键卡' }}</span>
              <n-tag size="tiny" :bordered="false">{{ reduceDeckPlans.length }}</n-tag>
            </div>
            <n-scrollbar style="max-height: 500px">
              <div class="plan-list">
                <div
                  v-for="(plan, index) in reduceDeckPlans"
                  :key="'reduce-' + index"
                  class="plan-item reduce-item"
                  :class="{ 'is-best': plan.isBest, 'reach-target': plan.reachTarget }"
                >
                  <div class="plan-badges">
                    <n-tag v-if="plan.isBest" type="success" size="tiny" :bordered="false">🏆 最佳</n-tag>
                    <n-tag v-else-if="plan.reachTarget" type="info" size="tiny" :bordered="false">✓ 达标</n-tag>
                  </div>
                  <div class="plan-rate">
                    <span class="rate-value">{{ plan.newRate.toFixed(1) }}%</span>
                    <span class="rate-diff" :class="{ 'rate-decrease': plan.improvement < 0 }">
                      {{ plan.improvement > 0 ? '+' : '' }}{{ plan.improvement.toFixed(1) }}%
                    </span>
                  </div>
                  <div class="plan-desc">{{ plan.description }}</div>
                  <div class="plan-changes">
                    <n-tag
                      v-for="(change, ci) in plan.changes"
                      :key="ci"
                      :type="change.change > 0 ? 'success' : 'error'"
                      size="tiny"
                      round
                    >
                      {{ change.card.name || change.card.label }} {{ change.change > 0 ? '+' : '' }}{{ change.change }}
                    </n-tag>
                  </div>
                  <n-button size="tiny" type="primary" ghost @click="applyPlanToDesk(plan)">应用</n-button>
                </div>
                <div v-if="reduceDeckPlans.length === 0" class="empty-column">
                  <n-text depth="3">暂无方案</n-text>
                </div>
              </div>
            </n-scrollbar>
          </div>
        </div>
      </div>

      <!-- 空状态 -->
      <n-empty
        v-else
        description="未找到有效的优化方案"
        size="medium"
      >
        <template #extra>
          <n-text depth="3">
            {{ isTargetReached 
              ? '当前卡组已达到目标启动率，无需调整！' 
              : '请尝试调整目标启动率或修改展开条件' 
            }}
          </n-text>
        </template>
      </n-empty>
    </n-space>

    <template #footer>
      <n-space justify="end">
        <n-button @click="showResultModal = false">关闭</n-button>
      </n-space>
    </template>
  </n-modal>
</template>

<script setup>
import { ref, inject, computed } from 'vue'
import {
  NCard,
  NSpace,
  NText,
  NInputNumber,
  NButton,
  NProgress,
  NAlert,
  NTag,
  NEmpty,
  NScrollbar,
  NTooltip,
  NModal,
  NCollapse,
  NCollapseItem,
  useMessage
} from 'naive-ui'
import { useOptimizer } from '../composables/useOptimizer'

const message = useMessage()

// 注入依赖
const deck = inject('deck')
const condition = inject('condition')
const draws = inject('draws')

// 优化器
const {
  isOptimizing,
  optimizeProgress,
  progressText,
  keepDeckPlans,
  expandDeckPlans,
  reduceDeckPlans,
  totalPlansCount,
  generateOptimizePlans,
  applyPlan,
  cancelOptimize
} = useOptimizer()

// 本地状态
const targetRate = ref(80)
const currentRate = ref(null)
const showResultModal = ref(false)
const optimizeDirection = ref('increase') // 'increase' 提高, 'decrease' 降低

// 判断是否达标
const isTargetReached = computed(() => {
  if (currentRate.value === null) return false
  if (optimizeDirection.value === 'increase') {
    return currentRate.value >= targetRate.value
  } else {
    return currentRate.value <= targetRate.value
  }
})

// 开始优化分析
async function startOptimize() {
  if (!condition.value || condition.value.trim() === '') {
    message.warning('请先设置展开条件')
    return
  }

  const cardCounts = deck.cards.value.map((c) => c.count)
  const totalCards = cardCounts.reduce((a, b) => a + b, 0)

  if (totalCards === 0) {
    message.warning('卡组为空，请先添加卡牌')
    return
  }

  try {
    const result = await generateOptimizePlans(
      deck.cards.value,
      condition.value,
      draws.value,
      targetRate.value
    )

    currentRate.value = result.currentRate
    optimizeDirection.value = result.direction // 从结果中获取自动判断的方向
    showResultModal.value = true

    if (result.totalPlansCount === 0) {
      if (result.direction === 'increase' ? result.currentRate >= targetRate.value : result.currentRate <= targetRate.value) {
        message.success('当前卡组已达到目标启动率！')
      }
    } else {
      const dirText = result.direction === 'increase' ? '提高' : '降低'
      message.success(`分析完成（${dirText}模式），找到 ${result.totalPlansCount} 个优化方案`)
    }
  } catch (error) {
    message.error(error.message || '优化分析失败')
  }
}

// 应用方案到卡组
function applyPlanToDesk(plan) {
  applyPlan(plan, deck.cards.value)
  message.success('已应用调整方案，正在重新分析...')
  showResultModal.value = false

  // 重新分析
  setTimeout(() => {
    startOptimize()
  }, 300)
}
</script>

<style scoped>
.optimizer-card {
  background: linear-gradient(135deg, #fefefe 0%, #f8fafc 100%);
}

.target-section {
  padding: 12px 16px;
  background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
  border-radius: 10px;
  border: 1px solid #bae6fd;
}

.progress-section {
  padding: 12px 16px;
  background: linear-gradient(135deg, #fefce8 0%, #fef3c7 100%);
  border-radius: 10px;
  border: 1px solid #fcd34d;
}

/* 三列布局 */
.plans-container {
  margin-top: 8px;
}

.plans-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.plan-column {
  border-radius: 12px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.column-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px;
  font-weight: 600;
  font-size: 14px;
}

.column-icon {
  font-size: 16px;
}

.column-title {
  flex: 1;
}

/* 保持卡组 - 蓝色主题 */
.keep-column {
  background: linear-gradient(180deg, #eff6ff 0%, #dbeafe 100%);
  border: 1px solid #93c5fd;
}

.keep-header {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  color: white;
}

.keep-item {
  background: white;
  border-left: 3px solid #3b82f6;
}

.keep-item.is-best {
  border-left: 3px solid #22c55e;
  background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
}

.keep-item.reach-target:not(.is-best) {
  background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
}

/* 拓展卡组 - 绿色主题 */
.expand-column {
  background: linear-gradient(180deg, #f0fdf4 0%, #dcfce7 100%);
  border: 1px solid #86efac;
}

.expand-header {
  background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
  color: white;
}

.expand-item {
  background: white;
  border-left: 3px solid #22c55e;
}

.expand-item.is-best {
  border-left: 3px solid #f59e0b;
  background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
}

.expand-item.reach-target:not(.is-best) {
  background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
}

/* 减少卡组 - 橙色主题 */
.reduce-column {
  background: linear-gradient(180deg, #fff7ed 0%, #ffedd5 100%);
  border: 1px solid #fdba74;
}

.reduce-header {
  background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
  color: white;
}

.reduce-item {
  background: white;
  border-left: 3px solid #f97316;
}

.reduce-item.is-best {
  border-left: 3px solid #22c55e;
  background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
}

.reduce-item.reach-target:not(.is-best) {
  background: linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%);
}

/* 方案列表 */
.plan-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
}

.plan-item {
  padding: 10px 12px;
  border-radius: 8px;
  transition: all 0.2s ease;
  display: flex;
  flex-direction: column;
  gap: 6px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.plan-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
}

.plan-badges {
  display: flex;
  gap: 4px;
}

.plan-rate {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.rate-value {
  font-size: 18px;
  font-weight: 700;
  color: #1e293b;
}

.rate-diff {
  font-size: 12px;
  color: #22c55e;
  font-weight: 500;
}

.rate-diff.rate-decrease {
  color: #f59e0b;
}

.plan-desc {
  font-size: 12px;
  color: #64748b;
  line-height: 1.4;
}

.plan-changes {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.empty-column {
  padding: 20px;
  text-align: center;
}

/* 响应式适配 */
@media (max-width: 900px) {
  .plans-grid {
    grid-template-columns: 1fr;
  }
}
</style>

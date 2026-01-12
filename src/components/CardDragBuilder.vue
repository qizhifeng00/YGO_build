<template>
  <div class="card-drag-builder">
    <!-- 浮动卡组弹窗 -->
    <div 
      class="floating-deck-popup"
      :class="{ 'is-collapsed': isDeckCollapsed }"
      :style="floatingStyle"
      ref="floatingDeckRef"
    >
      <!-- 弹窗标题栏 - 可拖动 -->
      <div 
        class="popup-header"
        @mousedown="startDrag"
        @touchstart="startDrag"
      >
        <div class="popup-title">
          <span class="deck-icon">🃏</span>
          <span>卡组</span>
        </div>
        <div class="popup-actions">
          <n-button 
            size="tiny" 
            quaternary 
            @click.stop="isDeckCollapsed = !isDeckCollapsed"
          >
            {{ isDeckCollapsed ? '展开' : '收起' }}
          </n-button>
        </div>
      </div>
      
      <!-- 卡组内容 -->
      <div class="popup-content" v-show="!isDeckCollapsed">
        <n-text class="deck-hint" depth="3">点击或拖动卡牌到展开条件区</n-text>
        <div class="deck-cards">
          <draggable
            v-model="availableCards"
            :group="{ name: 'cards', pull: 'clone', put: false }"
            :sort="false"
            item-key="id"
            class="ygo-card-list"
          >
            <template #item="{ element }">
              <div 
                class="ygo-card" 
                @click="quickAddCard(element)"
              >
                <div class="card-frame">
                  <div class="card-header">
                    <span class="card-label">{{ element.label }}</span>
                    <span class="card-name" v-if="element.name">{{ element.name }}</span>
                    <span class="card-count-badge">{{ element.count }}张</span>
                  </div>
                </div>
              </div>
            </template>
          </draggable>
          <n-empty v-if="availableCards.length === 0" description="请先在卡组配置中添加卡牌" size="small" />
        </div>
      </div>
    </div>

    <!-- 展开条件区 -->
    <div class="combo-condition-area">
      <div class="combo-header">
        <span class="combo-title">⚡ 展开条件</span>
        <n-space>
          <n-dropdown :options="presetOptions" @select="applyPreset">
            <n-button size="tiny" type="info" ghost>
              预设模板 ▾
            </n-button>
          </n-dropdown>
          <n-button size="tiny" @click="addConditionRow" type="primary" ghost>
            + 添加展开路线
          </n-button>
          <n-button size="tiny" @click="clearAllConditions" type="error" ghost>
            重置
          </n-button>
        </n-space>
      </div>

      <!-- 展开逻辑选择 -->
      <div class="logic-selector" v-if="conditionRows.length > 1">
        <n-text depth="2" style="font-size: 12px;">展开逻辑：</n-text>
        <n-radio-group v-model:value="globalLogic" size="small">
          <n-radio-button value="and">
            <span class="logic-label">且条件</span>
            <span class="logic-desc">（需同时上手）</span>
          </n-radio-button>
          <n-radio-button value="or">
            <span class="logic-label">或条件</span>
            <span class="logic-desc">（上手其一）</span>
          </n-radio-button>
        </n-radio-group>
      </div>

      <!-- 展开路线列表 -->
      <div class="condition-rows">
        <div 
          v-for="(row, rowIndex) in conditionRows" 
          :key="row.id" 
          class="combo-route"
          :class="{ 
            'has-cards': row.cards.length > 0,
            'one-card-combo': row.cards.length === 1,
            'multi-card-combo': row.cards.length > 1
          }"
        >
          <div class="route-header">
            <n-tag size="small" :bordered="false" :type="getRouteTagType(row.cards.length)">
              {{ getRouteLabel(row.cards.length, rowIndex) }}
            </n-tag>
            <n-button 
              size="tiny" 
              type="error" 
              ghost 
              @click="removeConditionRow(rowIndex)"
              v-if="conditionRows.length > 1"
            >
              删除
            </n-button>
          </div>

          <div class="route-content">
            <!-- 展开点提示 -->
            <div class="drop-hint" v-if="row.cards.length === 0">
              <div class="hint-icon">🎴</div>
              <n-text depth="3">拖入展开点卡牌</n-text>
              <n-text depth="3" style="font-size: 11px;">（一卡动只需一张，多卡动可组合）</n-text>
            </div>

            <!-- 卡牌拖放区 -->
            <div class="cards-drop-zone">
              <draggable
                v-model="row.cards"
                :group="{ name: 'cards', pull: false, put: true }"
                item-key="uid"
                class="dropped-cards"
                @add="onCardAdded(rowIndex)"
              >
                <template #item="{ element, index }">
                  <div class="dropped-card-wrapper">
                    <!-- 运算符 -->
                    <n-select
                      v-if="index > 0"
                      v-model:value="element.operator"
                      :options="mathOperators"
                      size="tiny"
                      style="width: 60px;"
                      @update:value="emitUpdate"
                    />
                    <!-- 卡牌展示 -->
                    <div class="dropped-ygo-card">
                      <div class="card-info">
                        <span class="card-label">{{ element.label }}</span>
                        <span class="card-name" v-if="element.name">{{ element.name }}</span>
                      </div>
                      <n-button 
                        size="tiny" 
                        text 
                        class="remove-card-btn"
                        @click="removeCard(rowIndex, index)"
                      >
                        ✕
                      </n-button>
                    </div>
                  </div>
                </template>
              </draggable>
            </div>

            <!-- 上手条件 -->
            <div class="hand-condition" v-if="row.cards.length > 0">
              <span class="condition-label">上手</span>
              <n-select
                v-model:value="row.operator"
                :options="comparisonOperators"
                size="small"
                style="width: 70px;"
                @update:value="emitUpdate"
              />
              <n-input-number
                v-model:value="row.value"
                :min="0"
                size="small"
                style="width: 70px;"
                @update:value="emitUpdate"
              />
              <span class="condition-label">张</span>
            </div>
          </div>
        </div>

        <!-- 空状态 -->
        <div class="empty-hint" v-if="conditionRows.length === 0">
          <n-empty description="点击「添加展开路线」开始构建Combo条件" size="small" />
        </div>
      </div>

      <!-- 公式预览 -->
      <div class="formula-preview">
        <div class="preview-header">
          <span class="preview-icon">📊</span>
          <n-text depth="3" style="font-size: 12px;">上手率公式：</n-text>
        </div>
        <n-text code style="word-break: break-all; font-size: 13px;">
          {{ generatedCondition || '（拖入卡牌生成展开条件）' }}
        </n-text>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, inject, onMounted, onUnmounted } from 'vue'
import { NText, NButton, NSelect, NInputNumber, NRadioGroup, NRadioButton, NTag, NSpace, NEmpty, NDropdown } from 'naive-ui'
import draggable from 'vuedraggable'

const props = defineProps({
  cards: {
    type: Array,
    required: true
  }
})

const emit = defineEmits(['update'])

// ========== 浮动弹窗相关（性能优化版）==========
const floatingDeckRef = ref(null)
const isDeckCollapsed = ref(false)

// 使用普通变量存储位置，避免响应式开销
let posX = 16
let posY = 16
let offsetX = 0
let offsetY = 0
let dragging = false
let rafId = null

// 初始样式
const floatingStyle = ref({
  transform: `translate3d(${posX}px, ${posY}px, 0)`
})

// 开始拖动弹窗
function startDrag(e) {
  // 阻止拖动卡牌时触发
  if (e.target.closest('.ygo-card')) return
  if (e.target.closest('.n-button')) return
  
  e.preventDefault()
  dragging = true
  
  const clientX = e.touches ? e.touches[0].clientX : e.clientX
  const clientY = e.touches ? e.touches[0].clientY : e.clientY
  
  offsetX = clientX - posX
  offsetY = clientY - posY
  
  // 添加拖动状态样式
  if (floatingDeckRef.value) {
    floatingDeckRef.value.classList.add('is-dragging')
  }
  
  document.addEventListener('mousemove', onDrag, { passive: false })
  document.addEventListener('mouseup', stopDrag)
  document.addEventListener('touchmove', onDrag, { passive: false })
  document.addEventListener('touchend', stopDrag)
}

// 拖动中 - 使用 RAF 优化
function onDrag(e) {
  if (!dragging) return
  e.preventDefault()
  
  const clientX = e.touches ? e.touches[0].clientX : e.clientX
  const clientY = e.touches ? e.touches[0].clientY : e.clientY
  
  // 取消之前的 RAF
  if (rafId) cancelAnimationFrame(rafId)
  
  // 使用 RAF 更新位置
  rafId = requestAnimationFrame(() => {
    const maxX = window.innerWidth - 100
    const maxY = window.innerHeight - 50
    
    posX = Math.max(0, Math.min(clientX - offsetX, maxX))
    posY = Math.max(0, Math.min(clientY - offsetY, maxY))
    
    // 直接操作 DOM，绕过 Vue 响应式
    if (floatingDeckRef.value) {
      floatingDeckRef.value.style.transform = `translate3d(${posX}px, ${posY}px, 0)`
    }
  })
}

// 停止拖动
function stopDrag() {
  dragging = false
  if (rafId) {
    cancelAnimationFrame(rafId)
    rafId = null
  }
  
  // 移除拖动状态样式
  if (floatingDeckRef.value) {
    floatingDeckRef.value.classList.remove('is-dragging')
  }
  
  // 同步最终位置到响应式变量（用于初始渲染）
  floatingStyle.value = {
    transform: `translate3d(${posX}px, ${posY}px, 0)`
  }
  
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
  document.removeEventListener('touchmove', onDrag)
  document.removeEventListener('touchend', stopDrag)
}

onUnmounted(() => {
  if (rafId) cancelAnimationFrame(rafId)
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
  document.removeEventListener('touchmove', onDrag)
  document.removeEventListener('touchend', stopDrag)
})

// ========== 条件构建相关 ==========

// 全局逻辑关系
const globalLogic = ref('or')

// 条件行数据
const conditionRows = ref([
  createConditionRow()
])

// 预设模板选项
const presetOptions = [
  { label: '🎯 一卡动检测 (多初动点)', key: 'one-card' },
  { label: '⚔️ 两卡必成 Combo', key: 'two-card' },
  { label: '🛡️ 手坑+展开 同时上手', key: 'combo-handtrap' },
  { label: '🛡️ 仅手坑拦截', key: 'hand-trap' }
]

// 运算符选项 (用于同一路径内的卡牌关系)
const mathOperators = [
  { label: '且', value: '&&' },
  { label: '或', value: '||' }
]

const comparisonOperators = [
  { label: '>=', value: 'gte' },
  { label: '>', value: 'gt' },
  { label: '==', value: 'eq' },
  { label: '!=', value: 'neq' },
  { label: '<', value: 'lt' },
  { label: '<=', value: 'lte' }
]

const operatorSymbols = {
  gt: '>',
  gte: '>=',
  eq: '==',
  neq: '!=',
  lt: '<',
  lte: '<='
}

// 可用卡牌（count > 0）
const availableCards = computed(() => {
  return props.cards.filter(card => card.count > 0)
})

// 获取展开路线标签
function getRouteLabel(cardCount, index) {
  if (cardCount === 0) return `展开路线 ${index + 1}`
  if (cardCount === 1) return `一卡动 ${index + 1}`
  return `${cardCount}卡动 ${index + 1}`
}

// 获取展开路线标签类型
function getRouteTagType(cardCount) {
  if (cardCount === 0) return 'default'
  if (cardCount === 1) return 'success'
  return 'warning'
}

// 应用预设模板
function applyPreset(key) {
  switch (key) {
    case 'one-card':
      // 一卡动: 只要上手其中一个初动点即可
      conditionRows.value = [createConditionRow()]
      globalLogic.value = 'or'
      break
    case 'two-card':
      // 两卡动: 同一路径内必须 A 和 B 同时上手
      const row = createConditionRow()
      conditionRows.value = [row]
      globalLogic.value = 'or'
      break
    case 'hand-trap':
      conditionRows.value = [createConditionRow()]
      globalLogic.value = 'or'
      break
    case 'combo-handtrap':
      // 展开 + 手坑 同时上手 (跨行且关系)
      conditionRows.value = [createConditionRow(), createConditionRow()]
      globalLogic.value = 'and'
      break
  }
  emitUpdate()
}

// 创建新的条件行
function createConditionRow() {
  return {
    id: Date.now() + Math.random(),
    cards: [],
    operator: 'gt',
    value: 0
  }
}

// 添加条件行
function addConditionRow() {
  conditionRows.value.push(createConditionRow())
}

// 删除条件行
function removeConditionRow(index) {
  conditionRows.value.splice(index, 1)
  emitUpdate()
}

// 清空所有条件
function clearAllConditions() {
  conditionRows.value = [createConditionRow()]
  emitUpdate()
}

// 卡牌被添加到条件行时
function onCardAdded(rowIndex) {
  // 为新添加的卡牌设置唯一ID和默认运算符 (默认为 && 且关系)
  const row = conditionRows.value[rowIndex]
  row.cards.forEach((card, index) => {
    if (!card.uid) {
      card.uid = Date.now() + Math.random()
      card.operator = '&&'
    }
  })
  emitUpdate()
}

// 删除卡牌
function removeCard(rowIndex, cardIndex) {
  conditionRows.value[rowIndex].cards.splice(cardIndex, 1)
  emitUpdate()
}

// 生成条件文本
const generatedCondition = computed(() => {
  const validRows = conditionRows.value.filter(row => row.cards.length > 0)
  
  if (validRows.length === 0) return ''

  const conditions = validRows.map(row => {
    // 生成单条路径内的卡牌表达式
    const rowExpr = row.cards.map((card, index) => {
      const varName = getVarName(card.id)
      const symbol = operatorSymbols[row.operator] || '>='
      const singleCardCheck = `(${varName} ${symbol} ${row.value})`
      
      if (index === 0) return singleCardCheck
      // 使用选定的运算符 (&& 或 ||)
      return ` ${card.operator} ${singleCardCheck}`
    }).join('')

    return row.cards.length > 1 ? `(${rowExpr})` : rowExpr
  })

  if (conditions.length === 1) {
    return conditions[0]
  }

  const connector = globalLogic.value === 'and' ? ' && ' : ' || '
  return `(${conditions.join(connector)})`
})

// 获取变量名
function getVarName(index) {
  if (index < 26) return String.fromCharCode(97 + index)
  return 'a' + String.fromCharCode(97 + index - 26)
}

// 触发更新
function emitUpdate() {
  emit('update', generatedCondition.value)
}

// 快速添加卡牌到最后一行
function quickAddCard(card) {
  if (conditionRows.value.length === 0) {
    addConditionRow()
  }
  
  // 复制卡牌对象，避免引用同一个对象
  const newCard = {
    ...card,
    uid: Date.now() + Math.random(),
    operator: '&&'
  }
  
  // 添加到最后一条路线
  const lastRow = conditionRows.value[conditionRows.value.length - 1]
  lastRow.cards.push(newCard)
  emitUpdate()
}

// 监听全局逻辑变化
watch(globalLogic, () => {
  emitUpdate()
})

// 监听生成的条件变化
watch(generatedCondition, (newVal) => {
  emit('update', newVal)
})

// 导入 drag 结构
function importDragStructure(dragStructure) {
  if (!dragStructure || !dragStructure.rows || dragStructure.rows.length === 0) {
    return false
  }
  
  conditionRows.value = dragStructure.rows
  globalLogic.value = dragStructure.globalLogic || 'or'
  emitUpdate()
  return true
}

// 暴露方法给父组件
defineExpose({
  getCondition: () => generatedCondition.value,
  importDragStructure,
  clear: () => {
    conditionRows.value = [createConditionRow()]
    globalLogic.value = 'or'
    emitUpdate()
  }
})
</script>

<style scoped>
.card-drag-builder {
  display: flex;
  flex-direction: column;
  gap: 16px;
  position: relative;
}

/* ========== 浮动卡组弹窗 ========== */
.floating-deck-popup {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 1000;
  background: linear-gradient(145deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
  border-radius: 14px;
  border: 3px solid #d4af37;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  min-width: 420px;
  max-width: 580px;
  /* 启用 GPU 加速 */
  will-change: transform;
  backface-visibility: hidden;
}

/* 拖动时的优化样式 */
.floating-deck-popup.is-dragging {
  cursor: grabbing;
  user-select: none;
  /* 拖动时禁用过渡和阴影变化，提升性能 */
  transition: none !important;
  box-shadow: 0 12px 48px rgba(0, 0, 0, 0.6);
}

.floating-deck-popup.is-dragging * {
  pointer-events: none;
}

.floating-deck-popup.is-collapsed {
  min-width: auto;
  max-width: none;
}

/* 弹窗标题栏 */
.popup-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 18px;
  cursor: grab;
  border-bottom: 1px solid rgba(212, 175, 55, 0.3);
  user-select: none;
  position: relative;
  z-index: 1;
  touch-action: none; /* 禁用浏览器默认触摸行为 */
}

.floating-deck-popup.is-dragging .popup-header {
  cursor: grabbing;
}

.popup-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 700;
  font-size: 18px;
  color: #d4af37;
  text-shadow: 0 0 10px rgba(212, 175, 55, 0.5);
}

.popup-actions {
  display: flex;
  gap: 4px;
}

.popup-actions :deep(.n-button) {
  color: rgba(255, 255, 255, 0.7) !important;
  font-size: 14px;
}

.popup-actions :deep(.n-button:hover) {
  color: #d4af37 !important;
}

/* 弹窗内容 */
.popup-content {
  padding: 16px 18px;
  position: relative;
  z-index: 1;
  max-height: 400px;
  overflow-y: auto;
}

/* 自定义滚动条 */
.popup-content::-webkit-scrollbar {
  width: 6px;
}

.popup-content::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
}

.popup-content::-webkit-scrollbar-thumb {
  background: rgba(212, 175, 55, 0.5);
  border-radius: 3px;
}

.popup-content::-webkit-scrollbar-thumb:hover {
  background: rgba(212, 175, 55, 0.7);
}

.deck-icon {
  font-size: 24px;
}

.deck-hint {
  display: block;
  margin-bottom: 14px;
  font-size: 15px !important;
  color: rgba(255, 255, 255, 0.65) !important;
}

.deck-cards {
  min-height: 100px;
}

/* 移动端适配 */
@media (max-width: 768px) {
  .floating-deck-popup {
    min-width: 320px;
    max-width: 400px;
  }
  
  .ygo-card {
    width: 85px;
  }
  
  .card-header .card-label {
    font-size: 14px;
  }
  
  .card-name {
    font-size: 12px;
  }
  
  .card-count-badge {
    font-size: 13px;
  }
  
  .popup-content {
    max-height: 300px;
    padding: 14px 16px;
  }
}

.ygo-card-list {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

/* 游戏王卡牌样式 - 浮动弹窗版本 */
.ygo-card {
  width: 105px;
  aspect-ratio: 59 / 86; /* 标准游戏王卡牌比例 */
  cursor: grab;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  background-image: url('https://images.ygoprodeck.com/images/cards/back.jpg');
  background-size: cover;
  background-position: center;
  border-radius: 5px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 6px;
  overflow: hidden;
}

.ygo-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.15);
  pointer-events: none;
}

.ygo-card:hover {
  transform: translateY(-4px) scale(1.05);
  z-index: 10;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.6);
}

.ygo-card:hover .card-frame {
  background: rgba(255, 255, 255, 1);
  transform: scale(1.02);
}

.card-frame {
  width: 100%;
  background: rgba(255, 255, 255, 0.92);
  border-radius: 4px;
  padding: 8px 6px;
  border: 1px solid rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  gap: 4px;
  position: relative;
  z-index: 1;
  transition: all 0.2s ease;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
}

.card-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
}

.card-header .card-label {
  font-weight: 900;
  font-size: 16px;
  color: #1a1a1a;
  text-align: center;
}

.card-stars {
  display: flex;
  justify-content: center;
  gap: 1px;
}

.star {
  color: #ff4d4f; /* 经典游戏王星级颜色 */
  font-size: 8px;
  text-shadow: 1px 1px 0px rgba(0, 0, 0, 0.2);
}

.card-body {
  min-height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.05);
  border-radius: 2px;
  padding: 4px;
}

.card-name {
  font-size: 13px;
  color: #333;
  text-align: center;
  word-break: break-all;
  line-height: 1.2;
  font-weight: 500;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-footer {
  display: flex;
  justify-content: center;
  margin-top: 3px;
}

.card-count-badge {
  color: #000;
  font-size: 14px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 4px;
  background: rgba(212, 175, 55, 0.25);
}


/* ========== 展开条件区域 ========== */
.combo-condition-area {
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  border: 2px solid #dee2e6;
  border-radius: 12px;
  padding: 16px;
}

.combo-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  flex-wrap: wrap;
  gap: 8px;
}

.combo-title {
  font-weight: 700;
  font-size: 15px;
  color: #212529;
}

.logic-selector {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
  padding: 10px 14px;
  background: linear-gradient(135deg, #fff3cd 0%, #ffeeba 100%);
  border-radius: 8px;
  border: 1px solid #ffc107;
}

.logic-label {
  font-weight: 600;
}

.logic-desc {
  font-size: 11px;
  color: #6c757d;
  margin-left: 4px;
}

/* 展开路线 */
.condition-rows {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 16px;
}

.combo-route {
  background: white;
  border: 2px solid #e9ecef;
  border-radius: 10px;
  padding: 12px;
  transition: all 0.3s ease;
}

.combo-route.has-cards {
  border-color: #28a745;
  box-shadow: 0 0 0 2px rgba(40, 167, 69, 0.2);
}

.combo-route.one-card-combo {
  border-color: #28a745;
  background: linear-gradient(135deg, #ffffff 0%, #d4edda 100%);
}

.combo-route.multi-card-combo {
  border-color: #fd7e14;
  background: linear-gradient(135deg, #ffffff 0%, #fff3e0 100%);
}

.route-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.route-content {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.drop-hint {
  flex: 1;
  text-align: center;
  padding: 16px;
  border: 2px dashed #adb5bd;
  border-radius: 8px;
  background: #f8f9fa;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.hint-icon {
  font-size: 24px;
  opacity: 0.6;
}

.cards-drop-zone {
  flex: 1;
  min-width: 200px;
}

.dropped-cards {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  min-height: 44px;
  padding: 10px;
  background: linear-gradient(135deg, #f1f3f4 0%, #e8eaed 100%);
  border-radius: 8px;
  border: 2px dashed transparent;
}

.dropped-cards:empty {
  border-color: #adb5bd;
}

.dropped-card-wrapper {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.dropped-ygo-card {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  padding: 6px 12px;
  border-radius: 8px;
  background: white;
  border: 1px solid #dcdfe6;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  transition: all 0.2s ease;
}

.dropped-ygo-card:hover {
  border-color: #409eff;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
}

.card-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.dropped-ygo-card .card-label {
  font-size: 13px;
  font-weight: 800;
  color: #1a1a1a;
  line-height: 1.2;
}

.dropped-ygo-card .card-name {
  font-size: 11px;
  color: #606266;
  font-weight: normal;
  text-shadow: none;
  background: none;
  padding: 0;
}

.remove-card-btn {
  margin-left: 4px;
  color: #909399 !important;
  transition: color 0.2s ease;
}

.remove-card-btn:hover {
  color: #f56c6c !important;
}

/* 上手条件 */
.hand-condition {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
  border-radius: 8px;
  border: 1px solid #64b5f6;
}

.condition-label {
  font-size: 12px;
  font-weight: 600;
  color: #1565c0;
}

/* 公式预览 */
.formula-preview {
  padding: 14px;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  border-radius: 8px;
  border: 2px solid #d4af37;
}

.preview-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
}

.preview-icon {
  font-size: 14px;
}

.preview-header .n-text {
  color: #d4af37 !important;
}

.formula-preview :deep(.n-text--code) {
  background: rgba(212, 175, 55, 0.1) !important;
  color: #f5d76e !important;
  border: 1px solid rgba(212, 175, 55, 0.3) !important;
}

.empty-hint {
  padding: 24px;
  text-align: center;
}

/* 空状态样式 */
:deep(.n-empty) {
  --n-text-color: #6c757d;
}

.floating-deck-popup :deep(.n-empty) {
  --n-text-color: rgba(255, 255, 255, 0.5);
}

.floating-deck-popup :deep(.n-empty__description) {
  font-size: 11px;
}
</style>


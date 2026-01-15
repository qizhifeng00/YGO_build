<template>
  <n-card title="🌍 小世界现象计算器 (测试优化中)" size="small">
    <template #header-extra>
      <n-space :size="8">
        <n-tooltip trigger="hover">
          <template #trigger>
            <n-text depth="3" style="font-size: 11px; cursor: help;">效果说明</n-text>
          </template>
          <div style="max-width: 320px;">
            <p style="margin: 0 0 8px 0;"><strong>小世界现象 (Small World)</strong></p>
            <p style="margin: 0 0 4px 0;">从手牌展示1只怪兽，从卡组选择1只与其<strong>恰好1个参数相同</strong>的怪兽（桥梁），</p>
            <p style="margin: 0 0 4px 0;">再从卡组选择1只与桥梁怪兽<strong>恰好1个参数相同</strong>的怪兽加入手牌。</p>
            <p style="margin: 0; color: #94a3b8;">参数：ATK、DEF、等级、种族、属性</p>
          </div>
        </n-tooltip>
        <n-button 
          size="tiny" 
          type="primary"
          :loading="isImportingFromDeck"
          @click="importFromDeck"
        >
          从卡组导入
        </n-button>
        <n-button size="tiny" quaternary @click="showImportModal = true">
          JSON导入
        </n-button>
      </n-space>
    </template>
    
    <n-space vertical :size="12">
      <!-- 怪兽输入区域 -->
      <div class="monster-input-section">
        <n-space justify="space-between" align="center" style="margin-bottom: 8px;">
          <n-text depth="2" style="font-size: 12px; font-weight: 500;">
            怪兽列表 ({{ monsters.length }})
          </n-text>
          <n-space :size="4">
            <n-button size="tiny" type="primary" @click="addNewMonster">
              + 添加
            </n-button>
            <n-button size="tiny" quaternary @click="clearAll" :disabled="monsters.length === 0">
              清空
            </n-button>
          </n-space>
        </n-space>
        
        <!-- 怪兽列表 -->
        <div class="monster-list" v-if="monsters.length > 0">
          <div
            v-for="monster in monsters"
            :key="monster.id"
            class="monster-item"
            :class="{ 'selected': selectedMonsterId === monster.id }"
            @click="selectMonster(monster.id)"
          >
            <div class="monster-header">
              <n-input
                v-model:value="monster.name"
                placeholder="怪兽名称"
                size="tiny"
                style="flex: 1; max-width: 120px;"
                @click.stop
                @change="saveData"
              />
              <n-button
                size="tiny"
                quaternary
                type="error"
                @click.stop="removeMonster(monster.id)"
              >
                ×
              </n-button>
            </div>
            
            <div class="monster-stats">
              <n-grid :cols="5" :x-gap="4">
                <n-grid-item>
                  <n-input-number
                    v-model:value="monster.atk"
                    placeholder="ATK"
                    size="tiny"
                    :min="0"
                    :step="100"
                    :show-button="false"
                    @click.stop
                    @update:value="saveData"
                  />
                </n-grid-item>
                <n-grid-item>
                  <n-input-number
                    v-model:value="monster.def"
                    placeholder="DEF"
                    size="tiny"
                    :min="0"
                    :step="100"
                    :show-button="false"
                    @click.stop
                    @update:value="saveData"
                  />
                </n-grid-item>
                <n-grid-item>
                  <n-select
                    v-model:value="monster.level"
                    placeholder="等级"
                    size="tiny"
                    :options="levelOptions"
                    clearable
                    @click.stop
                    @update:value="saveData"
                  />
                </n-grid-item>
                <n-grid-item>
                  <n-select
                    v-model:value="monster.race"
                    placeholder="种族"
                    size="tiny"
                    :options="raceOptions"
                    filterable
                    clearable
                    @click.stop
                    @update:value="saveData"
                  />
                </n-grid-item>
                <n-grid-item>
                  <n-select
                    v-model:value="monster.attribute"
                    placeholder="属性"
                    size="tiny"
                    :options="attributeOptions"
                    clearable
                    @click.stop
                    @update:value="saveData"
                  />
                </n-grid-item>
              </n-grid>
            </div>
          </div>
        </div>
        
        <n-empty v-else description="点击「添加」按钮添加怪兽" size="small" />
      </div>
      
      <!-- 计算模式选择 -->
      <n-tabs v-model:value="calcMode" type="segment" size="small">
        <n-tab name="matrix">连接矩阵</n-tab>
        <n-tab name="path">路径查找</n-tab>
        <n-tab name="analysis">可达性分析</n-tab>
      </n-tabs>
      
      <!-- 连接矩阵视图 -->
      <div v-if="calcMode === 'matrix'" class="matrix-view">
        <div v-if="monsters.length >= 2" class="matrix-container">
          <table class="connection-matrix">
            <thead>
              <tr>
                <th></th>
                <th v-for="m in monsters" :key="'h-' + m.id" class="matrix-header">
                  {{ m.name || '未命名' }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="m1 in monsters" :key="'r-' + m1.id">
                <td class="matrix-row-header">{{ m1.name || '未命名' }}</td>
                <td
                  v-for="m2 in monsters"
                  :key="'c-' + m1.id + '-' + m2.id"
                  class="matrix-cell"
                  :class="{
                    'self': m1.id === m2.id,
                    'connected': m1.id !== m2.id && connectionMatrix[m1.id]?.[m2.id],
                    'disconnected': m1.id !== m2.id && !connectionMatrix[m1.id]?.[m2.id]
                  }"
                >
                  <span v-if="m1.id === m2.id">-</span>
                  <span v-else-if="connectionMatrix[m1.id]?.[m2.id]">✓</span>
                  <span v-else>✗</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <n-empty v-else description="至少需要2只怪兽才能显示连接矩阵" size="small" />
        
        <div class="matrix-legend">
          <n-space :size="12">
            <n-text depth="3" style="font-size: 10px;">
              <span class="legend-dot connected"></span> 可连接（恰好1参数相同）
            </n-text>
            <n-text depth="3" style="font-size: 10px;">
              <span class="legend-dot disconnected"></span> 不可连接
            </n-text>
          </n-space>
        </div>
      </div>
      
      <!-- 路径查找视图 -->
      <div v-if="calcMode === 'path'" class="path-view">
        <n-grid :cols="2" :x-gap="8">
          <n-grid-item>
            <n-space vertical :size="4">
              <n-text depth="3" style="font-size: 11px;">起点卡（手牌）</n-text>
              <n-select
                v-model:value="pathSource"
                placeholder="选择起点怪兽"
                size="small"
                :options="monsterSelectOptions"
                clearable
              />
            </n-space>
          </n-grid-item>
          <n-grid-item>
            <n-space vertical :size="4">
              <n-text depth="3" style="font-size: 11px;">目标卡（检索）</n-text>
              <n-select
                v-model:value="pathTarget"
                placeholder="选择目标怪兽"
                size="small"
                :options="monsterSelectOptions"
                :disabled="!pathSource"
                clearable
              />
            </n-space>
          </n-grid-item>
        </n-grid>
        
        <!-- 桥梁结果 -->
        <div v-if="pathSource && pathTarget && pathSource !== pathTarget" class="bridge-results">
          <div v-if="bridgeResults.length > 0">
            <n-text depth="2" style="font-size: 12px; font-weight: 500;">
              找到 {{ bridgeResults.length }} 个可用桥梁：
            </n-text>
            <div class="bridge-list">
              <div v-for="(bridge, index) in bridgeResults" :key="index" class="bridge-item">
                <div class="bridge-name">
                  <n-tag size="small" type="success">桥梁</n-tag>
                  <n-text strong>{{ bridge.monster.name || '未命名' }}</n-text>
                </div>
                <div class="bridge-path">
                  <span class="path-node source">{{ getMonsterName(pathSource) }}</span>
                  <span class="path-arrow">→</span>
                  <span class="path-match">[{{ bridge.sourceMatch.map(m => m.param).join(', ') }}]</span>
                  <span class="path-arrow">→</span>
                  <span class="path-node bridge">{{ bridge.monster.name || '未命名' }}</span>
                  <span class="path-arrow">→</span>
                  <span class="path-match">[{{ bridge.targetMatch.map(m => m.param).join(', ') }}]</span>
                  <span class="path-arrow">→</span>
                  <span class="path-node target">{{ getMonsterName(pathTarget) }}</span>
                </div>
              </div>
            </div>
          </div>
          <n-alert v-else type="warning" :show-icon="false" style="font-size: 11px;">
            没有找到可用的桥梁怪兽
          </n-alert>
        </div>
        <n-empty v-else-if="!pathSource" description="请选择起点和目标怪兽" size="small" />
      </div>
      
      <!-- 可达性分析视图 -->
      <div v-if="calcMode === 'analysis'" class="analysis-view">
        <n-space vertical :size="4" style="margin-bottom: 8px;">
          <n-text depth="3" style="font-size: 11px;">选择分析的怪兽（作为手牌展示）</n-text>
          <n-select
            v-model:value="analysisTarget"
            placeholder="选择要分析的怪兽"
            size="small"
            :options="monsterSelectOptions"
            clearable
          />
        </n-space>
        
        <div v-if="analysisTarget && analysisResult" class="analysis-results">
          <n-collapse :default-expanded-names="['direct', 'bridge', 'unreachable']">
            <!-- 可直接连接 -->
            <n-collapse-item name="direct" :title="`✅ 可直接连接 (${analysisResult.direct.length})`">
              <div v-if="analysisResult.direct.length > 0" class="reachable-list">
                <div v-for="item in analysisResult.direct" :key="item.monster.id" class="reachable-item direct">
                  <n-text>{{ item.monster.name || '未命名' }}</n-text>
                  <n-text depth="3" style="font-size: 10px;">
                    匹配: {{ item.matchParams.map(m => `${m.param}=${m.value}`).join(', ') }}
                  </n-text>
                </div>
              </div>
              <n-text v-else depth="3" style="font-size: 11px;">无</n-text>
            </n-collapse-item>
            
            <!-- 需要桥梁 -->
            <n-collapse-item name="bridge" :title="`🌉 需要桥梁 (${analysisResult.viaBridge.length})`">
              <div v-if="analysisResult.viaBridge.length > 0" class="reachable-list">
                <div v-for="item in analysisResult.viaBridge" :key="item.monster.id" class="reachable-item bridge">
                  <n-text>{{ item.monster.name || '未命名' }}</n-text>
                  <n-text depth="3" style="font-size: 10px;">
                    可用桥梁: {{ item.bridges.map(b => b.monster.name || '未命名').join(', ') }}
                  </n-text>
                </div>
              </div>
              <n-text v-else depth="3" style="font-size: 11px;">无</n-text>
            </n-collapse-item>
            
            <!-- 无法到达 -->
            <n-collapse-item name="unreachable" :title="`❌ 无法到达 (${analysisResult.unreachable.length})`">
              <div v-if="analysisResult.unreachable.length > 0" class="reachable-list">
                <div v-for="item in analysisResult.unreachable" :key="item.id" class="reachable-item unreachable">
                  <n-text>{{ item.name || '未命名' }}</n-text>
                </div>
              </div>
              <n-text v-else depth="3" style="font-size: 11px;">无</n-text>
            </n-collapse-item>
          </n-collapse>
        </div>
        <n-empty v-else description="请选择要分析的怪兽" size="small" />
      </div>
    </n-space>
    
    <!-- 导入弹窗 -->
    <n-modal v-model:show="showImportModal" preset="dialog" title="导入怪兽数据">
      <n-space vertical :size="12">
        <n-text depth="2" style="font-size: 12px;">
          粘贴 JSON 格式的怪兽数据：
        </n-text>
        <n-input
          v-model:value="importText"
          type="textarea"
          placeholder='[{"name": "灰流丽", "atk": 0, "def": 1800, "level": 3, "race": "不死族", "attribute": "炎"}]'
          :rows="6"
        />
        <n-space justify="end">
          <n-button @click="showImportModal = false">取消</n-button>
          <n-button type="primary" @click="handleImport">导入</n-button>
        </n-space>
      </n-space>
    </n-modal>
  </n-card>
</template>

<script setup>
import { ref, computed, onMounted, watch, inject } from 'vue'
import {
  NCard, NSpace, NText, NButton, NTooltip, NInput, NInputNumber,
  NSelect, NGrid, NGridItem, NTabs, NTab, NTag, NAlert, NEmpty,
  NCollapse, NCollapseItem, NModal, useMessage
} from 'naive-ui'
import { useSmallWorld, RACE_OPTIONS, ATTRIBUTE_OPTIONS, LEVEL_OPTIONS } from '../composables/useSmallWorld'
import { useCardDatabase } from '../composables/useCardDatabase'

const message = useMessage()
const deck = inject('deck')

const {
  monsters,
  addMonster,
  removeMonster: removeMonsterFn,
  connectionMatrix,
  findBridges,
  analyzeReachability,
  saveMonsters,
  loadMonsters,
  importFromJSON
} = useSmallWorld()

// 卡片数据库
const {
  isLoaded: isDbLoaded,
  loadDefaultDatabase,
  getCardsByIds
} = useCardDatabase()

// 选项数据
const raceOptions = RACE_OPTIONS.map(r => ({ label: r, value: r }))
const attributeOptions = ATTRIBUTE_OPTIONS.map(a => ({ label: a, value: a }))
const levelOptions = LEVEL_OPTIONS.map(l => ({ label: `★${l}`, value: l }))

// 状态
const selectedMonsterId = ref(null)
const calcMode = ref('matrix')
const pathSource = ref(null)
const pathTarget = ref(null)
const analysisTarget = ref(null)
const showImportModal = ref(false)
const importText = ref('')
const isImportingFromDeck = ref(false)

// 从卡牌配置导入怪兽
async function importFromDeck() {
  if (!deck?.cards?.value) {
    message.warning('无法获取卡牌配置数据')
    return
  }
  
  isImportingFromDeck.value = true
  
  try {
    // 获取所有有 cardId 的卡牌
    const cardsWithId = deck.cards.value.filter(c => c.cardId && c.count > 0)
    
    if (cardsWithId.length === 0) {
      message.warning('卡牌配置中没有可识别的卡牌，请先导入卡组')
      isImportingFromDeck.value = false
      return
    }
    
    // 确保数据库已加载
    if (!isDbLoaded.value) {
      await loadDefaultDatabase()
    }
    
    // 获取卡片详细信息
    const cardIds = cardsWithId.map(c => c.cardId)
    const cardMap = getCardsByIds(cardIds)
    
    // 提取怪兽卡
    const monsterList = []
    for (const card of cardsWithId) {
      const cardInfo = cardMap.get(card.cardId)
      if (cardInfo && cardInfo.isMonster) {
        monsterList.push({
          id: Date.now() + Math.random(),
          name: cardInfo.name,
          atk: cardInfo.atk,
          def: cardInfo.def,
          level: cardInfo.level,
          race: cardInfo.race,
          attribute: cardInfo.attribute
        })
      }
    }
    
    if (monsterList.length === 0) {
      message.warning('卡牌配置中没有找到怪兽卡')
      isImportingFromDeck.value = false
      return
    }
    
    // 导入怪兽
    monsters.value = monsterList
    saveMonsters()
    message.success(`成功从卡组导入 ${monsterList.length} 只怪兽`)
  } catch (e) {
    console.error('从卡组导入失败:', e)
    message.error('导入失败: ' + e.message)
  } finally {
    isImportingFromDeck.value = false
  }
}

// 怪兽选择选项
const monsterSelectOptions = computed(() => {
  return monsters.value.map(m => ({
    label: m.name || `未命名-${m.id}`,
    value: m.id
  }))
})

// 桥梁搜索结果
const bridgeResults = computed(() => {
  if (!pathSource.value || !pathTarget.value || pathSource.value === pathTarget.value) {
    return []
  }
  return findBridges(pathSource.value, pathTarget.value)
})

// 可达性分析结果
const analysisResult = computed(() => {
  if (!analysisTarget.value) return null
  return analyzeReachability(analysisTarget.value)
})

// 方法
function addNewMonster() {
  addMonster()
  saveData()
}

function removeMonster(id) {
  removeMonsterFn(id)
  if (selectedMonsterId.value === id) {
    selectedMonsterId.value = null
  }
  if (pathSource.value === id) pathSource.value = null
  if (pathTarget.value === id) pathTarget.value = null
  if (analysisTarget.value === id) analysisTarget.value = null
  saveData()
}

function selectMonster(id) {
  selectedMonsterId.value = selectedMonsterId.value === id ? null : id
}

function clearAll() {
  monsters.value = []
  selectedMonsterId.value = null
  pathSource.value = null
  pathTarget.value = null
  analysisTarget.value = null
  saveData()
}

function saveData() {
  saveMonsters()
}

function getMonsterName(id) {
  const monster = monsters.value.find(m => m.id === id)
  return monster?.name || '未命名'
}

function handleImport() {
  if (!importText.value.trim()) {
    message.warning('请输入 JSON 数据')
    return
  }
  
  const success = importFromJSON(importText.value)
  if (success) {
    saveData()
    showImportModal.value = false
    importText.value = ''
    message.success(`成功导入 ${monsters.value.length} 只怪兽`)
  } else {
    message.error('JSON 格式错误，请检查数据格式')
  }
}

// 初始化
onMounted(() => {
  loadMonsters()
})
</script>

<style scoped>
.monster-input-section {
  padding: 8px;
  background: #fafafa;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
}

.monster-list {
  max-height: 240px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.monster-item {
  padding: 8px;
  background: white;
  border-radius: 6px;
  border: 1px solid #e5e7eb;
  cursor: pointer;
  transition: all 0.2s;
}

.monster-item:hover {
  border-color: #94a3b8;
}

.monster-item.selected {
  border-color: #3b82f6;
  background: #eff6ff;
}

.monster-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.monster-stats {
  font-size: 11px;
}

/* 矩阵视图 */
.matrix-view {
  overflow-x: auto;
}

.matrix-container {
  max-height: 200px;
  overflow: auto;
}

.connection-matrix {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
}

.connection-matrix th,
.connection-matrix td {
  padding: 4px 6px;
  text-align: center;
  border: 1px solid #e5e7eb;
  min-width: 60px;
}

.matrix-header,
.matrix-row-header {
  background: #f3f4f6;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 80px;
}

.matrix-cell.self {
  background: #f3f4f6;
  color: #9ca3af;
}

.matrix-cell.connected {
  background: #dcfce7;
  color: #16a34a;
  font-weight: bold;
}

.matrix-cell.disconnected {
  background: #fee2e2;
  color: #dc2626;
}

.matrix-legend {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed #e5e7eb;
}

.legend-dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 2px;
  margin-right: 4px;
  vertical-align: middle;
}

.legend-dot.connected {
  background: #dcfce7;
  border: 1px solid #16a34a;
}

.legend-dot.disconnected {
  background: #fee2e2;
  border: 1px solid #dc2626;
}

/* 路径视图 */
.bridge-results {
  margin-top: 12px;
  padding: 8px;
  background: #f0fdf4;
  border-radius: 8px;
  border: 1px solid #bbf7d0;
}

.bridge-list {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.bridge-item {
  padding: 8px;
  background: white;
  border-radius: 6px;
  border: 1px solid #86efac;
}

.bridge-name {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}

.bridge-path {
  font-size: 11px;
  color: #64748b;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
}

.path-node {
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 500;
}

.path-node.source {
  background: #dbeafe;
  color: #2563eb;
}

.path-node.bridge {
  background: #dcfce7;
  color: #16a34a;
}

.path-node.target {
  background: #fef3c7;
  color: #d97706;
}

.path-arrow {
  color: #9ca3af;
}

.path-match {
  color: #6b7280;
  font-size: 10px;
}

/* 分析视图 */
.analysis-results {
  margin-top: 8px;
}

.reachable-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.reachable-item {
  padding: 6px 8px;
  border-radius: 4px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
}

.reachable-item.direct {
  background: #dcfce7;
}

.reachable-item.bridge {
  background: #fef3c7;
}

.reachable-item.unreachable {
  background: #fee2e2;
}
</style>


<template>
  <div class="card-input-container">
    <div class="card-input-header">
      <n-space :size="8" align="center">
        <n-text depth="3" style="font-size: 12px;">共 {{ deck.cards.value.length }} 类卡</n-text>
        <n-button id="import-deck-btn" size="tiny" quaternary @click="openYdkImport">
          导入卡组
        </n-button>
      </n-space>
    </div>
    <n-grid cols="5" :x-gap="6" :y-gap="6">
      <n-grid-item v-for="card in deck.cards.value" :key="card.id">
        <div class="card-item-box" :class="{ 'has-card-image': card.cardId }">
          <!-- 卡图背景 -->
          <div v-if="card.cardId" class="card-bg-image">
            <img 
              :src="getCardImageUrl(card.cardId)"
              :alt="card.name"
              loading="lazy"
            />
          </div>
          <div class="card-item-content">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
              <n-text strong style="font-size: 11px; color: #64748b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">{{ card.label }}类卡</n-text>
              <n-badge :value="card.count" :type="card.count > 0 ? 'info' : 'default'" :dot="false" size="small" />
            </div>
            <n-space vertical :size="2">
              <div style="display: flex; gap: 2px;">
                <n-input-number
                  v-model:value="card.count"
                  :min="0"
                  :max="60"
                  size="tiny"
                  placeholder="数量"
                  :show-button="false"
                  style="flex: 1"
                  @update:value="handleCardCountChange"
                />
                <n-tooltip trigger="hover">
                  <template #trigger>
                    <n-input-number
                      v-model:value="card.maxCount"
                      :min="1"
                      :max="60"
                      size="tiny"
                      placeholder="3"
                      :show-button="false"
                      style="width: 36px"
                      :class="{ 'max-count-set': card.maxCount !== null }"
                    />
                  </template>
                  最大上限（不填默认3张）
                </n-tooltip>
              </div>
              <n-input
                v-model:value="card.name"
                size="tiny"
                placeholder="卡名"
                style="width: 100%"
                @update:value="() => handleCardNameChange(card)"
              />
            </n-space>
          </div>
        </div>
      </n-grid-item>
    </n-grid>
    
    <!-- 卡组导入弹窗 -->
    <n-modal 
      v-model:show="showYdkImportModal" 
      preset="card" 
      title="导入卡组"
      style="width: 650px; max-width: 90vw;"
      :mask-closable="false"
    >
      <!-- 步骤 1: 选择文件 -->
      <div v-if="ydkImportStep === 1">
        <n-space vertical :size="16">
          <n-alert type="info" :show-icon="true">
            <template #header>支持多种导入格式</template>
            <div style="font-size: 12px;">
              YDK 文件 / YDK 文本 / YDKE URL / Base64 编码 / YGOMobile URL
            </div>
          </n-alert>
          
          <!-- 导入格式选择 -->
          <div>
            <n-text depth="2" style="font-size: 12px; font-weight: 500; display: block; margin-bottom: 8px;">
              选择导入格式
            </n-text>
            <n-radio-group v-model:value="importFormat" size="small">
              <n-radio-button value="ydk">YDK 文件/文本</n-radio-button>
              <n-radio-button value="ydke">YDKE URL</n-radio-button>
              <n-radio-button value="base64">Base64 编码</n-radio-button>
              <n-radio-button value="ygomobile">YGOMobile URL</n-radio-button>
            </n-radio-group>
          </div>
          
          <!-- YDK 文件上传 (仅 YDK 格式) -->
          <div v-if="importFormat === 'ydk'">
            <n-text depth="2" style="font-size: 12px; font-weight: 500; display: block; margin-bottom: 8px;">
              YDK 文件
            </n-text>
            <n-upload
              accept=".ydk"
              :max="1"
              :default-upload="false"
              @change="handleYdkFileChange"
            >
              <n-button>选择 YDK 文件</n-button>
            </n-upload>
          </div>
          
          <!-- 输入区域 -->
          <div>
            <n-text depth="2" style="font-size: 12px; font-weight: 500; display: block; margin-bottom: 8px;">
              {{ importFormatLabels[importFormat] }}
            </n-text>
            <n-input
              v-model:value="ydkContent"
              type="textarea"
              :placeholder="importFormatPlaceholders[importFormat]"
              :rows="6"
            />
          </div>
          
          <!-- CDB 文件（可选） -->
          <div>
            <n-text depth="2" style="font-size: 12px; font-weight: 500; display: block; margin-bottom: 8px;">
              cards.cdb 数据库（可选，默认使用内置数据库）
            </n-text>
            <n-upload
              accept=".cdb"
              :max="1"
              :default-upload="false"
              @change="handleCdbFileChange"
            >
              <n-button secondary>选择 cards.cdb</n-button>
            </n-upload>
            <n-text v-if="isDbLoaded" depth="3" style="font-size: 11px; margin-top: 4px; display: block;">
              ✓ 数据库已加载
            </n-text>
          </div>
          
          <n-space justify="end">
            <n-button @click="closeYdkImport">取消</n-button>
            <n-button 
              type="primary" 
              @click="parseAndLoadYdk"
              :loading="isImporting || isDbLoading"
              :disabled="!ydkContent.trim()"
            >
              解析卡组
            </n-button>
          </n-space>
        </n-space>
      </div>
      
      <!-- 步骤 2: 预览确认 -->
      <div v-else-if="ydkImportStep === 2">
        <n-space vertical :size="16">
          <n-alert type="success" :show-icon="true">
            <template #header>解析成功</template>
            <div style="font-size: 12px;">
              主卡组: {{ parsedYdk?.main?.length || 0 }} 张 | 
              额外卡组: {{ parsedYdk?.extra?.length || 0 }} 张 | 
              副卡组: {{ parsedYdk?.side?.length || 0 }} 张
              <br>
              共解析出 <strong>{{ importedCards.length }}</strong> 种卡牌
            </div>
          </n-alert>
          
          <!-- 卡牌预览列表 -->
          <div class="card-preview-list">
            <n-text depth="2" style="font-size: 12px; font-weight: 500; display: block; margin-bottom: 8px;">
              将导入以下卡牌：
            </n-text>
            <div class="preview-scroll">
              <div 
                v-for="(card, index) in importedCards" 
                :key="index"
                class="preview-card-item"
              >
                <img 
                  :src="getCardImageUrl(card.id)"
                  :alt="card.name"
                  class="preview-card-image"
                  loading="lazy"
                />
                <div class="preview-card-info">
                  <div class="preview-card-name">
                    {{ card.name }}
                    <n-tag size="tiny" :type="card.isMonster ? 'warning' : card.isSpell ? 'success' : 'error'">
                      {{ card.isMonster ? '怪兽' : card.isSpell ? '魔法' : '陷阱' }}
                    </n-tag>
                  </div>
                </div>
                <div class="preview-card-count">
                  ×{{ card.count }}
                </div>
              </div>
            </div>
          </div>
          
          <n-alert v-if="importedCards.length > 30" type="warning" :show-icon="true">
            卡牌种类超过 30 种，将只导入前 30 种卡牌。
          </n-alert>
          
          <n-space justify="end">
            <n-button @click="ydkImportStep = 1">返回</n-button>
            <n-button @click="closeYdkImport">取消</n-button>
            <n-button 
              type="primary" 
              @click="confirmYdkImport"
              :disabled="importedCards.length === 0"
            >
              确认导入 ({{ Math.min(importedCards.length, 30) }})
            </n-button>
          </n-space>
        </n-space>
      </div>
    </n-modal>
  </div>
</template>

<style scoped>
.card-input-container {
  width: 100%;
}

.card-input-header {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 8px;
}

.card-item-box {
  padding: 4px 6px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  background: #f8fafc;
  transition: all 0.2s ease;
  position: relative;
  overflow: hidden;
}

.card-item-box.has-card-image {
  min-height: 90px;
}

.card-bg-image {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
  opacity: 0.15;
  pointer-events: none;
}

.card-bg-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.card-item-content {
  position: relative;
  z-index: 1;
}

.card-item-box:hover {
  border-color: #cbd5e1;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
}

.card-item-box.has-card-image:hover {
  border-color: #3b82f6;
}

.card-item-box.has-card-image:hover .card-bg-image {
  opacity: 0.25;
}
.max-count-set :deep(.n-input__input-el) {
  color: #f59e0b;
  font-weight: 600;
}

/* 移动端响应式 */
@media screen and (max-width: 640px) {
  .card-item-box {
    padding: 6px 8px;
  }
}

/* YDK 导入预览 */
.card-preview-list {
  max-height: 350px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.preview-scroll {
  overflow-y: auto;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-right: 4px;
}

.preview-card-item {
  padding: 6px 12px 6px 6px;
  background: #f8fafc;
  border-radius: 6px;
  border: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  gap: 10px;
}

.preview-card-image {
  width: 40px;
  height: 58px;
  object-fit: cover;
  border-radius: 4px;
  flex-shrink: 0;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.preview-card-info {
  flex: 1;
  min-width: 0;
}

.preview-card-name {
  font-size: 13px;
  font-weight: 500;
  color: #1e293b;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.preview-card-count {
  font-size: 16px;
  font-weight: 700;
  color: #3b82f6;
  flex-shrink: 0;
}
</style>

<script setup>
import { ref, inject, watch, onMounted } from 'vue'
import { 
  NCard, NGrid, NGridItem, NSpace, NText, NInputNumber, NInput, 
  NBadge, NTooltip, NButton, NModal, NUpload, NAlert, NTag,
  NRadioGroup, NRadioButton, useMessage 
} from 'naive-ui'
import { useCardDatabase, parseYdkContent } from '../composables/useCardDatabase'
import YGOProDeck from 'ygopro-deck-encode'

const deck = inject('deck')
const message = useMessage()

// 卡片数据库
const {
  isLoading: isDbLoading,
  isLoaded: isDbLoaded,
  error: dbError,
  loadDatabase,
  loadDefaultDatabase,
  getCardsByIds,
  getCardByName
} = useCardDatabase()

// 自动加载数据库
onMounted(async () => {
  if (!isDbLoaded.value) {
    await loadDefaultDatabase()
  }
})

// 防抖定时器
const debounceTimers = new Map()

// 处理卡名变化，匹配数据库中的卡牌
function handleCardNameChange(card) {
  // 清除之前的定时器
  if (debounceTimers.has(card.id)) {
    clearTimeout(debounceTimers.get(card.id))
  }
  
  // 设置新的定时器（防抖 300ms）
  const timer = setTimeout(async () => {
    const cardName = card.name?.trim()
    
    if (!cardName) {
      // 卡名为空，清除 cardId
      card.cardId = null
      return
    }
    
    // 确保数据库已加载
    if (!isDbLoaded.value) {
      await loadDefaultDatabase()
    }
    
    if (!isDbLoaded.value) {
      return
    }
    
    // 查询数据库
    const matchedCard = getCardByName(cardName)
    
    if (matchedCard) {
      // 匹配成功，设置 cardId
      card.cardId = matchedCard.id
    } else {
      // 匹配失败，清除 cardId
      card.cardId = null
    }
    
    debounceTimers.delete(card.id)
  }, 300)
  
  debounceTimers.set(card.id, timer)
}

// YDK 导入状态
const showYdkImportModal = ref(false)
const ydkImportStep = ref(1)
const ydkContent = ref('')
const parsedYdk = ref(null)
const importedCards = ref([])
const isImporting = ref(false)
const cdbFile = ref(null)

// 导入格式
const importFormat = ref('ydk')
const importFormatLabels = {
  ydk: '或直接粘贴 YDK 内容',
  ydke: '粘贴 YDKE URL',
  base64: '粘贴 Base64 编码',
  ygomobile: '粘贴 YGOMobile URL'
}
const importFormatPlaceholders = {
  ydk: `#created by ...
#main
94145021
94145021
...`,
  ydke: 'ydke://...',
  base64: 'Base64 编码字符串...',
  ygomobile: 'YGOMobile deck URL...'
}

function handleCardCountChange() {
  // 触发饼图更新（通过computed自动更新）
}

// 获取卡牌图片 URL（使用本地 pics 文件夹）
function getCardImageUrl(cardId) {
  if (!cardId) return ''
  const basePath = import.meta.env.BASE_URL || '/'
  return `${basePath}pics/${cardId}.jpg`
}

// 卡组导入相关方法
function openYdkImport() {
  showYdkImportModal.value = true
  ydkImportStep.value = 1
  ydkContent.value = ''
  parsedYdk.value = null
  importedCards.value = []
  importFormat.value = 'ydk'
}

function closeYdkImport() {
  showYdkImportModal.value = false
  ydkImportStep.value = 1
  ydkContent.value = ''
  parsedYdk.value = null
  importedCards.value = []
  importFormat.value = 'ydk'
}

// 处理 YDK 文件上传
function handleYdkFileChange(options) {
  const file = options.file?.file
  if (file) {
    const reader = new FileReader()
    reader.onload = (e) => {
      ydkContent.value = e.target?.result || ''
    }
    reader.readAsText(file)
  }
}

// 处理 CDB 文件上传
function handleCdbFileChange(options) {
  cdbFile.value = options.file?.file || null
}

// 解析卡组并查询卡片信息
async function parseAndLoadYdk() {
  if (!ydkContent.value.trim()) {
    message.warning('请先输入卡组数据')
    return
  }
  
  isImporting.value = true
  
  try {
    // 根据格式解析卡组
    let deckData
    const content = ydkContent.value.trim()
    
    try {
      switch (importFormat.value) {
        case 'ydk':
          // 使用原有的 YDK 解析
          deckData = parseYdkContent(content)
          break
        case 'ydke':
          // YDKE URL 格式
          deckData = YGOProDeck.fromYdkeURL(content)
          break
        case 'base64':
          // Base64 编码格式
          deckData = YGOProDeck.fromEncodedString(content)
          break
        case 'ygomobile':
          // YGOMobile URL 格式
          deckData = YGOProDeck.fromYGOMobileDeckURL(content)
          break
        default:
          throw new Error('未知的导入格式')
      }
    } catch (parseError) {
      message.error('解析失败: ' + parseError.message)
      isImporting.value = false
      return
    }
    
    parsedYdk.value = deckData
    
    // 只导入主卡组
    const mainIds = deckData.main
    
    if (!mainIds || mainIds.length === 0) {
      message.warning('卡组中没有找到主卡组卡片')
      isImporting.value = false
      return
    }
    
    // 加载数据库
    if (cdbFile.value) {
      const loaded = await loadDatabase(cdbFile.value)
      if (!loaded) {
        message.error('加载数据库失败: ' + (dbError.value || '未知错误'))
        isImporting.value = false
        return
      }
    } else if (!isDbLoaded.value) {
      const loaded = await loadDefaultDatabase()
      if (!loaded) {
        message.error('加载默认数据库失败，请上传 cards.cdb 文件')
        isImporting.value = false
        return
      }
    }
    
    // 查询卡片信息
    const cardMap = getCardsByIds(mainIds)
    
    // 统计每种卡的数量
    const countMap = new Map()
    for (const id of mainIds) {
      countMap.set(id, (countMap.get(id) || 0) + 1)
    }
    
    // 构建导入列表
    const cards = []
    for (const [id, count] of countMap) {
      const card = cardMap.get(id)
      if (card) {
        cards.push({
          id,
          name: card.name,
          count,
          isMonster: card.isMonster,
          isSpell: card.isSpell,
          isTrap: card.isTrap
        })
      } else {
        cards.push({
          id,
          name: `未知卡片 #${id}`,
          count,
          isMonster: false,
          isSpell: false,
          isTrap: false
        })
      }
    }
    
    // 按数量降序排列
    cards.sort((a, b) => b.count - a.count)
    
    importedCards.value = cards
    
    if (cards.length === 0) {
      message.warning('没有解析到任何卡片信息')
    } else {
      ydkImportStep.value = 2
    }
  } catch (e) {
    console.error('解析 YDK 失败:', e)
    message.error('解析 YDK 失败: ' + e.message)
  } finally {
    isImporting.value = false
  }
}

// 确认导入卡牌
function confirmYdkImport() {
  if (importedCards.value.length === 0) {
    message.warning('没有可导入的卡牌')
    return
  }
  
  // 先清空现有配置
  deck.cards.value.forEach(card => {
    card.count = 0
    card.name = ''
    card.maxCount = null
    card.cardId = null
  })
  
  // 导入卡牌（最多30种）
  const cardsToImport = importedCards.value.slice(0, 30)
  
  cardsToImport.forEach((card, index) => {
    deck.cards.value[index].name = card.name
    deck.cards.value[index].count = card.count
    deck.cards.value[index].cardId = card.id // 保存 YGOPro 卡片 ID
  })
  
  message.success(`成功导入 ${cardsToImport.length} 种卡牌`)
  closeYdkImport()
}
</script>

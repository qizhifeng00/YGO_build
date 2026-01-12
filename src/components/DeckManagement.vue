<template>
  <n-card size="small">
    <div style="display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap;">
      <div style="display: flex; align-items: center; gap: 12px; flex: 1; min-width: 300px;">
        <n-text strong style="white-space: nowrap; color: #475569;">卡组档案</n-text>
        <n-select
          v-model:value="deck.selectedDeckId.value"
          :options="deckOptions"
          placeholder="选择已有卡组"
          style="width: 200px"
          size="small"
        />
        <n-input
          v-model:value="deck.deckName.value"
          placeholder="当前卡组名称"
          style="flex: 1; max-width: 240px"
          size="small"
        />
      </div>
      
      <n-space :size="8">
        <n-button type="primary" size="small" secondary @click="handleSave">
          <template #icon>
            <div style="font-size: 14px;">💾</div>
          </template>
          保存
        </n-button>
        <n-button type="info" size="small" secondary @click="handleLoad">
          <template #icon>
            <div style="font-size: 14px;">📂</div>
          </template>
          加载
        </n-button>
        <n-button type="error" size="small" ghost @click="handleDelete">
          删除
        </n-button>
      </n-space>
    </div>
  </n-card>
</template>

<script setup>
import { computed, inject } from 'vue'
import { NCard, NSpace, NGrid, NGridItem, NSelect, NInput, NButton, useMessage, useDialog } from 'naive-ui'

const message = useMessage()
const dialog = useDialog()

const deck = inject('deck')
const condition = inject('condition')
const conditionMode = inject('conditionMode')
const builderData = inject('builderData')

const deckOptions = computed(() => {
  return [
    { label: '-- 选择卡组 --', value: null },
    ...deck.deckList.value.map(d => ({
      label: d.name,
      value: d.id
    }))
  ]
})

function handleSave() {
  try {
    const savedDeck = deck.saveDeck(
      condition.value,
      conditionMode.value,
      builderData.value
    )
    
    // 检查是否覆盖
    const existingDeck = deck.deckList.value.find(d => d.name === savedDeck.name && d.id !== savedDeck.id)
    if (existingDeck) {
      message.warning(`已覆盖同名卡组 "${savedDeck.name}"`)
    } else {
      message.success('卡组保存成功！')
    }
  } catch (error) {
    message.error(error.message)
  }
}

function handleLoad() {
  if (!deck.selectedDeckId.value) {
    message.warning('请先选择一个卡组')
    return
  }

  try {
    const loadedData = deck.loadDeck(deck.selectedDeckId.value)
    
    // 更新条件相关状态
    condition.value = loadedData.condition
    conditionMode.value = loadedData.conditionInputMode
    builderData.value = loadedData.builderConditionData
    
    message.success('卡组加载成功！')
  } catch (error) {
    message.error(error.message)
  }
}

function handleDelete() {
  if (!deck.selectedDeckId.value) {
    message.warning('请先选择一个卡组')
    return
  }

  dialog.warning({
    title: '确认删除',
    content: '确认删除选中的卡组吗？',
    positiveText: '确定',
    negativeText: '取消',
    onPositiveClick: () => {
      try {
        deck.deleteDeck(deck.selectedDeckId.value)
        deck.selectedDeckId.value = null
        message.success('卡组删除成功！')
      } catch (error) {
        message.error(error.message)
      }
    }
  })
}
</script>


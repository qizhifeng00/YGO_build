<template>
  <n-card title="决斗参数" size="small" :segmented="{ content: true }">
    <n-space vertical :size="6">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <n-text depth="3" style="font-size: 12px;">卡组总数</n-text>
        <n-input-number
          :value="deck.totalCards.value"
          readonly
          :show-button="false"
          size="tiny"
          style="width: 70px"
        />
      </div>
      
      <n-divider style="margin: 2px 0;" />

      <div style="display: flex; flex-direction: column; gap: 4px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <n-text depth="3" style="font-size: 12px;">起手抽卡数</n-text>
          <n-checkbox v-model:checked="autoIncrementDraws" size="small">
            <n-text depth="3" style="font-size: 11px;">+1</n-text>
          </n-checkbox>
        </div>
        <n-input-number
          v-model:value="draws"
          :min="1"
          :max="deck.totalCards.value"
          size="small"
          style="width: 100%"
        />
      </div>
    </n-space>
  </n-card>
</template>

<script setup>
import { inject } from 'vue'
import { NCard, NSpace, NInputNumber, NCheckbox, NText, NDivider } from 'naive-ui'

const deck = inject('deck')
const draws = inject('draws')
const autoIncrementDraws = inject('autoIncrementDraws')
</script>


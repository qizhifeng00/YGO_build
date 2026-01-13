<template>
  <n-card title="🎲 名推理计算器" size="small">
    <template #header-extra>
      <n-tooltip trigger="hover">
        <template #trigger>
          <n-text depth="3" style="font-size: 11px; cursor: help;">公式说明</n-text>
        </template>
        <div style="max-width: 280px;">
          <p style="margin: 0 0 8px 0;"><strong>名推理 (Reasoning)</strong></p>
          <p style="margin: 0 0 4px 0;">从卡组顶翻开直到出现可召唤的怪兽</p>
          <p style="margin: 0;">平均翻卡数 = (魔陷数+1) / (怪兽数+1)</p>
        </div>
      </n-tooltip>
    </template>
    
    <n-space vertical :size="12">
      <n-grid :cols="2" :x-gap="12">
        <n-grid-item>
          <n-space vertical :size="4">
            <n-text depth="3" style="font-size: 11px;">卡组剩余张数</n-text>
            <n-input-number
              v-model:value="deckRemaining"
              :min="1"
              :max="60"
              size="small"
              placeholder="40"
              style="width: 100%"
            />
          </n-space>
        </n-grid-item>
        <n-grid-item>
          <n-space vertical :size="4">
            <n-text depth="3" style="font-size: 11px;">可召唤怪兽数量</n-text>
            <n-input-number
              v-model:value="monsterCount"
              :min="0"
              :max="60"
              size="small"
              placeholder="2"
              style="width: 100%"
            />
          </n-space>
        </n-grid-item>
      </n-grid>
      
      <div class="result-box">
        <n-space justify="space-between" align="center">
          <n-space vertical :size="2">
            <n-text depth="3" style="font-size: 10px;">魔法/陷阱</n-text>
            <n-text strong style="font-size: 14px; color: #3b82f6;">{{ spellTrapCount }}</n-text>
          </n-space>
          <div class="formula-display">
            <n-text depth="2" style="font-size: 11px;">
              ({{ spellTrapCount }} + 1) / ({{ monsterCount }} + 1)
            </n-text>
          </div>
          <n-space vertical :size="2" align="end">
            <n-text depth="3" style="font-size: 10px;">平均翻卡数</n-text>
            <n-text strong style="font-size: 18px; color: #10b981;">{{ averageFlips }}</n-text>
          </n-space>
        </n-space>
      </div>
      
      <n-alert type="info" :show-icon="false" style="font-size: 11px; padding: 6px 10px;">
        <n-text depth="2">
          期望能翻开 <strong style="color: #10b981;">{{ averageFlips }}</strong> 张卡送入墓地
        </n-text>
      </n-alert>
    </n-space>
  </n-card>
</template>

<script setup>
import { ref, computed } from 'vue'
import { NCard, NSpace, NGrid, NGridItem, NInputNumber, NText, NTooltip, NAlert } from 'naive-ui'

const deckRemaining = ref(40)
const monsterCount = ref(2)

const spellTrapCount = computed(() => {
  return Math.max(0, deckRemaining.value - monsterCount.value)
})

const averageFlips = computed(() => {
  const spellTrap = spellTrapCount.value
  const monster = monsterCount.value
  const result = (spellTrap + 1) / (monster + 1)
  return result.toFixed(2)
})
</script>

<style scoped>
.result-box {
  padding: 12px;
  background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
  border-radius: 8px;
  border: 1px solid #bae6fd;
}

.formula-display {
  padding: 4px 8px;
  background: rgba(255, 255, 255, 0.7);
  border-radius: 4px;
  font-family: 'Consolas', 'Monaco', monospace;
}
</style>


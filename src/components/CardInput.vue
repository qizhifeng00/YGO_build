<template>
  <n-card title="卡牌配置" :segmented="{ content: true }">
    <template #header-extra>
      <n-text depth="3" style="font-size: 12px;">共 {{ deck.cards.value.length }} 类卡</n-text>
    </template>
    <n-grid cols="2 s:4 m:6 l:10 xl:15" :x-gap="4" :y-gap="4" responsive="screen">
      <n-grid-item v-for="card in deck.cards.value" :key="card.id">
        <div class="card-item-box">
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
            />
          </n-space>
        </div>
      </n-grid-item>
    </n-grid>
  </n-card>
</template>

<style scoped>
.card-item-box {
  padding: 4px 6px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  background: #f8fafc;
  transition: all 0.2s ease;
}
.card-item-box:hover {
  border-color: #cbd5e1;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
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
</style>

<script setup>
import { inject } from 'vue'
import { NCard, NGrid, NGridItem, NSpace, NText, NInputNumber, NInput, NBadge, NTooltip } from 'naive-ui'

const deck = inject('deck')

function handleCardCountChange() {
  // 触发饼图更新（通过computed自动更新）
}
</script>


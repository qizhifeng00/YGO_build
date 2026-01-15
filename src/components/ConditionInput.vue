<template>
  <n-card id="condition-input-card" title="逻辑判定" size="small" :segmented="{ content: true }">
    <template #header-extra>
      <n-radio-group v-model:value="localConditionMode" size="small">
        <n-radio-button value="drag">卡牌拖动</n-radio-button>
        <n-radio-button value="manual">手动输入</n-radio-button>
        <n-radio-button value="builder">构建器</n-radio-button>
      </n-radio-group>
    </template>
    
    <n-space vertical :size="12">
      <!-- 卡牌拖动 -->
      <div v-show="localConditionMode === 'drag'">
        <CardDragBuilder
          ref="dragBuilderRef"
          :cards="deck.cards.value"
          @update="handleDragUpdate"
        />
      </div>

      <!-- 手动输入 -->
      <div v-show="localConditionMode === 'manual'">
        <n-input
          v-model:value="localCondition"
          type="textarea"
          :rows="3"
          placeholder="例如：a >= 1 && (b >= 1 || c == 0)"
          style="font-family: monospace; font-size: 13px;"
        />
        <div style="margin-top: 8px; display: flex; gap: 4px; flex-wrap: wrap;">
          <n-tag v-for="op in ['&&', '||', '!', '>=', '==']" :key="op" size="tiny" quaternary @click="localCondition += ' ' + op + ' '" style="cursor: pointer;">
            {{ op }}
          </n-tag>
        </div>
      </div>

      <!-- 条件构建器 -->
      <div v-show="localConditionMode === 'builder'">
        <div class="builder-wrapper">
          <ConditionBuilder
            v-if="builder.builderRootCondition.value"
            :condition="builder.builderRootCondition.value"
            :all-card-names="deck.allCardNames.value"
            @update="handleBuilderUpdate"
          />
        </div>
        
        <div style="margin-top: 12px; padding: 10px; background: #f1f5f9; border-radius: 8px; border: 1px solid #e2e8f0;">
          <n-text depth="3" style="font-size: 12px; display: block; margin-bottom: 4px;">预览：</n-text>
          <n-text code style="word-break: break-all; font-size: 13px;">{{ builder.conditionText.value || '(未生成)' }}</n-text>
        </div>
      </div>

      <!-- 移动端说明 -->
      <n-alert v-if="isMobile" type="info" title="快捷提示" :bordered="false" style="background: transparent; padding: 0;">
        <n-text depth="3" style="font-size: 11px;">
          使用 a-z 或自定义卡名，判断相等请用 ==
        </n-text>
      </n-alert>
    </n-space>
  </n-card>
</template>

<style scoped>
.builder-wrapper {
  max-height: 400px;
  overflow-y: auto;
  padding: 4px;
}
:deep(.n-card-header__title) {
  font-weight: 600;
  color: #1e293b;
}
</style>

<script setup>
import { ref, inject, watch, computed, nextTick } from 'vue'
import { NCard, NSpace, NRadioGroup, NRadioButton, NInput, NText, NAlert, NTag } from 'naive-ui'
import ConditionBuilder from './ConditionBuilder.vue'
import CardDragBuilder from './CardDragBuilder.vue'

const deck = inject('deck')
const builder = inject('builder')
const condition = inject('condition')
const conditionMode = inject('conditionMode')

const localCondition = ref(condition.value)
const localConditionMode = ref(conditionMode.value)
const dragBuilderRef = ref(null)

const isMobile = computed(() => {
  return window.innerWidth <= 1024
})

// 监听模式切换 - 直接切换无需确认
watch(localConditionMode, async (newMode, oldMode) => {
  if (oldMode === newMode) return
  
  // 更新全局模式
  conditionMode.value = newMode
  
  // 等待 DOM 更新（确保组件已渲染）
  await nextTick()
  
  const currentCondition = localCondition.value.trim()

  // 切换到构建器模式
  if (newMode === 'builder') {
    if (!currentCondition) {
      // 无条件时，初始化空的构建器
      builder.initBuilder(deck.allCardNames.value)
    } else {
      // 尝试解析现有条件
      try {
        const parsed = builder.parseManualCondition(currentCondition)
        builder.builderRootCondition.value = parsed
      } catch (error) {
        // 解析失败，初始化空构建器但保留条件文本（用于手动模式）
        console.warn('条件解析失败，初始化空构建器:', error)
        builder.initBuilder(deck.allCardNames.value)
      }
    }
    return
  }

  // 切换到拖动模式
  if (newMode === 'drag') {
    if (!currentCondition) {
      // 无条件时，初始化空的拖动构建器
      if (dragBuilderRef.value) {
        dragBuilderRef.value.clear()
      }
    } else {
      // 尝试导入现有条件到拖动模式
      try {
        const parsed = builder.parseManualCondition(currentCondition)
        const dragStructure = builder.convertToDragStructure(parsed, deck.cards.value)
        if (dragStructure && dragBuilderRef.value) {
          dragBuilderRef.value.importDragStructure(dragStructure)
        } else {
          // 无法转换，初始化空的拖动构建器
          if (dragBuilderRef.value) {
            dragBuilderRef.value.clear()
          }
        }
      } catch (error) {
        console.warn('条件导入失败，初始化空拖动构建器:', error)
        if (dragBuilderRef.value) {
          dragBuilderRef.value.clear()
        }
      }
    }
    return
  }

  // 切换到手动输入模式
  if (newMode === 'manual') {
    if (oldMode === 'builder' && builder.conditionText.value) {
      // 从构建器切换，使用构建器生成的条件
      localCondition.value = builder.conditionText.value
      condition.value = localCondition.value
    }
    // 从拖动模式切换时，条件已经通过 handleDragUpdate 同步了
  }
})

// 同步本地条件到全局
watch(localCondition, (newVal) => {
  condition.value = newVal
})

// 处理构建器更新
function handleBuilderUpdate() {
  localCondition.value = builder.conditionText.value
  condition.value = localCondition.value
}

// 处理卡牌拖动更新
function handleDragUpdate(newCondition) {
  localCondition.value = newCondition
  condition.value = newCondition
}

// 监听外部条件变化
watch(condition, (newVal) => {
  if (newVal !== localCondition.value) {
    localCondition.value = newVal
  }
})

watch(conditionMode, (newVal) => {
  if (newVal !== localConditionMode.value) {
    localConditionMode.value = newVal
  }
})
</script>



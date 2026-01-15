<template>
  <div class="condition-node" :class="`condition-${condition.type}`">
    <!-- 单条件 -->
    <div v-if="condition.type === 'single'" class="single-condition">
      <n-space align="center" :wrap="false">
        <span>抽到</span>
        
        <!-- 卡牌列表 -->
        <n-space v-for="(card, index) in condition.cards" :key="index" align="center" :wrap="false">
          <!-- 运算符 -->
          <n-select
            v-if="index > 0"
            v-model:value="card.operator"
            :options="[
              { label: '+', value: '+' },
              { label: '-', value: '-' },
              { label: '*', value: '*' },
              { label: '/', value: '/' }
            ]"
            style="width: 60px"
            size="small"
            @update:value="emitUpdate"
          />
          
          <!-- 卡牌名称 -->
          <n-select
            v-if="!card.isCustom"
            v-model:value="card.name"
            :options="cardNameOptions"
            style="width: 100px"
            size="small"
            @update:value="emitUpdate"
          />
          <n-input
            v-else
            v-model:value="card.name"
            style="width: 100px"
            size="small"
            placeholder="卡名"
            @update:value="emitUpdate"
          />
          
          <!-- 切换输入方式 -->
          <n-button
            size="tiny"
            @click="toggleCardInputMode(card)"
          >
            {{ card.isCustom ? '📑' : '✏️' }}
          </n-button>
          
          <!-- 删除卡片 -->
          <n-button
            v-if="condition.cards.length > 1"
            size="tiny"
            type="error"
            @click="removeCard(index)"
          >
            ×
          </n-button>
        </n-space>
        
        <!-- 添加卡片 -->
        <n-button size="tiny" type="primary" @click="addCard">
          +
        </n-button>
        
        <span>的数量</span>
        
        <!-- 比较运算符 -->
        <n-select
          v-model:value="condition.symbol"
          :options="operatorOptions"
          style="width: 70px"
          size="small"
          @update:value="emitUpdate"
        />
        
        <!-- 数值 -->
        <n-input
          v-model:value="condition.num"
          style="width: 80px"
          size="small"
          placeholder="数量"
          @update:value="emitUpdate"
        />
        
        <!-- 删除条件 -->
        <n-button
          v-if="!isRoot"
          size="small"
          type="error"
          @click="emit('delete')"
        >
          删除
        </n-button>
      </n-space>
    </div>

    <!-- 组合条件 -->
    <div v-else class="group-condition">
      <n-space vertical>
        <!-- 头部 -->
        <n-space align="center">
          <span>满足以下</span>
          <n-select
            v-model:value="condition.type"
            :options="[
              { label: '全部', value: 'and' },
              { label: '任一', value: 'or' }
            ]"
            style="width: 80px"
            size="small"
            @update:value="emitUpdate"
          />
          <span>条件</span>
          <n-button
            v-if="!isRoot"
            size="small"
            type="error"
            @click="emit('delete')"
          >
            删除
          </n-button>
        </n-space>
        
        <!-- 子条件 -->
        <div class="group-children">
          <n-space vertical>
            <ConditionNode
              v-for="(child, index) in condition.children"
              :key="index"
              :condition="child"
              :all-card-names="allCardNames"
              :is-root="false"
              @update="emitUpdate"
              @delete="removeChild(index)"
            />
            
            <!-- 添加按钮 -->
            <n-space>
              <n-button size="small" @click="addConditionGroup">
                添加条件组
              </n-button>
              <n-button size="small" type="primary" @click="addCondition">
                添加条件
              </n-button>
            </n-space>
          </n-space>
        </div>
      </n-space>
    </div>
  </div>
</template>

<script setup>
import { computed, inject, defineProps, defineEmits } from 'vue'
import { NSpace, NSelect, NInput, NInputNumber, NButton } from 'naive-ui'

const props = defineProps({
  condition: {
    type: Object,
    required: true
  },
  allCardNames: {
    type: Array,
    default: () => []
  },
  isRoot: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update', 'delete'])

const builder = inject('builder')

const cardNameOptions = computed(() => {
  return props.allCardNames.map(name => ({
    label: name,
    value: name
  }))
})

const operatorOptions = [
  { label: '>', value: 'gt' },
  { label: '>=', value: 'gte' },
  { label: '==', value: 'eq' },
  { label: '!=', value: 'neq' },
  { label: '<', value: 'lt' },
  { label: '<=', value: 'lte' }
]

function toggleCardInputMode(card) {
  card.isCustom = !card.isCustom
  emitUpdate()
}

function addCard() {
  props.condition.cards.push({
    name: props.allCardNames[0] || 'a',
    operator: '+',
    isCustom: false
  })
  emitUpdate()
}

function removeCard(index) {
  props.condition.cards.splice(index, 1)
  emitUpdate()
}

function addCondition() {
  const newCondition = builder.createCondition('single', [], props.allCardNames)
  props.condition.children.push(newCondition)
  emitUpdate()
}

function addConditionGroup() {
  const newGroup = builder.createCondition('and', [], props.allCardNames)
  props.condition.children.push(newGroup)
  emitUpdate()
}

function removeChild(index) {
  props.condition.children.splice(index, 1)
  emitUpdate()
}

function emitUpdate() {
  emit('update')
}
</script>

<style scoped>
.condition-node {
  padding: 8px;
  border-radius: 4px;
  background: #fafafa;
}

.condition-single {
  display: flex;
  align-items: center;
  gap: 8px;
}

.group-condition {
  border-left: 3px solid #2563eb;
  padding-left: 12px;
}

.group-children {
  margin-left: 16px;
}
</style>


<template>
  <div class="condition-builder">
    <ConditionNode
      :condition="condition"
      :all-card-names="allCardNames"
      :is-root="true"
      @update="handleUpdate"
      @delete="handleDelete"
    />
  </div>
</template>

<script setup>
import { defineProps, defineEmits } from 'vue'
import ConditionNode from './ConditionNode.vue'

const props = defineProps({
  condition: {
    type: Object,
    required: true
  },
  allCardNames: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['update'])

function handleUpdate() {
  emit('update')
}

function handleDelete() {
  // 根节点不应该被删除
}
</script>

<style scoped>
.condition-builder {
  border: 1px solid #e0e0e0;
  padding: 12px;
  border-radius: 4px;
  overflow-x: auto;
}
</style>


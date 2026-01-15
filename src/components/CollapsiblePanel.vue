<template>
  <div class="collapsible-panel" :class="{ collapsed: !isExpanded }">
    <div class="panel-header" @click="toggle">
      <span class="expand-icon">{{ isExpanded ? '▼' : '▶' }}</span>
      <span class="panel-title">{{ title }}</span>
      <span v-if="badge" class="panel-badge">{{ badge }}</span>
    </div>
    <div class="panel-content" v-show="isExpanded">
      <slot></slot>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  title: {
    type: String,
    required: true
  },
  defaultExpanded: {
    type: Boolean,
    default: true
  },
  badge: {
    type: [String, Number],
    default: null
  }
})

const emit = defineEmits(['toggle'])

const isExpanded = ref(props.defaultExpanded)

watch(() => props.defaultExpanded, (newVal) => {
  isExpanded.value = newVal
})

function toggle() {
  isExpanded.value = !isExpanded.value
  emit('toggle', isExpanded.value)
}

defineExpose({
  expand: () => { isExpanded.value = true },
  collapse: () => { isExpanded.value = false },
  toggle,
  isExpanded
})
</script>

<style scoped>
.collapsible-panel {
  border-bottom: 1px solid #e2e8f0;
}

.collapsible-panel:last-child {
  border-bottom: none;
}

.panel-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  cursor: pointer;
  user-select: none;
  background: #f8fafc;
  transition: background-color 0.15s ease;
}

.panel-header:hover {
  background: #f1f5f9;
}

.expand-icon {
  font-size: 12px;
  color: #64748b;
  width: 14px;
  transition: transform 0.15s ease;
}

.panel-title {
  font-size: 14px;
  font-weight: 600;
  color: #334155;
  letter-spacing: 0.2px;
  flex: 1;
}

.panel-badge {
  font-size: 12px;
  padding: 2px 8px;
  background: #e2e8f0;
  border-radius: 10px;
  color: #64748b;
  font-weight: 500;
}

.panel-content {
  padding: 12px;
  background: #ffffff;
  font-size: 14px;
}

/* 折叠状态下的样式 */
.collapsible-panel.collapsed .panel-header {
  background: transparent;
}

.collapsible-panel.collapsed .panel-header:hover {
  background: #f8fafc;
}
</style>


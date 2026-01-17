<template>
  <div class="layout">
    <!-- 活动栏 - 最左侧图标栏 -->
    <div class="activity-bar">
      <div class="activity-icons">
        <div 
          v-for="(item, index) in sortedActivityItems" 
          :key="item.id"
          class="activity-icon"
          :class="{ 
            active: activePanel === item.id,
            dragging: draggingActivityId === item.id,
            'drag-over': dragOverActivityIndex === index
          }"
          draggable="true"
          @dragstart="onActivityDragStart($event, item, index)"
          @dragend="onActivityDragEnd"
          @dragover.prevent="onActivityDragOver(index)"
          @drop.prevent="onActivityDrop(index)"
          @click="togglePanel(item.id)"
          :title="item.title"
        >
          <span class="icon">{{ item.icon }}</span>
          <div v-if="activePanel === item.id" class="active-indicator"></div>
        </div>
      </div>
      <div class="activity-bottom">
        <div 
          class="activity-icon"
          :class="{ active: activePanel === 'settings' }"
          @click="togglePanel('settings')"
          title="设置"
        >
          <span class="icon">⚙️</span>
          <div v-if="activePanel === 'settings'" class="active-indicator"></div>
        </div>
      </div>
    </div>

    <!-- 侧边栏 - 可折叠的内容面板 -->
    <div 
      ref="sidebarRef"
      class="sidebar" 
      :class="{ collapsed: sidebarCollapsed, resizing: isResizing }"
    >
      <div class="sidebar-content" v-show="!sidebarCollapsed">
        <div class="sidebar-header">
          <span class="sidebar-title">{{ currentPanelTitle }}</span>
          <div class="sidebar-header-actions">
            <button 
              v-if="canResetOrder" 
              class="header-btn" 
              @click="resetPanelOrder" 
              title="重置面板顺序"
            >
              <span>↺</span>
            </button>
            <button class="header-btn collapse-btn" @click="collapseSidebar" title="折叠侧边栏">
              <span>◀</span>
            </button>
          </div>
        </div>
        
        <div class="sidebar-panels">
          <!-- 卡组管理面板（含卡牌配置） -->
          <div v-show="activePanel === 'deck'" class="panel-container">
            <template v-for="panel in sortedDeckPanels" :key="panel.id">
              <div class="panel-item">
                <slot :name="panel.slot"></slot>
              </div>
            </template>
          </div>

          <!-- 辅助工具面板 -->
          <div v-show="activePanel === 'tools'" class="panel-container">
            <template v-for="panel in sortedToolsPanels" :key="panel.id">
              <div class="panel-item">
                <slot :name="panel.slot"></slot>
              </div>
            </template>
          </div>

          <!-- 设置面板 -->
          <div v-show="activePanel === 'settings'" class="panel-container">
            <slot name="settings"></slot>
          </div>
        </div>
      </div>

      <!-- 拖动调整宽度的手柄 - 支持 mouse 和 pointer 事件 -->
      <div 
        v-show="!sidebarCollapsed"
        class="resize-handle"
        @mousedown="startResize"
        @pointerdown="startResize"
      ></div>
    </div>

    <!-- 主内容区 -->
    <div class="main-content">
      <slot name="main"></slot>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  defaultWidth: {
    type: Number,
    default: 380
  },
  minWidth: {
    type: Number,
    default: 280
  },
  maxWidth: {
    type: Number,
    default: 700
  }
})

const emit = defineEmits(['panel-change', 'resize'])

// 活动栏菜单项（默认顺序）- 移除条件构建
const defaultActivityItems = [
  { id: 'deck', icon: '📁', title: '卡组管理' },
  { id: 'tools', icon: '🛠️', title: '辅助工具' },
]

// 卡组面板子项（默认顺序）
const defaultDeckPanels = [
  { id: 'deck-management', slot: 'deck-management' },
  { id: 'draw-settings', slot: 'draw-settings' },
  { id: 'card-input', slot: 'card-input' },
  { id: 'deck-pie', slot: 'deck-pie' },
]

// 工具面板子项（默认顺序）
const defaultToolsPanels = [
  { id: 'small-world', slot: 'small-world' },
  { id: 'reasoning', slot: 'reasoning' },
  { id: 'optimizer', slot: 'optimizer' },
  { id: 'replay', slot: 'replay' },
]

// 活动栏顺序
const activityItemsOrder = ref([...defaultActivityItems.map(i => i.id)])
const deckPanelsOrder = ref([...defaultDeckPanels.map(p => p.id)])
const toolsPanelsOrder = ref([...defaultToolsPanels.map(p => p.id)])

// 排序后的活动栏项目
const sortedActivityItems = computed(() => {
  return activityItemsOrder.value
    .map(id => defaultActivityItems.find(item => item.id === id))
    .filter(Boolean)
})

// 排序后的卡组面板
const sortedDeckPanels = computed(() => {
  return deckPanelsOrder.value
    .map(id => defaultDeckPanels.find(p => p.id === id))
    .filter(Boolean)
})

// 排序后的工具面板
const sortedToolsPanels = computed(() => {
  return toolsPanelsOrder.value
    .map(id => defaultToolsPanels.find(p => p.id === id))
    .filter(Boolean)
})

// 是否可以重置顺序
const canResetOrder = computed(() => {
  const defaultActivityOrder = defaultActivityItems.map(i => i.id).join(',')
  const defaultDeckOrder = defaultDeckPanels.map(p => p.id).join(',')
  const defaultToolsOrder = defaultToolsPanels.map(p => p.id).join(',')
  
  return activityItemsOrder.value.join(',') !== defaultActivityOrder ||
         deckPanelsOrder.value.join(',') !== defaultDeckOrder ||
         toolsPanelsOrder.value.join(',') !== defaultToolsOrder
})

// 当前激活的面板
const activePanel = ref('deck')
const sidebarCollapsed = ref(false)
const sidebarWidth = ref(props.defaultWidth)
const sidebarRef = ref(null)

// 当前面板标题
const currentPanelTitle = computed(() => {
  if (activePanel.value === 'settings') return '设置'
  const item = defaultActivityItems.find(i => i.id === activePanel.value)
  return item ? item.title : ''
})

// ===== 活动栏拖拽逻辑（Edge 兼容优化）=====
const draggingActivityId = ref(null)
const dragOverActivityIndex = ref(null)
let dragActivitySourceIndex = null

function onActivityDragStart(e, item, index) {
  draggingActivityId.value = item.id
  dragActivitySourceIndex = index
  
  // Edge 兼容：设置基本的拖拽数据
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', item.id)
    
    // Edge/Chrome 兼容的拖拽图像处理
    try {
      const rect = e.target.getBoundingClientRect()
      const offsetX = e.clientX - rect.left
      const offsetY = e.clientY - rect.top
      e.dataTransfer.setDragImage(e.target, offsetX, offsetY)
    } catch (err) {
      // 某些浏览器可能不支持 setDragImage，忽略错误
    }
  }
}

function onActivityDragEnd() {
  draggingActivityId.value = null
  dragOverActivityIndex.value = null
  dragActivitySourceIndex = null
}

function onActivityDragOver(index) {
  if (draggingActivityId.value && dragOverActivityIndex.value !== index) {
    dragOverActivityIndex.value = index
  }
}

function onActivityDrop(targetIndex) {
  if (draggingActivityId.value !== null && dragActivitySourceIndex !== null && dragActivitySourceIndex !== targetIndex) {
    const newOrder = [...activityItemsOrder.value]
    const [removed] = newOrder.splice(dragActivitySourceIndex, 1)
    newOrder.splice(targetIndex, 0, removed)
    activityItemsOrder.value = newOrder
    saveState()
  }
  draggingActivityId.value = null
  dragOverActivityIndex.value = null
  dragActivitySourceIndex = null
}

// ===== 面板拖拽逻辑（Edge 兼容优化）=====
const draggingPanelId = ref(null)
const dragOverPanelId = ref(null)
let draggingPanelGroup = null

function onPanelDragStart(e, panel, group) {
  draggingPanelId.value = panel.id
  draggingPanelGroup = group
  
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', panel.id)
  }
}

function onPanelDragEnd() {
  draggingPanelId.value = null
  dragOverPanelId.value = null
  draggingPanelGroup = null
}

function onPanelDragOver(panel) {
  if (draggingPanelId.value && draggingPanelId.value !== panel.id) {
    dragOverPanelId.value = panel.id
  }
}

function onPanelDrop(targetPanel, group) {
  if (!draggingPanelId.value || draggingPanelId.value === targetPanel.id || draggingPanelGroup !== group) {
    onPanelDragEnd()
    return
  }
  
  const orderRef = group === 'deck' ? deckPanelsOrder : toolsPanelsOrder
  const sourceIndex = orderRef.value.indexOf(draggingPanelId.value)
  const targetIndex = orderRef.value.indexOf(targetPanel.id)
  
  if (sourceIndex !== -1 && targetIndex !== -1) {
    const newOrder = [...orderRef.value]
    const [removed] = newOrder.splice(sourceIndex, 1)
    newOrder.splice(targetIndex, 0, removed)
    orderRef.value = newOrder
    saveState()
  }
  
  onPanelDragEnd()
}

// 重置面板顺序
function resetPanelOrder() {
  activityItemsOrder.value = [...defaultActivityItems.map(i => i.id)]
  deckPanelsOrder.value = [...defaultDeckPanels.map(p => p.id)]
  toolsPanelsOrder.value = [...defaultToolsPanels.map(p => p.id)]
  saveState()
}

// 切换面板
function togglePanel(panelId) {
  if (activePanel.value === panelId && !sidebarCollapsed.value) {
    sidebarCollapsed.value = true
  } else {
    activePanel.value = panelId
    sidebarCollapsed.value = false
  }
  emit('panel-change', panelId)
}

// 展开面板（不切换，只展开）
function expandPanel(panelId) {
  activePanel.value = panelId
  sidebarCollapsed.value = false
  emit('panel-change', panelId)
}

// 折叠侧边栏
function collapseSidebar() {
  sidebarCollapsed.value = true
}

// ===== 拖动调整宽度（高性能版 - 支持 Edge）=====
const isResizing = ref(false)
let startX = 0
let startWidth = 0
let currentWidth = props.defaultWidth

function startResize(e) {
  // 防止重复触发
  if (isResizing.value) return
  
  e.preventDefault()
  e.stopPropagation()
  
  isResizing.value = true
  startX = e.clientX || (e.touches && e.touches[0].clientX) || 0
  startWidth = sidebarWidth.value
  currentWidth = startWidth
  
  // 直接设置初始宽度，禁用过渡
  if (sidebarRef.value) {
    sidebarRef.value.style.width = startWidth + 'px'
  }
  
  // 使用 pointer 事件优先（Edge 更好支持），回退到 mouse 事件
  if (window.PointerEvent) {
    document.addEventListener('pointermove', doResize, { passive: false })
    document.addEventListener('pointerup', stopResize)
    document.addEventListener('pointercancel', stopResize)
  } else {
    document.addEventListener('mousemove', doResize, { passive: false })
    document.addEventListener('mouseup', stopResize)
  }
  
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
  document.body.style.webkitUserSelect = 'none'
  document.body.style.msUserSelect = 'none'
}

function doResize(e) {
  if (!isResizing.value) return
  
  e.preventDefault()
  
  const clientX = e.clientX || (e.touches && e.touches[0].clientX) || 0
  const diff = clientX - startX
  let newWidth = startWidth + diff
  newWidth = Math.max(props.minWidth, Math.min(props.maxWidth, newWidth))
  
  // 直接操作 DOM，跳过 Vue 响应式以获得最佳性能
  if (sidebarRef.value && newWidth !== currentWidth) {
    currentWidth = newWidth
    sidebarRef.value.style.width = newWidth + 'px'
  }
}

function stopResize() {
  if (!isResizing.value) return
  
  isResizing.value = false
  
  // 同步最终宽度到响应式变量
  sidebarWidth.value = currentWidth
  
  // 移除事件监听
  if (window.PointerEvent) {
    document.removeEventListener('pointermove', doResize)
    document.removeEventListener('pointerup', stopResize)
    document.removeEventListener('pointercancel', stopResize)
  } else {
    document.removeEventListener('mousemove', doResize)
    document.removeEventListener('mouseup', stopResize)
  }
  
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
  document.body.style.webkitUserSelect = ''
  document.body.style.msUserSelect = ''
  
  emit('resize', currentWidth)
  saveState()
}

// 保存状态（防抖）
let saveTimeout = null
function saveState() {
  if (saveTimeout) clearTimeout(saveTimeout)
  saveTimeout = setTimeout(() => {
    localStorage.setItem('ygo-sidebar-state', JSON.stringify({
      width: sidebarWidth.value,
      panel: activePanel.value,
      collapsed: sidebarCollapsed.value,
      activityOrder: activityItemsOrder.value,
      deckPanelsOrder: deckPanelsOrder.value,
      toolsPanelsOrder: toolsPanelsOrder.value
    }))
  }, 100)
}

// 恢复状态
function restoreState() {
  const savedState = localStorage.getItem('ygo-sidebar-state')
  if (savedState) {
    try {
      const state = JSON.parse(savedState)
      if (state.width) {
        sidebarWidth.value = state.width
        currentWidth = state.width
      }
      if (state.panel && defaultActivityItems.some(i => i.id === state.panel) || state.panel === 'settings') {
        activePanel.value = state.panel
      }
      if (state.collapsed !== undefined) sidebarCollapsed.value = state.collapsed
      if (state.activityOrder && Array.isArray(state.activityOrder)) {
        const validIds = defaultActivityItems.map(i => i.id)
        if (state.activityOrder.every(id => validIds.includes(id)) && 
            state.activityOrder.length === validIds.length) {
          activityItemsOrder.value = state.activityOrder
        }
      }
      if (state.deckPanelsOrder && Array.isArray(state.deckPanelsOrder)) {
        const validIds = defaultDeckPanels.map(p => p.id)
        if (state.deckPanelsOrder.every(id => validIds.includes(id)) &&
            state.deckPanelsOrder.length === validIds.length) {
          deckPanelsOrder.value = state.deckPanelsOrder
        }
      }
      if (state.toolsPanelsOrder && Array.isArray(state.toolsPanelsOrder)) {
        const validIds = defaultToolsPanels.map(p => p.id)
        if (state.toolsPanelsOrder.every(id => validIds.includes(id)) &&
            state.toolsPanelsOrder.length === validIds.length) {
          toolsPanelsOrder.value = state.toolsPanelsOrder
        }
      }
    } catch (e) {
      console.warn('Failed to restore sidebar state')
    }
  }
}

onMounted(() => {
  restoreState()
  // 初始化宽度
  if (sidebarRef.value && !sidebarCollapsed.value) {
    sidebarRef.value.style.width = sidebarWidth.value + 'px'
  }
})

onUnmounted(() => {
  saveState()
  if (saveTimeout) clearTimeout(saveTimeout)
  // 清理可能残留的事件监听器
  if (window.PointerEvent) {
    document.removeEventListener('pointermove', doResize)
    document.removeEventListener('pointerup', stopResize)
    document.removeEventListener('pointercancel', stopResize)
  } else {
    document.removeEventListener('mousemove', doResize)
    document.removeEventListener('mouseup', stopResize)
  }
})

// 暴露给父组件的方法
defineExpose({
  togglePanel,
  expandPanel,
  collapseSidebar,
  activePanel,
  resetPanelOrder
})
</script>

<style scoped>
.layout {
  display: flex;
  height: 100vh;
  overflow: hidden;
  background-color: #f0f2f5;
}

/* 活动栏样式 */
.activity-bar {
  width: 48px;
  background: #1e293b;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  flex-shrink: 0;
  z-index: 100;
}

.activity-icons {
  display: flex;
  flex-direction: column;
}

.activity-icon {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  position: relative;
  transition: background-color 0.15s ease;
  -webkit-user-drag: element;
}

.activity-icon:hover {
  background: rgba(255, 255, 255, 0.1);
}

.activity-icon.active {
  background: rgba(255, 255, 255, 0.05);
}

.activity-icon.dragging {
  opacity: 0.5;
}

.activity-icon.drag-over::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: #3b82f6;
}

.activity-icon .icon {
  font-size: 20px;
  opacity: 0.7;
  transition: opacity 0.15s ease;
  pointer-events: none;
}

.activity-icon:hover .icon,
.activity-icon.active .icon {
  opacity: 1;
}

.active-indicator {
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 2px;
  height: 24px;
  background: #fff;
  border-radius: 0 1px 1px 0;
}

.activity-bottom {
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

/* 侧边栏样式 */
.sidebar {
  background: #ffffff;
  display: flex;
  flex-shrink: 0;
  position: relative;
  box-shadow: 1px 0 3px rgba(0, 0, 0, 0.05);
  z-index: 50;
  /* 使用 contain 优化渲染性能 */
  contain: layout style;
  /* 默认启用过渡 */
  transition: width 0.15s ease;
}

/* 拖动调整时禁用过渡 */
.sidebar.resizing {
  transition: none !important;
}

.sidebar.collapsed {
  width: 0 !important;
  overflow: hidden;
}

.sidebar-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 280px;
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
  flex-shrink: 0;
}

.sidebar-title {
  font-size: 14px;
  font-weight: 600;
  color: #334155;
  letter-spacing: 0.3px;
}

.sidebar-header-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.header-btn {
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  cursor: pointer;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #64748b;
  transition: all 0.15s ease;
  font-size: 14px;
}

.header-btn:hover {
  background: #e2e8f0;
  color: #334155;
}

.sidebar-panels {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
}

.panel-container {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* 面板项样式 */
.panel-item {
  width: 100%;
}

/* 拖动手柄 - 优化触控 */
.resize-handle {
  width: 6px;
  cursor: col-resize;
  background: transparent;
  transition: background-color 0.15s ease;
  flex-shrink: 0;
  touch-action: none;
  -ms-touch-action: none;
}

.resize-handle:hover,
.sidebar.resizing .resize-handle {
  background: #3b82f6;
}

/* 主内容区 */
.main-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 12px;
  background: #f0f2f5;
}

/* 响应式设计 */
@media screen and (max-width: 768px) {
  .activity-bar {
    width: 40px;
  }
  
  .activity-icon {
    width: 40px;
    height: 40px;
  }
  
  .activity-icon .icon {
    font-size: 18px;
  }
  
  .sidebar-content {
    min-width: 240px;
  }
  
  .main-content {
    padding: 8px;
  }
}

/* 滚动条样式 */
.sidebar-panels::-webkit-scrollbar,
.main-content::-webkit-scrollbar {
  width: 6px;
}

.sidebar-panels::-webkit-scrollbar-track,
.main-content::-webkit-scrollbar-track {
  background: transparent;
}

.sidebar-panels::-webkit-scrollbar-thumb,
.main-content::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 3px;
}

.sidebar-panels::-webkit-scrollbar-thumb:hover,
.main-content::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}

/* Edge/IE 滚动条样式 */
.sidebar-panels,
.main-content {
  -ms-overflow-style: -ms-autohiding-scrollbar;
  scrollbar-width: thin;
  scrollbar-color: #cbd5e1 transparent;
}
</style>

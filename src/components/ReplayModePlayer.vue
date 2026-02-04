<template>
  <div class="replay-mode-player">
    <!-- 加载界面 -->
    <div v-if="isLoading || isPreloading" class="loading-overlay">
      <div class="loading-content">
        <div class="loading-spinner"></div>
        <div class="loading-status">{{ isPreloading ? '预加载录像数据...' : loadingStatus }}</div>
        <div class="loading-progress">
          <div class="progress-bar" :style="{ width: (isPreloading ? preloadProgress : loadingProgress) + '%' }"></div>
        </div>
        <div class="loading-text">
          {{ isPreloading ? `已收集 ${preloadedMessages.length} 条消息 (${preloadProgress}%)` : loadingProgressText }}
        </div>
      </div>
    </div>

    <!-- 主界面 -->
    <div v-else class="main-container">
      <!-- 左侧面板 - 玩家信息和控制 -->
      <div class="left-panel">
        <!-- 对手信息 -->
        <div class="player-info-panel opponent-info">
          <div class="player-name">{{ duelInfo.players[1] }}</div>
          <div class="player-lp" :class="{ low: duelInfo.lp[1] < 2000 }">
            LP: {{ duelInfo.lp[1] }}
          </div>
        </div>

        <!-- 回合信息 -->
        <div class="turn-info-panel">
          <div class="turn-number">回合 {{ duelInfo.turn }}</div>
          <div class="phase-name">{{ getPhaseName(duelInfo.phase) }}</div>
        </div>

        <!-- 我方信息 -->
        <div class="player-info-panel self-info">
          <div class="player-name">{{ duelInfo.players[0] }}</div>
          <div class="player-lp" :class="{ low: duelInfo.lp[0] < 2000 }">
            LP: {{ duelInfo.lp[0] }}
          </div>
        </div>

        <!-- 控制按钮 -->
        <div class="control-buttons">
          <button class="ctrl-btn back-btn" @click="emit('close')">← 返回</button>
          <button class="ctrl-btn" @click="handleLoadReplay" :disabled="isStarted">📂 加载</button>
          <button class="ctrl-btn" @click="handleStartReplay" :disabled="!isLoaded || isStarted">▶️ 开始</button>
          <button class="ctrl-btn" @click="handlePause" :disabled="!isStarted">
            {{ isPaused ? '▶️ 继续' : '⏸️ 暂停' }}
          </button>
          <button class="ctrl-btn" @click="handlePrevStep" :disabled="!isStarted || !isPaused || !usePreloadedData || stateSnapshots.length < 2">⏮️ 上一步</button>
          <button class="ctrl-btn" @click="handleStep" :disabled="!isStarted || !isPaused">⏭️ 下一步</button>
          <button class="ctrl-btn" @click="handleSwapField" :disabled="!isStarted">🔄 视角</button>
          <button class="ctrl-btn" @click="handleRestart" :disabled="!isLoaded">🔁 重置</button>
          <button class="ctrl-btn combo-panel-btn" @click="openComboPanelPopup" :disabled="!isLoaded">📊 Combo面板</button>
          <button class="ctrl-btn export-btn" @click="handleExportFullLog" :disabled="!isLoaded">📋 导出记录</button>
          <button class="ctrl-btn combo-btn" @click="handleExportComboTree" :disabled="currentTreeEntries.length === 0">🌳 导出Combo</button>
          <button class="ctrl-btn bookmark-btn" @click="quickAddBookmark" :disabled="!isStarted" title="添加书签">📌 添书签</button>
          <button class="ctrl-btn bookmark-panel-btn" @click="toggleBookmarksPanel" :class="{ active: bookmarksPanelVisible }">
            🏷️ 书签 <span v-if="bookmarks.length" class="bookmark-count">{{ bookmarks.length }}</span>
          </button>
        </div>

        <!-- 速度控制 -->
        <div class="speed-control">
          <span>速度</span>
          <input type="range" min="0" max="500" v-model.number="playbackSpeed" />
          <span>{{ playbackSpeed }}ms</span>
        </div>

        <!-- 状态 -->
        <div class="status-info">
          <div>步骤: {{ currentStep }}</div>
          <div>响应: {{ responseIndex }}/{{ responses.length }}</div>
          <div v-if="isPaused" class="status-paused">⏸️ 已暂停</div>
        </div>
      </div>

      <!-- 中央决斗场地 -->
      <div class="duel-field-container"  @click="onDuelFieldClick">
        <!-- 隐藏的解说模式触发器 - 按顺序点击"决斗开始"激活 -->
        <div class="secret-trigger-container">
          <span 
            class="secret-trigger" 
            :class="{ 'triggered': secretSequence.includes(2), 'next': secretSequence.length === 2 }"
            @click.stop="onSecretTrigger(2)"
          >开</span>
          <span 
            class="secret-trigger" 
            :class="{ 'triggered': secretSequence.includes(1), 'next': secretSequence.length === 1 }"
            @click.stop="onSecretTrigger(1)"
          >斗</span>
          <span 
            class="secret-trigger" 
            :class="{ 'triggered': secretSequence.includes(0), 'next': secretSequence.length === 0 }"
            @click.stop="onSecretTrigger(0)"
          >决</span>
          <span 
            class="secret-trigger" 
            :class="{ 'triggered': secretSequence.includes(3), 'next': secretSequence.length === 3 }"
            @click.stop="onSecretTrigger(3)"
          >始</span>
        </div>
        
        <!-- Combo预览模式提示横幅 -->
        <div v-if="comboPreviewMode" class="combo-preview-banner" @click.stop>
          <span class="preview-icon">📸</span>
          <span class="preview-text">场地快照预览 - 第 {{ comboPreviewNodeIndex + 1 }} 步</span>
          <button class="exit-preview-btn" @click="exitComboPreviewMode">✕ 退出预览</button>
        </div>
        <div class="duel-field" :style="{ zIndex: comboPanelOnTop ? 998 : 1000 }" :class="{ 'preview-mode': comboPreviewMode }">
          <!-- ========== 对手场地 (Player 1) - 上方 ========== -->
          
          <!-- 对手第一行: 卡组 + 魔陷区 + 额外卡组 -->
          <div class="field-row opponent-row-1">
            <div class="zone-cell deck-cell" @click="showZone(1, LOCATION.DECK)">
              <div class="zone-box solid" :class="{ 'deck-zone': field.players[1].deck }">
                <img v-if="field.players[1].deck" :src="BASE_URL + 'images/back.jpg'" class="deck-back-img" />
                <span v-else class="zone-label">卡组</span>
                <span class="zone-count deck-count" v-if="field.players[1].deck">{{ field.players[1].deck }}</span>
              </div>
            </div>
            
            <div v-for="i in 5" :key="'opp-st-' + i" class="zone-cell st-cell">
              <div class="zone-box dashed" :class="{ occupied: field.players[1].szone[4 - (i - 1)] }">
                <div v-if="field.players[1].szone[4 - (i - 1)]" class="card-in-zone"
                  :class="getCardClass(field.players[1].szone[4 - (i - 1)])"
                  @click="showCard(field.players[1].szone[4 - (i - 1)])">
                  <img v-if="getCardImageUrl(field.players[1].szone[4 - (i - 1)])" 
                    :src="getCardImageUrl(field.players[1].szone[4 - (i - 1)])" class="card-img" />
                </div>
                <span v-else class="zone-label">魔/陷</span>
              </div>
            </div>
            
            <div class="zone-cell extra-deck-cell" @click="showZone(1, LOCATION.EXTRA)">
              <div class="zone-box solid" :class="{ 'deck-zone extra-zone': field.players[1].extra }">
                <img v-if="field.players[1].extra" :src="BASE_URL + 'images/back.jpg'" class="deck-back-img" />
                <span v-else class="zone-label">额外<br>卡组</span>
                <span class="zone-count deck-count" v-if="field.players[1].extra">{{ field.players[1].extra }}</span>
              </div>
            </div>
          </div>

          <!-- 对手第二行: 墓地 + 怪兽区 -->
          <div class="field-row opponent-row-2">
            <div class="zone-cell gy-cell" @click="showZone(1, LOCATION.GRAVE)">
              <div class="zone-box solid" :class="{ 'deck-zone': field.players[1].grave.length }">
                <img v-if="field.players[1].grave.length" :src="getTopCardImageUrl(getGraveTopCard(1))" class="deck-back-img" />
                <span v-else class="zone-label">墓地<br>GY</span>
                <span class="zone-count deck-count" v-if="field.players[1].grave.length">{{ field.players[1].grave.length }}</span>
              </div>
            </div>
            
            <div v-for="i in 5" :key="'opp-m-' + i" class="zone-cell monster-cell">
              <div class="zone-box dashed" :class="{ occupied: field.players[1].mzone[4 - (i - 1)] }">
                <div v-if="field.players[1].mzone[4 - (i - 1)]" class="card-in-zone"
                  :class="getCardClass(field.players[1].mzone[4 - (i - 1)])"
                  @click="showCard(field.players[1].mzone[4 - (i - 1)])">
                  <img v-if="getCardImageUrl(field.players[1].mzone[4 - (i - 1)])" 
                    :src="getCardImageUrl(field.players[1].mzone[4 - (i - 1)])" class="card-img" />
                  <span class="atk-display" v-if="isMonsterFaceup(field.players[1].mzone[4 - (i - 1)])">
                    {{ field.players[1].mzone[4 - (i - 1)]?.attack }}
                  </span>
                </div>
                <span v-else class="zone-label">怪兽区</span>
              </div>
            </div>
            
            <div class="zone-cell empty-cell"></div>
          </div>

          <!-- 对手除外区 (右侧独立) -->
          <div class="opponent-banished" @click="showZone(1, LOCATION.REMOVED)">
            <div class="zone-box dashed banished-box" :class="{ 'deck-zone': field.players[1].removed.length }">
              <img v-if="field.players[1].removed.length" :src="getTopCardImageUrl(getRemovedTopCard(1))" class="deck-back-img" />
              <span v-else class="zone-label">除外区</span>
              <span class="zone-count deck-count" v-if="field.players[1].removed.length">{{ field.players[1].removed.length }}</span>
            </div>
          </div>

          <!-- ========== 中央区域: 额外怪兽区 ========== -->
          <!-- 对手场地魔法区 (左侧) -->
          <div class="field-spell-zone opp-field-spell" @click="showZone(1, LOCATION.SZONE, 5)">
            <div class="zone-box dashed">
              <div v-if="field.players[1].szone[5]" class="card-in-zone"
                :class="getCardClass(field.players[1].szone[5])"
                @click.stop="showCard(field.players[1].szone[5])">
                <img v-if="getCardImageUrl(field.players[1].szone[5])" 
                  :src="getCardImageUrl(field.players[1].szone[5])" class="card-img" />
              </div>
              <span v-else class="zone-label">场地</span>
            </div>
          </div>

          <!-- 额外怪兽区 (中央) - 两个玩家共享 -->
          <div class="extra-monster-zones-center">
            <!-- 左额外怪兽区: 玩家0的mzone[5] 或 玩家1的mzone[6] -->
            <div class="emz-cell">
              <div class="zone-box dashed" :class="{ occupied: getLeftEMZCard() }">
                <div v-if="getLeftEMZCard()" class="card-in-zone"
                  :class="getCardClass(getLeftEMZCard())"
                  @click="showCard(getLeftEMZCard())">
                  <img v-if="getCardImageUrl(getLeftEMZCard())" 
                    :src="getCardImageUrl(getLeftEMZCard())" class="card-img" />
                  <span class="atk-display" v-if="isMonsterFaceup(getLeftEMZCard())">
                    {{ getLeftEMZCard()?.attack }}
                  </span>
                </div>
                <span v-else class="zone-label">额外<br>怪兽</span>
              </div>
            </div>
            
            <!-- 右额外怪兽区: 玩家0的mzone[6] 或 玩家1的mzone[5] -->
            <div class="emz-cell">
              <div class="zone-box dashed" :class="{ occupied: getRightEMZCard() }">
                <div v-if="getRightEMZCard()" class="card-in-zone"
                  :class="getCardClass(getRightEMZCard())"
                  @click="showCard(getRightEMZCard())">
                  <img v-if="getCardImageUrl(getRightEMZCard())" 
                    :src="getCardImageUrl(getRightEMZCard())" class="card-img" />
                  <span class="atk-display" v-if="isMonsterFaceup(getRightEMZCard())">
                    {{ getRightEMZCard()?.attack }}
                  </span>
                </div>
                <span v-else class="zone-label">额外<br>怪兽</span>
              </div>
            </div>
          </div>

          <!-- ========== 我方场地 (Player 0) - 下方 ========== -->
          
          <!-- 我方场地魔法区 -->
          <div class="self-field-spell" @click="showZone(0, LOCATION.SZONE, 5)">
            <div class="zone-box dashed">
              <div v-if="field.players[0].szone[5]" class="card-in-zone"
                :class="getCardClass(field.players[0].szone[5])"
                @click.stop="showCard(field.players[0].szone[5])">
                <img v-if="getCardImageUrl(field.players[0].szone[5])" 
                  :src="getCardImageUrl(field.players[0].szone[5])" class="card-img" />
              </div>
              <span v-else class="zone-label">场地</span>
            </div>
          </div>

          <!-- 我方除外区 -->
          <div class="self-banished" @click="showZone(0, LOCATION.REMOVED)">
            <div class="zone-box dashed banished-box" :class="{ 'deck-zone': field.players[0].removed.length }">
              <img v-if="field.players[0].removed.length" :src="getTopCardImageUrl(getRemovedTopCard(0))" class="deck-back-img" />
              <span v-else class="zone-label">除外区</span>
              <span class="zone-count deck-count" v-if="field.players[0].removed.length">{{ field.players[0].removed.length }}</span>
            </div>
          </div>

          <!-- 我方第一行: 怪兽区 -->
          <div class="field-row self-row-1">
            <div class="zone-cell empty-cell"></div>
            
            <div v-for="i in 5" :key="'self-m-' + i" class="zone-cell monster-cell">
              <div class="zone-box dashed" :class="{ occupied: field.players[0].mzone[i - 1] }">
                <div v-if="field.players[0].mzone[i - 1]" class="card-in-zone"
                  :class="getCardClass(field.players[0].mzone[i - 1])"
                  @click="showCard(field.players[0].mzone[i - 1])">
                  <img v-if="getCardImageUrl(field.players[0].mzone[i - 1])" 
                    :src="getCardImageUrl(field.players[0].mzone[i - 1])" class="card-img" />
                  <span class="atk-display" v-if="isMonsterFaceup(field.players[0].mzone[i - 1])">
                    {{ field.players[0].mzone[i - 1]?.attack }}
                  </span>
                </div>
                <span v-else class="zone-label">怪兽区</span>
              </div>
            </div>
            
            <div class="zone-cell gy-cell" @click="showZone(0, LOCATION.GRAVE)">
              <div class="zone-box solid" :class="{ 'deck-zone': field.players[0].grave.length }">
                <img v-if="field.players[0].grave.length" :src="getTopCardImageUrl(getGraveTopCard(0))" class="deck-back-img" />
                <span v-else class="zone-label">墓地<br>GY</span>
                <span class="zone-count deck-count" v-if="field.players[0].grave.length">{{ field.players[0].grave.length }}</span>
              </div>
            </div>
          </div>

          <!-- 我方第二行: 魔陷区 + 卡组 -->
          <div class="field-row self-row-2">
            <div class="zone-cell extra-deck-cell" @click="showZone(0, LOCATION.EXTRA)">
              <div class="zone-box solid" :class="{ 'deck-zone extra-zone': field.players[0].extra }">
                <img v-if="field.players[0].extra" :src="BASE_URL + 'images/back.jpg'" class="deck-back-img" />
                <span v-else class="zone-label">额外<br>卡组</span>
                <span class="zone-count deck-count" v-if="field.players[0].extra">{{ field.players[0].extra }}</span>
              </div>
            </div>
            
            <div v-for="i in 5" :key="'self-st-' + i" class="zone-cell st-cell">
              <div class="zone-box dashed" :class="{ occupied: field.players[0].szone[i - 1] }">
                <div v-if="field.players[0].szone[i - 1]" class="card-in-zone"
                  :class="getCardClass(field.players[0].szone[i - 1])"
                  @click="showCard(field.players[0].szone[i - 1])">
                  <img v-if="getCardImageUrl(field.players[0].szone[i - 1])" 
                    :src="getCardImageUrl(field.players[0].szone[i - 1])" class="card-img" />
                </div>
                <span v-else class="zone-label">魔/陷</span>
              </div>
            </div>
            
            <div class="zone-cell deck-cell" @click="showZone(0, LOCATION.DECK)">
              <div class="zone-box solid" :class="{ 'deck-zone': field.players[0].deck }">
                <img v-if="field.players[0].deck" :src="BASE_URL + 'images/back.jpg'" class="deck-back-img" />
                <span v-else class="zone-label">卡组</span>
                <span class="zone-count deck-count" v-if="field.players[0].deck">{{ field.players[0].deck }}</span>
              </div>
            </div>
          </div>

        </div>

        <!-- ========== 手牌区域 (在duel-field外面) ========== -->
        
        <!-- 对手手牌 (上方) -->
        <div class="hand-area opponent-hand">
          <div v-for="(card, idx) in field.players[1].hand" :key="'opp-h-' + idx" 
            class="hand-card" :class="getCardClass(card)" @click="showCard(card)">
            <img v-if="getCardImageUrl(card)" :src="getCardImageUrl(card)" class="card-img" />
          </div>
          <span v-if="field.players[1].hand.length === 0" class="hand-empty">手牌: 0</span>
        </div>

        <!-- 我方手牌 (下方) -->
        <div class="hand-area self-hand">
          <div v-for="(card, idx) in field.players[0].hand" :key="'self-h-' + idx" 
            class="hand-card" :class="getCardClass(card)" @click="showCard(card)">
            <img v-if="getCardImageUrl(card)" :src="getCardImageUrl(card)" class="card-img" />
          </div>
          <span v-if="field.players[0].hand.length === 0" class="hand-empty">手牌: 0</span>
        </div>
      </div>

      <!-- 文字解说面板 -->
      <div v-if="commentaryModeEnabled" class="commentary-panel" :class="'commentator-' + commentatorCharacter">
        <div class="commentary-header" :style="{ background: `linear-gradient(90deg, ${currentCommentator.color} 0%, ${currentCommentator.color}88 100%)` }">
          <!-- 解说员头像和名称 -->
          <div class="commentator-info" @click.stop="toggleCommentatorSelector">
            <span class="commentator-avatar">{{ currentCommentator.avatar }}</span>
            <span class="commentary-title">{{ currentCommentator.name }}</span>
            <span class="commentator-dropdown-icon" :class="{ 'open': showCommentatorSelector }">▼</span>
            <!-- 角色选择下拉菜单 -->
            <div v-if="showCommentatorSelector" class="commentator-selector" @click.stop>
              <div 
                v-for="char in Object.values(commentatorCharacters)" 
                :key="char.id" 
                class="commentator-option"
                :class="{ 'active': commentatorCharacter === char.id }"
                @click.stop="selectCommentator(char.id)"
              >
                <span class="option-avatar">{{ char.avatar }}</span>
                <div class="option-info">
                  <span class="option-name">{{ char.name }}</span>
                  <span class="option-desc">{{ char.description }}</span>
                </div>
              </div>
            </div>
          </div>
          <div class="commentary-controls">
            <button class="commentary-clear-btn" @click="clearCommentary" title="清空解说">🗑️</button>
            <button class="commentary-copy-btn" @click="copyCommentary" title="复制解说">📋</button>
            <button class="commentary-close-btn" @click="closeCommentaryMode" title="关闭解说面板">✕</button>
          </div>
        </div>
        <div class="commentary-content" ref="commentaryContent">
          <div v-if="commentaryEntries.length === 0" class="commentary-empty">
            <span class="empty-avatar">{{ currentCommentator.avatar }}</span>
            <span v-if="commentatorCharacter === 'yusei'">骑乘决斗...准备就绪！</span>
            <span v-else-if="commentatorCharacter === 'm'">准备开始解说！让我们看看今天的对局如何~</span>
            <span v-else>等待对局开始...</span>
          </div>
          <div v-else class="commentary-list">
            <div 
              v-for="(entry, idx) in commentaryEntries" 
              :key="'commentary-' + idx" 
              class="commentary-entry"
              :class="['commentary-' + entry.type.toLowerCase(), entry.character ? 'character-' + entry.character : '']"
            >
              <span class="commentary-time">{{ entry.turn ? `T${entry.turn}` : '' }}</span>
              <span class="commentary-icon">{{ entry.icon }}</span>
              <span class="commentary-text">{{ entry.text }}</span>
            </div>
          </div>
        </div>
      </div>

    <!-- Combo路线图浮动面板 -->
    <div 
      v-show="comboPanelVisible"
      class="combo-flowchart-panel"
      ref="comboPanelRef"
      :style="{ 
        left: comboPanelPos.x + 'px', 
        top: comboPanelPos.y + 'px',
        width: comboPanelSize.width + 'px',
        height: comboPanelSize.height + 'px',
        zIndex: comboPanelOnTop ? 1001 : 999
      }"
      @click="onComboPanelClick"
    >
      <!-- 调整大小手柄 -->
      <div class="resize-handle resize-n" @mousedown="startResize($event, 'n')" @touchstart="startResize($event, 'n')"></div>
      <div class="resize-handle resize-s" @mousedown="startResize($event, 's')" @touchstart="startResize($event, 's')"></div>
      <div class="resize-handle resize-e" @mousedown="startResize($event, 'e')" @touchstart="startResize($event, 'e')"></div>
      <div class="resize-handle resize-w" @mousedown="startResize($event, 'w')" @touchstart="startResize($event, 'w')"></div>
      <div class="resize-handle resize-ne" @mousedown="startResize($event, 'ne')" @touchstart="startResize($event, 'ne')"></div>
      <div class="resize-handle resize-nw" @mousedown="startResize($event, 'nw')" @touchstart="startResize($event, 'nw')"></div>
      <div class="resize-handle resize-se" @mousedown="startResize($event, 'se')" @touchstart="startResize($event, 'se')"></div>
      <div class="resize-handle resize-sw" @mousedown="startResize($event, 'sw')" @touchstart="startResize($event, 'sw')"></div>
      <div 
        class="combo-flowchart-header"
        @mousedown="startComboPanelDrag"
        @touchstart="startComboPanelDrag"
      >
        <div class="combo-flowchart-left">
          <span class="combo-flowchart-title">⚡ Combo 路线图 (回合 {{ duelInfo.turn }})</span>
          
          <!-- 因果树切换器 -->
          <div class="combo-tree-switcher" @mousedown.stop @touchstart.stop>
            <div class="tree-selector" @click="showTreeDropdown = !showTreeDropdown">
              <span class="tree-icon">🌳</span>
              <span class="tree-name">{{ comboTrees[currentTreeIndex]?.name || '总因果树' }}</span>
              <span class="tree-count">({{ currentTreeEntries.length }})</span>
              <span class="dropdown-arrow">▼</span>
            </div>
            
            <!-- 下拉菜单 -->
            <div v-show="showTreeDropdown" class="tree-dropdown">
              <div 
                v-for="(tree, idx) in comboTrees" 
                :key="tree.id"
                class="tree-option"
                :class="{ 
                  'active': idx === currentTreeIndex, 
                  'is-total': tree.isTotal, 
                  'is-starter': tree.treeType === 'starter',
                  'is-action': tree.treeType === 'action'
                }"
                @click="switchComboTree(idx)"
              >
                <span class="tree-option-icon">{{ getTreeIcon(tree) }}</span>
                <span class="tree-option-name">{{ tree.name }}</span>
                <span class="tree-option-count">({{ tree.isTotal ? comboTreeEntries.length : tree.entries.length }})</span>
              </div>
              <div class="tree-dropdown-divider"></div>
              <div class="tree-option tree-action" @click="createNewComboTree">
                <span class="tree-option-icon">➕</span>
                <span class="tree-option-name">新建空因果树</span>
              </div>
            </div>
          </div>
          
          <!-- 因果树操作按钮 -->
          <div class="combo-tree-actions" @mousedown.stop @touchstart.stop>
            <button 
              v-if="!comboTrees[currentTreeIndex]?.isTotal"
              class="tree-action-btn" 
              @click="startEditTreeName" 
              title="重命名因果树"
            >✏️</button>
            <button 
              v-if="!comboTrees[currentTreeIndex]?.isTotal"
              class="tree-action-btn tree-delete-btn" 
              @click="deleteCurrentComboTree" 
              title="删除因果树"
            >🗑️</button>
            <button 
              class="tree-action-btn" 
              @click="clearCurrentTreeEntries" 
              title="清空当前因果树"
            >🧹</button>
          </div>
          
          <span class="zoom-hint">✋ 拖拽移动 | Ctrl+滚轮缩放 | 🖱️左键: 场地快照 | 右键: 卡牌详情 | 🔍: 搜索额外卡组</span>
        </div>
        <div class="combo-flowchart-controls">
          <div class="gap-control" @mousedown.stop @touchstart.stop title="调节卡牌间隔">
            <span class="gap-label">间隔</span>
            <input type="range" class="gap-slider" v-model.number="comboHGap" min="20" max="100" step="5" />
            <span class="gap-value">{{ comboHGap }}</span>
          </div>
          <div class="control-divider"></div>
          <button class="zoom-btn" @click="comboZoom = Math.max(0.3, comboZoom - 0.1)" title="缩小">−</button>
          <span class="zoom-level" @click="resetComboZoom" title="点击重置100%">{{ Math.round(comboZoom * 100) }}%</span>
          <button class="zoom-btn" @click="comboZoom = Math.min(2.0, comboZoom + 0.1)" title="放大">+</button>
          <button class="fit-btn" @click="fitComboToWindow" title="适应窗口大小">⊡</button>
          <button class="optimize-flowchart-btn" @click="toggleOptimizedLayout" :class="{ active: useOptimizedLayout }" title="优化流程图布局（上下展开）">🔧</button>
          <button class="export-flowchart-btn" @click="exportFlowchartAsImage" title="导出流程图为图片">📷</button>
          <button class="close-panel-btn" @click="closeComboPanelPopup">✕</button>
        </div>
      </div>
      
      <!-- 因果树重命名对话框 -->
      <div v-if="editingTreeName" class="tree-rename-dialog" @mousedown.stop @touchstart.stop>
        <div class="rename-dialog-content">
          <div class="rename-dialog-title">重命名因果树</div>
          <input 
            v-model="editTreeNameValue" 
            class="rename-input"
            placeholder="输入因果树名称"
            @keyup.enter="saveTreeName"
            @keyup.esc="cancelEditTreeName"
            ref="treeNameInput"
          />
          <div class="rename-dialog-buttons">
            <button class="rename-btn rename-cancel" @click="cancelEditTreeName">取消</button>
            <button class="rename-btn rename-save" @click="saveTreeName">保存</button>
          </div>
        </div>
      </div>
      <div 
        class="combo-flowchart-container" 
        ref="comboContainerRef"
        @mousedown="startComboPan"
        @touchstart="startComboPan"
        @wheel="onComboWheel"
      >
        <div v-if="comboFlowNodes.length === 0" class="combo-flowchart-empty">
          <div class="empty-icon">🎴</div>
          <div class="empty-text">等待Combo展开...</div>
        </div>
        <div v-else class="combo-flowchart-canvas" :style="{ transform: `scale(${comboZoom})` }">
          <!-- SVG连接线层 -->
          <svg class="combo-connections-svg" :width="comboCanvasWidth" :height="comboCanvasHeight">
            <defs>
              <!-- 箭头标记 (6x6 小箭头) -->
              <marker id="arrow-red" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                <path d="M0,0 L6,3 L0,6 Z" fill="#e94560"/>
              </marker>
              <marker id="arrow-blue" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                <path d="M0,0 L6,3 L0,6 Z" fill="#17a2b8"/>
              </marker>
              <marker id="arrow-yellow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                <path d="M0,0 L6,3 L0,6 Z" fill="#ffc107"/>
              </marker>
              <marker id="arrow-purple" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                <path d="M0,0 L6,3 L0,6 Z" fill="#9c27b0"/>
              </marker>
              <!-- 因果关系类型箭头 (6x6 小箭头) -->
              <marker id="arrow-SUMMON_MATERIAL" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                <path d="M0,0 L6,3 L0,6 Z" fill="#ff6b35"/>
              </marker>
              <marker id="arrow-EFFECT_TARGET" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                <path d="M0,0 L6,3 L0,6 Z" fill="#e94560"/>
              </marker>
              <marker id="arrow-COST" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                <path d="M0,0 L6,3 L0,6 Z" fill="#9b59b6"/>
              </marker>
              <marker id="arrow-SEARCH" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                <path d="M0,0 L6,3 L0,6 Z" fill="#2ecc71"/>
              </marker>
              <marker id="arrow-TEMPORAL" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                <path d="M0,0 L6,3 L0,6 Z" fill="#7f8c8d"/>
              </marker>
              <marker id="arrow-CHAIN_RESPONSE" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                <path d="M0,0 L6,3 L0,6 Z" fill="#3498db"/>
              </marker>
              <marker id="arrow-TRIGGER" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                <path d="M0,0 L6,3 L0,6 Z" fill="#f1c40f"/>
              </marker>
              <marker id="arrow-HAND_ACTIVATION" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                <path d="M0,0 L6,3 L0,6 Z" fill="#1abc9c"/>
              </marker>
            </defs>
            <!-- 连接线 - 支持因果强度可视化 -->
            <g v-for="(conn, idx) in comboConnections" :key="'conn-' + idx">
              <!-- 光晕效果 (强因果关系) -->
              <path 
                v-if="conn.causalStrength > 0.7"
                :d="conn.path" 
                :stroke="conn.color"
                :stroke-width="conn.strokeWidth + 4"
                :stroke-dasharray="conn.dashArray"
                stroke-opacity="0.2"
                fill="none"
              />
              <!-- 主连接线 -->
              <path 
                :d="conn.path" 
                :stroke="conn.color" 
                :stroke-width="conn.strokeWidth || 2" 
                :stroke-dasharray="conn.dashArray"
                fill="none"
                :marker-end="conn.causalType ? `url(#arrow-${conn.causalType})` : `url(#arrow-${conn.colorName})`"
                class="causal-edge"
                :class="'edge-type-' + (conn.causalType || 'default').toLowerCase()"
              />
              <!-- 连接线上的标签 (因果类型) -->
              <text 
                v-if="conn.label"
                :x="conn.labelX" 
                :y="conn.labelY" 
                class="connection-label"
                :class="'label-type-' + (conn.causalType || 'default').toLowerCase()"
              >{{ conn.label }}</text>
            </g>
          </svg>
          
          <!-- 卡片节点层 -->
          <!-- 左键点击: 显示场地快照 | 右键点击: 显示卡牌详情 -->
          <div 
            v-for="(node, idx) in comboFlowNodes" 
            :key="'node-' + idx"
            class="combo-card-node"
            :class="[
              'node-type-' + node.type.toLowerCase(), 
              { 
                'node-highlighted': node.highlighted, 
                'has-materials': node.summonMaterials && node.summonMaterials.length,
                'has-chain': node.chainNum,
                'node-previewing': comboPreviewMode && comboPreviewNodeIndex === idx
              },
              node.entropy ? getEntropyClass(node.entropy.delta) : '',
              node.summonType ? 'summon-type-' + node.summonType.toLowerCase() : ''
            ]"
            :style="{ 
              left: node.x + 'px', 
              top: node.y + 'px',
              '--entropy-glow': node.entropy ? getEntropyColor(node.entropy.delta).glow : 'transparent'
            }"
            @click="onComboNodeClick(node, idx)"
            @contextmenu.prevent="onComboNodeRightClick(node)"
            :title="getNodeTooltip(node, idx)"
          >
            <!-- 召唤素材卡片显示 - 支持XYZ/同调/Link/融合/仪式 -->
            <div v-if="node.summonMaterials && node.summonMaterials.length" 
              class="combo-summon-material-cards"
              :class="'material-type-' + (node.summonType || 'xyz').toLowerCase()"
            >
              <!-- 召唤类型标签 -->
              <div class="summon-type-label" :class="'label-' + (node.summonType || 'XYZ').toLowerCase()">
                {{ node.summonType || 'XYZ' }}
              </div>
              <div 
                v-for="(mat, matIdx) in node.summonMaterials" 
                :key="'mat-' + matIdx"
                class="summon-material-card clickable-material"
                :class="{ 'is-tuner': mat.isTuner, 'is-link': mat.isLink }"
                :style="{ '--mat-idx': matIdx, '--mat-total': node.summonMaterials.length }"
                @click.stop="searchExtraDeckTargets(mat.code)"
                :title="getMaterialTooltip(mat, node.summonType)"
              >
                <img 
                  :src="getSmallPicUrl(mat.code)" 
                  class="material-card-img"
                  @error="handleImgError"
                />
                <!-- 根据召唤类型显示不同信息 -->
                <div v-if="node.summonType === 'LINK'" class="material-info">
                  {{ mat.isLink ? 'L' + mat.linkValue : '×1' }}
                </div>
                <div v-else class="material-level" :class="{ 'tuner-mark': mat.isTuner }">
                  {{ mat.isTuner ? '🎵' : '' }}★{{ mat.level }}
                </div>
                <div class="material-search-hint">🔍</div>
              </div>
              <!-- 召唤箭头 -->
              <div class="summon-arrow" :class="'arrow-' + (node.summonType || 'xyz').toLowerCase()">
                {{ getSummonArrow(node.summonType) }}
              </div>
            </div>
            <!-- 序号徽章 -->
            <div class="combo-seq-badge">{{ idx + 1 }}</div>
            <!-- 策略标签：初动点/手坑/动点 -->
            <div v-if="node.isStarter" class="combo-starter-badge">🎯 初动</div>
            <div v-else-if="node.isHandTrap" class="combo-handtrap-badge">🛡️ 手坑</div>
            <div v-else-if="node.isActionPoint" class="combo-action-badge">⚡ 动点</div>
            <!-- 响应/效果类型标记（非策略标签时显示） -->
            <div v-else-if="node.effectType && node.type === 'CHAIN'" 
              class="combo-effect-type-badge"
              :class="'effect-type-' + node.effectType"
              :style="{ '--effect-color': node.effectColor }"
            >
              {{ node.effectIcon }} {{ node.effectLabel }}
            </div>
            <!-- 连锁号码徽章 + 咒文速度 -->
            <div v-if="node.chainNum" class="combo-chain-badge" :class="'spell-speed-' + (node.spellSpeed || 1)">
              ⛓{{ node.chainNum }}
              <span v-if="node.spellSpeed > 1" class="spell-speed-indicator">S{{ node.spellSpeed }}</span>
            </div>
            <img 
              :src="getSmallPicUrl(node.cardCode)" 
              class="combo-card-img"
              @error="handleImgError"
            />
            <!-- 搜索按钮 - 点击搜索该卡可召唤的额外卡组怪兽 -->
            <!-- <button 
              class="combo-search-btn"
              @click.stop="searchExtraDeckTargets(node.cardCode)"
              title="搜索可召唤的额外卡组怪兽"
            >🔍</button> -->
            <div class="combo-card-label">{{ node.shortLabel }}</div>
            <div class="combo-card-name">{{ node.cardName }}</div>
            <!-- 资源变化指示器 -->
            <div 
              v-if="node.entropy && Math.abs(node.entropy.delta) > 0.5" 
              class="combo-entropy-badge"
              :class="node.entropy.delta > 0 ? 'entropy-positive' : 'entropy-negative'"
              :title="getResourceChangeTitle(node.entropy.delta)"
            >
              <span class="entropy-icon">{{ node.entropy.delta > 0 ? '📈' : '📉' }}</span>
              <span class="entropy-value">{{ getResourceChangeLabel(node.entropy.delta) }}</span>
            </div>
            <!-- 连锁信息悬停面板 -->
            <div v-if="node.chainInfo && node.chainInfo.length > 1" class="combo-chain-tooltip">
              <div class="chain-tooltip-title">⛓ 连锁序列</div>
              <div 
                v-for="(chain, chainIdx) in node.chainInfo" 
                :key="'chain-tip-' + chainIdx"
                class="chain-tooltip-item"
                :class="{ 'current-chain': chain.chainNum === node.chainNum }"
              >
                <img 
                  :src="getSmallPicUrl(chain.code)" 
                  class="chain-tooltip-img"
                  @error="handleImgError"
                />
                <div class="chain-tooltip-info">
                  <span class="chain-tooltip-num">{{ chain.chainNum }}</span>
                  <span class="chain-tooltip-name">{{ chain.name }}</span>
                  <span class="chain-tooltip-loc">{{ chain.location }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

      <!-- 右侧面板 - 日志和连锁 -->
      <div class="right-panel">
        <!-- 书签面板 -->
        <div v-if="bookmarksPanelVisible" class="bookmarks-panel">
          <div class="bookmarks-header">
            <span class="bookmarks-title">📌 书签列表</span>
            <div class="bookmarks-header-actions">
              <button 
                class="auto-bookmark-toggle" 
                :class="{ active: autoBookmarkEnabled }"
                @click="toggleAutoBookmark"
                title="自动关键节点书签"
              >
                🤖 {{ autoBookmarkEnabled ? 'ON' : 'OFF' }}
              </button>
              <button class="clear-bookmarks-btn" @click="clearAllBookmarks" v-if="bookmarks.length" title="清空所有书签">🗑️</button>
            </div>
          </div>
          
          <!-- 自动书签设置 -->
          <div v-if="autoBookmarkEnabled" class="auto-bookmark-settings">
            <div class="settings-title">🎯 自动检测项目</div>
            <div class="settings-grid">
              <label class="setting-item">
                <input type="checkbox" v-model="autoBookmarkSettings.handTrap" />
                <span>🛡️ 手坑发动</span>
              </label>
              <label class="setting-item">
                <input type="checkbox" v-model="autoBookmarkSettings.multiChain" />
                <span>⛓️ 多重连锁</span>
              </label>
              <label class="setting-item">
                <input type="checkbox" v-model="autoBookmarkSettings.chainNegated" />
                <span>❌ 效果无效</span>
              </label>
              <label class="setting-item">
                <input type="checkbox" v-model="autoBookmarkSettings.majorLpChange" />
                <span>💔 重大伤害</span>
              </label>
              <label class="setting-item">
                <input type="checkbox" v-model="autoBookmarkSettings.keyMonster" />
                <span>⭐ 关键怪兽</span>
              </label>
              <label class="setting-item">
                <input type="checkbox" v-model="autoBookmarkSettings.damageStep" />
                <span>⚔️ 伤害步骤</span>
              </label>
            </div>
          </div>
          <div class="bookmarks-list" v-if="bookmarks.length">
            <div 
              v-for="bookmark in bookmarks" 
              :key="bookmark.id" 
              class="bookmark-item"
              :class="{ 'auto-bookmark': bookmark.isAuto }"
              @click="jumpToBookmark(bookmark)"
            >
              <div class="bookmark-main">
                <div class="bookmark-turn-phase">
                  <span class="bookmark-turn">T{{ bookmark.turn }}</span>
                  <span v-if="bookmark.isAuto" class="auto-badge">自动</span>
                  <span class="bookmark-phase">{{ bookmark.phaseName }}</span>
                </div>
                <div class="bookmark-lp">
                  <span class="lp-self">{{ bookmark.lp[0] }}</span>
                  <span class="lp-divider">vs</span>
                  <span class="lp-opp">{{ bookmark.lp[1] }}</span>
                </div>
              </div>
              <div class="bookmark-note-row" v-if="editingBookmarkId === bookmark.id">
                <input 
                  type="text" 
                  class="bookmark-note-input" 
                  v-model="editingBookmarkNote"
                  @click.stop
                  @keyup.enter="saveBookmarkNote"
                  @keyup.esc="cancelEditBookmarkNote"
                  placeholder="输入备注..."
                  ref="bookmarkNoteInput"
                />
                <button class="note-save-btn" @click.stop="saveBookmarkNote">✓</button>
                <button class="note-cancel-btn" @click.stop="cancelEditBookmarkNote">✕</button>
              </div>
              <div class="bookmark-note-row" v-else>
                <span class="bookmark-note" v-if="bookmark.note" :title="bookmark.note">{{ bookmark.note }}</span>
                <span class="bookmark-note empty" v-else>点击编辑备注...</span>
                <button class="note-edit-btn" @click.stop="startEditBookmarkNote(bookmark)" title="编辑备注">✏️</button>
              </div>
              <div class="bookmark-field-summary">
                <span class="field-monsters" v-if="bookmark.fieldSummary.monsters[0].length || bookmark.fieldSummary.monsters[1].length">
                  ⚔️ {{ bookmark.fieldSummary.monsters[0].length }} vs {{ bookmark.fieldSummary.monsters[1].length }}
                </span>
                <span class="field-step">步骤 #{{ bookmark.step }}</span>
              </div>
              <button class="bookmark-delete-btn" @click.stop="deleteBookmark(bookmark.id)" title="删除书签">×</button>
            </div>
          </div>
          <div class="bookmarks-empty" v-else>
            <div class="empty-icon">📭</div>
            <div class="empty-text">暂无书签</div>
            <div class="empty-hint">点击"📌 添书签"添加关键时刻</div>
          </div>
        </div>

        <!-- 连锁显示 -->
        <div v-if="field.chains.length > 0" class="chain-display">
          <div class="chain-title">连锁 ({{ field.chains.length }})</div>
          <div v-for="(chain, idx) in field.chains" :key="'chain-' + idx" class="chain-item">
            {{ idx + 1 }}: {{ getCardName(chain.code) }}
          </div>
        </div>

        <!-- 消息日志 -->
        <div class="message-log">
          <div class="log-title">消息日志</div>
          <div class="log-content" ref="logContent">
            <div v-for="(msg, idx) in messages" :key="'msg-' + idx" class="log-item"
              :class="'msg-' + getMessageName(msg.type).toLowerCase()">
              [{{ msg.step }}] {{ getMessageName(msg.type) }}: {{ msg.desc }}
            </div>
          </div>
        </div>
      </div>

      <!-- 卡片详情弹窗 -->
      <div v-if="selectedCard" class="card-detail-modal" @click="selectedCard = null">
        <div class="card-detail" @click.stop>
          <div class="card-header">
            <span class="card-name">{{ getCardName(selectedCard.code) }}</span>
            <button class="close-btn" @click="selectedCard = null">×</button>
          </div>
          <div class="card-body">
            <img v-if="selectedCard.code" :src="getLargePicUrl(selectedCard.code)" class="detail-card-img" @error="handleImageError" />
            <div class="card-info-row">
              <span>控制者: {{ duelInfo.players[selectedCard.controller] }}</span>
            </div>
            <div class="card-info-row">
              <span>位置: {{ getLocationName(selectedCard.location) }} [{{ selectedCard.sequence }}]</span>
            </div>
            <div class="card-info-row">
              <span>表示形式: {{ getPositionName(selectedCard.position) }}</span>
            </div>
            <div class="card-info-row" v-if="selectedCard.attack !== undefined">
              <span>ATK: {{ selectedCard.attack }} / DEF: {{ selectedCard.defense }}</span>
            </div>
            <div class="card-info-row" v-if="selectedCard.level">
              <span>等级: {{ selectedCard.level }}</span>
            </div>
            <div class="card-info-row" v-if="selectedCard.rank">
              <span>阶级: {{ selectedCard.rank }}</span>
            </div>
            <div class="card-info-row" v-if="selectedCard.overlays && selectedCard.overlays.length">
              <span>叠放素材: {{ selectedCard.overlays.join(', ') }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 区域卡片查看弹窗 -->
      <div v-if="zoneViewVisible" class="zone-view-modal" @click="closeZoneView">
        <div class="zone-view-panel" @click.stop>
          <div class="zone-view-header">
            <span class="zone-view-title">{{ zoneViewTitle }} ({{ zoneViewCards.length }})</span>
            <button class="close-btn" @click="closeZoneView">×</button>
          </div>
          <div class="zone-view-body">
            <div v-if="zoneViewCards.length === 0" class="zone-empty">
              暂无卡片
            </div>
            <div v-else class="zone-card-grid">
              <div v-for="item in zoneViewCards" :key="'zone-card-' + item.index" 
                class="zone-card-item" @click="onZoneCardClick(item)">
                <div class="zone-card-img-wrapper">
                  <img :src="getSmallPicUrl(item.code)" 
                    class="zone-card-img" 
                    @error="handleImgError" />
                  <span class="zone-card-index">#{{ item.index }}</span>
                </div>
                <div class="zone-card-name" :title="item.name">{{ item.name }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 额外卡组搜索结果弹窗 -->
      <!-- <ExtraDeckSearchModal
        :visible="extraDeckSearchVisible"
        :material="extraDeckSearchMaterial"
        :results="extraDeckSearchResults"
        :loading="extraDeckSearchLoading"
        :filter-by-self-desc="extraDeckFilterBySelfDesc"
        :self-desc-restrictions="currentSelfDescRestrictions"
        :expanded="extraDeckExpanded"
        :show-count="extraDeckShowCount"
        :get-small-pic-url="getSmallPicUrl"
        :get-setcode-name="getSetcodeNameFromComposable"
        @close="closeExtraDeckSearch"
        @card-click="onExtraSearchResultClick"
        @toggle-section="toggleExtraDeckSection"
        @load-more="loadMoreExtraDeckResults"
        @toggle-self-desc-filter="toggleSelfDescFilter"
      /> -->
    </div>

    <!-- 隐藏的文件输入 -->
    <input type="file" ref="fileInput" style="display: none" accept=".yrp,.yrpX" @change="handleFileSelected" />

    <!-- 错误显示 -->
    <div v-if="error" class="error-toast" @click="error = null">
      {{ error }}
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, nextTick } from 'vue'
import OCGCore from '../lib/ocgcore_wasm.js'
import LZMA from '../lib/lzma.js'
// import ExtraDeckSearchModal from './ExtraDeckSearchModal.vue'
// import { useExtraDeckSearch } from '../composables/useExtraDeckSearch.js'

// 定义事件
const emit = defineEmits(['close'])

// ========== 常量定义 (来自 ygopro-core-master/common.h) ==========

// 消息类型
const MSG = {
  RETRY: 1,
  HINT: 2,
  WAITING: 3,
  START: 4,
  WIN: 5,
  UPDATE_DATA: 6,
  UPDATE_CARD: 7,
  SELECT_BATTLECMD: 10,
  SELECT_IDLECMD: 11,
  SELECT_EFFECTYN: 12,
  SELECT_YESNO: 13,
  SELECT_OPTION: 14,
  SELECT_CARD: 15,
  SELECT_CHAIN: 16,
  SELECT_PLACE: 18,
  SELECT_POSITION: 19,
  SELECT_TRIBUTE: 20,
  SELECT_COUNTER: 22,
  SELECT_SUM: 23,
  SELECT_DISFIELD: 24,
  SORT_CARD: 25,
  SELECT_UNSELECT_CARD: 26,
  CONFIRM_DECKTOP: 30,
  CONFIRM_CARDS: 31,
  SHUFFLE_DECK: 32,
  SHUFFLE_HAND: 33,
  REFRESH_DECK: 34,
  SWAP_GRAVE_DECK: 35,
  SHUFFLE_SET_CARD: 36,
  REVERSE_DECK: 37,
  DECK_TOP: 38,
  SHUFFLE_EXTRA: 39,
  NEW_TURN: 40,
  NEW_PHASE: 41,
  CONFIRM_EXTRATOP: 42,
  MOVE: 50,
  POS_CHANGE: 53,
  SET: 54,
  SWAP: 55,
  FIELD_DISABLED: 56,
  SUMMONING: 60,
  SUMMONED: 61,
  SPSUMMONING: 62,
  SPSUMMONED: 63,
  FLIPSUMMONING: 64,
  FLIPSUMMONED: 65,
  CHAINING: 70,
  CHAINED: 71,
  CHAIN_SOLVING: 72,
  CHAIN_SOLVED: 73,
  CHAIN_END: 74,
  CHAIN_NEGATED: 75,
  CHAIN_DISABLED: 76,
  CARD_SELECTED: 80,
  RANDOM_SELECTED: 81,
  BECOME_TARGET: 83,
  DRAW: 90,
  DAMAGE: 91,
  RECOVER: 92,
  EQUIP: 93,
  LPUPDATE: 94,
  UNEQUIP: 95,
  CARD_TARGET: 96,
  CANCEL_TARGET: 97,
  PAY_LPCOST: 100,
  ADD_COUNTER: 101,
  REMOVE_COUNTER: 102,
  ATTACK: 110,
  BATTLE: 111,
  ATTACK_DISABLED: 112,
  DAMAGE_STEP_START: 113,
  DAMAGE_STEP_END: 114,
  MISSED_EFFECT: 120,
  TOSS_COIN: 130,
  TOSS_DICE: 131,
  ROCK_PAPER_SCISSORS: 132,
  HAND_RES: 133,
  ANNOUNCE_RACE: 140,
  ANNOUNCE_ATTRIB: 141,
  ANNOUNCE_CARD: 142,
  ANNOUNCE_NUMBER: 143,
  CARD_HINT: 160,
  TAG_SWAP: 161,
  RELOAD_FIELD: 162,
  AI_NAME: 163,
  SHOW_HINT: 164,
  PLAYER_HINT: 165,
  MATCH_KILL: 170
}

// 位置常量
const LOCATION = {
  DECK: 0x01,
  HAND: 0x02,
  MZONE: 0x04,
  SZONE: 0x08,
  GRAVE: 0x10,
  REMOVED: 0x20,
  EXTRA: 0x40,
  OVERLAY: 0x80,
  ONFIELD: 0x0C,
  FZONE: 0x100,
  PZONE: 0x200
}

// 表示形式
const POS = {
  FACEUP_ATTACK: 0x1,
  FACEDOWN_ATTACK: 0x2,
  FACEUP_DEFENSE: 0x4,
  FACEDOWN_DEFENSE: 0x8,
  FACEUP: 0x5,
  FACEDOWN: 0xa,
  ATTACK: 0x3,
  DEFENSE: 0xc
}

// 阶段
const PHASE = {
  DRAW: 0x01,
  STANDBY: 0x02,
  MAIN1: 0x04,
  BATTLE_START: 0x08,
  BATTLE_STEP: 0x10,
  DAMAGE: 0x20,
  DAMAGE_CAL: 0x40,
  BATTLE: 0x80,
  MAIN2: 0x100,
  END: 0x200
}

// 查询标志
const QUERY = {
  CODE: 0x1,
  POSITION: 0x2,
  ALIAS: 0x4,
  TYPE: 0x8,
  LEVEL: 0x10,
  RANK: 0x20,
  ATTRIBUTE: 0x40,
  RACE: 0x80,
  ATTACK: 0x100,
  DEFENSE: 0x200,
  BASE_ATTACK: 0x400,
  BASE_DEFENSE: 0x800,
  REASON: 0x1000,
  REASON_CARD: 0x2000,
  EQUIP_CARD: 0x4000,
  TARGET_CARD: 0x8000,
  OVERLAY_CARD: 0x10000,
  COUNTERS: 0x20000,
  OWNER: 0x40000,
  STATUS: 0x80000,
  LSCALE: 0x200000,
  RSCALE: 0x400000,
  LINK: 0x800000
}

// 处理器标志
const PROCESSOR = {
  FLAG: 0xf0000000,
  BUFFER_LEN: 0x0fffffff,
  NONE: 0,
  WAITING: 0x10000000,
  END: 0x20000000
}

// 回放标志
const REPLAY_FLAG = {
  COMPRESSED: 0x1,
  TAG: 0x2,
  DECODED: 0x4,
  SINGLE_MODE: 0x8,
  UNIFORM: 0x10
}

const REPLAY_ID = {
  YRP1: 0x31707279,
  YRP2: 0x32707279
}

// 查询标志组合
const QUERY_FLAG_DEFAULT = QUERY.CODE | QUERY.POSITION | QUERY.ALIAS | QUERY.TYPE |
  QUERY.LEVEL | QUERY.RANK | QUERY.ATTRIBUTE | QUERY.RACE |
  QUERY.ATTACK | QUERY.DEFENSE | QUERY.EQUIP_CARD |
  QUERY.OVERLAY_CARD | QUERY.COUNTERS | QUERY.LSCALE | QUERY.RSCALE | QUERY.LINK

const QUERY_FLAG_HAND = QUERY.CODE | QUERY.POSITION | QUERY.ALIAS | QUERY.TYPE |
  QUERY.LEVEL | QUERY.RANK | QUERY.ATTRIBUTE | QUERY.RACE |
  QUERY.ATTACK | QUERY.DEFENSE | QUERY.LSCALE | QUERY.RSCALE | QUERY.LINK

const QUERY_FLAG_GRAVE = QUERY.CODE | QUERY.POSITION | QUERY.ALIAS | QUERY.TYPE |
  QUERY.LEVEL | QUERY.RANK | QUERY.ATTRIBUTE | QUERY.RACE |
  QUERY.ATTACK | QUERY.DEFENSE | QUERY.LSCALE | QUERY.RSCALE | QUERY.LINK

// 获取 Vite base URL
const BASE_URL = import.meta.env.BASE_URL || '/'

// 卡图路径配置（性能优化）
// 小图用于列表/网格等小尺寸场景，大图用于详情查看
const PICS_PATH = 'pics/'  // 大图路径
const PICS_SMALL_PATH = 'pics_small/'  // 小图路径
const USE_SMALL_PICS = true  // 是否启用小图（设为false则全部使用大图）

/**
 * 获取小图URL（用于列表、网格、combo节点等小尺寸场景）
 * @param {number} code - 卡片代码
 */
function getSmallPicUrl(code) {
  if (USE_SMALL_PICS) {
    return BASE_URL + PICS_SMALL_PATH + code + '.jpg'
  }
  return BASE_URL + PICS_PATH + code + '.jpg'
}

/**
 * 获取大图URL（用于详情查看等需要高清的场景）
 * @param {number} code - 卡片代码
 */
function getLargePicUrl(code) {
  return BASE_URL + PICS_PATH + code + '.jpg'
}

// 图片加载错误处理函数（性能优化：避免在v-for中创建内联函数）
// 如果是小图加载失败，尝试加载大图；如果大图也失败，显示默认图
function handleImgError(e) {
  const src = e.target.src
  // 如果是小图加载失败，尝试加载大图
  if (USE_SMALL_PICS && src.includes(PICS_SMALL_PATH)) {
    e.target.src = src.replace(PICS_SMALL_PATH, PICS_PATH)
  } else {
    e.target.src = BASE_URL + 'images/back.jpg'
  }
}

// Buffer size constants
const SIZE_MESSAGE_BUFFER = 0x2000
const SIZE_RETURN_VALUE = 512
const PROCESSOR_BUFFER_LEN = 0x0fffffff
const PROCESSOR_WAITING = 0x10000000
const PROCESSOR_END = 0x20000000

// Card artwork versions offset (from ygopro-core-master/card_data.h)
// Cards with alias within this range are considered alternative artworks
const CARD_ARTWORK_VERSIONS_OFFSET = 20
const CARD_BLACK_LUSTER_SOLDIER2 = 72989439

// Check if card is an alternative artwork version (from ygopro-core-master/card_data.h)
function isAlternativeArtwork(code, alias) {
  if (code === CARD_BLACK_LUSTER_SOLDIER2) return false
  return alias && (alias < code + CARD_ARTWORK_VERSIONS_OFFSET) && (code < alias + CARD_ARTWORK_VERSIONS_OFFSET)
}

// Get the original code for script loading (matches ygopro-core get_original_code)
// For alternative artwork cards, returns the alias code
function getOriginalCode(code, alias) {
  return isAlternativeArtwork(code, alias) ? alias : code
}

// Mersenne Twister (mt19937) implementation matching C++ std::mt19937
// Used for YRP1 replay seed generation: std::mt19937 rnd(seed); create_duel(rnd());
class MersenneTwister {
  constructor(seed) {
    this.N = 624
    this.M = 397
    this.MATRIX_A = 0x9908b0df
    this.UPPER_MASK = 0x80000000
    this.LOWER_MASK = 0x7fffffff
    this.mt = new Uint32Array(this.N)
    this.mti = this.N + 1
    this.initGenRand(seed >>> 0)
  }

  initGenRand(seed) {
    this.mt[0] = seed >>> 0
    for (this.mti = 1; this.mti < this.N; this.mti++) {
      const s = this.mt[this.mti - 1] ^ (this.mt[this.mti - 1] >>> 30)
      // Use BigInt for intermediate calculation to avoid JS number overflow
      this.mt[this.mti] = (((((s & 0xffff0000) >>> 16) * 1812433253) << 16) + (s & 0x0000ffff) * 1812433253 + this.mti) >>> 0
    }
  }

  genRandInt32() {
    let y
    const mag01 = [0, this.MATRIX_A]

    if (this.mti >= this.N) {
      let kk

      for (kk = 0; kk < this.N - this.M; kk++) {
        y = (this.mt[kk] & this.UPPER_MASK) | (this.mt[kk + 1] & this.LOWER_MASK)
        this.mt[kk] = this.mt[kk + this.M] ^ (y >>> 1) ^ mag01[y & 0x1]
      }
      for (; kk < this.N - 1; kk++) {
        y = (this.mt[kk] & this.UPPER_MASK) | (this.mt[kk + 1] & this.LOWER_MASK)
        this.mt[kk] = this.mt[kk + (this.M - this.N)] ^ (y >>> 1) ^ mag01[y & 0x1]
      }
      y = (this.mt[this.N - 1] & this.UPPER_MASK) | (this.mt[0] & this.LOWER_MASK)
      this.mt[this.N - 1] = this.mt[this.M - 1] ^ (y >>> 1) ^ mag01[y & 0x1]

      this.mti = 0
    }

    y = this.mt[this.mti++]

    // Tempering
    y ^= (y >>> 11)
    y ^= (y << 7) & 0x9d2c5680
    y ^= (y << 15) & 0xefc60000
    y ^= (y >>> 18)

    return y >>> 0
  }
}

// ========== 状态变量 (对应 ygopro ReplayMode 静态变量) ==========

// OCGCore 实例
let pduel = null
let ocgModule = null
let sqlDb = null
const ocgReady = ref(false)
const dbReady = ref(false)
const scriptsLoaded = ref(false)

// 脚本缓存
const scriptCache = new Map()

// 卡片数据库缓存
const cardDatabase = new Map()

// 回放解析器
let replayHeader = null
let replayParams = null
let replayDecks = []
let replayPlayers = []
let replaySeedSequence = null  // YRP2 seed sequence

// 控制标志 (对应 ygopro ReplayMode)
const isContinuing = ref(true)
const isClosing = ref(false)
const isPausing = ref(false)
const isPaused = ref(false)
const isSwapping = ref(false)
const isRestarting = ref(false)
const exitPending = ref(false)
const skipTurn = ref(0)
const currentStep = ref(0)
const skipStep = ref(0)

// 状态
const isLoaded = ref(false)
const isLoading = ref(false)
const isStarted = ref(false)
const isFinished = ref(false)
const isReplaySkipping = ref(false)
const error = ref(null)

// 播放速度
const playbackSpeed = ref(100)

// 加载进度
const loadingStatus = ref('')
const loadingProgress = ref(0)
const loadingProgressText = ref('')

// 决斗信息
const duelInfo = reactive({
  isFirst: true,
  isTag: false,
  isSingleMode: false,
  turn: 0,
  phase: 0,
  currentPlayer: 0,
  lp: [8000, 8000],
  startLp: 8000,
  curMsg: 0,
  players: ['Player 1', 'Player 2'],
  isReplaySwapped: false,
  duelRule: 5
})

// 场面状态
const field = reactive({
  players: [
    {
      mzone: Array(7).fill(null),
      szone: Array(8).fill(null),
      hand: [],
      grave: [],
      removed: [],
      deck: 0,
      extra: 0,
      extraFaceup: 0
    },
    {
      mzone: Array(7).fill(null),
      szone: Array(8).fill(null),
      hand: [],
      grave: [],
      removed: [],
      deck: 0,
      extra: 0,
      extraFaceup: 0
    }
  ],
  chains: []
})

// 响应
const responses = ref([])
const responseIndex = ref(0)

// 预加载相关
const isPreloading = ref(false)
const preloadProgress = ref(0)
const preloadedMessages = ref([])  // 存储预加载的所有消息
const usePreloadedData = ref(false)  // 是否使用预加载数据播放
const preloadedMessageIndex = ref(0)  // 当前播放的预加载消息索引

// 状态快照（用于上一步功能）
const stateSnapshots = ref([])  // 存储每一步的状态快照
const maxSnapshots = 500  // 最多保存500个快照
let stepBackPending = false  // 标记是否有回退操作待处理

// 书签系统
const bookmarks = ref([])  // 书签列表
const bookmarksPanelVisible = ref(false)  // 书签面板是否可见
const editingBookmarkId = ref(null)  // 正在编辑备注的书签ID
const editingBookmarkNote = ref('')  // 编辑中的备注内容
let bookmarkIdCounter = 0  // 书签ID计数器

// 自动书签设置
const autoBookmarkEnabled = ref(true)  // 是否启用自动书签
const autoBookmarkSettings = reactive({
  handTrap: true,        // 手坑发动
  multiChain: true,      // 多重连锁（>=3）
  chainNegated: true,    // 效果/发动被无效
  damageStep: true,      // 伤害步骤
  majorLpChange: true,   // 重大LP变化（>=50%）
  keyMonster: true,      // 关键怪兽召唤
  turnEnd: false,        // 回合结束场面
  battlePhase: false     // 战斗阶段开始
})

// 常见手坑卡片代码 (基于OCG规则中提到的典型手坑)
const HAND_TRAP_CODES = new Set([
  14558127,   // 灰流丽
  23434538,   // 增殖的G
  10045474,   // 无限泡影
  59438930,   // 屋敷童
  94145021,   // DD乌鸦
  15693423,   // 幽鬼兔
  73642296,   // 飞翔百合
  97268402,   // 朔夜时雨
  24207889,   // 浮幽樱
  62015408,   // 原始生命态 尼比鲁
  2295440,    // 赫灼龙 王后
  43898403,   // 接触的宇宙 G
  83764718,   // 增殖的G (备用)
  59503527,   // PSY骨架装备·γ
  38814750,   // 效果遮蒙者
  52038441,   // 神之通告
  41420027,   // 神之警告
  40605147,   // 神之宣告
  84749824,   // 红色重启
])

// 关键效果怪兽（终端场、压制类）
const KEY_MONSTER_CODES = new Set([
  86120751,   // 水晶翼同调龙
  3987233,    // 召唤兽 梅尔卡巴
  97631303,   // 神影依·米德拉什
  41420027,   // 虹光之宣告者
  68468459,   // 烙印神殿 阿尔比昂
  78661338,   // 深渊龙
  48424886,   // 饼蛙
  65741786,   // 电脑堺门-青龙
  11502550,   // IP：女圣骑士
  2857636,    // 闪刀姬-罗泽
  60303688,   // 编码语者
  1861629,    // 阿波罗萨·弓箭龙
  90809975,   // 召命之神弓-阿波罗萨
  26847978,   // 源龙星-望天吼
])

// 追踪上一次自动书签的步骤，避免重复
let lastAutoBookmarkStep = -1
let lastLpBookmarkTurn = [-1, -1]  // 每个玩家上次LP书签的回合

// 消息日志 - 增加限制以支持完整对局记录导出
const messages = ref([])
const maxMessages = 10000  // 增加到10000条以支持完整导出

// UI
const selectedCard = ref(null)
const fileInput = ref(null)
const logContent = ref(null)

// 区域卡片查看
const zoneViewVisible = ref(false)
const zoneViewTitle = ref('')
const zoneViewCards = ref([])


// 文字解说模式
const commentaryModeEnabled = ref(false)
const commentaryEntries = ref([])
const commentaryContent = ref(null)
const maxCommentaryEntries = 500  // 最多保留500条解说

// 解说员角色系统
const commentatorCharacter = ref('default')  // 当前选择的解说员
const showCommentatorSelector = ref(false)   // 显示角色选择器

// 解说员角色配置
const commentatorCharacters = {
  default: {
    id: 'default',
    name: '标准解说',
    avatar: '📝',
    color: '#667eea',
    description: '标准的对局解说风格'
  },
  yusei: {
    id: 'yusei',
    name: '不动游星',
    avatar: '🏍️',
    color: '#ff6b35',
    description: '《游戏王5D\'s》主角，同调之王',
    quotes: {
      // 召唤相关
      SPSUMMON: [
        // 同调召唤专用
        { condition: 'synchro', texts: [
          '集结之愿将变成闪耀的新星！成为光明道路吧！同调召唤！飞翔吧，「{cardName}」！',
          '聚集的星光将指引新的力量！现身吧，同调怪兽！「{cardName}」！',
          '穿越星空的羁绊！化作希望的光芒吧！同调召唤！「{cardName}」！',
          '奔驰的骏马与星之意志同调！现身吧！「{cardName}」！',
          '将一切思念寄托于此！同调召唤！来吧，「{cardName}」！',
          '命运的齿轮开始转动！同调召唤！「{cardName}」！',
        ]},
        // 流星龙专用
        { condition: 'cardName:流星龙', texts: [
          '集结的祈愿将成为新生的闪耀之星！成为光明之路吧！光速同调！翱翔吧，「流星龙」！',
          '无限的可能性与星之意志共鸣！光速同调！现身吧，「流星龙」！',
        ]},
        // 星尘龙专用
        { condition: 'cardName:星尘龙', texts: [
          '聚集的星光将照亮新的道路！化为闪耀之力吧！同调召唤！翱翔吧，「星尘龙」！',
          '集结的梦想化作无尽星辰！同调召唤！飞翔吧，「星尘龙」！',
        ]},
        // 通用特殊召唤
        { condition: 'default', texts: [
          '出来吧，「{cardName}」！',
          '现身吧，我的怪兽！「{cardName}」！',
          '这是...希望的力量！来吧，「{cardName}」！',
          '羁绊所召唤的力量！「{cardName}」！',
        ]}
      ],
      SUMMON: [
        '我通常召唤「{cardName}」！',
        '出来吧，「{cardName}」！',
        '上吧，「{cardName}」！',
      ],
      // 效果发动
      CHAIN: [
        '发动效果！「{cardName}」！',
        '这里就是转折点！「{cardName}」的效果发动！',
        '看招！「{cardName}」的效果！',
        '这就是我的决斗！「{cardName}」的效果发动！',
        '抓住这一瞬间！「{cardName}」！',
        '加速！「{cardName}」的效果！',
      ],
      // 攻击
      ATTACK: [
        '「{attacker}」，攻击！',
        '上吧！「{attacker}」！直接攻击！',
        '全力冲击！「{attacker}」！',
        '一鼓作气！「{attacker}」！攻击！',
        '这是我们的羁绊之力！「{attacker}」！',
      ],
      // 伤害
      DAMAGE: [
        '呜...！受到了{value}点伤害！但决斗者不会认输！',
        '这程度的伤害...！(LP: {remainingLP})',
        '可恶...！但我不会放弃！(LP: {remainingLP})',
        '只要还有LP就还能战斗！(LP: {remainingLP})',
      ],
      // 回复
      RECOVER: [
        '生命值回复{value}！(LP: {remainingLP})',
        '还能继续战斗！(LP: {remainingLP})',
      ],
      // 回合开始
      NEW_TURN: [
        '我的回合！抽卡！',
        '我的回合，抽卡！让我来指引通往未来的道路！',
        '轮到我了！这一抽将决定命运！',
        '我的回合！只要有羁绊就不会输！',
        '回合{turn}！我的回合开始！',
      ],
      // 阶段
      NEW_PHASE: [
        '进入{phaseName}！',
        '{phaseName}！',
      ],
      // 抽卡
      DRAW: [
        '抽卡！...是「{cards}」！',
        '命运之抽！{cards}！',
        '这张卡...！{cards}！就是这个！',
        '相信卡组，抽卡！{cards}！',
      ],
      // 战斗判定
      BATTLE: [
        '战斗！「{attacker}」(ATK:{attackerAtk}) 对「{defender}」({defStat})！',
        '力量的碰撞！「{attacker}」(ATK:{attackerAtk}) VS 「{defender}」({defStat})！',
      ],
      // 胜利
      WIN: [
        '决斗结束！这就是...我们的羁绊之力！',
        '我们赢了！这是大家一起努力的结果！',
        '胜利了！通往未来的道路...已经打开！',
      ],
      // 放置卡片
      SET: [
        '我放置一张卡结束回合。',
        '这张卡...先放置着。',
        '布下一张卡。',
      ],
      // 特殊语录 - 骑乘决斗风格
      SPECIAL: [
        '骑乘决斗...加速！',
        '我们的战斗还没有结束！',
        '决斗者的灵魂永远不会熄灭！',
        '只要相信同伴...就能创造奇迹！',
        '这是我的决斗之路！',
      ]
    }
  },
  m: {
    id: 'm',
    name: '？',
    avatar: '🎮',
    color: '#f5adc1',
    description: '幽默吐槽流up主',
    quotes: {
      // 召唤相关
      SPSUMMON: [
        // 同调召唤
        { condition: 'synchro', texts: [
          '星格罗召唤！「{cardName}」登场！',
          '心库罗撒蒙！出「{cardName}」！这波操作满分。',
          '调整+非调整，星格罗召唤「{cardName}」！教科书级别的展开。',
          '这波心库罗很稳，「{cardName}」出场！',
          '星格罗召唤！「{cardName}」！懂的都懂。',
        ]},
        // 超量召唤
        { condition: 'xyz', texts: [
          '艾库希兹召唤！「{cardName}」！叠放素材，准备发力！',
          '两只怪兽叠一起，艾库希兹召唤「{cardName}」！',
          '艾库希兹召唤！「{cardName}」！这就是数字力量！',
        ]},
        // 链接召唤
        { condition: 'link', texts: [
          '林库召唤！「{cardName}」！连接箭头已确认！',
          '素材送走，林库召唤「{cardName}」！打开格子！',
          'Link（林库）召唤！「{cardName}」出场！现在才刚刚开始！',
        ]},
        // 融合召唤
        { condition: 'fusion', texts: [
          '融合（融够）召唤！「{cardName}」！经典永不过时。',
          '素材往墓地一丢，融合召唤「{cardName}」！',
          '融合！「{cardName}」登场！这波赚麻了。',
        ]},
        // 灵摆召唤
        { condition: 'pendulum', texts: [
          '刻度设置完毕，灵摆召唤！一口气出「{cardName}」！',
          '灵摆区发动！大量怪兽涌出来！「{cardName}」！',
        ]},
        // 通用特殊召唤
        { condition: 'default', texts: [
          '「{cardName}」特殊召唤（特速撒蒙）！又是白嫖的一天。',
          '特速撒蒙「{cardName}」！这卡不花召唤权，赚到了。',
          '跳出来了！「{cardName}」特殊召唤成功！',
          '白给的特速撒蒙，「{cardName}」出场！',
          '「{cardName}」从天而降！这就是展开。',
        ]}
      ],
      SUMMON: [
        '撒蒙「{cardName}」！吃掉通常召唤权了。',
        '通常召唤（诺莫撒蒙）「{cardName}」，一回合就这一次，且用且珍惜。',
        '出「{cardName}」！正常操作。',
        '撒蒙！「{cardName}」！开始干活。',
      ],
      // 效果发动
      CHAIN: [
        '艾菲库多发动！「{cardName}」的效果，开始整活了！',
        '「{cardName}」效果发动！让我们看看这波能干什么。',
        '艾菲库多发动！「{cardName}」！这张卡真的离谱。',
        '发动（阿库提布）！「{cardName}」！懂的都懂。',
        '「{cardName}」艾菲库多发动！经典卡就是经典。',
        '来了来了，琴（Chain）发动！「{cardName}」效果！准备表演。',
        '触发了！「{cardName}」艾菲库多发动！',
        '「{cardName}」！这张卡太版本了。',
      ],
      // 攻击
      ATTACK: [
        '阿塔库！「{attacker}」直接开打！',
        '攻击（阿塔库）！「{attacker}」冲上去了！',
        '「{attacker}」阿塔库！该收人头了。',
        '「{attacker}」出击！这波血赚。',
        '打！「{attacker}」阿塔库！',
        '「{attacker}」直接莽上去！',
      ],
      // 伤害
      DAMAGE: [
        '哎呀，吃了{value}点达没及（Damage）！(LP: {remainingLP}) 疼疼疼！',
        '好家伙，{value}点伤害直接糊脸！(LP: {remainingLP})',
        '达没及！-{value}！(LP: {remainingLP})',
        '这波亏了，吃{value}点达没及。(LP: {remainingLP})',
        '疼！{value}点伤害！(LP: {remainingLP}) 还能撑住。',
      ],
      // 回复
      RECOVER: [
        '回血+{value}！(LP: {remainingLP}) 续命成功！',
        '生命值回复{value}！(LP: {remainingLP}) 苟住了！',
        '奶了{value}血！(LP: {remainingLP}) 还能打！',
      ],
      // 回合开始
      NEW_TURN: [
        '欧累诺腾，多洛！让我看看抽到了什么好东西。',
        '回合开始！多洛！命运在此刻决定。',
        '第{turn}回合！欧累诺腾！多洛！',
        '多洛！这波是天胡还是天灾？',
        '我的回合（欧累诺腾）！多洛！开始表演！',
      ],
      // 阶段
      NEW_PHASE: [
        '进入{phaseName}！',
        '{phaseName}！该干正事了。',
        '好，{phaseName}！',
      ],
      // 抽卡
      DRAW: [
        '多洛到了...{cards}！还行还行。',
        '命运之多洛！{cards}！这波稳了。',
        '让我康康...{cards}！可以可以。',
        '多洛！{cards}！这就是信仰。',
        '看看是什么...{cards}！有点东西。',
      ],
      // 战斗判定
      BATTLE: [
        '战斗判定！「{attacker}」(ATK:{attackerAtk}) 打「{defender}」({defStat})！',
        '「{attacker}」({attackerAtk}) VS「{defender}」({defStat})！开始对撞！',
        '攻击力对比！{attackerAtk} VS {defStat}！结果显而易见。',
      ],
      // 胜利
      WIN: [
        '对局结束！GG！所列哇多卡纳！这波操作满分！',
        '赢了！游戏王就是这么简单。（误）',
        '胜利！今天又是胜利的一天！',
        '对手投了！这就是实力差距。',
      ],
      // 放置卡片
      SET: [
        '赛多（Set）一张卡，回合结束。这张卡绝对有问题。',
        '赛多一张，懂的都懂。',
        '放一张盖卡（赛多），钓鱼执法开始。',
        '赛多。（意味深长）',
      ],
      // 特殊语录
      SPECIAL: [
        '这波展开教学！',
        '典中典操作来了！',
        '有点东西！',
        '这卡组强度真的高。',
        '版本之子就是强。',
      ]
    }
  }
}

// 秘密触发序列 - 按顺序点击"决斗开始"激活解说模式
const secretSequence = ref([])  // 当前点击序列
let secretResetTimer = null  // 重置计时器

// Combo路线图 - 实时跟踪关键动作并生成可视化流程图
const comboTreeEntries = ref([])
const comboZoom = ref(1.0)
const useOptimizedLayout = ref(false) // 是否使用优化布局

// 额外卡组搜索 - 使用 composable
// const {
//   extraDeckSearchVisible,
//   extraDeckSearchMaterial,
//   extraDeckSearchResults,
//   extraDeckSearchLoading,
//   extraDeckFilterBySelfDesc,
//   currentSelfDescRestrictions,
//   extraDeckExpanded,
//   extraDeckShowCount,
//   searchExtraDeckTargets,
//   closeExtraDeckSearch,
//   toggleExtraDeckSection,
//   loadMoreExtraDeckResults,
//   onExtraSearchResultClick,
//   toggleSelfDescFilter,
//   getSetcodeName: getSetcodeNameFromComposable
// } = useExtraDeckSearch(cardDatabase, duelInfo, comboTreeEntries, selectedCard)

// ==================== 因果图模型 (Causal Graph DAG) ====================
/**
 * 因果边类型 - 表达不同类型的因果关系
 * @typedef {'SUMMON_MATERIAL' | 'EFFECT_TARGET' | 'COST' | 'SEARCH' | 'TEMPORAL' | 'CHAIN_RESPONSE' | 'TRIGGER' | 'HAND_ACTIVATION'} CausalEdgeType
 * 
 * SUMMON_MATERIAL - 召唤素材关系（同调/XYZ/Link素材）
 * EFFECT_TARGET - 效果对象关系（效果指定的对象）
 * COST - 代价关系（作为cost的卡片）
 * SEARCH - 检索关系（被检索的卡片）
 * TEMPORAL - 时序关系（纯时间顺序，无直接因果）
 * CHAIN_RESPONSE - 连锁响应关系
 * TRIGGER - 触发关系（诱发式效果）
 * HAND_ACTIVATION - 手牌发动关系
 */

/**
 * 因果图节点
 * @typedef {Object} CausalNode
 * @property {string} id - 唯一标识符 (step_cardCode)
 * @property {number} cardCode - 卡片代码
 * @property {string} cardName - 卡片名称
 * @property {string} type - 动作类型 'MOVE' | 'CHAIN' | 'SUMMON' | 'SPSUMMON'
 * @property {string} detail - 详细描述
 * @property {number} timestamp - 时间戳(step)
 * @property {number} turn - 回合数
 * @property {Object} entropy - 熵信息
 * @property {number} entropy.before - 动作前的系统熵
 * @property {number} entropy.after - 动作后的系统熵
 * @property {number} entropy.delta - 熵变化量
 * @property {Object} decisionContext - 决策上下文
 * @property {Array<number>} decisionContext.availableChoices - 可选择数量
 * @property {string} decisionContext.chosenOption - 选择的选项
 * @property {number} decisionContext.informationGain - 信息增益
 */

/**
 * 因果边
 * @typedef {Object} CausalEdge
 * @property {string} id - 唯一标识符
 * @property {string} from - 来源节点ID
 * @property {string} to - 目标节点ID
 * @property {CausalEdgeType} type - 因果关系类型
 * @property {number} strength - 因果强度 0.0 ~ 1.0
 * @property {string} label - 边标签
 */

// 因果图响应式状态
const comboCausalGraph = ref({
  nodes: new Map(),  // nodeId -> CausalNode
  edges: new Map(),  // edgeId -> CausalEdge
  nodeIdCounter: 0
})

// 因果边颜色映射（使用YGO术语）
const CAUSAL_EDGE_COLORS = {
  SUMMON_MATERIAL: { color: '#ff6b35', name: '素材', dashArray: '' },       // 橙色 - 同调/XYZ/Link素材
  EFFECT_TARGET: { color: '#e94560', name: '对象', dashArray: '' },         // 红色 - 效果对象选择
  COST: { color: '#9b59b6', name: 'cost', dashArray: '5,3' },              // 紫色 - 发动代价
  SEARCH: { color: '#2ecc71', name: '检索', dashArray: '' },               // 绿色 - 检索/堆墓
  TEMPORAL: { color: '#7f8c8d', name: '→', dashArray: '2,4' },             // 灰色 - 时间顺序
  CHAIN_RESPONSE: { color: '#3498db', name: '连锁', dashArray: '' },       // 蓝色 - 连锁响应
  TRIGGER: { color: '#f1c40f', name: '诱发', dashArray: '' },              // 黄色 - 诱发效果
  HAND_ACTIVATION: { color: '#1abc9c', name: '初动', dashArray: '' }       // 青色 - 手牌发动/初动
}

// 展开度计算相关 - 用于量化场面资源和展开能力
let previousFieldEntropy = 0

// ==================== 展开度评估智能化（分析层）====================

/**
 * 已知的妨害类怪兽特征（卡片描述关键词）
 * 用于识别场上的压制点/妨害点
 */
const NEGATION_KEYWORDS = [
  '无效', '让那个效果无效', '使其无效', 'negate',
  '不能发动', '不能特殊召唤', '不能攻击',
  '每回合1次.*无效', '诱发即时效果'
]

/**
 * 已知的保护效果关键词
 */
const PROTECTION_KEYWORDS = [
  '不会被.*破坏', '不会被战斗破坏', '不会被效果破坏',
  '不能成为.*对象', '不受.*效果影响',
  '代替.*破坏', '被破坏.*代替'
]

/**
 * 已知的墓地资源利用关键词
 */
const GRAVE_RESOURCE_KEYWORDS = [
  '从墓地', '墓地.*特殊召唤', '墓地.*加入手卡',
  '墓地.*发动', '墓地.*效果', '除外.*墓地',
  '墓地的卡', '自己墓地'
]

/**
 * 已知的除外资源利用关键词
 */
const BANISHED_RESOURCE_KEYWORDS = [
  '除外的卡', '被除外的', '除外区', '从除外',
  '除外.*特殊召唤', '除外.*加入手卡', '回到卡组'
]

/**
 * 检查卡片描述是否包含关键词
 * @param {string} desc - 卡片描述
 * @param {Array} keywords - 关键词列表
 * @returns {boolean}
 */
function checkDescForKeywords(desc, keywords) {
  if (!desc) return false
  const lowerDesc = desc.toLowerCase()
  return keywords.some(keyword => {
    if (keyword.includes('.*')) {
      // 正则模式匹配
      try {
        const regex = new RegExp(keyword, 'i')
        return regex.test(lowerDesc)
      } catch {
        return false
      }
    }
    return lowerDesc.includes(keyword.toLowerCase())
  })
}

/**
 * 检查场上是否有妨害怪兽
 * @param {Object} fieldSnapshot - 场地快照
 * @param {number} playerIdx - 玩家索引 (0=己方, 1=对方)
 * @returns {Object} { hasNegation, negationCount, negationCards }
 */
function checkNegationMonsters(fieldSnapshot, playerIdx = 0) {
  const result = { hasNegation: false, negationCount: 0, negationCards: [] }
  
  const player = fieldSnapshot?.players?.[playerIdx]
  if (!player) return result
  
  const mzoneCards = player.mzone?.filter(c => c && c.code) || []
  
  for (const card of mzoneCards) {
    // 只检查表侧怪兽
    if (card.position && !(card.position & 0x5)) continue // 非表侧表示
    
    const cardData = cardDatabase.get(card.code)
    if (!cardData) continue
    
    // 检查卡片描述
    if (checkDescForKeywords(cardData.desc, NEGATION_KEYWORDS)) {
      result.hasNegation = true
      result.negationCount++
      result.negationCards.push({
        code: card.code,
        name: cardData.name,
        type: 'monster'
      })
    }
  }
  
  // 也检查魔陷区的永续/反击陷阱
  const szoneCards = player.szone?.filter(c => c && c.code) || []
  for (const card of szoneCards) {
    // 表侧永续魔法/陷阱
    if (card.position && !(card.position & 0x5)) continue
    
    const cardData = cardDatabase.get(card.code)
    if (!cardData) continue
    
    const cardType = cardData.type || 0
    // 永续陷阱 (0x20000 + 0x4) 或反击陷阱 (0x100000 + 0x4)
    if ((cardType & 0x4) && checkDescForKeywords(cardData.desc, NEGATION_KEYWORDS)) {
      result.hasNegation = true
      result.negationCount++
      result.negationCards.push({
        code: card.code,
        name: cardData.name,
        type: (cardType & 0x100000) ? 'counter_trap' : 'continuous_trap'
      })
    }
  }
  
  return result
}

/**
 * 检查场上是否有保护效果
 * @param {Object} fieldSnapshot - 场地快照
 * @param {number} playerIdx - 玩家索引
 * @returns {Object} { hasProtection, protectionCount, protectionCards }
 */
function checkProtectionCards(fieldSnapshot, playerIdx = 0) {
  const result = { hasProtection: false, protectionCount: 0, protectionCards: [] }
  
  const player = fieldSnapshot?.players?.[playerIdx]
  if (!player) return result
  
  // 检查怪兽区
  const mzoneCards = player.mzone?.filter(c => c && c.code) || []
  for (const card of mzoneCards) {
    if (card.position && !(card.position & 0x5)) continue
    
    const cardData = cardDatabase.get(card.code)
    if (!cardData) continue
    
    if (checkDescForKeywords(cardData.desc, PROTECTION_KEYWORDS)) {
      result.hasProtection = true
      result.protectionCount++
      result.protectionCards.push({
        code: card.code,
        name: cardData.name,
        type: 'monster_protection'
      })
    }
  }
  
  // 检查魔陷区的保护卡（如神圣防护罩等）
  const szoneCards = player.szone?.filter(c => c && c.code) || []
  for (const card of szoneCards) {
    if (card.position && !(card.position & 0x5)) continue
    
    const cardData = cardDatabase.get(card.code)
    if (!cardData) continue
    
    if (checkDescForKeywords(cardData.desc, PROTECTION_KEYWORDS)) {
      result.hasProtection = true
      result.protectionCount++
      result.protectionCards.push({
        code: card.code,
        name: cardData.name,
        type: 'spell_trap_protection'
      })
    }
  }
  
  return result
}

/**
 * 计算墓地可利用资源数量
 * 检查墓地中有自身可利用效果的卡片
 * @param {Object} fieldSnapshot - 场地快照
 * @param {number} playerIdx - 玩家索引
 * @returns {Object} { count, resourceCards }
 */
function countGraveResources(fieldSnapshot, playerIdx = 0) {
  const result = { count: 0, resourceCards: [] }
  
  const player = fieldSnapshot?.players?.[playerIdx]
  if (!player?.grave) return result
  
  for (const card of player.grave) {
    if (!card?.code) continue
    
    const cardData = cardDatabase.get(card.code)
    if (!cardData) continue
    
    // 检查卡片描述是否有墓地效果
    if (checkDescForKeywords(cardData.desc, GRAVE_RESOURCE_KEYWORDS)) {
      result.count++
      result.resourceCards.push({
        code: card.code,
        name: cardData.name
      })
    }
  }
  
  return result
}

/**
 * 计算除外区可回收资源数量
 * @param {Object} fieldSnapshot - 场地快照
 * @param {number} playerIdx - 玩家索引
 * @returns {Object} { count, resourceCards }
 */
function countBanishedResources(fieldSnapshot, playerIdx = 0) {
  const result = { count: 0, resourceCards: [] }
  
  const player = fieldSnapshot?.players?.[playerIdx]
  if (!player?.removed) return result
  
  for (const card of player.removed) {
    if (!card?.code) continue
    
    const cardData = cardDatabase.get(card.code)
    if (!cardData) continue
    
    // 检查卡片描述是否有除外效果
    if (checkDescForKeywords(cardData.desc, BANISHED_RESOURCE_KEYWORDS)) {
      result.count++
      result.resourceCards.push({
        code: card.code,
        name: cardData.name
      })
    }
  }
  
  return result
}

/**
 * 评估场上怪兽的质量（等级/阶级/Link值）
 * @param {Object} fieldSnapshot - 场地快照
 * @param {number} playerIdx - 玩家索引
 * @returns {Object} { totalQuality, highLevelCount, details }
 */
function evaluateMonsterQuality(fieldSnapshot, playerIdx = 0) {
  const result = { totalQuality: 0, highLevelCount: 0, details: [] }
  
  const player = fieldSnapshot?.players?.[playerIdx]
  if (!player) return result
  
  const mzoneCards = player.mzone?.filter(c => c && c.code) || []
  
  for (const card of mzoneCards) {
    const cardData = cardDatabase.get(card.code)
    if (!cardData) continue
    
    const cardType = cardData.type || 0
    let quality = 0
    let qualityType = ''
    
    if (cardType & 0x4000000) {
      // Link怪兽 - Link值*2的质量
      quality = (cardData.level || 0) * 2
      qualityType = 'LINK'
    } else if (cardType & 0x800000) {
      // XYZ怪兽 - 阶级*1.5的质量
      quality = (cardData.level || 0) * 1.5
      qualityType = 'XYZ'
    } else if (cardType & 0x2000) {
      // 同调怪兽 - 等级*1.2的质量
      quality = (cardData.level || 0) * 1.2
      qualityType = '同调'
    } else if (cardType & 0x40) {
      // 融合怪兽
      quality = (cardData.level || 0) * 1.2
      qualityType = '融合'
    } else {
      // 普通效果怪兽
      quality = (cardData.level || 0)
      qualityType = '怪兽'
    }
    
    // 高等级/阶级怪兽额外加成
    if ((cardData.level || 0) >= 7) {
      result.highLevelCount++
      quality *= 1.3
    }
    
    result.totalQuality += quality
    result.details.push({
      code: card.code,
      name: cardData.name,
      quality,
      qualityType,
      level: cardData.level
    })
  }
  
  return result
}

// 通召使用追踪（在MSG处理中更新）
let normalSummonUsedThisTurn = { 0: false, 1: false }

/**
 * 重置通召追踪（每回合开始时调用）
 */
function resetNormalSummonTracking() {
  normalSummonUsedThisTurn = { 0: false, 1: false }
}

/**
 * 标记通召已使用
 * @param {number} playerIdx - 玩家索引
 */
function markNormalSummonUsed(playerIdx) {
  normalSummonUsedThisTurn[playerIdx] = true
}

/**
 * 检查通召是否已使用
 * @param {number} playerIdx - 玩家索引
 * @returns {boolean}
 */
function checkNormalSummonUsed(playerIdx = 0) {
  return normalSummonUsedThisTurn[playerIdx] || false
}

/**
 * 计算场地状态的展开度（基础版本）
 * 展开度越高表示：手牌多、场面怪兽多、资源丰富
 * 展开度变化：正=赚卡/展开，负=亏卡/消耗
 * @param {Object} fieldSnapshot - 场地快照
 * @returns {number} 展开度值
 */
function calculateFieldEntropy(fieldSnapshot) {
  if (!fieldSnapshot || !fieldSnapshot.players) return 0
  
  let entropy = 0
  
  fieldSnapshot.players.forEach((player, playerIdx) => {
    // 权重：我方资源为主，对方资源也计入（表示对面的威胁/压制力）
    const weight = playerIdx === 0 ? 1 : 0.3
    
    // 手牌资源（手牌=选择权，很重要）
    const handCount = player.hand?.length || 0
    entropy += weight * handCount * 2
    
    // 怪兽区资源（场面压制力的核心）
    const mzoneCards = player.mzone?.filter(c => c) || []
    entropy += weight * mzoneCards.length * 3
    mzoneCards.forEach(card => {
      if (card.overlayUnits?.length) {
        entropy += weight * card.overlayUnits.length * 1.5  // XYZ素材也是资源
      }
    })
    
    // 魔陷区资源（盖卡/永续等）
    const szoneCards = player.szone?.filter(c => c) || []
    entropy += weight * szoneCards.length * 2
    
    // 墓地资源（墓地也是手牌）
    const graveCount = player.grave?.length || 0
    entropy += weight * graveCount * 0.5
    
    // 除外区资源
    const removedCount = player.removed?.length || 0
    entropy += weight * removedCount * 0.3
    
    // 额外卡组剩余量（展开空间）
    const extraCount = player.extra || 0
    entropy += weight * extraCount * 0.2
  })
  
  // 连锁深度（复杂连锁表示大量效果交互）
  if (fieldSnapshot.chains?.length) {
    entropy += fieldSnapshot.chains.length * 2
  }
  
  return Math.round(entropy * 100) / 100
}

/**
 * 计算场地状态的高级展开度（智能分析版）
 * 加入游戏王特有的资源评估：妨害点、保护、墓地资源、展开潜力等
 * @param {Object} fieldSnapshot - 场地快照
 * @returns {Object} { entropy, details } 展开度值和详细分析
 */
function calculateAdvancedEntropy(fieldSnapshot) {
  if (!fieldSnapshot || !fieldSnapshot.players) {
    return { entropy: 0, details: null }
  }
  
  // 基础展开度
  let entropy = calculateFieldEntropy(fieldSnapshot)
  
  const details = {
    baseEntropy: entropy,
    negation: { self: null, opponent: null },
    protection: { self: null, opponent: null },
    graveResources: { self: null, opponent: null },
    banishedResources: { self: null, opponent: null },
    monsterQuality: { self: null, opponent: null },
    potential: { self: 0, opponent: 0 },
    adjustments: []
  }
  
  // ====== 1. 关键位置评估（妨害点）======
  // 己方妨害 = 压制力
  const selfNegation = checkNegationMonsters(fieldSnapshot, 0)
  details.negation.self = selfNegation
  if (selfNegation.hasNegation) {
    const negationBonus = selfNegation.negationCount * 25  // 每个妨害点+25
    entropy += negationBonus
    details.adjustments.push({
      type: 'negation_self',
      value: negationBonus,
      desc: `己方妨害点 x${selfNegation.negationCount}`
    })
  }
  
  // 对方妨害 = 威胁（减分但要考虑）
  const oppNegation = checkNegationMonsters(fieldSnapshot, 1)
  details.negation.opponent = oppNegation
  if (oppNegation.hasNegation) {
    const negationPenalty = oppNegation.negationCount * 15  // 对方妨害会阻碍展开
    entropy -= negationPenalty
    details.adjustments.push({
      type: 'negation_opponent',
      value: -negationPenalty,
      desc: `对方妨害威胁 x${oppNegation.negationCount}`
    })
  }
  
  // ====== 2. 保护效果评估 ======
  const selfProtection = checkProtectionCards(fieldSnapshot, 0)
  details.protection.self = selfProtection
  if (selfProtection.hasProtection) {
    const protectionBonus = selfProtection.protectionCount * 15
    entropy += protectionBonus
    details.adjustments.push({
      type: 'protection_self',
      value: protectionBonus,
      desc: `己方保护效果 x${selfProtection.protectionCount}`
    })
  }
  
  // ====== 3. 墓地资源循环能力 ======
  const selfGraveRes = countGraveResources(fieldSnapshot, 0)
  details.graveResources.self = selfGraveRes
  if (selfGraveRes.count > 0) {
    // 墓地有效资源，每张+1.5，上限15
    const graveBonus = Math.min(selfGraveRes.count * 1.5, 15)
    entropy += graveBonus
    details.adjustments.push({
      type: 'grave_resources',
      value: graveBonus,
      desc: `墓地有效资源 x${selfGraveRes.count}`
    })
  }
  
  // ====== 4. 除外区可回收资源 ======
  const selfBanishedRes = countBanishedResources(fieldSnapshot, 0)
  details.banishedResources.self = selfBanishedRes
  if (selfBanishedRes.count > 0) {
    // 除外有效资源，每张+0.8，上限8
    const banishedBonus = Math.min(selfBanishedRes.count * 0.8, 8)
    entropy += banishedBonus
    details.adjustments.push({
      type: 'banished_resources',
      value: banishedBonus,
      desc: `除外可回收资源 x${selfBanishedRes.count}`
    })
  }
  
  // ====== 5. 怪兽质量评估 ======
  const selfMonsterQuality = evaluateMonsterQuality(fieldSnapshot, 0)
  details.monsterQuality.self = selfMonsterQuality
  if (selfMonsterQuality.totalQuality > 0) {
    // 怪兽质量加成，根据总质量的10%
    const qualityBonus = Math.round(selfMonsterQuality.totalQuality * 0.1 * 10) / 10
    entropy += qualityBonus
    details.adjustments.push({
      type: 'monster_quality',
      value: qualityBonus,
      desc: `场上怪兽质量 (${selfMonsterQuality.highLevelCount}高级)`
    })
  }
  
  // ====== 6. 展开潜力评估 ======
  // 额外卡组剩余空间
  const selfPlayer = fieldSnapshot.players[0]
  const extraRemaining = selfPlayer?.extra || 0
  if (extraRemaining > 10) {
    const extraPotential = Math.round((extraRemaining - 10) * 0.3 * 10) / 10
    details.potential.self += extraPotential
    entropy += extraPotential
    details.adjustments.push({
      type: 'extra_potential',
      value: extraPotential,
      desc: `额外卡组潜力 (剩余${extraRemaining})`
    })
  }
  
  // 通召未使用 = 还有展开空间
  if (!checkNormalSummonUsed(0)) {
    const normalSummonPotential = 8  // 未用通召+8潜力
    details.potential.self += normalSummonPotential
    entropy += normalSummonPotential
    details.adjustments.push({
      type: 'normal_summon_potential',
      value: normalSummonPotential,
      desc: '通常召唤权未使用'
    })
  }
  
  // ====== 7. 对方威胁评估 ======
  const oppMonsterQuality = evaluateMonsterQuality(fieldSnapshot, 1)
  details.monsterQuality.opponent = oppMonsterQuality
  if (oppMonsterQuality.totalQuality > 20) {
    // 对方高质量怪兽带来压力
    const threatPenalty = Math.round((oppMonsterQuality.totalQuality - 20) * 0.05 * 10) / 10
    entropy -= threatPenalty
    details.adjustments.push({
      type: 'opponent_threat',
      value: -threatPenalty,
      desc: `对方场面威胁 (质量${Math.round(oppMonsterQuality.totalQuality)})`
    })
  }
  
  details.finalEntropy = Math.round(entropy * 100) / 100
  
  return {
    entropy: details.finalEntropy,
    details
  }
}

/**
 * 获取展开度评估摘要（用于UI显示）
 * @param {Object} details - calculateAdvancedEntropy返回的details
 * @returns {string} 简洁的评估摘要
 */
function getEntropyEvaluationSummary(details) {
  if (!details) return ''
  
  const summaryParts = []
  
  // 妨害点
  if (details.negation?.self?.negationCount > 0) {
    summaryParts.push(`🛡${details.negation.self.negationCount}妨害`)
  }
  
  // 保护
  if (details.protection?.self?.protectionCount > 0) {
    summaryParts.push(`🔰${details.protection.self.protectionCount}保护`)
  }
  
  // 墓地资源
  if (details.graveResources?.self?.count > 0) {
    summaryParts.push(`⚰${details.graveResources.self.count}墓资`)
  }
  
  // 通召潜力
  if (details.adjustments?.some(a => a.type === 'normal_summon_potential')) {
    summaryParts.push(`📤通召可用`)
  }
  
  // 对方威胁
  if (details.negation?.opponent?.negationCount > 0) {
    summaryParts.push(`⚠️敌${details.negation.opponent.negationCount}妨害`)
  }
  
  return summaryParts.join(' | ')
}

/**
 * 检测因果边类型
 * @param {Object} currentEntry - 当前条目
 * @param {Object} parentEntry - 父条目
 * @param {Object} context - 上下文信息
 * @returns {CausalEdgeType} 因果边类型
 */
function detectCausalEdgeType(currentEntry, parentEntry, context = {}) {
  const { pendingMaterials, searchedCards, costCards } = context
  
  // 检查是否是召唤素材关系
  if (currentEntry.type === 'SPSUMMON' && parentEntry) {
    const detail = currentEntry.detail?.toLowerCase() || ''
    // 检查是否是同调/XYZ/Link召唤的素材
    if (detail.includes('同调') || detail.includes('synchro')) {
      return 'SUMMON_MATERIAL'
    }
    if (detail.includes('xyz') || detail.includes('超量') || detail.includes('叠放')) {
      return 'SUMMON_MATERIAL'
    }
    if (detail.includes('link') || detail.includes('连接')) {
      return 'SUMMON_MATERIAL'
    }
    if (detail.includes('融合') || detail.includes('fusion')) {
      return 'SUMMON_MATERIAL'
    }
    // 检查pending素材列表
    if (pendingMaterials?.some(m => m.cardCode === parentEntry?.cardCode)) {
      return 'SUMMON_MATERIAL'
    }
  }
  
  // 检查是否是检索关系
  if (currentEntry.type === 'MOVE' && currentEntry.detail?.includes('手牌')) {
    // 从卡组/墓地等检索到手牌
    return 'SEARCH'
  }
  if (searchedCards?.has(currentEntry.cardCode)) {
    return 'SEARCH'
  }
  
  // 检查是否是代价关系
  if (costCards?.has(currentEntry.cardCode)) {
    return 'COST'
  }
  if (currentEntry.detail?.includes('cost') || currentEntry.detail?.includes('代价')) {
    return 'COST'
  }
  
  // 连锁响应关系
  if (currentEntry.depth > 0 && currentEntry.type === 'CHAIN') {
    return 'CHAIN_RESPONSE'
  }
  
  // 手牌发动关系（初动点）
  if (currentEntry.isStarter && currentEntry.type === 'CHAIN') {
    return 'HAND_ACTIVATION'
  }
  
  // 触发关系
  if (currentEntry.detail?.includes('触发') || currentEntry.detail?.includes('诱发')) {
    return 'TRIGGER'
  }
  
  // 效果对象关系（默认的效果链接）
  if (parentEntry?.type === 'CHAIN' && currentEntry.fromCardCode === parentEntry.cardCode) {
    return 'EFFECT_TARGET'
  }
  
  // 默认为时序关系
  return 'TEMPORAL'
}

/**
 * 计算因果强度
 * @param {CausalEdgeType} edgeType - 边类型
 * @param {Object} currentEntry - 当前条目
 * @param {Object} parentEntry - 父条目
 * @returns {number} 因果强度 0.0 ~ 1.0
 */
function calculateCausalStrength(edgeType, currentEntry, parentEntry) {
  // 基础强度根据边类型
  const baseStrength = {
    SUMMON_MATERIAL: 1.0,    // 召唤素材是强因果
    COST: 0.95,              // 代价也是强因果
    EFFECT_TARGET: 0.85,     // 效果对象
    SEARCH: 0.8,             // 检索
    CHAIN_RESPONSE: 0.7,     // 连锁响应
    TRIGGER: 0.75,           // 触发
    HAND_ACTIVATION: 0.9,    // 手牌发动
    TEMPORAL: 0.3            // 纯时序关系较弱
  }
  
  let strength = baseStrength[edgeType] || 0.5
  
  // 如果是同一张卡的多次效果发动，增强因果强度
  if (currentEntry.cardCode === parentEntry?.cardCode) {
    strength = Math.min(1.0, strength + 0.15)
  }
  
  // 连锁深度影响（深度越近强度越高）
  if (currentEntry.depth > 0 && parentEntry?.depth !== undefined) {
    const depthDiff = Math.abs(currentEntry.depth - parentEntry.depth)
    if (depthDiff === 1) {
      strength = Math.min(1.0, strength + 0.1)
    }
  }
  
  return Math.round(strength * 100) / 100
}

/**
 * 创建因果图节点
 * @param {Object} entry - combo条目
 * @param {Object} fieldSnapshot - 场地快照
 * @returns {CausalNode}
 */
function createCausalNode(entry, fieldSnapshot) {
  // 使用高级展开度计算（包含妨害点、保护、墓地资源等分析）
  const advancedResult = calculateAdvancedEntropy(fieldSnapshot)
  const currentEntropy = advancedResult.entropy
  const entropyDelta = currentEntropy - previousFieldEntropy
  
  // 生成评估摘要
  const evaluationSummary = getEntropyEvaluationSummary(advancedResult.details)
  
  const node = {
    id: `${entry.step}_${entry.cardCode}`,
    cardCode: entry.cardCode,
    cardName: entry.cardName,
    type: entry.type,
    detail: entry.detail,
    timestamp: entry.step,
    turn: entry.turn,
    depth: entry.depth || 0,
    // 策略标签
    isStarter: entry.isStarter || false,
    isHandTrap: entry.isHandTrap || false,
    isActionPoint: entry.isActionPoint || false,
    isResponse: entry.isResponse || false,
    // 效果类型详情
    effectType: entry.effectType || null,
    effectLabel: entry.effectLabel || '',
    effectIcon: entry.effectIcon || '',
    effectColor: entry.effectColor || '',
    spellSpeed: entry.spellSpeed || 1,
    // 召唤素材
    summonMaterials: entry.summonMaterials || null,
    summonType: entry.summonType || null,
    materialSummary: entry.materialSummary || '',
    // 展开度信息（智能化版本）
    entropy: {
      before: previousFieldEntropy,
      after: currentEntropy,
      delta: Math.round(entropyDelta * 100) / 100,
      // 新增：高级分析详情
      details: advancedResult.details,
      summary: evaluationSummary
    },
    decisionContext: {
      availableChoices: 0,  // 可以后续扩展
      chosenOption: entry.detail,
      informationGain: Math.abs(entropyDelta),
      // 新增：场地状态快照摘要
      fieldState: {
        selfNegation: advancedResult.details?.negation?.self?.negationCount || 0,
        selfProtection: advancedResult.details?.protection?.self?.protectionCount || 0,
        graveResources: advancedResult.details?.graveResources?.self?.count || 0,
        normalSummonAvailable: !checkNormalSummonUsed(0)
      }
    }
  }
  
  // 更新前一个熵值
  previousFieldEntropy = currentEntropy
  
  return node
}

/**
 * 创建因果边
 * @param {string} fromNodeId - 来源节点ID
 * @param {string} toNodeId - 目标节点ID
 * @param {CausalEdgeType} type - 边类型
 * @param {number} strength - 因果强度
 * @returns {CausalEdge}
 */
function createCausalEdge(fromNodeId, toNodeId, type, strength) {
  const edgeInfo = CAUSAL_EDGE_COLORS[type] || CAUSAL_EDGE_COLORS.TEMPORAL
  return {
    id: `${fromNodeId}->${toNodeId}`,
    from: fromNodeId,
    to: toNodeId,
    type,
    strength,
    label: edgeInfo.name,
    color: edgeInfo.color,
    dashArray: edgeInfo.dashArray
  }
}

/**
 * 向因果图添加节点和边
 * @param {Object} entry - combo条目
 * @param {Object} context - 上下文
 */
function addToCausalGraph(entry, context = {}) {
  const graph = comboCausalGraph.value
  const fieldSnapshot = entry.fieldSnapshot
  
  // 创建节点
  const node = createCausalNode(entry, fieldSnapshot)
  graph.nodes.set(node.id, node)
  
  // 寻找父节点并创建边
  const parentNodeId = findParentNodeId(entry, graph)
  
  if (parentNodeId) {
    const parentNode = graph.nodes.get(parentNodeId)
    const parentEntry = parentNode ? {
      cardCode: parentNode.cardCode,
      type: parentNode.type,
      detail: parentNode.detail,
      depth: parentNode.depth
    } : null
    
    const edgeType = detectCausalEdgeType(entry, parentEntry, context)
    const strength = calculateCausalStrength(edgeType, entry, parentEntry)
    const edge = createCausalEdge(parentNodeId, node.id, edgeType, strength)
    graph.edges.set(edge.id, edge)
  }
  
  // 处理多对多关系 - 如果有多个来源，创建额外的边
  if (context.additionalParents) {
    context.additionalParents.forEach(parentCode => {
      // 查找该卡片最近的节点
      const additionalParentId = findNodeByCardCode(parentCode, graph)
      if (additionalParentId && additionalParentId !== parentNodeId) {
        const edgeType = detectCausalEdgeType(entry, { cardCode: parentCode }, context)
        const strength = calculateCausalStrength(edgeType, entry, { cardCode: parentCode })
        const edge = createCausalEdge(additionalParentId, node.id, edgeType, strength)
        graph.edges.set(edge.id, edge)
      }
    })
  }
  
  return node
}

/**
 * 查找父节点ID
 * @param {Object} entry - 当前条目
 * @param {Object} graph - 因果图
 * @returns {string|null} 父节点ID
 */
function findParentNodeId(entry, graph) {
  // 优先使用fromCardCode
  if (entry.fromCardCode) {
    const parentId = findNodeByCardCode(entry.fromCardCode, graph)
    if (parentId) return parentId
  }
  
  // 否则找时间上最近的节点
  const nodes = Array.from(graph.nodes.values())
  if (nodes.length === 0) return null
  
  // 按timestamp降序排列，找到最近的节点
  const sortedNodes = nodes.sort((a, b) => b.timestamp - a.timestamp)
  const latestNode = sortedNodes.find(n => n.id !== `${entry.step}_${entry.cardCode}`)
  
  return latestNode?.id || null
}

/**
 * 根据卡片代码查找最近的节点
 * @param {number} cardCode - 卡片代码
 * @param {Object} graph - 因果图
 * @returns {string|null} 节点ID
 */
function findNodeByCardCode(cardCode, graph) {
  const nodes = Array.from(graph.nodes.values())
    .filter(n => n.cardCode === cardCode)
    .sort((a, b) => b.timestamp - a.timestamp)
  
  return nodes[0]?.id || null
}

/**
 * 清空因果图
 */
function clearCausalGraph() {
  comboCausalGraph.value.nodes.clear()
  comboCausalGraph.value.edges.clear()
  comboCausalGraph.value.nodeIdCounter = 0
  previousFieldEntropy = 0
}

/**
 * 获取展开度颜色（用于节点渐变）
 * 正向变化（场面展开/赚卡）: 绿色系
 * 负向变化（资源消耗/亏卡）: 红色系
 * 零变化（持平）: 蓝色系
 * @param {number} entropyDelta - 展开度变化量
 * @returns {Object} 颜色信息
 */
function getEntropyColor(entropyDelta) {
  if (entropyDelta > 5) {
    return { 
      primary: '#00ff88', 
      secondary: '#00cc66',
      glow: 'rgba(0, 255, 136, 0.4)',
      label: '大展开'  // 场面大幅展开，资源大增
    }
  } else if (entropyDelta > 2) {
    return { 
      primary: '#4ade80', 
      secondary: '#22c55e',
      glow: 'rgba(74, 222, 128, 0.3)',
      label: '赚卡'    // 资源增加，场面变好
    }
  } else if (entropyDelta > 0) {
    return { 
      primary: '#86efac', 
      secondary: '#4ade80',
      glow: 'rgba(134, 239, 172, 0.2)',
      label: '微赚'    // 小幅度资源增加
    }
  } else if (entropyDelta < -5) {
    return { 
      primary: '#ff4444', 
      secondary: '#cc0000',
      glow: 'rgba(255, 68, 68, 0.4)',
      label: '大消耗'  // 资源大量消耗（如大量素材）
    }
  } else if (entropyDelta < -2) {
    return { 
      primary: '#f87171', 
      secondary: '#ef4444',
      glow: 'rgba(248, 113, 113, 0.3)',
      label: '亏卡'    // 资源消耗
    }
  } else if (entropyDelta < 0) {
    return { 
      primary: '#fca5a5', 
      secondary: '#f87171',
      glow: 'rgba(252, 165, 165, 0.2)',
      label: '微亏'    // 小幅度资源消耗
    }
  } else {
    return { 
      primary: '#60a5fa', 
      secondary: '#3b82f6',
      glow: 'rgba(96, 165, 250, 0.2)',
      label: '持平'    // 资源持平
    }
  }
}

/**
 * 获取展开度变化的CSS类名
 * @param {number} entropyDelta - 展开度变化量
 * @returns {string} CSS类名
 */
function getEntropyClass(entropyDelta) {
  if (entropyDelta > 5) return 'entropy-high-expand'    // 大展开
  if (entropyDelta > 2) return 'entropy-expand'         // 赚卡
  if (entropyDelta > 0) return 'entropy-slight-expand'  // 微赚
  if (entropyDelta < -5) return 'entropy-high-converge' // 大消耗
  if (entropyDelta < -2) return 'entropy-converge'      // 亏卡
  if (entropyDelta < 0) return 'entropy-slight-converge'// 微亏
  return 'entropy-stable'                                // 持平
}

/**
 * 获取节点的tooltip信息
 * @param {Object} node - 节点
 * @param {number} idx - 索引
 * @returns {string} tooltip文本
 */
function getNodeTooltip(node, idx) {
  let tooltip = `#${idx + 1} ${node.cardName}\n`
  tooltip += `类型: ${node.type} | ${node.detail}\n`
  tooltip += '左键: 查看场地快照 | 右键: 查看卡牌详情'
  
  // 效果类型信息
  if (node.effectType && node.type === 'CHAIN') {
    const typeInfo = EFFECT_TYPE_INFO[node.effectType]
    tooltip += `\n\n⚔️ 效果分类:\n`
    tooltip += `  类型: ${typeInfo?.icon || ''} ${typeInfo?.name || node.effectLabel}\n`
    tooltip += `  咒文速度: ${node.spellSpeed}\n`
    tooltip += `  说明: ${typeInfo?.desc || ''}`
    
    // 策略标签
    const tags = []
    if (node.isStarter) tags.push('初动点')
    if (node.isHandTrap) tags.push('手坑')
    if (node.isActionPoint) tags.push('动点')
    if (node.isResponse) tags.push('响应')
    if (tags.length > 0) {
      tooltip += `\n  标签: ${tags.join(', ')}`
    }
  }
  
  if (node.entropy) {
    const entropyInfo = getEntropyColor(node.entropy.delta)
    tooltip += `\n\n📊 资源分析:\n`
    tooltip += `  状态: ${entropyInfo.label}\n`
    tooltip += `  场优变化: ${node.entropy.delta > 0 ? '+' : ''}${node.entropy.delta.toFixed(1)}\n`
    tooltip += `  展开度: ${node.entropy.before.toFixed(0)} → ${node.entropy.after.toFixed(0)}`
  }
  
  // 添加素材信息
  if (node.summonMaterials && node.summonMaterials.length > 0) {
    tooltip += `\n\n🎴 ${node.summonType || 'XYZ'}素材:\n`
    tooltip += `  ${node.materialSummary || node.summonMaterials.map(m => m.name).join(' + ')}`
  }
  
  return tooltip
}

/**
 * 获取素材卡片的tooltip
 * @param {Object} mat - 素材信息
 * @param {string} summonType - 召唤类型
 * @returns {string} tooltip文本
 */
function getMaterialTooltip(mat, summonType) {
  let tooltip = `点击搜索【${mat.name}】可召唤的额外卡组怪兽\n`
  
  switch (summonType) {
    case '同调':
      tooltip += mat.isTuner ? '🎵 调整怪兽' : '非调整怪兽'
      tooltip += ` | ★${mat.level}`
      break
    case 'LINK':
      if (mat.isLink) {
        tooltip += `连接怪兽 | LINK-${mat.linkValue} (可作为${mat.linkValue}体素材)`
      } else {
        tooltip += `普通素材 (作为1体素材)`
      }
      break
    case '融合':
      tooltip += `融合素材 | ★${mat.level}`
      break
    case '仪式':
      tooltip += `仪式解放 | ★${mat.level}`
      break
    default: // XYZ
      tooltip += `叠放素材 | ★${mat.level}`
  }
  
  return tooltip
}

/**
 * 获取召唤类型对应的箭头符号
 * @param {string} summonType - 召唤类型
 * @returns {string} 箭头符号
 */
function getSummonArrow(summonType) {
  switch (summonType) {
    case '同调': return '🔄'  // 同调召唤
    case 'LINK': return '🔗'  // 连接召唤
    case '融合': return '⚗️'  // 融合召唤
    case '仪式': return '🕯️'  // 仪式召唤
    default: return '▼'       // XYZ召唤（叠放）
  }
}

/**
 * 获取资源变化的标签文本（用于徽章显示）
 * @param {number} delta - 变化量
 * @returns {string} 标签文本
 */
function getResourceChangeLabel(delta) {
  const entropyInfo = getEntropyColor(delta)
  return entropyInfo.label
}

/**
 * 获取资源变化的tooltip标题
 * @param {number} delta - 变化量
 * @returns {string} tooltip标题
 */
function getResourceChangeTitle(delta) {
  if (delta > 5) return '场面大展开！资源大幅增加'
  if (delta > 2) return '赚卡：资源增加，场面变好'
  if (delta > 0) return '微赚：小幅度资源增加'
  if (delta < -5) return '大消耗：投入大量素材/cost'
  if (delta < -2) return '亏卡：资源消耗'
  if (delta < 0) return '微亏：小幅度资源消耗'
  return '持平：资源没有明显变化'
}

// 多因果树支持 - 允许用户创建多条独立的因果树并切换查看
const comboTrees = ref([
  { id: 0, name: '总因果树', entries: [], isTotal: true }
])
const currentTreeIndex = ref(0) // 当前选中的因果树索引
const showTreeDropdown = ref(false) // 是否显示因果树下拉菜单
const editingTreeName = ref(false) // 是否正在编辑因果树名称
const editTreeNameValue = ref('') // 编辑中的名称值

// 初动点追踪 - 用于自动生成因果树
// cardCode -> { treeIndex, cardName } 记录每个初动点对应的因果树
const starterToTreeMap = new Map()
// cardCode -> Set<treeIndex> 记录每张卡属于哪些因果树（用于追踪因果链）
const cardToTreesMap = new Map()

// 获取当前显示的因果树条目
const currentTreeEntries = computed(() => {
  const tree = comboTrees.value[currentTreeIndex.value]
  if (!tree) return comboTreeEntries.value // fallback to total
  if (tree.isTotal) return comboTreeEntries.value // 总因果树显示所有条目
  return tree.entries
})

// XYZ素材追踪 - 记录从怪兽区移动到额外区的卡片作为待叠放素材
let pendingXyzMaterials = []

// 通用召唤素材追踪 - 记录从怪兽区/手牌移动到墓地的卡片（用于同调/Link/融合/仪式素材）
let pendingSummonMaterials = []

// 素材追踪时间窗口 - 只追踪短时间内的移动作为潜在素材
let lastMaterialMoveStep = -1
const MATERIAL_WINDOW_STEPS = 10 // 素材移动必须在召唤前的10步内

// ==================== 效果类型分类系统 ====================
// 游戏王效果类型定义
const EFFECT_TYPE = {
  IGNITION: 'ignition',       // 起动效果：主动发动，咒文速度1
  TRIGGER: 'trigger',         // 诱发效果：条件触发，咒文速度1（可能遗漏时点）
  QUICK: 'quick',             // 诱发即时效果：咒文速度2，可响应
  CONTINUOUS: 'continuous',   // 永续效果：不进入连锁，持续适用
  FLIP: 'flip',               // 反转效果：翻转时触发
  SPELL: 'spell',             // 魔法卡效果
  TRAP: 'trap',               // 陷阱卡效果
  COUNTER: 'counter'          // 反击陷阱：咒文速度3
}

// 效果类型中文名称和图标
const EFFECT_TYPE_INFO = {
  [EFFECT_TYPE.IGNITION]: { name: '起动', icon: '🎬', color: '#ff9800', desc: '主动发动的效果' },
  [EFFECT_TYPE.TRIGGER]: { name: '诱发', icon: '⚡', color: '#4caf50', desc: '条件触发的效果' },
  [EFFECT_TYPE.QUICK]: { name: '即时', icon: '💨', color: '#2196f3', desc: '咒文速度2的快速效果' },
  [EFFECT_TYPE.CONTINUOUS]: { name: '永续', icon: '♾️', color: '#9c27b0', desc: '持续适用的效果' },
  [EFFECT_TYPE.FLIP]: { name: '反转', icon: '🔄', color: '#795548', desc: '翻转时触发的效果' },
  [EFFECT_TYPE.SPELL]: { name: '魔法', icon: '✨', color: '#1de9b6', desc: '魔法卡效果' },
  [EFFECT_TYPE.TRAP]: { name: '陷阱', icon: '🪤', color: '#e91e63', desc: '陷阱卡效果' },
  [EFFECT_TYPE.COUNTER]: { name: '反击', icon: '🛑', color: '#f44336', desc: '咒文速度3的反击' }
}

// 卡片类型标志位（用于判断效果类型）
const CARD_TYPE = {
  MONSTER: 0x1,
  SPELL: 0x2,
  TRAP: 0x4,
  NORMAL: 0x10,        // 通常怪兽
  EFFECT: 0x20,        // 效果怪兽
  FUSION: 0x40,
  RITUAL: 0x80,
  SPIRIT: 0x200,
  UNION: 0x400,
  GEMINI: 0x800,       // 二重
  TUNER: 0x1000,       // 调整
  SYNCHRO: 0x2000,
  TOKEN: 0x4000,       // 衍生物
  QUICKPLAY: 0x10000,  // 速攻魔法
  CONTINUOUS: 0x20000, // 永续（魔法/陷阱）
  EQUIP: 0x40000,      // 装备魔法
  FIELD: 0x80000,      // 场地魔法
  COUNTER: 0x100000,   // 反击陷阱
  FLIP: 0x200000,      // 反转
  TOON: 0x400000,      // 卡通
  XYZ: 0x800000,
  PENDULUM: 0x1000000,
  LINK: 0x4000000
}

/**
 * 推断效果类型
 * @param {number} code - 卡片代码
 * @param {number} cardType - 卡片类型
 * @param {number} chainNum - 连锁号码
 * @param {boolean} isTurnPlayer - 是否是回合玩家
 * @param {number} location - 发动位置
 * @param {boolean} hasStarter - 本回合是否已有初动
 * @returns {Object} 效果类型信息
 */
function detectEffectType(code, cardType, chainNum, isTurnPlayer, location, hasStarter) {
  const result = {
    effectType: null,        // 效果类型
    spellSpeed: 1,           // 咒文速度
    isStarter: false,        // 是否初动点
    isActionPoint: false,    // 是否动点
    isHandTrap: false,       // 是否手坑
    isResponse: false,       // 是否响应
    effectLabel: '',         // 显示标签
    effectIcon: '',          // 显示图标
    effectColor: ''          // 显示颜色
  }
  
  const isFromHand = (location & LOCATION.HAND) !== 0
  const isFromMonsterZone = (location & LOCATION.MZONE) !== 0
  const isFromSpellTrapZone = (location & LOCATION.SZONE) !== 0
  const isFromGrave = (location & LOCATION.GRAVE) !== 0
  const isFromRemoved = (location & LOCATION.REMOVED) !== 0
  
  // 判断卡片大类
  const isMonster = !!(cardType & CARD_TYPE.MONSTER)
  const isSpell = !!(cardType & CARD_TYPE.SPELL)
  const isTrap = !!(cardType & CARD_TYPE.TRAP)
  
  // ======== 魔法卡 ========
  if (isSpell) {
    if (cardType & CARD_TYPE.QUICKPLAY) {
      // 速攻魔法：咒文速度2
      result.effectType = EFFECT_TYPE.QUICK
      result.spellSpeed = 2
    } else if (cardType & CARD_TYPE.CONTINUOUS) {
      // 永续魔法：发动时咒文速度1
      result.effectType = EFFECT_TYPE.SPELL
      result.spellSpeed = 1
    } else if (cardType & CARD_TYPE.FIELD) {
      // 场地魔法
      result.effectType = EFFECT_TYPE.SPELL
      result.spellSpeed = 1
    } else if (cardType & CARD_TYPE.EQUIP) {
      // 装备魔法
      result.effectType = EFFECT_TYPE.SPELL
      result.spellSpeed = 1
    } else {
      // 通常魔法
      result.effectType = EFFECT_TYPE.SPELL
      result.spellSpeed = 1
    }
  }
  // ======== 陷阱卡 ========
  else if (isTrap) {
    if (cardType & CARD_TYPE.COUNTER) {
      // 反击陷阱：咒文速度3
      result.effectType = EFFECT_TYPE.COUNTER
      result.spellSpeed = 3
    } else {
      // 通常陷阱/永续陷阱：咒文速度2
      result.effectType = EFFECT_TYPE.TRAP
      result.spellSpeed = 2
    }
  }
  // ======== 怪兽效果 ========
  else if (isMonster) {
    // 从手牌发动的怪兽效果
    if (isFromHand) {
      if (chainNum > 1 || !isTurnPlayer) {
        // 手坑：从手牌响应（连锁2+或对手回合）
        result.effectType = EFFECT_TYPE.QUICK
        result.spellSpeed = 2
        result.isHandTrap = true
      } else {
        // 自己回合从手牌发动连锁1（如增殖的G的主动发动）
        result.effectType = EFFECT_TYPE.IGNITION
        result.spellSpeed = 1
      }
    }
    // 从怪兽区发动
    else if (isFromMonsterZone) {
      if (chainNum === 1 && isTurnPlayer) {
        // 自己回合连锁1：起动效果
        result.effectType = EFFECT_TYPE.IGNITION
        result.spellSpeed = 1
      } else {
        // 响应时发动：诱发即时效果
        result.effectType = EFFECT_TYPE.QUICK
        result.spellSpeed = 2
        result.isResponse = chainNum > 1
      }
    }
    // 从墓地/除外区发动
    else if (isFromGrave || isFromRemoved) {
      if (chainNum === 1) {
        // 连锁1：通常是起动效果
        result.effectType = EFFECT_TYPE.IGNITION
        result.spellSpeed = 1
      } else {
        // 响应：诱发即时效果
        result.effectType = EFFECT_TYPE.QUICK
        result.spellSpeed = 2
        result.isResponse = true
      }
    }
    // 其他位置（如魔陷区的P怪兽）
    else {
      if (chainNum > 1) {
        result.effectType = EFFECT_TYPE.QUICK
        result.spellSpeed = 2
        result.isResponse = true
      } else {
        result.effectType = EFFECT_TYPE.IGNITION
        result.spellSpeed = 1
      }
    }
  }
  
  // ======== 策略标签判断 ========
  // 初动点：自己回合 + 连锁1 + 本回合第一个主动动作
  if (chainNum === 1 && isTurnPlayer && !hasStarter) {
    result.isStarter = true
  }
  // 动点：自己回合 + 连锁1 + 非初动 + 主动发动位置
  else if (chainNum === 1 && isTurnPlayer && !result.isHandTrap) {
    result.isActionPoint = true
  }
  // 响应：连锁2+
  if (chainNum > 1) {
    result.isResponse = true
  }
  
  // ======== 设置显示信息 ========
  const typeInfo = EFFECT_TYPE_INFO[result.effectType] || EFFECT_TYPE_INFO[EFFECT_TYPE.IGNITION]
  result.effectLabel = typeInfo.name
  result.effectIcon = typeInfo.icon
  result.effectColor = typeInfo.color
  
  return result
}

/**
 * 获取效果类型显示标签（组合策略标签和效果类型）
 * @param {Object} effectInfo - 效果类型信息
 * @returns {Object} 显示信息
 */
function getEffectDisplayInfo(effectInfo) {
  // 策略标签优先级：初动 > 手坑 > 动点 > 响应
  if (effectInfo.isStarter) {
    return { label: '🎯 初动', badgeClass: 'combo-starter-badge', priority: 1 }
  }
  if (effectInfo.isHandTrap) {
    return { label: '🛡️ 手坑', badgeClass: 'combo-handtrap-badge', priority: 2 }
  }
  if (effectInfo.isActionPoint) {
    return { label: '⚡ 动点', badgeClass: 'combo-action-badge', priority: 3 }
  }
  if (effectInfo.isResponse) {
    return { label: `${effectInfo.effectIcon} ${effectInfo.effectLabel}`, badgeClass: 'combo-response-badge', priority: 4 }
  }
  // 默认显示效果类型
  return { label: `${effectInfo.effectIcon} ${effectInfo.effectLabel}`, badgeClass: 'combo-effect-badge', priority: 5 }
}

// 连锁追踪 - 记录当前连锁中的卡片信息
let currentChainCards = []

// 初动追踪 - 每回合是否已有初动点（第一个主动动作）
let hasStarterThisTurn = false

// 切换优化布局
function toggleOptimizedLayout() {
  useOptimizedLayout.value = !useOptimizedLayout.value
}

// Combo面板拖动状态
const comboPanelRef = ref(null)
const comboPanelPos = ref({ x: 100, y: 100 })
const comboPanelSize = ref({ width: 1000, height: 400 })
const comboPanelVisible = ref(false)
const comboPanelOnTop = ref(true) // true: 弹窗在上层, false: 决斗场地在上层
let comboDragging = false
let comboDragOffset = { x: 0, y: 0 }

// Combo面板内容拖拽浏览状态（手掌拖动）
const comboContainerRef = ref(null)
let comboPanning = false
let comboPanStart = { x: 0, y: 0 }
let comboPanScroll = { x: 0, y: 0 }

// Combo节点预览模式 - 选中节点时显示对应的场地快照
const comboPreviewMode = ref(false)
const comboPreviewNodeIndex = ref(-1) // 当前预览的节点索引
let realTimeFieldBackup = null // 备份实时场地状态
let realTimeDuelInfoBackup = null // 备份实时决斗信息

// 关闭/打开 Combo 面板
function closeComboPanelPopup() {
  comboPanelVisible.value = false
}

function openComboPanelPopup() {
  comboPanelVisible.value = true
  comboPanelOnTop.value = true
}

/**
 * 导出流程图为图片
 */
async function exportFlowchartAsImage() {
  const nodes = comboFlowNodes.value
  const connections = comboConnections.value
  
  if (nodes.length === 0) {
    alert('暂无流程图数据可导出')
    return
  }
  
  // 计算画布尺寸（添加边距）
  const padding = 40
  const canvasWidth = comboCanvasWidth.value + padding * 2
  const canvasHeight = comboCanvasHeight.value + padding * 2
  
  // 创建 canvas
  const canvas = document.createElement('canvas')
  canvas.width = canvasWidth
  canvas.height = canvasHeight
  const ctx = canvas.getContext('2d')
  
  // 绘制背景
  ctx.fillStyle = '#1a1a2e'
  ctx.fillRect(0, 0, canvasWidth, canvasHeight)
  
  // 绘制标题
  ctx.fillStyle = '#e94560'
  ctx.font = 'bold 16px sans-serif'
  ctx.fillText(`⚡ Combo 路线图 - ${duelInfo.players[0]} vs ${duelInfo.players[1]} (回合 ${duelInfo.turn})`, padding, 25)
  
  // 绘制连接线
  ctx.lineWidth = 2
  for (const conn of connections) {
    ctx.strokeStyle = conn.color
    ctx.beginPath()
    
    // 解析路径命令
    const pathParts = conn.path.split(/([MLZ])/g).filter(p => p.trim())
    let currentCmd = ''
    
    for (let i = 0; i < pathParts.length; i++) {
      const part = pathParts[i].trim()
      if (part === 'M' || part === 'L' || part === 'Z') {
        currentCmd = part
      } else if (part && currentCmd) {
        const coords = part.split(',').map(Number)
        if (coords.length === 2) {
          const x = coords[0] + padding
          const y = coords[1] + padding
          if (currentCmd === 'M') {
            ctx.moveTo(x, y)
          } else if (currentCmd === 'L') {
            ctx.lineTo(x, y)
          }
        }
      }
    }
    ctx.stroke()
    
    // 绘制箭头
    const lastCoords = conn.path.match(/L([\d.]+),([\d.]+)$/)
    if (lastCoords) {
      const endX = parseFloat(lastCoords[1]) + padding
      const endY = parseFloat(lastCoords[2]) + padding
      drawArrow(ctx, endX, endY, conn.color)
    }
    
    // 绘制连接标签
    if (conn.label) {
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 11px sans-serif'
      ctx.shadowColor = '#000000'
      ctx.shadowBlur = 4
      ctx.fillText(conn.label, conn.labelX + padding, conn.labelY + padding)
      ctx.shadowBlur = 0
    }
  }
  
  // 预加载所有卡片图片
  const imagePromises = nodes.map(node => {
    return new Promise((resolve) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => resolve({ node, img, success: true })
      img.onerror = () => resolve({ node, img: null, success: false })
      img.src = BASE_URL + 'pics/' + node.cardCode + '.jpg'
    })
  })
  
  const loadedImages = await Promise.all(imagePromises)
  
  // 绘制卡片节点
  const cardWidth = 60
  const cardHeight = 87
  
  let nodeIndex = 0
  for (const { node, img, success } of loadedImages) {
    nodeIndex++
    const x = node.x + padding
    const y = node.y + padding
    
    // 获取节点类型对应的边框颜色
    const borderColor = getNodeBorderColor(node.type)
    
    // 绘制卡片边框
    ctx.strokeStyle = borderColor
    ctx.lineWidth = 2
    ctx.strokeRect(x, y, cardWidth, cardHeight)
    
    // 绘制序号徽章
    const seqBadgeSize = 18
    ctx.beginPath()
    ctx.arc(x - 3, y - 3, seqBadgeSize / 2, 0, Math.PI * 2)
    ctx.fillStyle = '#1976d2'
    ctx.fill()
    ctx.strokeStyle = '#64b5f6'
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 10px sans-serif'
    const seqText = String(nodeIndex)
    ctx.fillText(seqText, x - 3 - ctx.measureText(seqText).width / 2, y - 3 + 4)
    
    // 绘制初动点/手坑标记
    if (node.isStarter || node.isHandTrap) {
      let badgeText, gradientColors, borderColor, highlightColor
      
      if (node.isStarter) {
        badgeText = '🎯 初动'
        gradientColors = ['#ff6b00', '#ff9800', '#ffc107']
        borderColor = '#ffe082'
        highlightColor = '#ff9800'
      } else if (node.isHandTrap) {
        badgeText = '🛡️ 手坑'
        gradientColors = ['#546e7a', '#455a64', '#37474f']
        borderColor = '#90a4ae'
        highlightColor = '#78909c'
      }
      
      ctx.font = 'bold 10px sans-serif'
      const badgeWidth = ctx.measureText(badgeText).width + 12
      const badgeX = x + cardWidth / 2 - badgeWidth / 2
      const badgeY = y - 24
      
      // 绘制渐变背景
      const gradient = ctx.createLinearGradient(badgeX, badgeY, badgeX + badgeWidth, badgeY + 16)
      gradient.addColorStop(0, gradientColors[0])
      gradient.addColorStop(0.5, gradientColors[1])
      gradient.addColorStop(1, gradientColors[2])
      ctx.fillStyle = gradient
      ctx.beginPath()
      ctx.roundRect(badgeX, badgeY, badgeWidth, 16, 8)
      ctx.fill()
      
      // 绘制边框
      ctx.strokeStyle = borderColor
      ctx.lineWidth = 2
      ctx.stroke()
      
      // 绘制文字
      ctx.fillStyle = '#fff'
      ctx.shadowColor = 'rgba(0, 0, 0, 0.5)'
      ctx.shadowBlur = 2
      ctx.fillText(badgeText, badgeX + 6, badgeY + 12)
      ctx.shadowBlur = 0
      
      // 卡片边框高亮
      ctx.strokeStyle = highlightColor
      ctx.lineWidth = 3
      ctx.strokeRect(x - 1, y - 1, cardWidth + 2, cardHeight + 2)
    }
    
    // 绘制卡片图片或占位
    if (success && img) {
      ctx.drawImage(img, x, y, cardWidth, cardHeight)
    } else {
      // 绘制占位背景
      ctx.fillStyle = '#333'
      ctx.fillRect(x, y, cardWidth, cardHeight)
      ctx.fillStyle = '#666'
      ctx.font = '10px sans-serif'
      ctx.fillText('?', x + cardWidth / 2 - 3, y + cardHeight / 2)
    }
    
    // 绘制顶部标签背景
    const labelText = node.shortLabel
    ctx.font = 'bold 9px sans-serif'
    const labelWidth = ctx.measureText(labelText).width + 8
    ctx.fillStyle = borderColor
    ctx.fillRect(x + cardWidth / 2 - labelWidth / 2, y - 10, labelWidth, 14)
    
    // 绘制顶部标签文字
    ctx.fillStyle = '#fff'
    ctx.fillText(labelText, x + cardWidth / 2 - labelWidth / 2 + 4, y + 1)
    
    // 绘制卡片名称
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)'
    const nameWidth = Math.min(ctx.measureText(node.cardName).width + 8, 100)
    ctx.fillRect(x + cardWidth / 2 - nameWidth / 2, y + cardHeight + 2, nameWidth, 14)
    ctx.fillStyle = '#fff'
    ctx.font = '9px sans-serif'
    const displayName = node.cardName.length > 12 ? node.cardName.slice(0, 12) + '...' : node.cardName
    ctx.fillText(displayName, x + cardWidth / 2 - ctx.measureText(displayName).width / 2, y + cardHeight + 12)
  }
  
  // 绘制底部信息
  ctx.fillStyle = '#888'
  ctx.font = '11px sans-serif'
  const infoText = `节点数: ${nodes.length} | 导出时间: ${new Date().toLocaleString()}`
  ctx.fillText(infoText, padding, canvasHeight - 10)
  
  // 导出图片
  const dataUrl = canvas.toDataURL('image/png')
  const link = document.createElement('a')
  link.download = `combo_flowchart_${Date.now()}.png`
  link.href = dataUrl
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  
  console.log('[Export] 流程图已导出为图片')
}

/**
 * 绘制箭头
 */
function drawArrow(ctx, x, y, color) {
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.lineTo(x - 8, y - 4)
  ctx.lineTo(x - 8, y + 4)
  ctx.closePath()
  ctx.fill()
}

/**
 * 获取节点边框颜色
 */
function getNodeBorderColor(type) {
  switch (type) {
    case 'MOVE': return '#17a2b8'
    case 'SUMMON': return '#ffc107'
    case 'SPSUMMON': return '#e94560'
    case 'CHAIN': return '#9c27b0'
    default: return '#6c757d'
  }
}

// 点击决斗场地，将场地层级提到最高
function onDuelFieldClick() {
  comboPanelOnTop.value = false
  // 点击场地区域时退出预览模式
  if (comboPreviewMode.value) {
    exitComboPreviewMode()
  }
}

// 点击 Combo 面板，将面板层级提到最高
function onComboPanelClick(e) {
  comboPanelOnTop.value = true
  // 点击非下拉菜单区域时关闭下拉菜单
  if (!e.target.closest('.combo-tree-switcher')) {
    showTreeDropdown.value = false
  }
}

// Combo面板调整大小状态
let comboResizing = false
let comboResizeDir = ''
let comboResizeStart = { x: 0, y: 0, width: 0, height: 0, posX: 0, posY: 0 }
const COMBO_MIN_WIDTH = 400
const COMBO_MIN_HEIGHT = 200

function startComboPanelDrag(e) {
  // 阻止点击按钮等时触发
  if (e.target.closest('button')) return
  
  e.preventDefault()
  e.stopPropagation()
  comboDragging = true
  
  const coords = e.touches ? e.touches[0] : e
  comboDragOffset.x = coords.clientX - comboPanelPos.value.x
  comboDragOffset.y = coords.clientY - comboPanelPos.value.y
  
  if (comboPanelRef.value) {
    comboPanelRef.value.classList.add('is-dragging')
  }
  
  document.addEventListener('mousemove', onComboPanelDrag, { passive: false })
  document.addEventListener('mouseup', stopComboPanelDrag)
  document.addEventListener('touchmove', onComboPanelDrag, { passive: false })
  document.addEventListener('touchend', stopComboPanelDrag)
}

function onComboPanelDrag(e) {
  if (!comboDragging) return
  e.preventDefault()
  
  const coords = e.touches ? e.touches[0] : e
  const newX = coords.clientX - comboDragOffset.x
  const newY = coords.clientY - comboDragOffset.y
  
  // 限制在视口内
  const maxX = window.innerWidth - comboPanelSize.value.width
  const maxY = window.innerHeight - comboPanelSize.value.height
  comboPanelPos.value.x = Math.max(0, Math.min(newX, maxX))
  comboPanelPos.value.y = Math.max(0, Math.min(newY, maxY))
  
  if (comboPanelRef.value) {
    comboPanelRef.value.style.left = comboPanelPos.value.x + 'px'
    comboPanelRef.value.style.top = comboPanelPos.value.y + 'px'
  }
}

function stopComboPanelDrag() {
  if (!comboDragging) return
  comboDragging = false
  
  if (comboPanelRef.value) {
    comboPanelRef.value.classList.remove('is-dragging')
  }
  
  document.removeEventListener('mousemove', onComboPanelDrag)
  document.removeEventListener('mouseup', stopComboPanelDrag)
  document.removeEventListener('touchmove', onComboPanelDrag)
  document.removeEventListener('touchend', stopComboPanelDrag)
}

// === Combo面板内容拖拽浏览（手掌拖动） ===
function startComboPan(e) {
  // 如果点击的是卡片节点，不启动拖拽
  if (e.target.closest('.combo-card-node')) return
  
  e.preventDefault()
  comboPanning = true
  
  const coords = e.touches ? e.touches[0] : e
  comboPanStart.x = coords.clientX
  comboPanStart.y = coords.clientY
  
  if (comboContainerRef.value) {
    comboPanScroll.x = comboContainerRef.value.scrollLeft
    comboPanScroll.y = comboContainerRef.value.scrollTop
    comboContainerRef.value.classList.add('is-panning')
  }
  
  document.addEventListener('mousemove', onComboPan, { passive: false })
  document.addEventListener('mouseup', stopComboPan)
  document.addEventListener('touchmove', onComboPan, { passive: false })
  document.addEventListener('touchend', stopComboPan)
}

function onComboPan(e) {
  if (!comboPanning || !comboContainerRef.value) return
  e.preventDefault()
  
  const coords = e.touches ? e.touches[0] : e
  const deltaX = comboPanStart.x - coords.clientX
  const deltaY = comboPanStart.y - coords.clientY
  
  comboContainerRef.value.scrollLeft = comboPanScroll.x + deltaX
  comboContainerRef.value.scrollTop = comboPanScroll.y + deltaY
}

function stopComboPan() {
  if (!comboPanning) return
  comboPanning = false
  
  if (comboContainerRef.value) {
    comboContainerRef.value.classList.remove('is-panning')
  }
  
  document.removeEventListener('mousemove', onComboPan)
  document.removeEventListener('mouseup', stopComboPan)
  document.removeEventListener('touchmove', onComboPan)
  document.removeEventListener('touchend', stopComboPan)
}

// 鼠标滚轮缩放
function onComboWheel(e) {
  if (!e.ctrlKey && !e.metaKey) return // 需要按住Ctrl/Cmd才缩放
  e.preventDefault()
  
  const delta = e.deltaY > 0 ? -0.1 : 0.1
  comboZoom.value = Math.max(0.3, Math.min(2.0, comboZoom.value + delta))
}

// 适应窗口大小
function fitComboToWindow() {
  if (comboFlowNodes.value.length === 0 || !comboContainerRef.value) return
  
  const containerWidth = comboContainerRef.value.clientWidth - 20
  const containerHeight = comboContainerRef.value.clientHeight - 20
  const canvasWidth = comboCanvasWidth.value
  const canvasHeight = comboCanvasHeight.value
  
  const scaleX = containerWidth / canvasWidth
  const scaleY = containerHeight / canvasHeight
  const fitScale = Math.min(scaleX, scaleY, 1.5) // 最大不超过150%
  
  comboZoom.value = Math.max(0.3, Math.round(fitScale * 10) / 10)
  
  // 重置滚动位置
  comboContainerRef.value.scrollLeft = 0
  comboContainerRef.value.scrollTop = 0
}

// 重置缩放
function resetComboZoom() {
  comboZoom.value = 1.0
  if (comboContainerRef.value) {
    comboContainerRef.value.scrollLeft = 0
    comboContainerRef.value.scrollTop = 0
  }
}

// 开始调整大小
function startResize(e, direction) {
  e.preventDefault()
  e.stopPropagation()
  comboResizing = true
  comboResizeDir = direction
  
  const coords = e.touches ? e.touches[0] : e
  comboResizeStart = {
    x: coords.clientX,
    y: coords.clientY,
    width: comboPanelSize.value.width,
    height: comboPanelSize.value.height,
    posX: comboPanelPos.value.x,
    posY: comboPanelPos.value.y
  }
  
  document.addEventListener('mousemove', onResize, { passive: false })
  document.addEventListener('mouseup', stopResize)
  document.addEventListener('touchmove', onResize, { passive: false })
  document.addEventListener('touchend', stopResize)
}

// 调整大小中
function onResize(e) {
  if (!comboResizing) return
  e.preventDefault()
  
  const coords = e.touches ? e.touches[0] : e
  const deltaX = coords.clientX - comboResizeStart.x
  const deltaY = coords.clientY - comboResizeStart.y
  
  let newWidth = comboResizeStart.width
  let newHeight = comboResizeStart.height
  let newX = comboResizeStart.posX
  let newY = comboResizeStart.posY
  
  // 根据方向调整
  if (comboResizeDir.includes('e')) {
    newWidth = Math.max(COMBO_MIN_WIDTH, comboResizeStart.width + deltaX)
  }
  if (comboResizeDir.includes('w')) {
    const widthChange = Math.min(deltaX, comboResizeStart.width - COMBO_MIN_WIDTH)
    newWidth = comboResizeStart.width - widthChange
    newX = comboResizeStart.posX + widthChange
  }
  if (comboResizeDir.includes('s')) {
    newHeight = Math.max(COMBO_MIN_HEIGHT, comboResizeStart.height + deltaY)
  }
  if (comboResizeDir.includes('n')) {
    const heightChange = Math.min(deltaY, comboResizeStart.height - COMBO_MIN_HEIGHT)
    newHeight = comboResizeStart.height - heightChange
    newY = comboResizeStart.posY + heightChange
  }
  
  // 限制在视口内
  newWidth = Math.min(newWidth, window.innerWidth - newX)
  newHeight = Math.min(newHeight, window.innerHeight - newY)
  newX = Math.max(0, newX)
  newY = Math.max(0, newY)
  
  comboPanelSize.value.width = newWidth
  comboPanelSize.value.height = newHeight
  comboPanelPos.value.x = newX
  comboPanelPos.value.y = newY
}

// 停止调整大小
function stopResize() {
  if (!comboResizing) return
  comboResizing = false
  comboResizeDir = ''
  
  document.removeEventListener('mousemove', onResize)
  document.removeEventListener('mouseup', stopResize)
  document.removeEventListener('touchmove', onResize)
  document.removeEventListener('touchend', stopResize)
}

// 流程图布局常量
const COMBO_CARD_WIDTH = 60
const COMBO_CARD_HEIGHT = 87
const comboHGap = ref(50)  // 水平间隔，可调节
const comboVGap = ref(55)  // 垂直间隔，可调节
const COMBO_ROW_HEIGHT = 130
const COMBO_START_X = 30
const COMBO_START_Y = 70  // 增加起始Y位置，给XYZ素材卡片留空间
const COMBO_XYZ_MATERIAL_HEIGHT = 60  // XYZ素材卡片占用的额外高度

/**
 * Combo节点类型
 * @typedef {Object} ComboEntry
 * @property {string} type - 'MOVE' | 'CHAIN' | 'SUMMON' | 'SPSUMMON'
 * @property {string} cardName - 卡片名称
 * @property {number} cardCode - 卡片代码
 * @property {string} detail - 详细描述
 * @property {string} shortLabel - 简短标签
 * @property {number} turn - 所在回合
 * @property {number} step - 步骤编号
 * @property {number} depth - 连锁深度
 * @property {string} fromCardCode - 来源卡片代码（用于连线）
 */

let currentChainDepth = 0
let lastActiveCardCode = null // 追踪上一张活跃卡片

/**
 * 获取动作的简短标签
 */
function getShortLabel(type, detail) {
  if (type === 'SPSUMMON') {
    if (detail.includes('LINK')) return 'LINK'
    if (detail.includes('XYZ')) return 'XYZ'
    if (detail.includes('同调')) return '同调'
    if (detail.includes('融合')) return '融合'
    return '特召'
  }
  if (type === 'SUMMON') return '通召'
  if (type === 'CHAIN') return '发动'
  if (type === 'MOVE') {
    if (detail.includes('额外')) return '额外区'
    if (detail.includes('墓地')) return '墓地'
    if (detail.includes('卡组')) return '卡组'
    if (detail.includes('除外')) return '除外'
    if (detail.includes('手牌')) return '检索'
    return '→'
  }
  return ''
}

/**
 * 获取连接线颜色
 */
function getConnectionColor(type) {
  switch (type) {
    case 'SPSUMMON': return { color: '#e94560', name: 'red' }
    case 'SUMMON': return { color: '#ffc107', name: 'yellow' }
    case 'CHAIN': return { color: '#9c27b0', name: 'purple' }
    case 'MOVE': return { color: '#17a2b8', name: 'blue' }
    default: return { color: '#6c757d', name: 'red' }
  }
}

/**
 * 计算流程图节点位置
 */
const comboFlowNodes = computed(() => {
  const entries = currentTreeEntries.value
  if (entries.length === 0) return []
  
  // 优化布局模式：计算主线基准行，让分支上下展开
  if (useOptimizedLayout.value) {
    return computeOptimizedLayout(entries)
  }
  
  // 默认布局
  const nodes = []
  let mainLineX = COMBO_START_X
  let currentRow = 0
  const cardPositions = new Map() // cardCode -> {x, y, nodeIdx}
  
  // 按照主线和分支布局
  entries.forEach((entry, idx) => {
    let x, y
    const existingPos = cardPositions.get(entry.cardCode)
    
    if (existingPos && entry.type === 'CHAIN') {
      // 如果卡片已存在且是连锁，在旁边显示
      x = existingPos.x
      y = existingPos.y + COMBO_ROW_HEIGHT
    } else if (entry.depth > 0 && entry.type === 'CHAIN') {
      // 连锁中的效果，向下分支
      x = mainLineX
      y = COMBO_START_Y + entry.depth * COMBO_ROW_HEIGHT
    } else {
      // 主线节点
      x = mainLineX
      y = COMBO_START_Y + currentRow * COMBO_ROW_HEIGHT
      
      // 特殊召唤和主要动作在主线上前进
      if (entry.type === 'SPSUMMON' || entry.type === 'SUMMON') {
        mainLineX += COMBO_CARD_WIDTH + comboHGap.value
      } else if (entry.type === 'MOVE') {
        // MOVE类型根据来源决定位置
        if (entry.detail.includes('手牌')) {
          // 检索到手牌，向下分支
          y = COMBO_START_Y + COMBO_ROW_HEIGHT
        }
        mainLineX += COMBO_CARD_WIDTH + comboHGap.value
      } else if (entry.type === 'CHAIN') {
        mainLineX += COMBO_CARD_WIDTH + comboHGap.value
      }
    }
    
    // 记录位置
    if (!cardPositions.has(entry.cardCode)) {
      cardPositions.set(entry.cardCode, { x, y, nodeIdx: idx })
    }
    
    nodes.push({
      ...entry,
      x,
      y,
      shortLabel: getShortLabel(entry.type, entry.detail),
      highlighted: false
    })
  })
  
  return nodes
})

/**
 * 优化布局算法：计算主线基准行，让分支可以上下展开
 */
function computeOptimizedLayout(entries) {
  const nodes = []
  
  // 第一遍：分析每个x位置的分支情况
  // 按x位置分组，统计每个位置需要的上下空间
  const columnInfo = new Map() // x位置 -> { mainNodeIdx, branchUp: [], branchDown: [] }
  let mainLineX = COMBO_START_X
  const cardPositions = new Map()
  
  entries.forEach((entry, idx) => {
    let x
    const existingPos = cardPositions.get(entry.cardCode)
    
    if (existingPos && entry.type === 'CHAIN') {
      x = existingPos.x
    } else {
      x = mainLineX
      if (entry.type === 'SPSUMMON' || entry.type === 'SUMMON' || entry.type === 'MOVE' || entry.type === 'CHAIN') {
        mainLineX += COMBO_CARD_WIDTH + comboHGap.value
      }
    }
    
    if (!cardPositions.has(entry.cardCode)) {
      cardPositions.set(entry.cardCode, { x, idx })
    }
    
    // 记录列信息
    if (!columnInfo.has(x)) {
      columnInfo.set(x, { mainNodeIdx: -1, entries: [] })
    }
    const col = columnInfo.get(x)
    col.entries.push({ entry, idx, isMain: !(existingPos && entry.type === 'CHAIN') && entry.depth === 0 })
    
    // 标记主线节点
    if (!(existingPos && entry.type === 'CHAIN') && entry.depth === 0) {
      col.mainNodeIdx = idx
    }
  })
  
  // 第二遍：计算每列需要的最大分支深度
  let maxBranchUp = 0
  let maxBranchDown = 0
  
  columnInfo.forEach(col => {
    let upCount = 0
    let downCount = 0
    col.entries.forEach(e => {
      if (!e.isMain) {
        // 交替分配上下分支
        if (downCount <= upCount) {
          downCount++
        } else {
          upCount++
        }
      }
    })
    maxBranchUp = Math.max(maxBranchUp, upCount)
    maxBranchDown = Math.max(maxBranchDown, downCount)
  })
  
  // 计算主线基准行（让分支可以上下展开）
  const mainLineRow = maxBranchUp
  
  // 第三遍：分配最终位置
  mainLineX = COMBO_START_X
  cardPositions.clear()
  const columnBranchState = new Map() // x位置 -> { upUsed, downUsed }
  
  entries.forEach((entry, idx) => {
    let x, y
    const existingPos = cardPositions.get(entry.cardCode)
    
    if (existingPos && entry.type === 'CHAIN') {
      // 同一张卡的连锁效果：分配到分支
      x = existingPos.x
      
      if (!columnBranchState.has(x)) {
        columnBranchState.set(x, { upUsed: 0, downUsed: 0 })
      }
      const state = columnBranchState.get(x)
      
      // 交替分配上下
      if (state.downUsed <= state.upUsed) {
        // 往下分支
        state.downUsed++
        y = COMBO_START_Y + (mainLineRow + state.downUsed) * COMBO_ROW_HEIGHT
      } else {
        // 往上分支
        state.upUsed++
        y = COMBO_START_Y + (mainLineRow - state.upUsed) * COMBO_ROW_HEIGHT
      }
    } else if (entry.depth > 0 && entry.type === 'CHAIN') {
      // 连锁深度分支
      x = mainLineX
      
      if (!columnBranchState.has(x)) {
        columnBranchState.set(x, { upUsed: 0, downUsed: 0 })
      }
      const state = columnBranchState.get(x)
      
      // 根据连锁深度交替分配
      if (entry.depth % 2 === 1) {
        state.downUsed++
        y = COMBO_START_Y + (mainLineRow + state.downUsed) * COMBO_ROW_HEIGHT
      } else {
        state.upUsed++
        y = COMBO_START_Y + (mainLineRow - state.upUsed) * COMBO_ROW_HEIGHT
      }
    } else {
      // 主线节点
      x = mainLineX
      y = COMBO_START_Y + mainLineRow * COMBO_ROW_HEIGHT
      
      // 特殊召唤和主要动作在主线上前进
      if (entry.type === 'SPSUMMON' || entry.type === 'SUMMON') {
        mainLineX += COMBO_CARD_WIDTH + comboHGap.value
      } else if (entry.type === 'MOVE') {
        // MOVE检索到手牌，分配到分支
        if (entry.detail.includes('手牌')) {
          if (!columnBranchState.has(x)) {
            columnBranchState.set(x, { upUsed: 0, downUsed: 0 })
          }
          const state = columnBranchState.get(x)
          // 检索往上放
          state.upUsed++
          y = COMBO_START_Y + (mainLineRow - state.upUsed) * COMBO_ROW_HEIGHT
        }
        mainLineX += COMBO_CARD_WIDTH + comboHGap.value
      } else if (entry.type === 'CHAIN') {
        mainLineX += COMBO_CARD_WIDTH + comboHGap.value
      }
    }
    
    // 记录位置
    if (!cardPositions.has(entry.cardCode)) {
      cardPositions.set(entry.cardCode, { x, y, nodeIdx: idx })
    }
    
    nodes.push({
      ...entry,
      x,
      y,
      shortLabel: getShortLabel(entry.type, entry.detail),
      highlighted: false
    })

  })
  
  // 规范化y坐标：确保所有节点y值都是正数
  // 找到最小y值，如果小于安全边距则整体下移
  const MIN_Y_PADDING = 80 // 顶部安全边距（给XYZ素材卡片等留空间）
  const minY = Math.min(...nodes.map(n => n.y))
  if (minY < MIN_Y_PADDING) {
    const offsetY = MIN_Y_PADDING - minY
    nodes.forEach(n => {
      n.y += offsetY
    })
  }
  
  return nodes
}

/**
 * 计算画布尺寸
 */
const comboCanvasWidth = computed(() => {
  if (comboFlowNodes.value.length === 0) return 400
  const maxX = Math.max(...comboFlowNodes.value.map(n => n.x))
  return maxX + COMBO_CARD_WIDTH + 50
})

const comboCanvasHeight = computed(() => {
  if (comboFlowNodes.value.length === 0) return 300
  const maxY = Math.max(...comboFlowNodes.value.map(n => n.y))
  return maxY + COMBO_CARD_HEIGHT + 50
})

/**
 * 计算连接线 - 使用因果图模型
 * 支持：多对多因果关系、因果类型区分、强度可视化
 */
const comboConnections = computed(() => {
  const nodes = comboFlowNodes.value
  if (nodes.length < 2) return []
  
  const connections = []
  const graph = comboCausalGraph.value
  
  // 构建节点位置索引 (nodeId -> position)
  const nodePositions = new Map()
  nodes.forEach(node => {
    if (node.causalNodeId) {
      nodePositions.set(node.causalNodeId, { x: node.x, y: node.y })
    }
    // 也用 step_cardCode 作为备用key
    nodePositions.set(`${node.step}_${node.cardCode}`, { x: node.x, y: node.y })
  })
  
  // 如果因果图有边，使用因果图的边
  if (graph.edges.size > 0) {
    graph.edges.forEach((edge, edgeId) => {
      const fromPos = nodePositions.get(edge.from)
      const toPos = nodePositions.get(edge.to)
      
      if (!fromPos || !toPos) return
      
      // 获取因果边颜色和样式
      const edgeStyle = CAUSAL_EDGE_COLORS[edge.type] || CAUSAL_EDGE_COLORS.TEMPORAL
      
      // 计算连接点
      const fromX = fromPos.x + COMBO_CARD_WIDTH
      const fromY = fromPos.y + COMBO_CARD_HEIGHT / 2
      const toX = toPos.x
      const toY = toPos.y + COMBO_CARD_HEIGHT / 2
      
      // 生成路径
      let path
      const dx = toX - fromX
      const dy = toY - fromY
      
      if (Math.abs(dy) < 10) {
        // 水平连接
        path = `M${fromX},${fromY} L${toX - 6},${toY}`
      } else if (dy > 0) {
        // 向下连接
        const midX = fromX + dx / 2
        path = `M${fromX},${fromY} L${midX},${fromY} L${midX},${toY} L${toX - 6},${toY}`
      } else {
        // 向上连接
        const midX = fromX + 15
        path = `M${fromX},${fromY} L${midX},${fromY} L${midX},${toY} L${toX - 6},${toY}`
      }
      
      // 标签位置
      const labelX = (fromX + toX) / 2
      const labelY = Math.min(fromY, toY) - 5
      
      // 根据因果强度计算线宽 (1.5 ~ 4)
      const strokeWidth = 1.5 + edge.strength * 2.5
      
      connections.push({
        path,
        color: edge.color || edgeStyle.color,
        colorName: edge.label || edgeStyle.name,
        label: edge.label,
        labelX,
        labelY,
        // 新增属性：因果关系信息
        causalType: edge.type,
        causalStrength: edge.strength,
        strokeWidth,
        dashArray: edgeStyle.dashArray,
        edgeId
      })
    })
  } else {
    // 回退：如果因果图为空，使用传统的线性连接
    for (let i = 1; i < nodes.length; i++) {
      const current = nodes[i]
      const prev = nodes[i - 1]
      
      // 如果有指定来源卡片，找到它
      let fromNode = prev
      if (current.fromCardCode) {
        const sourceNode = nodes.find(n => n.cardCode === current.fromCardCode)
        if (sourceNode) fromNode = sourceNode
      }
      
      const colorInfo = getConnectionColor(current.type)
      
      // 计算连接点
      const fromX = fromNode.x + COMBO_CARD_WIDTH
      const fromY = fromNode.y + COMBO_CARD_HEIGHT / 2
      const toX = current.x
      const toY = current.y + COMBO_CARD_HEIGHT / 2
      
      // 生成路径
      let path
      const dx = toX - fromX
      const dy = toY - fromY
      
      if (Math.abs(dy) < 10) {
        path = `M${fromX},${fromY} L${toX - 6},${toY}`
      } else if (dy > 0) {
        const midX = fromX + dx / 2
        path = `M${fromX},${fromY} L${midX},${fromY} L${midX},${toY} L${toX - 6},${toY}`
      } else {
        const midX = fromX + 15
        path = `M${fromX},${fromY} L${midX},${fromY} L${midX},${toY} L${toX - 6},${toY}`
      }
      
      const labelX = (fromX + toX) / 2
      const labelY = Math.min(fromY, toY) - 5
      
      connections.push({
        path,
        color: colorInfo.color,
        colorName: colorInfo.name,
        label: current.shortLabel,
        labelX,
        labelY,
        causalType: 'TEMPORAL',
        causalStrength: 0.5,
        strokeWidth: 2,
        dashArray: ''
      })
    }
  }
  
  return connections
})

/**
 * 添加Combo条目
 */
function addComboEntry(entry) {
  // 预加载模式下跳过添加Combo条目
  if (isPreloading.value) return
  
  // 保存当前场地快照（深拷贝）
  const fieldSnapshot = {
    players: field.players.map(p => ({
      mzone: p.mzone.map(c => c ? { ...c, overlayUnits: c.overlayUnits ? [...c.overlayUnits] : [] } : null),
      szone: p.szone.map(c => c ? { ...c } : null),
      hand: p.hand.map(c => ({ ...c })),
      grave: p.grave.map(c => ({ ...c })),
      removed: p.removed.map(c => ({ ...c })),
      deck: p.deck,
      extra: p.extra,
      extraFaceup: p.extraFaceup
    })),
    chains: field.chains.map(c => ({ ...c }))
  }
  
  // 保存决斗信息快照
  const duelInfoSnapshot = {
    turn: duelInfo.turn,
    phase: duelInfo.phase,
    currentPlayer: duelInfo.currentPlayer,
    lp: [...duelInfo.lp],
    isFirst: duelInfo.isFirst,
    curMsg: duelInfo.curMsg
  }
  
  const newEntry = {
    ...entry,
    turn: duelInfo.turn,
    step: currentStep.value,
    depth: currentChainDepth,
    fromCardCode: lastActiveCardCode,
    shortLabel: getShortLabel(entry.type, entry.detail),
    fieldSnapshot,  // 保存场地快照
    duelInfoSnapshot  // 保存决斗信息快照
  }
  
  // 添加到总因果树（comboTreeEntries始终保存所有条目）
  comboTreeEntries.value.push(newEntry)
  
  // ========== 构建因果图 (DAG) ==========
  // 收集上下文信息用于因果边类型检测
  const causalContext = {
    pendingMaterials: [...pendingXyzMaterials, ...pendingSummonMaterials], // 所有待处理素材
    pendingXyzMaterials: [...pendingXyzMaterials],       // XYZ叠放素材
    pendingSummonMaterials: [...pendingSummonMaterials], // 同调/Link/融合/仪式素材
    searchedCards: new Set(), // 被检索的卡（后续可扩展）
    costCards: new Set(),     // 作为cost的卡（后续可扩展）
    additionalParents: []     // 多对多关系的额外父节点
  }
  
  // 如果有召唤素材，添加到多对多关系
  if (entry.type === 'SPSUMMON') {
    // 根据召唤类型选择对应的素材
    if (entry.summonMaterials && entry.summonMaterials.length > 0) {
      causalContext.additionalParents = entry.summonMaterials.map(m => m.cardCode || m.code)
    } else if (pendingXyzMaterials.length > 0) {
      // 兼容旧逻辑：如果没有统一素材字段但有XYZ素材
      causalContext.additionalParents = pendingXyzMaterials.map(m => m.cardCode || m.code)
    } else if (pendingSummonMaterials.length > 0) {
      // 同调/Link/融合/仪式素材
      causalContext.additionalParents = pendingSummonMaterials.map(m => m.cardCode || m.code)
    }
  }
  
  // 添加到因果图
  const causalNode = addToCausalGraph(newEntry, causalContext)
  
  // 将因果节点信息附加到entry（用于可视化）
  newEntry.causalNodeId = causalNode.id
  newEntry.entropy = causalNode.entropy
  
  // ========== 自动因果树生成逻辑 ==========
  // 1. 如果是初动点（从手牌发起），自动创建新的因果树
  if (newEntry.isStarter) {
    // 检查是否已经为这张卡创建过因果树（避免重复）
    if (!starterToTreeMap.has(newEntry.cardCode)) {
      const newTreeIndex = comboTrees.value.length
      const newTree = {
        id: Date.now() + newTreeIndex,
        name: `🎯 ${newEntry.cardName} 展开`,
        entries: [{ ...newEntry }],
        isTotal: false,
        starterCode: newEntry.cardCode, // 记录初动点卡片代码
        treeType: 'starter' // 初动点类型
      }
      comboTrees.value.push(newTree)
      
      // 记录初动点到因果树的映射
      starterToTreeMap.set(newEntry.cardCode, { 
        treeIndex: newTreeIndex, 
        cardName: newEntry.cardName 
      })
      
      // 记录这张卡属于这个因果树
      if (!cardToTreesMap.has(newEntry.cardCode)) {
        cardToTreesMap.set(newEntry.cardCode, new Set())
      }
      cardToTreesMap.get(newEntry.cardCode).add(newTreeIndex)
    } else {
      // 初动点卡片再次出现（可能是再次发动效果），添加到其因果树
      const treeInfo = starterToTreeMap.get(newEntry.cardCode)
      const tree = comboTrees.value[treeInfo.treeIndex]
      if (tree) {
        tree.entries.push({ ...newEntry })
      }
    }
  }
  // 2. 如果是动点（连锁1但不是从手牌），也创建新的因果树
  else if (newEntry.isActionPoint) {
    // 检查是否已经为这张卡创建过因果树（避免重复）
    const actionKey = `action_${newEntry.cardCode}`
    if (!starterToTreeMap.has(actionKey)) {
      const newTreeIndex = comboTrees.value.length
      const newTree = {
        id: Date.now() + newTreeIndex,
        name: `⚡ ${newEntry.cardName} 发动`,
        entries: [{ ...newEntry }],
        isTotal: false,
        actionPointCode: newEntry.cardCode, // 记录动点卡片代码
        treeType: 'action' // 动点类型
      }
      comboTrees.value.push(newTree)
      
      // 记录动点到因果树的映射
      starterToTreeMap.set(actionKey, { 
        treeIndex: newTreeIndex, 
        cardName: newEntry.cardName 
      })
      
      // 记录这张卡属于这个因果树
      if (!cardToTreesMap.has(newEntry.cardCode)) {
        cardToTreesMap.set(newEntry.cardCode, new Set())
      }
      cardToTreesMap.get(newEntry.cardCode).add(newTreeIndex)
    } else {
      // 动点卡片再次出现，添加到其因果树
      const treeInfo = starterToTreeMap.get(actionKey)
      const tree = comboTrees.value[treeInfo.treeIndex]
      if (tree) {
        tree.entries.push({ ...newEntry })
      }
    }
  }
  // 3. 非初动点/动点：根据 fromCardCode 追踪属于哪个因果树
  else if (newEntry.fromCardCode) {
    const parentTrees = cardToTreesMap.get(newEntry.fromCardCode)
    if (parentTrees && parentTrees.size > 0) {
      // 将这个条目添加到所有相关的因果树
      parentTrees.forEach(treeIndex => {
        const tree = comboTrees.value[treeIndex]
        if (tree && !tree.isTotal) {
          tree.entries.push({ ...newEntry })
        }
      })
      
      // 记录这张卡也属于这些因果树（用于后续追踪）
      if (!cardToTreesMap.has(newEntry.cardCode)) {
        cardToTreesMap.set(newEntry.cardCode, new Set())
      }
      parentTrees.forEach(treeIndex => {
        cardToTreesMap.get(newEntry.cardCode).add(treeIndex)
      })
    }
  }
  
  // 每次添加条目后自动启用优化布局
  useOptimizedLayout.value = true
  
  // 更新最后活跃卡片
  if (entry.type === 'CHAIN' || entry.type === 'SPSUMMON' || entry.type === 'SUMMON') {
    lastActiveCardCode = entry.cardCode
  }
  
  // 自动滚动
  nextTick(() => {
    if (comboContainerRef.value) {
      comboContainerRef.value.scrollLeft = comboContainerRef.value.scrollWidth
    }
  })
}

/**
 * 清空Combo流程图
 */
function clearComboTree() {
  comboTreeEntries.value = []
  currentChainDepth = 0
  lastActiveCardCode = null
  pendingXyzMaterials = []
  pendingSummonMaterials = []  // 清空同调/Link/融合/仪式素材追踪
  lastMaterialMoveStep = -1    // 重置素材移动时间戳
  currentChainCards = []
  hasStarterThisTurn = false  // 重置初动标记
  // 清空自动因果树追踪映射
  starterToTreeMap.clear()
  cardToTreesMap.clear()
  // 移除所有自动生成的子因果树，只保留总因果树
  comboTrees.value = comboTrees.value.filter(tree => tree.isTotal)
  currentTreeIndex.value = 0
  // 清空因果图
  clearCausalGraph()
}

// ==================== 多因果树管理函数 ====================

/**
 * 获取因果树图标
 */
function getTreeIcon(tree) {
  if (tree.isTotal) return '📊'
  if (tree.treeType === 'starter') return '🎯'  // 初动点（从手牌）
  if (tree.treeType === 'action') return '⚡'   // 动点（连锁1非手牌）
  return '🌿'  // 手动创建
}

/**
 * 创建新因果树
 */
function createNewComboTree() {
  const newId = Date.now()
  const newTree = {
    id: newId,
    name: `因果树 ${comboTrees.value.length}`,
    entries: [],
    isTotal: false
  }
  comboTrees.value.push(newTree)
  // 切换到新创建的因果树
  currentTreeIndex.value = comboTrees.value.length - 1
  showTreeDropdown.value = false
}

/**
 * 切换因果树
 */
function switchComboTree(index) {
  if (index >= 0 && index < comboTrees.value.length) {
    currentTreeIndex.value = index
    showTreeDropdown.value = false
  }
}

/**
 * 开始编辑因果树名称
 */
function startEditTreeName() {
  const currentTree = comboTrees.value[currentTreeIndex.value]
  if (currentTree && !currentTree.isTotal) {
    editTreeNameValue.value = currentTree.name
    editingTreeName.value = true
  }
}

/**
 * 保存因果树名称
 */
function saveTreeName() {
  const currentTree = comboTrees.value[currentTreeIndex.value]
  if (currentTree && !currentTree.isTotal && editTreeNameValue.value.trim()) {
    currentTree.name = editTreeNameValue.value.trim()
  }
  editingTreeName.value = false
}

/**
 * 取消编辑因果树名称
 */
function cancelEditTreeName() {
  editingTreeName.value = false
}

/**
 * 删除当前因果树
 */
function deleteCurrentComboTree() {
  const currentTree = comboTrees.value[currentTreeIndex.value]
  if (currentTree && !currentTree.isTotal) {
    if (confirm(`确定要删除因果树「${currentTree.name}」吗？`)) {
      comboTrees.value.splice(currentTreeIndex.value, 1)
      // 切换回总因果树
      currentTreeIndex.value = 0
    }
  }
}

/**
 * 清空当前因果树的条目（不删除因果树本身）
 */
function clearCurrentTreeEntries() {
  const currentTree = comboTrees.value[currentTreeIndex.value]
  if (currentTree) {
    if (currentTree.isTotal) {
      // 总因果树：清空所有
      clearComboTree()
    } else {
      // 子因果树：只清空当前树
      currentTree.entries = []
    }
  }
}

/**
 * 从总因果树中选择条目添加到当前因果树
 * 这个函数允许用户从已有的总条目中选择性地添加到当前子因果树
 */
function copyEntryToCurrentTree(entryIndex) {
  const currentTree = comboTrees.value[currentTreeIndex.value]
  if (currentTree && !currentTree.isTotal && entryIndex >= 0 && entryIndex < comboTreeEntries.value.length) {
    const entry = comboTreeEntries.value[entryIndex]
    // 检查是否已存在
    const exists = currentTree.entries.some(e => e.step === entry.step && e.cardCode === entry.cardCode)
    if (!exists) {
      currentTree.entries.push({ ...entry })
    }
  }
}

/**
 * 左键点击Combo节点 - 显示对应的场地快照
 */
function onComboNodeClick(node, nodeIndex) {
  // 如果节点有场地快照，显示快照预览
  if (node.fieldSnapshot) {
    enterComboPreviewMode(node, nodeIndex)
  }
}

/**
 * 右键点击Combo节点 - 显示卡牌详情
 */
function onComboNodeRightClick(node) {
  // 创建一个临时卡片对象用于显示详情
  selectedCard.value = {
    code: node.cardCode,
    controller: 0,
    location: 0,
    sequence: 0,
    position: 0
  }
}


function enterComboPreviewMode(node, nodeIndex) {
  // 如果已在预览模式且是同一个节点，退出预览
  if (comboPreviewMode.value && comboPreviewNodeIndex.value === nodeIndex) {
    exitComboPreviewMode()
    return
  }
  
  // 首次进入预览模式时备份当前实时场地状态
  if (!comboPreviewMode.value) {
    realTimeFieldBackup = {
      players: field.players.map(p => ({
        mzone: p.mzone.map(c => c ? { ...c, overlayUnits: c.overlayUnits ? [...c.overlayUnits] : [] } : null),
        szone: p.szone.map(c => c ? { ...c } : null),
        hand: p.hand.map(c => ({ ...c })),
        grave: p.grave.map(c => ({ ...c })),
        removed: p.removed.map(c => ({ ...c })),
        deck: p.deck,
        extra: p.extra,
        extraFaceup: p.extraFaceup
      })),
      chains: field.chains.map(c => ({ ...c }))
    }
    realTimeDuelInfoBackup = {
      turn: duelInfo.turn,
      phase: duelInfo.phase,
      currentPlayer: duelInfo.currentPlayer,
      lp: [...duelInfo.lp],
      isFirst: duelInfo.isFirst,
      curMsg: duelInfo.curMsg
    }
  }
  
  // 设置预览模式状态
  comboPreviewMode.value = true
  comboPreviewNodeIndex.value = nodeIndex
  
  // 将快照应用到场地显示
  const snapshot = node.fieldSnapshot
  for (let p = 0; p < 2; p++) {
    field.players[p].mzone = snapshot.players[p].mzone.map(c => 
      c ? { ...c, overlayUnits: c.overlayUnits ? [...c.overlayUnits] : [] } : null
    )
    field.players[p].szone = snapshot.players[p].szone.map(c => c ? { ...c } : null)
    field.players[p].hand = snapshot.players[p].hand.map(c => ({ ...c }))
    field.players[p].grave = snapshot.players[p].grave.map(c => ({ ...c }))
    field.players[p].removed = snapshot.players[p].removed.map(c => ({ ...c }))
    field.players[p].deck = snapshot.players[p].deck
    field.players[p].extra = snapshot.players[p].extra
    field.players[p].extraFaceup = snapshot.players[p].extraFaceup
  }
  field.chains = snapshot.chains.map(c => ({ ...c }))
  
  // 应用决斗信息快照（如果有）
  if (node.duelInfoSnapshot) {
    duelInfo.lp = [...node.duelInfoSnapshot.lp]
  }
}

/**
 * 退出Combo预览模式 - 恢复实时场地状态
 */
function exitComboPreviewMode() {
  if (!comboPreviewMode.value || !realTimeFieldBackup) return
  
  // 恢复实时场地状态
  for (let p = 0; p < 2; p++) {
    field.players[p].mzone = realTimeFieldBackup.players[p].mzone.map(c => 
      c ? { ...c, overlayUnits: c.overlayUnits ? [...c.overlayUnits] : [] } : null
    )
    field.players[p].szone = realTimeFieldBackup.players[p].szone.map(c => c ? { ...c } : null)
    field.players[p].hand = realTimeFieldBackup.players[p].hand.map(c => ({ ...c }))
    field.players[p].grave = realTimeFieldBackup.players[p].grave.map(c => ({ ...c }))
    field.players[p].removed = realTimeFieldBackup.players[p].removed.map(c => ({ ...c }))
    field.players[p].deck = realTimeFieldBackup.players[p].deck
    field.players[p].extra = realTimeFieldBackup.players[p].extra
    field.players[p].extraFaceup = realTimeFieldBackup.players[p].extraFaceup
  }
  field.chains = realTimeFieldBackup.chains.map(c => ({ ...c }))
  
  // 恢复决斗信息
  if (realTimeDuelInfoBackup) {
    duelInfo.lp = [...realTimeDuelInfoBackup.lp]
  }
  
  // 清除预览状态
  comboPreviewMode.value = false
  comboPreviewNodeIndex.value = -1
  realTimeFieldBackup = null
  realTimeDuelInfoBackup = null
}

// Promise 控制 (模拟 ygopro actionSignal)
let actionResolve = null
const actionSignal = {
  wait: () => new Promise(resolve => { actionResolve = resolve }),
  set: () => { if (actionResolve) { actionResolve(); actionResolve = null } },
  reset: () => { actionResolve = null }
}

// ========== 辅助函数 ==========

function getMessageName(type) {
  for (const [name, value] of Object.entries(MSG)) {
    if (value === type) return name
  }
  return `MSG_${type}`
}

function getPhaseName(phase) {
  switch (phase) {
    case PHASE.DRAW: return '抽卡阶段'
    case PHASE.STANDBY: return '准备阶段'
    case PHASE.MAIN1: return '主要阶段1'
    case PHASE.BATTLE_START: return '战斗开始'
    case PHASE.BATTLE_STEP: return '战斗步骤'
    case PHASE.DAMAGE: return '伤害步骤'
    case PHASE.DAMAGE_CAL: return '伤害计算'
    case PHASE.BATTLE: return '战斗阶段'
    case PHASE.MAIN2: return '主要阶段2'
    case PHASE.END: return '结束阶段'
    default: return `阶段 ${phase}`
  }
}

function getLocationName(location) {
  if (location & LOCATION.DECK) return '卡组'
  if (location & LOCATION.HAND) return '手牌'
  if (location & LOCATION.MZONE) return '怪兽区'
  if (location & LOCATION.SZONE) return '魔陷区'
  if (location & LOCATION.GRAVE) return '墓地'
  if (location & LOCATION.REMOVED) return '除外'
  if (location & LOCATION.EXTRA) return '额外'
  if (location & LOCATION.OVERLAY) return '叠放'
  return `位置 ${location}`
}

function getPositionName(position) {
  if (position === POS.FACEUP_ATTACK) return '表侧攻击'
  if (position === POS.FACEDOWN_ATTACK) return '里侧攻击'
  if (position === POS.FACEUP_DEFENSE) return '表侧守备'
  if (position === POS.FACEDOWN_DEFENSE) return '里侧守备'
  return `表示 ${position}`
}

function getCardClass(card) {
  if (!card) return ''
  const classes = []
  if (card.position & POS.FACEDOWN) classes.push('facedown')
  // 只有怪兽区的卡片才应用守备表示（旋转90度），魔法陷阱区不旋转
  if ((card.position & POS.DEFENSE) && (card.location & LOCATION.MZONE)) classes.push('defense')
  return classes.join(' ')
}

function isMonsterFaceup(card) {
  return card && (card.position & POS.FACEUP) && (card.location & LOCATION.MZONE)
}

// 获取左额外怪兽区的卡片（两个玩家共享）
// 从固定视角看，左EMZ对应：玩家0的mzone[5] 或 玩家1的mzone[6]
function getLeftEMZCard() {
  return field.players[0].mzone[5] || field.players[1].mzone[6]
}

// 获取右额外怪兽区的卡片（两个玩家共享）
// 从固定视角看，右EMZ对应：玩家0的mzone[6] 或 玩家1的mzone[5]
function getRightEMZCard() {
  return field.players[0].mzone[6] || field.players[1].mzone[5]
}

function getCardImageUrl(card) {
  if (!card) return null
  if (card.position & POS.FACEDOWN) return `${BASE_URL}images/back.jpg`
  if (card.code) return `${BASE_URL}pics/${card.code}.jpg`
  return null
}

// 获取墓地顶部卡片
function getGraveTopCard(player) {
  const grave = field.players[player].grave
  if (grave.length > 0) {
    return grave[grave.length - 1]
  }
  return null
}

// 获取除外区顶部卡片
function getRemovedTopCard(player) {
  const removed = field.players[player].removed
  if (removed.length > 0) {
    return removed[removed.length - 1]
  }
  return null
}

// 获取顶部卡片图片URL（用于墓地/除外区）
function getTopCardImageUrl(card) {
  if (!card) return `${BASE_URL}images/back.jpg`
  if (card.code) return `${BASE_URL}pics/${card.code}.jpg`
  return `${BASE_URL}images/back.jpg`
}

function getCardName(code) {
  if (!code) return '未知'
  const data = cardDatabase.get(code)
  return data?.name || `卡片#${code}`
}

function handleImageError(e) {
  e.target.style.display = 'none'
}

function showCard(card) {
  if (card) {
    selectedCard.value = { ...card }
  }
}

function showZone(player, location, sequence = null) {
  console.log(`Show zone: Player ${player}, Location ${location}${sequence !== null ? `, Seq ${sequence}` : ''}`)
  
  const playerName = duelInfo.players[localPlayer(player)]
  let cards = []
  let title = ''
  
  // 根据位置获取卡片列表
  if (location === LOCATION.DECK) {
    // 卡组 - 显示原始卡组内容（回放开始时的卡组）
    title = `${playerName} 的卡组`
    const deckData = replayDecks[player]
    if (deckData && deckData.main) {
      cards = deckData.main.map((code, idx) => ({
        code,
        name: getCardName(code),
        index: idx + 1
      }))
    }
  } else if (location === LOCATION.EXTRA) {
    // 额外卡组
    title = `${playerName} 的额外卡组`
    const deckData = replayDecks[player]
    if (deckData && deckData.extra) {
      cards = deckData.extra.map((code, idx) => ({
        code,
        name: getCardName(code),
        index: idx + 1
      }))
    }
  } else if (location === LOCATION.GRAVE) {
    // 墓地
    title = `${playerName} 的墓地`
    const p = field.players[localPlayer(player)]
    cards = p.grave.map((card, idx) => ({
      code: card.code,
      name: getCardName(card.code),
      index: idx + 1,
      card: card
    }))
  } else if (location === LOCATION.REMOVED) {
    // 除外区
    title = `${playerName} 的除外区`
    const p = field.players[localPlayer(player)]
    cards = p.removed.map((card, idx) => ({
      code: card.code,
      name: getCardName(card.code),
      index: idx + 1,
      card: card
    }))
  } else if (location === LOCATION.HAND) {
    // 手牌
    title = `${playerName} 的手牌`
    const p = field.players[localPlayer(player)]
    cards = p.hand.map((card, idx) => ({
      code: card.code,
      name: getCardName(card.code),
      index: idx + 1,
      card: card
    }))
  }
  
  if (cards.length > 0) {
    zoneViewTitle.value = title
    zoneViewCards.value = cards
    zoneViewVisible.value = true
  }
}

// 关闭区域查看弹窗
function closeZoneView() {
  zoneViewVisible.value = false
  zoneViewCards.value = []
}

// 在区域查看中点击卡片
function onZoneCardClick(item) {
  if (item.card) {
    showCard(item.card)
  } else if (item.code) {
    // 对于卡组中的卡片，创建一个临时卡片对象显示
    const cardData = getCardData(item.code)
    selectedCard.value = {
      code: item.code,
      controller: 0,
      location: LOCATION.DECK,
      sequence: item.index - 1,
      position: POS.FACEUP,
      attack: cardData.attack,
      defense: cardData.defense,
      level: cardData.level,
      rank: (cardData.type & 0x800000) ? cardData.level : 0,
      type: cardData.type
    }
  }
}

// LocalPlayer: 根据视角交换玩家索引
function localPlayer(player) {
  return duelInfo.isReplaySwapped ? (1 - player) : player
}

// ========== 初始化函数 ==========

// 加载 OCGCore WASM 模块
async function loadOCGCore() {
  loadingStatus.value = '加载 OCGCore WASM...'
  loadingProgress.value = 10

  try {
    // 使用 ES 模块导入的 OCGCore 初始化
    ocgModule = await OCGCore({
      locateFile: (path) => BASE_URL + path
    })

    // 设置回调函数到 Module 对象
    // 这些函数将被 WASM 内部通过 EM_ASM 调用
    // 追踪脚本加载失败的情况
    const scriptLoadFailures = []
    // 待加载的脚本队列（用于异步加载后重试）
    const pendingScripts = new Map()
    
    ocgModule._jsScriptReader = (namePtr) => {
      const name = ocgModule.UTF8ToString(namePtr)
      
      // 尝试多种路径格式匹配缓存
      let script = scriptCache.get(name)
      if (!script) script = scriptCache.get(`./${name}`)
      if (!script) script = scriptCache.get(`script/${name}`)
      if (!script) script = scriptCache.get(`./script/${name}`)
      
      // 如果仍未找到，尝试提取基础文件名匹配
      if (!script && name.includes('/')) {
        const baseName = name.split('/').pop()
        if (baseName) {
          script = scriptCache.get(`./script/${baseName}`)
        }
      }
      
      if (script) {
        const bufPtr = ocgModule._allocate_script_buffer(script.length)
        ocgModule.HEAPU8.set(script, bufPtr)
        return script.length
      }
      
      // 尝试从卡片代码中提取并同步请求加载
      const match = name.match(/c(\d+)\.lua$/)
      if (match && !scriptLoadFailures.includes(name)) {
        const code = match[1]
        // 尝试同步 XHR 加载（仅用于开发环境，生产环境应预加载所有脚本）
        try {
          const xhr = new XMLHttpRequest()
          xhr.open('GET', `${BASE_URL}scripts/c${code}.lua`, false) // 同步请求
          xhr.send()
          if (xhr.status === 200) {
            const encoder = new TextEncoder()
            const scriptData = encoder.encode(xhr.responseText)
            scriptCache.set(`./script/c${code}.lua`, scriptData)
            console.log('[OCGCore] 动态加载脚本成功:', code)
            const bufPtr = ocgModule._allocate_script_buffer(scriptData.length)
            ocgModule.HEAPU8.set(scriptData, bufPtr)
            return scriptData.length
          }
        } catch (e) {
          // 同步请求失败
        }
      }
      
      // 记录加载失败的脚本
      if (!scriptLoadFailures.includes(name)) {
        scriptLoadFailures.push(name)
        console.warn('[OCGCore] 脚本未找到:', name, '(缓存中有', scriptCache.size, '个脚本)')
      }
      return 0
    }

    ocgModule._jsCardReader = (code, dataPtr) => {
      const cardData = cardDatabase.get(code)
      if (cardData) {
        // 参数顺序必须匹配 wasm_bindings.cpp 中的 fill_card_data:
        // code, alias, setcode_low, setcode_high, type, level, attribute, race, attack, defense, lscale, rscale, link_marker
        const setcode = BigInt(cardData.setcode || 0)
        const setcode_low = Number(setcode & 0xFFFFFFFFn)
        const setcode_high = Number((setcode >> 32n) & 0xFFFFFFFFn)
        
        ocgModule._fill_card_data(
          dataPtr,
          cardData.code || 0,
          cardData.alias || 0,
          setcode_low,
          setcode_high,
          cardData.type || 0,
          cardData.level || 0,
          cardData.attribute || 0,
          cardData.race || 0,
          cardData.attack || 0,
          cardData.defense || 0,
          cardData.lscale || 0,
          cardData.rscale || 0,
          cardData.link_marker || 0
        )
        return 1
      }
      console.warn('[OCGCore] 卡片未找到:', code)
      return 0
    }

    ocgModule._jsMessageHandler = (duelPtr, type) => {
      // 消息处理器，返回 0 表示不进行特殊处理
      return 0
    }

    // 设置回调（传递非零值激活回调）
    ocgModule._set_script_reader_wasm(1)
    ocgModule._set_card_reader_wasm(1)
    ocgModule._set_message_handler_wasm(1)

    ocgReady.value = true
    console.log('[OCGCore] WASM 模块加载成功')
    return true
  } catch (e) {
    console.error('[OCGCore] 加载失败:', e)
    throw new Error('OCGCore WASM 加载失败: ' + e.message)
  }
}

import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';

// 加载卡片数据库 (使用 sql.js)
async function loadCardDatabase() {
  loadingStatus.value = '加载卡片数据库...'
  loadingProgress.value = 30

  try {
    // 动态导入 sql.js
    const initSqlJs = (await import('sql.js')).default
    const SQL = await initSqlJs({
      locateFile: () => wasmUrl
    })

    // 加载 cards.cdb
    const response = await fetch(`${BASE_URL}cards.cdb`)
    const buffer = await response.arrayBuffer()
    sqlDb = new SQL.Database(new Uint8Array(buffer))

    // 查询所有卡片数据
    const results = sqlDb.exec(`
      SELECT d.id, d.ot, d.alias, d.setcode, d.type, d.atk, d.def, d.level, d.race, d.attribute,
             t.name, t.desc
      FROM datas d
      LEFT JOIN texts t ON d.id = t.id
    `)

    if (results.length > 0) {
      const columns = results[0].columns
      const values = results[0].values

      for (const row of values) {
        const card = {}
        columns.forEach((col, idx) => {
          card[col] = row[idx]
        })

        // 解析 level 字段 (包含等级、阶级、灵摆刻度等)
        const levelInfo = card.level || 0
        card.level = levelInfo & 0xff
        card.lscale = (levelInfo >> 24) & 0xff
        card.rscale = (levelInfo >> 16) & 0xff

        // 解析 setcode 为 link_marker (对于 link 怪兽)
        if (card.type & 0x4000000) { // TYPE_LINK
          card.link_marker = card.def
          card.defense = 0
        } else {
          card.defense = card.def
          card.link_marker = 0
        }

        card.code = card.id
        card.attack = card.atk

        cardDatabase.set(card.id, card)
      }
    }

    dbReady.value = true
    console.log(`[Database] 加载了 ${cardDatabase.size} 张卡片`)
    return true
  } catch (e) {
    console.error('[Database] 加载失败:', e)
    throw new Error('卡片数据库加载失败: ' + e.message)
  }
}

// 预加载 Lua 脚本
async function preloadScripts() {
  loadingStatus.value = '预加载脚本...'
  loadingProgress.value = 50

  try {
    // 加载核心脚本（路径格式必须匹配 OCGCore 请求的 ./script/xxx.lua）
    const coreScripts = ['constant.lua', 'utility.lua', 'procedure.lua']
    for (const name of coreScripts) {
      // 核心脚本在 public/scripts 目录下
      const response = await fetch(`${BASE_URL}scripts/${name}`)
      if (response.ok) {
        const text = await response.text()
        const encoder = new TextEncoder()
        const scriptData = encoder.encode(text)
        // OCGCore 请求的路径格式是 ./script/xxx.lua
        scriptCache.set(`./script/${name}`, scriptData)
        console.log('[Scripts] 核心脚本已加载:', `./script/${name}`)
      } else {
        console.warn('[Scripts] 核心脚本未找到:', name)
      }
    }

    scriptsLoaded.value = true
    console.log('[Scripts] 核心脚本加载完成')
    return true
  } catch (e) {
    console.error('[Scripts] 加载失败:', e)
    // 脚本加载失败不阻止继续
    return true
  }
}

// 加载单张卡牌脚本
async function loadCardScript(code) {
  const scriptName = `c${code}.lua`
  // OCGCore 请求的路径格式是 ./script/c{code}.lua
  const cacheKey = `./script/${scriptName}`
  
  if (scriptCache.has(cacheKey)) return true

  try {
    // 尝试从 scripts 目录加载
    let response = await fetch(`${BASE_URL}scripts/${scriptName}`)
    if (!response.ok) {
      // 也尝试从 script 目录加载
      response = await fetch(`${BASE_URL}script/${scriptName}`)
    }
    if (response.ok) {
      const text = await response.text()
      const encoder = new TextEncoder()
      scriptCache.set(cacheKey, encoder.encode(text))
      console.log('[Scripts] 卡片脚本已加载:', code, scriptName)
      return true
    } else {
      console.warn('[Scripts] 卡片脚本加载失败:', code, scriptName, response.status)
    }
  } catch (e) {
    console.error('[Scripts] 卡片脚本加载异常:', code, e)
  }
  return false
}

// ========== YRP 文件解析 (完全模仿 ygopro Replay 类) ==========

async function parseReplayFile(buffer) {
  const data = new Uint8Array(buffer)
  const view = new DataView(buffer)

  // 边界检查辅助函数
  const checkBounds = (offset, size, maxSize, context) => {
    if (offset + size > maxSize) {
      throw new Error(`回放文件数据不完整: ${context} (需要 ${offset + size} 字节, 实际只有 ${maxSize} 字节)`)
    }
  }

  let offset = 0

  // 检查文件头最小长度
  checkBounds(0, 32, buffer.byteLength, '文件头')

  // 读取头部
  const header = {
    id: view.getUint32(offset, true),
    version: view.getUint32(offset + 4, true),
    flag: view.getUint32(offset + 8, true),
    seed: view.getUint32(offset + 12, true),
    datasize: view.getUint32(offset + 16, true),
    start_time: view.getUint32(offset + 20, true),
    props: new Uint8Array(buffer.slice(offset + 24, offset + 32))
  }
  offset = 32

  // YRP2 扩展头部
  let seedSequence = null
  if (header.id === REPLAY_ID.YRP2) {
    checkBounds(offset, 48, buffer.byteLength, 'YRP2扩展头部')
    seedSequence = []
    for (let i = 0; i < 8; i++) {
      seedSequence.push(view.getUint32(offset, true))
      offset += 4
    }
    // 跳过扩展字段
    offset += 16
  }

  // 解压数据（如果需要）
  let replayContent
  if (header.flag & REPLAY_FLAG.COMPRESSED) {
    const compressedData = data.slice(offset)
    if (compressedData.length === 0) {
      throw new Error('回放文件压缩数据为空')
    }
    try {
      replayContent = await decompressLZMA(compressedData, header.datasize, header.props)
    } catch (e) {
      console.error('LZMA decompress failed:', e)
      throw new Error('回放文件解压失败')
    }
  } else {
    replayContent = data.slice(offset, offset + header.datasize)
  }

  // 检查解压后数据是否有效
  if (!replayContent || replayContent.length === 0) {
    throw new Error('回放文件内容为空')
  }

  // 解析内容
  const contentView = new DataView(replayContent.buffer, replayContent.byteOffset, replayContent.byteLength)
  const contentLength = replayContent.byteLength
  let contentOffset = 0

  // 读取玩家名称
  const players = []
  const playerCount = (header.flag & REPLAY_FLAG.TAG) ? 4 : 2
  const playerNameSize = 40 // 每个玩家名称 20 个 UTF-16 字符 = 40 字节
  checkBounds(contentOffset, playerCount * playerNameSize, contentLength, '玩家名称')
  
  for (let i = 0; i < playerCount; i++) {
    const nameChars = []
    for (let j = 0; j < 20; j++) {
      const char = contentView.getUint16(contentOffset + j * 2, true)
      if (char === 0) break
      nameChars.push(String.fromCharCode(char))
    }
    players.push(nameChars.join('') || `Player ${i + 1}`)
    contentOffset += 40
  }

  // 读取决斗参数
  checkBounds(contentOffset, 16, contentLength, '决斗参数')
  const params = {
    startLP: contentView.getInt32(contentOffset, true),
    startHand: contentView.getInt32(contentOffset + 4, true),
    drawCount: contentView.getInt32(contentOffset + 8, true),
    duelFlag: contentView.getUint32(contentOffset + 12, true)
  }
  contentOffset += 16

  // 读取卡组（非单人模式）
  const decks = []
  if (!(header.flag & REPLAY_FLAG.SINGLE_MODE)) {
    const deckCount = (header.flag & REPLAY_FLAG.TAG) ? 4 : 2
    for (let i = 0; i < deckCount; i++) {
      checkBounds(contentOffset, 4, contentLength, `卡组${i + 1}主卡组数量`)
      const mainCount = contentView.getInt32(contentOffset, true)
      contentOffset += 4
      
      // 验证主卡组数量合理性
      if (mainCount < 0 || mainCount > 200) {
        throw new Error(`回放文件格式错误: 主卡组数量异常 (${mainCount})`)
      }
      
      checkBounds(contentOffset, mainCount * 4, contentLength, `卡组${i + 1}主卡组卡片`)
      const main = []
      for (let j = 0; j < mainCount; j++) {
        main.push(contentView.getUint32(contentOffset, true))
        contentOffset += 4
      }

      checkBounds(contentOffset, 4, contentLength, `卡组${i + 1}额外卡组数量`)
      const extraCount = contentView.getInt32(contentOffset, true)
      contentOffset += 4
      
      // 验证额外卡组数量合理性
      if (extraCount < 0 || extraCount > 30) {
        throw new Error(`回放文件格式错误: 额外卡组数量异常 (${extraCount})`)
      }
      
      checkBounds(contentOffset, extraCount * 4, contentLength, `卡组${i + 1}额外卡组卡片`)
      const extra = []
      for (let j = 0; j < extraCount; j++) {
        extra.push(contentView.getUint32(contentOffset, true))
        contentOffset += 4
      }

      decks.push({ main, extra })
    }
  }

  // 读取响应数据（模仿 ygopro Replay::ReadNextResponse）
  // 格式：1字节长度 + len字节数据
  const responseList = []
  while (contentOffset < replayContent.length) {
    const respLen = replayContent[contentOffset]
    contentOffset++
    
    // 检查是否有足够的数据
    if (contentOffset + respLen > replayContent.length) break
    
    // 即使 respLen 是 0 也是有效的响应
    const resp = replayContent.slice(contentOffset, contentOffset + respLen)
    responseList.push(resp)
    contentOffset += respLen
  }
  
  console.log('[Replay] 解析到', responseList.length, '条响应数据')

  return {
    header,
    seedSequence,
    players,
    params,
    decks,
    responses: responseList
  }
}

// LZMA 解压 (使用 lzma.js)
async function decompressLZMA(compressedData, uncompressedSize, props) {
  // 使用 ES 模块导入的 LZMA

  // 构建输入流
  const inStream = new LZMA.iStream(compressedData)

  // 创建输出流
  const outStream = new LZMA.oStream()

  // 创建解码器
  const decoder = new LZMA.Decoder()

  // 从 props 解析 LZMA 属性
  const propsValue = props[0]
  const lc = propsValue % 9
  const remainder = Math.floor(propsValue / 9)
  const lp = remainder % 5
  const pb = Math.floor(remainder / 5)

  // 从 props 解析字典大小
  let dictSize = props[1]
  dictSize |= props[2] << 8
  dictSize |= props[3] << 16
  dictSize += props[4] * 16777216

  // 设置解码器属性
  if (!decoder.setLcLpPb(lc, lp, pb)) {
    throw new Error('Invalid LZMA properties')
  }
  if (!decoder.setDictionarySize(dictSize)) {
    throw new Error('Invalid dictionary size')
  }

  // 解码
  if (!decoder.decodeBody(inStream, outStream, uncompressedSize)) {
    throw new Error('LZMA decode failed')
  }

  return outStream.toUint8Array()
}

// ========== OCGCore 交互 (模仿 ygopro ReplayMode) ==========

function getCardData(code) {
  if (cardDatabase.has(code)) {
    return cardDatabase.get(code)
  }
  // 返回默认数据
  return {
    code,
    alias: 0,
    setcode: 0,
    type: 0,
    level: 0,
    attribute: 0,
    race: 0,
    attack: 0,
    defense: 0,
    lscale: 0,
    rscale: 0,
    link_marker: 0
  }
}

// 创建卡片对象
function createCard(code, controller, location, sequence, position) {
  const cardData = getCardData(code)
  return {
    code,
    controller,
    location,
    sequence,
    position,
    alias: cardData.alias,
    type: cardData.type,
    level: cardData.level,
    rank: (cardData.type & 0x800000) ? cardData.level : 0, // TYPE_XYZ
    attribute: cardData.attribute,
    race: cardData.race,
    attack: cardData.attack,
    defense: cardData.defense,
    lscale: cardData.lscale,
    rscale: cardData.rscale,
    link: (cardData.type & 0x4000000) ? (cardData.level & 0xf) : 0, // TYPE_LINK
    link_marker: cardData.link_marker,
    overlays: [],
    counters: {}
  }
}

// 获取场上卡片
function getFieldCard(player, location, sequence) {
  const p = field.players[player]
  if (location & LOCATION.MZONE) {
    return p.mzone[sequence]
  } else if (location & LOCATION.SZONE) {
    return p.szone[sequence]
  } else if (location & LOCATION.HAND) {
    return p.hand[sequence]
  } else if (location & LOCATION.GRAVE) {
    return p.grave[sequence]
  } else if (location & LOCATION.REMOVED) {
    return p.removed[sequence]
  }
  return null
}

// 添加卡片到场地
function addCardToField(card) {
  const p = field.players[card.controller]
  if (card.location & LOCATION.MZONE) {
    p.mzone[card.sequence] = card
  } else if (card.location & LOCATION.SZONE) {
    p.szone[card.sequence] = card
  } else if (card.location & LOCATION.HAND) {
    p.hand.push(card)
    card.sequence = p.hand.length - 1
  } else if (card.location & LOCATION.GRAVE) {
    p.grave.push(card)
    card.sequence = p.grave.length - 1
  } else if (card.location & LOCATION.REMOVED) {
    p.removed.push(card)
    card.sequence = p.removed.length - 1
  } else if (card.location & LOCATION.DECK) {
    p.deck++
  } else if (card.location & LOCATION.EXTRA) {
    p.extra++
  }
}

// 从场地移除卡片
function removeCardFromField(player, location, sequence) {
  const p = field.players[player]
  let card = null

  if (location & LOCATION.MZONE) {
    card = p.mzone[sequence]
    p.mzone[sequence] = null
  } else if (location & LOCATION.SZONE) {
    card = p.szone[sequence]
    p.szone[sequence] = null
  } else if (location & LOCATION.HAND) {
    if (sequence < p.hand.length) {
      card = p.hand.splice(sequence, 1)[0]
      // 更新后续卡片的 sequence
      for (let i = sequence; i < p.hand.length; i++) {
        if (p.hand[i]) p.hand[i].sequence = i
      }
    }
  } else if (location & LOCATION.GRAVE) {
    if (sequence < p.grave.length) {
      card = p.grave.splice(sequence, 1)[0]
      for (let i = sequence; i < p.grave.length; i++) {
        if (p.grave[i]) p.grave[i].sequence = i
      }
    }
  } else if (location & LOCATION.REMOVED) {
    if (sequence < p.removed.length) {
      card = p.removed.splice(sequence, 1)[0]
      for (let i = sequence; i < p.removed.length; i++) {
        if (p.removed[i]) p.removed[i].sequence = i
      }
    }
  } else if (location & LOCATION.DECK) {
    p.deck = Math.max(0, p.deck - 1)
  } else if (location & LOCATION.EXTRA) {
    p.extra = Math.max(0, p.extra - 1)
  }

  return card
}

// ========== 回放控制函数 (对应 ygopro ReplayMode) ==========

/**
 * 开始回放 (对应 StartReplay)
 */
async function startReplay(skipTurnCount = 0) {
  skipTurn.value = Math.max(0, skipTurnCount)
  isReplaySkipping.value = skipTurn.value > 0

  // 启动回放线程
  await replayThread()
  return true
}

/**
 * 停止回放 (对应 StopReplay)
 */
function stopReplay(isExiting = false) {
  isPausing.value = false
  isContinuing.value = false
  isClosing.value = isExiting
  exitPending.value = true
  actionSignal.set()
}

/**
 * 切换视角 (对应 SwapField)
 */
function swapField() {
  if (isPaused.value) {
    doSwapField()
  } else {
    isSwapping.value = true
  }
}

function doSwapField() {
  duelInfo.isReplaySwapped = !duelInfo.isReplaySwapped

  // 交换玩家数据
  const temp = JSON.parse(JSON.stringify(field.players[0]))
  Object.assign(field.players[0], field.players[1])
  Object.assign(field.players[1], temp)

  const tempLp = duelInfo.lp[0]
  duelInfo.lp[0] = duelInfo.lp[1]
  duelInfo.lp[1] = tempLp

  const tempName = duelInfo.players[0]
  duelInfo.players[0] = duelInfo.players[1]
  duelInfo.players[1] = tempName
}

/**
 * 暂停/继续 (对应 Pause)
 */
function pause(isPause, isStep = false) {
  if (isPause) {
    isPausing.value = true
  } else {
    if (!isStep) {
      isPausing.value = false
    }
    actionSignal.set()
  }
}

// 追踪响应消息类型
let lastResponseMsgType = 0
let responseHistory = []

/**
 * 读取回放响应并提交 (对应 ReadReplayResponse)
 * 完全模仿 ygopro ReplayMode::ReadReplayResponse
 */
function readReplayResponse() {
  if (responseIndex.value >= responses.value.length) {
    console.warn('[ReplayMode] No more responses, index:', responseIndex.value, 'total:', responses.value.length)
    return false
  }

  const resp = responses.value[responseIndex.value]
  const respIdx = responseIndex.value
  responseIndex.value++

  // 解析响应值（小端序 int32）
  let respValue = 0
  if (resp.length >= 4) {
    respValue = resp[0] | (resp[1] << 8) | (resp[2] << 16) | (resp[3] << 24)
    // 转换为有符号整数
    if (respValue > 0x7FFFFFFF) respValue -= 0x100000000
  } else if (resp.length > 0) {
    respValue = resp[0]
  }

  // 记录响应历史
  responseHistory.push({
    index: respIdx,
    msgType: lastResponseMsgType,
    msgName: getMessageName(lastResponseMsgType),
    len: resp.length,
    value: respValue
  })

  console.log('[ReplayMode] 提交响应 #' + respIdx + ' for ' + getMessageName(lastResponseMsgType) + ':', 
    'len=' + resp.length, 
    'bytes=[' + Array.from(resp.slice(0, Math.min(8, resp.length))).map(b => '0x' + b.toString(16).padStart(2, '0')).join(', ') + ']',
    'value=' + respValue)

  // 使用预加载数据播放时，不需要向 OCGCore 提交响应（消息已预先收集）
  if (usePreloadedData.value) {
    return true
  }

  // 提交响应到 OCGCore
  // 必须分配 SIZE_RETURN_VALUE (512) 字节，与 C++ 代码一致
  if (ocgModule && pduel) {
    const respBuffer = new Uint8Array(SIZE_RETURN_VALUE)
    respBuffer.set(resp.slice(0, Math.min(resp.length, SIZE_RETURN_VALUE)))
    
    const respPtr = ocgModule._malloc(SIZE_RETURN_VALUE)
    ocgModule.HEAPU8.set(respBuffer, respPtr)
    ocgModule._set_responseb(pduel, respPtr)
    ocgModule._free(respPtr)
  }

  return true
}

/**
 * 回放主线程 (对应 ReplayThread)
 */
async function replayThread() {
  const rh = replayHeader

  // 初始化决斗信息
  duelInfo.isFirst = true
  duelInfo.isTag = !!(rh.flag & REPLAY_FLAG.TAG)
  duelInfo.isSingleMode = !!(rh.flag & REPLAY_FLAG.SINGLE_MODE)

  // 开始决斗
  if (!await startDuel()) {
    await endDuel()
    return 0
  }

  isStarted.value = true
  isFinished.value = false
  isReplaySkipping.value = skipTurn.value > 0

  isContinuing.value = true
  skipStep.value = 0
  responseIndex.value = 0  // 重置响应索引，确保重新开始时从头播放

  // 非单人模式：初始化卡组显示
  if (!duelInfo.isSingleMode) {
    for (let i = 0; i < 2; i++) {
      if (replayDecks[i]) {
        field.players[i].deck = replayDecks[i].main.length
        field.players[i].extra = replayDecks[i].extra.length
      }
    }
  }

  exitPending.value = false
  currentStep.value = 0

  // 主回放循环
  if (ocgModule && pduel) {
    // 使用实际的 OCGCore
    await runOCGReplayLoop()
  } else {
    // 模拟回放
    await simulateReplay()
  }

  // 结束清理
  if (isReplaySkipping.value) {
    isReplaySkipping.value = false
  }

  await endDuel()

  // 重置状态
  isContinuing.value = true
  isClosing.value = false
  isPausing.value = false
  isPaused.value = false
  isSwapping.value = false
  isRestarting.value = false
  exitPending.value = false
  skipTurn.value = 0
  currentStep.value = 0
  skipStep.value = 0

  return 0
}

/**
 * 使用 OCGCore 运行回放循环
 */
async function runOCGReplayLoop() {
  const engineBuffer = new Uint8Array(SIZE_MESSAGE_BUFFER)

  while (isContinuing.value && !exitPending.value) {
    // 调用 process
    const result = await ocgModule._process(pduel)
    const len = result & PROCESSOR_BUFFER_LEN

    if (len > 0) {
      // 获取消息
      const bufferPtr = ocgModule._malloc(len)
      ocgModule._get_message(pduel, bufferPtr)
      const msgData = new Uint8Array(ocgModule.HEAPU8.buffer, bufferPtr, len)

      // 分析消息
      const shouldContinue = await replayAnalyze(new Uint8Array(msgData), len)
      ocgModule._free(bufferPtr)

      if (!shouldContinue) {
        isContinuing.value = false
        break
      }

      // 处理重启
      if (isRestarting.value) {
        isRestarting.value = false
        isReplaySkipping.value = true
        await restart(false)
        // 继续循环...
      }
    }

    // 检查处理器标志
    if (result & PROCESSOR_END) {
      break
    }

    // 等待用户输入 (如果需要)
    if (result & PROCESSOR_WAITING) {
      // 等待响应
    }

    // 让出控制权
    await new Promise(resolve => setTimeout(resolve, 1))
  }
}

/**
 * 预加载所有录像消息
 * 快速运行 OCGCore 收集所有消息，使用完整的 replayAnalyze 但跳过 UI 更新和暂停
 */
async function preloadAllMessages() {
  if (!ocgModule || !pduel) {
    console.warn('[ReplayMode] OCGCore 未加载，无法预加载')
    return false
  }

  isPreloading.value = true
  preloadProgress.value = 0
  preloadedMessages.value = []
  
  // 重置状态
  responseIndex.value = 0
  
  console.log('[ReplayMode] 开始预加载消息...')
  const startTime = Date.now()
  
  let messageCount = 0
  let continuePreload = true
  
  while (continuePreload) {
    // 调用 process
    const result = await ocgModule._process(pduel)
    const len = result & PROCESSOR_BUFFER_LEN

    if (len > 0) {
      // 获取消息
      const bufferPtr = ocgModule._malloc(len)
      ocgModule._get_message(pduel, bufferPtr)
      const msgData = new Uint8Array(ocgModule.HEAPU8.buffer, bufferPtr, len)
      
      // 复制消息数据并存储
      const msgCopy = new Uint8Array(msgData)
      preloadedMessages.value.push({
        data: msgCopy,
        len: len
      })
      messageCount++
      
      // 使用完整的 replayAnalyze 处理消息（预加载模式会跳过 UI 更新和暂停）
      const shouldContinue = await replayAnalyze(msgCopy, len)
      ocgModule._free(bufferPtr)

      if (!shouldContinue) {
        continuePreload = false
        break
      }
    }

    // 检查处理器标志
    if (result & PROCESSOR_END) {
      break
    }

    // 更新进度
    if (responses.value.length > 0) {
      preloadProgress.value = Math.min(99, Math.floor((responseIndex.value / responses.value.length) * 100))
    }

    // 每处理一定数量消息让出控制权
    if (messageCount % 10 === 0) {
      await new Promise(resolve => setTimeout(resolve, 0))
    }
  }

  const elapsed = Date.now() - startTime
  console.log(`[ReplayMode] 预加载完成: ${messageCount} 条消息, 耗时 ${elapsed}ms`)
  
  // 重置状态以便正式播放
  await resetDuelForPlayback()
  
  // 恢复状态
  responseIndex.value = 0
  preloadProgress.value = 100
  isPreloading.value = false
  usePreloadedData.value = true
  preloadedMessageIndex.value = 0
  
  return true
}

/**
 * 重置决斗状态以便正式播放
 */
async function resetDuelForPlayback() {
  // 销毁当前决斗（预加载已完成，不再需要 OCGCore）
  if (pduel) {
    ocgModule._end_duel(pduel)
    pduel = null
  }
  
  // 清空场面
  clearField()
  
  // 重置响应索引
  responseIndex.value = 0
  messages.value = []
  
  // 重置 combo 记录
  comboTreeEntries.value = []
  fullDuelLog.value = []
  
  // 重置多因果树状态
  comboTrees.value = [
    { id: 0, name: '总因果树', entries: [], isTotal: true }
  ]
  currentTreeIndex.value = 0
  showTreeDropdown.value = false
  editingTreeName.value = false
  // 清空自动因果树追踪映射
  starterToTreeMap.clear()
  cardToTreesMap.clear()
  // 清空因果图
  clearCausalGraph()
}

/**
 * 使用预加载的消息进行播放
 */
async function playFromPreloadedMessages() {
  console.log('[ReplayMode] 使用预加载数据播放...')
  
  const rh = replayHeader
  
  // 初始化决斗信息（与 replayThread 相同）
  duelInfo.isFirst = true
  duelInfo.isTag = !!(rh.flag & REPLAY_FLAG.TAG)
  duelInfo.isSingleMode = !!(rh.flag & REPLAY_FLAG.SINGLE_MODE)
  
  // 设置玩家名称
  if (duelInfo.isTag) {
    duelInfo.players = [
      replayPlayers[0] || 'Player 1',
      replayPlayers[3] || 'Player 2'
    ]
  } else {
    duelInfo.players = [
      replayPlayers[0] || 'Player 1',
      replayPlayers[1] || 'Player 2'
    ]
  }
  
  // 设置决斗规则
  duelInfo.startLp = replayParams.startLP
  duelInfo.lp = [replayParams.startLP, replayParams.startLP]
  duelInfo.turn = 0
  duelInfo.duelRule = (replayParams.duelFlag >> 16) || 5
  
  // 初始化场面
  for (let i = 0; i < 2; i++) {
    if (replayDecks[i]) {
      field.players[i].deck = replayDecks[i].main.length
      field.players[i].extra = replayDecks[i].extra.length
    }
    field.players[i].mzone = Array(7).fill(null)
    field.players[i].szone = Array(8).fill(null)
    field.players[i].hand = []
    field.players[i].grave = []
    field.players[i].removed = []
  }
  field.chains = []
  
  isStarted.value = true
  isFinished.value = false
  isContinuing.value = true
  preloadedMessageIndex.value = 0
  responseIndex.value = 0
  isReplaySkipping.value = skipTurn.value > 0
  exitPending.value = false
  currentStep.value = 0
  skipStep.value = 0
  
  // 清空状态快照并保存初始状态
  stateSnapshots.value = []
  stepBackPending = false
  saveStateSnapshot()
  
  while (preloadedMessageIndex.value < preloadedMessages.value.length && 
         isContinuing.value && !exitPending.value) {
    
    const msgEntry = preloadedMessages.value[preloadedMessageIndex.value]
    preloadedMessageIndex.value++
    
    // 使用原始的 replayAnalyze 处理消息（这次会更新 UI）
    const result = await replayAnalyze(msgEntry.data, msgEntry.len)
    
    // 如果发生了回退操作，不要break，继续从恢复的位置处理
    if (result === 'stepback') {
      // preloadedMessageIndex 已经被恢复为快照中的值，继续循环
      continue
    }
    
    if (!result) {
      break
    }
    
    // 处理重启
    if (isRestarting.value) {
      isRestarting.value = false
      isReplaySkipping.value = true
      // 重启时需要重新预加载
      usePreloadedData.value = false
      await restart(false)
      break
    }
  }
  
  // 结束清理
  if (isReplaySkipping.value) {
    isReplaySkipping.value = false
  }
  
  // 不调用 endDuel()，因为使用预加载模式时 pduel 已经为 null
  isStarted.value = false
  isFinished.value = true
  
  // 重置状态
  isContinuing.value = true
  isClosing.value = false
  isPausing.value = false
  isPaused.value = false
  isSwapping.value = false
  isRestarting.value = false
  exitPending.value = false
  skipTurn.value = 0
  currentStep.value = 0
  skipStep.value = 0
  usePreloadedData.value = false
  
  return 0
}

/**
 * 模拟回放（没有实际 OCGCore 时使用）
 */
async function simulateReplay() {
  // 模拟初始抽卡
  addMessage({ type: MSG.NEW_TURN, desc: 'Turn 1' })
  duelInfo.turn = 1
  duelInfo.currentPlayer = 0
  await handlePauseCheck(true)

  addMessage({ type: MSG.NEW_PHASE, desc: '抽卡阶段' })
  duelInfo.phase = PHASE.DRAW
  await handlePauseCheck(true)

  // 玩家0抽5张
  for (let i = 0; i < 5 && replayDecks[0]?.main[i]; i++) {
    const code = replayDecks[0].main[i]
    await loadCardScript(code)
    const card = createCard(code, 0, LOCATION.HAND, i, POS.FACEUP)
    field.players[0].hand.push(card)
    field.players[0].deck--
    addMessage({ type: MSG.DRAW, desc: `P1 抽卡: ${getCardName(code)}` })
  }
  await handlePauseCheck(true)

  // 玩家1抽5张
  for (let i = 0; i < 5 && replayDecks[1]?.main[i]; i++) {
    const code = replayDecks[1].main[i]
    await loadCardScript(code)
    const card = createCard(code, 1, LOCATION.HAND, i, POS.FACEUP)
    field.players[1].hand.push(card)
    field.players[1].deck--
    addMessage({ type: MSG.DRAW, desc: `P2 抽卡: ${getCardName(code)}` })
  }
  await handlePauseCheck(true)

  addMessage({ type: MSG.NEW_PHASE, desc: '准备阶段' })
  duelInfo.phase = PHASE.STANDBY
  await handlePauseCheck(true)

  addMessage({ type: MSG.NEW_PHASE, desc: '主要阶段1' })
  duelInfo.phase = PHASE.MAIN1
  await handlePauseCheck(true)

  // 处理响应
  while (responseIndex.value < responses.value.length && isContinuing.value && !exitPending.value) {
    currentStep.value++

    // 解析响应消息
    const resp = responses.value[responseIndex.value]
    addMessage({ type: MSG.SELECT_IDLECMD, desc: `响应 ${responseIndex.value + 1}` })

    responseIndex.value++
    await handlePauseCheck(true)

    // 让出控制权
    await new Promise(resolve => setTimeout(resolve, playbackSpeed.value))
  }

  addMessage({ type: MSG.WIN, desc: '回放结束' })
}

/**
 * 处理暂停检查
 * @returns {boolean} 如果发生了回退操作，返回 true，调用者应该提前结束当前消息处理
 */
async function handlePauseCheck(pauseable) {
  // 预加载模式下跳过所有暂停和延迟
  if (isPreloading.value) return false
  
  if (!pauseable || isReplaySkipping.value) return false

  currentStep.value++
  
  // 在每个暂停检查点保存状态快照（用于上一步功能）
  if (usePreloadedData.value) {
    saveStateSnapshot()
  }

  if (skipStep.value > 0) {
    skipStep.value--
    if (skipStep.value === 0) {
      pause(true, false)
      isStarted.value = true
      isFinished.value = false
      isReplaySkipping.value = false
    }
  }

  if (isPausing.value) {
    isPaused.value = true
    actionSignal.reset()
    await actionSignal.wait()
    isPaused.value = false
    
    // 检查是否发生了回退操作
    if (stepBackPending) {
      stepBackPending = false
      return true  // 通知调用者：发生了回退，应该提前结束当前消息处理
    }
  }

  // 延迟以控制播放速度
  if (playbackSpeed.value > 0) {
    await new Promise(resolve => setTimeout(resolve, playbackSpeed.value))
  }
  
  return false
}

/**
 * 开始决斗 (对应 StartDuel)
 */
async function startDuel() {
  const rh = replayHeader

  // 设置玩家名称
  if (duelInfo.isTag) {
    duelInfo.players = [
      replayPlayers[0] || 'Player 1',
      replayPlayers[3] || 'Player 2'
    ]
  } else {
    duelInfo.players = [
      replayPlayers[0] || 'Player 1',
      replayPlayers[1] || 'Player 2'
    ]
  }

  // 设置决斗规则
  duelInfo.startLp = replayParams.startLP
  duelInfo.lp = [replayParams.startLP, replayParams.startLP]
  duelInfo.turn = 0
  duelInfo.duelRule = (replayParams.duelFlag >> 16) || 5

  // 初始化场面
  for (let i = 0; i < 2; i++) {
    if (replayDecks[i]) {
      field.players[i].deck = replayDecks[i].main.length
      field.players[i].extra = replayDecks[i].extra.length
    }
    field.players[i].mzone = Array(7).fill(null)
    field.players[i].szone = Array(8).fill(null)
    field.players[i].hand = []
    field.players[i].grave = []
    field.players[i].removed = []
  }
  field.chains = []

  // 如果有 OCGCore，创建实际的决斗
  if (ocgModule) {
    try {
      // 创建决斗 (完全模仿 ygopro ReplayMode::StartDuel)
      if (rh.id === REPLAY_ID.YRP1) {
        // YRP1: std::mt19937 rnd(rh.seed); pduel = create_duel(rnd());
        // 必须使用 mt19937 生成的随机数，而不是直接用 seed
        const mt = new MersenneTwister(rh.seed)
        const duelSeed = mt.genRandInt32()
        console.log('[OCGCore] YRP1 种子转换:', rh.seed, '->', duelSeed)
        pduel = ocgModule._create_duel(duelSeed)
      } else {
        // YRP2: pduel = create_duel_v2(cur_replay.pheader.seed_sequence);
        const seedPtr = ocgModule._malloc(32)
        const seedSeq = replaySeedSequence || Array(8).fill(rh.seed)
        for (let i = 0; i < 8; i++) {
          ocgModule.setValue(seedPtr + i * 4, seedSeq[i], 'i32')
        }
        pduel = ocgModule._create_duel_v2(seedPtr)
        ocgModule._free(seedPtr)
      }

      // 设置玩家信息
      ocgModule._set_player_info(pduel, 0, replayParams.startLP, replayParams.startHand, replayParams.drawCount)
      ocgModule._set_player_info(pduel, 1, replayParams.startLP, replayParams.startHand, replayParams.drawCount)

      // 加载卡组
      if (!duelInfo.isSingleMode) {
        for (let i = 0; i < 2; i++) {
          const deck = replayDecks[i]
          if (deck) {
            // 主卡组
            for (const code of deck.main) {
              await loadCardScript(code)
              ocgModule._new_card(pduel, code, i, i, LOCATION.DECK, 0, POS.FACEDOWN_DEFENSE)
            }
            // 额外卡组
            for (const code of deck.extra) {
              await loadCardScript(code)
              ocgModule._new_card(pduel, code, i, i, LOCATION.EXTRA, 0, POS.FACEDOWN_DEFENSE)
            }
          }
        }
      }

      // 开始决斗
      ocgModule._start_duel(pduel, replayParams.duelFlag)
      console.log('[OCGCore] 决斗已创建')
    } catch (e) {
      console.error('[OCGCore] 创建决斗失败:', e)
      return true // 继续使用模拟模式
    }
  }

  return true
}

/**
 * 结束决斗 (对应 EndDuel)
 */
async function endDuel() {
  if (ocgModule && pduel) {
    ocgModule._end_duel(pduel)
    pduel = null
  }

  if (!isClosing.value) {
    isStarted.value = false
    isFinished.value = true
  }
}

/**
 * 重新开始 (对应 Restart)
 */
async function restart(refresh) {
  if (ocgModule && pduel) {
    ocgModule._end_duel(pduel)
    pduel = null
  }

  isStarted.value = false
  isFinished.value = true

  // 清空场面
  clearField()

  // 重置响应索引
  responseIndex.value = 0
  messages.value = []

  // 重新开始决斗
  if (!await startDuel()) {
    await endDuel()
    return
  }

  if (refresh) {
    isStarted.value = true
    isFinished.value = false
  }

  if (duelInfo.isReplaySwapped) {
    doSwapField()
  }

  skipTurn.value = 0
}

/**
 * 撤销 (对应 Undo)
 */
function undo() {
  if (skipStep.value > 0 || currentStep.value === 0) return
  isRestarting.value = true
  pause(false, false)
}

/**
 * 清空场面
 */
function clearField() {
  for (let p = 0; p < 2; p++) {
    field.players[p].mzone = Array(7).fill(null)
    field.players[p].szone = Array(8).fill(null)
    field.players[p].hand = []
    field.players[p].grave = []
    field.players[p].removed = []
    field.players[p].deck = 0
    field.players[p].extra = 0
  }
  field.chains = []
}

/**
 * 保存当前状态快照
 */
function saveStateSnapshot() {
  // 预加载模式下不保存快照
  if (isPreloading.value) return
  
  const snapshot = {
    messageIndex: preloadedMessageIndex.value,
    responseIndex: responseIndex.value,
    currentStep: currentStep.value,
    // 决斗信息
    duelInfo: {
      turn: duelInfo.turn,
      phase: duelInfo.phase,
      currentPlayer: duelInfo.currentPlayer,
      lp: [...duelInfo.lp],
      isFirst: duelInfo.isFirst,
      curMsg: duelInfo.curMsg
    },
    // 场面状态（深拷贝）
    field: {
      players: field.players.map(p => ({
        mzone: p.mzone.map(c => c ? { ...c, overlayUnits: c.overlayUnits ? [...c.overlayUnits] : [] } : null),
        szone: p.szone.map(c => c ? { ...c } : null),
        hand: p.hand.map(c => ({ ...c })),
        grave: p.grave.map(c => ({ ...c })),
        removed: p.removed.map(c => ({ ...c })),
        deck: p.deck,
        extra: p.extra,
        extraFaceup: p.extraFaceup
      })),
      chains: field.chains.map(c => ({ ...c }))
    },
    // 消息日志长度（用于裁剪）
    messagesLength: messages.value.length,
    // Combo 条目长度
    comboEntriesLength: comboTreeEntries.value.length
  }
  
  stateSnapshots.value.push(snapshot)
  
  // 限制快照数量
  if (stateSnapshots.value.length > maxSnapshots) {
    stateSnapshots.value.shift()
  }
}

/**
 * 恢复到指定快照
 */
function restoreStateSnapshot(snapshot) {
  // 恢复消息索引
  preloadedMessageIndex.value = snapshot.messageIndex
  responseIndex.value = snapshot.responseIndex
  currentStep.value = snapshot.currentStep
  
  // 恢复决斗信息
  duelInfo.turn = snapshot.duelInfo.turn
  duelInfo.phase = snapshot.duelInfo.phase
  duelInfo.currentPlayer = snapshot.duelInfo.currentPlayer
  duelInfo.lp = [...snapshot.duelInfo.lp]
  duelInfo.isFirst = snapshot.duelInfo.isFirst
  duelInfo.curMsg = snapshot.duelInfo.curMsg
  
  // 恢复场面状态
  for (let p = 0; p < 2; p++) {
    field.players[p].mzone = snapshot.field.players[p].mzone.map(c => 
      c ? { ...c, overlayUnits: c.overlayUnits ? [...c.overlayUnits] : [] } : null
    )
    field.players[p].szone = snapshot.field.players[p].szone.map(c => c ? { ...c } : null)
    field.players[p].hand = snapshot.field.players[p].hand.map(c => ({ ...c }))
    field.players[p].grave = snapshot.field.players[p].grave.map(c => ({ ...c }))
    field.players[p].removed = snapshot.field.players[p].removed.map(c => ({ ...c }))
    field.players[p].deck = snapshot.field.players[p].deck
    field.players[p].extra = snapshot.field.players[p].extra
    field.players[p].extraFaceup = snapshot.field.players[p].extraFaceup
  }
  field.chains = snapshot.field.chains.map(c => ({ ...c }))
  
  // 裁剪消息日志
  messages.value = messages.value.slice(0, snapshot.messagesLength)
  
  // 裁剪 Combo 条目
  comboTreeEntries.value = comboTreeEntries.value.slice(0, snapshot.comboEntriesLength)
  
  // 同步裁剪子因果树（根据step值比对）
  const maxStep = comboTreeEntries.value.length > 0 
    ? Math.max(...comboTreeEntries.value.map(e => e.step)) 
    : -1
  comboTrees.value.forEach(tree => {
    if (!tree.isTotal) {
      tree.entries = tree.entries.filter(e => e.step <= maxStep)
    }
  })
  
  // 重建追踪映射
  rebuildCausalTreeMaps()
}

/**
 * 重建因果树追踪映射（用于状态恢复后）
 */
function rebuildCausalTreeMaps() {
  starterToTreeMap.clear()
  cardToTreesMap.clear()
  
  // 遍历所有子因果树，重建映射
  comboTrees.value.forEach((tree, treeIndex) => {
    if (tree.isTotal) return
    
    // 记录初动点
    if (tree.starterCode) {
      starterToTreeMap.set(tree.starterCode, {
        treeIndex,
        cardName: tree.name.replace(' 展开', '')
      })
    }
    
    // 记录所有条目的卡片到因果树的映射
    tree.entries.forEach(entry => {
      if (!cardToTreesMap.has(entry.cardCode)) {
        cardToTreesMap.set(entry.cardCode, new Set())
      }
      cardToTreesMap.get(entry.cardCode).add(treeIndex)
    })
  })
}

/**
 * 上一步功能
 */
function handlePrevStep() {
  if (!usePreloadedData.value || stateSnapshots.value.length < 2) {
    console.log('[ReplayMode] 无法回退：没有预加载数据或快照不足')
    return
  }
  
  // 移除当前快照，恢复到上一个快照
  stateSnapshots.value.pop()
  const prevSnapshot = stateSnapshots.value[stateSnapshots.value.length - 1]
  
  if (prevSnapshot) {
    // 设置回退标志，让当前的消息处理提前结束
    stepBackPending = true
    restoreStateSnapshot(prevSnapshot)
    console.log('[ReplayMode] 已回退到步骤', prevSnapshot.currentStep)
  }
}

// ========== 书签系统 ==========

/**
 * 添加书签 - 自动记录回合/阶段/场面
 */
function addBookmark(customNote = '') {
  if (!isStarted.value) {
    console.log('[Bookmark] 录像未开始，无法添加书签')
    return
  }
  
  // 生成场面摘要
  const fieldSummary = generateFieldSummary()
  
  // 创建书签快照（完整保存当前状态）
  const bookmarkSnapshot = {
    messageIndex: preloadedMessageIndex.value,
    responseIndex: responseIndex.value,
    currentStep: currentStep.value,
    duelInfo: {
      turn: duelInfo.turn,
      phase: duelInfo.phase,
      currentPlayer: duelInfo.currentPlayer,
      lp: [...duelInfo.lp],
      isFirst: duelInfo.isFirst,
      curMsg: duelInfo.curMsg
    },
    field: {
      players: field.players.map(p => ({
        mzone: p.mzone.map(c => c ? { ...c, overlayUnits: c.overlayUnits ? [...c.overlayUnits] : [] } : null),
        szone: p.szone.map(c => c ? { ...c } : null),
        hand: p.hand.map(c => ({ ...c })),
        grave: p.grave.map(c => ({ ...c })),
        removed: p.removed.map(c => ({ ...c })),
        deck: p.deck,
        extra: p.extra,
        extraFaceup: p.extraFaceup
      })),
      chains: field.chains.map(c => ({ ...c }))
    },
    messagesLength: messages.value.length,
    comboEntriesLength: comboTreeEntries.value.length
  }
  
  const bookmark = {
    id: ++bookmarkIdCounter,
    createdAt: Date.now(),
    turn: duelInfo.turn,
    phase: duelInfo.phase,
    phaseName: getPhaseName(duelInfo.phase),
    step: currentStep.value,
    lp: [...duelInfo.lp],
    note: customNote,
    fieldSummary: fieldSummary,
    snapshot: bookmarkSnapshot
  }
  
  bookmarks.value.push(bookmark)
  console.log('[Bookmark] 已添加书签:', bookmark)
  
  return bookmark
}

/**
 * 生成场面摘要
 */
function generateFieldSummary() {
  const summary = {
    monsters: [[], []],
    spellTraps: [[], []]
  }
  
  for (let p = 0; p < 2; p++) {
    // 怪兽区
    for (let i = 0; i < 7; i++) {
      const card = field.players[p].mzone[i]
      if (card && card.code) {
        summary.monsters[p].push({
          code: card.code,
          name: getCardName(card.code),
          attack: card.attack,
          position: card.position
        })
      }
    }
    // 魔陷区
    for (let i = 0; i < 6; i++) {
      const card = field.players[p].szone[i]
      if (card && card.code) {
        summary.spellTraps[p].push({
          code: card.code,
          name: getCardName(card.code)
        })
      }
    }
  }
  
  return summary
}

/**
 * 跳转到书签位置
 */
function jumpToBookmark(bookmark) {
  if (!bookmark || !bookmark.snapshot) {
    console.log('[Bookmark] 书签无效或缺少快照数据')
    return
  }
  
  if (!usePreloadedData.value) {
    console.log('[Bookmark] 未使用预加载模式，无法跳转')
    return
  }
  
  // 暂停播放
  if (!isPaused.value) {
    handlePause()
  }
  
  // 恢复到书签快照
  restoreStateSnapshot(bookmark.snapshot)
  
  // 同步状态快照列表 - 移除书签步骤之后的快照
  const targetStep = bookmark.step
  while (stateSnapshots.value.length > 0 && 
         stateSnapshots.value[stateSnapshots.value.length - 1].currentStep > targetStep) {
    stateSnapshots.value.pop()
  }
  
  console.log('[Bookmark] 已跳转到书签:', bookmark.turn, '回合', bookmark.phaseName)
}

/**
 * 删除书签
 */
function deleteBookmark(bookmarkId) {
  const index = bookmarks.value.findIndex(b => b.id === bookmarkId)
  if (index !== -1) {
    bookmarks.value.splice(index, 1)
    console.log('[Bookmark] 已删除书签:', bookmarkId)
  }
}

/**
 * 开始编辑书签备注
 */
function startEditBookmarkNote(bookmark) {
  editingBookmarkId.value = bookmark.id
  editingBookmarkNote.value = bookmark.note || ''
}

/**
 * 保存书签备注
 */
function saveBookmarkNote() {
  if (editingBookmarkId.value !== null) {
    const bookmark = bookmarks.value.find(b => b.id === editingBookmarkId.value)
    if (bookmark) {
      bookmark.note = editingBookmarkNote.value
      console.log('[Bookmark] 已更新书签备注:', bookmark.id, bookmark.note)
    }
  }
  editingBookmarkId.value = null
  editingBookmarkNote.value = ''
}

/**
 * 取消编辑书签备注
 */
function cancelEditBookmarkNote() {
  editingBookmarkId.value = null
  editingBookmarkNote.value = ''
}

/**
 * 切换书签面板显示
 */
function toggleBookmarksPanel() {
  bookmarksPanelVisible.value = !bookmarksPanelVisible.value
}

/**
 * 快速添加书签（带默认备注建议）
 */
function quickAddBookmark() {
  // 自动生成备注建议
  let suggestedNote = ''
  
  // 基于当前阶段推测备注
  if (duelInfo.phase === PHASE.MAIN1 || duelInfo.phase === PHASE.MAIN2) {
    const myMonsters = field.players[0].mzone.filter(c => c && c.code).length
    const oppMonsters = field.players[1].mzone.filter(c => c && c.code).length
    if (myMonsters >= 2 || oppMonsters >= 2) {
      suggestedNote = '场面展开中'
    }
  } else if (duelInfo.phase === PHASE.BATTLE || duelInfo.phase === PHASE.BATTLE_STEP) {
    suggestedNote = '战斗阶段'
  } else if (duelInfo.phase === PHASE.END) {
    suggestedNote = '回合结束'
  }
  
  // 如果连锁中，标记为关键点
  if (field.chains.length > 0) {
    suggestedNote = `连锁${field.chains.length} - 关键点`
  }
  
  addBookmark(suggestedNote)
}

/**
 * 清空所有书签
 */
function clearAllBookmarks() {
  if (bookmarks.value.length > 0 && confirm('确定清空所有书签吗？')) {
    bookmarks.value = []
    console.log('[Bookmark] 已清空所有书签')
  }
}

/**
 * 切换自动书签功能
 */
function toggleAutoBookmark() {
  autoBookmarkEnabled.value = !autoBookmarkEnabled.value
  console.log('[Bookmark] 自动书签:', autoBookmarkEnabled.value ? '启用' : '禁用')
}

/**
 * 自动检测并添加关键节点书签
 * @param {string} eventType - 事件类型
 * @param {object} eventData - 事件数据
 */
function checkAutoBookmark(eventType, eventData = {}) {
  if (!autoBookmarkEnabled.value || !isStarted.value) return
  if (isPreloading.value) return  // 预加载阶段不添加书签
  
  // 避免同一步骤重复添加
  if (currentStep.value === lastAutoBookmarkStep) return
  
  let shouldBookmark = false
  let bookmarkNote = ''
  let priority = 0  // 优先级，用于确定是否覆盖
  
  switch (eventType) {
    case 'HAND_TRAP': {
      // 手坑发动
      if (autoBookmarkSettings.handTrap && eventData.cardCode) {
        if (HAND_TRAP_CODES.has(eventData.cardCode)) {
          shouldBookmark = true
          bookmarkNote = `🛡️ 手坑: ${eventData.cardName || getCardName(eventData.cardCode)}`
          priority = 10
        }
      }
      break
    }
    
    case 'MULTI_CHAIN': {
      // 多重连锁 (>=3)
      if (autoBookmarkSettings.multiChain && eventData.chainCount >= 3) {
        shouldBookmark = true
        bookmarkNote = `⛓️ ${eventData.chainCount}重连锁`
        priority = 8
      }
      break
    }
    
    case 'CHAIN_NEGATED': {
      // 效果/发动被无效
      if (autoBookmarkSettings.chainNegated) {
        shouldBookmark = true
        bookmarkNote = `❌ ${eventData.isActivationNegated ? '发动' : '效果'}被无效`
        priority = 9
      }
      break
    }
    
    case 'DAMAGE_STEP': {
      // 伤害步骤
      if (autoBookmarkSettings.damageStep) {
        shouldBookmark = true
        bookmarkNote = `⚔️ 伤害步骤`
        priority = 5
      }
      break
    }
    
    case 'MAJOR_LP_CHANGE': {
      // 重大LP变化
      if (autoBookmarkSettings.majorLpChange && eventData.player !== undefined) {
        const lpLost = eventData.lpLost || 0
        const lpRatio = lpLost / duelInfo.startLp
        // 单次伤害>=50%初始LP 或 LP归零
        if (lpRatio >= 0.5 || eventData.newLp <= 0) {
          // 同一回合同一玩家只记录一次重大LP变化
          if (lastLpBookmarkTurn[eventData.player] !== duelInfo.turn) {
            shouldBookmark = true
            bookmarkNote = eventData.newLp <= 0 
              ? `💀 玩家${eventData.player + 1} LP归零!` 
              : `💔 重大伤害: -${lpLost} LP`
            priority = 15
            lastLpBookmarkTurn[eventData.player] = duelInfo.turn
          }
        }
      }
      break
    }
    
    case 'KEY_MONSTER': {
      // 关键怪兽召唤
      if (autoBookmarkSettings.keyMonster && eventData.cardCode) {
        if (KEY_MONSTER_CODES.has(eventData.cardCode)) {
          shouldBookmark = true
          bookmarkNote = `⭐ 关键怪兽: ${eventData.cardName || getCardName(eventData.cardCode)}`
          priority = 7
        }
      }
      break
    }
    
    case 'TURN_END': {
      // 回合结束场面
      if (autoBookmarkSettings.turnEnd) {
        const myMonsters = field.players[0].mzone.filter(c => c && c.code).length
        const oppMonsters = field.players[1].mzone.filter(c => c && c.code).length
        const myBackrow = field.players[0].szone.filter(c => c && c.code).length
        const oppBackrow = field.players[1].szone.filter(c => c && c.code).length
        // 只有场面较复杂时才记录
        if (myMonsters + oppMonsters >= 3 || myBackrow + oppBackrow >= 2) {
          shouldBookmark = true
          bookmarkNote = `🏁 T${duelInfo.turn}结束 (怪${myMonsters}v${oppMonsters})`
          priority = 3
        }
      }
      break
    }
    
    case 'BATTLE_PHASE': {
      // 战斗阶段开始
      if (autoBookmarkSettings.battlePhase) {
        shouldBookmark = true
        bookmarkNote = `⚔️ 战斗阶段开始`
        priority = 2
      }
      break
    }
  }
  
  if (shouldBookmark) {
    lastAutoBookmarkStep = currentStep.value
    const bookmark = addBookmark(bookmarkNote)
    if (bookmark) {
      bookmark.isAuto = true  // 标记为自动生成
      bookmark.priority = priority
      console.log('[AutoBookmark] 自动添加书签:', bookmarkNote)
    }
  }
}

/**
 * 检查卡片是否为手坑
 */
function isHandTrap(cardCode) {
  return HAND_TRAP_CODES.has(cardCode)
}

/**
 * 检查卡片是否为关键怪兽
 */
function isKeyMonster(cardCode) {
  return KEY_MONSTER_CODES.has(cardCode)
}

/**
 * 一键生成全局关键节点书签（回放结束后可用）
 */
function generateAutoBookmarks() {
  // 清除现有自动书签
  bookmarks.value = bookmarks.value.filter(b => !b.isAuto)
  
  // 重置追踪器
  lastAutoBookmarkStep = -1
  lastLpBookmarkTurn = [-1, -1]
  
  console.log('[AutoBookmark] 手动触发自动书签生成（需要在回放过程中自动检测）')
}

/**
 * 添加消息到日志（增强版 - 保存完整对局信息）
 */
function addMessage(msg) {
  // 预加载模式下跳过添加消息到日志
  if (isPreloading.value) return
  
  messages.value.push({
    type: msg.type,
    typeName: getMessageName(msg.type),
    desc: msg.desc || '',
    step: currentStep.value,
    timestamp: Date.now(),
    // 增强信息：保存当前对局状态用于完整导出
    turn: duelInfo.turn,
    phase: duelInfo.phase,
    phaseName: getPhaseName(duelInfo.phase),
    currentPlayer: duelInfo.currentPlayer,
    lp: [...duelInfo.lp],
    // 额外详细信息
    cardCode: msg.cardCode,
    cardName: msg.cardCode ? getCardName(msg.cardCode) : undefined,
    player: msg.player,
    location: msg.location,
    sequence: msg.sequence,
    position: msg.position,
    value: msg.value,
    extra: msg.extra
  })

  // 限制消息数量
  if (messages.value.length > maxMessages) {
    messages.value.shift()
  }

  // 滚动到底部
  nextTick(() => {
    if (logContent.value) {
      logContent.value.scrollTop = logContent.value.scrollHeight
    }
  })
}

// ========== 文字解说模式 ==========

/**
 * 自动生成对局解说文本
 */
function generateCommentary(action) {
  // 首先尝试使用角色语录
  const characterQuote = getCharacterQuote(action.type, action.data)
  if (characterQuote) {
    const iconMap = {
      SPSUMMON: '⭐',
      SUMMON: '📤',
      CHAIN: '⛓️',
      ATTACK: '⚔️',
      DAMAGE: '💔',
      RECOVER: '💚',
      NEW_TURN: '🔄',
      NEW_PHASE: '📍',
      DRAW: '🃏',
      SET: '📥',
      WIN: '🏆',
      BATTLE: '💥'
    }
    
    // 不动游星专用图标
    const yuseiIcons = {
      SPSUMMON: '🌟',
      SUMMON: '🏍️',
      CHAIN: '⚡',
      ATTACK: '💫',
      DAMAGE: '😤',
      RECOVER: '✨',
      NEW_TURN: '🃏',
      NEW_PHASE: '🛤️',
      DRAW: '🌠',
      SET: '🔧',
      WIN: '🏆',
      BATTLE: '💥'
    }
    
    // m专用图标
    const mIcons = {
      SPSUMMON: '🎯',
      SUMMON: '👆',
      CHAIN: '💬',
      ATTACK: '👊',
      DAMAGE: '😱',
      RECOVER: '💊',
      NEW_TURN: '🎲',
      NEW_PHASE: '▶️',
      DRAW: '🎰',
      SET: '🎴',
      WIN: '🎉',
      BATTLE: '💢'
    }
    
    let icon
    if (commentatorCharacter.value === 'yusei') {
      icon = yuseiIcons[action.type] || iconMap[action.type] || '📝'
    } else if (commentatorCharacter.value === 'm') {
      icon = mIcons[action.type] || iconMap[action.type] || '📝'
    } else {
      icon = iconMap[action.type] || '📝'
    }
    
    return {
      type: action.type,
      text: characterQuote,
      icon: icon,
      turn: duelInfo.turn,
      timestamp: Date.now(),
      character: commentatorCharacter.value
    }
  }
  
  // 默认解说模板
  const templates = {
    SPSUMMON: (data) => {
      const summonType = data.summonType || '特殊召唤'
      const zone = data.zone || '场上'
      let text = `${data.player}${summonType}了「${data.cardName}」到${zone}`
      if (data.materialSummary) {
        text += `【素材: ${data.materialSummary}】`
      }
      return { text, icon: '⭐' }
    },
    CHAIN: (data) => {
      const chainPrefix = data.chainNum > 1 ? `连锁${data.chainNum}! ` : ''
      let text = `${chainPrefix}${data.player}发动了「${data.cardName}」的效果`
      if (data.location) {
        text += `(${data.location})`
      }
      return { text, icon: '⛓️' }
    },
    ATTACK: (data) => {
      let text
      if (data.target === '直接') {
        text = `「${data.attacker}」向${data.defenderPlayer}发起直接攻击!`
      } else {
        text = `「${data.attacker}」向「${data.target}」发起攻击!`
      }
      return { text, icon: '⚔️' }
    },
    DAMAGE: (data) => {
      return { 
        text: `${data.player}受到了${data.value}点伤害! (LP: ${data.remainingLP})`, 
        icon: '💔' 
      }
    },
    RECOVER: (data) => {
      return { 
        text: `${data.player}回复了${data.value}点生命值! (LP: ${data.remainingLP})`, 
        icon: '💚' 
      }
    },
    NEW_TURN: (data) => {
      return { 
        text: `===== 回合${data.turn}: ${data.player}的回合 =====`, 
        icon: '🔄' 
      }
    },
    NEW_PHASE: (data) => {
      return { 
        text: `进入${data.phaseName}`, 
        icon: '📍' 
      }
    },
    DRAW: (data) => {
      const cardList = data.cards?.length > 0 ? data.cards.join('、') : `${data.count}张卡`
      return { 
        text: `${data.player}抽了${cardList}`, 
        icon: '🃏' 
      }
    },
    SUMMON: (data) => {
      return { 
        text: `${data.player}通常召唤了「${data.cardName}」`, 
        icon: '📤' 
      }
    },
    SET: (data) => {
      return { 
        text: `${data.player}放置了一张卡`, 
        icon: '📥' 
      }
    },
    WIN: (data) => {
      return { 
        text: `🏆 对局结束! ${data.winner}获得胜利! (${data.reason})`, 
        icon: '🏆' 
      }
    },
    BATTLE: (data) => {
      let text = `战斗判定: 「${data.attacker}」(ATK:${data.attackerAtk})`
      if (data.defender) {
        const defStat = data.isDefense ? `DEF:${data.defenderDef}` : `ATK:${data.defenderAtk}`
        text += ` vs 「${data.defender}」(${defStat})`
      }
      return { text, icon: '💥' }
    }
  }
  
  const template = templates[action.type]
  if (!template) return null
  
  const result = template(action.data)
  return {
    type: action.type,
    text: result.text,
    icon: result.icon,
    turn: duelInfo.turn,
    timestamp: Date.now(),
    character: 'default'
  }
}

/**
 * 添加解说条目
 */
function addCommentaryEntry(action) {
  if (!commentaryModeEnabled.value) return
  if (isPreloading.value) return
  
  const entry = generateCommentary(action)
  if (!entry) return
  
  commentaryEntries.value.push(entry)
  
  // 限制条目数量
  if (commentaryEntries.value.length > maxCommentaryEntries) {
    commentaryEntries.value.shift()
  }
  
  // 滚动到底部
  nextTick(() => {
    if (commentaryContent.value) {
      commentaryContent.value.scrollTop = commentaryContent.value.scrollHeight
    }
  })
}

/**
 * 秘密触发器点击处理 - 按顺序点击"决斗开始"激活解说模式
 */
function onSecretTrigger(index) {
  // 清除重置计时器
  if (secretResetTimer) {
    clearTimeout(secretResetTimer)
    secretResetTimer = null
  }
  
  // 检查是否按顺序点击
  if (index === secretSequence.value.length) {
    // 正确顺序，添加到序列
    secretSequence.value.push(index)
    
    // 检查是否完成序列
    if (secretSequence.value.length === 4) {
      // 激活解说模式
      commentaryModeEnabled.value = true
      secretSequence.value = []
    } else {
      // 设置3秒后重置序列
      secretResetTimer = setTimeout(() => {
        secretSequence.value = []
      }, 3000)
    }
  } else {
    // 错误顺序，重置
    secretSequence.value = []
  }
}

/**
 * 关闭解说模式
 */
function closeCommentaryMode() {
  commentaryModeEnabled.value = false
  showCommentatorSelector.value = false
}

/**
 * 清空解说
 */
function clearCommentary() {
  commentaryEntries.value = []
}

/**
 * 获取当前解说员配置
 */
const currentCommentator = computed(() => {
  return commentatorCharacters[commentatorCharacter.value] || commentatorCharacters.default
})

/**
 * 切换解说员选择器显示
 */
function toggleCommentatorSelector() {
  showCommentatorSelector.value = !showCommentatorSelector.value
}

/**
 * 选择解说员
 */
function selectCommentator(characterId) {
  commentatorCharacter.value = characterId
  showCommentatorSelector.value = false
}

/**
 * 点击外部关闭解说员选择器
 */
function handleCommentatorClickOutside(event) {
  if (showCommentatorSelector.value) {
    const selector = document.querySelector('.commentator-info')
    if (selector && !selector.contains(event.target)) {
      showCommentatorSelector.value = false
    }
  }
}

/**
 * 获取角色语录
 * @param {string} type - 事件类型 (SPSUMMON, CHAIN, etc.)
 * @param {object} data - 事件数据
 * @returns {string} 选中的语录文本
 */
function getCharacterQuote(type, data) {
  const character = currentCommentator.value
  if (!character.quotes || !character.quotes[type]) return null
  
  const quoteConfig = character.quotes[type]
  
  // 如果是数组，直接随机选择
  if (Array.isArray(quoteConfig) && typeof quoteConfig[0] === 'string') {
    const template = quoteConfig[Math.floor(Math.random() * quoteConfig.length)]
    return replaceQuotePlaceholders(template, data)
  }
  
  // 如果是条件数组 (用于SPSUMMON等有多种条件的情况)
  if (Array.isArray(quoteConfig)) {
    let selectedTexts = null
    
    for (const config of quoteConfig) {
      if (config.condition === 'default') {
        // 默认条件作为后备
        if (!selectedTexts) selectedTexts = config.texts
        continue
      }
      
      // 检查条件
      if (matchQuoteCondition(config.condition, data)) {
        selectedTexts = config.texts
        break  // 找到匹配条件就停止
      }
    }
    
    if (selectedTexts && selectedTexts.length > 0) {
      const template = selectedTexts[Math.floor(Math.random() * selectedTexts.length)]
      return replaceQuotePlaceholders(template, data)
    }
  }
  
  return null
}

/**
 * 检查语录条件是否匹配
 */
function matchQuoteCondition(condition, data) {
  if (condition === 'synchro') {
    // 同调召唤
    return data.summonType?.includes('同调') || data.isSynchro
  }
  if (condition === 'xyz') {
    // 超量召唤
    return data.summonType?.includes('超量') || data.summonType?.includes('XYZ') || data.isXyz
  }
  if (condition === 'link') {
    // 链接召唤
    return data.summonType?.includes('链接') || data.summonType?.includes('Link') || data.isLink
  }
  if (condition === 'fusion') {
    // 融合召唤
    return data.summonType?.includes('融合') || data.isFusion
  }
  if (condition === 'pendulum') {
    // 灵摆召唤
    return data.summonType?.includes('灵摆') || data.isPendulum
  }
  if (condition.startsWith('cardName:')) {
    // 特定卡名
    const cardName = condition.split(':')[1]
    return data.cardName?.includes(cardName)
  }
  return false
}

/**
 * 替换语录模板中的占位符
 */
function replaceQuotePlaceholders(template, data) {
  return template
    .replace(/{cardName}/g, data.cardName || '')
    .replace(/{attacker}/g, data.attacker || '')
    .replace(/{target}/g, data.target || '')
    .replace(/{defender}/g, data.defender || '')
    .replace(/{value}/g, data.value || '')
    .replace(/{remainingLP}/g, data.remainingLP || '')
    .replace(/{turn}/g, data.turn || '')
    .replace(/{phaseName}/g, data.phaseName || '')
    .replace(/{cards}/g, data.cards?.join('、') || `${data.count || 1}张卡`)
    .replace(/{attackerAtk}/g, data.attackerAtk || '')
    .replace(/{defStat}/g, data.isDefense ? `DEF:${data.defenderDef}` : `ATK:${data.defenderAtk}`)
    .replace(/{player}/g, data.player || '')
}

/**
 * 复制解说到剪贴板
 */
async function copyCommentary() {
  const text = commentaryEntries.value
    .map(e => `[T${e.turn}] ${e.icon} ${e.text}`)
    .join('\n')
  
  try {
    await navigator.clipboard.writeText(text)
    alert('解说内容已复制到剪贴板!')
  } catch (err) {
    console.error('复制失败:', err)
    // 降级方案
    const textarea = document.createElement('textarea')
    textarea.value = text
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    document.body.removeChild(textarea)
    alert('解说内容已复制到剪贴板!')
  }
}

// ========== 消息分析 (对应 ygopro ReplayAnalyze) ==========

/**
 * 分析回放消息 (完全模仿 ygopro ReplayMode::ReplayAnalyze)
 */
async function replayAnalyze(msg, len) {
  let offset = 0
  isRestarting.value = false

  while (offset < len) {
    if (isClosing.value) return false
    if (isRestarting.value) return true

    // 处理视角切换
    if (isSwapping.value) {
      doSwapField()
      isSwapping.value = false
    }

    let pauseable = true
    const msgType = msg[offset++]
    duelInfo.curMsg = msgType

    switch (msgType) {
      case MSG.RETRY: {
        // 使用预加载数据播放时，不应该遇到 RETRY（预加载时已处理过）
        if (usePreloadedData.value) {
          console.warn('[ReplayMode] 预加载播放模式下遇到 RETRY，跳过')
          return true
        }
        
        // RETRY 意味着之前的响应无效 - 通常是游戏状态分歧导致
        const lastResp = responseHistory.length > 0 ? responseHistory[responseHistory.length - 1] : null
        console.error('[ReplayMode] RETRY! 上一个响应:', lastResp)
        console.error('[ReplayMode] 可能原因: 脚本/数据库版本与录制时不同，导致游戏状态分歧')
        addMessage({ type: msgType, desc: `错误: 响应无效 (${lastResp?.msgName || 'unknown'} value=${lastResp?.value})` })
        
        // 对于 SELECT_CHAIN，尝试使用安全的默认响应继续
        if (lastResp && lastResp.msgType === MSG.SELECT_CHAIN) {
          // 如果响应值 > 0，尝试用 0（选择第一个效果）
          // 如果响应值 = 0，尝试用 -1（不连锁）
          const safeValue = lastResp.value > 0 ? 0 : -1
          console.log('[ReplayMode] 尝试安全响应:', safeValue)
          
          if (ocgModule && pduel) {
            const respBuffer = new Uint8Array(SIZE_RETURN_VALUE)
            const view = new DataView(respBuffer.buffer)
            view.setInt32(0, safeValue, true)
            
            const respPtr = ocgModule._malloc(SIZE_RETURN_VALUE)
            ocgModule.HEAPU8.set(respBuffer, respPtr)
            ocgModule._set_responseb(pduel, respPtr)
            ocgModule._free(respPtr)
          }
          return true // 继续回放
        }
        
        return false // 其他消息类型无法恢复
      }

      case MSG.HINT: {
        const type = msg[offset++]
        const player = msg[offset++]
        const data = readInt32(msg, offset)
        offset += 4
        addMessage({ type: msgType, desc: `提示: 类型=${type} 玩家=${player}` })
        break
      }

      case MSG.WIN: {
        const player = msg[offset++]
        const type = msg[offset++]
        let winner, reason
        if (player === 2) {
          winner = '平局'
          reason = '双方同时满足终局条件'
        } else {
          winner = duelInfo.players[localPlayer(player)]
          const reasons = {
            0: 'LP归零',
            1: '卡组抽尽',
            2: '特殊胜利条件',
            3: '投降',
            4: '违规'
          }
          reason = reasons[type] || '决斗结束'
        }
        addMessage({ 
          type: msgType, 
          desc: `════════ 决斗结束 ════════\n胜利者: ${winner}\n原因: ${reason}\n最终LP: ${duelInfo.players[0]}=${duelInfo.lp[0]} / ${duelInfo.players[1]}=${duelInfo.lp[1]}`,
          player: player,
          value: type,
          extra: { winner, reason, finalLp: [...duelInfo.lp] }
        })
        
        // 添加解说
        addCommentaryEntry({
          type: 'WIN',
          data: {
            winner: winner,
            reason: reason
          }
        })
        
        return false
      }

      case MSG.SELECT_BATTLECMD: {
        const player = msg[offset++]
        let count = msg[offset++]
        offset += count * 11
        count = msg[offset++]
        offset += count * 8 + 2
        addMessage({ type: msgType, desc: `战斗指令选择` })
        lastResponseMsgType = msgType
        return readReplayResponse()
      }

      case MSG.SELECT_IDLECMD: {
        const player = msg[offset++]
        let count = msg[offset++]
        offset += count * 7
        count = msg[offset++]
        offset += count * 7
        count = msg[offset++]
        offset += count * 7
        count = msg[offset++]
        offset += count * 7
        count = msg[offset++]
        offset += count * 7
        count = msg[offset++]
        offset += count * 11 + 3
        addMessage({ type: msgType, desc: `空闲指令选择` })
        lastResponseMsgType = msgType
        return readReplayResponse()
      }

      case MSG.SELECT_EFFECTYN:
      case MSG.SELECT_YESNO: {
        offset += msgType === MSG.SELECT_EFFECTYN ? 13 : 5
        addMessage({ type: msgType, desc: `是否选择` })
        lastResponseMsgType = msgType
        return readReplayResponse()
      }

      case MSG.SELECT_OPTION: {
        const player = msg[offset++]
        const count = msg[offset++]
        offset += count * 4
        addMessage({ type: msgType, desc: `选项选择` })
        lastResponseMsgType = msgType
        return readReplayResponse()
      }

      case MSG.SELECT_CARD:
      case MSG.SELECT_TRIBUTE: {
        const player = msg[offset++]
        offset += 3
        const count = msg[offset++]
        offset += count * 8
        addMessage({ type: msgType, desc: `卡片选择` })
        lastResponseMsgType = msgType
        return readReplayResponse()
      }

      case MSG.SELECT_UNSELECT_CARD: {
        const player = msg[offset++]
        offset += 4
        let count = msg[offset++]
        offset += count * 8
        count = msg[offset++]
        offset += count * 8
        addMessage({ type: msgType, desc: `卡片选择/取消` })
        lastResponseMsgType = msgType
        return readReplayResponse()
      }

      case MSG.SELECT_CHAIN: {
        const player = msg[offset++]
        const count = msg[offset++]
        const speCount = msg[offset++]
        const hintTiming0 = readInt32(msg, offset)
        offset += 4
        const hintTiming1 = readInt32(msg, offset)
        offset += 4
        
        // 解析每个可选连锁的卡片信息
        const chainOptions = []
        const chainDataStart = offset
        for (let i = 0; i < count; i++) {
          const flag = msg[offset++]        // 1 byte - desc type
          const forced = msg[offset++]       // 1 byte - forced flag
          const code = readUint32(msg, offset)  // 4 bytes - card code
          offset += 4
          const infoLoc = readUint32(msg, offset)  // 4 bytes - controller|location|sequence|position
          offset += 4
          const desc = readUint32(msg, offset)  // 4 bytes - effect description
          offset += 4
          
          const controller = infoLoc & 0xff
          const location = (infoLoc >> 8) & 0xff
          const sequence = (infoLoc >> 16) & 0xff
          
          chainOptions.push({
            index: i,
            code,
            name: getCardName(code),
            controller,
            location: getLocationName(location),
            sequence,
            forced: forced === 1
          })
        }
        
        // 预检查下一个响应是否会超出范围
        const nextRespIdx = responseIndex.value
        if (nextRespIdx < responses.value.length) {
          const nextResp = responses.value[nextRespIdx]
          if (nextResp.length >= 4) {
            let nextValue = nextResp[0] | (nextResp[1] << 8) | (nextResp[2] << 16) | (nextResp[3] << 24)
            if (nextValue > 0x7FFFFFFF) nextValue -= 0x100000000
            // 如果响应值 >= count 且不是 -1，会触发 RETRY
            if (nextValue >= 0 && nextValue >= count) {
              console.warn('[ReplayMode] SELECT_CHAIN 预警: 响应值', nextValue, '>= count', count)
              console.warn('[ReplayMode] 当前可选连锁:', chainOptions)
              console.warn('[ReplayMode] 原始响应要选择索引', nextValue, '但只有', count, '个选项')
              console.warn('[ReplayMode] 可能缺少的卡片效果 - 请检查是否有脚本加载失败')
            }
          }
        }
        
        console.log('[ReplayMode] SELECT_CHAIN: player=', player, 'count=', count, 'speCount=', speCount, 
          'responseIndex=', responseIndex.value, 'options=', chainOptions)
        addMessage({ type: msgType, desc: `连锁选择 (可选${count}个)` })
        lastResponseMsgType = msgType
        const result = readReplayResponse()
        return result
      }

      case MSG.SELECT_PLACE:
      case MSG.SELECT_DISFIELD: {
        offset += 6
        addMessage({ type: msgType, desc: `位置选择` })
        lastResponseMsgType = msgType
        return readReplayResponse()
      }

      case MSG.SELECT_POSITION: {
        offset += 6
        addMessage({ type: msgType, desc: `表示形式选择` })
        lastResponseMsgType = msgType
        return readReplayResponse()
      }

      case MSG.SELECT_COUNTER: {
        const player = msg[offset++]
        offset += 4
        const count = msg[offset++]
        offset += count * 9
        addMessage({ type: msgType, desc: `指示物选择` })
        lastResponseMsgType = msgType
        return readReplayResponse()
      }

      case MSG.SELECT_SUM: {
        offset++
        const player = msg[offset++]
        offset += 6
        let count = msg[offset++]
        offset += count * 11
        count = msg[offset++]
        offset += count * 11
        addMessage({ type: msgType, desc: `总和选择` })
        lastResponseMsgType = msgType
        return readReplayResponse()
      }

      case MSG.SORT_CARD: {
        const player = msg[offset++]
        const count = msg[offset++]
        offset += count * 7
        addMessage({ type: msgType, desc: `卡片排序` })
        lastResponseMsgType = msgType
        return readReplayResponse()
      }

      case MSG.CONFIRM_DECKTOP:
      case MSG.CONFIRM_EXTRATOP: {
        const player = msg[offset++]
        const count = msg[offset++]
        offset += count * 7
        addMessage({ type: msgType, desc: `确认卡组顶` })
        break
      }

      case MSG.CONFIRM_CARDS: {
        const player = msg[offset++]
        offset++
        const count = msg[offset++]
        offset += count * 7
        addMessage({ type: msgType, desc: `确认卡片` })
        break
      }

      case MSG.SHUFFLE_DECK: {
        const player = msg[offset++]
        addMessage({ type: msgType, desc: `${duelInfo.players[localPlayer(player)]} 洗牌` })
        break
      }

      case MSG.SHUFFLE_HAND: {
        const player = msg[offset++]
        const count = msg[offset++]
        // 读取洗牌后的手牌代码并更新
        const p = field.players[localPlayer(player)]
        for (let i = 0; i < count; i++) {
          const code = readInt32(msg, offset)
          offset += 4
          if (i < p.hand.length) {
            // 更新手牌卡片信息
            const cardData = getCardData(code)
            p.hand[i].code = code
            p.hand[i].alias = cardData.alias
            p.hand[i].type = cardData.type
            p.hand[i].level = cardData.level
            p.hand[i].rank = (cardData.type & 0x800000) ? cardData.level : 0
            p.hand[i].attribute = cardData.attribute
            p.hand[i].race = cardData.race
            p.hand[i].attack = cardData.attack
            p.hand[i].defense = cardData.defense
            p.hand[i].position = POS.FACEUP
          }
        }
        addMessage({ type: msgType, desc: `${duelInfo.players[localPlayer(player)]} 洗手牌` })
        break
      }

      case MSG.SHUFFLE_EXTRA: {
        const player = msg[offset++]
        const count = msg[offset++]
        offset += count * 4
        addMessage({ type: msgType, desc: `洗额外卡组` })
        break
      }

      case MSG.SWAP_GRAVE_DECK: {
        const player = msg[offset++]
        addMessage({ type: msgType, desc: `交换墓地和卡组` })
        break
      }

      case MSG.REVERSE_DECK: {
        addMessage({ type: msgType, desc: `翻转卡组` })
        break
      }

      case MSG.DECK_TOP: {
        offset += 6
        addMessage({ type: msgType, desc: `卡组顶` })
        break
      }

      case MSG.SHUFFLE_SET_CARD: {
        offset++
        const count = msg[offset++]
        offset += count * 8
        addMessage({ type: msgType, desc: `洗覆盖卡` })
        break
      }

      case MSG.NEW_TURN: {
        if (skipTurn.value > 0) {
          skipTurn.value--
          if (skipTurn.value === 0) {
            isReplaySkipping.value = false
          }
        }
        const player = msg[offset++]
        duelInfo.turn++
        duelInfo.currentPlayer = player
        const turnPlayer = duelInfo.players[localPlayer(player)]
        
        // 清空Combo树（新回合开始时）
        clearComboTree()
        
        // 重置初动标记（新回合第一个动作是初动）
        hasStarterThisTurn = false
        
        // 重置通召追踪（用于展开度评估）
        resetNormalSummonTracking()
        
        addMessage({ 
          type: msgType, 
          desc: `════════ 回合 ${duelInfo.turn} (${turnPlayer}) ════════`,
          player: player,
          value: duelInfo.turn
        })
        
        // 添加解说
        addCommentaryEntry({
          type: 'NEW_TURN',
          data: {
            turn: duelInfo.turn,
            player: turnPlayer
          }
        })
        
        break
      }

      case MSG.NEW_PHASE: {
        const phase = readUint16(msg, offset)
        offset += 2
        duelInfo.phase = phase
        addMessage({ 
          type: msgType, 
          desc: `── ${getPhaseName(phase)} ──`,
          value: phase
        })
        
        // 添加解说
        addCommentaryEntry({
          type: 'NEW_PHASE',
          data: {
            phaseName: getPhaseName(phase)
          }
        })
        
        // 自动书签检测 - 战斗阶段开始
        if (phase === PHASE.BATTLE_START || phase === PHASE.BATTLE) {
          checkAutoBookmark('BATTLE_PHASE', {
            phase: phase
          })
        }
        
        // 自动书签检测 - 回合结束
        if (phase === PHASE.END) {
          checkAutoBookmark('TURN_END', {})
        }
        
        break
      }

      case MSG.MOVE: {
        const code = readUint32(msg, offset)
        const pc = msg[offset + 4]
        const pl = msg[offset + 5]
        const ps = msg[offset + 6]
        const pp = msg[offset + 7]
        const cc = msg[offset + 8]
        const cl = msg[offset + 9]
        const cs = msg[offset + 10]
        const cp = msg[offset + 11]
        offset += 16

        // 处理卡片移动
        handleCardMove(code, pc, pl, ps, pp, cc, cl, cs, cp)
        const fromLoc = pl ? getLocationName(pl) : '场外'
        const toLoc = cl ? getLocationName(cl) : '场外'
        const playerName = duelInfo.players[localPlayer(cc)] || `玩家${cc}`
        
        // 记录到Combo树：从卡组/墓地/额外移动到场上/手牌的关键移动
        const isFromKeyLocation = pl && (pl & (LOCATION.DECK | LOCATION.GRAVE | LOCATION.EXTRA | LOCATION.REMOVED))
        const isToKeyLocation = cl && (cl & (LOCATION.MZONE | LOCATION.SZONE | LOCATION.HAND))
        if (code && isFromKeyLocation && isToKeyLocation) {
          const cardName = getCardName(code)
          addComboEntry({
            type: 'MOVE',
            cardName,
            cardCode: code,
            detail: `${fromLoc} → ${toLoc}`,
            icon: '→'
          })
        }
        
        // XYZ素材追踪：从怪兽区移动到额外区的卡片是XYZ素材
        if (code && (pl & LOCATION.MZONE) && (cl & LOCATION.EXTRA)) {
          const cardData = cardDatabase.get(code)
          pendingXyzMaterials.push({
            code,
            cardCode: code,  // 用于因果关系追踪
            name: getCardName(code),
            level: cardData?.level || 0,
            rank: (cardData?.type & 0x800000) ? cardData?.level : 0
          })
        }
        
        // 同调/Link/融合/仪式素材追踪：从怪兽区或手牌移动到墓地的卡片
        if (code && ((pl & LOCATION.MZONE) || (pl & LOCATION.HAND)) && (cl & LOCATION.GRAVE)) {
          const cardData = cardDatabase.get(code)
          const cardType = cardData?.type || 0
          pendingSummonMaterials.push({
            code,
            cardCode: code,  // 用于因果关系追踪
            name: getCardName(code),
            level: cardData?.level || 0,
            attack: cardData?.attack || 0,
            defense: cardData?.defense || 0,
            isTuner: !!(cardType & 0x1000),      // 调整
            isToken: !!(cardType & 0x4000),      // 衍生物
            isLink: !!(cardType & 0x4000000),    // 连接怪兽
            linkValue: (cardType & 0x4000000) ? (cardData?.level & 0xf) : 0,
            fromLocation: pl  // 记录来源位置（怪兽区或手牌）
          })
          lastMaterialMoveStep = currentStep.value
        }
        
        // 融合/仪式素材追踪：从手牌移动到除外区的卡片（某些融合方式会除外素材）
        if (code && (pl & LOCATION.HAND) && (cl & LOCATION.REMOVED)) {
          const cardData = cardDatabase.get(code)
          pendingSummonMaterials.push({
            code,
            cardCode: code,
            name: getCardName(code),
            level: cardData?.level || 0,
            attack: cardData?.attack || 0,
            defense: cardData?.defense || 0,
            isTuner: !!(cardData?.type & 0x1000),
            isToken: false,
            isLink: false,
            linkValue: 0,
            fromLocation: pl
          })
          lastMaterialMoveStep = currentStep.value
        }
        
        addMessage({ 
          type: msgType, 
          desc: `【${getCardName(code)}】从 ${fromLoc} 移动到 ${toLoc}`,
          cardCode: code,
          player: cc,
          location: cl,
          sequence: cs,
          position: cp,
          extra: { fromPlayer: pc, fromLocation: pl, fromSeq: ps, fromPos: pp }
        })
        break
      }

      case MSG.POS_CHANGE: {
        const code = readUint32(msg, offset)
        const cc = msg[offset + 4]
        const cl = msg[offset + 5]
        const cs = msg[offset + 6]
        const pp = msg[offset + 7]
        const cp = msg[offset + 8]
        offset += 9

        // 更新卡片位置
        const card = getFieldCard(cc, cl, cs)
        if (card) {
          card.position = cp
        }
        addMessage({ type: msgType, desc: `表示变更: ${getCardName(code)}` })
        break
      }

      case MSG.SET: {
        const code = readUint32(msg, offset)
        offset += 8
        addMessage({ type: msgType, desc: `盖放: ${getCardName(code)}` })
        pauseable = false
        break
      }

      case MSG.SWAP: {
        offset += 16
        addMessage({ type: msgType, desc: `交换位置` })
        break
      }

      case MSG.FIELD_DISABLED: {
        offset += 4
        addMessage({ type: msgType, desc: `场地禁用` })
        pauseable = false
        break
      }

      case MSG.SUMMONING: {
        const code = readUint32(msg, offset)
        const cc = msg[offset + 4]
        const cl = msg[offset + 5]
        const cs = msg[offset + 6]
        const cp = msg[offset + 7]
        offset += 8
        const cardData = cardDatabase.get(code)
        const levelInfo = cardData ? `★${cardData.level}` : ''
        
        // 标记通召权已使用（用于展开度评估）
        markNormalSummonUsed(localPlayer(cc))
        
        // 记录到Combo树（通常召唤一定是从手牌，且只能在自己回合进行）
        const cardName = getCardName(code)
        const isTurnPlayer = (localPlayer(cc) === duelInfo.currentPlayer)
        const isStarter = isTurnPlayer && !hasStarterThisTurn
        if (isStarter) {
          hasStarterThisTurn = true  // 标记本回合已有初动
        }
        addComboEntry({
          type: 'SUMMON',
          cardName,
          cardCode: code,
          detail: `通常召唤 ${levelInfo}`,
          icon: '⬆',
          isStarter  // 自己回合第一个动作是初动点
        })
        
        addMessage({ 
          type: msgType, 
          desc: `${duelInfo.players[localPlayer(cc)]} 通常召唤【${getCardName(code)}】${levelInfo}`,
          cardCode: code,
          player: cc,
          location: cl,
          sequence: cs,
          position: cp
        })
        
        // 添加解说
        addCommentaryEntry({
          type: 'SUMMON',
          data: {
            player: duelInfo.players[localPlayer(cc)],
            cardName: getCardName(code)
          }
        })
        
        pauseable = false
        break
      }

      case MSG.SUMMONED: {
        addMessage({ type: msgType, desc: `召唤成功` })
        break
      }

      case MSG.SPSUMMONING: {
        const code = readUint32(msg, offset)
        const cc = msg[offset + 4]
        const cl = msg[offset + 5]
        const cs = msg[offset + 6]
        const cp = msg[offset + 7]
        offset += 8
        const cardData = cardDatabase.get(code)
        const isXyz = cardData && (cardData.type & 0x800000)
        const typeInfo = cardData ? (cardData.type & 0x4000000 ? 'LINK' : (isXyz ? 'XYZ' : (cardData.type & 0x2000 ? '同调' : (cardData.type & 0x40 ? '融合' : '')))) : ''
        
        // 记录到Combo树
        const cardName = getCardName(code)
        const comboEntry = {
          type: 'SPSUMMON',
          cardName,
          cardCode: code,
          detail: `特殊召唤${typeInfo ? ` (${typeInfo})` : ''}`,
          icon: '⭐'
        }
        
        // 检查素材时间窗口 - 只有在时间窗口内的素材才有效
        const materialsInWindow = (currentStep.value - lastMaterialMoveStep) <= MATERIAL_WINDOW_STEPS
        
        // XYZ召唤时附加素材信息
        if (isXyz && pendingXyzMaterials.length > 0) {
          comboEntry.xyzMaterials = [...pendingXyzMaterials]
          comboEntry.summonMaterials = [...pendingXyzMaterials]  // 统一素材字段
          comboEntry.summonType = 'XYZ'
          // 生成素材摘要文本
          const levelCounts = {}
          pendingXyzMaterials.forEach(m => {
            const lvl = m.level || m.rank || '?'
            levelCounts[lvl] = (levelCounts[lvl] || 0) + 1
          })
          const summaryParts = Object.entries(levelCounts).map(([lvl, cnt]) => `${cnt}×★${lvl}`)
          comboEntry.materialSummary = summaryParts.join(' + ')
          // 清空待叠放列表
          pendingXyzMaterials = []
        }
        
        // 同调召唤时附加素材信息 (调整 + 非调整怪兽)
        const isSynchro = cardData && (cardData.type & 0x2000)
        if (isSynchro && materialsInWindow && pendingSummonMaterials.length > 0) {
          const synchroMaterials = [...pendingSummonMaterials]
          comboEntry.synchroMaterials = synchroMaterials
          comboEntry.summonMaterials = synchroMaterials
          comboEntry.summonType = '同调'
          
          // 分析调整和非调整
          const tuners = synchroMaterials.filter(m => m.isTuner)
          const nonTuners = synchroMaterials.filter(m => !m.isTuner)
          const totalLevel = synchroMaterials.reduce((sum, m) => sum + m.level, 0)
          
          // 生成素材摘要：调整 + 非调整 = 等级
          const tunerNames = tuners.map(m => m.name).join('+')
          const nonTunerLevels = nonTuners.map(m => `★${m.level}`).join('+')
          comboEntry.materialSummary = `${tunerNames || '调整'} + ${nonTunerLevels || '非调整'} = ★${totalLevel}`
          
          // 清空素材列表
          pendingSummonMaterials = []
        }
        
        // Link召唤时附加素材信息
        const isLink = cardData && (cardData.type & 0x4000000)
        if (isLink && materialsInWindow && pendingSummonMaterials.length > 0) {
          const linkMaterials = [...pendingSummonMaterials]
          comboEntry.linkMaterials = linkMaterials
          comboEntry.summonMaterials = linkMaterials
          comboEntry.summonType = 'LINK'
          
          // 计算素材贡献的Link值（Link怪兽可以当多个素材）
          const totalLinkValue = linkMaterials.reduce((sum, m) => {
            return sum + (m.isLink ? m.linkValue : 1)
          }, 0)
          
          // 生成素材摘要：素材数量
          comboEntry.materialSummary = `${linkMaterials.length}体素材 (Link-${totalLinkValue})`
          
          // 清空素材列表
          pendingSummonMaterials = []
        }
        
        // 融合召唤时附加素材信息
        const isFusion = cardData && (cardData.type & 0x40)
        if (isFusion && materialsInWindow && pendingSummonMaterials.length > 0) {
          const fusionMaterials = [...pendingSummonMaterials]
          comboEntry.fusionMaterials = fusionMaterials
          comboEntry.summonMaterials = fusionMaterials
          comboEntry.summonType = '融合'
          
          // 生成素材摘要：素材名称列表
          const materialNames = fusionMaterials.map(m => m.name)
          comboEntry.materialSummary = materialNames.join(' + ')
          
          // 清空素材列表
          pendingSummonMaterials = []
        }
        
        // 仪式召唤时附加素材信息 (怪兽类型包含仪式标记 0x80)
        const isRitual = cardData && (cardData.type & 0x80)
        if (isRitual && materialsInWindow && pendingSummonMaterials.length > 0) {
          const ritualMaterials = [...pendingSummonMaterials]
          comboEntry.ritualMaterials = ritualMaterials
          comboEntry.summonMaterials = ritualMaterials
          comboEntry.summonType = '仪式'
          
          // 计算总等级
          const totalLevel = ritualMaterials.reduce((sum, m) => sum + m.level, 0)
          const requiredLevel = cardData.level || 0
          
          // 生成素材摘要：等级条件
          comboEntry.materialSummary = `等级合计 ${totalLevel} (需要 ≥${requiredLevel})`
          
          // 清空素材列表
          pendingSummonMaterials = []
        }
        
        addComboEntry(comboEntry)
        
        addMessage({ 
          type: msgType, 
          desc: `${duelInfo.players[localPlayer(cc)]} 特殊召唤【${getCardName(code)}】${typeInfo ? `(${typeInfo})` : ''}`,
          cardCode: code,
          player: cc,
          location: cl,
          sequence: cs,
          position: cp
        })
        
        // 添加解说
        addCommentaryEntry({
          type: 'SPSUMMON',
          data: {
            player: duelInfo.players[localPlayer(cc)],
            cardName: getCardName(code),
            summonType: typeInfo ? `${typeInfo}召唤` : '特殊召唤',
            zone: getLocationName(cl),
            materialSummary: comboEntry.materialSummary
          }
        })
        
        // 自动书签检测 - 关键怪兽召唤
        checkAutoBookmark('KEY_MONSTER', {
          cardCode: code,
          cardName: getCardName(code)
        })
        
        pauseable = false
        break
      }

      case MSG.SPSUMMONED: {
        addMessage({ type: msgType, desc: `特殊召唤成功` })
        break
      }

      case MSG.FLIPSUMMONING: {
        const code = readUint32(msg, offset)
        const cc = msg[offset + 4]
        const cl = msg[offset + 5]
        const cs = msg[offset + 6]
        const cp = msg[offset + 7]
        offset += 8
        addMessage({ 
          type: msgType, 
          desc: `${duelInfo.players[localPlayer(cc)]} 翻转召唤【${getCardName(code)}】`,
          cardCode: code,
          player: cc,
          location: cl,
          sequence: cs,
          position: cp
        })
        pauseable = false
        break
      }

      case MSG.FLIPSUMMONED: {
        addMessage({ type: msgType, desc: `翻转召唤成功` })
        break
      }

      case MSG.CHAINING: {
        const code = readUint32(msg, offset)
        const cc = msg[offset + 4]
        const cl = msg[offset + 5]
        const cs = msg[offset + 6]
        const ss = msg[offset + 7]
        const desc = readUint32(msg, offset + 8)
        const ct = msg[offset + 12]
        offset += 16
        field.chains.push({ code, controller: cc, location: cl, sequence: cs })
        const chainNum = field.chains.length
        const locName = getLocationName(cl)
        
        // 追踪连锁卡片
        const cardName = getCardName(code)
        currentChainCards.push({
          code,
          name: cardName,
          chainNum,
          location: locName,
          controller: cc
        })
        
        // 记录到Combo树
        currentChainDepth = chainNum
        
        // 判断是否是自己的回合（主动展开combo）
        const isTurnPlayer = (localPlayer(cc) === duelInfo.currentPlayer)
        
        // 获取卡片类型用于效果分类
        const cardData = cardDatabase.get(code)
        const cardType = cardData?.type || 0
        
        // 使用效果类型分类系统检测效果类型
        const effectInfo = detectEffectType(code, cardType, chainNum, isTurnPlayer, cl, hasStarterThisTurn)
        
        // 如果是初动点，标记本回合已有初动
        if (effectInfo.isStarter) {
          hasStarterThisTurn = true
        }
        
        // 生成详细的效果描述
        const effectDesc = `连锁${chainNum} ${effectInfo.effectLabel}效果`
        const displayInfo = getEffectDisplayInfo(effectInfo)
        
        const comboEntry = {
          type: 'CHAIN',
          cardName,
          cardCode: code,
          detail: effectDesc,
          icon: effectInfo.effectIcon || '⛓',
          chainNum,
          chainInfo: [...currentChainCards], // 记录完整连锁信息用于悬停显示
          // 策略标签
          isStarter: effectInfo.isStarter,     // 初动点
          isHandTrap: effectInfo.isHandTrap,   // 手坑
          isActionPoint: effectInfo.isActionPoint, // 动点
          isResponse: effectInfo.isResponse,   // 响应
          // 效果类型详情
          effectType: effectInfo.effectType,   // 效果类型（ignition/trigger/quick等）
          effectLabel: effectInfo.effectLabel, // 效果标签
          effectIcon: effectInfo.effectIcon,   // 效果图标
          effectColor: effectInfo.effectColor, // 效果颜色
          spellSpeed: effectInfo.spellSpeed,   // 咒文速度
          displayInfo  // 显示信息
        }
        addComboEntry(comboEntry)
        
        addMessage({ 
          type: msgType, 
          desc: `连锁${chainNum}: ${duelInfo.players[localPlayer(cc)]} 发动【${getCardName(code)}】(${locName})`,
          cardCode: code,
          player: cc,
          location: cl,
          sequence: cs,
          value: chainNum
        })
        
        // 添加解说
        addCommentaryEntry({
          type: 'CHAIN',
          data: {
            player: duelInfo.players[localPlayer(cc)],
            cardName: getCardName(code),
            chainNum,
            location: locName
          }
        })
        
        // 自动书签检测 - 手坑发动
        if (effectInfo.isHandTrap || HAND_TRAP_CODES.has(code)) {
          checkAutoBookmark('HAND_TRAP', {
            cardCode: code,
            cardName: getCardName(code)
          })
        }
        
        // 自动书签检测 - 多重连锁
        if (chainNum >= 3) {
          checkAutoBookmark('MULTI_CHAIN', {
            chainCount: chainNum
          })
        }
        
        break
      }

      case MSG.CHAINED: {
        const ct = msg[offset++]
        addMessage({ type: msgType, desc: `连锁 ${ct} 构建完成` })
        break
      }

      case MSG.CHAIN_SOLVING: {
        const ct = msg[offset++]
        const chainCard = field.chains[ct - 1]
        const cardName = chainCard ? getCardName(chainCard.code) : ''
        addMessage({ 
          type: msgType, 
          desc: `处理连锁 ${ct}${cardName ? `: 【${cardName}】` : ''}`,
          value: ct
        })
        pauseable = false
        break
      }

      case MSG.CHAIN_SOLVED: {
        const ct = msg[offset++]
        addMessage({ type: msgType, desc: `连锁 ${ct} 处理完毕`, value: ct })
        pauseable = false
        break
      }

      case MSG.CHAIN_END: {
        field.chains = []
        currentChainDepth = 0 // 重置连锁深度
        currentChainCards = [] // 清空连锁追踪
        addMessage({ type: msgType, desc: `连锁处理全部结束` })
        pauseable = false
        break
      }

      case MSG.CHAIN_NEGATED:
      case MSG.CHAIN_DISABLED: {
        const ct = msg[offset++]
        const actionName = msgType === MSG.CHAIN_NEGATED ? '被无效化' : '被无效'
        addMessage({ type: msgType, desc: `连锁 ${ct} ${actionName}`, value: ct })
        
        // 自动书签检测 - 效果/发动被无效
        checkAutoBookmark('CHAIN_NEGATED', {
          chainNum: ct,
          isActivationNegated: msgType === MSG.CHAIN_NEGATED
        })
        break
      }

      case MSG.CARD_SELECTED:
      case MSG.RANDOM_SELECTED: {
        const player = msg[offset++]
        const count = msg[offset++]
        offset += count * 4
        addMessage({ type: msgType, desc: `卡片被选择` })
        pauseable = false
        break
      }

      case MSG.BECOME_TARGET: {
        const count = msg[offset++]
        offset += count * 4
        addMessage({ type: msgType, desc: `成为对象` })
        break
      }

      case MSG.DRAW: {
        const player = msg[offset++]
        const count = msg[offset++]
        
        // 处理抽卡并收集卡名
        const drawnCards = []
        for (let i = 0; i < count; i++) {
          const code = readUint32(msg, offset)
          offset += 4
          const realCode = code & 0x7fffffff
          
          // 创建卡片并添加到手牌
          const card = createCard(realCode, player, LOCATION.HAND, field.players[player].hand.length, POS.FACEUP)
          field.players[player].hand.push(card)
          field.players[player].deck = Math.max(0, field.players[player].deck - 1)
          drawnCards.push(getCardName(realCode))
        }
        
        const cardList = drawnCards.length <= 3 ? drawnCards.join('、') : `${drawnCards.slice(0, 3).join('、')}等${drawnCards.length}张`
        addMessage({ 
          type: msgType, 
          desc: `${duelInfo.players[localPlayer(player)]} 抽了 ${count} 张卡: ${cardList}`,
          player: player,
          value: count,
          extra: { cards: drawnCards }
        })
        
        // 添加解说
        addCommentaryEntry({
          type: 'DRAW',
          data: {
            player: duelInfo.players[localPlayer(player)],
            count: count,
            cards: drawnCards
          }
        })
        break
      }

      case MSG.DAMAGE: {
        const player = msg[offset++]
        const damage = readInt32(msg, offset)
        offset += 4
        const oldLp = duelInfo.lp[localPlayer(player)]
        duelInfo.lp[localPlayer(player)] = Math.max(0, oldLp - damage)
        const newLp = duelInfo.lp[localPlayer(player)]
        addMessage({ 
          type: msgType, 
          desc: `${duelInfo.players[localPlayer(player)]} 受到 ${damage} 伤害 (LP: ${oldLp} → ${newLp})`,
          player: player,
          value: damage,
          extra: { oldLp, newLp }
        })
        
        // 添加解说
        addCommentaryEntry({
          type: 'DAMAGE',
          data: {
            player: duelInfo.players[localPlayer(player)],
            value: damage,
            remainingLP: newLp
          }
        })
        
        // 自动书签检测 - 重大LP变化
        checkAutoBookmark('MAJOR_LP_CHANGE', {
          player: localPlayer(player),
          lpLost: damage,
          newLp: newLp
        })
        
        break
      }

      case MSG.RECOVER: {
        const player = msg[offset++]
        const value = readInt32(msg, offset)
        offset += 4
        const oldLp = duelInfo.lp[localPlayer(player)]
        duelInfo.lp[localPlayer(player)] += value
        const newLp = duelInfo.lp[localPlayer(player)]
        addMessage({ 
          type: msgType, 
          desc: `${duelInfo.players[localPlayer(player)]} 回复 ${value} LP (LP: ${oldLp} → ${newLp})`,
          player: player,
          value: value,
          extra: { oldLp, newLp }
        })
        
        // 添加解说
        addCommentaryEntry({
          type: 'RECOVER',
          data: {
            player: duelInfo.players[localPlayer(player)],
            value: value,
            remainingLP: newLp
          }
        })
        
        break
      }

      case MSG.EQUIP: {
        offset += 8
        addMessage({ type: msgType, desc: `装备` })
        pauseable = false
        break
      }

      case MSG.LPUPDATE: {
        const player = msg[offset++]
        const lp = readInt32(msg, offset)
        offset += 4
        duelInfo.lp[localPlayer(player)] = lp
        addMessage({ type: msgType, desc: `${duelInfo.players[localPlayer(player)]} LP: ${lp}` })
        break
      }

      case MSG.CARD_TARGET:
      case MSG.CANCEL_TARGET: {
        offset += 8
        addMessage({ type: msgType, desc: msgType === MSG.CARD_TARGET ? `指定对象` : `取消对象` })
        pauseable = false
        break
      }

      case MSG.PAY_LPCOST: {
        const player = msg[offset++]
        const cost = readInt32(msg, offset)
        offset += 4
        duelInfo.lp[localPlayer(player)] = Math.max(0, duelInfo.lp[localPlayer(player)] - cost)
        addMessage({ type: msgType, desc: `${duelInfo.players[localPlayer(player)]} 支付 ${cost} LP` })
        break
      }

      case MSG.ADD_COUNTER:
      case MSG.REMOVE_COUNTER: {
        offset += 7
        addMessage({ type: msgType, desc: msgType === MSG.ADD_COUNTER ? `放置指示物` : `移除指示物` })
        break
      }

      case MSG.ATTACK: {
        const ac = msg[offset]
        const al = msg[offset + 1]
        const as = msg[offset + 2]
        const dc = msg[offset + 4]
        const dl = msg[offset + 5]
        const ds = msg[offset + 6]
        offset += 8
        
        const attackerCard = getFieldCard(ac, al, as)
        const attackerName = attackerCard ? getCardName(attackerCard.code) : '未知卡片'
        let desc = `${duelInfo.players[localPlayer(ac)]} 的【${attackerName}】宣言攻击`
        
        let defenderName = ''
        if (dl !== 0) {
          const defenderCard = getFieldCard(dc, dl, ds)
          defenderName = defenderCard ? getCardName(defenderCard.code) : '未知卡片'
          desc += ` → ${duelInfo.players[localPlayer(dc)]} 的【${defenderName}】`
        } else {
          desc += ` → ${duelInfo.players[localPlayer(dc)]} 直接攻击`
        }
        
        addMessage({ 
          type: msgType, 
          desc: desc,
          extra: { attacker: { player: ac, card: attackerName }, defender: { player: dc, card: dl ? '怪兽' : '直接' } }
        })
        
        // 添加解说
        addCommentaryEntry({
          type: 'ATTACK',
          data: {
            attacker: attackerName,
            target: dl !== 0 ? defenderName : '直接',
            defenderPlayer: duelInfo.players[localPlayer(dc)]
          }
        })
        
        break
      }

      case MSG.BATTLE: {
        const ac = msg[offset]
        const al = msg[offset + 1]
        const as = msg[offset + 2]
        const aa = readInt32(msg, offset + 4)
        const ad = readInt32(msg, offset + 8)
        const dc = msg[offset + 12]
        const dl = msg[offset + 13]
        const ds = msg[offset + 14]
        const da = readInt32(msg, offset + 16)
        const dd = readInt32(msg, offset + 20)
        offset += 26
        
        const attackerCard = getFieldCard(ac, al, as)
        const attackerName = attackerCard ? getCardName(attackerCard.code) : '未知'
        
        if (dl !== 0) {
          const defenderCard = getFieldCard(dc, dl, ds)
          const defenderName = defenderCard ? getCardName(defenderCard.code) : '未知'
          addMessage({ 
            type: msgType, 
            desc: `战斗:【${attackerName}】(ATK:${aa}) vs【${defenderName}】(ATK:${da}/DEF:${dd})`,
            extra: { attacker: { name: attackerName, atk: aa, def: ad }, defender: { name: defenderName, atk: da, def: dd } }
          })
        } else {
          addMessage({ 
            type: msgType, 
            desc: `战斗:【${attackerName}】(ATK:${aa}) 直接攻击`,
            extra: { attacker: { name: attackerName, atk: aa }, direct: true }
          })
        }
        pauseable = false
        break
      }

      case MSG.ATTACK_DISABLED: {
        addMessage({ type: msgType, desc: `攻击被无效` })
        pauseable = false
        break
      }

      case MSG.DAMAGE_STEP_START:
      case MSG.DAMAGE_STEP_END: {
        addMessage({ type: msgType, desc: msgType === MSG.DAMAGE_STEP_START ? `伤害步骤开始` : `伤害步骤结束` })
        
        // 自动书签检测 - 伤害步骤开始
        if (msgType === MSG.DAMAGE_STEP_START) {
          checkAutoBookmark('DAMAGE_STEP', {})
        }
        
        pauseable = false
        break
      }

      case MSG.MISSED_EFFECT: {
        offset += 8
        addMessage({ type: msgType, desc: `错过时点` })
        break
      }

      case MSG.TOSS_COIN:
      case MSG.TOSS_DICE: {
        const player = msg[offset++]
        const count = msg[offset++]
        offset += count
        addMessage({ type: msgType, desc: msgType === MSG.TOSS_COIN ? `投掷硬币` : `投掷骰子` })
        break
      }

      case MSG.ROCK_PAPER_SCISSORS: {
        const player = msg[offset++]
        addMessage({ type: msgType, desc: `猜拳` })
        lastResponseMsgType = msgType
        return readReplayResponse()
      }

      case MSG.HAND_RES: {
        offset++
        addMessage({ type: msgType, desc: `猜拳结果` })
        break
      }

      case MSG.ANNOUNCE_RACE:
      case MSG.ANNOUNCE_ATTRIB: {
        const player = msg[offset++]
        offset += 5
        addMessage({ type: msgType, desc: `宣言种族/属性` })
        lastResponseMsgType = msgType
        return readReplayResponse()
      }

      case MSG.ANNOUNCE_CARD:
      case MSG.ANNOUNCE_NUMBER: {
        const player = msg[offset++]
        const count = msg[offset++]
        offset += count * 4
        addMessage({ type: msgType, desc: `宣言卡片/数字` })
        lastResponseMsgType = msgType
        return readReplayResponse()
      }

      case MSG.CARD_HINT:
      case MSG.PLAYER_HINT: {
        offset += msgType === MSG.CARD_HINT ? 9 : 6
        break
      }

      case MSG.MATCH_KILL: {
        offset += 4
        break
      }

      case MSG.TAG_SWAP: {
        const player = msg[offset]
        offset += msg[offset + 2] * 4 + msg[offset + 4] * 4 + 9
        addMessage({ type: msgType, desc: `TAG 交换` })
        break
      }

      case MSG.RELOAD_FIELD: {
        offset++
        for (let p = 0; p < 2; p++) {
          offset += 4
          for (let seq = 0; seq < 7; seq++) {
            const val = msg[offset++]
            if (val) offset += 2
          }
          for (let seq = 0; seq < 8; seq++) {
            const val = msg[offset++]
            if (val) offset++
          }
          offset += 6
        }
        offset++
        addMessage({ type: msgType, desc: `重新加载场地` })
        break
      }

      case MSG.AI_NAME:
      case MSG.SHOW_HINT: {
        const strLen = readUint16(msg, offset)
        offset += 2 + strLen + 1
        break
      }

      default: {
        console.warn(`[ReplayAnalyze] 未知消息类型: ${msgType}`)
        addMessage({ type: msgType, desc: `未知消息 ${msgType}` })
        break
      }
    }

    // 暂停检查
    if (pauseable) {
      const stepBack = await handlePauseCheck(true)
      // 如果发生了回退操作，提前结束当前消息处理
      if (stepBack) {
        return 'stepback'
      }
    }
  }

  return true
}

/**
 * 处理卡片移动
 */
function handleCardMove(code, pc, pl, ps, pp, cc, cl, cs, cp) {
  // 从原位置移除
  if (pl !== 0) {
    removeCardFromField(pc, pl, ps)
  }

  // 添加到新位置
  if (cl !== 0 && !(cl & LOCATION.OVERLAY)) {
    // 移动到手牌的卡全部正面显示
    const position = (cl & LOCATION.HAND) ? POS.FACEUP : cp
    const card = createCard(code, cc, cl, cs, position)
    addCardToField(card)
  }
}

// 读取辅助函数
function readUint16(data, offset) {
  return data[offset] | (data[offset + 1] << 8)
}

function readInt32(data, offset) {
  return data[offset] | (data[offset + 1] << 8) | (data[offset + 2] << 16) | (data[offset + 3] << 24)
}

function readUint32(data, offset) {
  return (data[offset] | (data[offset + 1] << 8) | (data[offset + 2] << 16) | (data[offset + 3] << 24)) >>> 0
}

// ========== UI 事件处理 ==========

function handleLoadReplay() {
  fileInput.value?.click()
}

async function handleFileSelected(event) {
  const file = event.target.files?.[0]
  if (!file) return

  try {
    isLoading.value = true
    loadingStatus.value = '读取文件...'
    loadingProgress.value = 10

    const buffer = await file.arrayBuffer()

    loadingStatus.value = '解析回放...'
    loadingProgress.value = 30

    const parsed = await parseReplayFile(buffer)
    replayHeader = parsed.header
    replayParams = parsed.params
    replayDecks = parsed.decks
    replayPlayers = parsed.players
    replaySeedSequence = parsed.seedSequence  // 存储 YRP2 种子序列
    responses.value = parsed.responses

    loadingStatus.value = '预加载卡牌脚本...'
    loadingProgress.value = 70

    // 预加载所有卡组中的卡牌脚本
    // 注意：对于替代图卡(alternative artwork)，需要加载其原始代码的脚本
    // 因为 OCGCore 在 register_card 时使用 get_original_code() 来加载脚本
    const allCodes = new Set()
    for (const deck of replayDecks) {
      for (const code of deck.main) {
        allCodes.add(code)
        // 检查是否有替代图卡的原始代码需要加载
        const cardData = cardDatabase.get(code)
        if (cardData && cardData.alias) {
          const originalCode = getOriginalCode(code, cardData.alias)
          if (originalCode !== code) {
            allCodes.add(originalCode)
            console.log(`[Scripts] 卡片 ${code} 是替代图卡，需要加载原始脚本 ${originalCode}`)
          }
        }
      }
      for (const code of deck.extra) {
        allCodes.add(code)
        // 检查是否有替代图卡的原始代码需要加载
        const cardData = cardDatabase.get(code)
        if (cardData && cardData.alias) {
          const originalCode = getOriginalCode(code, cardData.alias)
          if (originalCode !== code) {
            allCodes.add(originalCode)
            console.log(`[Scripts] 卡片 ${code} 是替代图卡，需要加载原始脚本 ${originalCode}`)
          }
        }
      }
    }

    let loaded = 0
    const total = allCodes.size
    for (const code of allCodes) {
      await loadCardScript(code)
      loaded++
      loadingProgressText.value = `${loaded}/${total}`
    }

    loadingStatus.value = '准备完成'
    loadingProgress.value = 100
    loadingProgressText.value = ''

    console.log('[ReplayMode] 回放加载完成:', {
      players: replayPlayers,
      params: replayParams,
      decks: replayDecks.map(d => ({ main: d.main.length, extra: d.extra.length })),
      responses: responses.value.length,
      scriptsLoaded: scriptCache.size
    })
    console.log('[ReplayMode] 脚本缓存统计: 共', scriptCache.size, '个脚本')
    // 列出所有脚本键
    const allKeys = Array.from(scriptCache.keys())
    console.log('[ReplayMode] 脚本缓存键:', allKeys.slice(0, 20), allKeys.length > 20 ? `...还有${allKeys.length - 20}个` : '')

    isLoaded.value = true
    error.value = null
  } catch (e) {
    console.error('[ReplayMode] 加载失败:', e)
    error.value = `加载失败: ${e.message}`
  } finally {
    isLoading.value = false
    event.target.value = ''
  }
}

async function handleStartReplay() {
  if (!isLoaded.value || isStarted.value) return

  try {
    // 第一步：预加载所有录像消息
    loadingStatus.value = '预加载录像数据...'
    isLoading.value = true
    
    // 初始化决斗以便预加载
    if (!await startDuel()) {
      throw new Error('决斗初始化失败')
    }
    
    // 执行预加载
    const preloadSuccess = await preloadAllMessages()
    
    if (!preloadSuccess) {
      console.warn('[ReplayMode] 预加载失败，使用实时播放模式')
      usePreloadedData.value = false
    }
    
    isLoading.value = false
    loadingStatus.value = ''
    
    // 第二步：使用预加载数据进行正式播放
    isPausing.value = true  // 默认暂停模式开始
    
    if (usePreloadedData.value && preloadedMessages.value.length > 0) {
      // 使用预加载的消息播放
      console.log('[ReplayMode] 使用预加载模式播放，共', preloadedMessages.value.length, '条消息')
      await playFromPreloadedMessages()
    } else {
      // 回退到实时播放模式
      console.log('[ReplayMode] 使用实时播放模式')
      await startReplay(0)
    }
  } catch (e) {
    console.error('[ReplayMode] 启动失败:', e)
    error.value = `启动失败: ${e.message}`
    isLoading.value = false
  }
}

function handlePause() {
  // 恢复播放时退出预览模式
  if (isPaused.value && comboPreviewMode.value) {
    exitComboPreviewMode()
  }
  if (isPaused.value) {
    pause(false, false)
  } else {
    pause(true, false)
  }
}

function handleStep() {
  if (isStarted.value && isPaused.value) {
    // 执行单步时退出预览模式
    if (comboPreviewMode.value) {
      exitComboPreviewMode()
    }
    pause(false, true)
  }
}

function handleUndo() {
  undo()
}

function handleSwapField() {
  swapField()
}

async function handleRestart() {
  if (!isLoaded.value) return

  stopReplay(false)
  await restart(true)
  responseIndex.value = 0
  currentStep.value = 0
  messages.value = []
  isStarted.value = false
  isPaused.value = false
  isPausing.value = false
  
  // 重置预加载状态，下次开始时会重新预加载
  usePreloadedData.value = false
  preloadedMessages.value = []
  preloadedMessageIndex.value = 0
  
  // 清空状态快照和回退标志
  stateSnapshots.value = []
  stepBackPending = false
}

function handleStop() {
  stopReplay(false)
}

// ========== 完整对局记录导出 ==========

// 详细对局记录存储（用于完整导出）
const fullDuelLog = ref([])

/**
 * 添加详细记录条目
 */
function addDetailedLogEntry(entry) {
  // 预加载模式下跳过添加详细记录
  if (isPreloading.value) return
  
  fullDuelLog.value.push({
    ...entry,
    turn: duelInfo.turn,
    phase: duelInfo.phase,
    phaseName: getPhaseName(duelInfo.phase),
    currentPlayer: duelInfo.currentPlayer,
    lp: [...duelInfo.lp],
    timestamp: Date.now(),
    step: currentStep.value
  })
}

/**
 * 获取卡片类型描述
 */
function getCardTypeDesc(type) {
  const types = []
  if (type & 0x1) types.push('怪兽')
  if (type & 0x2) types.push('魔法')
  if (type & 0x4) types.push('陷阱')
  if (type & 0x10) types.push('通常')
  if (type & 0x20) types.push('效果')
  if (type & 0x40) types.push('融合')
  if (type & 0x80) types.push('仪式')
  if (type & 0x200) types.push('灵魂')
  if (type & 0x400) types.push('同盟')
  if (type & 0x800) types.push('二重')
  if (type & 0x1000) types.push('调整')
  if (type & 0x2000) types.push('同调')
  if (type & 0x4000) types.push('衍生物')
  if (type & 0x10000) types.push('速攻')
  if (type & 0x20000) types.push('永续')
  if (type & 0x40000) types.push('装备')
  if (type & 0x80000) types.push('场地')
  if (type & 0x100000) types.push('反击')
  if (type & 0x200000) types.push('反转')
  if (type & 0x400000) types.push('卡通')
  if (type & 0x800000) types.push('超量')
  if (type & 0x1000000) types.push('灵摆')
  if (type & 0x4000000) types.push('连接')
  return types.join('/')
}

/**
 * 获取属性描述
 */
function getAttributeDesc(attr) {
  const attrs = {
    0x01: '地',
    0x02: '水',
    0x04: '炎',
    0x08: '风',
    0x10: '光',
    0x20: '暗',
    0x40: '神'
  }
  return attrs[attr] || '无'
}

/**
 * 获取种族描述
 */
function getRaceDesc(race) {
  const races = {
    0x1: '战士',
    0x2: '魔法使',
    0x4: '天使',
    0x8: '恶魔',
    0x10: '不死',
    0x20: '机械',
    0x40: '水',
    0x80: '炎',
    0x100: '岩石',
    0x200: '鸟兽',
    0x400: '植物',
    0x800: '昆虫',
    0x1000: '雷',
    0x2000: '龙',
    0x4000: '兽',
    0x8000: '兽战士',
    0x10000: '恐龙',
    0x20000: '鱼',
    0x40000: '海龙',
    0x80000: '爬虫',
    0x100000: '念动力',
    0x200000: '幻神兽',
    0x400000: '创世神',
    0x800000: '幻龙',
    0x1000000: '电子界',
    0x2000000: '幻想魔'
  }
  return races[race] || '无'
}

/**
 * 获取卡片完整信息描述
 */
function getCardFullInfo(code) {
  const data = cardDatabase.get(code)
  if (!data) return `卡片 #${code}`
  
  let info = `【${data.name}】(${code})`
  info += `\n  类型: ${getCardTypeDesc(data.type)}`
  
  if (data.type & 0x1) { // 怪兽
    info += `\n  属性: ${getAttributeDesc(data.attribute)}`
    info += `\n  种族: ${getRaceDesc(data.race)}`
    if (data.type & 0x4000000) { // 连接
      info += `\n  LINK-${data.level}`
      info += `\n  ATK: ${data.attack}`
    } else if (data.type & 0x800000) { // 超量
      info += `\n  阶级: ★${data.level}`
      info += `\n  ATK: ${data.attack} / DEF: ${data.defense}`
    } else {
      info += `\n  等级: ★${data.level}`
      info += `\n  ATK: ${data.attack} / DEF: ${data.defense}`
    }
  }
  
  return info
}

/**
 * 格式化卡组内容（带完整卡片信息）
 */
function formatDeckContent(deck, detailed = true) {
  if (!deck || deck.length === 0) return '(空)'
  
  const cardCounts = new Map()
  for (const code of deck) {
    const key = code
    if (!cardCounts.has(key)) {
      cardCounts.set(key, { code, count: 0 })
    }
    cardCounts.get(key).count++
  }
  
  const lines = []
  let idx = 1
  for (const [code, info] of cardCounts) {
    const data = cardDatabase.get(code)
    const name = data?.name || `#${code}`
    if (detailed) {
      lines.push(`${idx}. ${name} (${code}) x${info.count}`)
      lines.push(`   类型: ${getCardTypeDesc(data?.type || 0)}`)
    } else {
      lines.push(`${idx}. ${name} x${info.count}`)
    }
    idx++
  }
  
  return lines.join('\n')
}

/**
 * 获取当前场地快照
 */
function getFieldSnapshot() {
  const snapshot = {
    turn: duelInfo.turn,
    phase: getPhaseName(duelInfo.phase),
    currentPlayer: duelInfo.players[duelInfo.currentPlayer],
    players: []
  }
  
  for (let p = 0; p < 2; p++) {
    const player = {
      name: duelInfo.players[p],
      lp: duelInfo.lp[p],
      hand: field.players[p].hand.map(c => ({
        name: getCardName(c?.code),
        code: c?.code,
        position: getPositionName(c?.position)
      })),
      monsters: [],
      spellTraps: [],
      grave: field.players[p].grave.map(c => getCardName(c?.code)),
      removed: field.players[p].removed.map(c => getCardName(c?.code)),
      deckCount: field.players[p].deck,
      extraCount: field.players[p].extra
    }
    
    for (let i = 0; i < 7; i++) {
      const card = field.players[p].mzone[i]
      if (card) {
        player.monsters.push({
          zone: i < 5 ? `M${i+1}` : `EX${i-4}`,
          name: getCardName(card.code),
          code: card.code,
          position: getPositionName(card.position),
          attack: card.attack,
          defense: card.defense
        })
      }
    }
    
    for (let i = 0; i < 8; i++) {
      const card = field.players[p].szone[i]
      if (card) {
        player.spellTraps.push({
          zone: i < 5 ? `S${i+1}` : (i === 5 ? '场地' : (i === 6 ? '左P' : '右P')),
          name: getCardName(card.code),
          code: card.code,
          position: getPositionName(card.position)
        })
      }
    }
    
    snapshot.players.push(player)
  }
  
  return snapshot
}

/**
 * 导出完整对局记录
 */
function handleExportFullLog() {
  if (!isLoaded.value) {
    alert('请先加载回放文件')
    return
  }
  
  const lines = []
  const divider = '═'.repeat(60)
  const subDivider = '─'.repeat(60)
  
  // 标题
  lines.push(divider)
  lines.push('              YGO 完整对局记录导出')
  lines.push(`              导出时间: ${new Date().toLocaleString()}`)
  lines.push(divider)
  lines.push('')
  
  // ===== 基础信息 =====
  lines.push('【对局基础信息】')
  lines.push(subDivider)
  lines.push(`玩家1: ${duelInfo.players[0]}`)
  lines.push(`玩家2: ${duelInfo.players[1]}`)
  lines.push(`起始LP: ${replayParams?.startLP || 8000}`)
  lines.push(`起始手牌: ${replayParams?.startHand || 5}`)
  lines.push(`每回合抽卡: ${replayParams?.drawCount || 1}`)
  lines.push(`决斗规则: Master Rule ${duelInfo.duelRule}`)
  lines.push(`是否TAG对战: ${duelInfo.isTag ? '是' : '否'}`)
  if (replayHeader) {
    lines.push(`回放版本: 0x${replayHeader.version?.toString(16) || 'unknown'}`)
    lines.push(`录制时间: ${replayHeader.startTime ? new Date(replayHeader.startTime * 1000).toLocaleString() : '未知'}`)
  }
  lines.push('')
  
  // ===== 卡组信息 =====
  lines.push('【卡组信息】')
  lines.push(subDivider)
  
  for (let p = 0; p < replayDecks.length; p++) {
    const deck = replayDecks[p]
    const playerName = replayPlayers[p] || `玩家${p + 1}`
    
    lines.push('')
    lines.push(`▶ ${playerName} 的主卡组 (${deck.main.length}张):`)
    lines.push(subDivider)
    
    // 按类型分类卡片
    const monsters = []
    const spells = []
    const traps = []
    
    for (const code of deck.main) {
      const data = cardDatabase.get(code)
      const type = data?.type || 0
      const name = data?.name || `#${code}`
      const entry = { code, name, type, data }
      
      if (type & 0x1) monsters.push(entry)
      else if (type & 0x2) spells.push(entry)
      else if (type & 0x4) traps.push(entry)
      else monsters.push(entry) // 默认归类为怪兽
    }
    
    // 怪兽
    if (monsters.length > 0) {
      lines.push(`  【怪兽卡】(${monsters.length}张)`)
      const counted = countCards(monsters)
      for (const item of counted) {
        const typeStr = getCardTypeDesc(item.type)
        const attrStr = item.data ? getAttributeDesc(item.data.attribute) : ''
        const levelStr = item.data?.level || 0
        const atkDef = item.data ? `${item.data.attack}/${item.data.defense}` : ''
        lines.push(`    ${item.name} x${item.count}`)
        lines.push(`      [${typeStr}] ${attrStr} ★${levelStr} ${atkDef}`)
      }
    }
    
    // 魔法
    if (spells.length > 0) {
      lines.push(`  【魔法卡】(${spells.length}张)`)
      const counted = countCards(spells)
      for (const item of counted) {
        const typeStr = getCardTypeDesc(item.type)
        lines.push(`    ${item.name} x${item.count} [${typeStr}]`)
      }
    }
    
    // 陷阱
    if (traps.length > 0) {
      lines.push(`  【陷阱卡】(${traps.length}张)`)
      const counted = countCards(traps)
      for (const item of counted) {
        const typeStr = getCardTypeDesc(item.type)
        lines.push(`    ${item.name} x${item.count} [${typeStr}]`)
      }
    }
    
    // 额外卡组
    if (deck.extra && deck.extra.length > 0) {
      lines.push('')
      lines.push(`▶ ${playerName} 的额外卡组 (${deck.extra.length}张):`)
      lines.push(subDivider)
      
      const fusion = []
      const synchro = []
      const xyz = []
      const link = []
      
      for (const code of deck.extra) {
        const data = cardDatabase.get(code)
        const type = data?.type || 0
        const name = data?.name || `#${code}`
        const entry = { code, name, type, data }
        
        if (type & 0x4000000) link.push(entry)
        else if (type & 0x800000) xyz.push(entry)
        else if (type & 0x2000) synchro.push(entry)
        else fusion.push(entry)
      }
      
      if (fusion.length > 0) {
        lines.push(`  【融合怪兽】(${fusion.length}张)`)
        for (const item of countCards(fusion)) {
          lines.push(`    ${item.name} x${item.count}`)
        }
      }
      if (synchro.length > 0) {
        lines.push(`  【同调怪兽】(${synchro.length}张)`)
        for (const item of countCards(synchro)) {
          lines.push(`    ${item.name} x${item.count}`)
        }
      }
      if (xyz.length > 0) {
        lines.push(`  【超量怪兽】(${xyz.length}张)`)
        for (const item of countCards(xyz)) {
          lines.push(`    ${item.name} x${item.count}`)
        }
      }
      if (link.length > 0) {
        lines.push(`  【连接怪兽】(${link.length}张)`)
        for (const item of countCards(link)) {
          lines.push(`    ${item.name} x${item.count}`)
        }
      }
    }
  }
  
  lines.push('')
  
  // ===== 完整对局过程 =====
  lines.push(divider)
  lines.push('【完整对局过程】')
  lines.push(divider)
  lines.push('')
  
  // 按回合分组消息
  let currentTurn = 0
  let currentPhase = ''
  
  for (const msg of messages.value) {
    // 检测回合变化
    if (msg.type === MSG.NEW_TURN) {
      currentTurn++
      lines.push('')
      lines.push(subDivider)
      lines.push(`【回合 ${currentTurn}】${msg.desc}`)
      lines.push(subDivider)
      continue
    }
    
    // 检测阶段变化
    if (msg.type === MSG.NEW_PHASE) {
      currentPhase = msg.desc
      lines.push('')
      lines.push(`  ── ${msg.desc} ──`)
      continue
    }
    
    // 格式化消息内容
    let prefix = '    '
    let content = msg.desc
    
    // 根据消息类型添加特殊标记
    switch (msg.type) {
      case MSG.DRAW:
        prefix = '  📥 '
        break
      case MSG.SUMMONING:
      case MSG.SUMMONED:
        prefix = '  ⬆️ '
        break
      case MSG.SPSUMMONING:
      case MSG.SPSUMMONED:
        prefix = '  ⭐ '
        break
      case MSG.FLIPSUMMONING:
      case MSG.FLIPSUMMONED:
        prefix = '  🔄 '
        break
      case MSG.MOVE:
        prefix = '  → '
        break
      case MSG.CHAINING:
        prefix = '  ⛓️ '
        break
      case MSG.CHAINED:
      case MSG.CHAIN_SOLVING:
      case MSG.CHAIN_SOLVED:
        prefix = '  🔗 '
        break
      case MSG.CHAIN_END:
        prefix = '  ⛓️ '
        break
      case MSG.ATTACK:
        prefix = '  ⚔️ '
        break
      case MSG.BATTLE:
        prefix = '  💥 '
        break
      case MSG.DAMAGE:
        prefix = '  💔 '
        break
      case MSG.RECOVER:
        prefix = '  💚 '
        break
      case MSG.PAY_LPCOST:
        prefix = '  💸 '
        break
      case MSG.SELECT_CHAIN:
      case MSG.SELECT_CARD:
      case MSG.SELECT_OPTION:
      case MSG.SELECT_EFFECTYN:
      case MSG.SELECT_YESNO:
      case MSG.SELECT_POSITION:
      case MSG.SELECT_PLACE:
      case MSG.SELECT_IDLECMD:
      case MSG.SELECT_BATTLECMD:
        prefix = '  ❓ '
        break
      case MSG.WIN:
        prefix = '  🏆 '
        break
      case MSG.HINT:
        prefix = '  💡 '
        break
      case MSG.SET:
        prefix = '  ⬇️ '
        break
      case MSG.POS_CHANGE:
        prefix = '  🔃 '
        break
      case MSG.EQUIP:
        prefix = '  🔧 '
        break
      case MSG.TOSS_COIN:
      case MSG.TOSS_DICE:
        prefix = '  🎲 '
        break
      case MSG.ADD_COUNTER:
      case MSG.REMOVE_COUNTER:
        prefix = '  🔢 '
        break
      default:
        prefix = '    '
    }
    
    lines.push(`${prefix}[${msg.typeName}] ${content}`)
  }
  
  lines.push('')
  
  // ===== 当前场地状态 =====
  if (isStarted.value) {
    lines.push(divider)
    lines.push('【当前场地状态】')
    lines.push(divider)
    
    const snapshot = getFieldSnapshot()
    lines.push(`回合: ${snapshot.turn}`)
    lines.push(`阶段: ${snapshot.phase}`)
    lines.push(`当前行动玩家: ${snapshot.currentPlayer}`)
    lines.push('')
    
    for (let p = 0; p < 2; p++) {
      const player = snapshot.players[p]
      lines.push(`【${player.name}】 LP: ${player.lp}`)
      lines.push(`  卡组: ${player.deckCount}张 | 额外: ${player.extraCount}张`)
      
      if (player.hand.length > 0) {
        lines.push(`  手牌 (${player.hand.length}张):`)
        for (const c of player.hand) {
          lines.push(`    - ${c.name}`)
        }
      }
      
      if (player.monsters.length > 0) {
        lines.push(`  怪兽区:`)
        for (const m of player.monsters) {
          lines.push(`    [${m.zone}] ${m.name} (${m.position}) ATK:${m.attack}/DEF:${m.defense}`)
        }
      }
      
      if (player.spellTraps.length > 0) {
        lines.push(`  魔陷区:`)
        for (const s of player.spellTraps) {
          lines.push(`    [${s.zone}] ${s.name} (${s.position})`)
        }
      }
      
      if (player.grave.length > 0) {
        lines.push(`  墓地 (${player.grave.length}张): ${player.grave.slice(0, 5).join(', ')}${player.grave.length > 5 ? '...' : ''}`)
      }
      
      if (player.removed.length > 0) {
        lines.push(`  除外 (${player.removed.length}张): ${player.removed.slice(0, 5).join(', ')}${player.removed.length > 5 ? '...' : ''}`)
      }
      
      lines.push('')
    }
  }
  
  // ===== 响应记录 =====
  lines.push(divider)
  lines.push('【响应记录统计】')
  lines.push(divider)
  lines.push(`总响应数: ${responses.value.length}`)
  lines.push(`已处理: ${responseIndex.value}`)
  lines.push('')
  
  // ===== 结束 =====
  lines.push(divider)
  lines.push('              对局记录导出完成')
  lines.push(divider)
  
  // 下载文件
  const content = lines.join('\n')
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const player1 = (duelInfo.players[0] || 'P1').replace(/[\\/:*?"<>|]/g, '_')
  const player2 = (duelInfo.players[1] || 'P2').replace(/[\\/:*?"<>|]/g, '_')
  a.download = `YGO_对局记录_${player1}_vs_${player2}_${timestamp}.txt`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  
  console.log('[Export] 对局记录已导出，共', lines.length, '行')
}

/**
 * 导出Combo路线图
 */
function handleExportComboTree() {
  const entriesToExport = currentTreeEntries.value
  if (entriesToExport.length === 0) {
    alert('暂无Combo数据可导出')
    return
  }
  
  const currentTree = comboTrees.value[currentTreeIndex.value]
  const treeName = currentTree?.name || '总因果树'
  
  const lines = []
  const divider = '═'.repeat(60)
  const subDivider = '─'.repeat(60)
  
  // 标题
  lines.push(divider)
  lines.push('              YGO Combo 路线图导出')
  lines.push(`              因果树: ${treeName}`)
  lines.push(`              导出时间: ${new Date().toLocaleString()}`)
  lines.push(divider)
  lines.push('')
  
  // 对局信息
  lines.push('【对局信息】')
  lines.push(subDivider)
  lines.push(`玩家1: ${duelInfo.players[0]}`)
  lines.push(`玩家2: ${duelInfo.players[1]}`)
  lines.push(`当前回合: ${duelInfo.turn}`)
  lines.push(`Combo节点数: ${entriesToExport.length}`)
  lines.push('')
  
  // 按回合分组
  const turnGroups = new Map()
  for (const entry of entriesToExport) {
    const turn = entry.turn || 1
    if (!turnGroups.has(turn)) {
      turnGroups.set(turn, [])
    }
    turnGroups.get(turn).push(entry)
  }
  
  // 导出每个回合的Combo
  for (const [turn, entries] of turnGroups) {
    lines.push(divider)
    lines.push(`【回合 ${turn} Combo路线】`)
    lines.push(divider)
    lines.push('')
    
    // 文字流程图
    lines.push('▶ 流程图:')
    lines.push('')
    
    let prevEntry = null
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i]
      const indent = '  '.repeat(Math.min(entry.depth || 0, 5))
      
      // 类型图标
      const typeIcons = {
        'SUMMON': '⬆️ [通召]',
        'SPSUMMON': '⭐ [特召]',
        'CHAIN': '⛓️ [发动]',
        'MOVE': '→ [移动]'
      }
      const typeIcon = typeIcons[entry.type] || '● '
      
      // 连接线
      if (i > 0) {
        if (entry.depth > 0) {
          lines.push(`${indent}    │`)
          lines.push(`${indent}    ▼`)
        } else {
          lines.push('    │')
          lines.push('    ▼')
        }
      }
      
      // 卡片节点
      const cardData = cardDatabase.get(entry.cardCode)
      const cardInfo = cardData ? ` [${getCardTypeDesc(cardData.type)}]` : ''
      lines.push(`${indent}${typeIcon} 【${entry.cardName}】(${entry.cardCode})${cardInfo}`)
      lines.push(`${indent}    └─ ${entry.detail}`)
      
      prevEntry = entry
    }
    
    lines.push('')
    
    // 详细列表
    lines.push('▶ 详细列表:')
    lines.push(subDivider)
    
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i]
      const cardData = cardDatabase.get(entry.cardCode)
      
      lines.push(`${i + 1}. 【${entry.cardName}】`)
      lines.push(`   代码: ${entry.cardCode}`)
      lines.push(`   动作: ${entry.type} - ${entry.detail}`)
      lines.push(`   步骤: ${entry.step}`)
      if (entry.depth > 0) {
        lines.push(`   连锁深度: ${entry.depth}`)
      }
      if (entry.fromCardCode) {
        const fromName = getCardName(entry.fromCardCode)
        lines.push(`   来源卡片: ${fromName} (${entry.fromCardCode})`)
      }
      if (cardData) {
        lines.push(`   卡片类型: ${getCardTypeDesc(cardData.type)}`)
        if (cardData.type & 0x1) { // 怪兽
          lines.push(`   ATK/DEF: ${cardData.attack}/${cardData.defense}`)
        }
      }
      lines.push('')
    }
  }
  
  // 统计信息
  lines.push(divider)
  lines.push('【Combo统计】')
  lines.push(divider)
  
  const stats = {
    summon: 0,
    spSummon: 0,
    chain: 0,
    move: 0
  }
  const usedCards = new Map()
  
  for (const entry of comboTreeEntries.value) {
    switch (entry.type) {
      case 'SUMMON': stats.summon++; break
      case 'SPSUMMON': stats.spSummon++; break
      case 'CHAIN': stats.chain++; break
      case 'MOVE': stats.move++; break
    }
    
    if (!usedCards.has(entry.cardCode)) {
      usedCards.set(entry.cardCode, { name: entry.cardName, count: 0, types: [] })
    }
    usedCards.get(entry.cardCode).count++
    if (!usedCards.get(entry.cardCode).types.includes(entry.type)) {
      usedCards.get(entry.cardCode).types.push(entry.type)
    }
  }
  
  lines.push(`通常召唤: ${stats.summon}次`)
  lines.push(`特殊召唤: ${stats.spSummon}次`)
  lines.push(`效果发动: ${stats.chain}次`)
  lines.push(`卡片移动: ${stats.move}次`)
  lines.push(`总计动作: ${comboTreeEntries.value.length}次`)
  lines.push('')
  
  lines.push('▶ 使用卡片:')
  for (const [code, info] of usedCards) {
    lines.push(`  - ${info.name} (${code}): ${info.count}次 [${info.types.join(', ')}]`)
  }
  
  lines.push('')
  lines.push(divider)
  lines.push('              Combo路线图导出完成')
  lines.push(divider)
  
  // 下载文件
  const content = lines.join('\n')
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const player1 = (duelInfo.players[0] || 'P1').replace(/[\\/:*?"<>|]/g, '_')
  const player2 = (duelInfo.players[1] || 'P2').replace(/[\\/:*?"<>|]/g, '_')
  a.download = `YGO_Combo_${player1}_vs_${player2}_Turn${duelInfo.turn}_${timestamp}.txt`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  
  console.log('[Export] Combo路线图已导出，共', comboTreeEntries.value.length, '个节点')
}

/**
 * 辅助函数：统计卡片数量
 */
function countCards(cards) {
  const map = new Map()
  for (const card of cards) {
    const key = card.code
    if (!map.has(key)) {
      map.set(key, { ...card, count: 0 })
    }
    map.get(key).count++
  }
  return Array.from(map.values())
}

// ========== 初始化 ==========

async function initialize() {
  isLoading.value = true

  try {
    // 1. 加载卡片数据库
    await loadCardDatabase()

    // 2. 预加载核心脚本
    await preloadScripts()

    // 3. 尝试加载 OCGCore WASM (可选)
    try {
      await loadOCGCore()
    } catch (e) {
      console.warn('[Init] OCGCore 加载失败，将使用模拟模式:', e)
    }

    loadingProgress.value = 100
    loadingStatus.value = '初始化完成'
  } catch (e) {
    console.error('[Init] 初始化失败:', e)
    error.value = '初始化失败: ' + e.message
  } finally {
    isLoading.value = false
  }
}

// ========== 生命周期 ==========

onMounted(() => {
  console.log('[ReplayModePlayer] Mounted')
  initialize()
  
  // 添加点击外部关闭解说员选择器
  document.addEventListener('click', handleCommentatorClickOutside)
})

onUnmounted(() => {
  console.log('[ReplayModePlayer] Unmounted')
  stopReplay(true)

  // 清理 OCGCore
  if (ocgModule && pduel) {
    try {
      ocgModule._end_duel(pduel)
    } catch (e) {
      // ignore
    }
    pduel = null
  }

  // 清理数据库
  if (sqlDb) {
    sqlDb.close()
    sqlDb = null
  }
  
  // 移除事件监听
  document.removeEventListener('click', handleCommentatorClickOutside)
})
</script>

<style scoped>
/* ========== 基础布局 ========== */
.replay-mode-player {
  width: 100%;
  height: 100vh;
  background: #f5f5f5;
  font-family: 'Microsoft YaHei', 'SimHei', sans-serif;
  overflow: hidden;
}

.main-container {
  display: flex;
  height: 100%;
  gap: 8px;
  padding: 8px;
  box-sizing: border-box;
}

/* ========== 加载界面 ========== */
.loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.loading-content {
  text-align: center;
  color: #fff;
}

.loading-spinner {
  width: 50px;
  height: 50px;
  border: 4px solid #333;
  border-top: 4px solid #ffd700;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 20px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.loading-status {
  font-size: 18px;
  margin-bottom: 15px;
}

.loading-progress {
  width: 300px;
  height: 8px;
  background: #333;
  border-radius: 4px;
  overflow: hidden;
  margin: 0 auto 10px;
}

.progress-bar {
  height: 100%;
  background: linear-gradient(90deg, #ffd700, #ff8c00);
  transition: width 0.3s;
}

.loading-text {
  font-size: 14px;
  color: #aaa;
}

/* ========== 左侧面板 ========== */
.left-panel {
  width: 160px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex-shrink: 0;
}

.player-info-panel {
  background: #fff;
  border: 2px solid #333;
  border-radius: 4px;
  padding: 8px;
  text-align: center;
}

.player-info-panel .player-name {
  font-weight: bold;
  font-size: 14px;
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.player-info-panel .player-lp {
  font-size: 16px;
  font-weight: bold;
  color: #2196f3;
}

.player-info-panel .player-lp.low {
  color: #f44336;
}

.opponent-info {
  border-color: #e74c3c;
}

.self-info {
  border-color: #3498db;
}

.turn-info-panel {
  background: #333;
  color: #fff;
  border-radius: 4px;
  padding: 8px;
  text-align: center;
}

.turn-info-panel .turn-number {
  font-size: 16px;
  font-weight: bold;
  color: #ffd700;
}

.turn-info-panel .phase-name {
  font-size: 12px;
  color: #aaa;
  margin-top: 4px;
}

.control-buttons {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.ctrl-btn {
  padding: 6px 8px;
  font-size: 12px;
  border: 1px solid #333;
  border-radius: 4px;
  background: #fff;
  cursor: pointer;
  transition: all 0.2s;
}

.ctrl-btn:hover:not(:disabled) {
  background: #e0e0e0;
}

.ctrl-btn:disabled {
  opacity: 0.5;
}

.ctrl-btn.back-btn {
  background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
  color: #fff;
  border: 1px solid #d4af37;
  font-weight: 600;
}

.ctrl-btn.back-btn:hover {
  background: linear-gradient(135deg, #334155 0%, #475569 100%);
  
}

.ctrl-btn.export-btn {
  background: linear-gradient(135deg, #059669 0%, #10b981 100%);
  color: #fff;
  border: 1px solid #047857;
  font-weight: 600;
}

.ctrl-btn.export-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, #047857 0%, #059669 100%);
  box-shadow: 0 2px 8px rgba(5, 150, 105, 0.4);
}

.ctrl-btn.combo-btn {
  background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%);
  color: #fff;
  border: 1px solid #6d28d9;
  font-weight: 600;
}

.ctrl-btn.combo-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, #6d28d9 0%, #7c3aed 100%);
  box-shadow: 0 2px 8px rgba(124, 58, 237, 0.4);
}

.ctrl-btn.combo-panel-btn {
  background: linear-gradient(135deg, #e94560 0%, #f06292 100%);
  color: #fff;
  border: 1px solid #c62828;
  font-weight: 600;
}

.ctrl-btn.combo-panel-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, #c62828 0%, #e94560 100%);
  box-shadow: 0 2px 8px rgba(233, 69, 96, 0.4);
}

.speed-control {
  background: #fff;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 8px;
  font-size: 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.speed-control input[type="range"] {
  width: 100%;
}

.status-info {
  background: #fff;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 8px;
  font-size: 11px;
}

.status-info div {
  margin-bottom: 2px;
}

.status-paused {
  color: #ff9800;
  font-weight: bold;
}

/* ========== 书签按钮样式 ========== */
.ctrl-btn.bookmark-btn {
  background: linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%);
  color: #fff;
  border: 1px solid #d97706;
  font-weight: 600;
}

.ctrl-btn.bookmark-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, #d97706 0%, #f59e0b 100%);
  box-shadow: 0 2px 8px rgba(245, 158, 11, 0.4);
}

.ctrl-btn.bookmark-panel-btn {
  background: linear-gradient(135deg, #0ea5e9 0%, #38bdf8 100%);
  color: #fff;
  border: 1px solid #0284c7;
  font-weight: 600;
  position: relative;
}

.ctrl-btn.bookmark-panel-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, #0284c7 0%, #0ea5e9 100%);
  box-shadow: 0 2px 8px rgba(14, 165, 233, 0.4);
}

.ctrl-btn.bookmark-panel-btn.active {
  background: linear-gradient(135deg, #0369a1 0%, #0284c7 100%);
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.2);
}

.bookmark-count {
  display: inline-block;
  background: rgba(255, 255, 255, 0.3);
  padding: 1px 6px;
  border-radius: 10px;
  font-size: 10px;
  margin-left: 3px;
}

/* ========== 书签面板样式 ========== */
.bookmarks-panel {
  background: #fff;
  border: 2px solid #0ea5e9;
  border-radius: 6px;
  overflow: hidden;
  max-height: 300px;
  display: flex;
  flex-direction: column;
}

.bookmarks-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 10px;
  background: linear-gradient(135deg, #0ea5e9 0%, #38bdf8 100%);
  color: #fff;
}

.bookmarks-title {
  font-weight: bold;
  font-size: 13px;
}

.clear-bookmarks-btn {
  background: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.4);
  color: #fff;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.2s;
}

.clear-bookmarks-btn:hover {
  background: rgba(255, 255, 255, 0.3);
  border-color: #fff;
}

.bookmarks-header-actions {
  display: flex;
  gap: 6px;
  align-items: center;
}

.auto-bookmark-toggle {
  background: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.4);
  color: #fff;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 10px;
  cursor: pointer;
  transition: all 0.2s;
}

.auto-bookmark-toggle:hover {
  background: rgba(255, 255, 255, 0.3);
}

.auto-bookmark-toggle.active {
  background: rgba(16, 185, 129, 0.6);
  border-color: #10b981;
}

/* 自动书签设置面板 */
.auto-bookmark-settings {
  background: #f0f9ff;
  border-bottom: 1px solid #e0f2fe;
  padding: 8px 10px;
}

.auto-bookmark-settings .settings-title {
  font-size: 11px;
  font-weight: bold;
  color: #0369a1;
  margin-bottom: 6px;
}

.auto-bookmark-settings .settings-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
}

.auto-bookmark-settings .setting-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  color: #334155;
  cursor: pointer;
}

.auto-bookmark-settings .setting-item:hover {
  color: #0ea5e9;
}

.auto-bookmark-settings .setting-item input[type="checkbox"] {
  width: 12px;
  height: 12px;
  cursor: pointer;
}

/* 自动书签标记 */
.bookmark-item.auto-bookmark {
  border-left: 3px solid #10b981;
}

.bookmark-item .auto-badge {
  background: #10b981;
  color: #fff;
  font-size: 8px;
  padding: 1px 4px;
  border-radius: 3px;
  margin-left: 4px;
}

.bookmarks-list {
  flex: 1;
  overflow-y: auto;
  padding: 4px;
}

.bookmark-item {
  position: relative;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 8px 10px;
  margin-bottom: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.bookmark-item:hover {
  background: #e0f2fe;
  border-color: #0ea5e9;
  box-shadow: 0 2px 6px rgba(14, 165, 233, 0.2);
}

.bookmark-item:last-child {
  margin-bottom: 0;
}

.bookmark-main {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.bookmark-turn-phase {
  display: flex;
  gap: 6px;
  align-items: center;
}

.bookmark-turn {
  background: linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%);
  color: #fff;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: bold;
}

.bookmark-phase {
  color: #64748b;
  font-size: 11px;
}

.bookmark-lp {
  display: flex;
  gap: 3px;
  align-items: center;
  font-size: 10px;
}

.lp-self {
  color: #3b82f6;
  font-weight: bold;
}

.lp-opp {
  color: #ef4444;
  font-weight: bold;
}

.lp-divider {
  color: #94a3b8;
}

.bookmark-note-row {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 4px;
}

.bookmark-note {
  flex: 1;
  font-size: 11px;
  color: #334155;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bookmark-note.empty {
  color: #94a3b8;
  font-style: italic;
}

.bookmark-note-input {
  flex: 1;
  padding: 3px 6px;
  border: 1px solid #0ea5e9;
  border-radius: 4px;
  font-size: 11px;
  outline: none;
}

.bookmark-note-input:focus {
  box-shadow: 0 0 0 2px rgba(14, 165, 233, 0.2);
}

.note-edit-btn,
.note-save-btn,
.note-cancel-btn {
  padding: 2px 6px;
  border: none;
  border-radius: 3px;
  font-size: 10px;
  cursor: pointer;
  transition: all 0.2s;
}

.note-edit-btn {
  background: #e2e8f0;
  color: #475569;
}

.note-edit-btn:hover {
  background: #cbd5e1;
}

.note-save-btn {
  background: #10b981;
  color: #fff;
}

.note-save-btn:hover {
  background: #059669;
}

.note-cancel-btn {
  background: #f1f5f9;
  color: #64748b;
}

.note-cancel-btn:hover {
  background: #e2e8f0;
}

.bookmark-field-summary {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 10px;
  color: #64748b;
}

.field-monsters {
  color: #7c3aed;
}

.field-step {
  color: #94a3b8;
}

.bookmark-delete-btn {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 18px;
  height: 18px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: #fee2e2;
  color: #ef4444;
  font-size: 12px;
  cursor: pointer;
  opacity: 0;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.bookmark-item:hover .bookmark-delete-btn {
  opacity: 1;
}

.bookmark-delete-btn:hover {
  background: #fecaca;
  color: #dc2626;
}

.bookmarks-empty {
  padding: 20px;
  text-align: center;
  color: #94a3b8;
}

.empty-icon {
  font-size: 28px;
  margin-bottom: 8px;
}

.empty-text {
  font-size: 13px;
  font-weight: 500;
  margin-bottom: 4px;
}

.empty-hint {
  font-size: 11px;
  color: #cbd5e1;
}

/* ========== 中央决斗场地 ========== */
.duel-field-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: #e8e8e8;
  border-radius: 8px;
  gap: 8px;
  padding: 8px 0;
  position: relative;
}

/* ========== Combo预览模式横幅 ========== */
.combo-preview-banner {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1002;
  background: linear-gradient(135deg, #ff6b6b 0%, #e94560 100%);
  color: white;
  padding: 8px 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  font-size: 14px;
  font-weight: bold;
  box-shadow: 0 2px 8px rgba(233, 69, 96, 0.4);
  animation: previewBannerPulse 2s ease-in-out infinite;
}

@keyframes previewBannerPulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.85; }
}

.combo-preview-banner .preview-icon {
  font-size: 18px;
}

.combo-preview-banner .preview-text {
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}

.combo-preview-banner .exit-preview-btn {
  background: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.4);
  color: white;
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s ease;
}

.combo-preview-banner .exit-preview-btn:hover {
  background: rgba(255, 255, 255, 0.3);
  border-color: white;
}

/* 预览模式下的场地样式 */
.duel-field.preview-mode {
  border-color: #e94560;
  box-shadow: 0 0 20px rgba(233, 69, 96, 0.3), 0 4px 20px rgba(0, 0, 0, 0.15);
}

.duel-field {
  position: relative;
  width: 640px;
  height: 720px;
  background: #ffffff;
  border: 3px solid #1a1a1a;
  padding: 12px;
  box-sizing: border-box;
  border-radius: 6px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
}

/* ========== 场地行布局 ========== */
.field-row {
  display: flex;
  justify-content: center;
  gap: 2px;
  margin-bottom: 2px;
}

.zone-cell {
  position: relative;
  width: 70px;
  height: 85px;
}

/* ========== 区域盒子样式 ========== */
.zone-box {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  cursor: pointer;
  transition: all 0.15s;
  position: relative;
  border-radius: 3px;
}

.zone-box.dashed {
  border: 2px dashed #1a1a1a;
  background: #fff;
}

.zone-box.solid {
  border: 2px solid #1a1a1a;
  background: #fff;
}

.zone-box:hover {
  background: #f5f5f5;
  box-shadow: 0 0 8px rgba(0, 0, 0, 0.15);
}

.zone-box.occupied {
  border-color: #1565c0;
  background: #e3f2fd;
  box-shadow: 0 0 5px rgba(21, 101, 192, 0.3);
}

.zone-label {
  font-size: 12px;
  color: #1a1a1a;
  text-align: center;
  line-height: 1.4;
  user-select: none;
  font-weight: 500;
}

.zone-count {
  position: absolute;
  bottom: 3px;
  right: 3px;
  font-size: 11px;
  font-weight: bold;
  color: #fff;
  background: #1a1a1a;
  padding: 2px 5px;
  border-radius: 3px;
  min-width: 16px;
  text-align: center;
}

/* ========== 卡组/墓地/除外区 卡背显示 ========== */
.deck-zone {
  padding: 0;
  overflow: hidden;
}

.deck-back-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  border-radius: 3px;
}

.deck-count {
  position: absolute;
  bottom: 4px;
  right: 4px;
  font-size: 12px;
  background: rgba(0, 0, 0, 0.8);
  padding: 2px 6px;
  border-radius: 4px;
  z-index: 1;
}

/* 额外卡组卡背紫色调 */
.extra-zone .deck-back-img {
  filter: hue-rotate(240deg) saturate(1.2);
}

/* 墓地无卡时灰暗效果 */
.gy-zone:not(.has-card) .deck-back-img {
  filter: grayscale(0.5) brightness(0.8);
}

/* 除外区无卡时褐色效果 */
.banished-img {
  filter: sepia(0.5) brightness(0.9);
  opacity: 0.7;
}

/* ========== 特殊区域定位 ========== */
.empty-cell {
  visibility: hidden;
}

.empty-spacer {
  flex: 1;
}


.opponent-banished {
  position: absolute;
  left: 65px;
  top: 260px;
  width: 70px;
  height: 85px;
}


.self-field-spell {
  position: absolute;
  left: 65px;
  bottom: 255px;
  width: 70px;
  height: 85px;
}


.self-banished {
  position: absolute;
  right: 65px;
  bottom: 255px;
  width: 70px;
  height: 85px;
}

.banished-box {
  border-style: dashed !important;
}

/* ========== 额外怪兽区 ========== */
.extra-monster-zones-center {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  gap: 60px;
  justify-content: center;
}

.emz-cell {
  width: 70px;
  height: 85px;
}


.field-spell-zone {
  position: absolute;
  width: 70px;
  height: 85px;
}

.opp-field-spell {
  right: 65px ;
  top: 260px;
}

/* ========== 卡片在区域中的显示 ========== */
.card-in-zone {
  width: 100%;
  height: 100%;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.card-in-zone .card-img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  border-radius: 3px;
}

.card-in-zone.facedown .card-img {
  filter: brightness(0.7);
}

.card-in-zone.defense {
  transform: rotate(90deg);
}

.card-in-zone.defense .card-img {
  max-width: 85px;
  max-height: 70px;
}

.atk-display {
  position: absolute;
  bottom: 2px;
  left: 2px;
  font-size: 10px;
  font-weight: bold;
  color: #fff;
  background: rgba(0, 0, 0, 0.7);
  padding: 1px 4px;
  border-radius: 2px;
}

/* ========== 手牌区域 ========== */
.hand-area {
  display: flex;
  gap: 4px;
  padding: 5px 15px;
  background: #fff;
  border: 2px dashed #1a1a1a;
  border-radius: 4px;
  min-height: 45px;
  min-width: 300px;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.opponent-hand {
  order: -1;
}

.self-hand {
  order: 1;
}

.hand-card {
  width: 45px;
  height: 65px;
  cursor: pointer;
  transition: transform 0.2s;
  border-radius: 3px;
  overflow: hidden;
}

.hand-card:hover {
  transform: translateY(-5px);
  z-index: 10;
}

.hand-card .card-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.hand-card.facedown .card-img {
  filter: brightness(0.7);
}

.hand-empty {
  font-size: 12px;
  color: #999;
}

/* ========== 行位置调整 ========== */
.opponent-row-1 {
  margin-top: 70px;
}

.opponent-row-2 {
  margin-top: 4px;
}

.self-row-1 {
  position: absolute;
  bottom: 162px;
  left: 50%;
  transform: translateX(-50%);
}

.self-row-2 {
  position: absolute;
  bottom: 70px;
  left: 50%;
  transform: translateX(-50%);
}

/* ========== Combo路线图面板 - 可拖动浮动弹窗 ========== */
/* z-index 层级说明：
   - 500: combo面板（可与场地交互）
   - 1000: 加载界面
   - 1001: 错误提示
   - 1500: 区域查看弹窗（墓地、除外等）
   - 2000: 卡片详情弹窗（最高优先级）
*/
.combo-flowchart-panel {
  position: fixed;
  display: flex;
  flex-direction: column;
  background: linear-gradient(180deg, #1a1a2e 0%, #16213e 100%);
  border: 2px solid #0f3460;
  border-radius: 8px;
  overflow: visible;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.05);
  z-index: 500;
  pointer-events: auto;
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
}

.combo-flowchart-panel.is-dragging {
  opacity: 0.9;
  cursor: grabbing;
  box-shadow: 0 12px 48px rgba(0, 0, 0, 0.6);
}

/* 调整大小手柄 */
.resize-handle {
  position: absolute;
  z-index: 10;
}

.resize-n {
  top: -4px;
  left: 10px;
  right: 10px;
  height: 8px;
  cursor: ns-resize;
}

.resize-s {
  bottom: -4px;
  left: 10px;
  right: 10px;
  height: 8px;
  cursor: ns-resize;
}

.resize-e {
  right: -4px;
  top: 10px;
  bottom: 10px;
  width: 8px;
  cursor: ew-resize;
}

.resize-w {
  left: -4px;
  top: 10px;
  bottom: 10px;
  width: 8px;
  cursor: ew-resize;
}

.resize-ne {
  top: -4px;
  right: -4px;
  width: 14px;
  height: 14px;
  cursor: nesw-resize;
}

.resize-nw {
  top: -4px;
  left: -4px;
  width: 14px;
  height: 14px;
  cursor: nwse-resize;
}

.resize-se {
  bottom: -4px;
  right: -4px;
  width: 14px;
  height: 14px;
  cursor: nwse-resize;
}

.resize-sw {
  bottom: -4px;
  left: -4px;
  width: 14px;
  height: 14px;
  cursor: nesw-resize;
}

.resize-handle:hover {
  background: rgba(233, 69, 96, 0.3);
  border-radius: 2px;
}

.combo-flowchart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: linear-gradient(135deg, #0f3460 0%, #1a1a2e 100%);
  border-bottom: 1px solid #0f3460;
  cursor: grab;
  user-select: none;
}

.combo-flowchart-header:active {
  cursor: grabbing;
}

.combo-flowchart-left {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
  flex-wrap: wrap;
}

.combo-flowchart-title {
  font-weight: bold;
  font-size: 16px;
  color: #ff6b8a;
  text-shadow: 0 0 12px rgba(255, 107, 138, 0.6), 0 1px 2px rgba(0, 0, 0, 0.5);
  white-space: nowrap;
  letter-spacing: 0.5px;
}

.combo-flowchart-controls {
  display: flex;
  align-items: center;
  gap: 6px;
}

.gap-control {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 2px 8px;
  background: rgba(15, 52, 96, 0.5);
  border-radius: 4px;
  border: 1px solid #0f3460;
}

.gap-label {
  font-size: 11px;
  color: #8892b0;
  white-space: nowrap;
}

.gap-slider {
  width: 60px;
  height: 4px;
  -webkit-appearance: none;
  appearance: none;
  background: #1a1a2e;
  border-radius: 2px;
  outline: none;
  cursor: pointer;
}

.gap-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 12px;
  height: 12px;
  background: #e94560;
  border-radius: 50%;
  cursor: pointer;
  transition: transform 0.15s;
}

.gap-slider::-webkit-slider-thumb:hover {
  transform: scale(1.2);
}

.gap-slider::-moz-range-thumb {
  width: 12px;
  height: 12px;
  background: #e94560;
  border-radius: 50%;
  cursor: pointer;
  border: none;
}

.gap-value {
  font-size: 11px;
  color: #e94560;
  min-width: 24px;
  text-align: center;
  font-family: 'JetBrains Mono', monospace;
}

.control-divider {
  width: 1px;
  height: 16px;
  background: #0f3460;
  margin: 0 4px;
}

.zoom-btn {
  width: 22px;
  height: 22px;
  border: 1px solid #0f3460;
  background: #1a1a2e;
  color: #e94560;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}

.zoom-btn:hover {
  background: #0f3460;
  border-color: #e94560;
}

.optimize-flowchart-btn {
  width: 26px;
  height: 22px;
  border: 1px solid #ffc107;
  background: transparent;
  color: #ffc107;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
  margin-left: 8px;
}

.optimize-flowchart-btn:hover {
  background: rgba(255, 193, 7, 0.2);
}

.optimize-flowchart-btn.active {
  background: #ffc107;
  color: #1a1a2e;
}

.export-flowchart-btn {
  width: 26px;
  height: 22px;
  border: 1px solid #17a2b8;
  background: transparent;
  color: #17a2b8;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
  margin-left: 8px;
}

.export-flowchart-btn:hover {
  background: #17a2b8;
  color: #fff;
}

.close-panel-btn {
  width: 22px;
  height: 22px;
  border: 1px solid #e94560;
  background: transparent;
  color: #e94560;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
  margin-left: 8px;
}

.close-panel-btn:hover {
  background: #e94560;
  color: #fff;
}

.zoom-level {
  color: #6c757d;
  font-size: 11px;
  min-width: 35px;
  text-align: center;
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 4px;
  transition: all 0.15s;
}

.zoom-level:hover {
  background: rgba(233, 69, 96, 0.2);
  color: #e94560;
}

.fit-btn {
  width: 22px;
  height: 22px;
  border: 1px solid #28a745;
  background: transparent;
  color: #28a745;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
  margin-left: 4px;
}

.fit-btn:hover {
  background: #28a745;
  color: #fff;
}

.zoom-hint {
  font-size: 12px;
  color: #a8d8ff;
  white-space: nowrap;
  opacity: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 500px;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
  font-weight: 500;
}

/* ==================== 多因果树切换器样式 ==================== */
.combo-tree-switcher {
  position: relative;
  z-index: 10;
}

.tree-selector {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  background: rgba(15, 52, 96, 0.8);
  border: 1px solid #0f3460;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  min-width: 140px;
}

.tree-selector:hover {
  background: rgba(15, 52, 96, 1);
  border-color: #e94560;
}

.tree-icon {
  font-size: 14px;
}

.tree-name {
  font-size: 12px;
  color: #fff;
  font-weight: 500;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tree-count {
  font-size: 10px;
  color: #6c757d;
}

.dropdown-arrow {
  font-size: 8px;
  color: #6c757d;
  margin-left: auto;
  transition: transform 0.2s;
}

.tree-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  min-width: 200px;
  background: #1a1a2e;
  border: 1px solid #0f3460;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  margin-top: 4px;
  overflow: hidden;
  z-index: 100;
}

.tree-option {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  cursor: pointer;
  transition: all 0.15s;
}

.tree-option:hover {
  background: rgba(233, 69, 96, 0.15);
}

.tree-option.active {
  background: rgba(233, 69, 96, 0.25);
  border-left: 3px solid #e94560;
}

.tree-option.is-total {
  background: rgba(23, 162, 184, 0.1);
}

.tree-option.is-total.active {
  background: rgba(23, 162, 184, 0.25);
  border-left-color: #17a2b8;
}

/* 初动点因果树样式（从手牌发起） */
.tree-option.is-starter {
  background: rgba(255, 152, 0, 0.1);
}

.tree-option.is-starter.active {
  background: rgba(255, 152, 0, 0.25);
  border-left-color: #ff9800;
}

.tree-option.is-starter .tree-option-name {
  color: #ffcc80;
}

/* 动点因果树样式（连锁1非手牌） */
.tree-option.is-action {
  background: rgba(0, 188, 212, 0.1);
}

.tree-option.is-action.active {
  background: rgba(0, 188, 212, 0.25);
  border-left-color: #00bcd4;
}

.tree-option.is-action .tree-option-name {
  color: #80deea;
}

.tree-option-icon {
  font-size: 14px;
}

.tree-option-name {
  font-size: 12px;
  color: #fff;
  flex: 1;
}

.tree-option-count {
  font-size: 10px;
  color: #6c757d;
}

.tree-dropdown-divider {
  height: 1px;
  background: #0f3460;
  margin: 4px 0;
}

.tree-option.tree-action {
  color: #28a745;
}

.tree-option.tree-action:hover {
  background: rgba(40, 167, 69, 0.2);
}

.tree-option.tree-action .tree-option-name {
  color: #28a745;
}

/* 因果树操作按钮 */
.combo-tree-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.tree-action-btn {
  width: 24px;
  height: 24px;
  border: 1px solid #0f3460;
  background: transparent;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}

.tree-action-btn:hover {
  background: rgba(15, 52, 96, 0.8);
  border-color: #ffc107;
}

.tree-action-btn.tree-delete-btn:hover {
  border-color: #dc3545;
  background: rgba(220, 53, 69, 0.2);
}

/* 重命名对话框 */
.tree-rename-dialog {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: #1a1a2e;
  border: 2px solid #e94560;
  border-radius: 12px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
  z-index: 1010;
  padding: 20px;
  min-width: 280px;
}

.rename-dialog-content {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.rename-dialog-title {
  font-size: 14px;
  font-weight: bold;
  color: #e94560;
  text-align: center;
}

.rename-input {
  padding: 10px 12px;
  background: #0f3460;
  border: 1px solid #17a2b8;
  border-radius: 6px;
  color: #fff;
  font-size: 13px;
  outline: none;
  transition: border-color 0.2s;
}

.rename-input:focus {
  border-color: #e94560;
}

.rename-dialog-buttons {
  display: flex;
  justify-content: center;
  gap: 10px;
}

.rename-btn {
  padding: 8px 20px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  transition: all 0.15s;
  border: none;
}

.rename-cancel {
  background: #6c757d;
  color: #fff;
}

.rename-cancel:hover {
  background: #5a6268;
}

.rename-save {
  background: #e94560;
  color: #fff;
}

.rename-save:hover {
  background: #d63652;
}

.combo-flowchart-container {
  flex: 1;
  overflow: auto;
  padding: 10px;
  scrollbar-width: thin;
  scrollbar-color: #0f3460 #1a1a2e;
  cursor: grab;
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
}

.combo-flowchart-container.is-panning {
  cursor: grabbing;
  user-select: none;
}

.combo-flowchart-container::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.combo-flowchart-container::-webkit-scrollbar-track {
  background: #1a1a2e;
}

.combo-flowchart-container::-webkit-scrollbar-thumb {
  background: #0f3460;
  border-radius: 4px;
}

.combo-flowchart-container::-webkit-scrollbar-corner {
  background: #1a1a2e;
}

.combo-flowchart-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: #4a5568;
}

.combo-flowchart-empty .empty-icon {
  font-size: 48px;
  margin-bottom: 15px;
  opacity: 0.5;
}

.combo-flowchart-empty .empty-text {
  font-size: 13px;
  font-style: italic;
}

.combo-flowchart-canvas {
  position: relative;
  min-width: 100%;
  min-height: 100%;
  transform-origin: top left;
  transition: transform 0.2s ease;
}

.combo-connections-svg {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
  z-index: 1;
}

.connection-label {
  font-size: 11px;
  font-weight: bold;
  fill: #ffffff;
  text-anchor: middle;
  dominant-baseline: auto;
  filter: drop-shadow(0 0 2px #000) drop-shadow(0 0 4px #000) drop-shadow(0 0 6px #1a1a2e);
}

/* 卡片节点样式 */
.combo-card-node {
  position: absolute;
  width: 60px;
  cursor: pointer;
  z-index: 2;
  transition: all 0.2s ease;
}

.combo-card-node:hover {
  transform: scale(1.1);
  z-index: 10;
}

.combo-card-node:hover .combo-card-name {
  opacity: 1;
  transform: translateY(0);
}

/* 正在预览的节点样式 */
.combo-card-node.node-previewing {
  transform: scale(1.15);
  z-index: 15;
}

.combo-card-node.node-previewing .combo-card-img {
  border-color: #e94560;
  box-shadow: 0 0 15px rgba(233, 69, 96, 0.6), 0 2px 8px rgba(0, 0, 0, 0.4);
}

.combo-card-img {
  width: 60px;
  height: 87px;
  object-fit: cover;
  border-radius: 4px;
  border: 2px solid #333;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
  transition: border-color 0.2s;
}

/* 搜索按钮 */
.combo-search-btn {
  position: absolute;
  bottom: 25px;
  right: -8px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  border: 2px solid rgba(255, 255, 255, 0.8);
  color: white;
  font-size: 11px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 10;
  opacity: 0;
  transform: scale(0.8);
  transition: all 0.2s ease;
  box-shadow: 0 2px 6px rgba(99, 102, 241, 0.4);
}

.combo-card-node:hover .combo-search-btn {
  opacity: 1;
  transform: scale(1);
}

.combo-search-btn:hover {
  background: linear-gradient(135deg, #818cf8 0%, #a78bfa 100%);
  transform: scale(1.1);
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.6);
}

.combo-card-label {
  position: absolute;
  top: -8px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.85);
  color: #fff;
  font-size: 9px;
  font-weight: bold;
  padding: 2px 6px;
  border-radius: 3px;
  white-space: nowrap;
  z-index: 3;
  border: 1px solid currentColor;
}

.combo-card-name {
  position: absolute;
  bottom: -20px;
  left: 50%;
  transform: translateX(-50%) translateY(5px);
  background: rgba(0, 0, 0, 0.9);
  color: #fff;
  font-size: 10px;
  padding: 3px 6px;
  border-radius: 3px;
  white-space: nowrap;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  opacity: 0;
  transition: all 0.2s;
  z-index: 5;
}

/* XYZ素材卡片显示样式 */
.combo-xyz-material-cards {
  position: absolute;
  bottom: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: row;
  align-items: flex-end;
  justify-content: center;
  z-index: 3;
  padding: 4px 6px;
  background: rgba(13, 71, 161, 0.15);
  border-radius: 8px;
  border: 1px dashed rgba(100, 181, 246, 0.5);
}

.xyz-material-card {
  position: relative;
  width: 32px;
  margin: 0 2px;
  transition: all 0.2s;
  cursor: pointer;
}

.xyz-material-card:hover {
  transform: scale(1.4) translateY(-5px);
  z-index: 10;
}

.xyz-material-card:hover .material-card-img {
  box-shadow: 0 4px 12px rgba(21, 101, 192, 0.8);
}

.material-card-img {
  width: 32px;
  height: 46px;
  object-fit: cover;
  border-radius: 2px;
  border: 1.5px solid #42a5f5;
  box-shadow: 0 2px 4px rgba(21, 101, 192, 0.4);
  transition: all 0.2s;
}

.material-level {
  position: absolute;
  bottom: -6px;
  left: 50%;
  transform: translateX(-50%);
  background: linear-gradient(135deg, #0d47a1 0%, #1565c0 100%);
  color: #ffd54f;
  font-size: 7px;
  font-weight: bold;
  padding: 1px 3px;
  border-radius: 4px;
  white-space: nowrap;
  border: 1px solid #42a5f5;
  text-shadow: 0 1px 1px rgba(0,0,0,0.3);
}

.xyz-arrow {
  position: absolute;
  bottom: -14px;
  left: 50%;
  transform: translateX(-50%);
  color: #42a5f5;
  font-size: 12px;
  font-weight: bold;
  text-shadow: 0 0 6px rgba(66, 165, 245, 0.9);
  animation: xyz-pulse 1.2s ease-in-out infinite;
}

@keyframes xyz-pulse {
  0%, 100% { opacity: 0.5; transform: translateX(-50%) translateY(0); }
  50% { opacity: 1; transform: translateX(-50%) translateY(2px); }
}

/* ============ 通用召唤素材样式 ============ */
.combo-summon-material-cards {
  position: absolute;
  bottom: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: row;
  align-items: flex-end;
  justify-content: center;
  z-index: 3;
  padding: 4px 6px;
  border-radius: 8px;
  border: 1px dashed;
}

/* 召唤类型标签 */
.summon-type-label {
  position: absolute;
  top: -10px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 8px;
  font-weight: bold;
  padding: 1px 6px;
  border-radius: 6px;
  white-space: nowrap;
  z-index: 4;
}

/* 素材卡片通用样式 */
.summon-material-card {
  position: relative;
  width: 32px;
  margin: 0 2px;
  transition: all 0.2s;
  cursor: pointer;
}

.summon-material-card:hover {
  transform: scale(1.4) translateY(-5px);
  z-index: 10;
}

.summon-material-card .material-card-img {
  width: 32px;
  height: 46px;
  object-fit: cover;
  border-radius: 2px;
  border: 1.5px solid;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.4);
  transition: all 0.2s;
}

.material-info {
  position: absolute;
  bottom: -6px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 7px;
  font-weight: bold;
  padding: 1px 3px;
  border-radius: 4px;
  white-space: nowrap;
  border: 1px solid;
  text-shadow: 0 1px 1px rgba(0,0,0,0.3);
}

/* 召唤箭头 */
.summon-arrow {
  position: absolute;
  bottom: -14px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 12px;
  font-weight: bold;
  animation: summon-pulse 1.2s ease-in-out infinite;
}

@keyframes summon-pulse {
  0%, 100% { opacity: 0.5; transform: translateX(-50%) translateY(0); }
  50% { opacity: 1; transform: translateX(-50%) translateY(2px); }
}

/* ============ XYZ召唤样式 (蓝色) ============ */
.material-type-xyz {
  background: rgba(13, 71, 161, 0.15);
  border-color: rgba(100, 181, 246, 0.5);
}
.label-xyz { background: linear-gradient(135deg, #0d47a1 0%, #1565c0 100%); color: #fff; border: 1px solid #42a5f5; }
.material-type-xyz .material-card-img { border-color: #42a5f5; }
.material-type-xyz .material-level { background: linear-gradient(135deg, #0d47a1 0%, #1565c0 100%); color: #ffd54f; border-color: #42a5f5; }
.arrow-xyz { color: #42a5f5; text-shadow: 0 0 6px rgba(66, 165, 245, 0.9); }

/* ============ 同调召唤样式 (绿色) ============ */
.material-type-同调 {
  background: rgba(27, 94, 32, 0.15);
  border-color: rgba(129, 199, 132, 0.5);
}
.label-同调 { background: linear-gradient(135deg, #1b5e20 0%, #2e7d32 100%); color: #fff; border: 1px solid #81c784; }
.material-type-同调 .material-card-img { border-color: #66bb6a; }
.material-type-同调 .material-level { background: linear-gradient(135deg, #1b5e20 0%, #2e7d32 100%); color: #c8e6c9; border-color: #81c784; }
.material-type-同调 .material-level.tuner-mark { background: linear-gradient(135deg, #f57f17 0%, #fbc02d 100%); color: #fff; border-color: #ffeb3b; }
.arrow-同调 { color: #66bb6a; text-shadow: 0 0 6px rgba(102, 187, 106, 0.9); }

/* ============ Link召唤样式 (红色) ============ */
.material-type-link {
  background: rgba(183, 28, 28, 0.15);
  border-color: rgba(239, 83, 80, 0.5);
}
.label-link { background: linear-gradient(135deg, #b71c1c 0%, #c62828 100%); color: #fff; border: 1px solid #ef5350; }
.material-type-link .material-card-img { border-color: #ef5350; }
.material-type-link .material-info { background: linear-gradient(135deg, #b71c1c 0%, #c62828 100%); color: #ffcdd2; border-color: #ef5350; }
.material-type-link .material-level { background: linear-gradient(135deg, #b71c1c 0%, #c62828 100%); color: #ffcdd2; border-color: #ef5350; }
.arrow-link { color: #ef5350; text-shadow: 0 0 6px rgba(239, 83, 80, 0.9); }

/* ============ 融合召唤样式 (紫色) ============ */
.material-type-融合 {
  background: rgba(74, 20, 140, 0.15);
  border-color: rgba(186, 104, 200, 0.5);
}
.label-融合 { background: linear-gradient(135deg, #4a148c 0%, #6a1b9a 100%); color: #fff; border: 1px solid #ba68c8; }
.material-type-融合 .material-card-img { border-color: #ab47bc; }
.material-type-融合 .material-level { background: linear-gradient(135deg, #4a148c 0%, #6a1b9a 100%); color: #e1bee7; border-color: #ba68c8; }
.arrow-融合 { color: #ab47bc; text-shadow: 0 0 6px rgba(171, 71, 188, 0.9); }

/* ============ 仪式召唤样式 (青色/蓝绿) ============ */
.material-type-仪式 {
  background: rgba(0, 96, 100, 0.15);
  border-color: rgba(77, 182, 172, 0.5);
}
.label-仪式 { background: linear-gradient(135deg, #006064 0%, #00838f 100%); color: #fff; border: 1px solid #4db6ac; }
.material-type-仪式 .material-card-img { border-color: #26a69a; }
.material-type-仪式 .material-level { background: linear-gradient(135deg, #006064 0%, #00838f 100%); color: #b2dfdb; border-color: #4db6ac; }
.arrow-仪式 { color: #26a69a; text-shadow: 0 0 6px rgba(38, 166, 154, 0.9); }

/* 调整怪兽特殊样式 */
.summon-material-card.is-tuner .material-card-img {
  border-color: #ffc107 !important;
  box-shadow: 0 0 8px rgba(255, 193, 7, 0.6);
}

/* Link怪兽特殊样式 */
.summon-material-card.is-link .material-card-img {
  border-color: #ff5722 !important;
  box-shadow: 0 0 8px rgba(255, 87, 34, 0.6);
}

.combo-card-node.has-materials .combo-card-label {
  top: -8px;
  background: linear-gradient(135deg, #0d47a1 0%, #1565c0 100%);
  border-color: #42a5f5;
}

/* 按召唤类型调整标签颜色 */
.combo-card-node.summon-type-同调.has-materials .combo-card-label { background: linear-gradient(135deg, #1b5e20 0%, #2e7d32 100%); border-color: #81c784; }
.combo-card-node.summon-type-link.has-materials .combo-card-label { background: linear-gradient(135deg, #b71c1c 0%, #c62828 100%); border-color: #ef5350; }
.combo-card-node.summon-type-融合.has-materials .combo-card-label { background: linear-gradient(135deg, #4a148c 0%, #6a1b9a 100%); border-color: #ba68c8; }
.combo-card-node.summon-type-仪式.has-materials .combo-card-label { background: linear-gradient(135deg, #006064 0%, #00838f 100%); border-color: #4db6ac; }

.combo-card-node.has-materials .combo-card-img {
  border-color: #1565c0;
  box-shadow: 0 0 12px rgba(33, 150, 243, 0.6);
}

/* 按召唤类型调整卡片边框颜色 */
.combo-card-node.summon-type-同调.has-materials .combo-card-img { border-color: #2e7d32; box-shadow: 0 0 12px rgba(76, 175, 80, 0.6); }
.combo-card-node.summon-type-link.has-materials .combo-card-img { border-color: #c62828; box-shadow: 0 0 12px rgba(244, 67, 54, 0.6); }
.combo-card-node.summon-type-融合.has-materials .combo-card-img { border-color: #6a1b9a; box-shadow: 0 0 12px rgba(156, 39, 176, 0.6); }
.combo-card-node.summon-type-仪式.has-materials .combo-card-img { border-color: #00838f; box-shadow: 0 0 12px rgba(0, 150, 136, 0.6); }

/* 序号徽章样式 */
.combo-seq-badge {
  position: absolute;
  top: -10px;
  left: -12px;
  min-width: 12px;
  height: 18px;
  background: linear-gradient(135deg, #1565c0 0%, #1976d2 100%);
  color: #fff;
  font-size: 10px;
  font-weight: bold;
  padding: 0 4px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid #64b5f6;
  z-index: 7;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.4);
}

/* 初动点标记样式 */
.combo-starter-badge {
  position: absolute;
  top: -32px;
  left: 50%;
  transform: translateX(-50%);
  background: linear-gradient(135deg, #ff6b00 0%, #ff9800 50%, #ffc107 100%);
  color: #fff;
  font-size: 10px;
  font-weight: bold;
  padding: 2px 8px;
  border-radius: 10px;
  white-space: nowrap;
  border: 2px solid #ffe082;
  z-index: 8;
  box-shadow: 0 0 12px rgba(255, 152, 0, 0.8), 0 2px 6px rgba(0, 0, 0, 0.4);
  animation: starterPulse 2s ease-in-out infinite;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
}

@keyframes starterPulse {
  0%, 100% {
    box-shadow: 0 0 12px rgba(255, 152, 0, 0.8), 0 2px 6px rgba(0, 0, 0, 0.4);
  }
  50% {
    box-shadow: 0 0 20px rgba(255, 152, 0, 1), 0 0 30px rgba(255, 193, 7, 0.6), 0 2px 6px rgba(0, 0, 0, 0.4);
  }
}

/* 初动点卡片边框高亮 */
.combo-card-node:has(.combo-starter-badge) .combo-card-img {
  border-color: #ff9800 !important;
  box-shadow: 0 0 15px rgba(255, 152, 0, 0.7), 0 2px 8px rgba(0, 0, 0, 0.4);
}

/* 动点标记样式 */
.combo-action-badge {
  position: absolute;
  top: -32px;
  left: 50%;
  transform: translateX(-50%);
  background: linear-gradient(135deg, #00bcd4 0%, #0097a7 50%, #006064 100%);
  color: #fff;
  font-size: 10px;
  font-weight: bold;
  padding: 3px 8px;
  border-radius: 10px;
  white-space: nowrap;
  z-index: 10;
  box-shadow: 0 2px 8px rgba(0, 188, 212, 0.5);
  border: 1px solid #4dd0e1;
  animation: actionBadgePulse 2s ease-in-out infinite;
}

@keyframes actionBadgePulse {
  0%, 100% { box-shadow: 0 2px 8px rgba(0, 188, 212, 0.5); }
  50% { box-shadow: 0 2px 15px rgba(0, 188, 212, 0.8); }
}

/* 动点卡片边框高亮 */
.combo-card-node:has(.combo-action-badge) .combo-card-img {
  border-color: #00bcd4 !important;
  box-shadow: 0 0 15px rgba(0, 188, 212, 0.7), 0 2px 8px rgba(0, 0, 0, 0.4);
}

/* 手坑标记样式 */
.combo-handtrap-badge {
  position: absolute;
  top: -32px;
  left: 50%;
  transform: translateX(-50%);
  background: linear-gradient(135deg, #546e7a 0%, #455a64 50%, #37474f 100%);
  color: #eceff1;
  font-size: 10px;
  font-weight: bold;
  padding: 2px 8px;
  border-radius: 10px;
  white-space: nowrap;
  border: 2px solid #90a4ae;
  z-index: 8;
  box-shadow: 0 0 8px rgba(84, 110, 122, 0.6), 0 2px 6px rgba(0, 0, 0, 0.4);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
}

/* 手坑卡片边框 - 用灰蓝色表示防御性质 */
.combo-card-node:has(.combo-handtrap-badge) .combo-card-img {
  border-color: #78909c !important;
  box-shadow: 0 0 10px rgba(120, 144, 156, 0.5), 0 2px 8px rgba(0, 0, 0, 0.4);
}

/* ============ 效果类型标记样式 ============ */
.combo-effect-type-badge {
  position: absolute;
  top: -32px;
  left: 50%;
  transform: translateX(-50%);
  color: #fff;
  font-size: 9px;
  font-weight: bold;
  padding: 2px 6px;
  border-radius: 8px;
  white-space: nowrap;
  z-index: 8;
  border: 1px solid;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
  background: var(--effect-color, #666);
  border-color: var(--effect-color, #888);
  box-shadow: 0 0 8px color-mix(in srgb, var(--effect-color, #666) 50%, transparent);
}

/* 起动效果 - 橙色 */
.effect-type-ignition {
  background: linear-gradient(135deg, #e65100 0%, #ff9800 100%);
  border-color: #ffb74d;
}
.combo-card-node:has(.effect-type-ignition) .combo-card-img {
  border-color: #ff9800 !important;
  box-shadow: 0 0 10px rgba(255, 152, 0, 0.5);
}

/* 诱发效果 - 绿色 */
.effect-type-trigger {
  background: linear-gradient(135deg, #2e7d32 0%, #4caf50 100%);
  border-color: #81c784;
}
.combo-card-node:has(.effect-type-trigger) .combo-card-img {
  border-color: #4caf50 !important;
  box-shadow: 0 0 10px rgba(76, 175, 80, 0.5);
}

/* 诱发即时效果 - 蓝色 */
.effect-type-quick {
  background: linear-gradient(135deg, #1565c0 0%, #2196f3 100%);
  border-color: #64b5f6;
}
.combo-card-node:has(.effect-type-quick) .combo-card-img {
  border-color: #2196f3 !important;
  box-shadow: 0 0 10px rgba(33, 150, 243, 0.5);
}

/* 魔法效果 - 青绿色 */
.effect-type-spell {
  background: linear-gradient(135deg, #00796b 0%, #1de9b6 100%);
  border-color: #64ffda;
}
.combo-card-node:has(.effect-type-spell) .combo-card-img {
  border-color: #1de9b6 !important;
  box-shadow: 0 0 10px rgba(29, 233, 182, 0.5);
}

/* 陷阱效果 - 粉红色 */
.effect-type-trap {
  background: linear-gradient(135deg, #ad1457 0%, #e91e63 100%);
  border-color: #f48fb1;
}
.combo-card-node:has(.effect-type-trap) .combo-card-img {
  border-color: #e91e63 !important;
  box-shadow: 0 0 10px rgba(233, 30, 99, 0.5);
}

/* 反击陷阱 - 红色 */
.effect-type-counter {
  background: linear-gradient(135deg, #b71c1c 0%, #f44336 100%);
  border-color: #ef9a9a;
}
.combo-card-node:has(.effect-type-counter) .combo-card-img {
  border-color: #f44336 !important;
  box-shadow: 0 0 12px rgba(244, 67, 54, 0.6);
}

/* 永续效果 - 紫色 */
.effect-type-continuous {
  background: linear-gradient(135deg, #6a1b9a 0%, #9c27b0 100%);
  border-color: #ce93d8;
}

/* 反转效果 - 棕色 */
.effect-type-flip {
  background: linear-gradient(135deg, #4e342e 0%, #795548 100%);
  border-color: #a1887f;
}

/* 连锁号码徽章样式 */
.combo-chain-badge {
  position: absolute;
  top: -8px;
  right: -8px;
  background: linear-gradient(135deg, #7b1fa2 0%, #9c27b0 100%);
  color: #fff;
  font-size: 9px;
  font-weight: bold;
  padding: 2px 5px;
  border-radius: 8px;
  white-space: nowrap;
  border: 1px solid #ce93d8;
  z-index: 6;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  gap: 2px;
}

/* 咒文速度指示器 */
.spell-speed-indicator {
  font-size: 7px;
  background: rgba(255, 255, 255, 0.2);
  padding: 0 2px;
  border-radius: 3px;
  margin-left: 2px;
}

/* 咒文速度2 - 蓝色调 */
.combo-chain-badge.spell-speed-2 {
  background: linear-gradient(135deg, #1565c0 0%, #2196f3 100%);
  border-color: #64b5f6;
}

/* 咒文速度3 - 红色调（反击） */
.combo-chain-badge.spell-speed-3 {
  background: linear-gradient(135deg, #b71c1c 0%, #f44336 100%);
  border-color: #ef9a9a;
}

.combo-card-node.has-chain .combo-card-img {
  border-color: #9c27b0;
}

/* 连锁信息悬停面板 */
.combo-chain-tooltip {
  position: absolute;
  bottom: calc(100% + 10px);
  left: 50%;
  transform: translateX(-50%);
  background: rgba(30, 30, 40, 0.98);
  border: 1px solid #9c27b0;
  border-radius: 8px;
  padding: 8px;
  min-width: 180px;
  max-width: 280px;
  z-index: 100;
  opacity: 0;
  visibility: hidden;
  transition: all 0.2s ease;
  box-shadow: 0 4px 20px rgba(156, 39, 176, 0.4);
}

.combo-card-node:hover .combo-chain-tooltip {
  opacity: 1;
  visibility: visible;
}

.chain-tooltip-title {
  color: #ce93d8;
  font-size: 11px;
  font-weight: bold;
  margin-bottom: 6px;
  padding-bottom: 4px;
  border-bottom: 1px solid rgba(156, 39, 176, 0.3);
}

.chain-tooltip-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px;
  border-radius: 4px;
  margin-bottom: 4px;
  background: rgba(156, 39, 176, 0.1);
  transition: background 0.15s;
}

.chain-tooltip-item:last-child {
  margin-bottom: 0;
}

.chain-tooltip-item.current-chain {
  background: rgba(156, 39, 176, 0.3);
  border: 1px solid #9c27b0;
}

.chain-tooltip-img {
  width: 28px;
  height: 40px;
  object-fit: cover;
  border-radius: 2px;
  border: 1px solid #666;
  flex-shrink: 0;
}

.chain-tooltip-item.current-chain .chain-tooltip-img {
  border-color: #ce93d8;
  box-shadow: 0 0 6px rgba(156, 39, 176, 0.6);
}

.chain-tooltip-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow: hidden;
}

.chain-tooltip-num {
  background: linear-gradient(135deg, #7b1fa2 0%, #9c27b0 100%);
  color: #fff;
  font-size: 9px;
  font-weight: bold;
  padding: 1px 6px;
  border-radius: 8px;
  width: fit-content;
}

.chain-tooltip-name {
  color: #fff;
  font-size: 10px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 160px;
}

.chain-tooltip-loc {
  color: #aaa;
  font-size: 9px;
}

/* 节点类型样式 */
.node-type-move .combo-card-img {
  border-color: #17a2b8;
}
.node-type-move .combo-card-label {
  background: #17a2b8;
  border-color: #17a2b8;
}

.node-type-summon .combo-card-img {
  border-color: #ffc107;
}
.node-type-summon .combo-card-label {
  background: #ffc107;
  color: #000;
  border-color: #ffc107;
}

.node-type-spsummon .combo-card-img {
  border-color: #e94560;
  box-shadow: 0 0 12px rgba(233, 69, 96, 0.5);
}
.node-type-spsummon .combo-card-label {
  background: #e94560;
  border-color: #e94560;
}

.node-type-chain .combo-card-img {
  border-color: #9c27b0;
  box-shadow: 0 0 12px rgba(156, 39, 176, 0.5);
}
.node-type-chain .combo-card-label {
  background: #9c27b0;
  border-color: #9c27b0;
}

.node-highlighted .combo-card-img {
  animation: nodeGlow 1s ease-in-out infinite alternate;
}

@keyframes nodeGlow {
  from {
    box-shadow: 0 0 5px currentColor;
  }
  to {
    box-shadow: 0 0 20px currentColor, 0 0 30px currentColor;
  }
}

/* ========== 资源变化可视化样式 ========== */
/* 大展开 - 亮绿色光晕（场面大幅展开） */
.combo-card-node.entropy-high-expand .combo-card-img {
  box-shadow: 0 0 20px rgba(0, 255, 136, 0.6), 0 0 30px rgba(0, 255, 136, 0.3);
}
.combo-card-node.entropy-high-expand::before {
  content: '🚀';
  position: absolute;
  top: -18px;
  right: -5px;
  font-size: 14px;
  z-index: 10;
  animation: entropyPulse 1.5s ease-in-out infinite;
}

/* 赚卡 - 绿色光晕（资源增加） */
.combo-card-node.entropy-expand .combo-card-img {
  box-shadow: 0 0 15px rgba(74, 222, 128, 0.5), 0 0 25px rgba(74, 222, 128, 0.2);
}
.combo-card-node.entropy-expand::before {
  content: '↗';
  position: absolute;
  top: -16px;
  right: -3px;
  font-size: 12px;
  color: #4ade80;
  font-weight: bold;
  z-index: 10;
}

/* 微赚 - 淡绿色（小幅资源增加） */
.combo-card-node.entropy-slight-expand .combo-card-img {
  box-shadow: 0 0 10px rgba(134, 239, 172, 0.4);
}

/* 大消耗 - 红色光晕（大量素材/cost） */
.combo-card-node.entropy-high-converge .combo-card-img {
  box-shadow: 0 0 20px rgba(255, 68, 68, 0.6), 0 0 30px rgba(255, 68, 68, 0.3);
}
.combo-card-node.entropy-high-converge::before {
  content: '💫';
  position: absolute;
  top: -18px;
  right: -5px;
  font-size: 14px;
  z-index: 10;
  animation: entropyPulse 1.5s ease-in-out infinite;
}

/* 亏卡 - 红色光晕（资源消耗） */
.combo-card-node.entropy-converge .combo-card-img {
  box-shadow: 0 0 15px rgba(248, 113, 113, 0.5), 0 0 25px rgba(248, 113, 113, 0.2);
}
.combo-card-node.entropy-converge::before {
  content: '↘';
  position: absolute;
  top: -16px;
  right: -3px;
  font-size: 12px;
  color: #f87171;
  font-weight: bold;
  z-index: 10;
}

/* 微亏 - 淡红色（小幅资源消耗） */
.combo-card-node.entropy-slight-converge .combo-card-img {
  box-shadow: 0 0 10px rgba(252, 165, 165, 0.4);
}

/* 持平 - 蓝色光晕（资源不变） */
.combo-card-node.entropy-stable .combo-card-img {
  box-shadow: 0 0 8px rgba(96, 165, 250, 0.3);
}

@keyframes entropyPulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.2); opacity: 0.8; }
}

/* 资源变化徽章（赚卡/亏卡标识） */
.combo-entropy-badge {
  position: absolute;
  bottom: -20px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 2px 6px;
  border-radius: 10px;
  font-size: 9px;
  font-weight: bold;
  white-space: nowrap;
  z-index: 8;
  backdrop-filter: blur(4px);
  transition: all 0.2s ease;
}

/* 赚卡/展开 - 绿色 */
.combo-entropy-badge.entropy-positive {
  background: linear-gradient(135deg, rgba(34, 197, 94, 0.9), rgba(74, 222, 128, 0.9));
  color: #fff;
  border: 1px solid #4ade80;
  box-shadow: 0 2px 8px rgba(34, 197, 94, 0.4);
}

/* 亏卡/消耗 - 红色 */
.combo-entropy-badge.entropy-negative {
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.9), rgba(248, 113, 113, 0.9));
  color: #fff;
  border: 1px solid #f87171;
  box-shadow: 0 2px 8px rgba(239, 68, 68, 0.4);
}

.combo-entropy-badge .entropy-icon {
  font-size: 10px;
}

.combo-entropy-badge .entropy-value {
  font-size: 9px;
}

.combo-card-node:hover .combo-entropy-badge {
  transform: translateX(-50%) scale(1.1);
}

/* ========== 因果边样式 ========== */
.causal-edge {
  transition: stroke-width 0.2s ease, opacity 0.2s ease;
}

.causal-edge:hover {
  stroke-width: 4px !important;
  filter: drop-shadow(0 0 4px currentColor);
}

/* 因果边类型标签样式 */
.connection-label.label-type-summon_material {
  fill: #ff6b35;
  font-weight: bold;
}
.connection-label.label-type-effect_target {
  fill: #e94560;
  font-weight: bold;
}
.connection-label.label-type-cost {
  fill: #9b59b6;
}
.connection-label.label-type-search {
  fill: #2ecc71;
  font-weight: bold;
}
.connection-label.label-type-temporal {
  fill: #7f8c8d;
  font-style: italic;
}
.connection-label.label-type-chain_response {
  fill: #3498db;
}
.connection-label.label-type-trigger {
  fill: #f1c40f;
  font-weight: bold;
}
.connection-label.label-type-hand_activation {
  fill: #1abc9c;
  font-weight: bold;
}

/* ========== 秘密触发器 - "决斗开始" ========== */
.secret-trigger-container {
  position: absolute;
  top: 8px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 20px;
  z-index: 5;
  pointer-events: auto;
}

.secret-trigger {
  font-size: 14px;
  color: rgba(150, 150, 150, 0.25);
  cursor: default;
  user-select: none;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.3s ease;
  font-weight: bold;
  letter-spacing: 2px;
}

.secret-trigger:hover {
  color: rgba(150, 150, 150, 0.5);
  cursor: pointer;
}

.secret-trigger.next {
  color: rgba(102, 126, 234, 0.4);
  animation: secret-hint 2s ease-in-out infinite;
}

.secret-trigger.triggered {
  color: #667eea;
  text-shadow: 0 0 10px rgba(102, 126, 234, 0.8);
  transform: scale(1.2);
}

@keyframes secret-hint {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 0.7; }
}

/* ========== 文字解说面板 ========== */
.commentary-panel {
  width: 280px;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  flex-shrink: 0;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  border: 1px solid #2a2a4a;
}

.commentary-header {
  background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
  padding: 10px 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.commentary-title {
  color: #fff;
  font-weight: bold;
  font-size: 14px;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

.commentary-controls {
  display: flex;
  gap: 6px;
}

.commentary-clear-btn,
.commentary-copy-btn,
.commentary-close-btn {
  background: rgba(255, 255, 255, 0.15);
  border: none;
  border-radius: 4px;
  padding: 4px 8px;
  cursor: pointer;
  font-size: 12px;
  color: #fff;
  transition: all 0.2s ease;
}

.commentary-clear-btn:hover,
.commentary-copy-btn:hover {
  background: rgba(255, 255, 255, 0.25);
  transform: scale(1.05);
}

.commentary-close-btn {
  background: rgba(239, 68, 68, 0.6);
  font-weight: bold;
  padding: 4px 10px;
}

.commentary-close-btn:hover {
  background: rgba(239, 68, 68, 0.9);
  transform: scale(1.05);
}

.commentary-content {
  flex: 1;
  overflow-y: auto;
  padding: 10px;

  min-height: 200px;
}

.commentary-empty {
  color: #888;
  text-align: center;
  padding: 40px 20px;
  font-style: italic;
}

.commentary-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.commentary-entry {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 10px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  font-size: 12px;
  color: #e0e0e0;
  line-height: 1.4;
  transition: all 0.2s ease;
  border-left: 3px solid transparent;
}

.commentary-entry:hover {
  background: rgba(255, 255, 255, 0.1);
  transform: translateX(2px);
}

.commentary-time {
  color: #888;
  font-size: 10px;
  min-width: 24px;
  flex-shrink: 0;
}

.commentary-icon {
  font-size: 14px;
  flex-shrink: 0;
}

.commentary-text {
  flex: 1;
  word-break: break-word;
}

/* 解说条目类型样式 */
.commentary-new_turn {
  background: linear-gradient(90deg, rgba(102, 126, 234, 0.2) 0%, rgba(118, 75, 162, 0.1) 100%);
  border-left-color: #667eea;
  font-weight: bold;
  color: #fff;
}

.commentary-new_phase {
  background: rgba(100, 100, 100, 0.2);
  border-left-color: #888;
  font-size: 11px;
  color: #aaa;
}

.commentary-spsummon {
  border-left-color: #ffd700;
  background: rgba(255, 215, 0, 0.1);
}

.commentary-chain {
  border-left-color: #ff6b6b;
  background: rgba(255, 107, 107, 0.1);
}

.commentary-attack {
  border-left-color: #ff4757;
  background: rgba(255, 71, 87, 0.15);
}

.commentary-damage {
  border-left-color: #e74c3c;
  background: rgba(231, 76, 60, 0.1);
}

.commentary-recover {
  border-left-color: #2ecc71;
  background: rgba(46, 204, 113, 0.1);
}

.commentary-win {
  background: linear-gradient(90deg, rgba(255, 215, 0, 0.3) 0%, rgba(255, 165, 0, 0.2) 100%);
  border-left-color: #ffd700;
  font-weight: bold;
  color: #ffd700;
}

/* ========== 解说员角色系统 ========== */

/* 解说员信息栏 */
.commentator-info {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
  transition: all 0.2s ease;
  position: relative;
  flex-shrink: 0;
}

.commentator-info:hover {
  background: rgba(255, 255, 255, 0.15);
}

.commentator-avatar {
  font-size: 20px;
  animation: avatarFloat 3s ease-in-out infinite;
}

@keyframes avatarFloat {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-2px); }
}

.commentator-dropdown-icon {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.7);
  transition: transform 0.2s ease;
  margin-left: 2px;
}

.commentator-dropdown-icon.open {
  transform: rotate(180deg);
}

.commentator-info:hover .commentator-dropdown-icon:not(.open) {
  transform: translateY(2px);
}

/* 角色选择下拉菜单 */
.commentator-selector {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: #1a1a2e;
  border: 1px solid #3a3a5a;
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  z-index: 1000;
  overflow: hidden;
  margin-top: 4px;
  min-width: 260px;
}

.commentator-option {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  cursor: pointer;
  transition: all 0.2s ease;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.commentator-option:last-child {
  border-bottom: none;
}

.commentator-option:hover {
  background: rgba(255, 255, 255, 0.1);
}

.commentator-option.active {
  background: linear-gradient(90deg, rgba(102, 126, 234, 0.3) 0%, rgba(118, 75, 162, 0.2) 100%);
  border-left: 3px solid #667eea;
}

.option-avatar {
  font-size: 24px;
  flex-shrink: 0;
}

.option-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.option-name {
  color: #fff;
  font-weight: bold;
  font-size: 13px;
}

.option-desc {
  color: #888;
  font-size: 11px;
}

/* 等待状态头像 */
.commentary-empty .empty-avatar {
  display: block;
  font-size: 48px;
  margin-bottom: 12px;
  animation: emptyAvatarPulse 2s ease-in-out infinite;
}

@keyframes emptyAvatarPulse {
  0%, 100% { opacity: 0.6; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.05); }
}

/* ========== 不动游星 (Yusei) 专用样式 ========== */

/* 游星主题面板 */
.commentator-yusei {
  border: 1px solid #ff6b35;
  box-shadow: 0 4px 20px rgba(255, 107, 53, 0.2);
}

.commentator-yusei .commentary-header {
  background: linear-gradient(90deg, #ff6b35 0%, #f7931e 50%, #ff6b35 100%) !important;
}

/* 游星角色专用条目样式 */
.commentary-entry.character-yusei {
  border-left-color: #ff6b35;
  background: linear-gradient(90deg, rgba(255, 107, 53, 0.15) 0%, transparent 100%);
}

.commentary-entry.character-yusei .commentary-icon {
  animation: yuseiIconGlow 1.5s ease-in-out infinite;
}

@keyframes yuseiIconGlow {
  0%, 100% { filter: drop-shadow(0 0 2px rgba(255, 107, 53, 0.5)); }
  50% { filter: drop-shadow(0 0 6px rgba(255, 107, 53, 0.8)); }
}

/* 游星同调召唤特效 */
.commentary-entry.character-yusei.commentary-spsummon {
  background: linear-gradient(90deg, rgba(255, 107, 53, 0.2) 0%, rgba(247, 147, 30, 0.15) 50%, rgba(255, 215, 0, 0.1) 100%);
  border-left: 3px solid #ffd700;
  animation: yuseiSynchroFlash 0.5s ease-out;
}

@keyframes yuseiSynchroFlash {
  0% { 
    background: linear-gradient(90deg, rgba(255, 255, 255, 0.5) 0%, rgba(255, 215, 0, 0.3) 100%);
  }
  100% { 
    background: linear-gradient(90deg, rgba(255, 107, 53, 0.2) 0%, rgba(247, 147, 30, 0.15) 50%, rgba(255, 215, 0, 0.1) 100%);
  }
}

/* 游星攻击特效 */
.commentary-entry.character-yusei.commentary-attack {
  background: linear-gradient(90deg, rgba(255, 71, 87, 0.2) 0%, rgba(255, 107, 53, 0.15) 100%);
  border-left-color: #ff4757;
}

/* 游星回合开始特效 */
.commentary-entry.character-yusei.commentary-new_turn {
  background: linear-gradient(90deg, rgba(255, 107, 53, 0.25) 0%, rgba(247, 147, 30, 0.15) 100%);
  border-left-color: #ff6b35;
  position: relative;
}

.commentary-entry.character-yusei.commentary-new_turn::after {
  content: '🏍️';
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 16px;
  opacity: 0.6;
  animation: rideMotorcycle 0.8s ease-out;
}

@keyframes rideMotorcycle {
  0% { transform: translateY(-50%) translateX(-20px); opacity: 0; }
  100% { transform: translateY(-50%) translateX(0); opacity: 0.6; }
}

/* 游星连锁效果样式 */
.commentary-entry.character-yusei.commentary-chain {
  background: linear-gradient(90deg, rgba(255, 107, 53, 0.2) 0%, rgba(255, 107, 107, 0.1) 100%);
  border-left-color: #ff6b35;
}

/* 游星胜利特效 */
.commentary-entry.character-yusei.commentary-win {
  background: linear-gradient(90deg, rgba(255, 215, 0, 0.4) 0%, rgba(255, 107, 53, 0.3) 50%, rgba(247, 147, 30, 0.2) 100%);
  border-left-color: #ffd700;
  animation: yuseiVictory 1s ease-out;
}

@keyframes yuseiVictory {
  0% { transform: scale(0.95); opacity: 0; }
  50% { transform: scale(1.02); }
  100% { transform: scale(1); opacity: 1; }
}

/* ========== m (m) 专用样式 ========== */

/* 水无月主题面板 */
.commentator-m {
  border: 1px solid #f5adc1;
  box-shadow: 0 4px 20px rgba(245, 173, 193, 0.2);
}

.commentator-m .commentary-header {
  background: linear-gradient(90deg, #f5adc1 0%, #f8c4d6 50%, #f299b8 100%) !important;
}

/* 水无月角色专用条目样式 */
.commentary-entry.character-m {
  border-left-color: #f5adc1;
  background: linear-gradient(90deg, rgba(245, 173, 193, 0.12) 0%, transparent 100%);
}

.commentary-entry.character-m .commentary-icon {
  animation: mIconBounce 0.5s ease-out;
}

@keyframes mIconBounce {
  0% { transform: scale(0.8); }
  50% { transform: scale(1.2); }
  100% { transform: scale(1); }
}

/* 水无月特殊召唤特效 - 游戏感 */
.commentary-entry.character-m.commentary-spsummon {
  background: linear-gradient(90deg, rgba(245, 173, 193, 0.2) 0%, rgba(248, 196, 214, 0.15) 50%, rgba(242, 153, 184, 0.1) 100%);
  border-left: 3px solid #f8c4d6;
  animation: mPop 0.4s ease-out;
}

@keyframes mPop {
  0% { 
    transform: translateX(-10px);
    opacity: 0;
  }
  100% { 
    transform: translateX(0);
    opacity: 1;
  }
}

/* 水无月效果发动 - 吐槽风格 */
.commentary-entry.character-m.commentary-chain {
  background: linear-gradient(90deg, rgba(245, 173, 193, 0.18) 0%, rgba(255, 193, 7, 0.1) 100%);
  border-left-color: #ffc107;
}

/* 水无月攻击特效 */
.commentary-entry.character-m.commentary-attack {
  background: linear-gradient(90deg, rgba(244, 67, 54, 0.15) 0%, rgba(245, 173, 193, 0.1) 100%);
  border-left-color: #f44336;
}

/* 水无月回合开始特效 */
.commentary-entry.character-m.commentary-new_turn {
  background: linear-gradient(90deg, rgba(245, 173, 193, 0.25) 0%, rgba(103, 58, 183, 0.15) 100%);
  border-left-color: #f5adc1;
  position: relative;
}

.commentary-entry.character-m.commentary-new_turn::after {
  content: '🎮';
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 16px;
  opacity: 0.6;
}

/* 水无月伤害特效 - 略带搞笑 */
.commentary-entry.character-m.commentary-damage {
  background: linear-gradient(90deg, rgba(244, 67, 54, 0.2) 0%, rgba(255, 152, 0, 0.15) 100%);
  border-left-color: #ff5722;
  animation: mShake 0.3s ease-out;
}

@keyframes mShake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-3px); }
  75% { transform: translateX(3px); }
}

/* 水无月胜利特效 */
.commentary-entry.character-m.commentary-win {
  background: linear-gradient(90deg, rgba(76, 175, 80, 0.3) 0%, rgba(245, 173, 193, 0.2) 50%, rgba(33, 150, 243, 0.15) 100%);
  border-left-color: #4caf50;
  animation: mWin 0.6s ease-out;
}

@keyframes mWin {
  0% { transform: scale(0.9); opacity: 0; }
  60% { transform: scale(1.05); }
  100% { transform: scale(1); opacity: 1; }
}

/* 水无月抽卡特效 */
.commentary-entry.character-m.commentary-draw {
  background: linear-gradient(90deg, rgba(156, 39, 176, 0.15) 0%, rgba(245, 173, 193, 0.1) 100%);
  border-left-color: #9c27b0;
}

/* ========== 右侧面板 ========== */
.right-panel {
  width: 250px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex-shrink: 0;
}

/* ========== 连锁显示 ========== */
.chain-display {
  background: #fff3e0;
  border: 2px solid #ff9800;
  border-radius: 4px;
  padding: 8px;
}

.chain-title {
  font-weight: bold;
  color: #e65100;
  margin-bottom: 5px;
  font-size: 14px;
}

.chain-item {
  font-size: 12px;
  padding: 3px 0;
  border-bottom: 1px dashed #ffcc80;
}

.chain-item:last-child {
  border-bottom: none;
}

/* ========== 消息日志 ========== */
.message-log {
  flex: 1;
  background: #fff;
  border: 1px solid #ddd;
  border-radius: 4px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.log-title {
  background: #333;
  color: #fff;
  padding: 6px 10px;
  font-size: 13px;
  font-weight: bold;
}

.log-content {
  flex: 1;
  overflow-y: auto;
  padding: 5px;
  font-size: 11px;
  font-family: 'Consolas', monospace;
}

.log-item {
  padding: 2px 4px;
  border-bottom: 1px solid #eee;
  word-break: break-all;
}

.log-item.msg-new_turn {
  background: #e3f2fd;
  font-weight: bold;
}

.log-item.msg-new_phase {
  background: #f3e5f5;
}

.log-item.msg-summoning,
.log-item.msg-spsummoning {
  background: #fff3e0;
}

.log-item.msg-chaining {
  background: #fce4ec;
}

.log-item.msg-damage {
  background: #ffebee;
}

.log-item.msg-win {
  background: #c8e6c9;
  font-weight: bold;
}

/* ========== 卡片详情弹窗 ========== */
.card-detail-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.card-detail {
  background: #fff;
  border-radius: 8px;
  width: 320px;
  max-height: 90vh;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 15px;
  background: #333;
  color: #fff;
}

.card-header .card-name {
  font-weight: bold;
  font-size: 14px;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.close-btn {
  background: none;
  border: none;
  color: #fff;
  font-size: 24px;
  cursor: pointer;
  padding: 0;
  line-height: 1;
}

.card-body {
  padding: 15px;
}

.detail-card-img {
  width: 100%;
  max-height: 350px;
  object-fit: contain;
  border-radius: 4px;
  margin-bottom: 15px;
}

.card-info-row {
  padding: 6px 0;
  border-bottom: 1px solid #eee;
  font-size: 13px;
}

.card-info-row:last-child {
  border-bottom: none;
}

/* ========== 区域卡片查看弹窗 ========== */
.zone-view-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1500;
}

.zone-view-panel {
  background: #fff;
  border-radius: 8px;
  width: 600px;
  max-width: 90vw;
  max-height: 85vh;
  overflow: hidden;
  box-shadow: 0 4px 30px rgba(0, 0, 0, 0.4);
  display: flex;
  flex-direction: column;
}

.zone-view-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: linear-gradient(135deg, #1a237e 0%, #283593 100%);
  color: #fff;
}

.zone-view-title {
  font-weight: bold;
  font-size: 16px;
}

.zone-view-body {
  padding: 16px;
  overflow-y: auto;
  flex: 1;
  background: #f5f5f5;
}

.zone-empty {
  text-align: center;
  padding: 40px;
  color: #999;
  font-size: 14px;
}

.zone-card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));
  gap: 12px;
}

.zone-card-item {
  background: #fff;
  border-radius: 6px;
  padding: 8px;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
}

.zone-card-item:hover {
  transform: translateY(-4px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
}

.zone-card-img-wrapper {
  position: relative;
  width: 100%;
  aspect-ratio: 59/86;
  margin-bottom: 6px;
}

.zone-card-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 4px;
}

.zone-card-index {
  position: absolute;
  top: 2px;
  left: 2px;
  background: rgba(0, 0, 0, 0.7);
  color: #fff;
  font-size: 10px;
  padding: 2px 5px;
  border-radius: 3px;
}

.zone-card-name {
  font-size: 11px;
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #333;
}

/* 素材卡可点击样式 */
.clickable-material {
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
}

.clickable-material:hover {
  transform: scale(1.1);
  z-index: 10;
  box-shadow: 0 4px 16px rgba(99, 102, 241, 0.4);
}

.clickable-material:hover .material-search-hint {
  opacity: 1;
}

.material-search-hint {
  position: absolute;
  top: -6px;
  right: -6px;
  font-size: 12px;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  color: white;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s ease;
  box-shadow: 0 2px 6px rgba(99, 102, 241, 0.4);
}

/* ========== 错误提示 ========== */
.error-toast {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: #f44336;
  color: #fff;
  padding: 12px 24px;
  border-radius: 4px;
  cursor: pointer;
  z-index: 1001;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
  animation: slideUp 0.3s ease;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}

/* ========== 响应式调整 ========== */
@media (max-width: 1600px) {
  .combo-flowchart-panel {
    width: 320px;
  }
}

@media (max-width: 1400px) {
  .combo-flowchart-panel {
    width: 280px;
  }
  
  .combo-card-img {
    width: 50px;
    height: 73px;
  }
  
  .combo-card-node {
    width: 50px;
  }
}

@media (max-width: 1200px) {
  .left-panel {
    width: 140px;
  }
  
  .right-panel {
    width: 200px;
  }
  
  .combo-flowchart-panel {
    width: 240px;
  }
  
  .combo-card-img {
    width: 45px;
    height: 65px;
  }
  
  .combo-card-node {
    width: 45px;
  }
  
  .combo-card-label {
    font-size: 8px;
    padding: 1px 4px;
  }
  
  .duel-field {
    width: 550px;
    height: 620px;
  }
  
  .zone-cell {
    width: 60px;
    height: 75px;
  }
  
  .hand-card {
    width: 38px;
    height: 55px;
  }
}

@media (max-width: 900px) {
  .main-container {
    flex-direction: column;
  }
  
  .left-panel,
  .right-panel {
    width: 100%;
    flex-direction: row;
    flex-wrap: wrap;
  }
  
  .combo-flowchart-panel {
    width: 100%;
    max-height: 250px;
  }
  
  .combo-flowchart-container {
    max-height: 200px;
  }
  
  .duel-field-container {
    height: 500px;
  }
  
  .duel-field {
    transform: scale(0.7);
    transform-origin: center center;
  }
}
</style>






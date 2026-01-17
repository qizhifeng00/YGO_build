<template>
  <div class="replay-mode-player">
    <!-- 加载界面 -->
    <div v-if="isLoading" class="loading-overlay">
      <div class="loading-content">
        <div class="loading-spinner"></div>
        <div class="loading-status">{{ loadingStatus }}</div>
        <div class="loading-progress">
          <div class="progress-bar" :style="{ width: loadingProgress + '%' }"></div>
        </div>
        <div class="loading-text">{{ loadingProgressText }}</div>
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
          <button class="ctrl-btn" @click="handleStep" :disabled="!isStarted || !isPaused">⏭️ 单步</button>
          <button class="ctrl-btn" @click="handleSwapField" :disabled="!isStarted">🔄 视角</button>
          <button class="ctrl-btn" @click="handleRestart" :disabled="!isLoaded">🔁 重置</button>
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
      <div class="duel-field-container">
        <div class="duel-field">
          <!-- ========== 对手场地 (Player 1) - 上方 ========== -->
          
          <!-- 对手第一行: 卡组 + 魔陷区 + 额外卡组 -->
          <div class="field-row opponent-row-1">
            <div class="zone-cell deck-cell" @click="showZone(1, LOCATION.DECK)">
              
              <div class="zone-box solid">
                <span class="zone-label">卡组</span>
                <span class="zone-count" v-if="field.players[1].deck">{{ field.players[1].deck }}</span>
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
              <div class="zone-box solid">
                <span class="zone-label">卡组<br>额外</span>
                <span class="zone-count" v-if="field.players[1].extra">{{ field.players[1].extra }}</span>
              </div>
           
            </div>
          </div>

          <!-- 对手第二行: 墓地 + 怪兽区 -->
          <div class="field-row opponent-row-2">
            <div class="zone-cell gy-cell" @click="showZone(1, LOCATION.GRAVE)">
              <div class="zone-box solid">
                <span class="zone-label">墓地<br>GY</span>
                <span class="zone-count" v-if="field.players[1].grave.length">{{ field.players[1].grave.length }}</span>
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
            <div class="zone-box dashed banished-box">
              <span class="zone-label">除外区</span>
              <span class="zone-count" v-if="field.players[1].removed.length">{{ field.players[1].removed.length }}</span>
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

          <!-- 额外怪兽区 (中央) -->
          <div class="extra-monster-zones-center">
            <div class="emz-cell">
              <div class="zone-box dashed" :class="{ occupied: field.players[1].mzone[5] }">
                <div v-if="field.players[1].mzone[5]" class="card-in-zone"
                  :class="getCardClass(field.players[1].mzone[5])"
                  @click="showCard(field.players[1].mzone[5])">
                  <img v-if="getCardImageUrl(field.players[1].mzone[5])" 
                    :src="getCardImageUrl(field.players[1].mzone[5])" class="card-img" />
                </div>
                <span v-else class="zone-label">额外<br>怪兽</span>
              </div>
            </div>
            
            <div class="emz-cell">
              <div class="zone-box dashed" :class="{ occupied: field.players[0].mzone[6] }">
                <div v-if="field.players[0].mzone[6]" class="card-in-zone"
                  :class="getCardClass(field.players[0].mzone[6])"
                  @click="showCard(field.players[0].mzone[6])">
                  <img v-if="getCardImageUrl(field.players[0].mzone[6])" 
                    :src="getCardImageUrl(field.players[0].mzone[6])" class="card-img" />
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
            <div class="zone-box dashed banished-box">
              <span class="zone-label">除外区</span>
              <span class="zone-count" v-if="field.players[0].removed.length">{{ field.players[0].removed.length }}</span>
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
              <div class="zone-box solid">
                <span class="zone-label">墓地<br>GY</span>
                <span class="zone-count" v-if="field.players[0].grave.length">{{ field.players[0].grave.length }}</span>
              </div>
            </div>
          </div>

          <!-- 我方第二行: 魔陷区 + 卡组 -->
          <div class="field-row self-row-2">
            <div class="zone-cell extra-deck-cell" @click="showZone(0, LOCATION.EXTRA)">
             
              <div class="zone-box solid">
                <span class="zone-label">额外<br>卡组</span>
                <span class="zone-count" v-if="field.players[0].extra">{{ field.players[0].extra }}</span>
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
              <div class="zone-box solid">
                <span class="zone-label">卡组</span>
                <span class="zone-count" v-if="field.players[0].deck">{{ field.players[0].deck }}</span>
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

      <!-- 右侧面板 - 日志和连锁 -->
      <div class="right-panel">
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
            <img v-if="selectedCard.code" :src="BASE_URL + 'pics/' + selectedCard.code + '.jpg'" class="detail-card-img" @error="handleImageError" />
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
import { ref, reactive, onMounted, onUnmounted, nextTick } from 'vue'
import OCGCore from '../lib/ocgcore_wasm.js'
import LZMA from '../lib/lzma.js'

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

// 消息日志
const messages = ref([])
const maxMessages = 200

// UI
const selectedCard = ref(null)
const fileInput = ref(null)
const logContent = ref(null)

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

function getCardImageUrl(card) {
  if (!card) return null
  if (card.position & POS.FACEDOWN) return `${BASE_URL}images/back.jpg`
  if (card.code) return `${BASE_URL}pics/${card.code}.jpg`
  return null
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

// 加载卡片数据库 (使用 sql.js)
async function loadCardDatabase() {
  loadingStatus.value = '加载卡片数据库...'
  loadingProgress.value = 30

  try {
    // 动态导入 sql.js
    const initSqlJs = (await import('sql.js')).default
    const SQL = await initSqlJs({
      locateFile: () => `${BASE_URL}sql-wasm.wasm`
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

  let offset = 0

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
    try {
      replayContent = await decompressLZMA(compressedData, header.datasize, header.props)
    } catch (e) {
      console.error('LZMA decompress failed:', e)
      throw new Error('回放文件解压失败')
    }
  } else {
    replayContent = data.slice(offset, offset + header.datasize)
  }

  // 解析内容
  const contentView = new DataView(replayContent.buffer, replayContent.byteOffset, replayContent.byteLength)
  let contentOffset = 0

  // 读取玩家名称
  const players = []
  const playerCount = (header.flag & REPLAY_FLAG.TAG) ? 4 : 2
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
      const mainCount = contentView.getInt32(contentOffset, true)
      contentOffset += 4
      const main = []
      for (let j = 0; j < mainCount; j++) {
        main.push(contentView.getUint32(contentOffset, true))
        contentOffset += 4
      }

      const extraCount = contentView.getInt32(contentOffset, true)
      contentOffset += 4
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
 */
async function handlePauseCheck(pauseable) {
  if (!pauseable || isReplaySkipping.value) return

  currentStep.value++

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
  }

  // 延迟以控制播放速度
  if (playbackSpeed.value > 0) {
    await new Promise(resolve => setTimeout(resolve, playbackSpeed.value))
  }
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
 * 添加消息到日志
 */
function addMessage(msg) {
  messages.value.push({
    type: msg.type,
    typeName: getMessageName(msg.type),
    desc: msg.desc || '',
    step: currentStep.value,
    timestamp: Date.now()
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
        const winner = player === 2 ? '平局' : duelInfo.players[localPlayer(player)]
        addMessage({ type: msgType, desc: `胜利: ${winner}` })
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
        offset += count * 4
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
        addMessage({ type: msgType, desc: `回合 ${duelInfo.turn}: ${duelInfo.players[localPlayer(player)]}` })
        break
      }

      case MSG.NEW_PHASE: {
        const phase = readUint16(msg, offset)
        offset += 2
        duelInfo.phase = phase
        addMessage({ type: msgType, desc: getPhaseName(phase) })
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
        addMessage({ type: msgType, desc: `移动: ${getCardName(code)}` })
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
        offset += 8
        addMessage({ type: msgType, desc: `通常召唤: ${getCardName(code)}` })
        pauseable = false
        break
      }

      case MSG.SUMMONED: {
        addMessage({ type: msgType, desc: `召唤成功` })
        break
      }

      case MSG.SPSUMMONING: {
        const code = readUint32(msg, offset)
        offset += 8
        addMessage({ type: msgType, desc: `特殊召唤: ${getCardName(code)}` })
        pauseable = false
        break
      }

      case MSG.SPSUMMONED: {
        addMessage({ type: msgType, desc: `特殊召唤成功` })
        break
      }

      case MSG.FLIPSUMMONING: {
        const code = readUint32(msg, offset)
        offset += 8
        addMessage({ type: msgType, desc: `翻转召唤: ${getCardName(code)}` })
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
        offset += 16
        field.chains.push({ code, controller: cc, location: cl, sequence: cs })
        addMessage({ type: msgType, desc: `连锁: ${getCardName(code)}` })
        break
      }

      case MSG.CHAINED: {
        const ct = msg[offset++]
        addMessage({ type: msgType, desc: `连锁 ${ct}` })
        break
      }

      case MSG.CHAIN_SOLVING: {
        const ct = msg[offset++]
        addMessage({ type: msgType, desc: `连锁 ${ct} 处理中` })
        pauseable = false
        break
      }

      case MSG.CHAIN_SOLVED: {
        const ct = msg[offset++]
        addMessage({ type: msgType, desc: `连锁 ${ct} 处理完毕` })
        pauseable = false
        break
      }

      case MSG.CHAIN_END: {
        field.chains = []
        addMessage({ type: msgType, desc: `连锁结束` })
        pauseable = false
        break
      }

      case MSG.CHAIN_NEGATED:
      case MSG.CHAIN_DISABLED: {
        const ct = msg[offset++]
        addMessage({ type: msgType, desc: `连锁 ${ct} 被无效` })
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
        
        // 处理抽卡
        for (let i = 0; i < count; i++) {
          const code = readUint32(msg, offset)
          offset += 4
          const realCode = code & 0x7fffffff
          
          // 创建卡片并添加到手牌
          const card = createCard(realCode, player, LOCATION.HAND, field.players[player].hand.length, POS.FACEUP)
          field.players[player].hand.push(card)
          field.players[player].deck = Math.max(0, field.players[player].deck - 1)
        }
        
        addMessage({ type: msgType, desc: `${duelInfo.players[localPlayer(player)]} 抽 ${count} 张卡` })
        break
      }

      case MSG.DAMAGE: {
        const player = msg[offset++]
        const damage = readInt32(msg, offset)
        offset += 4
        duelInfo.lp[localPlayer(player)] = Math.max(0, duelInfo.lp[localPlayer(player)] - damage)
        addMessage({ type: msgType, desc: `${duelInfo.players[localPlayer(player)]} 受到 ${damage} 伤害` })
        break
      }

      case MSG.RECOVER: {
        const player = msg[offset++]
        const value = readInt32(msg, offset)
        offset += 4
        duelInfo.lp[localPlayer(player)] += value
        addMessage({ type: msgType, desc: `${duelInfo.players[localPlayer(player)]} 回复 ${value} LP` })
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
        offset += 8
        addMessage({ type: msgType, desc: `攻击宣言` })
        break
      }

      case MSG.BATTLE: {
        offset += 26
        addMessage({ type: msgType, desc: `战斗` })
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
      await handlePauseCheck(true)
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
    const card = createCard(code, cc, cl, cs, cp)
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
    // 默认暂停模式开始
    isPausing.value = true
    await startReplay(0)
  } catch (e) {
    console.error('[ReplayMode] 启动失败:', e)
    error.value = `启动失败: ${e.message}`
  }
}

function handlePause() {
  if (isPaused.value) {
    pause(false, false)
  } else {
    pause(true, false)
  }
}

function handleStep() {
  if (isStarted.value && isPaused.value) {
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
}

function handleStop() {
  stopReplay(false)
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
  z-index: 1000;
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
@media (max-width: 1200px) {
  .left-panel {
    width: 140px;
  }
  
  .right-panel {
    width: 200px;
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
  
  .duel-field-container {
    height: 500px;
  }
  
  .duel-field {
    transform: scale(0.7);
    transform-origin: center center;
  }
}
</style>


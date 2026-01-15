import { ref, computed } from 'vue'

/**
 * 小世界 (Small World) 计算逻辑
 * 
 * 小世界效果：从手牌展示一张怪兽，从卡组选择一张桥梁怪兽（与手牌怪兽恰好1个参数相同），
 * 再从卡组选择一张目标怪兽（与桥梁怪兽恰好1个参数相同），将目标怪兽加入手牌。
 * 
 * 参数包括：ATK（攻击力）、DEF（守备力）、等级（Level）、种族（Type）、属性（Attribute）
 */

// 种族选项
export const RACE_OPTIONS = [
  '战士族', '魔法使族', '天使族', '恶魔族', '不死族', '机械族',
  '水族', '炎族', '岩石族', '鸟兽族', '植物族', '昆虫族',
  '雷族', '龙族', '兽族', '兽战士族', '恐龙族', '鱼族',
  '海龙族', '爬虫族', '念动力族', '幻神兽族', '创造神族',
  '幻龙族', '电子界族'
]

// 属性选项
export const ATTRIBUTE_OPTIONS = [
  '暗', '光', '地', '水', '炎', '风', '神'
]

// 等级选项 (1-12)
export const LEVEL_OPTIONS = Array.from({ length: 12 }, (_, i) => i + 1)

/**
 * 判断两张怪兽卡是否恰好有1个参数相同（可作为小世界桥梁）
 */
export function canBridge(card1, card2) {
  if (!card1 || !card2) return false
  
  let matchCount = 0
  
  // 比较 ATK
  if (card1.atk !== null && card2.atk !== null && card1.atk === card2.atk) {
    matchCount++
  }
  
  // 比较 DEF
  if (card1.def !== null && card2.def !== null && card1.def === card2.def) {
    matchCount++
  }
  
  // 比较等级
  if (card1.level !== null && card2.level !== null && card1.level === card2.level) {
    matchCount++
  }
  
  // 比较种族
  if (card1.race && card2.race && card1.race === card2.race) {
    matchCount++
  }
  
  // 比较属性
  if (card1.attribute && card2.attribute && card1.attribute === card2.attribute) {
    matchCount++
  }
  
  return matchCount === 1
}

/**
 * 获取两张卡的匹配参数
 */
export function getMatchingParams(card1, card2) {
  if (!card1 || !card2) return []
  
  const matches = []
  
  if (card1.atk !== null && card2.atk !== null && card1.atk === card2.atk) {
    matches.push({ param: 'ATK', value: card1.atk })
  }
  if (card1.def !== null && card2.def !== null && card1.def === card2.def) {
    matches.push({ param: 'DEF', value: card1.def })
  }
  if (card1.level !== null && card2.level !== null && card1.level === card2.level) {
    matches.push({ param: '等级', value: card1.level })
  }
  if (card1.race && card2.race && card1.race === card2.race) {
    matches.push({ param: '种族', value: card1.race })
  }
  if (card1.attribute && card2.attribute && card1.attribute === card2.attribute) {
    matches.push({ param: '属性', value: card1.attribute })
  }
  
  return matches
}

/**
 * 小世界计算 Composable
 */
export function useSmallWorld() {
  // 怪兽卡列表
  const monsters = ref([])
  
  // 添加怪兽
  function addMonster(monster = null) {
    const newMonster = monster || {
      id: Date.now(),
      name: '',
      atk: null,
      def: null,
      level: null,
      race: null,
      attribute: null
    }
    monsters.value.push(newMonster)
    return newMonster
  }
  
  // 删除怪兽
  function removeMonster(id) {
    const index = monsters.value.findIndex(m => m.id === id)
    if (index !== -1) {
      monsters.value.splice(index, 1)
    }
  }
  
  // 更新怪兽
  function updateMonster(id, updates) {
    const monster = monsters.value.find(m => m.id === id)
    if (monster) {
      Object.assign(monster, updates)
    }
  }
  
  // 清空所有怪兽
  function clearMonsters() {
    monsters.value = []
  }
  
  // 计算连接矩阵（哪些卡可以相互连接）
  const connectionMatrix = computed(() => {
    const matrix = {}
    const list = monsters.value
    
    for (let i = 0; i < list.length; i++) {
      const card1 = list[i]
      matrix[card1.id] = {}
      
      for (let j = 0; j < list.length; j++) {
        if (i === j) {
          matrix[card1.id][list[j].id] = false
          continue
        }
        
        const card2 = list[j]
        matrix[card1.id][card2.id] = canBridge(card1, card2)
      }
    }
    
    return matrix
  })
  
  // 查找从起点卡到目标卡的所有可用桥梁
  function findBridges(sourceId, targetId) {
    const source = monsters.value.find(m => m.id === sourceId)
    const target = monsters.value.find(m => m.id === targetId)
    
    if (!source || !target || sourceId === targetId) {
      return []
    }
    
    const bridges = []
    
    for (const monster of monsters.value) {
      if (monster.id === sourceId || monster.id === targetId) continue
      
      const canConnectSource = canBridge(source, monster)
      const canConnectTarget = canBridge(monster, target)
      
      if (canConnectSource && canConnectTarget) {
        bridges.push({
          monster,
          sourceMatch: getMatchingParams(source, monster),
          targetMatch: getMatchingParams(monster, target)
        })
      }
    }
    
    return bridges
  }
  
  // 查找某张卡可以直接连接的所有卡
  function findDirectConnections(monsterId) {
    const monster = monsters.value.find(m => m.id === monsterId)
    if (!monster) return []
    
    return monsters.value
      .filter(m => m.id !== monsterId && canBridge(monster, m))
      .map(m => ({
        monster: m,
        matchParams: getMatchingParams(monster, m)
      }))
  }
  
  // 分析某张卡的小世界可达性
  function analyzeReachability(monsterId) {
    const monster = monsters.value.find(m => m.id === monsterId)
    if (!monster) return { direct: [], viaBridge: [], unreachable: [] }
    
    const direct = []      // 可直接连接
    const viaBridge = []   // 需要桥梁连接
    const unreachable = [] // 无法连接
    
    for (const target of monsters.value) {
      if (target.id === monsterId) continue
      
      // 检查是否可直接连接
      if (canBridge(monster, target)) {
        direct.push({
          monster: target,
          matchParams: getMatchingParams(monster, target)
        })
        continue
      }
      
      // 检查是否可通过桥梁连接
      const bridges = findBridges(monsterId, target.id)
      if (bridges.length > 0) {
        viaBridge.push({
          monster: target,
          bridges
        })
        continue
      }
      
      // 无法连接
      unreachable.push(target)
    }
    
    return { direct, viaBridge, unreachable }
  }
  
  // 保存到 localStorage
  function saveMonsters() {
    try {
      localStorage.setItem('smallWorldMonsters', JSON.stringify(monsters.value))
    } catch (error) {
      console.error('保存小世界数据失败:', error)
    }
  }
  
  // 从 localStorage 加载
  function loadMonsters() {
    try {
      const data = localStorage.getItem('smallWorldMonsters')
      if (data) {
        monsters.value = JSON.parse(data)
      }
    } catch (error) {
      console.error('加载小世界数据失败:', error)
    }
  }
  
  // 导出为 JSON
  function exportToJSON() {
    return JSON.stringify(monsters.value, null, 2)
  }
  
  // 从 JSON 导入
  function importFromJSON(jsonStr) {
    try {
      const data = JSON.parse(jsonStr)
      if (Array.isArray(data)) {
        monsters.value = data.map((m, index) => ({
          id: m.id || Date.now() + index,
          name: m.name || '',
          atk: m.atk ?? null,
          def: m.def ?? null,
          level: m.level ?? null,
          race: m.race || null,
          attribute: m.attribute || null
        }))
        return true
      }
      return false
    } catch (error) {
      console.error('导入JSON失败:', error)
      return false
    }
  }
  
  return {
    monsters,
    addMonster,
    removeMonster,
    updateMonster,
    clearMonsters,
    connectionMatrix,
    findBridges,
    findDirectConnections,
    analyzeReachability,
    saveMonsters,
    loadMonsters,
    exportToJSON,
    importFromJSON,
    // 导出常量
    RACE_OPTIONS,
    ATTRIBUTE_OPTIONS,
    LEVEL_OPTIONS
  }
}


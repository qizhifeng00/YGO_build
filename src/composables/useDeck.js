import { ref, computed } from 'vue'

// 辅助函数：生成变量名（a, b, ..., aa, ab）
export function getVarName(index) {
  if (index < 26) return String.fromCharCode(97 + index)
  return 'a' + String.fromCharCode(97 + index - 26)
}

// 辅助函数：生成卡牌标签（A, B, ..., AA, AB）
export function getCardLabel(index) {
  if (index < 26) return String.fromCharCode(65 + index)
  return `A${String.fromCharCode(65 + index - 26)}`
}

// 辅助函数：转义正则表达式特殊字符
export function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function useDeck() {
  // 30个卡牌槽位
  const cards = ref(Array.from({ length: 30 }, (_, i) => ({
    id: i,
    count: 0,
    name: '',
    label: getCardLabel(i),
    maxCount: null, // 单张卡最大上限，null 表示使用默认值 3
    cardId: null // YGOPro 卡片 ID（用于显示卡图）
  })))

  // 卡组列表
  const deckList = ref([])

  // 当前选中的卡组
  const selectedDeckId = ref(null)

  // 卡组名称
  const deckName = ref('')

  // 卡组总数（只读，自动计算）
  const totalCards = computed(() => {
    return cards.value.reduce((sum, card) => sum + (parseInt(card.count) || 0), 0)
  })

  // 获取卡牌名称映射
  const cardNameMap = computed(() => {
    const map = {}
    cards.value.forEach((card, index) => {
      if (card.name.trim()) {
        map[card.name.trim()] = getVarName(index)
      }
    })
    return map
  })

  // 获取所有卡牌名称（用于条件构建器）
  const allCardNames = computed(() => {
    const varNames = Array.from({ length: 30 }, (_, i) => getVarName(i))
    const customNames = cards.value
      .map(c => c.name.trim())
      .filter(name => name && !varNames.includes(name))
    return [...varNames, ...customNames]
  })

  // 加载卡组列表
  function loadDeckList() {
    try {
      const decks = JSON.parse(localStorage.getItem('decks') || '[]')
      deckList.value = decks
    } catch (error) {
      console.error('加载卡组列表失败:', error)
      deckList.value = []
    }
  }

  // 保存卡组
  function saveDeck(condition, conditionInputMode, builderConditionData) {
    if (!deckName.value.trim()) {
      throw new Error('请输入卡组名称')
    }

    // 检查重复卡名
    const cardNames = []
    const duplicateNames = new Set()
    cards.value.forEach(card => {
      const name = card.name.trim()
      if (name) {
        if (cardNames.includes(name)) {
          duplicateNames.add(name)
        }
        cardNames.push(name)
      }
    })
    
    if (duplicateNames.size > 0) {
      throw new Error(`卡名重复：${Array.from(duplicateNames).join(', ')}`)
    }

    const deck = {
      id: Date.now(),
      name: deckName.value.trim(),
      cards: cards.value.map(card => ({
        count: card.count,
        name: card.name,
        maxCount: card.maxCount, // 保存最大上限
        cardId: card.cardId // 保存卡片 ID（用于显示卡图）
      })),
      condition,
      conditionInputMode,
      builderConditionData
    }

    const decks = JSON.parse(localStorage.getItem('decks') || '[]')
    const existingIndex = decks.findIndex(d => d.name === deck.name)

    if (existingIndex !== -1) {
      decks[existingIndex] = deck
    } else {
      decks.push(deck)
    }

    localStorage.setItem('decks', JSON.stringify(decks))
    loadDeckList()
    deckName.value = ''
    
    return deck
  }

  // 加载卡组
  function loadDeck(deckId) {
    const decks = JSON.parse(localStorage.getItem('decks') || '[]')
    const deck = decks.find(d => d.id === deckId)
    
    if (!deck) {
      throw new Error('卡组不存在')
    }

    deck.cards.forEach((card, i) => {
      if (i < cards.value.length) {
        cards.value[i].count = card.count
        cards.value[i].name = card.name
        cards.value[i].maxCount = card.maxCount ?? null // 加载最大上限
        cards.value[i].cardId = card.cardId ?? null // 加载卡片 ID
      }
    })

    return {
      condition: deck.condition || '',
      conditionInputMode: deck.conditionInputMode || 'manual',
      builderConditionData: deck.builderConditionData || ''
    }
  }

  // 删除卡组
  function deleteDeck(deckId) {
    const decks = JSON.parse(localStorage.getItem('decks') || '[]')
    const newDecks = decks.filter(d => d.id !== deckId)
    localStorage.setItem('decks', JSON.stringify(newDecks))
    loadDeckList()
  }

  // 转换条件表达式（将卡名替换为变量名）
  function convertCondition(conditionText) {
    let condition = conditionText.trim()
    
    // 按长度从长到短排序，避免短名称替换导致长名称无法匹配
    const sortedNames = Object.keys(cardNameMap.value)
      .sort((a, b) => b.length - a.length)
    
    for (const name of sortedNames) {
      const regex = new RegExp(escapeRegExp(name), 'g')
      condition = condition.replace(regex, cardNameMap.value[name])
    }
    
    return condition
  }

  // 检查重复卡名
  function checkDuplicateCardNames() {
    const cardNames = []
    const duplicateNames = new Set()
    
    cards.value.forEach(card => {
      const name = card.name.trim()
      if (name) {
        if (cardNames.includes(name)) {
          duplicateNames.add(name)
        }
        cardNames.push(name)
      }
    })
    
    if (duplicateNames.size > 0) {
      throw new Error(`卡名重复：${Array.from(duplicateNames).join(', ')}`)
    }
  }

  // 初始化
  loadDeckList()

  return {
    cards,
    deckList,
    selectedDeckId,
    deckName,
    totalCards,
    cardNameMap,
    allCardNames,
    saveDeck,
    loadDeck,
    deleteDeck,
    convertCondition,
    checkDuplicateCardNames,
    loadDeckList
  }
}


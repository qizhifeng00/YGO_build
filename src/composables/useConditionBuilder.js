import { ref, computed } from 'vue'
import {
  parseCondition,
  conditionToString
} from '@ygo_build/calc'

const builderOperators = {
  gt: '>',
  eq: '==',
  lt: '<',
  neq: '!=',
  gte: '>=',
  lte: '<='
}

export function useConditionBuilder() {
  // 构建器根节点
  const builderRootCondition = ref(null)

  // 创建条件节点
  function createCondition(type, children, allCardNames = []) {
    if (type === 'single') {
      return {
        type: 'single',
        cards: [{ name: allCardNames[0] || 'a' }],
        symbol: 'gt',
        num: '0'
      }
    }
    return { 
      type, 
      children: children || [] 
    }
  }

  // 将解析后的条件转换为 drag 模式的结构
  // 返回 { rows: [...], globalLogic: 'and'|'or' } 或 null（无法转换时）
  function convertToDragStructure(condition, cardsList = []) {
    if (!condition) return null

    // 创建卡牌名到索引的映射
    const cardNameToIndex = {}
    cardsList.forEach((card, index) => {
      // 变量名 a, b, c... 对应索引 0, 1, 2...
      const varName = index < 26 
        ? String.fromCharCode(97 + index)
        : 'a' + String.fromCharCode(97 + index - 26)
      cardNameToIndex[varName] = index
      // 也支持自定义卡名
      if (card.name) {
        cardNameToIndex[card.name] = index
      }
      if (card.label) {
        cardNameToIndex[card.label] = index
      }
    })

    // 查找卡牌信息
    function findCard(name) {
      const index = cardNameToIndex[name]
      if (index !== undefined && cardsList[index]) {
        return { ...cardsList[index], id: index }
      }
      // 尝试匹配单字母变量名
      if (/^[a-z]$/.test(name)) {
        const idx = name.charCodeAt(0) - 97
        if (cardsList[idx]) {
          return { ...cardsList[idx], id: idx }
        }
      }
      return null
    }

    // 转换单个 single 条件为 drag row 的卡牌
    function convertSingleToRowCards(single) {
      if (single.type !== 'single') return null
      
      // 检查是否只有一张卡（不支持 a + b 这种算术组合）
      if (single.cards.length !== 1) {
        // 对于多卡组合，只能支持简单情况
        // 暂不支持 (a + b) > 0 这种格式转换到 drag
        return null
      }

      const cardInfo = findCard(single.cards[0].name)
      if (!cardInfo) return null

      return {
        cardInfo,
        operator: single.symbol,
        value: parseInt(single.num) || 0
      }
    }

    // 处理 and/or 组合，尝试转换为单个 row（同一行多卡）
    function tryConvertToSingleRow(condition) {
      if (condition.type === 'single') {
        const result = convertSingleToRowCards(condition)
        if (!result) return null
        return {
          cards: [{
            ...result.cardInfo,
            uid: Date.now() + Math.random(),
            operator: '&&'
          }],
          operator: result.operator,
          value: result.value
        }
      }

      if (condition.type === 'and' || condition.type === 'or') {
        // 检查所有子条件是否都是 single 且使用相同的比较运算符和值
        const children = condition.children
        if (children.length === 0) return null

        let commonOperator = null
        let commonValue = null
        const cards = []

        for (let i = 0; i < children.length; i++) {
          const child = children[i]
          if (child.type !== 'single') return null
          
          const result = convertSingleToRowCards(child)
          if (!result) return null

          if (commonOperator === null) {
            commonOperator = result.operator
            commonValue = result.value
          } else if (commonOperator !== result.operator || commonValue !== result.value) {
            // 运算符或值不同，无法合并到一行
            return null
          }

          cards.push({
            ...result.cardInfo,
            uid: Date.now() + Math.random(),
            operator: condition.type === 'and' ? '&&' : '||'
          })
        }

        return {
          cards,
          operator: commonOperator,
          value: commonValue
        }
      }

      return null
    }

    // 主转换逻辑
    if (condition.type === 'single') {
      const row = tryConvertToSingleRow(condition)
      if (!row) return null
      return {
        rows: [{
          id: Date.now() + Math.random(),
          ...row
        }],
        globalLogic: 'or'
      }
    }

    if (condition.type === 'and' || condition.type === 'or') {
      // 尝试将整个条件转换为单行
      const singleRow = tryConvertToSingleRow(condition)
      if (singleRow) {
        return {
          rows: [{
            id: Date.now() + Math.random(),
            ...singleRow
          }],
          globalLogic: 'or'
        }
      }

      // 否则尝试将每个子条件转换为单独的行
      const rows = []
      for (const child of condition.children) {
        const row = tryConvertToSingleRow(child)
        if (!row) {
          // 如果任何子条件无法转换，整体转换失败
          return null
        }
        rows.push({
          id: Date.now() + Math.random(),
          ...row
        })
      }

      return {
        rows,
        globalLogic: condition.type
      }
    }

    return null
  }

  // 生成条件文本（使用 ygo-build-calc 库）
  function generateConditionText(condition) {
    if (!condition) return ''
    
    try {
      return conditionToString(condition)
    } catch (error) {
      console.error('生成条件文本失败:', error)
      return ''
    }
  }

  // 验证条件文本是否可以被解析（使用 ygo-build-calc 库）
  function validateCondition(conditionStr) {
    try {
      if (!conditionStr || !conditionStr.trim()) {
        return { valid: true, error: null }
      }
      parseCondition(conditionStr)
      return { valid: true, error: null }
    } catch (e) {
      return { valid: false, error: e.message }
    }
  }

  // 解析手动输入的条件（使用 ygo-build-calc 库）
  function parseManualCondition(manualStr) {
    try {
      return parseCondition(manualStr)
    } catch (error) {
      throw new Error(`解析条件失败: ${error.message}`)
    }
  }

  // 初始化构建器
  function initBuilder(allCardNames = []) {
    builderRootCondition.value = createCondition('and', [], allCardNames)
  }

  // 设置构建器数据
  function setBuilderData(json) {
    try {
      builderRootCondition.value = JSON.parse(json)
    } catch (e) {
      console.error('解析构建器数据失败:', e)
      initBuilder()
    }
  }

  // 获取构建器数据
  function getBuilderData() {
    return builderRootCondition.value ? JSON.stringify(builderRootCondition.value) : ''
  }

  // 获取生成的条件文本
  const conditionText = computed(() => {
    return generateConditionText(builderRootCondition.value)
  })

  return {
    builderRootCondition,
    builderOperators,
    createCondition,
    generateConditionText,
    parseManualCondition,
    validateCondition,
    convertToDragStructure,
    initBuilder,
    setBuilderData,
    getBuilderData,
    conditionText
  }
}

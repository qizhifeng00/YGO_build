import { ref, computed } from 'vue'

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

  // 生成条件文本
  function generateConditionText(condition) {
    if (!condition) return ''
    
    if (condition.type === 'single') {
      const cardsText = condition.cards
        .map((c, i) => i === 0 ? c.name : `${c.operator || '+'} ${c.name}`)
        .join(' ')
      const operator = builderOperators[condition.symbol] || condition.symbol || ''
      return `(${cardsText}) ${operator} ${condition.num}`
    }

    const childrenText = condition.children
      .map(generateConditionText)
      .filter(Boolean)
    
    return childrenText.length > 1
      ? `(${childrenText.join(condition.type === 'and' ? ' && ' : ' || ')})`
      : childrenText[0] || ''
  }

  // 验证条件文本是否可以被解析
  function validateCondition(conditionStr) {
    try {
      if (!conditionStr || !conditionStr.trim()) {
        return { valid: true, error: null }
      }
      parseManualCondition(conditionStr)
      return { valid: true, error: null }
    } catch (e) {
      return { valid: false, error: e.message }
    }
  }

  // 解析手动输入的条件
  function parseManualCondition(manualStr) {
    manualStr = manualStr.trim()
    if (!manualStr) throw new Error('空的条件')

    const tokens = tokenize(manualStr)
    if (tokens.length === 0) {
      throw new Error('无法解析条件：无有效标记')
    }
    
    const parser = new Parser(tokens)
    const tree = parseExpression(parser)

    if (!parser.eof()) {
      throw new Error('无法解析条件：' + manualStr + '（剩余: ' + parser.remaining() + '）')
    }

    // 规范化结果：确保返回的是 and/or 类型的根节点
    if (tree && tree.type === 'single') {
      return { type: 'and', children: [tree] }
    }

    // 处理嵌套的 and/or 结构，展平不必要的嵌套
    return flattenCondition(tree)
  }

  // 展平条件结构（合并相同类型的嵌套）
  function flattenCondition(condition) {
    if (!condition) return condition
    
    if (condition.type === 'single') {
      return condition
    }
    
    if (condition.type === 'and' || condition.type === 'or') {
      const flatChildren = []
      for (const child of condition.children) {
        const flatChild = flattenCondition(child)
        // 如果子节点和父节点类型相同，展平它
        if (flatChild.type === condition.type) {
          flatChildren.push(...flatChild.children)
        } else {
          flatChildren.push(flatChild)
        }
      }
      return { type: condition.type, children: flatChildren }
    }
    
    return condition
  }

  // Tokenize表达式 - 增强版，支持更多字符
  function tokenize(expr) {
    // 支持：字母、数字、中文、下划线组成的标识符
    // 支持：>=, <=, ==, !=, &&, ||
    // 支持：+, -, *, /, (, ), <, >
    const regex = /\s*([A-Za-z0-9_\u4e00-\u9fa5]+|>=|<=|==|!=|&&|\|\||[-+*/()<>])\s*/g
    let tokens = []
    let m
    let lastIndex = 0
    
    while ((m = regex.exec(expr)) !== null) {
      // 检查是否有未匹配的字符
      if (m.index > lastIndex) {
        const skipped = expr.substring(lastIndex, m.index).trim()
        if (skipped) {
          throw new Error(`不支持的字符: "${skipped}"`)
        }
      }
      tokens.push(m[1])
      lastIndex = regex.lastIndex
    }
    
    // 检查末尾是否有未匹配的字符
    const remaining = expr.substring(lastIndex).trim()
    if (remaining) {
      throw new Error(`不支持的字符: "${remaining}"`)
    }
    
    return tokens
  }

  // Parser类
  class Parser {
    constructor(tokens) {
      this.tokens = tokens
      this.pos = 0
    }

    peek() {
      return this.tokens[this.pos]
    }

    consume(token) {
      if (token && this.tokens[this.pos] !== token) {
        throw new Error(`预期 ${token}，但得到 ${this.tokens[this.pos] || '结束'}`)
      }
      return this.tokens[this.pos++]
    }

    eof() {
      return this.pos >= this.tokens.length
    }

    remaining() {
      return this.tokens.slice(this.pos).join(' ')
    }
  }

  // 解析表达式
  function parseExpression(parser) {
    return parseLogicalOr(parser)
  }

  function parseLogicalOr(parser) {
    let node = parseLogicalAnd(parser)
    while (!parser.eof() && parser.peek() === '||') {
      parser.consume('||')
      const right = parseLogicalAnd(parser)
      node = { type: 'or', children: [node, right] }
    }
    return node
  }

  function parseLogicalAnd(parser) {
    let node = parseRelational(parser)
    while (!parser.eof() && parser.peek() === '&&') {
      parser.consume('&&')
      const right = parseRelational(parser)
      node = { type: 'and', children: [node, right] }
    }
    return node
  }

  function parseRelational(parser) {
    let left = parseSum(parser)
    
    // 如果 left 已经是一个条件对象（从括号表达式返回），直接返回
    if (left && typeof left === 'object' && (left.type === 'single' || left.type === 'and' || left.type === 'or')) {
      return left
    }
    
    if (!parser.eof() && /^(>=|<=|==|!=|>|<)$/.test(parser.peek())) {
      const op = parser.consume()
      const num = parser.consume()
      if (!/^\d+$/.test(num)) {
        throw new Error(`预期数字，但得到 ${num || '结束'}`)
      }

      let cards = []
      if (Array.isArray(left)) {
        cards.push({ name: left[0] })
        for (let i = 1; i < left.length; i += 2) {
          let operator = left[i]
          let operand = left[i + 1]
          cards.push({ operator, name: operand })
        }
      } else if (typeof left === 'string') {
        cards.push({ name: left })
      } else {
        throw new Error(`无法解析表达式左侧: ${JSON.stringify(left)}`)
      }

      return { type: 'single', cards: cards, symbol: mapOperator(op), num: num }
    }
    return left
  }

  function parseSum(parser) {
    if (parser.peek() === '(') {
      parser.consume('(')
      
      // 尝试解析括号内的内容
      // 先尝试作为完整表达式解析（处理 drag 模式的格式如 (a >= 1)）
      const startPos = parser.pos
      try {
        const node = parseExpression(parser)
        if (parser.peek() === ')') {
          parser.consume(')')
          return node
        }
      } catch (e) {
        // 解析失败，回溯
        parser.pos = startPos
      }
      
      // 如果不是完整表达式，作为操作数求和解析（处理 builder 模式的格式如 (a + b)）
      parser.pos = startPos
      let items = []
      items.push(parser.consume())
      while (!parser.eof() && (parser.peek() === '+' || parser.peek() === '-' || parser.peek() === '*' || parser.peek() === '/')) {
        let operator = parser.consume()
        items.push(operator)
        items.push(parser.consume())
      }
      parser.consume(')')
      return items.length === 1 ? items[0] : items
    }

    // 没有括号，直接解析标识符或数字
    let items = []
    items.push(parser.consume())
    while (!parser.eof() && (parser.peek() === '+' || parser.peek() === '-' || parser.peek() === '*' || parser.peek() === '/')) {
      let operator = parser.consume()
      items.push(operator)
      items.push(parser.consume())
    }
    return items.length === 1 ? items[0] : items
  }

  function mapOperator(op) {
    const opMap = {
      '>': 'gt',
      '<': 'lt',
      '==': 'eq',
      '!=': 'neq',
      '>=': 'gte',
      '<=': 'lte'
    }
    if (!opMap[op]) throw new Error('不支持的运算符：' + op)
    return opMap[op]
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


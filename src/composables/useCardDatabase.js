import { ref, shallowRef } from 'vue'
import initSqlJs from 'sql.js'

/**
 * Card Database Composable
 * 用于读取 cards.cdb (SQLite) 数据库并查询卡片信息
 */

// 种族映射 (race 字段是位掩码)
const RACE_MAP = {
  0x1: '战士族',
  0x2: '魔法使族',
  0x4: '天使族',
  0x8: '恶魔族',
  0x10: '不死族',
  0x20: '机械族',
  0x40: '水族',
  0x80: '炎族',
  0x100: '岩石族',
  0x200: '鸟兽族',
  0x400: '植物族',
  0x800: '昆虫族',
  0x1000: '雷族',
  0x2000: '龙族',
  0x4000: '兽族',
  0x8000: '兽战士族',
  0x10000: '恐龙族',
  0x20000: '鱼族',
  0x40000: '海龙族',
  0x80000: '爬虫族',
  0x100000: '念动力族',
  0x200000: '幻神兽族',
  0x400000: '创造神族',
  0x800000: '幻龙族',
  0x1000000: '电子界族'
}

// 属性映射 (attribute 字段)
const ATTRIBUTE_MAP = {
  0x1: '地',
  0x2: '水',
  0x4: '炎',
  0x8: '风',
  0x10: '光',
  0x20: '暗',
  0x40: '神'
}

// 卡片类型掩码
const TYPE_MONSTER = 0x1
const TYPE_SPELL = 0x2
const TYPE_TRAP = 0x4

// 单例模式
let dbInstance = null
let sqlPromise = null

/**
 * 初始化 SQL.js (ESM 导入，本地 WASM)
 */
async function initSql() {
  if (!sqlPromise) {
    sqlPromise = (async () => {
      // 初始化，WASM 文件从本地 public 目录加载
      const basePath = import.meta.env.BASE_URL || '/'
      const SQL = await initSqlJs({
        locateFile: () => `${basePath}sql-wasm.wasm`
      })
      return SQL
    })()
  }
  return sqlPromise
}

/**
 * 卡片数据库 Composable
 */
export function useCardDatabase() {
  const isLoading = ref(false)
  const isLoaded = ref(false)
  const error = ref(null)
  const db = shallowRef(null)

  /**
   * 加载数据库（从文件或 URL）
   */
  async function loadDatabase(source) {
    if (isLoading.value) return false
    
    isLoading.value = true
    error.value = null
    
    try {
      const SQL = await initSql()
      
      let buffer
      if (source instanceof ArrayBuffer) {
        buffer = new Uint8Array(source)
      } else if (source instanceof File) {
        buffer = new Uint8Array(await source.arrayBuffer())
      } else if (typeof source === 'string') {
        // URL
        const response = await fetch(source)
        buffer = new Uint8Array(await response.arrayBuffer())
      } else {
        throw new Error('不支持的数据源类型')
      }
      
      // 关闭之前的数据库连接
      if (dbInstance) {
        dbInstance.close()
      }
      
      dbInstance = new SQL.Database(buffer)
      db.value = dbInstance
      isLoaded.value = true
      return true
    } catch (e) {
      console.error('加载数据库失败:', e)
      error.value = e.message
      return false
    } finally {
      isLoading.value = false
    }
  }

  /**
   * 从项目根目录加载 cards.cdb
   */
  async function loadDefaultDatabase() {
    const basePath = import.meta.env.BASE_URL || '/'
    return loadDatabase(`${basePath}cards.cdb`)
  }

  /**
   * 根据卡片 ID 查询单张卡片信息
   */
  function getCardById(id) {
    if (!dbInstance) return null
    
    try {
      const stmt = dbInstance.prepare(`
        SELECT d.id, t.name, t.desc, d.type, d.atk, d.def, d.level, d.race, d.attribute, d.alias
        FROM datas d
        JOIN texts t ON d.id = t.id
        WHERE d.id = ?
      `)
      stmt.bind([id])
      
      if (stmt.step()) {
        const row = stmt.getAsObject()
        stmt.free()
        return parseCardData(row)
      }
      stmt.free()
      return null
    } catch (e) {
      console.error('查询卡片失败:', e)
      return null
    }
  }

  /**
   * 批量查询多张卡片信息
   */
  function getCardsByIds(ids) {
    if (!dbInstance || !ids || ids.length === 0) return new Map()
    
    const result = new Map()
    const uniqueIds = [...new Set(ids)]
    
    try {
      // 分批查询，避免 SQL 语句过长
      const batchSize = 100
      for (let i = 0; i < uniqueIds.length; i += batchSize) {
        const batch = uniqueIds.slice(i, i + batchSize)
        const placeholders = batch.map(() => '?').join(',')
        
        const stmt = dbInstance.prepare(`
          SELECT d.id, t.name, t.desc, d.type, d.atk, d.def, d.level, d.race, d.attribute, d.alias
          FROM datas d
          JOIN texts t ON d.id = t.id
          WHERE d.id IN (${placeholders})
        `)
        stmt.bind(batch)
        
        while (stmt.step()) {
          const row = stmt.getAsObject()
          const card = parseCardData(row)
          result.set(card.id, card)
        }
        stmt.free()
      }
      
      return result
    } catch (e) {
      console.error('批量查询卡片失败:', e)
      return result
    }
  }

  /**
   * 根据卡名精确查找卡片
   */
  function getCardByName(name) {
    if (!dbInstance || !name) return null
    
    try {
      const stmt = dbInstance.prepare(`
        SELECT d.id, t.name, t.desc, d.type, d.atk, d.def, d.level, d.race, d.attribute, d.alias
        FROM datas d
        JOIN texts t ON d.id = t.id
        WHERE t.name = ?
        LIMIT 1
      `)
      stmt.bind([name])
      
      if (stmt.step()) {
        const row = stmt.getAsObject()
        stmt.free()
        return parseCardData(row)
      }
      stmt.free()
      return null
    } catch (e) {
      console.error('按名称查询卡片失败:', e)
      return null
    }
  }

  /**
   * 搜索卡片（按名称）
   */
  function searchCards(keyword, limit = 50) {
    if (!dbInstance || !keyword) return []
    
    try {
      const stmt = dbInstance.prepare(`
        SELECT d.id, t.name, t.desc, d.type, d.atk, d.def, d.level, d.race, d.attribute, d.alias
        FROM datas d
        JOIN texts t ON d.id = t.id
        WHERE t.name LIKE ?
        LIMIT ?
      `)
      stmt.bind([`%${keyword}%`, limit])
      
      const results = []
      while (stmt.step()) {
        const row = stmt.getAsObject()
        results.push(parseCardData(row))
      }
      stmt.free()
      return results
    } catch (e) {
      console.error('搜索卡片失败:', e)
      return []
    }
  }

  /**
   * 解析卡片数据，转换种族和属性
   */
  function parseCardData(row) {
    const level = row.level & 0xff // 等级在低8位
    const isMonster = (row.type & TYPE_MONSTER) !== 0
    
    return {
      id: row.id,
      name: row.name || `Card #${row.id}`,
      desc: row.desc,
      type: row.type,
      atk: isMonster ? row.atk : null,
      def: isMonster ? row.def : null,
      level: isMonster ? level : null,
      race: isMonster ? (RACE_MAP[row.race] || null) : null,
      attribute: isMonster ? (ATTRIBUTE_MAP[row.attribute] || null) : null,
      alias: row.alias,
      isMonster,
      isSpell: (row.type & TYPE_SPELL) !== 0,
      isTrap: (row.type & TYPE_TRAP) !== 0
    }
  }

  /**
   * 关闭数据库连接
   */
  function closeDatabase() {
    if (dbInstance) {
      dbInstance.close()
      dbInstance = null
      db.value = null
      isLoaded.value = false
    }
  }

  return {
    isLoading,
    isLoaded,
    error,
    loadDatabase,
    loadDefaultDatabase,
    getCardById,
    getCardByName,
    getCardsByIds,
    searchCards,
    closeDatabase
  }
}

/**
 * 解析 YDK 文件内容
 * @param {string} content - YDK 文件文本内容
 * @returns {{ main: number[], extra: number[], side: number[] }}
 */
export function parseYdkContent(content) {
  const main = []
  const extra = []
  const side = []
  let currentSection = null
  
  const lines = content.split(/\r?\n/)
  
  for (const line of lines) {
    const trimmed = line.trim()
    
    // 跳过空行和注释
    if (!trimmed || trimmed.startsWith('#created')) continue
    
    // 检测区块标签
    if (trimmed.toLowerCase() === '#main') {
      currentSection = main
      continue
    } else if (trimmed.toLowerCase() === '#extra') {
      currentSection = extra
      continue
    } else if (trimmed.toLowerCase() === '!side') {
      currentSection = side
      continue
    }
    
    // 解析卡片 ID
    if (currentSection !== null && /^\d+$/.test(trimmed)) {
      const cardId = parseInt(trimmed, 10)
      if (cardId > 0) {
        currentSection.push(cardId)
      }
    }
  }
  
  return { main, extra, side }
}



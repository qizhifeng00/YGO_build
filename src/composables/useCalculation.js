import { ref } from 'vue'
import {
  generateExactWorkerCode,
  generateMonteCarloWorkerCode
} from '@ygo_build/calc'

const MAX_STORAGE_SIZE = 5 * 1024 * 1024 // 5MB

export function useCalculation() {
  // 计算状态
  const isCalculating = ref(false)
  const calculationProgress = ref(0)
  const calculationStartTime = ref(0)
  const elapsedSeconds = ref(0)
  const progressText = ref('等待计算...')

  // 计算结果
  const probability = ref('')
  const validCombinations = ref('')
  const totalCombinations = ref('')

  // Worker引用
  let calculationWorker = null
  let progressUpdateInterval = null

  // 获取计算用时
  function updateElapsedTime() {
    elapsedSeconds.value = Math.floor((Date.now() - calculationStartTime.value) / 1000)
  }

  // 更新进度
  function updateProgress(progress, method = '计算中') {
    calculationProgress.value = progress
    updateElapsedTime()
    progressText.value = `${method}: ${progress}%  计算用时: ${elapsedSeconds.value}秒`
  }

  // 开始计算
  function startCalculation() {
    isCalculating.value = true
    calculationStartTime.value = Date.now()
    calculationProgress.value = 0
    elapsedSeconds.value = 0
    probability.value = '计算中...'
    validCombinations.value = '计算中...'
    totalCombinations.value = '计算中...'

    // 启动定时器更新用时
    progressUpdateInterval = setInterval(() => {
      updateElapsedTime()
      progressText.value = `计算中: ${calculationProgress.value}%  计算用时: ${elapsedSeconds.value}秒`
    }, 1000)
  }

  // 结束计算
  function finalizeCalculation(result) {
    clearInterval(progressUpdateInterval)
    progressUpdateInterval = null
    isCalculating.value = false

    const prob = (Number(result.valid) / Number(result.total)) * 100
    updateElapsedTime()

    probability.value = `${prob.toFixed(20)}%`
    validCombinations.value = result.valid.toString()
    totalCombinations.value = result.total.toString()
    calculationProgress.value = 100
    
    const method = result.calculationMethod || '精确计算'
    progressText.value = `${method}完成: 100%  计算用时: ${elapsedSeconds.value}秒`

    // 保存计算记录
    saveCalculationRecord(result)
  }

  // 显示错误
  function showError(message) {
    clearInterval(progressUpdateInterval)
    progressUpdateInterval = null
    isCalculating.value = false

    probability.value = '计算错误'
    validCombinations.value = '计算错误'
    totalCombinations.value = '计算错误'
    updateElapsedTime()
    calculationProgress.value = 0
    progressText.value = `计算错误  计算用时: ${elapsedSeconds.value}秒`

    // 保存错误记录
    saveCalculationRecord({}, message)

    return message
  }

  // 取消计算
  function cancelCalculation() {
    clearInterval(progressUpdateInterval)
    progressUpdateInterval = null
    updateElapsedTime()

    if (calculationWorker) {
      calculationWorker.terminate()
      calculationWorker = null
    }

    calculationProgress.value = 0
    progressText.value = `计算已取消  计算用时: ${elapsedSeconds.value}秒`
    isCalculating.value = false
  }

  // 精确计算（使用 ygo-build-calc 库生成的 Worker 代码）
  function calculate(cardCounts, draws, condition, cards) {
    return new Promise((resolve, reject) => {
      startCalculation()

      try {
        // 使用库生成 Worker 代码
        const workerCode = generateExactWorkerCode()
        const blob = new Blob([workerCode], { type: 'text/javascript' })
        calculationWorker = new Worker(URL.createObjectURL(blob))

        calculationWorker.onmessage = (e) => {
          if (e.data.type === 'progress') {
            updateProgress(e.data.progress, '精确计算中')
          } else if (e.data.type === 'result') {
            finalizeCalculation({ ...e.data, calculationMethod: '精确计算' })
            resolve(e.data)
          } else if (e.data.type === 'error') {
            const error = showError(e.data.message)
            reject(new Error(error))
          }
        }

        calculationWorker.postMessage({ cardCounts, draws, condition })
      } catch (error) {
        const errorMsg = showError(error.message)
        reject(new Error(errorMsg))
      }
    })
  }

  // 蒙特卡洛模拟（使用 ygo-build-calc 库生成的 Worker 代码）
  function monteCarloCalculate(cardCounts, draws, condition, cards) {
    return new Promise((resolve, reject) => {
      startCalculation()

      try {
        // 使用库生成 Worker 代码
        const workerCode = generateMonteCarloWorkerCode()
        const blob = new Blob([workerCode], { type: 'text/javascript' })
        calculationWorker = new Worker(URL.createObjectURL(blob))

        calculationWorker.onmessage = (e) => {
          if (e.data.type === 'progress') {
            updateProgress(e.data.progress, '蒙特卡洛模拟计算中')
          } else if (e.data.type === 'result') {
            finalizeCalculation(e.data)
            resolve(e.data)
          } else if (e.data.type === 'error') {
            const error = showError(e.data.message)
            reject(new Error(error))
          }
        }

        calculationWorker.postMessage({ 
          cardCounts, 
          draws, 
          condition,
          simulations: 100000 // 默认模拟10万次
        })
      } catch (error) {
        const errorMsg = showError(error.message)
        reject(new Error(errorMsg))
      }
    })
  }

  // 保存计算记录
  function saveCalculationRecord(result, errorMessage = null) {
    try {
      const records = JSON.parse(localStorage.getItem('calculationRecords') || '[]')
      
      const record = {
        date: new Date().toLocaleString(),
        probability: errorMessage ? '计算错误' : probability.value,
        validCombinations: errorMessage ? '计算错误' : validCombinations.value,
        totalCombinations: errorMessage ? '计算错误' : totalCombinations.value,
        calculationMethod: result.calculationMethod || '精确计算',
        errorMessage
      }

      const newSize = JSON.stringify([...records, record]).length * 2
      if (newSize > MAX_STORAGE_SIZE) {
        console.warn('存储空间不足，无法保存计算记录')
        return
      }

      records.push(record)
      localStorage.setItem('calculationRecords', JSON.stringify(records))
    } catch (error) {
      console.error('保存计算记录失败:', error)
    }
  }

  // 导出计算记录
  function exportCalculationRecords() {
    const records = JSON.parse(localStorage.getItem('calculationRecords') || '[]')
    if (records.length === 0) {
      throw new Error('没有可导出的计算记录')
    }

    const headers = ['日期', '概率', '满足条件的组合数', '总组合数', '计算方式']
    
    function csvEscape(str) {
      if (str == null) return ''
      str = String(str)
      str = str.replace(/"/g, '""')
      if (/[",\r\n]/.test(str)) {
        str = `"${str}"`
      }
      return str
    }

    const rows = records.map(record => [
      csvEscape(record.date),
      csvEscape(record.probability),
      csvEscape(record.validCombinations),
      csvEscape(record.totalCombinations),
      csvEscape(record.calculationMethod)
    ])

    const BOM = '\uFEFF'
    const csvContent = BOM + [headers.join(','), ...rows.map(row => row.join(','))].join('\n')

    return csvContent
  }

  // 清除计算记录
  function clearCalculationRecords() {
    localStorage.removeItem('calculationRecords')
  }

  return {
    isCalculating,
    calculationProgress,
    elapsedSeconds,
    progressText,
    probability,
    validCombinations,
    totalCombinations,
    calculate,
    monteCarloCalculate,
    cancelCalculation,
    exportCalculationRecords,
    clearCalculationRecords
  }
}

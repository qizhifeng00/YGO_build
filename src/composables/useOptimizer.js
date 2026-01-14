import { ref } from 'vue'
import { generateOptimizerWorkerCode, applyPlan as applyPlanCalc } from '@ygo_build/calc'

/**
 * 卡组优化器（使用 ygo-build-calc 库的 Worker）
 */
export function useOptimizer() {
  // 优化状态
  const isOptimizing = ref(false)
  const optimizeProgress = ref(0)
  const progressText = ref('')
  
  // 三类方案
  const keepDeckPlans = ref([])   // 保持卡组总数
  const expandDeckPlans = ref([]) // 拓展卡组总数
  const reduceDeckPlans = ref([]) // 减少卡组总数
  const totalPlansCount = ref(0)

  // Worker 引用
  let optimizerWorker = null

  // 取消优化
  function cancelOptimize() {
    if (optimizerWorker) {
      optimizerWorker.terminate()
      optimizerWorker = null
    }
    isOptimizing.value = false
    optimizeProgress.value = 0
    progressText.value = '已取消'
  }

  // 生成调整方案（使用 ygo-build-calc 库的 Worker）
  function generateOptimizePlans(cards, condition, draws, targetRate) {
    return new Promise((resolve, reject) => {
      isOptimizing.value = true
      optimizeProgress.value = 0
      progressText.value = '正在初始化...'
      keepDeckPlans.value = []
      expandDeckPlans.value = []
      reduceDeckPlans.value = []
      totalPlansCount.value = 0

      // 获取当前卡组数据
      const currentCounts = cards.map((c) => c.count)
      const totalCards = currentCounts.reduce((a, b) => a + b, 0)

      if (totalCards === 0) {
        isOptimizing.value = false
        reject(new Error('卡组为空，请先添加卡牌'))
        return
      }

      if (!condition || condition.trim() === '') {
        isOptimizing.value = false
        reject(new Error('请先设置展开条件'))
        return
      }

      // 准备卡牌数据
      const cardsData = cards.map((c) => ({
        count: c.count,
        name: c.name,
        label: c.label,
        maxCount: c.maxCount ?? 3 // 最大上限，默认3
      }))

      try {
        // 使用库生成优化器 Worker 代码
        const workerCode = generateOptimizerWorkerCode()
        const blob = new Blob([workerCode], { type: 'text/javascript' })
        optimizerWorker = new Worker(URL.createObjectURL(blob))

        optimizerWorker.onmessage = (e) => {
          if (e.data.type === 'progress') {
            optimizeProgress.value = e.data.progress
            progressText.value = e.data.text || `优化中 ${e.data.progress}%`
          } else if (e.data.type === 'result') {
            // 更新结果
            keepDeckPlans.value = e.data.keepDeckPlans || []
            expandDeckPlans.value = e.data.expandDeckPlans || []
            reduceDeckPlans.value = e.data.reduceDeckPlans || []
            totalPlansCount.value = e.data.totalPlansCount || 0
            
            isOptimizing.value = false
            optimizeProgress.value = 100
            progressText.value = '优化完成！'
            
            resolve(e.data)
          } else if (e.data.type === 'error') {
            isOptimizing.value = false
            progressText.value = '优化失败'
            reject(new Error(e.data.message))
          }
        }

        optimizerWorker.onerror = (error) => {
          isOptimizing.value = false
          progressText.value = '优化失败'
          reject(error)
        }

        // 发送数据到 Worker
        optimizerWorker.postMessage({
          cardsData,
          condition,
          draws,
          targetRate,
          simulations: 30000 // 每次模拟3万次
        })
      } catch (error) {
        isOptimizing.value = false
        progressText.value = '优化失败'
        reject(error)
      }
    })
  }

  // 应用方案到卡组（使用 ygo-build-calc 库）
  function applyPlan(plan, cards) {
    applyPlanCalc(plan, cards)
  }

  return {
    isOptimizing,
    optimizeProgress,
    progressText,
    keepDeckPlans,
    expandDeckPlans,
    reduceDeckPlans,
    totalPlansCount,
    generateOptimizePlans,
    applyPlan,
    cancelOptimize
  }
}

import { ref, computed } from 'vue'

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

  // 精确计算
  function calculate(cardCounts, draws, condition, cards) {
    return new Promise((resolve, reject) => {
      startCalculation()

      try {
        // 创建Worker
        const workerCode = `
          const combinationCache = new Map();
          
          function combination(n, k) {
            if (k < 0 || k > n) return 0n;
            if (k === 0n || k === n) return 1n;
            
            const key = \`\${n},\${k}\`;
            if (combinationCache.has(key)) return combinationCache.get(key);
            
            let result = 1n;
            for (let i = 1n; i <= BigInt(k); i++) {
              result = result * (BigInt(n) - BigInt(k) + i) / i;
            }
            
            combinationCache.set(key, result);
            return result;
          }

          function varToIndex(varName) {
            const lc = varName.toLowerCase();
            if (lc.length === 1) {
              const code = lc.charCodeAt(0) - 97;
              if (code >= 0 && code < 26) return code;
            }
            if (lc.length === 2 && lc[0] === 'a') {
              const code = lc.charCodeAt(1) - 97;
              if (code >= 0 && code < 4) return 26 + code;
            }
            throw new Error(\`无效的卡名称: \${varName}\`);
          }

          function calculateProbability(cardCounts, draws, condition) {
            const totalCards = cardCounts.reduce((a, b) => a + b, 0);
            let valid = 0n, total = 0n;
            let lastReportedProgress = 0;

            const conditionFunc = new Function('counts', \`return \${condition.replace(/([a-zA-Z]+)/g, (m) => \`counts[\${varToIndex(m)}]\`)}\`);

            function recurse(index, counts, remaining) {
              if (index === cardCounts.length) {
                if (remaining !== 0) return;
                
                let prob = 1n;
                for (let i = 0; i < counts.length; i++) {
                  prob *= combination(cardCounts[i], counts[i]);
                }
                
                total += prob;
                if (conditionFunc(counts)) valid += prob;
                return;
              }

              const progress = Math.min(100, Math.floor((index / cardCounts.length) * 100));
              if (progress > lastReportedProgress) {
                lastReportedProgress = progress;
                postMessage({ type: 'progress', progress });
              }

              const max = Math.min(cardCounts[index], remaining);
              for (let k = 0; k <= max; k++) {
                counts[index] = k;
                recurse(index + 1, [...counts], remaining - k);
              }
            }

            recurse(0, [], draws);
            return { valid, total };
          }

          onmessage = function(e) {
            const { cardCounts, draws, condition } = e.data;
            try {
              const result = calculateProbability(cardCounts, draws, condition);
              postMessage({ type: 'result', ...result });
            } catch (error) {
              postMessage({ type: 'error', message: error.message });
            }
          };
        `

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

  // 蒙特卡洛模拟
  function monteCarloCalculate(cardCounts, draws, condition, cards) {
    return new Promise((resolve, reject) => {
      startCalculation()

      try {
        const workerCode = `
          function varToIndex(varName) {
            const lc = varName.toLowerCase();
            if (lc.length === 1) {
              const code = lc.charCodeAt(0) - 97;
              if (code >= 0 && code < 26) return code;
            }
            if (lc.length === 2 && lc[0] === 'a') {
              const code = lc.charCodeAt(1) - 97;
              if (code >= 0 && code < 4) return 26 + code;
            }
            throw new Error("无效的卡名称: " + varName);
          }

          function drawCards(shuffledDeck, draws) {
            let counts = Array(30).fill(0);
            const drawn = shuffledDeck.slice(0, draws);
            drawn.forEach(idx => { counts[idx]++; });
            return counts;
          }

          function shuffleArray(arr) {
            let array = arr.slice();
            for (let i = array.length - 1; i > 0; i--) {
              let j = Math.floor(Math.random() * (i + 1));
              [array[i], array[j]] = [array[j], array[i]];
            }
            return array;
          }

          onmessage = function(e) {
            const { cardCounts, draws, condition } = e.data;
            
            let deck = [];
            for (let i = 0; i < cardCounts.length; i++) {
              for (let j = 0; j < cardCounts[i]; j++) {
                deck.push(i);
              }
            }
            
            if (deck.length === 0) {
              postMessage({ type: 'result', valid: 0, total: 500000, calculationMethod: "蒙特卡洛模拟" });
              return;
            }

            const totalSimulations = 500000;
            let valid = 0;
            
            const replacedCondition = condition.replace(/([a-zA-Z]+)/g, function(m) {
              return "counts[" + varToIndex(m) + "]";
            });
            const conditionFunc = new Function("counts", "return " + replacedCondition);
            
            let iter = 0;
            let lastReported = 0;

            function runChunk() {
              const chunkSize = 5000;
              for (let i = 0; i < chunkSize && iter < totalSimulations; i++, iter++) {
                const shuffled = shuffleArray(deck);
                const result = drawCards(shuffled, draws);
                if (conditionFunc(result)) valid++;
              }
              
              const progress = Math.floor((iter / totalSimulations) * 100);
              if (progress > lastReported) {
                lastReported = progress;
                postMessage({ type: 'progress', progress });
              }
              
              if (iter < totalSimulations) {
                setTimeout(runChunk, 0);
              } else {
                postMessage({ type: 'result', valid, total: totalSimulations, calculationMethod: "蒙特卡洛模拟" });
              }
            }
            
            runChunk();
          };
        `

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

        calculationWorker.postMessage({ cardCounts, draws, condition })
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


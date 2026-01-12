import { ref } from 'vue'

/**
 * 卡组优化器（Web Worker 版本）
 * 根据目标启动率，生成卡组调整方案
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

  // 生成调整方案（使用 Web Worker）
  // 自动根据当前概率和目标概率判断优化方向
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

      // 序列化卡牌信息
      const cardsData = cards.map((c) => ({
        count: c.count,
        name: c.name,
        label: c.label,
        maxCount: c.maxCount ?? 3 // 最大上限，默认3
      }))

      // 创建 Worker
      const workerCode = `
        // 变量名转索引
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
          throw new Error('无效的卡名称: ' + varName);
        }

        // 洗牌
        function shuffleArray(arr) {
          const array = arr.slice();
          for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
          }
          return array;
        }

        // 抽卡并统计
        function drawCards(shuffledDeck, draws, cardTypeCount) {
          const counts = Array(cardTypeCount).fill(0);
          const drawn = shuffledDeck.slice(0, draws);
          drawn.forEach((idx) => {
            counts[idx]++;
          });
          return counts;
        }

        // 快速蒙特卡洛计算
        function quickMonteCarlo(cardCounts, draws, conditionFunc, simulations) {
          let deck = [];
          for (let i = 0; i < cardCounts.length; i++) {
            for (let j = 0; j < cardCounts[i]; j++) {
              deck.push(i);
            }
          }

          if (deck.length === 0 || deck.length < draws) {
            return 0;
          }

          let valid = 0;
          for (let i = 0; i < simulations; i++) {
            const shuffled = shuffleArray(deck);
            const counts = drawCards(shuffled, draws, cardCounts.length);
            try {
              if (conditionFunc(counts)) valid++;
            } catch (e) {
              // 忽略条件执行错误
            }
          }

          return (valid / simulations) * 100;
        }

        // 解析条件中使用的变量
        function parseConditionVariables(condition) {
          const varRegex = /([a-zA-Z]+)/g;
          const variables = new Set();
          let match;
          while ((match = varRegex.exec(condition)) !== null) {
            try {
              const idx = varToIndex(match[1]);
              variables.add(idx);
            } catch {
              // 忽略无效变量
            }
          }
          return Array.from(variables);
        }

        // 主处理函数
        onmessage = function(e) {
          const { cardsData, condition, draws, targetRate, simulations } = e.data;
          
          try {
            const currentCounts = cardsData.map(c => c.count);
            const totalCards = currentCounts.reduce((a, b) => a + b, 0);

            // 构建条件函数
            const replacedCondition = condition.replace(/([a-zA-Z]+)/g, (m) => {
              return 'counts[' + varToIndex(m) + ']';
            });
            const conditionFunc = new Function('counts', 'return ' + replacedCondition);

            postMessage({ type: 'progress', progress: 5, text: '计算当前启动率...' });

            // 计算当前概率
            const currentRate = quickMonteCarlo(currentCounts, draws, conditionFunc, simulations);
            
            // 自动判断优化方向：当前概率 < 目标概率时提高，否则降低
            const direction = currentRate < targetRate ? 'increase' : 'decrease';
            
            postMessage({ type: 'progress', progress: 15, text: '分析卡组结构（' + (direction === 'increase' ? '提高' : '降低') + '模式）...' });

            // 解析条件中使用的卡牌
            const conditionVars = parseConditionVariables(condition);
            
            // 找出关键卡和非关键卡
            const keyCards = [];
            const nonKeyCards = [];
            
            cardsData.forEach((card, index) => {
              if (card.count > 0) {
                if (conditionVars.includes(index)) {
                  keyCards.push({ index, card, isKey: true });
                } else {
                  nonKeyCards.push({ index, card, isKey: false });
                }
              }
            });

            postMessage({ type: 'progress', progress: 20, text: '生成调整方案...' });

            // 生成调整方案
            const plans = [];

            if (direction === 'increase') {
              // ===== 提高启动率的方案 =====
              
              // 方案类型1：增加关键卡数量
              for (const keyCard of keyCards) {
                const keyMaxCount = keyCard.card.maxCount;
                if (keyCard.card.count < keyMaxCount) {
                  const maxAdd = keyMaxCount - keyCard.card.count;
                  for (let add = 1; add <= maxAdd; add++) {
                    for (const nonKey of nonKeyCards) {
                      if (nonKey.card.count >= add) {
                        const newCounts = [...currentCounts];
                        newCounts[keyCard.index] += add;
                        newCounts[nonKey.index] -= add;

                        plans.push({
                          type: 'increase_key',
                          description: '增加「' + (keyCard.card.name || keyCard.card.label) + '」' + add + '张，减少「' + (nonKey.card.name || nonKey.card.label) + '」' + add + '张',
                          changes: [
                            { card: keyCard.card, change: +add },
                            { card: nonKey.card, change: -add }
                          ],
                          newCounts,
                          priority: 1
                        });
                      }
                    }
                  }
                }
              }

              // 方案类型2：多个关键卡同时增加
              if (keyCards.length >= 2) {
                for (let i = 0; i < keyCards.length; i++) {
                  for (let j = i + 1; j < keyCards.length; j++) {
                    const card1 = keyCards[i];
                    const card2 = keyCards[j];
                    const card1MaxCount = card1.card.maxCount;
                    const card2MaxCount = card2.card.maxCount;
                    if (card1.card.count < card1MaxCount && card2.card.count < card2MaxCount) {
                      const totalReduce = 2;
                      for (const nonKey of nonKeyCards) {
                        if (nonKey.card.count >= totalReduce) {
                          const newCounts = [...currentCounts];
                          newCounts[card1.index] += 1;
                          newCounts[card2.index] += 1;
                          newCounts[nonKey.index] -= totalReduce;

                          plans.push({
                            type: 'increase_multi_key',
                            description: '增加「' + (card1.card.name || card1.card.label) + '」1张 + 「' + (card2.card.name || card2.card.label) + '」1张，减少「' + (nonKey.card.name || nonKey.card.label) + '」2张',
                            changes: [
                              { card: card1.card, change: +1 },
                              { card: card2.card, change: +1 },
                              { card: nonKey.card, change: -2 }
                            ],
                            newCounts,
                            priority: 2
                          });
                        }
                      }
                    }
                  }
                }
              }

              // 方案类型3：扩充卡组（不超过60张上限）
              if (totalCards < 60) {
                for (const keyCard of keyCards) {
                  const keyMaxCount = keyCard.card.maxCount;
                  if (keyCard.card.count < keyMaxCount) {
                    const maxByCard = keyMaxCount - keyCard.card.count;
                    const maxByDeck = 60 - totalCards;
                    const maxAdd = Math.min(maxByCard, maxByDeck, 2);
                    
                    if (maxAdd > 0) {
                      for (let add = 1; add <= maxAdd; add++) {
                        const newCounts = [...currentCounts];
                        newCounts[keyCard.index] += add;

                        plans.push({
                          type: 'expand_deck',
                          description: '增加「' + (keyCard.card.name || keyCard.card.label) + '」' + add + '张（卡组从' + totalCards + '张变为' + (totalCards + add) + '张）',
                          changes: [{ card: keyCard.card, change: +add }],
                          newCounts,
                          newDeckSize: totalCards + add,
                          priority: 3
                        });
                      }
                    }
                  }
                }
              }

              // 方案类型4：减少非关键卡
              for (const nonKey of nonKeyCards) {
                if (nonKey.card.count >= 1 && totalCards > 40) {
                  const maxReduce = Math.min(nonKey.card.count, totalCards - 40, 3);
                  
                  for (let reduce = 1; reduce <= maxReduce; reduce++) {
                    const newCounts = [...currentCounts];
                    newCounts[nonKey.index] -= reduce;

                    plans.push({
                      type: 'reduce_deck',
                      description: '减少「' + (nonKey.card.name || nonKey.card.label) + '」' + reduce + '张（卡组从' + totalCards + '张变为' + (totalCards - reduce) + '张）',
                      changes: [{ card: nonKey.card, change: -reduce }],
                      newCounts,
                      newDeckSize: totalCards - reduce,
                      priority: 4
                    });
                  }
                }
              }
            } else {
              // ===== 降低启动率的方案 =====
              
              // 方案类型1：减少关键卡数量（用非关键卡替换）
              for (const keyCard of keyCards) {
                if (keyCard.card.count >= 1) {
                  const maxReduce = keyCard.card.count;
                  for (let reduce = 1; reduce <= Math.min(maxReduce, 3); reduce++) {
                    for (const nonKey of nonKeyCards) {
                      const nonKeyMaxCount = nonKey.card.maxCount;
                      if (nonKey.card.count < nonKeyMaxCount) {
                        // 检查增加后不超过上限
                        const canAdd = Math.min(reduce, nonKeyMaxCount - nonKey.card.count);
                        if (canAdd >= reduce) {
                          const newCounts = [...currentCounts];
                          newCounts[keyCard.index] -= reduce;
                          newCounts[nonKey.index] += reduce;

                          plans.push({
                            type: 'decrease_key',
                            description: '减少「' + (keyCard.card.name || keyCard.card.label) + '」' + reduce + '张，增加「' + (nonKey.card.name || nonKey.card.label) + '」' + reduce + '张',
                            changes: [
                              { card: keyCard.card, change: -reduce },
                              { card: nonKey.card, change: +reduce }
                            ],
                            newCounts,
                            priority: 1
                          });
                        }
                      }
                    }
                  }
                }
              }

              // 方案类型2：多个关键卡同时减少
              if (keyCards.length >= 2) {
                for (let i = 0; i < keyCards.length; i++) {
                  for (let j = i + 1; j < keyCards.length; j++) {
                    const card1 = keyCards[i];
                    const card2 = keyCards[j];
                    if (card1.card.count >= 1 && card2.card.count >= 1) {
                      for (const nonKey of nonKeyCards) {
                        const nonKeyMaxCount = nonKey.card.maxCount;
                        // 需要能增加2张
                        if (nonKey.card.count + 2 <= nonKeyMaxCount) {
                          const newCounts = [...currentCounts];
                          newCounts[card1.index] -= 1;
                          newCounts[card2.index] -= 1;
                          newCounts[nonKey.index] += 2;

                          plans.push({
                            type: 'decrease_multi_key',
                            description: '减少「' + (card1.card.name || card1.card.label) + '」1张 + 「' + (card2.card.name || card2.card.label) + '」1张，增加「' + (nonKey.card.name || nonKey.card.label) + '」2张',
                            changes: [
                              { card: card1.card, change: -1 },
                              { card: card2.card, change: -1 },
                              { card: nonKey.card, change: +2 }
                            ],
                            newCounts,
                            priority: 2
                          });
                        }
                      }
                    }
                  }
                }
              }

              // 方案类型3：扩充卡组（增加非关键卡，稀释关键卡比例）
              if (totalCards < 60) {
                for (const nonKey of nonKeyCards) {
                  const nonKeyMaxCount = nonKey.card.maxCount;
                  if (nonKey.card.count < nonKeyMaxCount) {
                    const maxByCard = nonKeyMaxCount - nonKey.card.count;
                    const maxByDeck = 60 - totalCards;
                    const maxAdd = Math.min(maxByCard, maxByDeck, 3);
                    
                    if (maxAdd > 0) {
                      for (let add = 1; add <= maxAdd; add++) {
                        const newCounts = [...currentCounts];
                        newCounts[nonKey.index] += add;

                        plans.push({
                          type: 'expand_deck',
                          description: '增加「' + (nonKey.card.name || nonKey.card.label) + '」' + add + '张（卡组从' + totalCards + '张变为' + (totalCards + add) + '张）',
                          changes: [{ card: nonKey.card, change: +add }],
                          newCounts,
                          newDeckSize: totalCards + add,
                          priority: 3
                        });
                      }
                    }
                  }
                }
              }

              // 方案类型4：减少关键卡（直接移除，减少卡组总数）
              for (const keyCard of keyCards) {
                if (keyCard.card.count >= 1 && totalCards > 40) {
                  const maxReduce = Math.min(keyCard.card.count, totalCards - 40, 3);
                  
                  for (let reduce = 1; reduce <= maxReduce; reduce++) {
                    const newCounts = [...currentCounts];
                    newCounts[keyCard.index] -= reduce;

                    plans.push({
                      type: 'reduce_deck',
                      description: '减少「' + (keyCard.card.name || keyCard.card.label) + '」' + reduce + '张（卡组从' + totalCards + '张变为' + (totalCards - reduce) + '张）',
                      changes: [{ card: keyCard.card, change: -reduce }],
                      newCounts,
                      newDeckSize: totalCards - reduce,
                      priority: 4
                    });
                  }
                }
              }
            }

            postMessage({ type: 'progress', progress: 30, text: '评估方案效果 (0/' + plans.length + ')...' });

            // 计算每个方案的概率
            const totalPlans = plans.length;
            for (let i = 0; i < totalPlans; i++) {
              const plan = plans[i];
              const newTotal = plan.newCounts.reduce((a, b) => a + b, 0);
              const actualDraws = Math.min(draws, newTotal);
              plan.newRate = quickMonteCarlo(plan.newCounts, actualDraws, conditionFunc, Math.floor(simulations / 2));
              plan.improvement = plan.newRate - currentRate;
              
              // 根据优化方向判断是否达标
              if (direction === 'increase') {
                plan.reachTarget = plan.newRate >= targetRate;
              } else {
                plan.reachTarget = plan.newRate <= targetRate;
              }

              // 每处理5个方案汇报一次进度
              if (i % 5 === 0 || i === totalPlans - 1) {
                const progress = 30 + Math.floor((i + 1) / totalPlans * 65);
                postMessage({ 
                  type: 'progress', 
                  progress, 
                  text: '评估方案效果 (' + (i + 1) + '/' + totalPlans + ')...'
                });
              }
            }

            postMessage({ type: 'progress', progress: 95, text: '整理结果...' });

            // 根据优化方向过滤方案
            let validPlans;
            if (direction === 'increase') {
              // 提高启动率：improvement 需要 > 0
              validPlans = plans.filter((p) => p.improvement > 0.1);
            } else {
              // 降低启动率：improvement 需要 < 0
              validPlans = plans.filter((p) => p.improvement < -0.1);
            }

            // 按类型分组
            let keepDeckPlans, expandDeckPlans, reduceDeckPlans;
            if (direction === 'increase') {
              keepDeckPlans = validPlans.filter(p => 
                p.type === 'increase_key' || p.type === 'increase_multi_key'
              );
            } else {
              keepDeckPlans = validPlans.filter(p => 
                p.type === 'decrease_key' || p.type === 'decrease_multi_key'
              );
            }
            expandDeckPlans = validPlans.filter(p => p.type === 'expand_deck');
            reduceDeckPlans = validPlans.filter(p => p.type === 'reduce_deck');

            // 排序函数：最接近目标的在前，达到目标的优先
            const sortPlans = (arr) => {
              return arr.sort((a, b) => {
                // 达到目标的优先
                if (a.reachTarget !== b.reachTarget) {
                  return a.reachTarget ? -1 : 1;
                }
                // 越接近目标越靠前（差距小的在前）
                const diffA = Math.abs(targetRate - a.newRate);
                const diffB = Math.abs(targetRate - b.newRate);
                return diffA - diffB;
              });
            };

            // 对每组方案排序
            sortPlans(keepDeckPlans);
            sortPlans(expandDeckPlans);
            sortPlans(reduceDeckPlans);

            // 标记每组的最佳方案
            if (keepDeckPlans.length > 0) keepDeckPlans[0].isBest = true;
            if (expandDeckPlans.length > 0) expandDeckPlans[0].isBest = true;
            if (reduceDeckPlans.length > 0) reduceDeckPlans[0].isBest = true;

            // 限制每组数量
            const maxPerGroup = 10;

            postMessage({ type: 'progress', progress: 100, text: '完成！' });

            postMessage({
              type: 'result',
              currentRate,
              targetRate,
              direction,
              keepDeckPlans: keepDeckPlans.slice(0, maxPerGroup),
              expandDeckPlans: expandDeckPlans.slice(0, maxPerGroup),
              reduceDeckPlans: reduceDeckPlans.slice(0, maxPerGroup),
              totalPlansCount: validPlans.length
            });

          } catch (error) {
            postMessage({ type: 'error', message: error.message });
          }
        };
      `

      try {
        const blob = new Blob([workerCode], { type: 'text/javascript' })
        optimizerWorker = new Worker(URL.createObjectURL(blob))

        optimizerWorker.onmessage = (e) => {
          if (e.data.type === 'progress') {
            optimizeProgress.value = e.data.progress
            progressText.value = e.data.text
          } else if (e.data.type === 'result') {
            keepDeckPlans.value = e.data.keepDeckPlans
            expandDeckPlans.value = e.data.expandDeckPlans
            reduceDeckPlans.value = e.data.reduceDeckPlans
            totalPlansCount.value = e.data.totalPlansCount
            isOptimizing.value = false
            optimizerWorker.terminate()
            optimizerWorker = null
            resolve(e.data)
          } else if (e.data.type === 'error') {
            isOptimizing.value = false
            optimizerWorker.terminate()
            optimizerWorker = null
            reject(new Error(e.data.message))
          }
        }

        optimizerWorker.onerror = (error) => {
          isOptimizing.value = false
          optimizerWorker.terminate()
          optimizerWorker = null
          reject(new Error('Worker 执行错误: ' + error.message))
        }

        // 发送数据到 Worker
        optimizerWorker.postMessage({
          cardsData,
          condition,
          draws,
          targetRate,
          simulations: 30000 // 每次模拟3万次，平衡速度和精度
        })
      } catch (error) {
        isOptimizing.value = false
        reject(new Error('创建 Worker 失败: ' + error.message))
      }
    })
  }

  // 应用方案到卡组
  function applyPlan(plan, cards) {
    plan.changes.forEach((change) => {
      // 优先使用 label 匹配（label 是唯一的），其次使用 name 匹配（需要非空）
      const cardIndex = cards.findIndex((c) => {
        if (change.card.label && c.label === change.card.label) {
          return true
        }
        if (change.card.name && c.name && c.name === change.card.name) {
          return true
        }
        return false
      })
      if (cardIndex !== -1) {
        cards[cardIndex].count = Math.max(0, cards[cardIndex].count + change.change)
      }
    })
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

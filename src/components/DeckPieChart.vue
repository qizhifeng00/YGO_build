<template>
  <n-card title="构成分布" size="small" :segmented="{ content: true }">
    <div style="height: 140px; position: relative;">
      <canvas ref="chartCanvas"></canvas>
    </div>
  </n-card>
</template>

<script setup>
import { ref, inject, watch, onMounted, nextTick } from 'vue'
import { NCard } from 'naive-ui'
import { Chart, ArcElement, Tooltip, Legend, DoughnutController } from 'chart.js'

// 注册Chart.js组件
Chart.register(ArcElement, Tooltip, Legend, DoughnutController)

const deck = inject('deck')
const chartCanvas = ref(null)
let chartInstance = null

const colors = [
  '#0f172a', '#334155', '#64748b', '#94a3b8', '#cbd5e1',
  '#1e293b', '#475569', '#3b82f6', '#60a5fa', '#93c5fd',
  '#1d4ed8', '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd'
]

function updateChart() {
  if (!chartCanvas.value) return

  const labels = []
  const data = []
  const backgroundColors = []

  deck.cards.value.forEach((card, index) => {
    const count = parseInt(card.count) || 0
    if (count > 0) {
      const name = card.name.trim() || card.label + '类卡'
      labels.push(name)
      data.push(count)
      backgroundColors.push(colors[index % colors.length])
    }
  })

  // 如果没有数据，不显示
  if (labels.length === 0) {
    labels.push('空卡组')
    data.push(1)
    backgroundColors.push('#e2e8f0')
  }

  const ctx = chartCanvas.value.getContext('2d')
  
  if (chartInstance) {
    chartInstance.destroy()
  }

  chartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: backgroundColors,
        borderWidth: 2,
        borderColor: '#ffffff',
        hoverOffset: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '70%',
      plugins: {
        legend: {
          position: 'right',
          labels: {
            boxWidth: 10,
            padding: 8,
            font: {
              size: 11,
              weight: '500'
            },
            color: '#475569'
          }
        },
        tooltip: {
          backgroundColor: '#0f172a',
          padding: 10,
          titleFont: { size: 12 },
          bodyFont: { size: 12 },
          cornerRadius: 6
        }
      }
    }
  })
}

// 监听卡牌变化
watch(() => deck.cards.value.map(c => c.count + c.name), () => {
  nextTick(() => {
    updateChart()
  })
}, { deep: true })

onMounted(() => {
  nextTick(() => {
    updateChart()
  })
})
</script>


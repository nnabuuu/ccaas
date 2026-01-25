<script setup lang="ts">
import { ref, onMounted, shallowRef, watch, computed } from 'vue'
import { analyticsApi } from '@/api/admin'
import { useAuthStore } from '@/stores/auth'
import type { TokenUsageAnalytics } from '@/types/admin'
import { message } from 'ant-design-vue'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart, BarChart } from 'echarts/charts'
import {
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent
} from 'echarts/components'
import VChart from 'vue-echarts'
import dayjs from 'dayjs'

use([
  CanvasRenderer,
  LineChart,
  BarChart,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent
])

const authStore = useAuthStore()
const loading = ref(true)
const analytics = ref<TokenUsageAnalytics | null>(null)

const filters = ref({
  days: 7,
  granularity: 'daily' as 'hourly' | 'daily' | 'weekly' | 'monthly'
})

// Combine filters with tenant selection
const queryParams = computed(() => ({
  ...filters.value,
  tenantId: authStore.selectedTenantId || undefined
}))

onMounted(() => {
  loadAnalytics()
})

// Watch tenant selection changes
watch(() => authStore.selectedTenantId, () => {
  loadAnalytics().then(updateChart)
})

async function loadAnalytics() {
  loading.value = true
  try {
    analytics.value = await analyticsApi.getTokenUsage(queryParams.value)
  } catch (error) {
    message.error('Failed to load analytics')
    console.error(error)
  } finally {
    loading.value = false
  }
}

const chartOption = shallowRef({})

function updateChart() {
  if (!analytics.value) return

  const dataPoints = analytics.value.dataPoints
  const xData = dataPoints.map(d => {
    const date = new Date(d.timestamp)
    return filters.value.granularity === 'hourly'
      ? dayjs(date).format('MM/DD HH:mm')
      : dayjs(date).format('MM/DD')
  })

  chartOption.value = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' }
    },
    legend: {
      data: ['Input Tokens', 'Output Tokens', 'Cached Tokens']
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: xData,
      axisLabel: { rotate: 45 }
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        formatter: (value: number) => {
          if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M'
          if (value >= 1000) return (value / 1000).toFixed(1) + 'K'
          return value
        }
      }
    },
    series: [
      {
        name: 'Input Tokens',
        type: 'line',
        data: dataPoints.map(d => d.inputTokens),
        smooth: true,
        itemStyle: { color: '#1890ff' }
      },
      {
        name: 'Output Tokens',
        type: 'line',
        data: dataPoints.map(d => d.outputTokens),
        smooth: true,
        itemStyle: { color: '#52c41a' }
      },
      {
        name: 'Cached Tokens',
        type: 'line',
        data: dataPoints.map(d => d.cachedTokens),
        smooth: true,
        itemStyle: { color: '#faad14' }
      }
    ]
  }
}

function handleFilterChange() {
  loadAnalytics().then(updateChart)
}

onMounted(() => {
  loadAnalytics().then(updateChart)
})

function formatNumber(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(2) + 'M'
  if (n >= 1000) return (n / 1000).toFixed(2) + 'K'
  return n.toString()
}
</script>

<template>
  <div class="analytics-view">
    <div class="page-header">
      <h1>Token Usage Analytics</h1>
      <p>Monitor token consumption over time</p>
    </div>

    <!-- Filters -->
    <div class="card" style="margin-bottom: 24px;">
      <div class="card-body" style="padding: 16px 24px;">
        <a-space size="middle">
          <a-select
            v-model:value="filters.days"
            style="width: 120px"
            @change="handleFilterChange"
          >
            <a-select-option :value="1">Last 24h</a-select-option>
            <a-select-option :value="7">Last 7 days</a-select-option>
            <a-select-option :value="30">Last 30 days</a-select-option>
            <a-select-option :value="90">Last 90 days</a-select-option>
          </a-select>

          <a-select
            v-model:value="filters.granularity"
            style="width: 120px"
            @change="handleFilterChange"
          >
            <a-select-option value="hourly">Hourly</a-select-option>
            <a-select-option value="daily">Daily</a-select-option>
            <a-select-option value="weekly">Weekly</a-select-option>
          </a-select>
        </a-space>
      </div>
    </div>

    <a-spin :spinning="loading">
      <!-- Summary Cards -->
      <a-row :gutter="[24, 24]" v-if="analytics" style="margin-bottom: 24px;">
        <a-col :xs="24" :sm="12" :lg="6">
          <div class="stat-card">
            <div class="stat-value">{{ formatNumber(analytics.summary.totalTokens) }}</div>
            <div class="stat-label">Total Tokens</div>
          </div>
        </a-col>
        <a-col :xs="24" :sm="12" :lg="6">
          <div class="stat-card">
            <div class="stat-value">{{ formatNumber(analytics.summary.totalInput) }}</div>
            <div class="stat-label">Input Tokens</div>
          </div>
        </a-col>
        <a-col :xs="24" :sm="12" :lg="6">
          <div class="stat-card">
            <div class="stat-value">{{ formatNumber(analytics.summary.totalOutput) }}</div>
            <div class="stat-label">Output Tokens</div>
          </div>
        </a-col>
        <a-col :xs="24" :sm="12" :lg="6">
          <div class="stat-card">
            <div class="stat-value">{{ formatNumber(analytics.summary.avgPerSession) }}</div>
            <div class="stat-label">Avg per Session</div>
          </div>
        </a-col>
      </a-row>

      <!-- Chart -->
      <div class="card">
        <div class="card-header">
          <h3>Token Usage Over Time</h3>
        </div>
        <div class="card-body">
          <v-chart
            class="chart"
            :option="chartOption"
            autoresize
          />
        </div>
      </div>
    </a-spin>
  </div>
</template>

<style scoped>
.analytics-view {
  max-width: 1400px;
}

.page-header {
  margin-bottom: 24px;
}

.page-header h1 {
  font-size: 24px;
  font-weight: 600;
  margin: 0;
}

.page-header p {
  color: #666;
  margin-top: 8px;
}

.stat-card {
  background: #fff;
  border-radius: 8px;
  padding: 24px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  text-align: center;
}

.stat-value {
  font-size: 28px;
  font-weight: 600;
}

.stat-label {
  color: #666;
  margin-top: 8px;
}

.card {
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.card-header {
  padding: 16px 24px;
  border-bottom: 1px solid #f0f0f0;
}

.card-header h3 {
  font-size: 16px;
  font-weight: 600;
  margin: 0;
}

.card-body {
  padding: 24px;
}

.chart {
  height: 400px;
  width: 100%;
}
</style>

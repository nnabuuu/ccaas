<script setup lang="ts">
import { ref, onMounted, shallowRef, watch, computed } from 'vue'
import { analyticsApi } from '@/api/admin'
import { useAuthStore } from '@/stores/auth'
import type { CostAnalytics } from '@/types/admin'
import { message } from 'ant-design-vue'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { PieChart, BarChart } from 'echarts/charts'
import {
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent
} from 'echarts/components'
import VChart from 'vue-echarts'

use([
  CanvasRenderer,
  PieChart,
  BarChart,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent
])

const authStore = useAuthStore()
const loading = ref(true)
const analytics = ref<CostAnalytics | null>(null)

const filters = ref({
  days: 30
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
  loadAnalytics().then(updateCharts)
})

async function loadAnalytics() {
  loading.value = true
  try {
    analytics.value = await analyticsApi.getCostBreakdown(queryParams.value)
  } catch (error) {
    message.error('Failed to load cost analytics')
    console.error(error)
  } finally {
    loading.value = false
  }
}

const tenantChartOption = shallowRef({})
const modelChartOption = shallowRef({})

function updateCharts() {
  if (!analytics.value) return

  // Tenant pie chart
  tenantChartOption.value = {
    tooltip: {
      trigger: 'item',
      formatter: '{b}: ${c} ({d}%)'
    },
    legend: {
      orient: 'vertical',
      left: 'left'
    },
    series: [
      {
        name: 'Cost by Tenant',
        type: 'pie',
        radius: ['40%', '70%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 10,
          borderColor: '#fff',
          borderWidth: 2
        },
        label: {
          show: false,
          position: 'center'
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 20,
            fontWeight: 'bold'
          }
        },
        labelLine: {
          show: false
        },
        data: analytics.value.byTenant.map(t => ({
          name: t.tenantName,
          value: t.estimatedCost
        }))
      }
    ]
  }

  // Model bar chart
  modelChartOption.value = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: analytics.value.byModel.map(m => m.model.replace('claude-', '').replace('-20', '\n20'))
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        formatter: '${value}'
      }
    },
    series: [
      {
        name: 'Estimated Cost',
        type: 'bar',
        data: analytics.value.byModel.map(m => m.estimatedCost),
        itemStyle: {
          color: '#1890ff',
          borderRadius: [4, 4, 0, 0]
        }
      }
    ]
  }
}

function handleFilterChange() {
  loadAnalytics().then(updateCharts)
}

onMounted(() => {
  loadAnalytics().then(updateCharts)
})

function formatCurrency(n: number): string {
  return '$' + n.toFixed(2)
}

function formatNumber(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(2) + 'M'
  if (n >= 1000) return (n / 1000).toFixed(2) + 'K'
  return n.toString()
}
</script>

<template>
  <div class="costs-view">
    <div class="page-header">
      <h1>Cost Analytics</h1>
      <p>Track estimated costs by tenant and model</p>
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
            <a-select-option :value="7">Last 7 days</a-select-option>
            <a-select-option :value="30">Last 30 days</a-select-option>
            <a-select-option :value="90">Last 90 days</a-select-option>
          </a-select>
        </a-space>
      </div>
    </div>

    <a-spin :spinning="loading">
      <!-- Total Cost -->
      <div class="card total-cost-card" style="margin-bottom: 24px;" v-if="analytics">
        <div class="total-cost">
          <span class="label">Total Estimated Cost</span>
          <span class="value">{{ formatCurrency(analytics.totalEstimatedCost) }}</span>
        </div>
      </div>

      <a-row :gutter="[24, 24]">
        <!-- Cost by Tenant -->
        <a-col :xs="24" :lg="12">
          <div class="card">
            <div class="card-header">
              <h3>Cost by Tenant</h3>
            </div>
            <div class="card-body">
              <v-chart
                v-if="analytics && analytics.byTenant.length > 0"
                class="chart"
                :option="tenantChartOption"
                autoresize
              />
              <div v-else class="empty-chart">
                <p>No data available</p>
              </div>
            </div>
          </div>
        </a-col>

        <!-- Cost by Model -->
        <a-col :xs="24" :lg="12">
          <div class="card">
            <div class="card-header">
              <h3>Cost by Model</h3>
            </div>
            <div class="card-body">
              <v-chart
                v-if="analytics && analytics.byModel.length > 0"
                class="chart"
                :option="modelChartOption"
                autoresize
              />
              <div v-else class="empty-chart">
                <p>No data available</p>
              </div>
            </div>
          </div>
        </a-col>
      </a-row>

      <!-- Tenant Breakdown Table -->
      <div class="card" style="margin-top: 24px;" v-if="analytics">
        <div class="card-header">
          <h3>Detailed Breakdown</h3>
        </div>
        <a-table
          :dataSource="analytics.byTenant"
          :pagination="false"
          :rowKey="(record: CostAnalytics['byTenant'][number]) => record.tenantId"
        >
          <a-table-column title="Tenant" data-index="tenantName" key="tenantName" />
          <a-table-column title="Input Tokens" data-index="inputTokens" key="inputTokens" align="right">
            <template #default="{ record }">
              {{ formatNumber(record.inputTokens) }}
            </template>
          </a-table-column>
          <a-table-column title="Output Tokens" data-index="outputTokens" key="outputTokens" align="right">
            <template #default="{ record }">
              {{ formatNumber(record.outputTokens) }}
            </template>
          </a-table-column>
          <a-table-column title="Cached Tokens" data-index="cachedTokens" key="cachedTokens" align="right">
            <template #default="{ record }">
              {{ formatNumber(record.cachedTokens) }}
            </template>
          </a-table-column>
          <a-table-column title="Est. Cost" data-index="estimatedCost" key="estimatedCost" align="right">
            <template #default="{ record }">
              <strong>{{ formatCurrency(record.estimatedCost) }}</strong>
            </template>
          </a-table-column>
          <a-table-column title="Share" data-index="percentage" key="percentage" align="right">
            <template #default="{ record }">
              {{ record.percentage.toFixed(1) }}%
            </template>
          </a-table-column>
        </a-table>
      </div>
    </a-spin>
  </div>
</template>

<style scoped>
.costs-view {
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

.total-cost-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.total-cost {
  padding: 32px;
  text-align: center;
  color: #fff;
}

.total-cost .label {
  display: block;
  font-size: 14px;
  opacity: 0.9;
  margin-bottom: 8px;
}

.total-cost .value {
  font-size: 48px;
  font-weight: 700;
}

.chart {
  height: 300px;
  width: 100%;
}

.empty-chart {
  height: 300px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #999;
}
</style>

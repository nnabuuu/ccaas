import React from 'react'
import { NarrativeCard } from './NarrativeCard'
import { BANK_FIELDS } from '../types'
import type { SyncField, DisplayItem } from '../types'

interface CreditReportPanelProps {
  displayData: Map<SyncField, DisplayItem>
  isProcessing: boolean
}

export function CreditReportPanel({ displayData, isProcessing }: CreditReportPanelProps) {
  const hasAnyData = BANK_FIELDS.some(f => displayData.has(f.field))

  return (
    <div className="h-full overflow-y-auto p-4 bg-gray-50 custom-scrollbar">
      {!hasAnyData && !isProcessing && (
        <div className="flex flex-col items-center justify-center h-full text-gray-400">
          <span className="text-6xl mb-4">🏦</span>
          <p className="text-lg font-medium mb-2">信贷评估面板</p>
          <p className="text-sm">输入农户手机号后，评估报告将显示在这里</p>
        </div>
      )}

      {BANK_FIELDS.map(({ field, title, icon }) => {
        const item = displayData.get(field)
        const isLoading = isProcessing && !item && hasAnyData

        return (
          <NarrativeCard
            key={field}
            title={title}
            icon={icon}
            content={item?.value}
            viewMode="bank"
            isLoading={isLoading}
          />
        )
      })}
    </div>
  )
}

import React, { useState } from 'react'
import type { ViewMode } from '../types'

const PRESET_PHONES = [
  { label: '🌾 种植大户', phone: '13812345001' },
  { label: '👨‍🌾 普通农户', phone: '13812345011' },
  { label: '🏡 小农户', phone: '13812345026' },
  { label: '🤝 合作社', phone: '13812345036' },
  { label: '🧑‍💻 新农人', phone: '13812345041' },
  { label: '🍎 经济作物', phone: '13812345046' },
]

interface PhoneInputProps {
  onSubmit: (phone: string) => void
  viewMode: ViewMode
  disabled?: boolean
}

export function PhoneInput({ onSubmit, viewMode, disabled }: PhoneInputProps) {
  const [phone, setPhone] = useState('')

  const isValid = /^1\d{10}$/.test(phone)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (isValid && !disabled) {
      onSubmit(phone)
    }
  }

  const isFarmer = viewMode === 'farmer'

  return (
    <form onSubmit={handleSubmit} className="p-4 border-b border-gray-200">
      <label className="block text-sm text-gray-600 mb-2">
        {isFarmer ? '📱 输入手机号查询农户信息' : '📱 输入农户手机号开始评估'}
      </label>
      <div className="flex gap-2">
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
          placeholder="138 1234 5001"
          className={`flex-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 ${
            isFarmer
              ? 'focus:ring-agri-green-500 border-gray-300'
              : 'focus:ring-bank-blue-500 border-gray-300'
          }`}
          disabled={disabled}
        />
        <button
          type="submit"
          disabled={!isValid || disabled}
          className={`px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors ${
            isFarmer
              ? 'bg-agri-green-600 hover:bg-agri-green-700 disabled:bg-gray-300'
              : 'bg-bank-blue-600 hover:bg-bank-blue-700 disabled:bg-gray-300'
          } disabled:cursor-not-allowed`}
        >
          查询
        </button>
      </div>
      {phone.length > 0 && !isValid && (
        <p className="text-xs text-red-500 mt-1">请输入11位手机号</p>
      )}

      <div className="mt-3">
        <p className="text-xs text-gray-400 mb-1.5">快速体验</p>
        <div className="flex flex-wrap gap-1.5">
          {PRESET_PHONES.map(({ label, phone: presetPhone }) => (
            <button
              key={presetPhone}
              type="button"
              disabled={disabled}
              onClick={() => onSubmit(presetPhone)}
              className={`px-2.5 py-1 rounded-full text-xs border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                isFarmer
                  ? 'border-agri-green-300 text-agri-green-700 hover:bg-agri-green-50'
                  : 'border-bank-blue-300 text-bank-blue-700 hover:bg-bank-blue-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </form>
  )
}

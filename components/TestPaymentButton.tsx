'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function TestPaymentButton() {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function handleTestPayment(setPaid: boolean) {
    setLoading(true)
    setMessage(null)

    try {
      // 현재 로그인한 유저 정보 가져오기
      const { data: { user }, error: userError } = await supabase.auth.getUser()

      if (userError || !user) {
        setMessage('로그인이 필요합니다.')
        setLoading(false)
        return
      }

      // profiles 테이블에서 has_paid 업데이트 (없으면 생성)
      const { error: upsertError } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          has_paid: setPaid
        }, {
          onConflict: 'id'
        })

      if (upsertError) {
        setMessage(`오류: ${upsertError.message}`)
        setLoading(false)
        return
      }

      setMessage(setPaid
        ? '결제 완료 처리되었습니다! 페이지를 새로고침해주세요.'
        : '결제 취소 처리되었습니다! 페이지를 새로고침해주세요.'
      )
    } catch (error) {
      setMessage('오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mt-8 p-6 bg-yellow-50 border-2 border-dashed border-yellow-300 rounded-xl">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-yellow-600 font-semibold">테스트 전용</span>
        <span className="px-2 py-0.5 bg-yellow-200 text-yellow-800 text-xs rounded-full">DEV</span>
      </div>
      <p className="text-sm text-gray-600 mb-4">
        이 버튼은 개발/테스트 목적으로만 사용됩니다. 실제 결제 없이 has_paid 값을 변경합니다.
      </p>
      <div className="flex gap-3">
        <button
          onClick={() => handleTestPayment(true)}
          disabled={loading}
          className="px-6 py-3 bg-yellow-500 hover:bg-yellow-600 disabled:bg-yellow-300 text-white font-semibold rounded-lg transition-colors"
        >
          {loading ? '처리 중...' : '결제 완료 처리'}
        </button>
        <button
          onClick={() => handleTestPayment(false)}
          disabled={loading}
          className="px-6 py-3 bg-gray-500 hover:bg-gray-600 disabled:bg-gray-300 text-white font-semibold rounded-lg transition-colors"
        >
          {loading ? '처리 중...' : '결제 취소 처리'}
        </button>
      </div>
      {message && (
        <p className={`mt-3 text-sm ${message.includes('오류') || message.includes('필요') ? 'text-red-600' : 'text-green-600'}`}>
          {message}
        </p>
      )}
    </div>
  )
}

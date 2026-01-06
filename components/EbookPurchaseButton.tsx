'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import * as PortOne from '@portone/browser-sdk/v2'

interface EbookPurchaseButtonProps {
  ebookId: string
  ebookTitle: string
  price: number
}

export default function EbookPurchaseButton({
  ebookId,
  ebookTitle,
  price,
}: EbookPurchaseButtonProps) {
  const router = useRouter()
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null)
  const [isPurchased, setIsPurchased] = useState(false)
  const [isInCart, setIsInCart] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isCartProcessing, setIsCartProcessing] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // 상태 확인
  useEffect(() => {
    async function checkStatus() {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        setIsLoggedIn(false)
        setIsLoading(false)
        return
      }

      setIsLoggedIn(true)

      // 이미 구매했는지 확인
      const { data: purchase } = await supabase
        .from('ebook_purchases')
        .select('id')
        .eq('user_id', user.id)
        .eq('ebook_id', ebookId)
        .single()

      setIsPurchased(!!purchase)

      // 장바구니에 있는지 확인
      if (!purchase) {
        const { data: cartItem } = await supabase
          .from('ebook_cart')
          .select('id')
          .eq('user_id', user.id)
          .eq('ebook_id', ebookId)
          .single()

        setIsInCart(!!cartItem)
      }

      setIsLoading(false)
    }

    checkStatus()
  }, [ebookId])

  // 장바구니 추가/제거
  async function handleCart() {
    if (!isLoggedIn) {
      router.push(`/login?redirect=/ebooks/${ebookId}`)
      return
    }

    setIsCartProcessing(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      if (isInCart) {
        await supabase
          .from('ebook_cart')
          .delete()
          .eq('user_id', user.id)
          .eq('ebook_id', ebookId)

        setIsInCart(false)
      } else {
        await supabase
          .from('ebook_cart')
          .insert({
            user_id: user.id,
            ebook_id: ebookId,
          })

        setIsInCart(true)
      }
    } catch (error) {
      console.error('장바구니 처리 오류:', error)
    } finally {
      setIsCartProcessing(false)
    }
  }

  // 결제 처리
  async function handlePayment() {
    if (!isLoggedIn) {
      router.push(`/login?redirect=/ebooks/${ebookId}`)
      return
    }

    if (isPurchased) {
      router.push(`/my-ebooks`)
      return
    }

    setIsProcessing(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push(`/login?redirect=/ebooks/${ebookId}`)
        return
      }

      const paymentId = `payment-${ebookId}-${user.id}-${Date.now()}`

      const response = await PortOne.requestPayment({
        storeId: process.env.NEXT_PUBLIC_PORTONE_STORE_ID!,
        channelKey: process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY!,
        paymentId: paymentId,
        orderName: `[E-book] ${ebookTitle}`,
        totalAmount: price,
        currency: 'CURRENCY_KRW',
        payMethod: 'EASY_PAY',
        easyPay: {
          easyPayProvider: 'KAKAOPAY',
        },
        customer: {
          email: user.email,
        },
        customData: {
          ebookId,
          userId: user.id,
          type: 'ebook',
        },
      })

      if (response?.code) {
        if (response.code === 'FAILURE_TYPE_PG') {
          alert('결제가 취소되었습니다.')
        } else {
          alert(`결제 실패: ${response.message}`)
        }
        setIsProcessing(false)
        return
      }

      const { data: { session } } = await supabase.auth.getSession()

      const verifyResponse = await fetch('/api/payment/ebook-verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          paymentId,
          ebookId,
        }),
      })

      const verifyResult = await verifyResponse.json()

      if (!verifyResponse.ok) {
        alert(`결제 검증 실패: ${verifyResult.error}`)
        setIsProcessing(false)
        return
      }

      alert('결제가 완료되었습니다! E-book을 다운로드할 수 있습니다.')
      setIsPurchased(true)
      router.refresh()

    } catch (error) {
      console.error('결제 오류:', error)
      alert('결제 처리 중 오류가 발생했습니다.')
    } finally {
      setIsProcessing(false)
    }
  }

  // 무료 E-book 처리
  async function handleFreeEnroll() {
    if (!isLoggedIn) {
      router.push(`/login?redirect=/ebooks/${ebookId}`)
      return
    }

    if (isPurchased) {
      router.push(`/my-ebooks`)
      return
    }

    setIsProcessing(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()

      const response = await fetch('/api/payment/ebook-free-enroll', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          ebookId,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        alert(`등록 실패: ${result.error}`)
        setIsProcessing(false)
        return
      }

      alert('무료 E-book에 등록되었습니다!')
      setIsPurchased(true)
      router.refresh()

    } catch (error) {
      console.error('등록 오류:', error)
      alert('등록 처리 중 오류가 발생했습니다.')
    } finally {
      setIsProcessing(false)
    }
  }

  // 로딩 중
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="w-full h-14 bg-gray-200 rounded-full animate-pulse" />
        <div className="w-full h-12 bg-gray-100 rounded-full animate-pulse" />
      </div>
    )
  }

  // 이미 구매한 경우
  if (isPurchased) {
    return (
      <div className="space-y-4">
        <div className="w-full rounded-full bg-green-100 py-4 text-center">
          <span className="text-green-700 font-semibold flex items-center justify-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            구매 완료된 E-book입니다
          </span>
        </div>
        <button
          onClick={() => router.push(`/my-ebooks`)}
          className="w-full rounded-full bg-gradient-to-r from-orange-500 to-yellow-500 py-4 text-lg font-semibold text-white shadow-md transition-all hover:shadow-lg hover:from-orange-600 hover:to-yellow-600"
        >
          다운로드하러 가기
        </button>
      </div>
    )
  }

  // 무료 E-book
  if (price === 0) {
    return (
      <button
        onClick={handleFreeEnroll}
        disabled={isProcessing}
        className="w-full rounded-full bg-gradient-to-r from-green-500 to-teal-500 py-4 text-lg font-semibold text-white shadow-md transition-all hover:shadow-lg hover:from-green-600 hover:to-teal-600 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isProcessing ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            등록 중...
          </span>
        ) : (
          '무료로 받기'
        )}
      </button>
    )
  }

  // 유료 E-book
  return (
    <div className="space-y-3">
      <button
        onClick={handlePayment}
        disabled={isProcessing}
        className="w-full rounded-full bg-gradient-to-r from-orange-500 to-yellow-500 py-4 text-lg font-semibold text-white shadow-md transition-all hover:shadow-lg hover:from-orange-600 hover:to-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isProcessing ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            결제 처리 중...
          </span>
        ) : (
          '구매하기'
        )}
      </button>

      <button
        onClick={handleCart}
        disabled={isCartProcessing}
        className={`w-full rounded-full py-3 text-base font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
          isInCart
            ? 'bg-yellow-100 text-purple-700 border-2 border-purple-300'
            : 'border-2 border-gray-200 text-gray-700 hover:border-orange-300 hover:text-orange-500'
        }`}
      >
        {isCartProcessing ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            처리 중...
          </span>
        ) : isInCart ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            장바구니에 담김
          </span>
        ) : (
          <span className="flex items-center justify-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            장바구니에 담기
          </span>
        )}
      </button>

      {!isLoggedIn && (
        <p className="text-center text-sm text-gray-500">
          결제하려면 먼저 로그인이 필요합니다
        </p>
      )}
    </div>
  )
}

'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import Image from 'next/image'
import Link from 'next/link'
import * as PortOne from '@portone/browser-sdk/v2'

interface VideoPlayerWithAuthProps {
  videoUrl: string | null  // Cloudflare Stream 비디오 ID 또는 URL
  thumbnail: string | null
  title: string
  courseId: string
  price: number
  isPreview?: boolean  // 미리보기 레슨인지 여부
  lessonId?: string    // 레슨 ID (미리보기 검증용)
}

type AuthStatus = 'loading' | 'not_logged_in' | 'not_paid' | 'paid'

interface VideoTokenResponse {
  token: string
  videoId: string
  customerSubdomain: string
  expiresIn: number
}

/**
 * Cloudflare Stream URL 또는 비디오 ID에서 비디오 ID 추출
 */
function extractVideoId(urlOrId: string): string {
  // 이미 순수 ID인 경우 (32자 hex)
  if (/^[a-f0-9]{32}$/.test(urlOrId)) {
    return urlOrId
  }

  // Cloudflare Stream URL에서 ID 추출
  // 예: https://customer-xxx.cloudflarestream.com/VIDEO_ID/...
  // 예: https://watch.cloudflarestream.com/VIDEO_ID
  const patterns = [
    /cloudflarestream\.com\/([a-f0-9]{32})/,
    /watch\.cloudflarestream\.com\/([a-f0-9]{32})/,
    /videodelivery\.net\/([a-f0-9]{32})/,
  ]

  for (const pattern of patterns) {
    const match = urlOrId.match(pattern)
    if (match) {
      return match[1]
    }
  }

  // 패턴 매칭 실패시 원본 반환 (fallback)
  return urlOrId
}

/**
 * Cloudflare Stream 플레이어 컴포넌트
 */
function CloudflareStreamPlayer({
  token,
  customerSubdomain,
}: {
  token: string
  customerSubdomain: string
}) {
  // Cloudflare Stream Signed URL 형식 - customer subdomain 사용
  const iframeSrc = `https://${customerSubdomain}.cloudflarestream.com/${token}/iframe`

  return (
    <div className="absolute inset-0 bg-black">
      <iframe
        src={iframeSrc}
        title="Video player"
        className="absolute inset-0 h-full w-full border-0"
        allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
        allowFullScreen
      />
    </div>
  )
}

/**
 * 비디오 로딩 스피너
 */
function VideoLoadingSpinner() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="h-16 w-16 rounded-full border-4 border-orange-200"></div>
          <div className="absolute top-0 h-16 w-16 animate-spin rounded-full border-4 border-orange-500 border-t-transparent"></div>
        </div>
        <p className="text-white text-sm font-medium">영상을 불러오는 중...</p>
      </div>
    </div>
  )
}

export default function VideoPlayerWithAuth({
  videoUrl,
  thumbnail,
  title,
  courseId,
  price,
  isPreview = false,
  lessonId,
}: VideoPlayerWithAuthProps) {
  const [authStatus, setAuthStatus] = useState<AuthStatus>('loading')
  const [isProcessing, setIsProcessing] = useState(false)
  const [videoToken, setVideoToken] = useState<VideoTokenResponse | null>(null)
  const [isLoadingVideo, setIsLoadingVideo] = useState(false)
  const [videoError, setVideoError] = useState<string | null>(null)

  // 비디오 토큰 요청 함수
  const fetchVideoToken = useCallback(async () => {
    if (!videoUrl) return

    setIsLoadingVideo(true)
    setVideoError(null)

    try {
      const videoId = extractVideoId(videoUrl)

      // 미리보기 레슨인 경우 - 인증 없이 요청
      if (isPreview && lessonId) {
        const response = await fetch('/api/video/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ videoId, isPreview: true, lessonId }),
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || '토큰 요청 실패')
        }

        const tokenData: VideoTokenResponse = await response.json()
        setVideoToken(tokenData)
        return
      }

      // 일반 레슨 - Supabase 세션에서 access_token 가져오기
      const { data: { session } } = await supabase.auth.getSession()

      if (!session?.access_token) {
        setVideoError('세션이 만료되었습니다. 다시 로그인해주세요.')
        return
      }

      const response = await fetch('/api/video/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ videoId }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || '토큰 요청 실패')
      }

      const tokenData: VideoTokenResponse = await response.json()
      setVideoToken(tokenData)
    } catch (error) {
      console.error('비디오 토큰 요청 오류:', error)
      setVideoError(error instanceof Error ? error.message : '영상을 불러오지 못했습니다.')
    } finally {
      setIsLoadingVideo(false)
    }
  }, [videoUrl, isPreview, lessonId])

  // 결제 처리 함수
  async function handlePayment() {
    setIsProcessing(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        alert('로그인이 필요합니다.')
        setIsProcessing(false)
        return
      }

      const paymentId = `payment-${courseId}-${user.id}-${Date.now()}`

      const response = await PortOne.requestPayment({
        storeId: process.env.NEXT_PUBLIC_PORTONE_STORE_ID!,
        channelKey: process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY!,
        paymentId: paymentId,
        orderName: title,
        totalAmount: price,
        currency: 'CURRENCY_KRW',
        payMethod: 'EASY_PAY',
        easyPay: {
          easyPayProvider: 'KAKAOPAY',
        },
        customer: {
          email: user.email,
        },
      })

      if (response?.code) {
        alert(`결제 실패: ${response.message}`)
        setIsProcessing(false)
        return
      }

      const { error: updateError } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          has_paid: true,
        }, {
          onConflict: 'id',
        })

      if (updateError) {
        console.error('프로필 업데이트 오류:', updateError)
        alert('결제는 완료되었으나 프로필 업데이트에 실패했습니다. 고객센터에 문의해주세요.')
        setIsProcessing(false)
        return
      }

      alert('결제 완료!')
      window.location.reload()

    } catch (error) {
      console.error('결제 오류:', error)
      alert('결제 처리 중 오류가 발생했습니다.')
      setIsProcessing(false)
    }
  }

  // 인증 상태 확인
  useEffect(() => {
    async function checkAuth() {
      // 미리보기 레슨이거나 무료 강의는 바로 paid 상태로 설정
      if (isPreview || price === 0) {
        setAuthStatus('paid')
        return
      }

      const { data: { user }, error: userError } = await supabase.auth.getUser()

      if (userError || !user) {
        setAuthStatus('not_logged_in')
        return
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('has_paid')
        .eq('id', user.id)
        .single()

      if (profileError || !profile) {
        setAuthStatus('not_paid')
        return
      }

      if (profile.has_paid) {
        setAuthStatus('paid')
      } else {
        setAuthStatus('not_paid')
      }
    }

    checkAuth()
  }, [isPreview, price])

  // 결제 완료 상태일 때 비디오 토큰 요청
  useEffect(() => {
    if (authStatus === 'paid' && videoUrl) {
      fetchVideoToken()
    }
  }, [authStatus, videoUrl, fetchVideoToken])

  // 로딩 중
  if (authStatus === 'loading') {
    return (
      <div className="relative aspect-video overflow-hidden rounded-2xl bg-gray-900 mb-8 shadow-2xl">
        <div className="flex h-full items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-orange-500 border-t-transparent"></div>
        </div>
      </div>
    )
  }

  // 로그인하지 않은 사용자
  if (authStatus === 'not_logged_in') {
    return (
      <div className="relative aspect-video overflow-hidden rounded-2xl bg-gray-900 mb-8 shadow-2xl">
        {thumbnail ? (
          <Image
            src={thumbnail}
            alt={title}
            fill
            className="object-cover opacity-30 blur-sm"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-pink-900 to-purple-900 opacity-50" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8">
          <div className="bg-white/10 backdrop-blur-sm rounded-full p-5 mb-6">
            <svg
              className="h-12 w-12 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
          <p className="text-white text-2xl font-bold mb-2">
            로그인이 필요합니다
          </p>
          <p className="text-gray-300 mb-8 max-w-md">
            이 강의를 시청하려면 먼저 로그인해주세요
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-3 rounded-full bg-gradient-to-r from-orange-500 to-yellow-500 px-10 py-4 text-lg font-semibold text-white shadow-lg transition-all hover:shadow-xl hover:scale-105 hover:from-orange-600 hover:to-yellow-600"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
            </svg>
            로그인하기
          </Link>
        </div>
      </div>
    )
  }

  // 결제하지 않은 사용자
  if (authStatus === 'not_paid') {
    return (
      <div className="relative aspect-video overflow-hidden rounded-2xl bg-gray-900 mb-8 shadow-2xl">
        {thumbnail ? (
          <Image
            src={thumbnail}
            alt={title}
            fill
            className="object-cover opacity-30 blur-sm"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-pink-900 to-purple-900 opacity-50" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8">
          <div className="bg-gradient-to-br from-orange-500/20 to-yellow-500/20 backdrop-blur-sm rounded-full p-5 mb-6 ring-2 ring-white/20">
            <svg
              className="h-12 w-12 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <p className="text-white text-2xl font-bold mb-2">
            프리미엄 강의입니다
          </p>
          <p className="text-gray-300 mb-8 max-w-md">
            결제 후 고품질 영상을 무제한으로 시청하세요
          </p>
          <button
            onClick={handlePayment}
            disabled={isProcessing}
            className="inline-flex items-center gap-3 rounded-full bg-gradient-to-r from-orange-500 to-yellow-500 px-10 py-4 text-lg font-semibold text-white shadow-lg transition-all hover:shadow-xl hover:scale-105 hover:from-orange-600 hover:to-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100"
          >
            {isProcessing ? (
              <>
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                결제 처리 중...
              </>
            ) : (
              <>
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
                지금 결제하기
              </>
            )}
          </button>
        </div>
      </div>
    )
  }

  // 결제한 사용자 - Cloudflare Stream 플레이어 표시
  return (
    <div className="relative aspect-video overflow-hidden rounded-2xl bg-gray-900 mb-8 shadow-2xl ring-1 ring-white/10">
      {/* 비디오 로딩 중 */}
      {isLoadingVideo && (
        <>
          {thumbnail && (
            <Image
              src={thumbnail}
              alt={title}
              fill
              className="object-cover opacity-50"
            />
          )}
          <VideoLoadingSpinner />
        </>
      )}

      {/* 비디오 에러 */}
      {videoError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 text-center p-8">
          <div className="bg-red-500/20 rounded-full p-4 mb-4">
            <svg className="h-10 w-10 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <p className="text-white text-lg font-medium mb-2">영상을 불러오지 못했습니다</p>
          <p className="text-gray-400 text-sm mb-6">{videoError}</p>
          <button
            onClick={fetchVideoToken}
            className="inline-flex items-center gap-2 rounded-full bg-white/10 px-6 py-3 text-sm font-medium text-white hover:bg-white/20 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            다시 시도
          </button>
        </div>
      )}

      {/* Cloudflare Stream 플레이어 */}
      {videoToken && !isLoadingVideo && !videoError && (
        <CloudflareStreamPlayer
          token={videoToken.token}
          customerSubdomain={videoToken.customerSubdomain}
        />
      )}

      {/* 비디오 URL이 없는 경우 */}
      {!videoUrl && !isLoadingVideo && (
        <>
          {thumbnail ? (
            <Image
              src={thumbnail}
              alt={title}
              fill
              className="object-cover"
              priority
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-gradient-to-br from-orange-100 to-yellow-100">
              <span className="text-8xl">🚀</span>
            </div>
          )}
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <p className="text-white text-lg font-medium">영상이 곧 업로드됩니다</p>
          </div>
        </>
      )}
    </div>
  )
}

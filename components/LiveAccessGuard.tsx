'use client'

import { useEffect, useState, ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { LiveSession, AccessCheckResult, JitsiJoinInfo } from '@/types/live'

interface LiveAccessGuardProps {
  sessionId: string
  children: (joinInfo: JitsiJoinInfo) => ReactNode
}

export default function LiveAccessGuard({ sessionId, children }: LiveAccessGuardProps) {
  const [status, setStatus] = useState<'loading' | 'allowed' | 'denied'>('loading')
  const [denyReason, setDenyReason] = useState<AccessCheckResult['reason']>()
  const [joinInfo, setJoinInfo] = useState<JitsiJoinInfo | null>(null)
  const [session, setSession] = useState<LiveSession | null>(null)

  useEffect(() => {
    checkAccess()
  }, [sessionId])

  const checkAccess = async () => {
    try {
      console.log('[LiveAccessGuard] Starting access check for session:', sessionId)

      const { data: { session: authSession } } = await supabase.auth.getSession()
      console.log('[LiveAccessGuard] Auth session:', authSession ? 'exists' : 'none')

      const response = await fetch(`/api/live/${sessionId}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authSession?.access_token && {
            Authorization: `Bearer ${authSession.access_token}`,
          }),
        },
        body: JSON.stringify({
          displayName: authSession?.user?.email?.split('@')[0] || 'Guest',
        }),
      })

      console.log('[LiveAccessGuard] Response status:', response.status)
      const result: AccessCheckResult = await response.json()
      console.log('[LiveAccessGuard] Result:', result)

      if (result.session) {
        setSession(result.session)
      }

      if (result.allowed && result.joinInfo) {
        setJoinInfo(result.joinInfo)
        setStatus('allowed')
      } else {
        setDenyReason(result.reason)
        setStatus('denied')
      }
    } catch (error) {
      console.error('[LiveAccessGuard] Access check error:', error)
      setDenyReason('session_not_found')
      setStatus('denied')
    }
  }

  // 로딩 상태
  if (status === 'loading') {
    return (
      <div className="aspect-video bg-gray-900 flex items-center justify-center rounded-xl">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-orange-500 border-t-transparent" />
          <p className="text-gray-400">접근 권한 확인 중...</p>
        </div>
      </div>
    )
  }

  // 접근 거부 상태
  if (status === 'denied') {
    return (
      <div className="aspect-video bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center rounded-xl">
        <div className="text-center p-8">
          {denyReason === 'not_logged_in' && (
            <>
              <div className="w-20 h-20 rounded-full bg-gray-800 flex items-center justify-center mx-auto mb-6">
                <svg
                  className="w-10 h-10 text-gray-400"
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
              <h3 className="text-white text-xl font-bold mb-2">로그인이 필요합니다</h3>
              <p className="text-gray-400 mb-6">
                이 라이브 강의를 시청하려면 먼저 로그인해주세요
              </p>
              <Link
                href={`/login?redirect=/live/${sessionId}`}
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-orange-500 to-yellow-500 px-8 py-3 font-semibold text-white hover:opacity-90 transition-opacity"
              >
                로그인하기
              </Link>
            </>
          )}

          {denyReason === 'not_purchased' && (
            <>
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-orange-500/20 to-yellow-500/20 flex items-center justify-center mx-auto mb-6">
                <svg
                  className="w-10 h-10 text-orange-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <h3 className="text-white text-xl font-bold mb-2">유료 라이브 강의입니다</h3>
              <p className="text-gray-400 mb-6">
                이 라이브를 시청하려면 관련 강의를 구매해주세요
              </p>
              {session?.course_id && (
                <Link
                  href={`/courses/${session.course_id}`}
                  className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-orange-500 to-yellow-500 px-8 py-3 font-semibold text-white hover:opacity-90 transition-opacity"
                >
                  강의 구매하기
                </Link>
              )}
            </>
          )}

          {denyReason === 'session_not_live' && (
            <>
              <div className="w-20 h-20 rounded-full bg-yellow-500/20 flex items-center justify-center mx-auto mb-6">
                <svg
                  className="w-10 h-10 text-yellow-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h3 className="text-white text-xl font-bold mb-2">
                {session?.status === 'ended' ? '종료된 라이브입니다' : '아직 시작되지 않았습니다'}
              </h3>
              <p className="text-gray-400 mb-6">
                {session?.status === 'ended'
                  ? '이 라이브 강의는 이미 종료되었습니다'
                  : '강사가 라이브를 시작하면 자동으로 연결됩니다'}
              </p>
              {session?.scheduled_at && session?.status !== 'ended' && (
                <p className="text-orange-400 font-medium">
                  예정 시간:{' '}
                  {new Date(session.scheduled_at).toLocaleString('ko-KR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              )}
            </>
          )}

          {denyReason === 'session_not_found' && (
            <>
              <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-6">
                <svg
                  className="w-10 h-10 text-red-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <h3 className="text-white text-xl font-bold mb-2">라이브를 찾을 수 없습니다</h3>
              <p className="text-gray-400 mb-6">
                요청하신 라이브 세션이 존재하지 않거나 삭제되었습니다
              </p>
              <Link
                href="/live"
                className="inline-flex items-center gap-2 rounded-full bg-gray-700 px-8 py-3 font-semibold text-white hover:bg-gray-600 transition-colors"
              >
                라이브 목록으로
              </Link>
            </>
          )}
        </div>
      </div>
    )
  }

  // 접근 허용 - children 렌더링
  if (joinInfo) {
    return <>{children(joinInfo)}</>
  }

  return null
}

'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import LiveAccessGuard from '@/components/LiveAccessGuard'
import JitsiMeetPlayer from '@/components/JitsiMeetPlayer'
import { LiveSessionWithDetails } from '@/types/live'

export default function LiveWatchPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const [session, setSession] = useState<LiveSessionWithDetails | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchSession()
  }, [id])

  const fetchSession = async () => {
    try {
      const response = await fetch(`/api/live/${id}`)
      const data = await response.json()

      if (response.ok) {
        setSession(data.session)
      }
    } catch (error) {
      console.error('Failed to fetch session:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (isLoading) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 pt-24 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-orange-500 border-t-transparent"></div>
        </div>
      </>
    )
  }

  if (!session) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 pt-24 flex items-center justify-center">
          <div className="text-center">
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
            <p className="text-gray-400 mb-6">요청하신 라이브 세션이 존재하지 않습니다</p>
            <Link
              href="/live"
              className="inline-flex items-center gap-2 rounded-full bg-gray-700 px-8 py-3 font-semibold text-white hover:bg-gray-600 transition-colors"
            >
              라이브 목록으로
            </Link>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 pt-20 pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 상단 네비게이션 */}
        <div className="py-4">
          <Link
            href="/live"
            className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            라이브 목록
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 메인 영역 - 비디오 플레이어 */}
          <div className="lg:col-span-2">
            <LiveAccessGuard sessionId={id}>
              {(joinInfo) => (
                <JitsiMeetPlayer
                  roomName={joinInfo.roomName}
                  displayName={joinInfo.displayName}
                  email={joinInfo.email}
                  isHost={joinInfo.isHost}
                />
              )}
            </LiveAccessGuard>

            {/* 제목 및 설명 */}
            <div className="mt-6">
              <div className="flex items-start gap-3 mb-4">
                {session.status === 'live' && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500 text-white text-sm font-medium">
                    <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                    LIVE
                  </span>
                )}
                <h1 className="text-2xl font-bold text-white">{session.title}</h1>
              </div>

              {session.description && (
                <p className="text-gray-400 whitespace-pre-wrap">{session.description}</p>
              )}
            </div>
          </div>

          {/* 사이드바 */}
          <div className="space-y-6">
            {/* 강사 정보 */}
            {session.instructor && (
              <div className="bg-gray-800/50 rounded-xl p-6">
                <h3 className="text-sm font-medium text-gray-400 mb-4">강사</h3>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-400 to-yellow-400 flex items-center justify-center text-white font-bold overflow-hidden">
                    {session.instructor.avatar_url ? (
                      <img
                        src={session.instructor.avatar_url}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      session.instructor.full_name?.charAt(0) || 'U'
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-white">
                      {session.instructor.full_name || '강사'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* 세션 정보 */}
            <div className="bg-gray-800/50 rounded-xl p-6">
              <h3 className="text-sm font-medium text-gray-400 mb-4">세션 정보</h3>
              <dl className="space-y-4">
                <div>
                  <dt className="text-sm text-gray-500">상태</dt>
                  <dd className="font-medium text-white">
                    {session.status === 'live'
                      ? '진행중'
                      : session.status === 'scheduled'
                      ? '예정'
                      : '종료'}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">접근 권한</dt>
                  <dd className="font-medium text-white">
                    {session.access_type === 'public' ? '전체 공개' : '유료 전용'}
                  </dd>
                </div>
                {session.scheduled_at && (
                  <div>
                    <dt className="text-sm text-gray-500">예정 시간</dt>
                    <dd className="font-medium text-white">{formatDate(session.scheduled_at)}</dd>
                  </div>
                )}
                {session.started_at && (
                  <div>
                    <dt className="text-sm text-gray-500">시작 시간</dt>
                    <dd className="font-medium text-white">{formatDate(session.started_at)}</dd>
                  </div>
                )}
              </dl>
            </div>

            {/* 연결된 강의 */}
            {session.course && (
              <div className="bg-gray-800/50 rounded-xl p-6">
                <h3 className="text-sm font-medium text-gray-400 mb-4">연결된 강의</h3>
                <Link
                  href={`/courses/${session.course.id}`}
                  className="block p-4 bg-gray-700/50 rounded-lg hover:bg-gray-700 transition-colors"
                >
                  <p className="font-medium text-white mb-1">{session.course.title}</p>
                  <p className="text-sm text-orange-400">
                    {session.course.price > 0
                      ? `₩${session.course.price.toLocaleString()}`
                      : '무료'}
                  </p>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
      </div>
    </>
  )
}

'use client'

import { useState, useEffect, use } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import JitsiMeetPlayer from '@/components/JitsiMeetPlayer'
import { LiveSessionWithDetails } from '@/types/live'

export default function InstructorLiveDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const [session, setSession] = useState<LiveSessionWithDetails | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [participantCount, setParticipantCount] = useState(0)
  const [userName, setUserName] = useState('')
  const [userEmail, setUserEmail] = useState('')

  useEffect(() => {
    fetchSession()
    fetchUserInfo()
  }, [id])

  const fetchUserInfo = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      setUserEmail(user.email || '')
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single()
      setUserName(profile?.full_name || user.email?.split('@')[0] || 'Host')
    }
  }

  const fetchSession = async () => {
    try {
      const response = await fetch(`/api/live/${id}`)
      const data = await response.json()

      if (!response.ok) {
        router.push('/instructor/live')
        return
      }

      setSession(data.session)
    } catch (error) {
      console.error('Failed to fetch session:', error)
      router.push('/instructor/live')
    } finally {
      setIsLoading(false)
    }
  }

  const handleStart = async () => {
    if (!confirm('라이브를 시작하시겠습니까?')) return

    try {
      const { data: { session: authSession } } = await supabase.auth.getSession()
      if (!authSession) return

      const response = await fetch(`/api/live/${id}/start`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authSession.access_token}`,
        },
      })

      if (response.ok) {
        fetchSession()
      }
    } catch (error) {
      console.error('Failed to start session:', error)
    }
  }

  const handleEnd = async () => {
    if (!confirm('라이브를 종료하시겠습니까?')) return

    try {
      const { data: { session: authSession } } = await supabase.auth.getSession()
      if (!authSession) return

      const response = await fetch(`/api/live/${id}/end`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authSession.access_token}`,
        },
      })

      if (response.ok) {
        fetchSession()
      }
    } catch (error) {
      console.error('Failed to end session:', error)
    }
  }

  const handleDelete = async () => {
    if (!confirm('라이브 세션을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) return

    try {
      const { data: { session: authSession } } = await supabase.auth.getSession()
      if (!authSession) return

      const response = await fetch(`/api/live/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${authSession.access_token}`,
        },
      })

      if (response.ok) {
        router.push('/instructor/live')
      }
    } catch (error) {
      console.error('Failed to delete session:', error)
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
      <div className="p-8 flex justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-orange-500 border-t-transparent"></div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500">세션을 찾을 수 없습니다.</p>
      </div>
    )
  }

  return (
    <div className="p-6 lg:p-8">
      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <Link
            href="/instructor/live"
            className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            목록으로
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">{session.title}</h1>
        </div>

        {/* 상태 뱃지 및 액션 */}
        <div className="flex items-center gap-3">
          <span
            className={`px-3 py-1 rounded-full text-sm font-medium ${
              session.status === 'live'
                ? 'bg-red-100 text-red-600'
                : session.status === 'scheduled'
                ? 'bg-blue-100 text-blue-600'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            {session.status === 'live'
              ? 'LIVE'
              : session.status === 'scheduled'
              ? '예정'
              : '종료'}
          </span>

          {session.status === 'scheduled' && (
            <button
              onClick={handleStart}
              className="px-4 py-2 bg-gradient-to-r from-orange-500 to-yellow-500 text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
            >
              라이브 시작
            </button>
          )}

          {session.status === 'live' && (
            <button
              onClick={handleEnd}
              className="px-4 py-2 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-colors"
            >
              라이브 종료
            </button>
          )}

          {session.status !== 'live' && (
            <button
              onClick={handleDelete}
              className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg font-medium hover:bg-gray-200 transition-colors"
            >
              삭제
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 메인 영역 - Jitsi 플레이어 */}
        <div className="lg:col-span-2">
          {session.status === 'live' ? (
            <JitsiMeetPlayer
              roomName={session.room_name}
              displayName={userName}
              email={userEmail}
              isHost={true}
              onParticipantJoined={() => setParticipantCount((c) => c + 1)}
              onParticipantLeft={() => setParticipantCount((c) => Math.max(0, c - 1))}
            />
          ) : session.status === 'scheduled' ? (
            <div className="aspect-video bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl flex items-center justify-center">
              <div className="text-center">
                <div className="w-20 h-20 rounded-full bg-blue-500/20 flex items-center justify-center mx-auto mb-4">
                  <svg
                    className="w-10 h-10 text-blue-400"
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
                <h3 className="text-white text-xl font-bold mb-2">라이브 예정</h3>
                <p className="text-gray-400 mb-4">{formatDate(session.scheduled_at)}</p>
                <button
                  onClick={handleStart}
                  className="px-6 py-3 bg-gradient-to-r from-orange-500 to-yellow-500 text-white rounded-full font-medium hover:opacity-90 transition-opacity"
                >
                  지금 시작하기
                </button>
              </div>
            </div>
          ) : (
            <div className="aspect-video bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl flex items-center justify-center">
              <div className="text-center">
                <div className="w-20 h-20 rounded-full bg-gray-700 flex items-center justify-center mx-auto mb-4">
                  <svg
                    className="w-10 h-10 text-gray-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <h3 className="text-white text-xl font-bold mb-2">라이브 종료</h3>
                <p className="text-gray-400">{formatDate(session.ended_at)}</p>
              </div>
            </div>
          )}

          {/* 녹화 안내 (라이브 중일 때) */}
          {session.status === 'live' && (
            <div className="mt-4 bg-blue-50 rounded-xl p-4">
              <div className="flex gap-3">
                <svg
                  className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <div className="text-sm text-blue-800">
                  <p className="font-medium">녹화 방법</p>
                  <p>
                    라이브 녹화를 원하시면 <strong>OBS Studio</strong> 또는 브라우저의 <strong>화면 녹화 기능</strong>을 사용해주세요.
                    녹화 후 강의 관리 페이지에서 영상을 업로드할 수 있습니다.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 사이드바 - 세션 정보 */}
        <div className="space-y-6">
          {/* 참여자 수 (라이브 중) */}
          {session.status === 'live' && (
            <div className="bg-white rounded-xl border border-gray-100 p-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                <span className="text-sm font-medium text-gray-500">실시간 참여자</span>
              </div>
              <p className="text-3xl font-bold text-gray-900">{participantCount}명</p>
            </div>
          )}

          {/* 세션 정보 */}
          <div className="bg-white rounded-xl border border-gray-100 p-6">
            <h3 className="font-bold text-gray-900 mb-4">세션 정보</h3>
            <dl className="space-y-4">
              <div>
                <dt className="text-sm text-gray-500">접근 권한</dt>
                <dd className="font-medium text-gray-900">
                  {session.access_type === 'public' ? '전체 공개' : '유료 전용'}
                </dd>
              </div>
              {session.course && (
                <div>
                  <dt className="text-sm text-gray-500">연결된 강의</dt>
                  <dd>
                    <Link
                      href={`/courses/${session.course.id}`}
                      className="font-medium text-orange-500 hover:underline"
                    >
                      {session.course.title}
                    </Link>
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-sm text-gray-500">예정 시간</dt>
                <dd className="font-medium text-gray-900">{formatDate(session.scheduled_at)}</dd>
              </div>
              {session.started_at && (
                <div>
                  <dt className="text-sm text-gray-500">시작 시간</dt>
                  <dd className="font-medium text-gray-900">{formatDate(session.started_at)}</dd>
                </div>
              )}
              {session.ended_at && (
                <div>
                  <dt className="text-sm text-gray-500">종료 시간</dt>
                  <dd className="font-medium text-gray-900">{formatDate(session.ended_at)}</dd>
                </div>
              )}
              <div>
                <dt className="text-sm text-gray-500">생성일</dt>
                <dd className="font-medium text-gray-900">{formatDate(session.created_at)}</dd>
              </div>
            </dl>
          </div>

          {/* 공유 링크 */}
          <div className="bg-white rounded-xl border border-gray-100 p-6">
            <h3 className="font-bold text-gray-900 mb-4">공유 링크</h3>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={`${typeof window !== 'undefined' ? window.location.origin : ''}/live/${session.id}`}
                className="flex-1 px-3 py-2 bg-gray-50 rounded-lg text-sm text-gray-600 truncate"
              />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/live/${session.id}`)
                  alert('링크가 복사되었습니다!')
                }}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
              >
                복사
              </button>
            </div>
          </div>

          {/* 설명 */}
          {session.description && (
            <div className="bg-white rounded-xl border border-gray-100 p-6">
              <h3 className="font-bold text-gray-900 mb-4">설명</h3>
              <p className="text-gray-600 text-sm whitespace-pre-wrap">{session.description}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

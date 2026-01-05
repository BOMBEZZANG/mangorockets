'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

interface Lesson {
  id: string
  title: string
  video_url: string | null
  is_preview: boolean
}

interface LessonVideoPlayerProps {
  lesson: Lesson
  courseId: string
  price: number
}

interface VideoTokenResponse {
  token: string
  videoId: string
  customerSubdomain: string
  expiresIn: number
}

type AuthStatus = 'loading' | 'not_logged_in' | 'not_paid' | 'paid'

function extractVideoId(urlOrId: string): string {
  if (/^[a-f0-9]{32}$/.test(urlOrId)) {
    return urlOrId
  }

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

  return urlOrId
}

function CloudflareStreamPlayer({
  token,
  customerSubdomain,
}: {
  token: string
  customerSubdomain: string
}) {
  const iframeSrc = `https://${customerSubdomain}.cloudflarestream.com/${token}/iframe`

  return (
    <iframe
      src={iframeSrc}
      title="Video player"
      className="absolute inset-0 h-full w-full border-0"
      allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
      allowFullScreen
    />
  )
}

export default function LessonVideoPlayer({
  lesson,
  courseId,
  price,
}: LessonVideoPlayerProps) {
  const router = useRouter()
  const [authStatus, setAuthStatus] = useState<AuthStatus>('loading')
  const [videoToken, setVideoToken] = useState<VideoTokenResponse | null>(null)
  const [isLoadingVideo, setIsLoadingVideo] = useState(false)
  const [videoError, setVideoError] = useState<string | null>(null)
  const [isCompleted, setIsCompleted] = useState(false)
  const [isMarkingComplete, setIsMarkingComplete] = useState(false)

  // 레슨 완료 처리
  const markAsComplete = useCallback(async () => {
    if (isCompleted || lesson.is_preview) return

    setIsMarkingComplete(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { error } = await supabase
        .from('lesson_progress')
        .upsert({
          user_id: user.id,
          lesson_id: lesson.id,
          course_id: courseId,
          completed: true,
          completed_at: new Date().toISOString(),
          last_watched_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,lesson_id',
        })

      if (!error) {
        setIsCompleted(true)
      }
    } catch (error) {
      console.error('진도 업데이트 오류:', error)
    } finally {
      setIsMarkingComplete(false)
    }
  }, [lesson.id, lesson.is_preview, courseId, isCompleted])

  // 레슨 완료 여부 확인
  useEffect(() => {
    async function checkProgress() {
      if (lesson.is_preview) return

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('lesson_progress')
        .select('completed')
        .eq('user_id', user.id)
        .eq('lesson_id', lesson.id)
        .single()

      if (data?.completed) {
        setIsCompleted(true)
      }
    }

    checkProgress()
  }, [lesson.id, lesson.is_preview])

  const fetchVideoToken = useCallback(async () => {
    if (!lesson.video_url) return

    setIsLoadingVideo(true)
    setVideoError(null)

    try {
      const videoId = extractVideoId(lesson.video_url)

      // 미리보기 레슨인 경우
      if (lesson.is_preview) {
        const response = await fetch('/api/video/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ videoId, isPreview: true, lessonId: lesson.id }),
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || '토큰 요청 실패')
        }

        const tokenData: VideoTokenResponse = await response.json()
        setVideoToken(tokenData)
        return
      }

      // 일반 레슨
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
        body: JSON.stringify({ videoId, courseId, lessonId: lesson.id }),
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
  }, [lesson, courseId])

  // 인증 상태 확인
  useEffect(() => {
    async function checkAuth() {
      // 미리보기 레슨이거나 무료 강의
      if (lesson.is_preview || price === 0) {
        setAuthStatus('paid')
        return
      }

      const { data: { user }, error: userError } = await supabase.auth.getUser()

      if (userError || !user) {
        setAuthStatus('not_logged_in')
        return
      }

      // 구매 여부 확인
      const { data: purchase } = await supabase
        .from('purchases')
        .select('id')
        .eq('user_id', user.id)
        .eq('course_id', courseId)
        .single()

      if (purchase) {
        setAuthStatus('paid')
      } else {
        setAuthStatus('not_paid')
      }
    }

    checkAuth()
  }, [lesson.is_preview, price, courseId])

  // 결제 완료 상태일 때 비디오 토큰 요청
  useEffect(() => {
    if (authStatus === 'paid' && lesson.video_url) {
      fetchVideoToken()
    }
  }, [authStatus, lesson.video_url, fetchVideoToken])

  // 로딩 중
  if (authStatus === 'loading') {
    return (
      <div className="relative aspect-video bg-gray-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="h-16 w-16 rounded-full border-4 border-orange-200/20"></div>
            <div className="absolute top-0 h-16 w-16 animate-spin rounded-full border-4 border-orange-500 border-t-transparent"></div>
          </div>
          <p className="text-gray-400 text-sm">불러오는 중...</p>
        </div>
      </div>
    )
  }

  // 로그인하지 않은 사용자
  if (authStatus === 'not_logged_in') {
    return (
      <div className="relative aspect-video bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center">
        <div className="text-center p-8">
          <div className="w-20 h-20 rounded-full bg-gray-800 flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h3 className="text-white text-xl font-bold mb-2">로그인이 필요합니다</h3>
          <p className="text-gray-400 mb-6">이 강의를 시청하려면 먼저 로그인해주세요</p>
          <Link
            href={`/login?redirect=/courses/${courseId}/lessons/${lesson.id}`}
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-orange-500 to-yellow-500 px-8 py-3 font-semibold text-white hover:shadow-lg transition-all"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
      <div className="relative aspect-video bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center">
        <div className="text-center p-8">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-orange-500/20 to-yellow-500/20 flex items-center justify-center mx-auto mb-6 ring-2 ring-orange-500/30">
            <svg className="w-10 h-10 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-white text-xl font-bold mb-2">프리미엄 강의입니다</h3>
          <p className="text-gray-400 mb-6">이 레슨을 시청하려면 강의를 구매해주세요</p>
          <Link
            href={`/courses/${courseId}`}
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-orange-500 to-yellow-500 px-8 py-3 font-semibold text-white hover:shadow-lg transition-all"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
            강의 구매하기
          </Link>
        </div>
      </div>
    )
  }

  // 비디오 URL이 없는 경우
  if (!lesson.video_url) {
    return (
      <div className="relative aspect-video bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🎬</div>
          <p className="text-gray-400 text-lg">영상이 곧 업로드됩니다</p>
        </div>
      </div>
    )
  }

  // 비디오 플레이어
  return (
    <div>
      <div className="relative aspect-video bg-black">
        {/* 비디오 로딩 중 */}
        {isLoadingVideo && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
            <div className="flex flex-col items-center gap-4">
              <div className="relative">
                <div className="h-16 w-16 rounded-full border-4 border-orange-200/20"></div>
                <div className="absolute top-0 h-16 w-16 animate-spin rounded-full border-4 border-orange-500 border-t-transparent"></div>
              </div>
              <p className="text-gray-400 text-sm">영상을 불러오는 중...</p>
            </div>
          </div>
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
      </div>

      {/* 학습 완료 버튼 (미리보기가 아닌 경우만) */}
      {!lesson.is_preview && authStatus === 'paid' && videoToken && (
        <div className="bg-gray-800 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isCompleted ? (
              <>
                <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-green-400 text-sm font-medium">학습 완료</span>
              </>
            ) : (
              <span className="text-gray-400 text-sm">영상을 시청한 후 학습 완료 버튼을 눌러주세요</span>
            )}
          </div>
          <button
            onClick={markAsComplete}
            disabled={isCompleted || isMarkingComplete}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              isCompleted
                ? 'bg-green-500/20 text-green-400 cursor-default'
                : 'bg-gradient-to-r from-orange-500 to-yellow-500 text-white hover:shadow-lg disabled:opacity-50'
            }`}
          >
            {isMarkingComplete ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                처리 중...
              </span>
            ) : isCompleted ? (
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                완료됨
              </span>
            ) : (
              '학습 완료하기'
            )}
          </button>
        </div>
      )}
    </div>
  )
}

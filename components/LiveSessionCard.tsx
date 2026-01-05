'use client'

import Link from 'next/link'
import { LiveSessionWithDetails } from '@/types/live'

interface LiveSessionCardProps {
  session: LiveSessionWithDetails
  showInstructorInfo?: boolean
  isManageMode?: boolean
  onStart?: () => void
  onEnd?: () => void
  onDelete?: () => void
}

export default function LiveSessionCard({
  session,
  showInstructorInfo = true,
  isManageMode = false,
  onStart,
  onEnd,
  onDelete,
}: LiveSessionCardProps) {
  const statusConfig = {
    scheduled: {
      label: '예정',
      bgColor: 'bg-blue-500',
      textColor: 'text-blue-500',
      borderColor: 'border-blue-500',
    },
    live: {
      label: 'LIVE',
      bgColor: 'bg-red-500',
      textColor: 'text-red-500',
      borderColor: 'border-red-500',
    },
    ended: {
      label: '종료',
      bgColor: 'bg-gray-500',
      textColor: 'text-gray-500',
      borderColor: 'border-gray-500',
    },
    cancelled: {
      label: '취소',
      bgColor: 'bg-gray-500',
      textColor: 'text-gray-500',
      borderColor: 'border-gray-500',
    },
  }

  const config = statusConfig[session.status]

  const formatDate = (dateString: string | null) => {
    if (!dateString) return null
    return new Date(dateString).toLocaleString('ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getLiveDuration = () => {
    if (!session.started_at) return null
    const start = new Date(session.started_at)
    const end = session.ended_at ? new Date(session.ended_at) : new Date()
    const diffMs = end.getTime() - start.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    if (diffMins < 60) return `${diffMins}분`
    const hours = Math.floor(diffMins / 60)
    const mins = diffMins % 60
    return `${hours}시간 ${mins}분`
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
      {/* 썸네일 영역 */}
      <div className="relative aspect-video bg-gradient-to-br from-orange-100 to-yellow-100">
        {session.thumbnail ? (
          <img
            src={session.thumbnail}
            alt={session.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg
              className="w-16 h-16 text-orange-300"
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
        )}

        {/* 상태 뱃지 */}
        <div className="absolute top-3 left-3">
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-white text-sm font-medium ${config.bgColor}`}
          >
            {session.status === 'live' && (
              <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
            )}
            {config.label}
          </span>
        </div>

        {/* 접근 권한 뱃지 */}
        <div className="absolute top-3 right-3">
          <span
            className={`px-2.5 py-1 rounded-full text-xs font-medium ${
              session.access_type === 'paid'
                ? 'bg-yellow-100 text-yellow-700'
                : 'bg-green-100 text-green-700'
            }`}
          >
            {session.access_type === 'paid' ? '유료' : '전체 공개'}
          </span>
        </div>

        {/* 연결된 강의 표시 */}
        {session.course && (
          <div className="absolute bottom-3 left-3 right-3">
            <div className="bg-black/60 backdrop-blur-sm rounded-lg px-3 py-1.5 text-xs text-white truncate">
              {session.course.title}
            </div>
          </div>
        )}
      </div>

      {/* 정보 영역 */}
      <div className="p-4">
        <h3 className="font-bold text-gray-900 mb-2 line-clamp-2">{session.title}</h3>

        {/* 강사 정보 */}
        {showInstructorInfo && session.instructor && (
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-orange-400 to-yellow-400 flex items-center justify-center text-white text-xs font-medium overflow-hidden">
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
            <span className="text-sm text-gray-600">
              {session.instructor.full_name || '강사'}
            </span>
          </div>
        )}

        {/* 시간 정보 */}
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          {session.status === 'scheduled' && session.scheduled_at && (
            <span>{formatDate(session.scheduled_at)} 예정</span>
          )}
          {session.status === 'live' && (
            <span className="text-red-500 font-medium">
              진행중 {getLiveDuration() && `(${getLiveDuration()})`}
            </span>
          )}
          {session.status === 'ended' && (
            <span>
              {formatDate(session.ended_at)} 종료
              {getLiveDuration() && ` (${getLiveDuration()})`}
            </span>
          )}
        </div>

        {/* 버튼 영역 */}
        {isManageMode ? (
          <div className="flex gap-2">
            {session.status === 'scheduled' && (
              <>
                <Link
                  href={`/instructor/live/${session.id}`}
                  className="flex-1 text-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
                >
                  수정
                </Link>
                <button
                  onClick={onStart}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-orange-500 to-yellow-500 text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
                >
                  시작
                </button>
              </>
            )}
            {session.status === 'live' && (
              <>
                <Link
                  href={`/instructor/live/${session.id}`}
                  className="flex-1 text-center px-4 py-2 bg-gradient-to-r from-orange-500 to-yellow-500 text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
                >
                  입장
                </Link>
                <button
                  onClick={onEnd}
                  className="px-4 py-2 bg-red-100 text-red-600 rounded-lg text-sm font-medium hover:bg-red-200 transition-colors"
                >
                  종료
                </button>
              </>
            )}
            {session.status === 'ended' && (
              <>
                <Link
                  href={`/instructor/live/${session.id}`}
                  className="flex-1 text-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
                >
                  상세
                </Link>
                <button
                  onClick={onDelete}
                  className="px-4 py-2 bg-red-100 text-red-600 rounded-lg text-sm font-medium hover:bg-red-200 transition-colors"
                >
                  삭제
                </button>
              </>
            )}
          </div>
        ) : (
          <Link
            href={`/live/${session.id}`}
            className={`block w-full text-center px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
              session.status === 'live'
                ? 'bg-gradient-to-r from-orange-500 to-yellow-500 text-white hover:opacity-90'
                : session.status === 'scheduled'
                ? 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                : 'bg-gray-100 text-gray-500'
            }`}
          >
            {session.status === 'live'
              ? '참여하기'
              : session.status === 'scheduled'
              ? '상세보기'
              : '종료됨'}
          </Link>
        )}
      </div>
    </div>
  )
}

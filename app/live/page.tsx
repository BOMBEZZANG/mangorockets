'use client'

import { useState, useEffect } from 'react'
import Navbar from '@/components/Navbar'
import LiveSessionCard from '@/components/LiveSessionCard'
import { LiveSessionWithDetails } from '@/types/live'

type FilterType = 'all' | 'live' | 'scheduled'

export default function LiveListPage() {
  const [sessions, setSessions] = useState<LiveSessionWithDetails[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState<FilterType>('all')

  useEffect(() => {
    fetchSessions()
  }, [])

  const fetchSessions = async () => {
    try {
      const response = await fetch('/api/live/list')
      const data = await response.json()
      console.log('[Live Page] Fetched sessions:', data)
      setSessions(data.sessions || [])
    } catch (error) {
      console.error('Failed to fetch sessions:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const filteredSessions = sessions.filter((session) => {
    if (filter === 'all') return true
    return session.status === filter
  })

  // 라이브 중인 세션을 먼저, 그 다음 예정된 세션
  const sortedSessions = [...filteredSessions].sort((a, b) => {
    if (a.status === 'live' && b.status !== 'live') return -1
    if (a.status !== 'live' && b.status === 'live') return 1
    return 0
  })

  const liveCount = sessions.filter((s) => s.status === 'live').length
  const scheduledCount = sessions.filter((s) => s.status === 'scheduled').length

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white pt-24 pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 헤더 */}
        <div className="text-center mb-12">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            라이브 강의
          </h1>
          <p className="text-gray-600 max-w-2xl mx-auto">
            실시간으로 진행되는 화상 강의에 참여하세요. 강사와 직접 소통하며 배울 수 있습니다.
          </p>
        </div>

        {/* 필터 */}
        <div className="flex justify-center gap-2 mb-8">
          <button
            onClick={() => setFilter('all')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-colors ${
              filter === 'all'
                ? 'bg-gradient-to-r from-orange-500 to-yellow-500 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
            }`}
          >
            전체
            <span
              className={`px-2 py-0.5 rounded-full text-xs ${
                filter === 'all' ? 'bg-white/20' : 'bg-gray-100'
              }`}
            >
              {sessions.length}
            </span>
          </button>
          <button
            onClick={() => setFilter('live')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-colors ${
              filter === 'live'
                ? 'bg-gradient-to-r from-orange-500 to-yellow-500 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
            }`}
          >
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            진행중
            <span
              className={`px-2 py-0.5 rounded-full text-xs ${
                filter === 'live' ? 'bg-white/20' : 'bg-gray-100'
              }`}
            >
              {liveCount}
            </span>
          </button>
          <button
            onClick={() => setFilter('scheduled')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-colors ${
              filter === 'scheduled'
                ? 'bg-gradient-to-r from-orange-500 to-yellow-500 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
            }`}
          >
            예정
            <span
              className={`px-2 py-0.5 rounded-full text-xs ${
                filter === 'scheduled' ? 'bg-white/20' : 'bg-gray-100'
              }`}
            >
              {scheduledCount}
            </span>
          </button>
        </div>

        {/* 로딩 */}
        {isLoading && (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-orange-500 border-t-transparent"></div>
          </div>
        )}

        {/* 세션 목록 */}
        {!isLoading && sortedSessions.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-24 h-24 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-6">
              <svg
                className="w-12 h-12 text-gray-400"
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
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              {filter === 'live'
                ? '진행중인 라이브가 없습니다'
                : filter === 'scheduled'
                ? '예정된 라이브가 없습니다'
                : '라이브 강의가 없습니다'}
            </h3>
            <p className="text-gray-500">
              {filter === 'live'
                ? '곧 새로운 라이브가 시작될 예정입니다'
                : '강사들이 새로운 라이브를 준비하고 있습니다'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sortedSessions.map((session) => (
              <LiveSessionCard key={session.id} session={session} />
            ))}
          </div>
        )}
      </div>
      </div>
    </>
  )
}

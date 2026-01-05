'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import LiveSessionCard from '@/components/LiveSessionCard'
import { LiveSessionWithDetails } from '@/types/live'

type TabType = 'all' | 'scheduled' | 'live' | 'ended'

export default function InstructorLivePage() {
  const [sessions, setSessions] = useState<LiveSessionWithDetails[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabType>('all')

  useEffect(() => {
    fetchSessions()
  }, [])

  const fetchSessions = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const response = await fetch('/api/live/list?my_sessions=true', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      const data = await response.json()
      setSessions(data.sessions || [])
    } catch (error) {
      console.error('Failed to fetch sessions:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleStart = async (sessionId: string) => {
    if (!confirm('라이브를 시작하시겠습니까?')) return

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const response = await fetch(`/api/live/${sessionId}/start`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      if (response.ok) {
        fetchSessions()
      }
    } catch (error) {
      console.error('Failed to start session:', error)
    }
  }

  const handleEnd = async (sessionId: string) => {
    if (!confirm('라이브를 종료하시겠습니까?')) return

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const response = await fetch(`/api/live/${sessionId}/end`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      if (response.ok) {
        fetchSessions()
      }
    } catch (error) {
      console.error('Failed to end session:', error)
    }
  }

  const handleDelete = async (sessionId: string) => {
    if (!confirm('라이브 세션을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) return

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const response = await fetch(`/api/live/${sessionId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      if (response.ok) {
        fetchSessions()
      }
    } catch (error) {
      console.error('Failed to delete session:', error)
    }
  }

  const filteredSessions = sessions.filter((session) => {
    if (activeTab === 'all') return true
    return session.status === activeTab
  })

  const tabs: { key: TabType; label: string; count: number }[] = [
    { key: 'all', label: '전체', count: sessions.length },
    { key: 'live', label: '진행중', count: sessions.filter((s) => s.status === 'live').length },
    { key: 'scheduled', label: '예정', count: sessions.filter((s) => s.status === 'scheduled').length },
    { key: 'ended', label: '종료', count: sessions.filter((s) => s.status === 'ended').length },
  ]

  if (isLoading) {
    return (
      <div className="p-8 flex justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-orange-500 border-t-transparent"></div>
      </div>
    )
  }

  return (
    <div className="p-6 lg:p-8">
      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">라이브 강의</h1>
          <p className="text-gray-500 mt-1">실시간 화상 강의를 관리하세요</p>
        </div>
        <Link
          href="/instructor/live/create"
          className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-yellow-500 text-white rounded-full font-medium hover:opacity-90 transition-opacity"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          새 라이브 만들기
        </Link>
      </div>

      {/* 탭 */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === tab.key
                ? 'bg-gradient-to-r from-orange-500 to-yellow-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {tab.label}
            <span
              className={`px-2 py-0.5 rounded-full text-xs ${
                activeTab === tab.key ? 'bg-white/20' : 'bg-gray-200'
              }`}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* 세션 목록 */}
      {filteredSessions.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
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
                d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {activeTab === 'all' ? '라이브 세션이 없습니다' : `${tabs.find((t) => t.key === activeTab)?.label} 세션이 없습니다`}
          </h3>
          <p className="text-gray-500 mb-6">새 라이브 강의를 만들어 수강생과 소통하세요</p>
          <Link
            href="/instructor/live/create"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-yellow-500 text-white rounded-full font-medium hover:opacity-90 transition-opacity"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            첫 라이브 만들기
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredSessions.map((session) => (
            <LiveSessionCard
              key={session.id}
              session={session}
              showInstructorInfo={false}
              isManageMode={true}
              onStart={() => handleStart(session.id)}
              onEnd={() => handleEnd(session.id)}
              onDelete={() => handleDelete(session.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { LiveAccessType, CreateLiveSessionData } from '@/types/live'

interface Course {
  id: string
  title: string
  price: number
}

export default function CreateLivePage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [courses, setCourses] = useState<Course[]>([])

  // 폼 상태
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [courseId, setCourseId] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')
  const [accessType, setAccessType] = useState<LiveAccessType>('public')
  const [isImmediate, setIsImmediate] = useState(false)

  useEffect(() => {
    fetchCourses()
  }, [])

  const fetchCourses = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('courses')
        .select('id, title, price')
        .eq('instructor', user.id)
        .eq('published', true)
        .order('created_at', { ascending: false })

      setCourses(data || [])
    } catch (error) {
      console.error('Failed to fetch courses:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      alert('제목을 입력해주세요.')
      return
    }

    if (!isImmediate && !scheduledAt) {
      alert('예약 시간을 선택하거나 즉시 시작을 선택해주세요.')
      return
    }

    setIsSubmitting(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }

      const payload: CreateLiveSessionData = {
        title: title.trim(),
        description: description.trim() || undefined,
        course_id: courseId || undefined,
        scheduled_at: isImmediate ? undefined : scheduledAt,
        access_type: accessType,
      }

      const response = await fetch('/api/live/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || '라이브 생성에 실패했습니다.')
      }

      // 즉시 시작인 경우 호스트 페이지로, 아니면 목록으로
      if (data.isImmediateStart) {
        router.push(`/instructor/live/${data.session.id}`)
      } else {
        router.push('/instructor/live')
      }
    } catch (error) {
      console.error('Failed to create live session:', error)
      alert(error instanceof Error ? error.message : '라이브 생성에 실패했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // 최소 시간: 현재 시간 + 5분
  const getMinDateTime = () => {
    const now = new Date()
    now.setMinutes(now.getMinutes() + 5)
    return now.toISOString().slice(0, 16)
  }

  return (
    <div className="p-6 lg:p-8 max-w-2xl mx-auto">
      {/* 헤더 */}
      <div className="mb-8">
        <Link
          href="/instructor/live"
          className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-4"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          돌아가기
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">새 라이브 만들기</h1>
        <p className="text-gray-500 mt-1">실시간 화상 강의를 생성합니다</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 제목 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            라이브 제목 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="예: 봄 메이크업 라이브 특강"
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-colors"
            required
          />
        </div>

        {/* 설명 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">설명</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="라이브 강의에 대한 간단한 설명을 입력하세요"
            rows={3}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-colors resize-none"
          />
        </div>

        {/* 연결 강의 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">연결할 강의 (선택)</label>
          <select
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-colors bg-white"
          >
            <option value="">독립 라이브 (강의 없음)</option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.title} {course.price > 0 ? `(₩${course.price.toLocaleString()})` : '(무료)'}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">
            강의를 연결하면 해당 강의 구매자만 유료 라이브에 참여할 수 있습니다
          </p>
        </div>

        {/* 시작 방식 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">시작 방식</label>
          <div className="space-y-3">
            <label className="flex items-center gap-3 p-4 rounded-xl border border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors">
              <input
                type="radio"
                name="startType"
                checked={!isImmediate}
                onChange={() => setIsImmediate(false)}
                className="w-4 h-4 text-orange-500 focus:ring-orange-500"
              />
              <div>
                <p className="font-medium text-gray-900">예약 시작</p>
                <p className="text-sm text-gray-500">특정 시간에 시작하도록 예약합니다</p>
              </div>
            </label>
            <label className="flex items-center gap-3 p-4 rounded-xl border border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors">
              <input
                type="radio"
                name="startType"
                checked={isImmediate}
                onChange={() => setIsImmediate(true)}
                className="w-4 h-4 text-orange-500 focus:ring-orange-500"
              />
              <div>
                <p className="font-medium text-gray-900">즉시 시작</p>
                <p className="text-sm text-gray-500">생성 즉시 라이브를 시작합니다</p>
              </div>
            </label>
          </div>
        </div>

        {/* 예약 시간 */}
        {!isImmediate && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              예약 시간 <span className="text-red-500">*</span>
            </label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              min={getMinDateTime()}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-colors"
              required={!isImmediate}
            />
          </div>
        )}

        {/* 접근 권한 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">접근 권한</label>
          <div className="space-y-3">
            <label className="flex items-center gap-3 p-4 rounded-xl border border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors">
              <input
                type="radio"
                name="accessType"
                value="public"
                checked={accessType === 'public'}
                onChange={() => setAccessType('public')}
                className="w-4 h-4 text-orange-500 focus:ring-orange-500"
              />
              <div className="flex-1">
                <p className="font-medium text-gray-900">전체 공개</p>
                <p className="text-sm text-gray-500">누구나 라이브에 참여할 수 있습니다</p>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                무료
              </span>
            </label>
            <label className="flex items-center gap-3 p-4 rounded-xl border border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors">
              <input
                type="radio"
                name="accessType"
                value="paid"
                checked={accessType === 'paid'}
                onChange={() => setAccessType('paid')}
                className="w-4 h-4 text-orange-500 focus:ring-orange-500"
              />
              <div className="flex-1">
                <p className="font-medium text-gray-900">유료 전용</p>
                <p className="text-sm text-gray-500">
                  {courseId
                    ? '연결된 강의 구매자만 참여할 수 있습니다'
                    : '로그인한 사용자만 참여할 수 있습니다'}
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
                유료
              </span>
            </label>
          </div>
        </div>

        {/* 안내 메시지 */}
        <div className="bg-blue-50 rounded-xl p-4">
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
              <p className="font-medium mb-1">로컬 녹화 안내</p>
              <p>
                라이브 중 녹화 버튼을 눌러 내 컴퓨터에 녹화본을 저장할 수 있습니다. 녹화 후 기존
                강의에 영상으로 업로드하세요.
              </p>
            </div>
          </div>
        </div>

        {/* 제출 버튼 */}
        <div className="flex gap-3 pt-4">
          <Link
            href="/instructor/live"
            className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium text-center hover:bg-gray-200 transition-colors"
          >
            취소
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 px-6 py-3 bg-gradient-to-r from-orange-500 to-yellow-500 text-white rounded-xl font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {isSubmitting ? '생성 중...' : isImmediate ? '라이브 시작' : '라이브 예약'}
          </button>
        </div>
      </form>
    </div>
  )
}

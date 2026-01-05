'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import Image from 'next/image'
import Link from 'next/link'

interface Course {
  id: string
  title: string
  thumbnail: string | null
  price: number
  category: string | null
  level: string | null
  published: boolean
  created_at: string
  instructor_id: string
  instructor_name: string | null
  instructor_email: string | null
  students_count: number
  revenue: number
}

export default function AdminCoursesPage() {
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft'>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [processingId, setProcessingId] = useState<string | null>(null)

  const PAGE_SIZE = 20

  const loadCourses = useCallback(async () => {
    setLoading(true)

    let query = supabase
      .from('courses')
      .select('id, title, thumbnail, price, category, level, published, created_at, instructor', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE - 1)

    if (statusFilter === 'published') {
      query = query.eq('published', true)
    } else if (statusFilter === 'draft') {
      query = query.eq('published', false)
    }

    if (searchQuery) {
      query = query.ilike('title', `%${searchQuery}%`)
    }

    const { data, count } = await query

    if (data) {
      // 각 강의의 추가 정보 가져오기
      const enrichedCourses: Course[] = await Promise.all(
        data.map(async (course) => {
          // 강사 정보
          const { data: instructorData } = await supabase
            .from('profiles')
            .select('full_name, email')
            .eq('id', course.instructor)
            .single()

          // 수강생 수
          const { count: studentsCount } = await supabase
            .from('purchases')
            .select('id', { count: 'exact' })
            .eq('course_id', course.id)

          // 매출
          const { data: purchasesData } = await supabase
            .from('purchases')
            .select('amount')
            .eq('course_id', course.id)

          const revenue = purchasesData?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0

          return {
            ...course,
            instructor_id: course.instructor,
            instructor_name: instructorData?.full_name || null,
            instructor_email: instructorData?.email || null,
            students_count: studentsCount || 0,
            revenue,
          }
        })
      )

      setCourses(enrichedCourses)
      setTotalCount(count || 0)
    }

    setLoading(false)
  }, [currentPage, statusFilter, searchQuery])

  useEffect(() => {
    loadCourses()
  }, [loadCourses])

  // 발행/숨김 토글
  const handleTogglePublish = async (courseId: string, currentStatus: boolean) => {
    const action = currentStatus ? '숨김 처리' : '발행'
    if (!confirm(`이 강의를 ${action}하시겠습니까?`)) return

    setProcessingId(courseId)

    const { error } = await supabase
      .from('courses')
      .update({ published: !currentStatus })
      .eq('id', courseId)

    if (error) {
      alert(`${action}에 실패했습니다.`)
    } else {
      loadCourses()
    }

    setProcessingId(null)
  }

  // 강의 삭제
  const handleDelete = async (courseId: string, title: string) => {
    if (!confirm(`"${title}" 강의를 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`)) return

    setProcessingId(courseId)

    const { error } = await supabase
      .from('courses')
      .delete()
      .eq('id', courseId)

    if (error) {
      alert('삭제에 실패했습니다.')
    } else {
      loadCourses()
    }

    setProcessingId(null)
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const formatPrice = (price: number) => {
    if (price === 0) return '무료'
    return `${price.toLocaleString()}원`
  }

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  return (
    <div className="p-6 lg:p-8">
      {/* 헤더 */}
      <div className="mb-8">
        <h1 className="text-2xl lg:text-3xl font-bold text-white">강의 관리</h1>
        <p className="text-gray-400 mt-1">전체 강의를 관리합니다</p>
      </div>

      {/* 필터 및 검색 */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          {/* 검색 */}
          <div className="flex-1">
            <div className="relative">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="강의 제목으로 검색..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setCurrentPage(1)
                }}
                className="w-full pl-10 pr-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-red-500"
              />
            </div>
          </div>

          {/* 상태 필터 */}
          <div className="flex gap-2">
            {[
              { value: 'all', label: '전체' },
              { value: 'published', label: '발행됨' },
              { value: 'draft', label: '미발행' },
            ].map((filter) => (
              <button
                key={filter.value}
                onClick={() => {
                  setStatusFilter(filter.value as typeof statusFilter)
                  setCurrentPage(1)
                }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  statusFilter === filter.value
                    ? 'bg-red-500 text-white'
                    : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 강의 목록 */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        {loading ? (
          <div className="p-8 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-4 border-red-500 border-t-transparent"></div>
          </div>
        ) : courses.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-5xl mb-4">📚</div>
            <p className="text-gray-400">강의가 없습니다</p>
          </div>
        ) : (
          <>
            {/* 강의 리스트 */}
            <div className="divide-y divide-gray-700">
              {courses.map((course) => (
                <div key={course.id} className="p-4 hover:bg-gray-700/50 transition-colors">
                  <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                    {/* 썸네일 & 제목 */}
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="relative w-24 h-16 rounded-lg overflow-hidden bg-gray-700 flex-shrink-0">
                        {course.thumbnail ? (
                          <Image
                            src={course.thumbnail}
                            alt={course.title}
                            fill
                            className="object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-2xl">🚀</div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {course.published ? (
                            <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded">발행</span>
                          ) : (
                            <span className="px-2 py-0.5 bg-gray-500/20 text-gray-400 text-xs rounded">미발행</span>
                          )}
                          {course.category && (
                            <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs rounded">
                              {course.category}
                            </span>
                          )}
                        </div>
                        <h3 className="text-white font-medium truncate">{course.title}</h3>
                        <p className="text-gray-500 text-sm">
                          {course.instructor_name || course.instructor_email?.split('@')[0] || '알 수 없음'}
                        </p>
                      </div>
                    </div>

                    {/* 가격 */}
                    <div className="lg:w-24 text-left lg:text-right">
                      <p className={`font-medium ${course.price === 0 ? 'text-green-400' : 'text-white'}`}>
                        {formatPrice(course.price)}
                      </p>
                    </div>

                    {/* 수강생 */}
                    <div className="lg:w-20 text-left lg:text-center">
                      <p className="text-white">{course.students_count}</p>
                      <p className="text-gray-500 text-xs">수강생</p>
                    </div>

                    {/* 매출 */}
                    <div className="lg:w-28 text-left lg:text-right">
                      <p className="text-green-400 font-medium">
                        {course.revenue.toLocaleString()}원
                      </p>
                      <p className="text-gray-500 text-xs">총 매출</p>
                    </div>

                    {/* 등록일 */}
                    <div className="lg:w-24 text-left lg:text-center">
                      <p className="text-gray-400 text-sm">{formatDate(course.created_at)}</p>
                    </div>

                    {/* 액션 */}
                    <div className="flex gap-2 lg:w-32 justify-start lg:justify-end">
                      <Link
                        href={`/courses/${course.id}`}
                        target="_blank"
                        className="p-2 text-gray-400 hover:text-white hover:bg-gray-600 rounded-lg transition-colors"
                        title="강의 보기"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </Link>
                      <button
                        onClick={() => handleTogglePublish(course.id, course.published)}
                        disabled={processingId === course.id}
                        className={`p-2 rounded-lg transition-colors disabled:opacity-50 ${
                          course.published
                            ? 'text-yellow-400 hover:bg-yellow-500/20'
                            : 'text-green-400 hover:bg-green-500/20'
                        }`}
                        title={course.published ? '숨김 처리' : '발행'}
                      >
                        {course.published ? (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                      <button
                        onClick={() => handleDelete(course.id, course.title)}
                        disabled={processingId === course.id}
                        className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors disabled:opacity-50"
                        title="삭제"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* 페이지네이션 */}
            {totalPages > 1 && (
              <div className="p-4 border-t border-gray-700 flex items-center justify-between">
                <p className="text-gray-500 text-sm">
                  총 {totalCount}개 중 {(currentPage - 1) * PAGE_SIZE + 1}-{Math.min(currentPage * PAGE_SIZE, totalCount)}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 bg-gray-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-600"
                  >
                    이전
                  </button>
                  <span className="px-3 py-1.5 text-gray-400">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1.5 bg-gray-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-600"
                  >
                    다음
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

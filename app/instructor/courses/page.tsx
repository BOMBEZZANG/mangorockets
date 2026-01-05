'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import Image from 'next/image'

interface Course {
  id: string
  title: string
  thumbnail: string | null
  price: number
  category: string
  level: string
  created_at: string
  published: boolean
}

export default function InstructorCoursesPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [courses, setCourses] = useState<Course[]>([])
  const [filter, setFilter] = useState<'all' | 'free' | 'paid'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft'>('all')

  useEffect(() => {
    const loadCourses = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: coursesData } = await supabase
        .from('courses')
        .select('id, title, thumbnail, price, category, level, created_at, published')
        .eq('instructor', user.id)
        .order('created_at', { ascending: false })

      setCourses(coursesData || [])
      setIsLoading(false)
    }

    loadCourses()
  }, [])

  const filteredCourses = courses.filter(course => {
    // 가격 필터
    if (filter === 'free' && course.price !== 0) return false
    if (filter === 'paid' && course.price === 0) return false
    // 발행 상태 필터
    if (statusFilter === 'published' && !course.published) return false
    if (statusFilter === 'draft' && course.published) return false
    return true
  })

  const publishedCount = courses.filter(c => c.published).length
  const draftCount = courses.filter(c => !c.published).length

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-orange-500 border-t-transparent"></div>
      </div>
    )
  }

  return (
    <div className="p-6 lg:p-8">
      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">강의 관리</h1>
          <p className="text-gray-600 mt-1">총 {courses.length}개의 강의</p>
        </div>
        <Link
          href="/instructor/courses/new"
          className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-orange-500 to-yellow-500 px-6 py-3 text-white font-medium hover:shadow-lg transition-shadow"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          새 강의 만들기
        </Link>
      </div>

      {/* 필터 */}
      <div className="flex flex-wrap gap-4 mb-6">
        {/* 발행 상태 필터 */}
        <div className="flex gap-2">
          {[
            { value: 'all', label: '전체', count: courses.length },
            { value: 'published', label: '발행됨', count: publishedCount },
            { value: 'draft', label: '미발행', count: draftCount },
          ].map((item) => (
            <button
              key={item.value}
              onClick={() => setStatusFilter(item.value as typeof statusFilter)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                statusFilter === item.value
                  ? item.value === 'published' ? 'bg-green-500 text-white' : item.value === 'draft' ? 'bg-yellow-500 text-white' : 'bg-orange-500 text-white'
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-orange-300'
              }`}
            >
              {item.label} ({item.count})
            </button>
          ))}
        </div>

        <div className="h-8 w-px bg-gray-200 hidden sm:block"></div>

        {/* 가격 필터 */}
        <div className="flex gap-2">
          {[
            { value: 'all', label: '전체 가격' },
            { value: 'paid', label: '유료' },
            { value: 'free', label: '무료' },
          ].map((item) => (
            <button
              key={item.value}
              onClick={() => setFilter(item.value as typeof filter)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                filter === item.value
                  ? 'bg-orange-500 text-white'
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-orange-300'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* 강의 목록 */}
      {courses.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
          <div className="text-6xl mb-4">📚</div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">
            아직 등록한 강의가 없습니다
          </h3>
          <p className="text-gray-500 mb-8">
            첫 번째 강의를 만들어 수익을 창출해보세요!
          </p>
          <Link
            href="/instructor/courses/new"
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-orange-500 to-yellow-500 px-8 py-4 text-white font-medium hover:shadow-lg transition-shadow"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            첫 강의 만들기
          </Link>
        </div>
      ) : filteredCourses.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
          <p className="text-gray-500">해당하는 강의가 없습니다.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredCourses.map((course) => (
            <div
              key={course.id}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-lg hover:border-orange-200 transition-all group"
            >
              {/* 썸네일 */}
              <div className="relative aspect-video bg-gray-100">
                {course.thumbnail ? (
                  <Image
                    src={course.thumbnail}
                    alt={course.title}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full bg-gradient-to-br from-orange-100 to-yellow-100">
                    <span className="text-5xl">🚀</span>
                  </div>
                )}
                {/* 가격 배지 */}
                <div className="absolute top-3 right-3">
                  <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                    course.price === 0
                      ? 'bg-green-500 text-white'
                      : 'bg-white text-orange-600 shadow-md'
                  }`}>
                    {course.price === 0 ? '무료' : `${course.price.toLocaleString()}원`}
                  </span>
                </div>
              </div>

              {/* 콘텐츠 */}
              <div className="p-5">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  {/* 발행 상태 배지 */}
                  {course.published ? (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-md text-xs font-medium">
                      <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                      발행됨
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-700 rounded-md text-xs font-medium">
                      <span className="w-1.5 h-1.5 bg-yellow-500 rounded-full"></span>
                      미발행
                    </span>
                  )}
                  <span className="px-2 py-1 bg-orange-100 text-orange-600 rounded-md text-xs font-medium">
                    {course.category}
                  </span>
                  <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-md text-xs font-medium">
                    {course.level}
                  </span>
                </div>
                <h3 className="font-bold text-gray-900 mb-2 line-clamp-2 group-hover:text-orange-600 transition-colors">
                  {course.title}
                </h3>
                <p className="text-sm text-gray-500 mb-4">
                  {new Date(course.created_at).toLocaleDateString('ko-KR')} 등록
                </p>

                {/* 액션 버튼 */}
                <div className="flex gap-2">
                  <Link
                    href={`/instructor/courses/${course.id}`}
                    className="flex-1 text-center py-2 px-4 bg-orange-50 text-orange-600 rounded-xl font-medium text-sm hover:bg-orange-100 transition-colors"
                  >
                    편집하기
                  </Link>
                  <Link
                    href={`/courses/${course.id}`}
                    target="_blank"
                    className="flex-1 text-center py-2 px-4 border border-gray-200 text-gray-600 rounded-xl font-medium text-sm hover:bg-gray-50 transition-colors"
                  >
                    미리보기
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

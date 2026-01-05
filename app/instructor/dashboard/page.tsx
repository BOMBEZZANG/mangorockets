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
  created_at: string
}

interface Stats {
  totalCourses: number
  totalStudents: number
  totalRevenue: number
}

export default function InstructorDashboardPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [courses, setCourses] = useState<Course[]>([])
  const [userName, setUserName] = useState('')
  const [stats, setStats] = useState<Stats>({ totalCourses: 0, totalStudents: 0, totalRevenue: 0 })

  useEffect(() => {
    const loadData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // 프로필 정보
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single()

      setUserName(profile?.full_name || user.email?.split('@')[0] || '')

      // 강사의 모든 강의 ID 가져오기
      const { data: allCourses } = await supabase
        .from('courses')
        .select('id, price')
        .eq('instructor', user.id)

      const courseIds = allCourses?.map(c => c.id) || []
      const totalCourses = courseIds.length

      // 구매 데이터 가져오기 (수강생 수 & 수익)
      let totalStudents = 0
      let totalRevenue = 0

      if (courseIds.length > 0) {
        // 해당 강사의 강의를 구매한 모든 구매 기록
        const { data: purchases } = await supabase
          .from('purchases')
          .select('user_id, course_id, amount')
          .in('course_id', courseIds)

        if (purchases) {
          // 고유 수강생 수 (중복 제거)
          const uniqueStudents = new Set(purchases.map(p => p.user_id))
          totalStudents = uniqueStudents.size

          // 총 수익 (실제 결제 금액 합계)
          totalRevenue = purchases.reduce((sum, p) => sum + (p.amount || 0), 0)
        }
      }

      setStats({ totalCourses, totalStudents, totalRevenue })

      // 최근 강의 5개만 표시용으로 가져오기
      const { data: recentCourses } = await supabase
        .from('courses')
        .select('id, title, thumbnail, price, created_at')
        .eq('instructor', user.id)
        .order('created_at', { ascending: false })
        .limit(5)

      setCourses(recentCourses || [])
      setIsLoading(false)
    }

    loadData()
  }, [])

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
      <div className="mb-8">
        <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-2">
          안녕하세요, {userName}님!
        </h1>
        <p className="text-gray-600">오늘도 좋은 하루 되세요.</p>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
              <span className="text-2xl">📚</span>
            </div>
            <div>
              <p className="text-sm text-gray-500">총 강의 수</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalCourses}개</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
              <span className="text-2xl">👥</span>
            </div>
            <div>
              <p className="text-sm text-gray-500">총 수강생</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalStudents}명</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <span className="text-2xl">💰</span>
            </div>
            <div>
              <p className="text-sm text-gray-500">총 수익</p>
              <p className="text-2xl font-bold text-gray-900">
                {stats.totalRevenue.toLocaleString()}원
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 최근 강의 */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-gray-900">최근 강의</h2>
          <Link
            href="/instructor/courses"
            className="text-sm text-orange-500 hover:text-orange-600 font-medium"
          >
            전체 보기 →
          </Link>
        </div>

        {courses.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-5xl mb-4">📝</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              아직 등록한 강의가 없습니다
            </h3>
            <p className="text-gray-500 mb-6">
              첫 번째 강의를 만들어 수익을 창출해보세요!
            </p>
            <Link
              href="/instructor/courses/new"
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-orange-500 to-yellow-500 px-6 py-3 text-white font-medium hover:shadow-lg transition-shadow"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              강의 만들기
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {courses.map((course) => (
              <div
                key={course.id}
                className="flex items-center gap-4 p-4 border border-gray-100 rounded-xl hover:border-orange-200 hover:bg-orange-50/50 transition-colors"
              >
                <div className="relative w-20 h-14 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                  {course.thumbnail ? (
                    <Image
                      src={course.thumbnail}
                      alt={course.title}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <span className="text-xl">🚀</span>
                    </div>
                  )}
                </div>
                <div className="flex-grow min-w-0">
                  <h3 className="font-medium text-gray-900 truncate">{course.title}</h3>
                  <p className="text-sm text-gray-500">
                    {course.price === 0 ? '무료' : `${course.price.toLocaleString()}원`}
                  </p>
                </div>
                <Link
                  href={`/instructor/courses/${course.id}`}
                  className="flex-shrink-0 text-sm text-orange-500 hover:text-orange-600 font-medium"
                >
                  관리
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 빠른 액션 */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link
          href="/instructor/courses/new"
          className="flex items-center gap-4 p-6 bg-gradient-to-r from-orange-500 to-yellow-500 rounded-2xl text-white hover:shadow-lg transition-shadow"
        >
          <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <div>
            <p className="font-bold text-lg">새 강의 만들기</p>
            <p className="text-white/80 text-sm">지금 바로 새로운 강의를 등록하세요</p>
          </div>
        </Link>

        <Link
          href="/instructor/courses"
          className="flex items-center gap-4 p-6 bg-white rounded-2xl border border-gray-100 hover:border-orange-200 hover:shadow-lg transition-all"
        >
          <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <div>
            <p className="font-bold text-lg text-gray-900">강의 관리</p>
            <p className="text-gray-500 text-sm">등록된 강의를 수정하고 관리하세요</p>
          </div>
        </Link>
      </div>
    </div>
  )
}

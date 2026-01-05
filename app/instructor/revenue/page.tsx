'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Image from 'next/image'

interface Course {
  id: string
  title: string
  thumbnail: string | null
  price: number
  created_at: string
}

interface Purchase {
  id: string
  course_id: string
  user_id: string
  amount: number
  created_at: string
  user?: {
    email: string
    full_name: string | null
    avatar_url: string | null
  }
}

interface CourseWithStats extends Course {
  salesCount: number
  totalSales: number
  instructorRevenue: number
}

interface RevenueStats {
  totalRevenue: number
  pendingPayout: number
  paidOut: number
  studentCount: number
}

// 수익 분배율 (강사 70%, 플랫폼 30%)
const INSTRUCTOR_SHARE = 0.7

export default function RevenuePage() {
  const [isLoading, setIsLoading] = useState(true)
  const [coursesWithStats, setCoursesWithStats] = useState<CourseWithStats[]>([])
  const [recentPurchases, setRecentPurchases] = useState<(Purchase & { course: Course })[]>([])
  const [stats, setStats] = useState<RevenueStats>({
    totalRevenue: 0,
    pendingPayout: 0,
    paidOut: 0,
    studentCount: 0,
  })
  const [selectedPeriod, setSelectedPeriod] = useState<'all' | 'month' | 'week'>('all')
  const [monthlyRevenue, setMonthlyRevenue] = useState<{ month: string; revenue: number }[]>([])

  useEffect(() => {
    const loadData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // 1. 강사의 강의 목록 가져오기
      const { data: coursesData } = await supabase
        .from('courses')
        .select('id, title, thumbnail, price, created_at')
        .eq('instructor', user.id)
        .order('created_at', { ascending: false })

      const coursesList = coursesData || []
      const courseIds = coursesList.map(c => c.id)

      if (courseIds.length === 0) {
        setCoursesWithStats([])
        setIsLoading(false)
        return
      }

      // 2. 해당 강의들의 구매 내역 가져오기
      const { data: purchasesData } = await supabase
        .from('purchases')
        .select('id, course_id, user_id, amount, created_at')
        .in('course_id', courseIds)
        .order('created_at', { ascending: false })

      const purchases = purchasesData || []

      // 3. 강의별 통계 계산
      const coursesWithStatsData: CourseWithStats[] = coursesList.map(course => {
        const coursePurchases = purchases.filter(p => p.course_id === course.id)
        const salesCount = coursePurchases.length
        const totalSales = coursePurchases.reduce((sum, p) => sum + (p.amount || course.price), 0)
        const instructorRevenue = Math.floor(totalSales * INSTRUCTOR_SHARE)

        return {
          ...course,
          salesCount,
          totalSales,
          instructorRevenue,
        }
      })

      setCoursesWithStats(coursesWithStatsData)

      // 4. 전체 통계 계산
      const totalRevenue = coursesWithStatsData.reduce((sum, c) => sum + c.instructorRevenue, 0)
      const uniqueStudents = new Set(purchases.map(p => p.user_id)).size

      // 정산 대기/완료는 실제 정산 시스템이 있어야 하지만, 일단 전체가 대기 상태로 표시
      setStats({
        totalRevenue,
        pendingPayout: totalRevenue, // 실제로는 정산 테이블에서 계산
        paidOut: 0, // 실제로는 정산 테이블에서 계산
        studentCount: uniqueStudents,
      })

      // 5. 최근 구매 내역 (수강생 정보 포함)
      const recentPurchasesWithDetails: (Purchase & { course: Course })[] = []

      for (const purchase of purchases.slice(0, 10)) {
        // 사용자 정보 가져오기
        const { data: userData } = await supabase
          .from('profiles')
          .select('email, full_name, avatar_url')
          .eq('id', purchase.user_id)
          .single()

        const course = coursesList.find(c => c.id === purchase.course_id)
        if (course) {
          recentPurchasesWithDetails.push({
            ...purchase,
            user: userData || undefined,
            course,
          })
        }
      }

      setRecentPurchases(recentPurchasesWithDetails)

      // 6. 월별 수익 계산 (최근 6개월)
      const now = new Date()
      const monthlyData: { month: string; revenue: number }[] = []

      for (let i = 5; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const monthStart = new Date(date.getFullYear(), date.getMonth(), 1)
        const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59)

        const monthPurchases = purchases.filter(p => {
          const purchaseDate = new Date(p.created_at)
          return purchaseDate >= monthStart && purchaseDate <= monthEnd
        })

        const monthRevenue = monthPurchases.reduce((sum, p) => {
          const course = coursesList.find(c => c.id === p.course_id)
          return sum + Math.floor((p.amount || course?.price || 0) * INSTRUCTOR_SHARE)
        }, 0)

        monthlyData.push({
          month: `${date.getMonth() + 1}월`,
          revenue: monthRevenue,
        })
      }

      setMonthlyRevenue(monthlyData)
      setIsLoading(false)
    }

    loadData()
  }, [])

  // 날짜 포맷
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const maxRevenue = Math.max(...monthlyRevenue.map(d => d.revenue), 1)

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
        <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">수익관리</h1>
        <p className="text-gray-600 mt-1">강의 판매 수익과 정산 현황을 확인하세요</p>
      </div>

      {/* 수익 요약 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-gradient-to-br from-orange-500 to-yellow-600 rounded-2xl p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="text-white/70 text-sm">총 수익</span>
          </div>
          <p className="text-3xl font-bold">{stats.totalRevenue.toLocaleString()}원</p>
          <p className="text-white/70 text-sm mt-1">강사 수익 (70%)</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="text-gray-500 text-sm">정산 대기</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.pendingPayout.toLocaleString()}원</p>
          <p className="text-gray-500 text-sm mt-1">다음 정산 예정</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="text-gray-500 text-sm">정산 완료</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.paidOut.toLocaleString()}원</p>
          <p className="text-gray-500 text-sm mt-1">누적 정산 금액</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <span className="text-gray-500 text-sm">수강생</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.studentCount}명</p>
          <p className="text-gray-500 text-sm mt-1">총 수강생 수</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 월별 수익 차트 */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-gray-900">월별 수익</h2>
            <div className="flex gap-2">
              {[
                { value: 'week', label: '주간' },
                { value: 'month', label: '월간' },
                { value: 'all', label: '전체' },
              ].map((item) => (
                <button
                  key={item.value}
                  onClick={() => setSelectedPeriod(item.value as typeof selectedPeriod)}
                  className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                    selectedPeriod === item.value
                      ? 'bg-orange-500 text-white'
                      : 'text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* 간단한 바 차트 */}
          <div className="flex items-end justify-between h-48 gap-4">
            {monthlyRevenue.map((data, index) => (
              <div key={data.month} className="flex-1 flex flex-col items-center">
                <div className="w-full flex flex-col items-center justify-end h-40">
                  <div
                    className={`w-full max-w-[40px] rounded-t-lg transition-all duration-300 ${
                      data.revenue > 0
                        ? 'bg-gradient-to-t from-orange-500 to-yellow-500'
                        : 'bg-gray-200'
                    }`}
                    style={{
                      height: `${Math.max((data.revenue / maxRevenue) * 100, 4)}%`,
                    }}
                  />
                </div>
                <span className="text-xs text-gray-500 mt-2">{data.month}</span>
                {data.revenue > 0 && (
                  <span className="text-xs text-orange-600 font-medium">
                    {(data.revenue / 10000).toFixed(0)}만
                  </span>
                )}
              </div>
            ))}
          </div>

          {stats.totalRevenue === 0 && (
            <div className="text-center py-8">
              <p className="text-gray-500">아직 수익 데이터가 없습니다</p>
              <p className="text-sm text-gray-400 mt-1">강의가 판매되면 이곳에 표시됩니다</p>
            </div>
          )}
        </div>

        {/* 정산 안내 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">정산 안내</h2>

          <div className="space-y-4">
            <div className="p-4 bg-orange-50 rounded-xl">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                  70%
                </div>
                <span className="font-medium text-gray-900">강사 수익</span>
              </div>
              <p className="text-sm text-gray-600">
                판매 금액의 70%가 강사님의 수익입니다
              </p>
            </div>

            <div className="p-4 bg-gray-50 rounded-xl">
              <h3 className="font-medium text-gray-900 mb-2">정산 주기</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>- 매월 1일 ~ 말일 판매분</li>
                <li>- 익월 15일 정산</li>
                <li>- 최소 정산 금액: 10,000원</li>
              </ul>
            </div>

            <div className="p-4 bg-gray-50 rounded-xl">
              <h3 className="font-medium text-gray-900 mb-2">정산 계좌</h3>
              <p className="text-sm text-gray-500 mb-3">등록된 계좌가 없습니다</p>
              <button className="w-full py-2 text-sm font-medium text-orange-500 border border-orange-200 rounded-lg hover:bg-orange-50 transition-colors">
                계좌 등록하기
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 강의별 수익 */}
      <div className="mt-6 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">강의별 수익</h2>

        {coursesWithStats.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-5xl mb-4">📚</div>
            <p className="text-gray-500">등록된 강의가 없습니다</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">강의명</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">가격</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">판매 수</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">총 매출</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">내 수익</th>
                </tr>
              </thead>
              <tbody>
                {coursesWithStats.map((course) => (
                  <tr key={course.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <div className="relative w-12 h-8 rounded overflow-hidden bg-gray-100 flex-shrink-0">
                          {course.thumbnail ? (
                            <Image
                              src={course.thumbnail}
                              alt={course.title}
                              fill
                              className="object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-xs">🚀</div>
                          )}
                        </div>
                        <span className="font-medium text-gray-900">{course.title}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-right text-gray-600">
                      {course.price === 0 ? '무료' : `${course.price.toLocaleString()}원`}
                    </td>
                    <td className="py-4 px-4 text-right">
                      <span className={`font-medium ${course.salesCount > 0 ? 'text-blue-600' : 'text-gray-400'}`}>
                        {course.salesCount}건
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right text-gray-600">
                      {course.totalSales.toLocaleString()}원
                    </td>
                    <td className="py-4 px-4 text-right font-medium text-orange-600">
                      {course.instructorRevenue.toLocaleString()}원
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50">
                  <td className="py-4 px-4 font-medium text-gray-900">합계</td>
                  <td className="py-4 px-4"></td>
                  <td className="py-4 px-4 text-right font-medium text-blue-600">
                    {coursesWithStats.reduce((sum, c) => sum + c.salesCount, 0)}건
                  </td>
                  <td className="py-4 px-4 text-right font-medium text-gray-900">
                    {coursesWithStats.reduce((sum, c) => sum + c.totalSales, 0).toLocaleString()}원
                  </td>
                  <td className="py-4 px-4 text-right font-bold text-orange-600">
                    {stats.totalRevenue.toLocaleString()}원
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* 최근 수강생 */}
      <div className="mt-6 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">최근 수강생</h2>
        </div>

        {recentPurchases.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <p className="text-gray-500">아직 수강생이 없습니다</p>
            <p className="text-sm text-gray-400 mt-1">강의가 판매되면 이곳에 표시됩니다</p>
          </div>
        ) : (
          <div className="space-y-3">
            {recentPurchases.map((purchase) => (
              <div
                key={purchase.id}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-xl"
              >
                <div className="flex items-center gap-3">
                  {/* 사용자 아바타 */}
                  <div className="relative w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-orange-400 to-yellow-400 flex-shrink-0">
                    {purchase.user?.avatar_url ? (
                      <Image
                        src={purchase.user.avatar_url}
                        alt={purchase.user.full_name || '사용자'}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white font-medium">
                        {(purchase.user?.full_name || purchase.user?.email || '?').charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {purchase.user?.full_name || purchase.user?.email?.split('@')[0] || '익명'}
                    </p>
                    <p className="text-sm text-gray-500">{purchase.course.title}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium text-orange-600">
                    +{Math.floor((purchase.amount || purchase.course.price) * INSTRUCTOR_SHARE).toLocaleString()}원
                  </p>
                  <p className="text-xs text-gray-400">{formatDate(purchase.created_at)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

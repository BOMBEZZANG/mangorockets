'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import Image from 'next/image'

interface Purchase {
  id: string
  user_id: string
  course_id: string
  amount: number
  created_at: string
  course: {
    title: string
    thumbnail: string | null
    instructor: string
  } | null
  instructor_name: string | null
  buyer_name: string | null
}

interface InstructorRevenue {
  instructor_id: string
  instructor_name: string | null
  instructor_email: string | null
  avatar_url: string | null
  total_sales: number
  platform_commission: number
  instructor_payout: number
  courses_count: number
  sales_count: number
}

interface Stats {
  totalSales: number
  platformRevenue: number
  instructorPayouts: number
  todaySales: number
  todayPlatformRevenue: number
  monthSales: number
  monthPlatformRevenue: number
  totalTransactions: number
}

const COMMISSION_RATE = 0.3 // 30% 수수료

export default function AdminRevenuePage() {
  const [stats, setStats] = useState<Stats>({
    totalSales: 0,
    platformRevenue: 0,
    instructorPayouts: 0,
    todaySales: 0,
    todayPlatformRevenue: 0,
    monthSales: 0,
    monthPlatformRevenue: 0,
    totalTransactions: 0,
  })
  const [instructorRevenues, setInstructorRevenues] = useState<InstructorRevenue[]>([])
  const [recentPurchases, setRecentPurchases] = useState<Purchase[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'instructors' | 'transactions'>('overview')

  const loadData = useCallback(async () => {
    setLoading(true)

    // 모든 결제 데이터 가져오기
    const { data: purchases } = await supabase
      .from('purchases')
      .select('id, user_id, course_id, amount, created_at')
      .order('created_at', { ascending: false })

    if (purchases) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)

      // 통계 계산
      const totalSales = purchases.reduce((sum, p) => sum + (p.amount || 0), 0)
      const todayPurchases = purchases.filter(p => new Date(p.created_at) >= today)
      const todaySales = todayPurchases.reduce((sum, p) => sum + (p.amount || 0), 0)
      const monthPurchases = purchases.filter(p => new Date(p.created_at) >= monthStart)
      const monthSales = monthPurchases.reduce((sum, p) => sum + (p.amount || 0), 0)

      setStats({
        totalSales,
        platformRevenue: Math.round(totalSales * COMMISSION_RATE),
        instructorPayouts: Math.round(totalSales * (1 - COMMISSION_RATE)),
        todaySales,
        todayPlatformRevenue: Math.round(todaySales * COMMISSION_RATE),
        monthSales,
        monthPlatformRevenue: Math.round(monthSales * COMMISSION_RATE),
        totalTransactions: purchases.length,
      })

      // 강사별 매출 계산
      const instructorMap = new Map<string, {
        sales: number
        courses: Set<string>
        count: number
      }>()

      // 각 구매의 강의 정보 가져오기
      for (const purchase of purchases) {
        const { data: courseData } = await supabase
          .from('courses')
          .select('instructor')
          .eq('id', purchase.course_id)
          .single()

        if (courseData?.instructor) {
          const existing = instructorMap.get(courseData.instructor) || {
            sales: 0,
            courses: new Set<string>(),
            count: 0,
          }
          existing.sales += purchase.amount || 0
          existing.courses.add(purchase.course_id)
          existing.count += 1
          instructorMap.set(courseData.instructor, existing)
        }
      }

      // 강사 정보 가져오기
      const instructorRevenues: InstructorRevenue[] = []
      for (const [instructorId, data] of instructorMap) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('full_name, email, avatar_url')
          .eq('id', instructorId)
          .single()

        instructorRevenues.push({
          instructor_id: instructorId,
          instructor_name: profileData?.full_name || null,
          instructor_email: profileData?.email || null,
          avatar_url: profileData?.avatar_url || null,
          total_sales: data.sales,
          platform_commission: Math.round(data.sales * COMMISSION_RATE),
          instructor_payout: Math.round(data.sales * (1 - COMMISSION_RATE)),
          courses_count: data.courses.size,
          sales_count: data.count,
        })
      }

      // 매출 순으로 정렬
      instructorRevenues.sort((a, b) => b.total_sales - a.total_sales)
      setInstructorRevenues(instructorRevenues)

      // 최근 거래 내역 (상위 20개)
      const recentPurchasesData: Purchase[] = await Promise.all(
        purchases.slice(0, 20).map(async (purchase) => {
          const { data: courseData } = await supabase
            .from('courses')
            .select('title, thumbnail, instructor')
            .eq('id', purchase.course_id)
            .single()

          let instructorName = null
          if (courseData?.instructor) {
            const { data: instructorData } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('id', courseData.instructor)
              .single()
            instructorName = instructorData?.full_name
          }

          const { data: buyerData } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', purchase.user_id)
            .single()

          return {
            ...purchase,
            course: courseData,
            instructor_name: instructorName,
            buyer_name: buyerData?.full_name || null,
          }
        })
      )

      setRecentPurchases(recentPurchasesData)
    }

    setLoading(false)
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString() + '원'
  }

  if (loading) {
    return (
      <div className="p-6 lg:p-8">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-red-500 border-t-transparent"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 lg:p-8">
      {/* 헤더 */}
      <div className="mb-8">
        <h1 className="text-2xl lg:text-3xl font-bold text-white">매출 관리</h1>
        <p className="text-gray-400 mt-1">플랫폼 수수료 및 정산 현황을 관리합니다 (수수료율: 30%)</p>
      </div>

      {/* 주요 통계 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-gradient-to-br from-green-600 to-green-700 rounded-xl p-5">
          <p className="text-green-100 text-sm mb-1">총 매출</p>
          <p className="text-2xl font-bold text-white">{formatCurrency(stats.totalSales)}</p>
          <p className="text-green-200 text-xs mt-1">{stats.totalTransactions}건</p>
        </div>
        <div className="bg-gradient-to-br from-red-600 to-red-700 rounded-xl p-5">
          <p className="text-red-100 text-sm mb-1">플랫폼 수익 (30%)</p>
          <p className="text-2xl font-bold text-white">{formatCurrency(stats.platformRevenue)}</p>
        </div>
        <div className="bg-gradient-to-br from-yellow-600 to-purple-700 rounded-xl p-5">
          <p className="text-yellow-100 text-sm mb-1">강사 정산금 (70%)</p>
          <p className="text-2xl font-bold text-white">{formatCurrency(stats.instructorPayouts)}</p>
        </div>
        <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-5">
          <p className="text-blue-100 text-sm mb-1">이번 달 매출</p>
          <p className="text-2xl font-bold text-white">{formatCurrency(stats.monthSales)}</p>
          <p className="text-blue-200 text-xs mt-1">수익 {formatCurrency(stats.monthPlatformRevenue)}</p>
        </div>
      </div>

      {/* 오늘 통계 */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-5 mb-8">
        <h3 className="text-lg font-semibold text-white mb-4">오늘의 매출</h3>
        <div className="grid grid-cols-3 gap-6">
          <div>
            <p className="text-gray-400 text-sm">매출</p>
            <p className="text-xl font-bold text-white">{formatCurrency(stats.todaySales)}</p>
          </div>
          <div>
            <p className="text-gray-400 text-sm">플랫폼 수익</p>
            <p className="text-xl font-bold text-green-400">{formatCurrency(stats.todayPlatformRevenue)}</p>
          </div>
          <div>
            <p className="text-gray-400 text-sm">강사 정산</p>
            <p className="text-xl font-bold text-yellow-400">{formatCurrency(Math.round(stats.todaySales * 0.7))}</p>
          </div>
        </div>
      </div>

      {/* 탭 네비게이션 */}
      <div className="flex gap-2 mb-6">
        {[
          { id: 'overview', label: '강사별 매출' },
          { id: 'transactions', label: '거래 내역' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-red-500 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 강사별 매출 */}
      {activeTab === 'overview' && (
        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
          {instructorRevenues.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-5xl mb-4">📊</div>
              <p className="text-gray-400">매출 데이터가 없습니다</p>
            </div>
          ) : (
            <>
              {/* 테이블 헤더 */}
              <div className="hidden lg:grid grid-cols-12 gap-4 p-4 border-b border-gray-700 text-sm font-medium text-gray-500">
                <div className="col-span-3">강사</div>
                <div className="col-span-2 text-right">총 매출</div>
                <div className="col-span-2 text-right">플랫폼 수익 (30%)</div>
                <div className="col-span-2 text-right">강사 정산 (70%)</div>
                <div className="col-span-1 text-center">강의 수</div>
                <div className="col-span-2 text-center">판매 건수</div>
              </div>

              {/* 강사 리스트 */}
              <div className="divide-y divide-gray-700">
                {instructorRevenues.map((instructor) => (
                  <div key={instructor.instructor_id} className="p-4 hover:bg-gray-700/50 transition-colors">
                    <div className="lg:grid lg:grid-cols-12 lg:gap-4 lg:items-center">
                      {/* 강사 정보 */}
                      <div className="col-span-3 flex items-center gap-3 mb-3 lg:mb-0">
                        <div className="relative w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-yellow-500 to-orange-500 flex-shrink-0">
                          {instructor.avatar_url ? (
                            <Image
                              src={instructor.avatar_url}
                              alt={instructor.instructor_name || '강사'}
                              fill
                              className="object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-white font-medium">
                              {(instructor.instructor_name || instructor.instructor_email || '?').charAt(0).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-white font-medium truncate">
                            {instructor.instructor_name || '이름 없음'}
                          </p>
                          <p className="text-gray-500 text-sm truncate">{instructor.instructor_email}</p>
                        </div>
                      </div>

                      {/* 총 매출 */}
                      <div className="col-span-2 text-left lg:text-right mb-2 lg:mb-0">
                        <p className="text-white font-medium">{formatCurrency(instructor.total_sales)}</p>
                      </div>

                      {/* 플랫폼 수익 */}
                      <div className="col-span-2 text-left lg:text-right mb-2 lg:mb-0">
                        <p className="text-green-400 font-medium">{formatCurrency(instructor.platform_commission)}</p>
                      </div>

                      {/* 강사 정산 */}
                      <div className="col-span-2 text-left lg:text-right mb-2 lg:mb-0">
                        <p className="text-yellow-400 font-medium">{formatCurrency(instructor.instructor_payout)}</p>
                      </div>

                      {/* 강의 수 */}
                      <div className="col-span-1 text-left lg:text-center mb-2 lg:mb-0">
                        <span className="text-gray-400">{instructor.courses_count}개</span>
                      </div>

                      {/* 판매 건수 */}
                      <div className="col-span-2 text-left lg:text-center">
                        <span className="text-gray-400">{instructor.sales_count}건</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* 합계 */}
              <div className="p-4 border-t border-gray-600 bg-gray-700/50">
                <div className="lg:grid lg:grid-cols-12 lg:gap-4 lg:items-center">
                  <div className="col-span-3 font-semibold text-white">합계</div>
                  <div className="col-span-2 text-right font-semibold text-white">
                    {formatCurrency(stats.totalSales)}
                  </div>
                  <div className="col-span-2 text-right font-semibold text-green-400">
                    {formatCurrency(stats.platformRevenue)}
                  </div>
                  <div className="col-span-2 text-right font-semibold text-yellow-400">
                    {formatCurrency(stats.instructorPayouts)}
                  </div>
                  <div className="col-span-1"></div>
                  <div className="col-span-2 text-center font-semibold text-white">
                    {stats.totalTransactions}건
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* 거래 내역 */}
      {activeTab === 'transactions' && (
        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
          {recentPurchases.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-5xl mb-4">💳</div>
              <p className="text-gray-400">거래 내역이 없습니다</p>
            </div>
          ) : (
            <>
              {/* 테이블 헤더 */}
              <div className="hidden lg:grid grid-cols-12 gap-4 p-4 border-b border-gray-700 text-sm font-medium text-gray-500">
                <div className="col-span-3">강의</div>
                <div className="col-span-2">구매자</div>
                <div className="col-span-1 text-right">결제금액</div>
                <div className="col-span-2 text-right">플랫폼 (30%)</div>
                <div className="col-span-2 text-right">강사 (70%)</div>
                <div className="col-span-2">결제일</div>
              </div>

              {/* 거래 리스트 */}
              <div className="divide-y divide-gray-700">
                {recentPurchases.map((purchase) => (
                  <div key={purchase.id} className="p-4 hover:bg-gray-700/50 transition-colors">
                    <div className="lg:grid lg:grid-cols-12 lg:gap-4 lg:items-center">
                      {/* 강의 */}
                      <div className="col-span-3 flex items-center gap-3 mb-3 lg:mb-0">
                        <div className="relative w-16 h-10 rounded overflow-hidden bg-gray-700 flex-shrink-0">
                          {purchase.course?.thumbnail ? (
                            <Image
                              src={purchase.course.thumbnail}
                              alt={purchase.course.title || '강의'}
                              fill
                              className="object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-sm">🚀</div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-white text-sm truncate">{purchase.course?.title || '알 수 없음'}</p>
                          <p className="text-gray-500 text-xs">{purchase.instructor_name || '강사'}</p>
                        </div>
                      </div>

                      {/* 구매자 */}
                      <div className="col-span-2 mb-2 lg:mb-0">
                        <p className="text-gray-300 text-sm">{purchase.buyer_name || '알 수 없음'}</p>
                      </div>

                      {/* 결제금액 */}
                      <div className="col-span-1 text-left lg:text-right mb-2 lg:mb-0">
                        <p className="text-white font-medium">{formatCurrency(purchase.amount)}</p>
                      </div>

                      {/* 플랫폼 수익 */}
                      <div className="col-span-2 text-left lg:text-right mb-2 lg:mb-0">
                        <p className="text-green-400">{formatCurrency(Math.round(purchase.amount * COMMISSION_RATE))}</p>
                      </div>

                      {/* 강사 정산 */}
                      <div className="col-span-2 text-left lg:text-right mb-2 lg:mb-0">
                        <p className="text-yellow-400">{formatCurrency(Math.round(purchase.amount * (1 - COMMISSION_RATE)))}</p>
                      </div>

                      {/* 결제일 */}
                      <div className="col-span-2">
                        <p className="text-gray-400 text-sm">{formatDate(purchase.created_at)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

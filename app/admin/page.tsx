'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

interface Stats {
  totalUsers: number
  totalInstructors: number
  totalCourses: number
  publishedCourses: number
  totalRevenue: number
  platformRevenue: number
  todayRevenue: number
  todayPlatformRevenue: number
  monthRevenue: number
  monthPlatformRevenue: number
  totalPurchases: number
}

const COMMISSION_RATE = 0.3 // 30% 수수료

interface RecentPurchase {
  id: string
  amount: number
  created_at: string
  user: { email: string; full_name: string | null }
  course: { title: string }
}

export default function AdminDashboardPage() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    totalInstructors: 0,
    totalCourses: 0,
    publishedCourses: 0,
    totalRevenue: 0,
    platformRevenue: 0,
    todayRevenue: 0,
    todayPlatformRevenue: 0,
    monthRevenue: 0,
    monthPlatformRevenue: 0,
    totalPurchases: 0,
  })
  const [recentPurchases, setRecentPurchases] = useState<RecentPurchase[]>([])

  useEffect(() => {
    const loadData = async () => {
      // 1. 전체 회원 수
      const { count: totalUsers } = await supabase
        .from('profiles')
        .select('id', { count: 'exact' })

      // 2. 강사 수
      const { count: totalInstructors } = await supabase
        .from('profiles')
        .select('id', { count: 'exact' })
        .eq('role', 'instructor')

      // 3. 전체 강의 수
      const { count: totalCourses } = await supabase
        .from('courses')
        .select('id', { count: 'exact' })

      // 4. 발행된 강의 수
      const { count: publishedCourses } = await supabase
        .from('courses')
        .select('id', { count: 'exact' })
        .eq('published', true)

      // 5. 전체 매출
      const { data: purchasesData } = await supabase
        .from('purchases')
        .select('amount, created_at')

      const totalRevenue = purchasesData?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0
      const platformRevenue = Math.round(totalRevenue * COMMISSION_RATE)
      const totalPurchases = purchasesData?.length || 0

      // 6. 오늘 매출
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const todayPurchases = purchasesData?.filter(p => new Date(p.created_at) >= today) || []
      const todayRevenue = todayPurchases.reduce((sum, p) => sum + (p.amount || 0), 0)
      const todayPlatformRevenue = Math.round(todayRevenue * COMMISSION_RATE)

      // 7. 이번 달 매출
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
      const monthPurchases = purchasesData?.filter(p => new Date(p.created_at) >= monthStart) || []
      const monthRevenue = monthPurchases.reduce((sum, p) => sum + (p.amount || 0), 0)
      const monthPlatformRevenue = Math.round(monthRevenue * COMMISSION_RATE)

      setStats({
        totalUsers: totalUsers || 0,
        totalInstructors: totalInstructors || 0,
        totalCourses: totalCourses || 0,
        publishedCourses: publishedCourses || 0,
        totalRevenue,
        platformRevenue,
        todayRevenue,
        todayPlatformRevenue,
        monthRevenue,
        monthPlatformRevenue,
        totalPurchases,
      })

      // 8. 최근 결제
      const { data: recentPurchasesData } = await supabase
        .from('purchases')
        .select(`
          id,
          amount,
          created_at,
          user_id,
          course_id
        `)
        .order('created_at', { ascending: false })
        .limit(5)

      if (recentPurchasesData) {
        const enrichedPurchases: RecentPurchase[] = []

        for (const purchase of recentPurchasesData) {
          const { data: userData } = await supabase
            .from('profiles')
            .select('email, full_name')
            .eq('id', purchase.user_id)
            .single()

          const { data: courseData } = await supabase
            .from('courses')
            .select('title')
            .eq('id', purchase.course_id)
            .single()

          if (userData && courseData) {
            enrichedPurchases.push({
              id: purchase.id,
              amount: purchase.amount,
              created_at: purchase.created_at,
              user: userData,
              course: courseData,
            })
          }
        }

        setRecentPurchases(enrichedPurchases)
      }

      setLoading(false)
    }

    loadData()
  }, [])

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatCurrency = (amount: number) => {
    if (amount >= 10000) {
      return (amount / 10000).toFixed(0) + '만원'
    }
    return amount.toLocaleString() + '원'
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-red-500 border-t-transparent"></div>
      </div>
    )
  }

  return (
    <div className="p-6 lg:p-8">
      {/* 헤더 */}
      <div className="mb-8">
        <h1 className="text-2xl lg:text-3xl font-bold text-white">대시보드</h1>
        <p className="text-gray-400 mt-1">MangoRocket 관리자 센터에 오신 것을 환영합니다</p>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* 총 회원 */}
        <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
          </div>
          <p className="text-3xl font-bold text-white">{stats.totalUsers.toLocaleString()}</p>
          <p className="text-gray-400 text-sm mt-1">총 회원</p>
          <p className="text-blue-400 text-xs mt-2">강사 {stats.totalInstructors}명</p>
        </div>

        {/* 총 강의 */}
        <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-yellow-500/20 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
          </div>
          <p className="text-3xl font-bold text-white">{stats.totalCourses.toLocaleString()}</p>
          <p className="text-gray-400 text-sm mt-1">총 강의</p>
          <p className="text-yellow-400 text-xs mt-2">발행 {stats.publishedCourses}개</p>
        </div>

        {/* 총 매출 */}
        <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <p className="text-3xl font-bold text-white">{formatCurrency(stats.totalRevenue)}</p>
          <p className="text-gray-400 text-sm mt-1">총 매출</p>
          <p className="text-green-400 text-xs mt-2">결제 {stats.totalPurchases}건</p>
        </div>

        {/* 플랫폼 수익 */}
        <div className="bg-gradient-to-br from-red-600 to-orange-600 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
          </div>
          <p className="text-3xl font-bold text-white">{formatCurrency(stats.platformRevenue)}</p>
          <p className="text-red-100 text-sm mt-1">플랫폼 수익 (30%)</p>
          <p className="text-white/80 text-xs mt-2">이번 달 +{formatCurrency(stats.monthPlatformRevenue)}</p>
        </div>
      </div>

      {/* 오늘/이번달 매출 요약 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
          <h3 className="text-lg font-semibold text-white mb-4">오늘의 매출</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-gray-400 text-sm">총 매출</p>
              <p className="text-xl font-bold text-white">{stats.todayRevenue.toLocaleString()}원</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm">플랫폼 수익</p>
              <p className="text-xl font-bold text-green-400">{stats.todayPlatformRevenue.toLocaleString()}원</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm">강사 정산</p>
              <p className="text-xl font-bold text-yellow-400">{Math.round(stats.todayRevenue * 0.7).toLocaleString()}원</p>
            </div>
          </div>
        </div>
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
          <h3 className="text-lg font-semibold text-white mb-4">이번 달 매출</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-gray-400 text-sm">총 매출</p>
              <p className="text-xl font-bold text-white">{stats.monthRevenue.toLocaleString()}원</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm">플랫폼 수익</p>
              <p className="text-xl font-bold text-green-400">{stats.monthPlatformRevenue.toLocaleString()}원</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm">강사 정산</p>
              <p className="text-xl font-bold text-yellow-400">{Math.round(stats.monthRevenue * 0.7).toLocaleString()}원</p>
            </div>
          </div>
        </div>
      </div>

      {/* 최근 결제 */}
      <div className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden mb-8">
          <div className="p-6 border-b border-gray-700 flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">최근 결제</h2>
            <Link href="/admin/payments" className="text-sm text-red-400 hover:text-red-300">
              전체 보기 →
            </Link>
          </div>
          <div className="divide-y divide-gray-700">
            {recentPurchases.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                결제 내역이 없습니다
              </div>
            ) : (
              recentPurchases.map((purchase) => (
                <div key={purchase.id} className="p-4 flex items-center justify-between hover:bg-gray-700/50">
                  <div>
                    <p className="text-white font-medium">
                      {purchase.user.full_name || purchase.user.email?.split('@')[0]}
                    </p>
                    <p className="text-gray-500 text-sm truncate max-w-[200px]">
                      {purchase.course.title}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-green-400 font-medium">
                      +{purchase.amount.toLocaleString()}원
                    </p>
                    <p className="text-gray-500 text-xs">{formatDate(purchase.created_at)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      {/* 빠른 링크 */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Link
          href="/admin/users"
          className="bg-gray-800 border border-gray-700 rounded-xl p-4 hover:border-gray-600 transition-colors group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center group-hover:bg-blue-500/30 transition-colors">
              <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <span className="text-white font-medium">회원 관리</span>
          </div>
        </Link>

        <Link
          href="/admin/courses"
          className="bg-gray-800 border border-gray-700 rounded-xl p-4 hover:border-gray-600 transition-colors group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-500/20 rounded-lg flex items-center justify-center group-hover:bg-yellow-500/30 transition-colors">
              <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <span className="text-white font-medium">강의 관리</span>
          </div>
        </Link>

        <Link
          href="/admin/payments"
          className="bg-gray-800 border border-gray-700 rounded-xl p-4 hover:border-gray-600 transition-colors group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center group-hover:bg-green-500/30 transition-colors">
              <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            </div>
            <span className="text-white font-medium">결제 관리</span>
          </div>
        </Link>

        <Link
          href="/admin/reviews"
          className="bg-gray-800 border border-gray-700 rounded-xl p-4 hover:border-gray-600 transition-colors group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center group-hover:bg-orange-500/30 transition-colors">
              <svg className="w-5 h-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <span className="text-white font-medium">리뷰 관리</span>
          </div>
        </Link>

        <Link
          href="/admin/revenue"
          className="bg-gray-800 border border-gray-700 rounded-xl p-4 hover:border-gray-600 transition-colors group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-500/20 rounded-lg flex items-center justify-center group-hover:bg-red-500/30 transition-colors">
              <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="text-white font-medium">매출 관리</span>
          </div>
        </Link>
      </div>
    </div>
  )
}

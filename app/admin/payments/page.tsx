'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import Image from 'next/image'

interface Purchase {
  id: string
  user_id: string
  course_id: string
  payment_id: string
  amount: number
  status: string
  created_at: string
  user: {
    email: string
    full_name: string | null
    avatar_url: string | null
  } | null
  course: {
    title: string
    thumbnail: string | null
    instructor: string
  } | null
  instructor_name: string | null
}

interface Stats {
  totalRevenue: number
  todayRevenue: number
  monthRevenue: number
  totalCount: number
}

export default function AdminPaymentsPage() {
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<Stats>({
    totalRevenue: 0,
    todayRevenue: 0,
    monthRevenue: 0,
    totalCount: 0,
  })
  const [searchQuery, setSearchQuery] = useState('')
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)

  const PAGE_SIZE = 20

  const loadData = useCallback(async () => {
    setLoading(true)

    // 날짜 필터 계산
    let dateFrom: Date | null = null
    const now = new Date()

    if (dateFilter === 'today') {
      dateFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    } else if (dateFilter === 'week') {
      dateFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    } else if (dateFilter === 'month') {
      dateFrom = new Date(now.getFullYear(), now.getMonth(), 1)
    }

    // 결제 목록 쿼리
    let query = supabase
      .from('purchases')
      .select('id, user_id, course_id, payment_id, amount, status, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE - 1)

    if (dateFrom) {
      query = query.gte('created_at', dateFrom.toISOString())
    }

    const { data, count } = await query

    if (data) {
      // 각 결제의 추가 정보 가져오기
      const enrichedPurchases: Purchase[] = await Promise.all(
        data.map(async (purchase) => {
          // 사용자 정보
          const { data: userData } = await supabase
            .from('profiles')
            .select('email, full_name, avatar_url')
            .eq('id', purchase.user_id)
            .single()

          // 강의 정보
          const { data: courseData } = await supabase
            .from('courses')
            .select('title, thumbnail, instructor')
            .eq('id', purchase.course_id)
            .single()

          // 강사 이름
          let instructorName = null
          if (courseData?.instructor) {
            const { data: instructorData } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('id', courseData.instructor)
              .single()
            instructorName = instructorData?.full_name
          }

          return {
            ...purchase,
            user: userData,
            course: courseData,
            instructor_name: instructorName,
          }
        })
      )

      // 검색 필터 적용
      let filteredPurchases = enrichedPurchases
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        filteredPurchases = enrichedPurchases.filter(p =>
          p.user?.email?.toLowerCase().includes(query) ||
          p.user?.full_name?.toLowerCase().includes(query) ||
          p.course?.title?.toLowerCase().includes(query) ||
          p.payment_id?.toLowerCase().includes(query)
        )
      }

      setPurchases(filteredPurchases)
      setTotalCount(count || 0)
    }

    // 통계 계산
    const { data: allPurchases } = await supabase
      .from('purchases')
      .select('amount, created_at')

    if (allPurchases) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)

      const totalRevenue = allPurchases.reduce((sum, p) => sum + (p.amount || 0), 0)
      const todayRevenue = allPurchases
        .filter(p => new Date(p.created_at) >= today)
        .reduce((sum, p) => sum + (p.amount || 0), 0)
      const monthRevenue = allPurchases
        .filter(p => new Date(p.created_at) >= monthStart)
        .reduce((sum, p) => sum + (p.amount || 0), 0)

      setStats({
        totalRevenue,
        todayRevenue,
        monthRevenue,
        totalCount: allPurchases.length,
      })
    }

    setLoading(false)
  }, [currentPage, dateFilter, searchQuery])

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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500/20 text-green-400'
      case 'refunded':
        return 'bg-red-500/20 text-red-400'
      case 'pending':
        return 'bg-yellow-500/20 text-yellow-400'
      default:
        return 'bg-gray-500/20 text-gray-400'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'completed':
        return '완료'
      case 'refunded':
        return '환불'
      case 'pending':
        return '대기'
      default:
        return status
    }
  }

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  return (
    <div className="p-6 lg:p-8">
      {/* 헤더 */}
      <div className="mb-8">
        <h1 className="text-2xl lg:text-3xl font-bold text-white">결제 관리</h1>
        <p className="text-gray-400 mt-1">전체 결제 내역을 관리합니다</p>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
          <p className="text-gray-400 text-sm mb-1">총 매출</p>
          <p className="text-2xl font-bold text-white">{stats.totalRevenue.toLocaleString()}원</p>
        </div>
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
          <p className="text-gray-400 text-sm mb-1">이번 달</p>
          <p className="text-2xl font-bold text-green-400">{stats.monthRevenue.toLocaleString()}원</p>
        </div>
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
          <p className="text-gray-400 text-sm mb-1">오늘</p>
          <p className="text-2xl font-bold text-blue-400">{stats.todayRevenue.toLocaleString()}원</p>
        </div>
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
          <p className="text-gray-400 text-sm mb-1">총 결제 건수</p>
          <p className="text-2xl font-bold text-white">{stats.totalCount.toLocaleString()}건</p>
        </div>
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
                placeholder="이메일, 이름, 강의명, 결제ID로 검색..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setCurrentPage(1)
                }}
                className="w-full pl-10 pr-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-red-500"
              />
            </div>
          </div>

          {/* 기간 필터 */}
          <div className="flex gap-2">
            {[
              { value: 'all', label: '전체' },
              { value: 'today', label: '오늘' },
              { value: 'week', label: '이번 주' },
              { value: 'month', label: '이번 달' },
            ].map((filter) => (
              <button
                key={filter.value}
                onClick={() => {
                  setDateFilter(filter.value as typeof dateFilter)
                  setCurrentPage(1)
                }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  dateFilter === filter.value
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

      {/* 결제 목록 */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        {loading ? (
          <div className="p-8 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-4 border-red-500 border-t-transparent"></div>
          </div>
        ) : purchases.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-5xl mb-4">💳</div>
            <p className="text-gray-400">결제 내역이 없습니다</p>
          </div>
        ) : (
          <>
            {/* 테이블 헤더 */}
            <div className="hidden lg:grid grid-cols-12 gap-4 p-4 border-b border-gray-700 text-sm font-medium text-gray-500">
              <div className="col-span-3">구매자</div>
              <div className="col-span-3">강의</div>
              <div className="col-span-2">결제ID</div>
              <div className="col-span-1">금액</div>
              <div className="col-span-1">상태</div>
              <div className="col-span-2">결제일</div>
            </div>

            {/* 결제 리스트 */}
            <div className="divide-y divide-gray-700">
              {purchases.map((purchase) => (
                <div key={purchase.id} className="p-4 hover:bg-gray-700/50 transition-colors">
                  <div className="lg:grid lg:grid-cols-12 lg:gap-4 lg:items-center">
                    {/* 구매자 */}
                    <div className="col-span-3 flex items-center gap-3 mb-3 lg:mb-0">
                      <div className="relative w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-gray-600 to-gray-700 flex-shrink-0">
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
                      <div className="min-w-0">
                        <p className="text-white font-medium truncate">
                          {purchase.user?.full_name || '이름 없음'}
                        </p>
                        <p className="text-gray-500 text-sm truncate">{purchase.user?.email}</p>
                      </div>
                    </div>

                    {/* 강의 */}
                    <div className="col-span-3 mb-3 lg:mb-0">
                      <div className="flex items-center gap-3">
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
                    </div>

                    {/* 결제 ID */}
                    <div className="col-span-2 mb-3 lg:mb-0">
                      <p className="text-gray-400 text-sm font-mono truncate">{purchase.payment_id}</p>
                    </div>

                    {/* 금액 */}
                    <div className="col-span-1 mb-3 lg:mb-0">
                      <p className="text-green-400 font-medium">{purchase.amount.toLocaleString()}원</p>
                    </div>

                    {/* 상태 */}
                    <div className="col-span-1 mb-3 lg:mb-0">
                      <span className={`inline-flex px-2 py-1 rounded text-xs font-medium ${getStatusBadge(purchase.status)}`}>
                        {getStatusLabel(purchase.status)}
                      </span>
                    </div>

                    {/* 결제일 */}
                    <div className="col-span-2">
                      <p className="text-gray-400 text-sm">{formatDate(purchase.created_at)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* 페이지네이션 */}
            {totalPages > 1 && (
              <div className="p-4 border-t border-gray-700 flex items-center justify-between">
                <p className="text-gray-500 text-sm">
                  총 {totalCount}건 중 {(currentPage - 1) * PAGE_SIZE + 1}-{Math.min(currentPage * PAGE_SIZE, totalCount)}
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

'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import Image from 'next/image'

interface User {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  role: 'student' | 'instructor' | 'admin'
  created_at: string
  purchases_count?: number
  courses_count?: number
}

interface SignupStats {
  total: number
  today: number
  week: number
  month: number
  instructors: number
  students: number
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<SignupStats>({
    total: 0,
    today: 0,
    week: 0,
    month: 0,
    instructors: 0,
    students: 0,
  })
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | 'student' | 'instructor' | 'admin'>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [changingRole, setChangingRole] = useState<string | null>(null)

  const PAGE_SIZE = 20

  const loadUsers = useCallback(async () => {
    setLoading(true)

    // 가입 통계 로드
    const { data: allProfiles } = await supabase
      .from('profiles')
      .select('id, role, created_at')

    if (allProfiles) {
      const now = new Date()
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
      const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)

      const todaySignups = allProfiles.filter(p => p.created_at && new Date(p.created_at) >= today).length
      const weekSignups = allProfiles.filter(p => p.created_at && new Date(p.created_at) >= weekAgo).length
      const monthSignups = allProfiles.filter(p => p.created_at && new Date(p.created_at) >= monthAgo).length
      const instructors = allProfiles.filter(p => p.role === 'instructor').length
      const students = allProfiles.filter(p => p.role === 'student').length

      setStats({
        total: allProfiles.length,
        today: todaySignups,
        week: weekSignups,
        month: monthSignups,
        instructors,
        students,
      })
    }

    // 사용자 목록 로드
    let query = supabase
      .from('profiles')
      .select('id, email, full_name, avatar_url, role, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE - 1)

    if (roleFilter !== 'all') {
      query = query.eq('role', roleFilter)
    }

    if (searchQuery) {
      query = query.or(`email.ilike.%${searchQuery}%,full_name.ilike.%${searchQuery}%`)
    }

    const { data, count, error } = await query

    if (error) {
      console.error('Users query error:', error.message)
      setLoading(false)
      return
    }

    if (data) {
      // 각 사용자의 추가 정보 가져오기
      const enrichedUsers: User[] = await Promise.all(
        data.map(async (user) => {
          // 구매 수
          const { count: purchasesCount } = await supabase
            .from('purchases')
            .select('id', { count: 'exact' })
            .eq('user_id', user.id)

          // 강사인 경우 강의 수
          let coursesCount = 0
          if (user.role === 'instructor') {
            const { count } = await supabase
              .from('courses')
              .select('id', { count: 'exact' })
              .eq('instructor', user.id)
            coursesCount = count || 0
          }

          return {
            ...user,
            purchases_count: purchasesCount || 0,
            courses_count: coursesCount,
          }
        })
      )

      setUsers(enrichedUsers)
      setTotalCount(count || 0)
    }

    setLoading(false)
  }, [currentPage, roleFilter, searchQuery])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  // 역할 변경
  const handleRoleChange = async (userId: string, newRole: 'student' | 'instructor' | 'admin') => {
    if (!confirm(`회원의 역할을 '${getRoleLabel(newRole)}'(으)로 변경하시겠습니까?`)) return

    setChangingRole(userId)

    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', userId)

    if (error) {
      alert('역할 변경에 실패했습니다.')
    } else {
      loadUsers()
    }

    setChangingRole(null)
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-500/20 text-red-400 border-red-500/30'
      case 'instructor':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30'
    }
  }

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin':
        return '관리자'
      case 'instructor':
        return '강사'
      default:
        return '수강생'
    }
  }

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  return (
    <div className="p-6 lg:p-8">
      {/* 헤더 */}
      <div className="mb-8">
        <h1 className="text-2xl lg:text-3xl font-bold text-white">회원 관리</h1>
        <p className="text-gray-400 mt-1">전체 회원을 관리합니다</p>
      </div>

      {/* 가입 통계 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 mb-8">
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
          <p className="text-gray-400 text-sm mb-1">총 회원</p>
          <p className="text-2xl font-bold text-white">{stats.total.toLocaleString()}</p>
        </div>
        <div className="bg-gradient-to-br from-green-600 to-green-700 rounded-xl p-4">
          <p className="text-green-100 text-sm mb-1">오늘 가입</p>
          <p className="text-2xl font-bold text-white">{stats.today.toLocaleString()}</p>
        </div>
        <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-4">
          <p className="text-blue-100 text-sm mb-1">최근 7일</p>
          <p className="text-2xl font-bold text-white">{stats.week.toLocaleString()}</p>
        </div>
        <div className="bg-gradient-to-br from-yellow-600 to-purple-700 rounded-xl p-4">
          <p className="text-yellow-100 text-sm mb-1">최근 30일</p>
          <p className="text-2xl font-bold text-white">{stats.month.toLocaleString()}</p>
        </div>
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
          <p className="text-gray-400 text-sm mb-1">수강생</p>
          <p className="text-2xl font-bold text-white">{stats.students.toLocaleString()}</p>
        </div>
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
          <p className="text-gray-400 text-sm mb-1">강사</p>
          <p className="text-2xl font-bold text-yellow-400">{stats.instructors.toLocaleString()}</p>
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
                placeholder="이메일 또는 이름으로 검색..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setCurrentPage(1)
                }}
                className="w-full pl-10 pr-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-red-500"
              />
            </div>
          </div>

          {/* 역할 필터 */}
          <div className="flex gap-2">
            {[
              { value: 'all', label: '전체' },
              { value: 'student', label: '수강생' },
              { value: 'instructor', label: '강사' },
              { value: 'admin', label: '관리자' },
            ].map((filter) => (
              <button
                key={filter.value}
                onClick={() => {
                  setRoleFilter(filter.value as typeof roleFilter)
                  setCurrentPage(1)
                }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  roleFilter === filter.value
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

      {/* 회원 목록 */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        {loading ? (
          <div className="p-8 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-4 border-red-500 border-t-transparent"></div>
          </div>
        ) : users.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-5xl mb-4">👤</div>
            <p className="text-gray-400">회원이 없습니다</p>
          </div>
        ) : (
          <>
            {/* 테이블 헤더 */}
            <div className="hidden md:grid grid-cols-12 gap-4 p-4 border-b border-gray-700 text-sm font-medium text-gray-500">
              <div className="col-span-4">회원 정보</div>
              <div className="col-span-2">역할</div>
              <div className="col-span-2">활동</div>
              <div className="col-span-2">가입일</div>
              <div className="col-span-2">관리</div>
            </div>

            {/* 회원 리스트 */}
            <div className="divide-y divide-gray-700">
              {users.map((user) => (
                <div key={user.id} className="p-4 hover:bg-gray-700/50 transition-colors">
                  <div className="md:grid md:grid-cols-12 md:gap-4 md:items-center">
                    {/* 회원 정보 */}
                    <div className="col-span-4 flex items-center gap-3 mb-3 md:mb-0">
                      <div className="relative w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-gray-600 to-gray-700 flex-shrink-0">
                        {user.avatar_url ? (
                          <Image
                            src={user.avatar_url}
                            alt={user.full_name || '사용자'}
                            fill
                            className="object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-white font-medium">
                            {(user.full_name || user.email || '?').charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-white font-medium truncate">
                          {user.full_name || '이름 없음'}
                        </p>
                        <p className="text-gray-500 text-sm truncate">{user.email}</p>
                      </div>
                    </div>

                    {/* 역할 */}
                    <div className="col-span-2 mb-3 md:mb-0">
                      <span className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-medium border ${getRoleBadge(user.role)}`}>
                        {getRoleLabel(user.role)}
                      </span>
                    </div>

                    {/* 활동 */}
                    <div className="col-span-2 mb-3 md:mb-0">
                      <div className="text-sm">
                        <p className="text-gray-400">
                          수강 <span className="text-white">{user.purchases_count}</span>개
                        </p>
                        {user.role === 'instructor' && (
                          <p className="text-gray-400">
                            강의 <span className="text-yellow-400">{user.courses_count}</span>개
                          </p>
                        )}
                      </div>
                    </div>

                    {/* 가입일 */}
                    <div className="col-span-2 mb-3 md:mb-0">
                      <p className="text-gray-400 text-sm">{formatDate(user.created_at)}</p>
                    </div>

                    {/* 관리 */}
                    <div className="col-span-2">
                      <select
                        value={user.role}
                        onChange={(e) => handleRoleChange(user.id, e.target.value as User['role'])}
                        disabled={changingRole === user.id}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:border-red-500 disabled:opacity-50"
                      >
                        <option value="student">수강생</option>
                        <option value="instructor">강사</option>
                        <option value="admin">관리자</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* 페이지네이션 */}
            {totalPages > 1 && (
              <div className="p-4 border-t border-gray-700 flex items-center justify-between">
                <p className="text-gray-500 text-sm">
                  총 {totalCount}명 중 {(currentPage - 1) * PAGE_SIZE + 1}-{Math.min(currentPage * PAGE_SIZE, totalCount)}
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

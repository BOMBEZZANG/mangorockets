'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import Image from 'next/image'
import Link from 'next/link'

interface Review {
  id: string
  user_id: string
  course_id: string
  rating: number
  comment: string
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
  totalReviews: number
  averageRating: number
  todayReviews: number
  withReplies: number
}

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<Stats>({
    totalReviews: 0,
    averageRating: 0,
    todayReviews: 0,
    withReplies: 0,
  })
  const [searchQuery, setSearchQuery] = useState('')
  const [ratingFilter, setRatingFilter] = useState<'all' | '5' | '4' | '3' | '2' | '1'>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [expandedReview, setExpandedReview] = useState<string | null>(null)

  const PAGE_SIZE = 20

  const loadData = useCallback(async () => {
    setLoading(true)

    // 리뷰 목록 쿼리
    let query = supabase
      .from('reviews')
      .select('id, user_id, course_id, rating, comment, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE - 1)

    if (ratingFilter !== 'all') {
      query = query.eq('rating', parseInt(ratingFilter))
    }

    const { data, count, error } = await query

    if (error) {
      console.error('Reviews query error:', error.message)
      setLoading(false)
      return
    }

    if (data) {
      // 각 리뷰의 추가 정보 가져오기
      const enrichedReviews: Review[] = await Promise.all(
        data.map(async (review) => {
          // 사용자 정보
          const { data: userData } = await supabase
            .from('profiles')
            .select('email, full_name, avatar_url')
            .eq('id', review.user_id)
            .single()

          // 강의 정보
          const { data: courseData } = await supabase
            .from('courses')
            .select('title, thumbnail, instructor')
            .eq('id', review.course_id)
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
            ...review,
            user: userData,
            course: courseData,
            instructor_name: instructorName,
          }
        })
      )

      // 검색 필터 적용
      let filteredReviews = enrichedReviews
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        filteredReviews = enrichedReviews.filter(r =>
          r.user?.email?.toLowerCase().includes(query) ||
          r.user?.full_name?.toLowerCase().includes(query) ||
          r.course?.title?.toLowerCase().includes(query) ||
          r.comment?.toLowerCase().includes(query)
        )
      }

      setReviews(filteredReviews)
      setTotalCount(count || 0)
    }

    // 통계 계산
    const { data: allReviews } = await supabase
      .from('reviews')
      .select('rating, created_at')

    if (allReviews) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const totalReviews = allReviews.length
      const averageRating = totalReviews > 0
        ? allReviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews
        : 0
      const todayReviews = allReviews.filter(r => new Date(r.created_at) >= today).length

      setStats({
        totalReviews,
        averageRating: Math.round(averageRating * 10) / 10,
        todayReviews,
        withReplies: 0, // 답변 기능이 없음
      })
    }

    setLoading(false)
  }, [currentPage, ratingFilter, searchQuery])

  useEffect(() => {
    loadData()
  }, [loadData])

  // 리뷰 삭제
  const handleDelete = async (reviewId: string) => {
    if (!confirm('이 리뷰를 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.')) return

    setDeletingId(reviewId)

    const { error } = await supabase
      .from('reviews')
      .delete()
      .eq('id', reviewId)

    if (error) {
      alert('삭제에 실패했습니다.')
    } else {
      loadData()
    }

    setDeletingId(null)
  }

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

  const renderStars = (rating: number) => {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <svg
            key={star}
            className={`w-4 h-4 ${star <= rating ? 'text-yellow-400' : 'text-gray-600'}`}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        ))}
      </div>
    )
  }

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  return (
    <div className="p-6 lg:p-8">
      {/* 헤더 */}
      <div className="mb-8">
        <h1 className="text-2xl lg:text-3xl font-bold text-white">리뷰 관리</h1>
        <p className="text-gray-400 mt-1">전체 리뷰를 관리합니다</p>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
          <p className="text-gray-400 text-sm mb-1">총 리뷰</p>
          <p className="text-2xl font-bold text-white">{stats.totalReviews.toLocaleString()}개</p>
        </div>
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
          <p className="text-gray-400 text-sm mb-1">평균 평점</p>
          <div className="flex items-center gap-2">
            <p className="text-2xl font-bold text-yellow-400">{stats.averageRating}</p>
            <svg className="w-6 h-6 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          </div>
        </div>
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
          <p className="text-gray-400 text-sm mb-1">오늘 리뷰</p>
          <p className="text-2xl font-bold text-blue-400">{stats.todayReviews.toLocaleString()}개</p>
        </div>
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
          <p className="text-gray-400 text-sm mb-1">답변된 리뷰</p>
          <p className="text-2xl font-bold text-green-400">{stats.withReplies.toLocaleString()}개</p>
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
                placeholder="이메일, 이름, 강의명, 리뷰 내용으로 검색..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setCurrentPage(1)
                }}
                className="w-full pl-10 pr-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-red-500"
              />
            </div>
          </div>

          {/* 평점 필터 */}
          <div className="flex gap-2 flex-wrap">
            {[
              { value: 'all', label: '전체' },
              { value: '5', label: '5점' },
              { value: '4', label: '4점' },
              { value: '3', label: '3점' },
              { value: '2', label: '2점' },
              { value: '1', label: '1점' },
            ].map((filter) => (
              <button
                key={filter.value}
                onClick={() => {
                  setRatingFilter(filter.value as typeof ratingFilter)
                  setCurrentPage(1)
                }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  ratingFilter === filter.value
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

      {/* 리뷰 목록 */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        {loading ? (
          <div className="p-8 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-4 border-red-500 border-t-transparent"></div>
          </div>
        ) : reviews.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-5xl mb-4">💬</div>
            <p className="text-gray-400">리뷰가 없습니다</p>
          </div>
        ) : (
          <>
            {/* 리뷰 리스트 */}
            <div className="divide-y divide-gray-700">
              {reviews.map((review) => (
                <div key={review.id} className="p-4 hover:bg-gray-700/50 transition-colors">
                  <div className="flex flex-col gap-4">
                    {/* 상단: 작성자, 강의, 평점, 날짜 */}
                    <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                      {/* 작성자 */}
                      <div className="flex items-center gap-3 lg:w-48">
                        <div className="relative w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-gray-600 to-gray-700 flex-shrink-0">
                          {review.user?.avatar_url ? (
                            <Image
                              src={review.user.avatar_url}
                              alt={review.user.full_name || '사용자'}
                              fill
                              className="object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-white font-medium">
                              {(review.user?.full_name || review.user?.email || '?').charAt(0).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-white font-medium truncate text-sm">
                            {review.user?.full_name || '이름 없음'}
                          </p>
                          <p className="text-gray-500 text-xs truncate">{review.user?.email}</p>
                        </div>
                      </div>

                      {/* 강의 */}
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="relative w-16 h-10 rounded overflow-hidden bg-gray-700 flex-shrink-0">
                          {review.course?.thumbnail ? (
                            <Image
                              src={review.course.thumbnail}
                              alt={review.course.title || '강의'}
                              fill
                              className="object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-sm">🚀</div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <Link
                            href={`/courses/${review.course_id}`}
                            target="_blank"
                            className="text-white text-sm hover:text-red-400 truncate block"
                          >
                            {review.course?.title || '알 수 없음'}
                          </Link>
                          <p className="text-gray-500 text-xs">{review.instructor_name || '강사'}</p>
                        </div>
                      </div>

                      {/* 평점 & 날짜 & 액션 */}
                      <div className="flex items-center gap-4 lg:gap-6">
                        <div className="flex items-center gap-2">
                          {renderStars(review.rating)}
                          <span className="text-white font-medium">{review.rating}</span>
                        </div>
                        <p className="text-gray-400 text-sm">{formatDate(review.created_at)}</p>
                        <button
                          onClick={() => handleDelete(review.id)}
                          disabled={deletingId === review.id}
                          className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors disabled:opacity-50"
                          title="삭제"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* 리뷰 내용 */}
                    <div className="pl-0 lg:pl-[12.5rem]">
                      <p className="text-gray-300 text-sm leading-relaxed">
                        {review.comment.length > 200 && expandedReview !== review.id
                          ? `${review.comment.slice(0, 200)}...`
                          : review.comment}
                      </p>
                      {review.comment.length > 200 && (
                        <button
                          onClick={() => setExpandedReview(expandedReview === review.id ? null : review.id)}
                          className="text-red-400 text-sm mt-1 hover:underline"
                        >
                          {expandedReview === review.id ? '접기' : '더 보기'}
                        </button>
                      )}
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

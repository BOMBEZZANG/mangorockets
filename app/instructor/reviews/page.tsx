'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import Image from 'next/image'
import Link from 'next/link'

interface Course {
  id: string
  title: string
  thumbnail: string | null
}

interface Review {
  id: string
  user_id: string
  course_id: string
  rating: number
  comment: string
  created_at: string
  course: Course
  user: {
    id: string
    email: string
    full_name: string | null
    avatar_url: string | null
  }
  likes_count: number
  reply: {
    id: string
    comment: string
    created_at: string
    updated_at: string
  } | null
}

export default function InstructorReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCourseId, setSelectedCourseId] = useState<string>('all')
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  // 답글 관련 상태
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyComment, setReplyComment] = useState('')
  const [submittingReply, setSubmittingReply] = useState(false)

  // 답글 수정 상태
  const [editingReplyId, setEditingReplyId] = useState<string | null>(null)
  const [editReplyComment, setEditReplyComment] = useState('')

  // 통계
  const [stats, setStats] = useState({
    totalReviews: 0,
    averageRating: 0,
    pendingReplies: 0,
  })

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    setCurrentUserId(user.id)

    // 강사의 강의 목록 가져오기
    const { data: coursesData } = await supabase
      .from('courses')
      .select('id, title, thumbnail')
      .eq('instructor', user.id)

    if (coursesData) {
      setCourses(coursesData)

      const courseIds = coursesData.map(c => c.id)

      if (courseIds.length === 0) {
        setLoading(false)
        return
      }

      // 해당 강의들의 리뷰 가져오기
      let query = supabase
        .from('reviews')
        .select('id, user_id, course_id, rating, comment, created_at')
        .in('course_id', courseIds)
        .order('created_at', { ascending: false })

      if (selectedCourseId !== 'all') {
        query = query.eq('course_id', selectedCourseId)
      }

      const { data: reviewsData } = await query

      if (reviewsData) {
        // 각 리뷰에 대한 추가 정보 가져오기
        const enrichedReviews: Review[] = await Promise.all(
          reviewsData.map(async (review) => {
            // 강의 정보
            const course = coursesData.find(c => c.id === review.course_id)

            // 사용자 정보
            const { data: userData } = await supabase
              .from('profiles')
              .select('id, email, full_name, avatar_url')
              .eq('id', review.user_id)
              .single()

            // 좋아요 수
            const { count: likesCount } = await supabase
              .from('review_likes')
              .select('id', { count: 'exact' })
              .eq('review_id', review.id)

            // 강사 답글
            const { data: replyData } = await supabase
              .from('review_replies')
              .select('id, comment, created_at, updated_at')
              .eq('review_id', review.id)
              .single()

            return {
              ...review,
              course: course || { id: review.course_id, title: '알 수 없음', thumbnail: null },
              user: userData || { id: review.user_id, email: '', full_name: null, avatar_url: null },
              likes_count: likesCount || 0,
              reply: replyData || null,
            }
          })
        )

        setReviews(enrichedReviews)

        // 통계 계산
        const totalReviews = enrichedReviews.length
        const averageRating = totalReviews > 0
          ? Math.round((enrichedReviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews) * 10) / 10
          : 0
        const pendingReplies = enrichedReviews.filter(r => !r.reply).length

        setStats({
          totalReviews,
          averageRating,
          pendingReplies,
        })
      }
    }

    setLoading(false)
  }, [selectedCourseId])

  useEffect(() => {
    loadData()
  }, [loadData])

  // 답글 작성
  const handleSubmitReply = async (reviewId: string) => {
    if (!replyComment.trim() || !currentUserId) return

    setSubmittingReply(true)

    const { error } = await supabase
      .from('review_replies')
      .insert({
        review_id: reviewId,
        instructor_id: currentUserId,
        comment: replyComment.trim(),
      })

    if (!error) {
      setReplyComment('')
      setReplyingTo(null)
      loadData()
    } else {
      alert('답글 작성에 실패했습니다.')
    }

    setSubmittingReply(false)
  }

  // 답글 수정
  const handleUpdateReply = async (replyId: string) => {
    if (!editReplyComment.trim()) return

    setSubmittingReply(true)

    const { error } = await supabase
      .from('review_replies')
      .update({
        comment: editReplyComment.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', replyId)

    if (!error) {
      setEditingReplyId(null)
      setEditReplyComment('')
      loadData()
    } else {
      alert('답글 수정에 실패했습니다.')
    }

    setSubmittingReply(false)
  }

  // 답글 삭제
  const handleDeleteReply = async (replyId: string) => {
    if (!confirm('답글을 삭제하시겠습니까?')) return

    const { error } = await supabase
      .from('review_replies')
      .delete()
      .eq('id', replyId)

    if (!error) {
      loadData()
    } else {
      alert('답글 삭제에 실패했습니다.')
    }
  }

  // 별점 렌더링
  const renderStars = (rating: number) => {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <svg
            key={star}
            className={`w-4 h-4 ${star <= rating ? 'text-yellow-400' : 'text-gray-300'}`}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        ))}
      </div>
    )
  }

  // 날짜 포맷
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

  // 상대 시간 포맷
  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return '오늘'
    if (diffDays === 1) return '어제'
    if (diffDays < 7) return `${diffDays}일 전`
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}주 전`
    return `${Math.floor(diffDays / 30)}달 전`
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-48 mb-8"></div>
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="h-24 bg-gray-100 rounded-xl"></div>
            <div className="h-24 bg-gray-100 rounded-xl"></div>
            <div className="h-24 bg-gray-100 rounded-xl"></div>
          </div>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-40 bg-gray-100 rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      {/* 헤더 */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">리뷰 관리</h1>
        <p className="text-gray-500 mt-1">수강생들의 리뷰를 확인하고 답글을 남겨보세요</p>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl border p-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-500">총 리뷰</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalReviews}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border p-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-500">평균 평점</p>
              <p className="text-2xl font-bold text-gray-900">{stats.averageRating || '-'}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border p-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-500">답글 대기</p>
              <p className="text-2xl font-bold text-gray-900">{stats.pendingReplies}</p>
            </div>
          </div>
        </div>
      </div>

      {/* 필터 */}
      <div className="bg-white rounded-xl border p-4 mb-6">
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-gray-700">강의 선택:</label>
          <select
            value={selectedCourseId}
            onChange={(e) => setSelectedCourseId(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
          >
            <option value="all">전체 강의</option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 강의가 없는 경우 */}
      {courses.length === 0 ? (
        <div className="bg-white rounded-xl border p-12 text-center">
          <div className="text-6xl mb-4">📚</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            등록된 강의가 없습니다
          </h3>
          <p className="text-gray-500 mb-6">
            먼저 강의를 등록해주세요
          </p>
          <Link
            href="/instructor/courses/new"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-yellow-500 text-white rounded-full font-medium hover:shadow-lg transition-shadow"
          >
            강의 만들기
          </Link>
        </div>
      ) : reviews.length === 0 ? (
        /* 리뷰가 없는 경우 */
        <div className="bg-white rounded-xl border p-12 text-center">
          <div className="text-6xl mb-4">💬</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            아직 리뷰가 없습니다
          </h3>
          <p className="text-gray-500">
            수강생들의 리뷰가 등록되면 여기에 표시됩니다
          </p>
        </div>
      ) : (
        /* 리뷰 목록 */
        <div className="space-y-4">
          {reviews.map((review) => (
            <div key={review.id} className="bg-white rounded-xl border overflow-hidden">
              {/* 리뷰 헤더 - 강의 정보 */}
              <div className="bg-gray-50 px-5 py-3 border-b flex items-center justify-between">
                <Link
                  href={`/instructor/courses/${review.course_id}`}
                  className="flex items-center gap-3 hover:opacity-80 transition-opacity"
                >
                  <div className="relative w-12 h-8 rounded overflow-hidden bg-gray-200 flex-shrink-0">
                    {review.course.thumbnail ? (
                      <Image
                        src={review.course.thumbnail}
                        alt={review.course.title}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs">🚀</div>
                    )}
                  </div>
                  <span className="text-sm font-medium text-gray-700 truncate max-w-[300px]">
                    {review.course.title}
                  </span>
                </Link>
                <span className="text-xs text-gray-400">{formatRelativeTime(review.created_at)}</span>
              </div>

              {/* 리뷰 본문 */}
              <div className="p-5">
                <div className="flex items-start gap-4">
                  {/* 사용자 아바타 */}
                  <div className="relative w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-orange-400 to-yellow-400 flex-shrink-0">
                    {review.user.avatar_url ? (
                      <Image
                        src={review.user.avatar_url}
                        alt={review.user.full_name || '사용자'}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white font-medium">
                        {(review.user.full_name || review.user.email || '?').charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>

                  {/* 리뷰 내용 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-medium text-gray-900">
                        {review.user.full_name || review.user.email?.split('@')[0] || '익명'}
                      </span>
                      {renderStars(review.rating)}
                    </div>
                    <p className="text-gray-700 whitespace-pre-wrap mb-2">{review.comment}</p>
                    <div className="flex items-center gap-4 text-sm text-gray-400">
                      <span>{formatDate(review.created_at)}</span>
                      {review.likes_count > 0 && (
                        <span className="flex items-center gap-1">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                          </svg>
                          {review.likes_count}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* 답글 영역 */}
                <div className="mt-4 pl-14">
                  {/* 기존 답글 표시 */}
                  {review.reply && editingReplyId !== review.reply.id && (
                    <div className="bg-yellow-50 rounded-lg p-4 border-l-2 border-purple-300">
                      <div className="flex items-center justify-between mb-2">
                        <span className="px-2 py-0.5 bg-yellow-100 text-purple-700 text-xs font-medium rounded">
                          내 답글
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400">{formatDate(review.reply.updated_at || review.reply.created_at)}</span>
                          <button
                            onClick={() => {
                              setEditingReplyId(review.reply!.id)
                              setEditReplyComment(review.reply!.comment)
                            }}
                            className="text-xs text-gray-400 hover:text-yellow-500"
                          >
                            수정
                          </button>
                          <button
                            onClick={() => handleDeleteReply(review.reply!.id)}
                            className="text-xs text-gray-400 hover:text-red-500"
                          >
                            삭제
                          </button>
                        </div>
                      </div>
                      <p className="text-sm text-gray-700">{review.reply.comment}</p>
                    </div>
                  )}

                  {/* 답글 수정 폼 */}
                  {review.reply && editingReplyId === review.reply.id && (
                    <div className="bg-yellow-50 rounded-lg p-4 border-l-2 border-purple-300">
                      <textarea
                        value={editReplyComment}
                        onChange={(e) => setEditReplyComment(e.target.value)}
                        rows={3}
                        className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 resize-none text-sm"
                        placeholder="답글을 수정하세요..."
                      />
                      <div className="flex gap-2 justify-end mt-2">
                        <button
                          onClick={() => {
                            setEditingReplyId(null)
                            setEditReplyComment('')
                          }}
                          className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
                        >
                          취소
                        </button>
                        <button
                          onClick={() => handleUpdateReply(review.reply!.id)}
                          disabled={submittingReply || !editReplyComment.trim()}
                          className="px-4 py-1.5 text-sm bg-yellow-500 text-white rounded-lg disabled:opacity-50 hover:bg-yellow-600"
                        >
                          {submittingReply ? '저장 중...' : '저장'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 답글 작성 버튼/폼 */}
                  {!review.reply && (
                    <>
                      {replyingTo === review.id ? (
                        <div className="bg-gray-50 rounded-lg p-4">
                          <textarea
                            value={replyComment}
                            onChange={(e) => setReplyComment(e.target.value)}
                            rows={3}
                            className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 resize-none text-sm"
                            placeholder="수강생에게 답글을 남겨보세요..."
                            autoFocus
                          />
                          <div className="flex gap-2 justify-end mt-2">
                            <button
                              onClick={() => {
                                setReplyingTo(null)
                                setReplyComment('')
                              }}
                              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
                            >
                              취소
                            </button>
                            <button
                              onClick={() => handleSubmitReply(review.id)}
                              disabled={submittingReply || !replyComment.trim()}
                              className="px-4 py-1.5 text-sm bg-gradient-to-r from-orange-500 to-yellow-500 text-white rounded-lg disabled:opacity-50 hover:shadow-md"
                            >
                              {submittingReply ? '등록 중...' : '답글 등록'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setReplyingTo(review.id)}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                          </svg>
                          답글 달기
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

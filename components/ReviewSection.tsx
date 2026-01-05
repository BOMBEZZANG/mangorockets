'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import Image from 'next/image'

interface Review {
  id: string
  user_id: string
  course_id: string
  rating: number
  comment: string
  created_at: string
  user: {
    id: string
    email: string
    full_name: string | null
    avatar_url: string | null
  }
  likes_count: number
  is_liked: boolean
  reply: {
    id: string
    comment: string
    created_at: string
  } | null
}

interface ReviewSectionProps {
  courseId: string
  instructorId: string
}

export default function ReviewSection({ courseId, instructorId }: ReviewSectionProps) {
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [isPurchased, setIsPurchased] = useState(false)
  const [hasReviewed, setHasReviewed] = useState(false)
  const [isInstructor, setIsInstructor] = useState(false)

  // 리뷰 작성 폼
  const [showForm, setShowForm] = useState(false)
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // 답글 작성
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyComment, setReplyComment] = useState('')
  const [submittingReply, setSubmittingReply] = useState(false)

  // 수정 모드
  const [editingReview, setEditingReview] = useState<string | null>(null)
  const [editRating, setEditRating] = useState(5)
  const [editComment, setEditComment] = useState('')

  // 평균 평점 및 통계
  const [stats, setStats] = useState({ average: 0, count: 0 })

  const loadReviews = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    setCurrentUserId(user?.id || null)
    setIsInstructor(user?.id === instructorId)

    // 구매 여부 확인
    if (user) {
      const { data: purchase } = await supabase
        .from('purchases')
        .select('id')
        .eq('user_id', user.id)
        .eq('course_id', courseId)
        .single()

      setIsPurchased(!!purchase)
    }

    // 리뷰 목록 가져오기
    const { data: reviewsData } = await supabase
      .from('reviews')
      .select(`
        id,
        user_id,
        course_id,
        rating,
        comment,
        created_at
      `)
      .eq('course_id', courseId)
      .order('created_at', { ascending: false })

    if (reviewsData) {
      // 각 리뷰에 대한 추가 정보 가져오기
      const enrichedReviews: Review[] = await Promise.all(
        reviewsData.map(async (review) => {
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

          // 현재 사용자의 좋아요 여부
          let isLiked = false
          if (user) {
            const { data: likeData } = await supabase
              .from('review_likes')
              .select('id')
              .eq('review_id', review.id)
              .eq('user_id', user.id)
              .single()
            isLiked = !!likeData
          }

          // 강사 답글
          const { data: replyData } = await supabase
            .from('review_replies')
            .select('id, comment, created_at')
            .eq('review_id', review.id)
            .single()

          // 현재 사용자가 이미 리뷰를 작성했는지 확인
          if (user && review.user_id === user.id) {
            setHasReviewed(true)
          }

          return {
            ...review,
            user: userData || { id: review.user_id, email: '', full_name: null, avatar_url: null },
            likes_count: likesCount || 0,
            is_liked: isLiked,
            reply: replyData || null,
          }
        })
      )

      setReviews(enrichedReviews)

      // 통계 계산
      if (enrichedReviews.length > 0) {
        const avg = enrichedReviews.reduce((sum, r) => sum + r.rating, 0) / enrichedReviews.length
        setStats({ average: Math.round(avg * 10) / 10, count: enrichedReviews.length })
      }
    }

    setLoading(false)
  }, [courseId, instructorId])

  useEffect(() => {
    loadReviews()
  }, [loadReviews])

  // 리뷰 작성
  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentUserId || !comment.trim()) return

    setSubmitting(true)

    const { error } = await supabase
      .from('reviews')
      .insert({
        user_id: currentUserId,
        course_id: courseId,
        rating,
        comment: comment.trim(),
      })

    if (!error) {
      setComment('')
      setRating(5)
      setShowForm(false)
      setHasReviewed(true)
      loadReviews()
    } else {
      alert('리뷰 작성에 실패했습니다.')
    }

    setSubmitting(false)
  }

  // 리뷰 수정
  const handleUpdateReview = async (reviewId: string) => {
    if (!editComment.trim()) return

    setSubmitting(true)

    const { error } = await supabase
      .from('reviews')
      .update({
        rating: editRating,
        comment: editComment.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', reviewId)

    if (!error) {
      setEditingReview(null)
      loadReviews()
    } else {
      alert('리뷰 수정에 실패했습니다.')
    }

    setSubmitting(false)
  }

  // 리뷰 삭제
  const handleDeleteReview = async (reviewId: string) => {
    if (!confirm('리뷰를 삭제하시겠습니까?')) return

    const { error } = await supabase
      .from('reviews')
      .delete()
      .eq('id', reviewId)

    if (!error) {
      setHasReviewed(false)
      loadReviews()
    }
  }

  // 좋아요 토글
  const handleToggleLike = async (reviewId: string, isLiked: boolean) => {
    if (!currentUserId) {
      alert('로그인이 필요합니다.')
      return
    }

    if (isLiked) {
      await supabase
        .from('review_likes')
        .delete()
        .eq('review_id', reviewId)
        .eq('user_id', currentUserId)
    } else {
      await supabase
        .from('review_likes')
        .insert({
          review_id: reviewId,
          user_id: currentUserId,
        })
    }

    loadReviews()
  }

  // 강사 답글 작성
  const handleSubmitReply = async (reviewId: string) => {
    if (!replyComment.trim()) return

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
      loadReviews()
    } else {
      alert('답글 작성에 실패했습니다.')
    }

    setSubmittingReply(false)
  }

  // 별점 렌더링
  const renderStars = (rating: number, interactive = false, onChange?: (r: number) => void) => {
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            disabled={!interactive}
            onClick={() => onChange?.(star)}
            className={`${interactive ? 'cursor-pointer hover:scale-110' : 'cursor-default'} transition-transform`}
          >
            <svg
              className={`w-5 h-5 ${star <= rating ? 'text-yellow-400' : 'text-gray-300'}`}
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          </button>
        ))}
      </div>
    )
  }

  // 날짜 포맷
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  if (loading) {
    return (
      <div className="mt-12 pt-8 border-t">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-32 mb-6"></div>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-gray-100 rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mt-12 pt-8 border-t">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-bold text-gray-900">수강생 리뷰</h2>
          {stats.count > 0 && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                <span className="font-semibold text-gray-900">{stats.average}</span>
              </div>
              <span className="text-gray-500">({stats.count}개 리뷰)</span>
            </div>
          )}
        </div>

        {/* 리뷰 작성 버튼 */}
        {isPurchased && !hasReviewed && !showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-gradient-to-r from-orange-500 to-yellow-500 text-white rounded-lg text-sm font-medium hover:shadow-md transition-shadow"
          >
            리뷰 작성하기
          </button>
        )}
      </div>

      {/* 리뷰 작성 폼 */}
      {showForm && (
        <form onSubmit={handleSubmitReview} className="bg-white rounded-xl border p-6 mb-6">
          <h3 className="font-semibold text-gray-900 mb-4">리뷰 작성</h3>

          {/* 별점 선택 */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">별점</label>
            <div className="flex items-center gap-2">
              {renderStars(rating, true, setRating)}
              <span className="text-sm text-gray-500 ml-2">{rating}점</span>
            </div>
          </div>

          {/* 코멘트 */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">후기</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="강의에 대한 솔직한 후기를 남겨주세요"
              rows={4}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
              required
            />
          </div>

          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={submitting || !comment.trim()}
              className="px-6 py-2 bg-gradient-to-r from-orange-500 to-yellow-500 text-white rounded-lg font-medium disabled:opacity-50"
            >
              {submitting ? '작성 중...' : '리뷰 등록'}
            </button>
          </div>
        </form>
      )}

      {/* 리뷰 목록 */}
      {reviews.length === 0 ? (
        <div className="bg-gray-50 rounded-xl p-12 text-center">
          <div className="text-4xl mb-3">💬</div>
          <p className="text-gray-500">아직 리뷰가 없습니다</p>
          {isPurchased && !hasReviewed && (
            <p className="text-sm text-gray-400 mt-1">첫 번째 리뷰를 남겨보세요!</p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => (
            <div key={review.id} className="bg-white rounded-xl border p-5">
              {/* 리뷰 헤더 */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  {/* 아바타 */}
                  <div className="relative w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-orange-400 to-yellow-400">
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
                  <div>
                    <p className="font-medium text-gray-900">
                      {review.user.full_name || review.user.email?.split('@')[0] || '익명'}
                    </p>
                    <div className="flex items-center gap-2">
                      {renderStars(review.rating)}
                      <span className="text-sm text-gray-400">{formatDate(review.created_at)}</span>
                    </div>
                  </div>
                </div>

                {/* 수정/삭제 버튼 (본인만) */}
                {currentUserId === review.user_id && editingReview !== review.id && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setEditingReview(review.id)
                        setEditRating(review.rating)
                        setEditComment(review.comment)
                      }}
                      className="text-sm text-gray-400 hover:text-gray-600"
                    >
                      수정
                    </button>
                    <button
                      onClick={() => handleDeleteReview(review.id)}
                      className="text-sm text-gray-400 hover:text-red-500"
                    >
                      삭제
                    </button>
                  </div>
                )}
              </div>

              {/* 리뷰 내용 또는 수정 폼 */}
              {editingReview === review.id ? (
                <div className="mt-3">
                  <div className="flex items-center gap-2 mb-3">
                    {renderStars(editRating, true, setEditRating)}
                    <span className="text-sm text-gray-500">{editRating}점</span>
                  </div>
                  <textarea
                    value={editComment}
                    onChange={(e) => setEditComment(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                  />
                  <div className="flex gap-2 justify-end mt-2">
                    <button
                      onClick={() => setEditingReview(null)}
                      className="px-3 py-1.5 text-sm text-gray-600"
                    >
                      취소
                    </button>
                    <button
                      onClick={() => handleUpdateReview(review.id)}
                      disabled={submitting}
                      className="px-4 py-1.5 text-sm bg-orange-500 text-white rounded-lg disabled:opacity-50"
                    >
                      {submitting ? '저장 중...' : '저장'}
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-gray-700 whitespace-pre-wrap">{review.comment}</p>
              )}

              {/* 좋아요 버튼 */}
              <div className="flex items-center gap-4 mt-4 pt-3 border-t">
                <button
                  onClick={() => handleToggleLike(review.id, review.is_liked)}
                  className={`flex items-center gap-1.5 text-sm transition-colors ${
                    review.is_liked ? 'text-orange-500' : 'text-gray-400 hover:text-orange-500'
                  }`}
                >
                  <svg
                    className="w-5 h-5"
                    fill={review.is_liked ? 'currentColor' : 'none'}
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                    />
                  </svg>
                  <span>좋아요 {review.likes_count > 0 && review.likes_count}</span>
                </button>

                {/* 강사 답글 버튼 */}
                {isInstructor && !review.reply && (
                  <button
                    onClick={() => setReplyingTo(review.id)}
                    className="text-sm text-gray-400 hover:text-yellow-500"
                  >
                    답글 달기
                  </button>
                )}
              </div>

              {/* 강사 답글 작성 폼 */}
              {replyingTo === review.id && (
                <div className="mt-4 pl-4 border-l-2 border-purple-200">
                  <textarea
                    value={replyComment}
                    onChange={(e) => setReplyComment(e.target.value)}
                    placeholder="수강생 리뷰에 답글을 남겨보세요"
                    rows={2}
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 resize-none text-sm"
                  />
                  <div className="flex gap-2 justify-end mt-2">
                    <button
                      onClick={() => {
                        setReplyingTo(null)
                        setReplyComment('')
                      }}
                      className="px-3 py-1.5 text-sm text-gray-600"
                    >
                      취소
                    </button>
                    <button
                      onClick={() => handleSubmitReply(review.id)}
                      disabled={submittingReply || !replyComment.trim()}
                      className="px-4 py-1.5 text-sm bg-yellow-500 text-white rounded-lg disabled:opacity-50"
                    >
                      {submittingReply ? '등록 중...' : '답글 등록'}
                    </button>
                  </div>
                </div>
              )}

              {/* 강사 답글 표시 */}
              {review.reply && (
                <div className="mt-4 pl-4 border-l-2 border-purple-200 bg-yellow-50 rounded-r-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-0.5 bg-yellow-100 text-purple-700 text-xs font-medium rounded">
                      강사 답글
                    </span>
                    <span className="text-xs text-gray-400">{formatDate(review.reply.created_at)}</span>
                  </div>
                  <p className="text-sm text-gray-700">{review.reply.comment}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 구매하지 않은 사용자 안내 */}
      {!isPurchased && currentUserId && (
        <p className="text-center text-sm text-gray-400 mt-6">
          강의를 수강하시면 리뷰를 작성할 수 있습니다
        </p>
      )}
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface Chapter {
  id: string
  title: string
  order_index: number
}

interface Lesson {
  id: string
  chapter_id: string
  title: string
  video_url: string | null
  order_index: number
  is_preview: boolean
}

interface CurriculumSectionProps {
  chapters: Chapter[]
  lessons: Lesson[]
  courseId: string
  price: number
}

export default function CurriculumSection({
  chapters,
  lessons,
  courseId,
  price,
}: CurriculumSectionProps) {
  const router = useRouter()
  const [expandedChapter, setExpandedChapter] = useState<string | null>(
    chapters.length > 0 ? chapters[0].id : null
  )
  const [isPurchased, setIsPurchased] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // 구매 여부 확인
  useEffect(() => {
    const checkPurchase = async () => {
      const { data: { session } } = await supabase.auth.getSession()

      if (session?.user) {
        const { data } = await supabase
          .from('purchases')
          .select('id')
          .eq('user_id', session.user.id)
          .eq('course_id', courseId)
          .single()

        setIsPurchased(!!data)
      }
      setIsLoading(false)
    }

    checkPurchase()
  }, [courseId])

  // 챕터별 레슨 그룹화
  const lessonsByChapter = lessons.reduce((acc, lesson) => {
    if (!acc[lesson.chapter_id]) {
      acc[lesson.chapter_id] = []
    }
    acc[lesson.chapter_id].push(lesson)
    return acc
  }, {} as Record<string, Lesson[]>)

  // 레슨 클릭 핸들러 - 새 페이지로 이동
  const handleLessonClick = (lesson: Lesson) => {
    // 구매했거나 미리보기 레슨인 경우만 접근 가능
    if (isPurchased || lesson.is_preview || price === 0) {
      router.push(`/courses/${courseId}/lessons/${lesson.id}`)
    }
  }

  // 레슨이 접근 가능한지 확인
  const isLessonAccessible = (lesson: Lesson) => {
    return isPurchased || lesson.is_preview || price === 0
  }

  return (
    <div className="space-y-4">
      {/* 챕터 목록 (아코디언) */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        {chapters.map((chapter, chapterIndex) => {
          const chapterLessons = lessonsByChapter[chapter.id] || []
          const previewCount = chapterLessons.filter(l => l.is_preview).length

          return (
            <div key={chapter.id} className={chapterIndex > 0 ? 'border-t' : ''}>
              {/* 챕터 헤더 */}
              <button
                onClick={() => setExpandedChapter(expandedChapter === chapter.id ? null : chapter.id)}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-r from-orange-500 to-yellow-500 text-white text-sm font-bold">
                    {chapterIndex + 1}
                  </span>
                  <div className="text-left">
                    <h3 className="font-semibold text-gray-900">{chapter.title}</h3>
                    <p className="text-sm text-gray-500">
                      {chapterLessons.length}개 회차
                      {previewCount > 0 && (
                        <span className="ml-2 text-yellow-600">({previewCount}개 미리보기)</span>
                      )}
                    </p>
                  </div>
                </div>
                <svg
                  className={`w-5 h-5 text-gray-400 transition-transform ${
                    expandedChapter === chapter.id ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* 레슨 목록 */}
              {expandedChapter === chapter.id && chapterLessons.length > 0 && (
                <div className="border-t bg-gray-50">
                  {chapterLessons.map((lesson, lessonIndex) => {
                    const isAccessible = isLessonAccessible(lesson)

                    return (
                      <button
                        key={lesson.id}
                        onClick={() => handleLessonClick(lesson)}
                        disabled={!isAccessible || !lesson.video_url}
                        className={`w-full flex items-center gap-3 p-4 text-left transition-colors ${
                          isAccessible && lesson.video_url
                            ? 'hover:bg-gray-100 cursor-pointer'
                            : 'opacity-60 cursor-not-allowed'
                        }`}
                      >
                        {/* 레슨 번호 */}
                        <span className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                          isAccessible
                            ? 'bg-orange-100 text-orange-600'
                            : 'bg-gray-200 text-gray-500'
                        }`}>
                          {lessonIndex + 1}
                        </span>

                        {/* 레슨 정보 */}
                        <div className="flex-grow">
                          <div className="flex items-center gap-2">
                            <span className={`font-medium ${isAccessible ? 'text-gray-900' : 'text-gray-500'}`}>
                              {lesson.title}
                            </span>
                            {lesson.is_preview && (
                              <span className="px-2 py-0.5 bg-yellow-100 text-yellow-600 rounded text-xs font-medium">
                                미리보기
                              </span>
                            )}
                          </div>
                        </div>

                        {/* 아이콘 */}
                        <div className="flex-shrink-0">
                          {!lesson.video_url ? (
                            <span className="text-xs text-gray-400">준비중</span>
                          ) : isAccessible ? (
                            <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          ) : (
                            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* 구매 안내 */}
      {!isPurchased && price > 0 && !isLoading && (
        <div className="mt-4 p-4 bg-gradient-to-r from-orange-50 to-yellow-50 rounded-xl border border-orange-200">
          <div className="flex items-center gap-3">
            <svg className="w-6 h-6 text-orange-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-gray-900">
                미리보기 레슨만 시청 가능합니다
              </p>
              <p className="text-xs text-gray-600">
                전체 강의를 시청하려면 구매하기을 해주세요
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

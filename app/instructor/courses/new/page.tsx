'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import VideoUploader from '@/components/VideoUploader'
import TagSelector from '@/components/TagSelector'
import ThumbnailUploader from '@/components/ThumbnailUploader'

// 단계 정의
const STEPS = [
  { id: 1, title: '기본 정보', description: '제목, 카테고리, 태그' },
  { id: 2, title: '커리큘럼', description: '챕터와 회차 구성' },
  { id: 3, title: '상세 소개', description: '강의 설명' },
  { id: 4, title: '썸네일', description: '대표 이미지' },
  { id: 5, title: '가격 설정', description: '판매 가격' },
]

const CATEGORIES = [
  '디지털 마케팅',
  '콘텐츠 마케팅',
  'SNS 마케팅',
  '퍼포먼스 마케팅',
  '브랜드 마케팅',
  '이메일 마케팅',
  'SEO 마케팅',
  '마케팅 자동화',
  '기타',
]

const LEVELS = ['입문', '중급', '고급']

interface Lesson {
  id: string
  title: string
  videoId: string
  note: string
}

interface Chapter {
  id: string
  title: string
  lessons: Lesson[]
}

interface CourseFormData {
  title: string
  category: string
  level: string
  description: string
  thumbnail: string
  price: number
  chapters: Chapter[]
  selectedTags: string[]
}

export default function NewCoursePage() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [expandedChapter, setExpandedChapter] = useState<string | null>(null)

  const [formData, setFormData] = useState<CourseFormData>({
    title: '',
    category: '',
    level: '',
    description: '',
    thumbnail: '',
    price: 0,
    chapters: [],
    selectedTags: [],
  })

  // 총 레슨 수 계산
  const totalLessons = formData.chapters.reduce((sum, ch) => sum + ch.lessons.length, 0)

  // 인증 확인
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      // 강사 권한 확인
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (profile?.role === 'student') {
        router.push('/instructor/apply')
        return
      }

      setUserId(user.id)
      setIsLoading(false)
    }

    checkAuth()
  }, [router])

  // 챕터 추가
  const addChapter = () => {
    const newChapter: Chapter = {
      id: crypto.randomUUID(),
      title: `챕터 ${formData.chapters.length + 1}`,
      lessons: [],
    }
    setFormData(prev => ({
      ...prev,
      chapters: [...prev.chapters, newChapter],
    }))
    setExpandedChapter(newChapter.id)
  }

  // 챕터 삭제
  const removeChapter = (chapterId: string) => {
    setFormData(prev => ({
      ...prev,
      chapters: prev.chapters.filter(ch => ch.id !== chapterId),
    }))
  }

  // 챕터 제목 업데이트
  const updateChapterTitle = (chapterId: string, title: string) => {
    setFormData(prev => ({
      ...prev,
      chapters: prev.chapters.map(ch =>
        ch.id === chapterId ? { ...ch, title } : ch
      ),
    }))
  }

  // 챕터 순서 변경
  const moveChapter = (index: number, direction: 'up' | 'down') => {
    const newChapters = [...formData.chapters]
    const targetIndex = direction === 'up' ? index - 1 : index + 1

    if (targetIndex < 0 || targetIndex >= newChapters.length) return

    [newChapters[index], newChapters[targetIndex]] = [newChapters[targetIndex], newChapters[index]]
    setFormData(prev => ({ ...prev, chapters: newChapters }))
  }

  // 레슨 추가
  const addLesson = (chapterId: string) => {
    const chapter = formData.chapters.find(ch => ch.id === chapterId)
    if (!chapter) return

    const newLesson: Lesson = {
      id: crypto.randomUUID(),
      title: `${chapter.lessons.length + 1}회차`,
      videoId: '',
      note: '',
    }
    setFormData(prev => ({
      ...prev,
      chapters: prev.chapters.map(ch =>
        ch.id === chapterId
          ? { ...ch, lessons: [...ch.lessons, newLesson] }
          : ch
      ),
    }))
  }

  // 레슨 삭제
  const removeLesson = (chapterId: string, lessonId: string) => {
    setFormData(prev => ({
      ...prev,
      chapters: prev.chapters.map(ch =>
        ch.id === chapterId
          ? { ...ch, lessons: ch.lessons.filter(l => l.id !== lessonId) }
          : ch
      ),
    }))
  }

  // 레슨 업데이트
  const updateLesson = (chapterId: string, lessonId: string, field: keyof Lesson, value: string) => {
    setFormData(prev => ({
      ...prev,
      chapters: prev.chapters.map(ch =>
        ch.id === chapterId
          ? {
              ...ch,
              lessons: ch.lessons.map(l =>
                l.id === lessonId ? { ...l, [field]: value } : l
              ),
            }
          : ch
      ),
    }))
  }

  // 레슨 순서 변경
  const moveLesson = (chapterId: string, index: number, direction: 'up' | 'down') => {
    const chapter = formData.chapters.find(ch => ch.id === chapterId)
    if (!chapter) return

    const newLessons = [...chapter.lessons]
    const targetIndex = direction === 'up' ? index - 1 : index + 1

    if (targetIndex < 0 || targetIndex >= newLessons.length) return

    [newLessons[index], newLessons[targetIndex]] = [newLessons[targetIndex], newLessons[index]]
    setFormData(prev => ({
      ...prev,
      chapters: prev.chapters.map(ch =>
        ch.id === chapterId ? { ...ch, lessons: newLessons } : ch
      ),
    }))
  }

  // 단계별 유효성 검사
  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        return formData.title.trim() !== '' &&
               formData.category !== '' &&
               formData.level !== '' &&
               formData.selectedTags.length >= 1 &&
               formData.selectedTags.length <= 5
      case 2:
        return formData.chapters.length > 0 && formData.chapters.every(ch =>
          ch.title.trim() !== '' && ch.lessons.length > 0 && ch.lessons.every(l => l.title.trim() !== '')
        )
      case 3:
        return formData.description.trim() !== ''
      case 4:
        return true // 썸네일은 선택사항
      case 5:
        return formData.price >= 0
      default:
        return false
    }
  }

  // 임시 저장 유효성 (최소한의 정보만 필요)
  const canSaveDraft = (): boolean => {
    return formData.title.trim() !== ''
  }

  // 다음 단계
  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, 5))
    } else {
      alert('필수 항목을 모두 입력해주세요.')
    }
  }

  // 이전 단계
  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1))
  }

  // 강의 저장 (임시저장 또는 발행)
  const saveCourse = async (isPublish: boolean) => {
    if (isPublish && !validateStep(5)) {
      alert('필수 항목을 모두 입력해주세요.')
      return
    }

    if (!isPublish && !canSaveDraft()) {
      alert('강의 제목을 입력해주세요.')
      return
    }

    if (!userId) {
      alert('로그인이 필요합니다.')
      return
    }

    if (isPublish) {
      setIsSubmitting(true)
    } else {
      setIsSaving(true)
    }

    try {
      // 1. courses 테이블에 강의 저장
      const { data: course, error: courseError } = await supabase
        .from('courses')
        .insert({
          title: formData.title,
          category: formData.category || '기타',
          level: formData.level || '입문',
          description: formData.description || '',
          thumbnail: formData.thumbnail || null,
          price: formData.price,
          instructor: userId,
          published: isPublish, // 발행 여부
        })
        .select('id')
        .single()

      if (courseError) {
        throw courseError
      }

      // 2. 챕터와 레슨 저장
      for (let chapterIndex = 0; chapterIndex < formData.chapters.length; chapterIndex++) {
        const chapter = formData.chapters[chapterIndex]

        // 챕터 저장
        const { data: savedChapter, error: chapterError } = await supabase
          .from('chapters')
          .insert({
            course_id: course.id,
            title: chapter.title,
            order_index: chapterIndex,
          })
          .select('id')
          .single()

        if (chapterError) {
          throw chapterError
        }

        // 레슨 저장
        if (chapter.lessons.length > 0) {
          const lessonsData = chapter.lessons.map((lesson, lessonIndex) => ({
            course_id: course.id,
            chapter_id: savedChapter.id,
            title: lesson.title,
            video_url: lesson.videoId || null,
            note: lesson.note || null,
            order_index: lessonIndex,
          }))

          const { error: lessonsError } = await supabase
            .from('lessons')
            .insert(lessonsData)

          if (lessonsError) {
            throw lessonsError
          }
        }
      }

      // 3. 태그 저장
      if (formData.selectedTags.length > 0) {
        const tagsData = formData.selectedTags.map(tagId => ({
          course_id: course.id,
          tag_id: tagId,
        }))

        const { error: tagsError } = await supabase
          .from('course_tags')
          .insert(tagsData)

        if (tagsError) {
          throw tagsError
        }
      }

      if (isPublish) {
        alert('강의가 성공적으로 발행되었습니다!')
        router.push('/instructor/courses')
      } else {
        alert('강의가 저장되었습니다. 편집 페이지에서 계속 작성하실 수 있습니다.')
        router.push(`/instructor/courses/${course.id}`)
      }
    } catch (error) {
      console.error('강의 저장 오류:', error)
      alert('강의 저장 중 오류가 발생했습니다.')
    } finally {
      setIsSubmitting(false)
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-orange-500 border-t-transparent"></div>
      </div>
    )
  }

  return (
    <div className="p-6 lg:p-8 pb-16">
      <div className="mx-auto max-w-3xl">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link
              href="/instructor/courses"
              className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-orange-500 mb-4"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              강의 관리로 돌아가기
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">새 강의 만들기</h1>
          </div>

          {/* 저장 버튼 */}
          <button
            onClick={() => saveCourse(false)}
            disabled={isSaving || !canSaveDraft()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-orange-500 border-t-transparent"></div>
                저장 중...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
                저장
              </>
            )}
          </button>
        </div>

        {/* Progress Bar */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-2">
            {STEPS.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <button
                  onClick={() => setCurrentStep(step.id)}
                  className={`flex items-center justify-center w-10 h-10 rounded-full text-sm font-bold transition-colors ${
                    currentStep >= step.id
                      ? 'bg-gradient-to-r from-orange-500 to-yellow-500 text-white'
                      : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {currentStep > step.id ? (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    step.id
                  )}
                </button>
                {index < STEPS.length - 1 && (
                  <div
                    className={`w-12 sm:w-20 h-1 mx-1 transition-colors ${
                      currentStep > step.id ? 'bg-orange-500' : 'bg-gray-200'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-gray-900">{STEPS[currentStep - 1].title}</p>
            <p className="text-xs text-gray-500">{STEPS[currentStep - 1].description}</p>
          </div>
        </div>

        {/* Form Content */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-6">
          {/* Step 1: 기본 정보 */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  강의 제목 *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="예: 초보자를 위한 SNS 마케팅 마스터 클래스"
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 focus:border-orange-300 focus:ring focus:ring-orange-200 focus:ring-opacity-50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  카테고리 *
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 focus:border-orange-300 focus:ring focus:ring-orange-200 focus:ring-opacity-50"
                >
                  <option value="">카테고리를 선택하세요</option>
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  난이도 *
                </label>
                <div className="flex gap-3">
                  {LEVELS.map(level => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, level }))}
                      className={`flex-1 py-3 rounded-xl border-2 font-medium transition-colors ${
                        formData.level === level
                          ? 'border-orange-500 bg-orange-50 text-orange-700'
                          : 'border-gray-200 text-gray-600 hover:border-orange-200'
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>

              {/* 태그 선택 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  강의 태그 * <span className="text-gray-400 font-normal">(1~5개 선택)</span>
                </label>
                <p className="text-xs text-gray-500 mb-3">
                  수강생이 강의를 쉽게 찾을 수 있도록 관련 태그를 선택해주세요.
                </p>
                <TagSelector
                  selectedTags={formData.selectedTags}
                  onTagsChange={(tags) => setFormData(prev => ({ ...prev, selectedTags: tags }))}
                  minTags={1}
                  maxTags={5}
                />
              </div>
            </div>
          )}

          {/* Step 2: 커리큘럼 (챕터 + 레슨) */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-gray-900">강의 커리큘럼</h3>
                  <p className="text-sm text-gray-500">{formData.chapters.length}개 챕터 · {totalLessons}개 회차</p>
                </div>
                <button
                  type="button"
                  onClick={addChapter}
                  className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-orange-500 to-yellow-500 px-4 py-2 text-sm font-medium text-white hover:shadow-lg transition-shadow"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  챕터 추가
                </button>
              </div>

              {formData.chapters.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl">
                  <div className="text-4xl mb-3">📚</div>
                  <p className="text-gray-500 mb-4">아직 추가된 챕터가 없습니다</p>
                  <button
                    type="button"
                    onClick={addChapter}
                    className="text-orange-500 font-medium hover:text-orange-600"
                  >
                    첫 번째 챕터 추가하기
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {formData.chapters.map((chapter, chapterIndex) => (
                    <div
                      key={chapter.id}
                      className="border border-gray-200 rounded-xl overflow-hidden"
                    >
                      {/* 챕터 헤더 */}
                      <div
                        className="flex items-center gap-3 p-4 bg-gradient-to-r from-orange-50 to-yellow-50 cursor-pointer"
                        onClick={() => setExpandedChapter(expandedChapter === chapter.id ? null : chapter.id)}
                      >
                        <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-r from-orange-500 to-yellow-500 text-white text-sm font-bold flex-shrink-0">
                          {chapterIndex + 1}
                        </span>
                        <input
                          type="text"
                          value={chapter.title}
                          onChange={(e) => updateChapterTitle(chapter.id, e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          className="flex-grow font-semibold bg-transparent border-0 focus:ring-0 p-0 text-gray-900"
                          placeholder="챕터 제목"
                        />
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <span className="px-2 py-1 bg-white/60 text-gray-600 rounded text-xs">
                            {chapter.lessons.length}개 회차
                          </span>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); moveChapter(chapterIndex, 'up'); }}
                            disabled={chapterIndex === 0}
                            className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); moveChapter(chapterIndex, 'down'); }}
                            disabled={chapterIndex === formData.chapters.length - 1}
                            className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); removeChapter(chapter.id); }}
                            className="p-1 text-gray-400 hover:text-red-500"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                          <svg
                            className={`w-5 h-5 text-gray-400 transition-transform ${expandedChapter === chapter.id ? 'rotate-180' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </div>

                      {/* 챕터 내용 (확장) */}
                      {expandedChapter === chapter.id && (
                        <div className="p-4 bg-white border-t border-gray-100">
                          {chapter.lessons.length === 0 ? (
                            <div className="text-center py-6 border-2 border-dashed border-gray-200 rounded-lg">
                              <p className="text-gray-500 mb-3 text-sm">아직 회차가 없습니다</p>
                              <button
                                type="button"
                                onClick={() => addLesson(chapter.id)}
                                className="inline-flex items-center gap-1 text-orange-500 font-medium hover:text-orange-600 text-sm"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                회차 추가하기
                              </button>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {chapter.lessons.map((lesson, lessonIndex) => (
                                <div
                                  key={lesson.id}
                                  className="border border-gray-200 rounded-lg p-4"
                                >
                                  <div className="flex items-center justify-between mb-3">
                                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-orange-100 text-orange-600 text-xs font-bold">
                                      {lessonIndex + 1}
                                    </span>
                                    <div className="flex items-center gap-1">
                                      <button
                                        type="button"
                                        onClick={() => moveLesson(chapter.id, lessonIndex, 'up')}
                                        disabled={lessonIndex === 0}
                                        className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                                      >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                        </svg>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => moveLesson(chapter.id, lessonIndex, 'down')}
                                        disabled={lessonIndex === chapter.lessons.length - 1}
                                        className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                                      >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => removeLesson(chapter.id, lesson.id)}
                                        className="p-1 text-red-400 hover:text-red-600"
                                      >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                      </button>
                                    </div>
                                  </div>

                                  <div className="space-y-3">
                                    <input
                                      type="text"
                                      value={lesson.title}
                                      onChange={(e) => updateLesson(chapter.id, lesson.id, 'title', e.target.value)}
                                      placeholder="회차 제목 *"
                                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-orange-300 focus:ring focus:ring-orange-200 focus:ring-opacity-50"
                                    />

                                    {/* 영상 업로드 */}
                                    <div>
                                      <label className="block text-xs text-gray-500 mb-1">강의 영상</label>
                                      {lesson.videoId ? (
                                        <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                                          <div className="flex items-center gap-2">
                                            <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                            <span className="text-sm text-green-700">영상 업로드 완료</span>
                                            <span className="text-xs text-green-600 font-mono">{lesson.videoId.substring(0, 8)}...</span>
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() => updateLesson(chapter.id, lesson.id, 'videoId', '')}
                                            className="text-xs text-gray-500 hover:text-red-500"
                                          >
                                            삭제
                                          </button>
                                        </div>
                                      ) : (
                                        <VideoUploader
                                          onUploadComplete={(videoId) => updateLesson(chapter.id, lesson.id, 'videoId', videoId)}
                                          onUploadError={(error) => console.error('Upload error:', error)}
                                        />
                                      )}
                                    </div>

                                    <textarea
                                      value={lesson.note}
                                      onChange={(e) => updateLesson(chapter.id, lesson.id, 'note', e.target.value)}
                                      placeholder="강의 노트 (선택)"
                                      rows={2}
                                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-orange-300 focus:ring focus:ring-orange-200 focus:ring-opacity-50 resize-none"
                                    />
                                  </div>
                                </div>
                              ))}

                              {/* 회차 추가 버튼 */}
                              <button
                                type="button"
                                onClick={() => addLesson(chapter.id)}
                                className="w-full py-2 border-2 border-dashed border-gray-200 rounded-lg text-gray-500 text-sm font-medium hover:border-orange-300 hover:text-orange-500 transition-colors"
                              >
                                + 회차 추가
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 3: 상세 소개 */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  강의 상세 소개 *
                </label>
                <p className="text-xs text-gray-500 mb-3">
                  강의 내용, 대상, 학습 목표 등을 자세히 작성해주세요.
                </p>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder={`이 강의에서는...

- 학습 목표
- 대상 수강생
- 강의 특징
- 수강 후 얻을 수 있는 것`}
                  rows={12}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 focus:border-orange-300 focus:ring focus:ring-orange-200 focus:ring-opacity-50 resize-none"
                />
              </div>
            </div>
          )}

          {/* Step 4: 썸네일 */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  썸네일 이미지
                </label>
                <p className="text-xs text-gray-500 mb-3">
                  강의를 대표하는 이미지를 업로드해주세요. (선택사항)
                </p>
                <ThumbnailUploader
                  value={formData.thumbnail}
                  onChange={(url) => setFormData(prev => ({ ...prev, thumbnail: url }))}
                />
              </div>
            </div>
          )}

          {/* Step 5: 가격 설정 */}
          {currentStep === 5 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  판매 가격 *
                </label>
                <p className="text-xs text-gray-500 mb-3">
                  무료 강의는 0원으로 설정해주세요.
                </p>
                <div className="relative">
                  <input
                    type="number"
                    value={formData.price}
                    onChange={(e) => setFormData(prev => ({ ...prev, price: parseInt(e.target.value) || 0 }))}
                    min="0"
                    step="1000"
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 pr-12 focus:border-orange-300 focus:ring focus:ring-orange-200 focus:ring-opacity-50"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500">원</span>
                </div>
              </div>

              {/* 발행 전 요약 */}
              <div className="bg-gray-50 rounded-xl p-6 mt-8">
                <h3 className="font-medium text-gray-900 mb-4">발행 전 확인</h3>
                <dl className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-gray-500">강의 제목</dt>
                    <dd className="text-gray-900 font-medium">{formData.title || '-'}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">카테고리</dt>
                    <dd className="text-gray-900">{formData.category || '-'}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">난이도</dt>
                    <dd className="text-gray-900">{formData.level || '-'}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">챕터 수</dt>
                    <dd className="text-gray-900">{formData.chapters.length}개</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">회차 수</dt>
                    <dd className="text-gray-900">{totalLessons}개</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">태그</dt>
                    <dd className="text-gray-900">{formData.selectedTags.length}개 선택됨</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">가격</dt>
                    <dd className="text-orange-600 font-bold">
                      {formData.price === 0 ? '무료' : `${formData.price.toLocaleString()}원`}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          )}
        </div>

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={prevStep}
            disabled={currentStep === 1}
            className="inline-flex items-center gap-2 px-6 py-3 text-gray-600 font-medium hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            이전
          </button>

          {currentStep < 5 ? (
            <button
              type="button"
              onClick={nextStep}
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-orange-500 to-yellow-500 px-8 py-3 text-white font-medium hover:shadow-lg transition-shadow"
            >
              다음
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => saveCourse(true)}
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-orange-500 to-yellow-500 px-8 py-3 text-white font-medium hover:shadow-lg transition-shadow disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                  발행 중...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  발행하기
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

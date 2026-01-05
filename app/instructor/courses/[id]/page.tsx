'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import VideoUploader from '@/components/VideoUploader'
import DeleteConfirmModal from '@/components/DeleteConfirmModal'
import TagSelector from '@/components/TagSelector'
import ThumbnailUploader from '@/components/ThumbnailUploader'

interface Chapter {
  id: string
  title: string
  order_index: number
  lessons: Lesson[]
}

interface Lesson {
  id: string
  chapter_id: string
  title: string
  video_url: string | null
  note: string | null
  order_index: number
  is_preview: boolean
}

interface Course {
  id: string
  title: string
  description: string
  category: string
  level: string
  price: number
  thumbnail: string | null
  created_at: string
  instructor: string
  published: boolean
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

const CATEGORIES = ['메이크업', '스킨케어', '헤어', '네일', '퍼스널 컬러', '뷰티 창업', '기타']
const LEVELS = ['입문', '중급', '고급']

export default function CourseDetailPage() {
  const router = useRouter()
  const params = useParams()
  const courseId = params.id as string

  const [isLoading, setIsLoading] = useState(true)
  const [course, setCourse] = useState<Course | null>(null)
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [expandedChapter, setExpandedChapter] = useState<string | null>(null)
  const [expandedLesson, setExpandedLesson] = useState<string | null>(null)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [selectedTags, setSelectedTags] = useState<string[]>([])

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [isSavingAll, setIsSavingAll] = useState(false)
  const [isPublishing, setIsPublishing] = useState(false)

  // 총 레슨 수 계산
  const totalLessons = chapters.reduce((sum, ch) => sum + ch.lessons.length, 0)
  const totalVideos = chapters.reduce((sum, ch) => sum + ch.lessons.filter(l => l.video_url).length, 0)

  // 데이터 로드
  useEffect(() => {
    const loadCourse = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      // 강의 정보
      const { data: courseData, error: courseError } = await supabase
        .from('courses')
        .select('*')
        .eq('id', courseId)
        .single()

      if (courseError || !courseData) {
        router.push('/instructor/courses')
        return
      }

      // 본인 강의인지 확인
      if (courseData.instructor !== user.id) {
        router.push('/instructor/courses')
        return
      }

      setCourse(courseData)

      // 챕터 정보
      const { data: chaptersData } = await supabase
        .from('chapters')
        .select('*')
        .eq('course_id', courseId)
        .order('order_index', { ascending: true })

      // 레슨 정보
      const { data: lessonsData } = await supabase
        .from('lessons')
        .select('*')
        .eq('course_id', courseId)
        .order('order_index', { ascending: true })

      // 챕터와 레슨 매핑
      const chaptersWithLessons: Chapter[] = (chaptersData || []).map(chapter => ({
        ...chapter,
        lessons: (lessonsData || []).filter(lesson => lesson.chapter_id === chapter.id)
      }))

      setChapters(chaptersWithLessons)

      // 첫 번째 챕터 자동 확장
      if (chaptersWithLessons.length > 0) {
        setExpandedChapter(chaptersWithLessons[0].id)
      }

      // 태그 정보 로드
      const { data: tagsData } = await supabase
        .from('course_tags')
        .select('tag_id')
        .eq('course_id', courseId)

      if (tagsData) {
        setSelectedTags(tagsData.map(t => t.tag_id))
      }

      setIsLoading(false)
    }

    loadCourse()
  }, [courseId, router])

  // 자동 저장 (디바운스)
  const autoSave = useCallback(async (field: keyof Course, value: string | number) => {
    if (!course) return

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    setSaveStatus('saving')

    saveTimeoutRef.current = setTimeout(async () => {
      const { error } = await supabase
        .from('courses')
        .update({ [field]: value })
        .eq('id', courseId)

      if (error) {
        console.error('저장 오류:', error)
        setSaveStatus('error')
      } else {
        setSaveStatus('saved')
        setTimeout(() => setSaveStatus('idle'), 2000)
      }
    }, 800)
  }, [course, courseId])

  // 필드 업데이트
  const updateField = (field: keyof Course, value: string | number) => {
    if (!course) return
    setCourse({ ...course, [field]: value })
    autoSave(field, value)
  }

  // 전체 저장
  const saveAll = async () => {
    if (!course) return

    setIsSavingAll(true)
    setSaveStatus('saving')

    try {
      // 1. 강의 정보 저장
      const { error: courseError } = await supabase
        .from('courses')
        .update({
          title: course.title,
          description: course.description,
          category: course.category,
          level: course.level,
          price: course.price,
          thumbnail: course.thumbnail,
        })
        .eq('id', courseId)

      if (courseError) throw courseError

      // 2. 모든 챕터 저장
      for (const chapter of chapters) {
        const { error: chapterError } = await supabase
          .from('chapters')
          .update({
            title: chapter.title,
            order_index: chapter.order_index,
          })
          .eq('id', chapter.id)

        if (chapterError) throw chapterError

        // 3. 각 챕터의 레슨 저장
        for (const lesson of chapter.lessons) {
          const { error: lessonError } = await supabase
            .from('lessons')
            .update({
              title: lesson.title,
              video_url: lesson.video_url,
              note: lesson.note,
              order_index: lesson.order_index,
            })
            .eq('id', lesson.id)

          if (lessonError) throw lessonError
        }
      }

      // 4. 태그 저장 (기존 태그 삭제 후 새로 저장)
      await supabase
        .from('course_tags')
        .delete()
        .eq('course_id', courseId)

      if (selectedTags.length > 0) {
        const tagsData = selectedTags.map(tagId => ({
          course_id: courseId,
          tag_id: tagId,
        }))

        const { error: tagsError } = await supabase
          .from('course_tags')
          .insert(tagsData)

        if (tagsError) throw tagsError
      }

      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
    } catch (error) {
      console.error('전체 저장 오류:', error)
      setSaveStatus('error')
    } finally {
      setIsSavingAll(false)
    }
  }

  // 발행/발행 취소
  const togglePublish = async () => {
    if (!course) return

    // 발행하려면 최소 조건 확인
    if (!course.published) {
      if (!course.title.trim()) {
        alert('강의 제목을 입력해주세요.')
        return
      }
      if (!course.description.trim()) {
        alert('강의 설명을 입력해주세요.')
        return
      }
      if (chapters.length === 0) {
        alert('최소 1개의 챕터가 필요합니다.')
        return
      }
      if (totalLessons === 0) {
        alert('최소 1개의 회차가 필요합니다.')
        return
      }
      if (selectedTags.length === 0) {
        alert('최소 1개의 태그를 선택해주세요.')
        return
      }
    }

    const action = course.published ? '발행 취소' : '발행'
    if (!confirm(`강의를 ${action}하시겠습니까?${course.published ? '\n\n발행 취소 시 수강생에게 강의가 보이지 않습니다.' : ''}`)) {
      return
    }

    setIsPublishing(true)

    try {
      // 먼저 전체 저장
      await saveAll()

      // 발행 상태 변경
      const { error } = await supabase
        .from('courses')
        .update({ published: !course.published })
        .eq('id', courseId)

      if (error) throw error

      setCourse({ ...course, published: !course.published })
      alert(course.published ? '발행이 취소되었습니다.' : '강의가 발행되었습니다!')
    } catch (error) {
      console.error('발행 상태 변경 오류:', error)
      alert('발행 상태 변경 중 오류가 발생했습니다.')
    } finally {
      setIsPublishing(false)
    }
  }

  // === 챕터 관련 함수 ===

  // 챕터 추가
  const addChapter = async () => {
    const newOrderIndex = chapters.length

    const { data, error } = await supabase
      .from('chapters')
      .insert({
        course_id: courseId,
        title: `챕터 ${chapters.length + 1}`,
        order_index: newOrderIndex,
      })
      .select()
      .single()

    if (!error && data) {
      setChapters([...chapters, { ...data, lessons: [] }])
      setExpandedChapter(data.id)
    }
  }

  // 챕터 제목 업데이트
  const updateChapterTitle = async (chapterId: string, title: string) => {
    setChapters(prev => prev.map(ch =>
      ch.id === chapterId ? { ...ch, title } : ch
    ))
  }

  // 챕터 저장
  const saveChapter = async (chapterId: string) => {
    const chapter = chapters.find(ch => ch.id === chapterId)
    if (!chapter) return

    setSaveStatus('saving')
    const { error } = await supabase
      .from('chapters')
      .update({ title: chapter.title })
      .eq('id', chapterId)

    if (error) {
      console.error('챕터 저장 오류:', error)
      setSaveStatus('error')
    } else {
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
    }
  }

  // 챕터 삭제
  const deleteChapter = async (chapterId: string) => {
    const chapter = chapters.find(ch => ch.id === chapterId)
    if (!chapter) return

    const lessonCount = chapter.lessons.length
    const videoCount = chapter.lessons.filter(l => l.video_url).length

    let message = '이 챕터를 삭제하시겠습니까?'
    if (lessonCount > 0) {
      message = `이 챕터와 포함된 ${lessonCount}개 회차를 삭제하시겠습니까?`
      if (videoCount > 0) {
        message += ` (영상 ${videoCount}개 포함)`
      }
    }

    if (!confirm(message)) return

    // 영상이 있으면 Cloudflare에서도 삭제
    const videoIds = chapter.lessons
      .filter(l => l.video_url)
      .map(l => l.video_url as string)

    if (videoIds.length > 0) {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.access_token) {
          await fetch('/api/video/delete', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ videoIds }),
          })
        }
      } catch (error) {
        console.error('영상 삭제 오류:', error)
      }
    }

    const { error } = await supabase
      .from('chapters')
      .delete()
      .eq('id', chapterId)

    if (!error) {
      setChapters(prev => prev.filter(ch => ch.id !== chapterId))
    }
  }

  // 챕터 순서 변경
  const moveChapter = async (index: number, direction: 'up' | 'down') => {
    const newChapters = [...chapters]
    const targetIndex = direction === 'up' ? index - 1 : index + 1

    if (targetIndex < 0 || targetIndex >= newChapters.length) return

    [newChapters[index], newChapters[targetIndex]] = [newChapters[targetIndex], newChapters[index]]

    newChapters.forEach((chapter, idx) => {
      chapter.order_index = idx
    })

    setChapters(newChapters)

    for (const chapter of newChapters) {
      await supabase
        .from('chapters')
        .update({ order_index: chapter.order_index })
        .eq('id', chapter.id)
    }
  }

  // === 레슨 관련 함수 ===

  // 레슨 추가
  const addLesson = async (chapterId: string) => {
    const chapter = chapters.find(ch => ch.id === chapterId)
    if (!chapter) return

    const newOrderIndex = chapter.lessons.length

    const { data, error } = await supabase
      .from('lessons')
      .insert({
        course_id: courseId,
        chapter_id: chapterId,
        title: `${chapter.lessons.length + 1}회차`,
        video_url: null,
        note: null,
        order_index: newOrderIndex,
        is_preview: false,
      })
      .select()
      .single()

    if (!error && data) {
      setChapters(prev => prev.map(ch =>
        ch.id === chapterId
          ? { ...ch, lessons: [...ch.lessons, data] }
          : ch
      ))
      setExpandedLesson(data.id)
    }
  }

  // 레슨 업데이트
  const updateLesson = (chapterId: string, lessonId: string, field: keyof Lesson, value: string | null | boolean) => {
    setChapters(prev => prev.map(ch =>
      ch.id === chapterId
        ? {
            ...ch,
            lessons: ch.lessons.map(l =>
              l.id === lessonId ? { ...l, [field]: value } : l
            )
          }
        : ch
    ))
  }

  // 레슨 저장
  const saveLesson = async (lesson: Lesson) => {
    setSaveStatus('saving')
    const { error } = await supabase
      .from('lessons')
      .update({
        title: lesson.title,
        video_url: lesson.video_url,
        note: lesson.note,
        is_preview: lesson.is_preview,
      })
      .eq('id', lesson.id)

    if (error) {
      console.error('레슨 저장 오류:', error)
      setSaveStatus('error')
    } else {
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
    }
  }

  // 레슨 영상 삭제
  const deleteLessonVideo = async (chapterId: string, lessonId: string, videoId: string) => {
    if (!confirm('이 영상을 삭제하시겠습니까?')) return

    setSaveStatus('saving')

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('로그인이 필요합니다.')
      }

      await fetch('/api/video/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ videoId }),
      })

      const chapter = chapters.find(ch => ch.id === chapterId)
      const lesson = chapter?.lessons.find(l => l.id === lessonId)
      if (lesson) {
        updateLesson(chapterId, lessonId, 'video_url', null)
        await saveLesson({ ...lesson, video_url: null })
      }
    } catch (error) {
      console.error('영상 삭제 오류:', error)
      setSaveStatus('error')
    }
  }

  // 레슨 삭제
  const deleteLesson = async (chapterId: string, lessonId: string) => {
    const chapter = chapters.find(ch => ch.id === chapterId)
    const lesson = chapter?.lessons.find(l => l.id === lessonId)

    if (!lesson) return

    // 영상이 있으면 Cloudflare에서도 삭제
    if (lesson.video_url) {
      if (!confirm('이 회차를 삭제하시겠습니까? (영상도 함께 삭제됩니다)')) return

      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.access_token) {
          await fetch('/api/video/delete', {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ videoId: lesson.video_url }),
          })
        }
      } catch (error) {
        console.error('영상 삭제 오류:', error)
      }
    } else {
      if (!confirm('이 회차를 삭제하시겠습니까?')) return
    }

    const { error } = await supabase
      .from('lessons')
      .delete()
      .eq('id', lessonId)

    if (!error) {
      setChapters(prev => prev.map(ch =>
        ch.id === chapterId
          ? { ...ch, lessons: ch.lessons.filter(l => l.id !== lessonId) }
          : ch
      ))
    }
  }

  // 레슨 순서 변경
  const moveLesson = async (chapterId: string, index: number, direction: 'up' | 'down') => {
    const chapter = chapters.find(ch => ch.id === chapterId)
    if (!chapter) return

    const newLessons = [...chapter.lessons]
    const targetIndex = direction === 'up' ? index - 1 : index + 1

    if (targetIndex < 0 || targetIndex >= newLessons.length) return

    [newLessons[index], newLessons[targetIndex]] = [newLessons[targetIndex], newLessons[index]]

    newLessons.forEach((lesson, idx) => {
      lesson.order_index = idx
    })

    setChapters(prev => prev.map(ch =>
      ch.id === chapterId ? { ...ch, lessons: newLessons } : ch
    ))

    for (const lesson of newLessons) {
      await supabase
        .from('lessons')
        .update({ order_index: lesson.order_index })
        .eq('id', lesson.id)
    }
  }

  // 강의 삭제
  const deleteCourse = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) {
      throw new Error('로그인이 필요합니다.')
    }

    // 모든 챕터의 영상 수집
    const videoIds = chapters.flatMap(ch =>
      ch.lessons.filter(l => l.video_url).map(l => l.video_url as string)
    )

    if (videoIds.length > 0) {
      const deleteResponse = await fetch('/api/video/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ videoIds }),
      })

      if (!deleteResponse.ok) {
        const error = await deleteResponse.json()
        throw new Error(error.error || 'Cloudflare 영상 삭제에 실패했습니다.')
      }
    }

    // 챕터 삭제 (CASCADE로 레슨도 삭제됨)
    await supabase
      .from('chapters')
      .delete()
      .eq('course_id', courseId)

    // 강의 삭제
    const { error: courseError } = await supabase
      .from('courses')
      .delete()
      .eq('id', courseId)

    if (courseError) {
      throw new Error('강의 삭제에 실패했습니다.')
    }

    router.push('/instructor/courses')
  }

  if (isLoading || !course) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-orange-500 border-t-transparent"></div>
      </div>
    )
  }

  return (
    <div className="p-6 lg:p-8 pb-16">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link
            href="/instructor/courses"
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl lg:text-2xl font-bold text-gray-900">강의 편집</h1>
              {course.published ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                  발행됨
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">
                  <span className="w-1.5 h-1.5 bg-yellow-500 rounded-full"></span>
                  미발행
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500">변경사항은 자동으로 저장됩니다</p>
          </div>
        </div>

        {/* 저장 상태 표시 */}
        <div className="flex items-center gap-3">
          {saveStatus === 'saving' && (
            <span className="flex items-center gap-2 text-sm text-gray-500">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-orange-500 border-t-transparent"></div>
              저장 중...
            </span>
          )}
          {saveStatus === 'saved' && (
            <span className="flex items-center gap-2 text-sm text-green-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              저장됨
            </span>
          )}
          {saveStatus === 'error' && (
            <span className="text-sm text-red-500">저장 실패</span>
          )}

          <button
            onClick={saveAll}
            disabled={isSavingAll}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-all disabled:opacity-50"
          >
            {isSavingAll ? (
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

          <button
            onClick={togglePublish}
            disabled={isPublishing}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all disabled:opacity-50 ${
              course.published
                ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                : 'bg-gradient-to-r from-orange-500 to-yellow-500 text-white hover:shadow-lg'
            }`}
          >
            {isPublishing ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"></div>
                처리 중...
              </>
            ) : course.published ? (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
                발행 취소
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

          <button
            onClick={() => setIsDeleteModalOpen(true)}
            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            title="강의 삭제"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* 삭제 확인 모달 */}
      <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={deleteCourse}
        title="강의 삭제"
        message={`이 강의를 삭제하시겠습니까?\n\n삭제 시 다음 항목이 함께 삭제됩니다:\n- 모든 챕터 (${chapters.length}개)\n- 모든 회차 (${totalLessons}개)\n- 업로드된 영상 (${totalVideos}개)\n\n이 작업은 되돌릴 수 없습니다.`}
        confirmText="강의 삭제"
        itemName={course.title}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 왼쪽: 기본 정보 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 제목 */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">강의 제목</label>
            <input
              type="text"
              value={course.title}
              onChange={(e) => updateField('title', e.target.value)}
              className="w-full text-xl font-bold border-0 border-b-2 border-gray-200 focus:border-orange-500 focus:ring-0 pb-2 bg-transparent"
              placeholder="강의 제목을 입력하세요"
            />
          </div>

          {/* 설명 */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">강의 설명</label>
            <textarea
              value={course.description}
              onChange={(e) => updateField('description', e.target.value)}
              rows={6}
              className="w-full border-0 border-b-2 border-gray-200 focus:border-orange-500 focus:ring-0 resize-none bg-transparent"
              placeholder="강의 내용을 자세히 설명해주세요"
            />
          </div>

          {/* 커리큘럼 */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900">커리큘럼</h2>
                <p className="text-sm text-gray-500">{chapters.length}개 챕터 · {totalLessons}개 회차</p>
              </div>
              <button
                onClick={addChapter}
                className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-full text-sm font-medium hover:bg-orange-600 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                챕터 추가
              </button>
            </div>

            {chapters.length === 0 ? (
              <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-xl">
                <p className="text-gray-500 mb-4">아직 챕터가 없습니다</p>
                <button
                  onClick={addChapter}
                  className="text-orange-500 font-medium hover:text-orange-600"
                >
                  첫 번째 챕터 추가하기
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {chapters.map((chapter, chapterIndex) => (
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
                        onBlur={() => saveChapter(chapter.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="flex-grow font-semibold bg-transparent border-0 focus:ring-0 p-0 text-gray-900"
                        placeholder="챕터 제목"
                      />
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <span className="px-2 py-1 bg-white/60 text-gray-600 rounded text-xs">
                          {chapter.lessons.length}개 회차
                        </span>
                        <button
                          onClick={(e) => { e.stopPropagation(); moveChapter(chapterIndex, 'up'); }}
                          disabled={chapterIndex === 0}
                          className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); moveChapter(chapterIndex, 'down'); }}
                          disabled={chapterIndex === chapters.length - 1}
                          className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteChapter(chapter.id); }}
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
                          <div className="space-y-2">
                            {chapter.lessons.map((lesson, lessonIndex) => (
                              <div
                                key={lesson.id}
                                className="border border-gray-200 rounded-lg overflow-hidden"
                              >
                                {/* 레슨 헤더 */}
                                <div
                                  className="flex items-center gap-3 p-3 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                                  onClick={() => setExpandedLesson(expandedLesson === lesson.id ? null : lesson.id)}
                                >
                                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-orange-100 text-orange-600 text-xs font-bold flex-shrink-0">
                                    {lessonIndex + 1}
                                  </span>
                                  <input
                                    type="text"
                                    value={lesson.title}
                                    onChange={(e) => updateLesson(chapter.id, lesson.id, 'title', e.target.value)}
                                    onBlur={() => saveLesson(lesson)}
                                    onClick={(e) => e.stopPropagation()}
                                    className="flex-grow text-sm font-medium bg-transparent border-0 focus:ring-0 p-0"
                                    placeholder="회차 제목"
                                  />
                                  <div className="flex items-center gap-1 flex-shrink-0">
                                    {lesson.is_preview && (
                                      <span className="px-2 py-0.5 bg-yellow-100 text-yellow-600 rounded text-xs font-medium">
                                        미리보기
                                      </span>
                                    )}
                                    {lesson.video_url && (
                                      <span className="px-2 py-0.5 bg-green-100 text-green-600 rounded text-xs font-medium">
                                        영상
                                      </span>
                                    )}
                                    <button
                                      onClick={(e) => { e.stopPropagation(); moveLesson(chapter.id, lessonIndex, 'up'); }}
                                      disabled={lessonIndex === 0}
                                      className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                                    >
                                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                      </svg>
                                    </button>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); moveLesson(chapter.id, lessonIndex, 'down'); }}
                                      disabled={lessonIndex === chapter.lessons.length - 1}
                                      className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                                    >
                                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                      </svg>
                                    </button>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); deleteLesson(chapter.id, lesson.id); }}
                                      className="p-1 text-gray-400 hover:text-red-500"
                                    >
                                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                      </svg>
                                    </button>
                                    <svg
                                      className={`w-4 h-4 text-gray-400 transition-transform ${expandedLesson === lesson.id ? 'rotate-180' : ''}`}
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                  </div>
                                </div>

                                {/* 레슨 상세 (확장) */}
                                {expandedLesson === lesson.id && (
                                  <div className="p-4 border-t border-gray-200 space-y-4">
                                    {/* 영상 업로드 */}
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-2">강의 영상</label>
                                      {lesson.video_url ? (
                                        <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                                          <div className="flex items-center gap-2">
                                            <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                            <span className="text-sm text-green-700">영상 업로드 완료</span>
                                            <span className="text-xs text-green-600 font-mono">{lesson.video_url.substring(0, 8)}...</span>
                                          </div>
                                          <button
                                            onClick={() => deleteLessonVideo(chapter.id, lesson.id, lesson.video_url!)}
                                            className="text-xs text-red-500 hover:text-red-600"
                                          >
                                            삭제
                                          </button>
                                        </div>
                                      ) : (
                                        <VideoUploader
                                          onUploadComplete={(videoId) => {
                                            updateLesson(chapter.id, lesson.id, 'video_url', videoId)
                                            saveLesson({ ...lesson, video_url: videoId })
                                          }}
                                        />
                                      )}
                                    </div>

                                    {/* 노트 */}
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-2">강의 노트</label>
                                      <textarea
                                        value={lesson.note || ''}
                                        onChange={(e) => updateLesson(chapter.id, lesson.id, 'note', e.target.value)}
                                        onBlur={() => saveLesson(lesson)}
                                        rows={3}
                                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-orange-300 focus:ring focus:ring-orange-200 focus:ring-opacity-50 resize-none"
                                        placeholder="수강생에게 전달할 노트나 자료 링크"
                                      />
                                    </div>

                                    {/* 미리보기 설정 */}
                                    <div className="flex items-center justify-between p-3 bg-yellow-50 border border-purple-200 rounded-lg">
                                      <div>
                                        <div className="flex items-center gap-2">
                                          <svg className="w-4 h-4 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                          </svg>
                                          <span className="text-sm font-medium text-purple-700">미리보기 공개</span>
                                        </div>
                                        <p className="text-xs text-yellow-600 mt-1">
                                          미리보기로 설정하면 결제 전에도 수강생이 볼 수 있습니다
                                        </p>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const newValue = !lesson.is_preview
                                          updateLesson(chapter.id, lesson.id, 'is_preview', newValue)
                                          saveLesson({ ...lesson, is_preview: newValue })
                                        }}
                                        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                          lesson.is_preview ? 'bg-yellow-500' : 'bg-gray-200'
                                        }`}
                                      >
                                        <span
                                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                            lesson.is_preview ? 'translate-x-5' : 'translate-x-0'
                                          }`}
                                        />
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}

                            {/* 회차 추가 버튼 */}
                            <button
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
        </div>

        {/* 오른쪽: 사이드바 */}
        <div className="space-y-6">
          {/* 썸네일 */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">썸네일</label>
            <ThumbnailUploader
              value={course.thumbnail || ''}
              onChange={(url) => updateField('thumbnail', url)}
            />
          </div>

          {/* 카테고리 & 난이도 */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">카테고리</label>
              <select
                value={course.category}
                onChange={(e) => updateField('category', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:border-orange-300 focus:ring focus:ring-orange-200 focus:ring-opacity-50"
              >
                {CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">난이도</label>
              <div className="flex gap-2">
                {LEVELS.map(level => (
                  <button
                    key={level}
                    onClick={() => updateField('level', level)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                      course.level === level
                        ? 'bg-orange-500 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 태그 */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              강의 태그 <span className="text-gray-400 font-normal">(1~5개)</span>
            </label>
            <TagSelector
              selectedTags={selectedTags}
              onTagsChange={setSelectedTags}
              minTags={1}
              maxTags={5}
            />
          </div>

          {/* 가격 */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">가격</label>
            <div className="relative">
              <input
                type="number"
                value={course.price}
                onChange={(e) => updateField('price', parseInt(e.target.value) || 0)}
                min="0"
                step="1000"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 pr-10 focus:border-orange-300 focus:ring focus:ring-orange-200 focus:ring-opacity-50"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">원</span>
            </div>
            {course.price === 0 && (
              <p className="mt-2 text-sm text-green-600">무료 강의로 설정됨</p>
            )}
          </div>

          {/* 강의 정보 */}
          <div className="bg-gray-50 rounded-2xl p-6">
            <h3 className="text-sm font-medium text-gray-700 mb-3">강의 정보</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">등록일</dt>
                <dd className="text-gray-900">{new Date(course.created_at).toLocaleDateString('ko-KR')}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">총 챕터</dt>
                <dd className="text-gray-900">{chapters.length}개</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">총 회차</dt>
                <dd className="text-gray-900">{totalLessons}개</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">영상 업로드</dt>
                <dd className="text-gray-900">{totalVideos}개</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">태그</dt>
                <dd className="text-gray-900">{selectedTags.length}개</dd>
              </div>
            </dl>
          </div>

          {/* 미리보기 버튼 */}
          <Link
            href={`/courses/${courseId}`}
            target="_blank"
            className="flex items-center justify-center gap-2 w-full py-3 border border-gray-200 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            수강생 화면으로 보기
          </Link>
        </div>
      </div>
    </div>
  )
}

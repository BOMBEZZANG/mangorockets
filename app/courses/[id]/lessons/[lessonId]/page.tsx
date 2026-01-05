import { supabase } from '@/lib/supabase'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import LessonVideoPlayer from '@/components/LessonVideoPlayer'

interface Lesson {
  id: string
  title: string
  video_url: string | null
  order_index: number
  is_preview: boolean
  chapter_id: string
  course_id: string
}

interface Chapter {
  id: string
  title: string
  order_index: number
}

interface Course {
  id: string
  title: string
  price: number
  instructor: string
}

async function getLesson(lessonId: string): Promise<Lesson | null> {
  const { data, error } = await supabase
    .from('lessons')
    .select('id, title, video_url, order_index, is_preview, chapter_id, course_id')
    .eq('id', lessonId)
    .single()

  if (error) return null
  return data
}

async function getChapter(chapterId: string): Promise<Chapter | null> {
  const { data, error } = await supabase
    .from('chapters')
    .select('id, title, order_index')
    .eq('id', chapterId)
    .single()

  if (error) return null
  return data
}

async function getCourse(courseId: string): Promise<Course | null> {
  const { data, error } = await supabase
    .from('courses')
    .select('id, title, price, instructor')
    .eq('id', courseId)
    .single()

  if (error) return null
  return data
}

async function getAdjacentLessons(courseId: string, currentOrderIndex: number, chapterId: string) {
  // 같은 챕터 내에서 이전/다음 레슨 찾기
  const { data: allLessons } = await supabase
    .from('lessons')
    .select('id, title, order_index, chapter_id, is_preview')
    .eq('course_id', courseId)
    .order('chapter_id')
    .order('order_index', { ascending: true })

  if (!allLessons) return { prev: null, next: null }

  // 현재 레슨의 인덱스 찾기
  const currentIndex = allLessons.findIndex(l => l.chapter_id === chapterId && l.order_index === currentOrderIndex)

  const prev = currentIndex > 0 ? allLessons[currentIndex - 1] : null
  const next = currentIndex < allLessons.length - 1 ? allLessons[currentIndex + 1] : null

  return { prev, next }
}

export default async function LessonPage({
  params,
}: {
  params: Promise<{ id: string; lessonId: string }>
}) {
  const { id: courseId, lessonId } = await params

  const lesson = await getLesson(lessonId)
  if (!lesson) notFound()

  // URL의 courseId와 lesson의 course_id가 일치하는지 확인
  if (lesson.course_id !== courseId) {
    redirect(`/courses/${lesson.course_id}/lessons/${lessonId}`)
  }

  const [chapter, course, { prev, next }] = await Promise.all([
    getChapter(lesson.chapter_id),
    getCourse(courseId),
    getAdjacentLessons(courseId, lesson.order_index, lesson.chapter_id),
  ])

  if (!course) notFound()

  return (
    <div className="min-h-screen bg-gray-900">
      {/* 상단 네비게이션 바 */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-gray-900/95 backdrop-blur-sm border-b border-gray-800">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between">
          {/* 뒤로가기 */}
          <Link
            href={`/courses/${courseId}`}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="text-sm font-medium">강의로 돌아가기</span>
          </Link>

          {/* 강의 정보 */}
          <div className="hidden md:flex items-center gap-3">
            <span className="text-orange-400 text-sm font-medium">{course.title}</span>
          </div>

          {/* 로고 */}
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl">🚀</span>
            <span className="text-lg font-bold bg-gradient-to-r from-orange-400 to-yellow-400 bg-clip-text text-transparent">
              MangoRocket
            </span>
          </Link>
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <main className="pt-16">
        {/* 비디오 플레이어 섹션 */}
        <div className="w-full bg-black">
          <div className="mx-auto max-w-6xl">
            <LessonVideoPlayer
              lesson={lesson}
              courseId={courseId}
              price={course.price}
            />
          </div>
        </div>

        {/* 레슨 정보 및 네비게이션 */}
        <div className="mx-auto max-w-6xl px-4 py-6">
          {/* 레슨 제목 */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              {chapter && (
                <span className="text-sm text-gray-400">
                  {chapter.title}
                </span>
              )}
              {lesson.is_preview && (
                <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 rounded text-xs font-medium">
                  미리보기
                </span>
              )}
            </div>
            <h1 className="text-2xl font-bold text-white">{lesson.title}</h1>
            <p className="text-gray-400 text-sm mt-1">강사: {course.instructor}</p>
          </div>

          {/* 이전/다음 레슨 네비게이션 */}
          <div className="flex items-center justify-between border-t border-gray-800 pt-6">
            {prev ? (
              <Link
                href={`/courses/${courseId}/lessons/${prev.id}`}
                className="flex items-center gap-3 text-gray-400 hover:text-white transition-colors group"
              >
                <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center group-hover:bg-gray-700 transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </div>
                <div className="text-left">
                  <p className="text-xs text-gray-500">이전 레슨</p>
                  <p className="text-sm font-medium">{prev.title}</p>
                </div>
              </Link>
            ) : (
              <div />
            )}

            {next ? (
              <Link
                href={`/courses/${courseId}/lessons/${next.id}`}
                className="flex items-center gap-3 text-gray-400 hover:text-white transition-colors group text-right"
              >
                <div className="text-right">
                  <p className="text-xs text-gray-500">다음 레슨</p>
                  <p className="text-sm font-medium">{next.title}</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center group-hover:bg-gray-700 transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            ) : (
              <div />
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

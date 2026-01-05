import { supabase } from '@/lib/supabase'
import { Course } from '@/types/course'
import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import Navbar from '@/components/Navbar'
import CurriculumSection from '@/components/CurriculumSection'
import PurchaseButton from '@/components/PurchaseButton'
import ReviewSection from '@/components/ReviewSection'

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

interface InstructorProfile {
  full_name: string | null
  avatar_url: string | null
}

async function getCourse(id: string): Promise<Course | null> {
  const { data, error } = await supabase
    .from('courses')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.error('Error fetching course:', error)
    return null
  }

  return data
}

async function getInstructorProfile(instructorId: string): Promise<InstructorProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('full_name, avatar_url')
    .eq('id', instructorId)
    .single()

  if (error) {
    console.error('Error fetching instructor profile:', error)
    return null
  }

  return data
}

async function getChaptersWithLessons(courseId: string): Promise<{ chapters: Chapter[], lessons: Lesson[] }> {
  const { data: chapters } = await supabase
    .from('chapters')
    .select('*')
    .eq('course_id', courseId)
    .order('order_index', { ascending: true })

  const { data: lessons } = await supabase
    .from('lessons')
    .select('id, chapter_id, title, video_url, order_index, is_preview')
    .eq('course_id', courseId)
    .order('order_index', { ascending: true })

  return {
    chapters: chapters || [],
    lessons: lessons || [],
  }
}

function getLevelBadgeColor(level: Course['level']) {
  switch (level) {
    case '입문':
      return 'bg-green-100 text-green-800'
    case '중급':
      return 'bg-yellow-100 text-yellow-800'
    case '고급':
      return 'bg-red-100 text-red-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

function formatPrice(price: number) {
  if (price === 0) return '무료'
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW',
  }).format(price)
}

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const course = await getCourse(id)

  if (!course) {
    notFound()
  }

  const [{ chapters, lessons }, instructorProfile] = await Promise.all([
    getChaptersWithLessons(id),
    getInstructorProfile(course.instructor)
  ])

  const totalLessons = lessons.length
  const previewLessons = lessons.filter(l => l.is_preview).length
  const instructorName = instructorProfile?.full_name || '강사'

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <Navbar />

      {/* Sub Header */}
      <header className="pt-16 bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <Link
            href="/courses"
            className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-orange-500 transition-colors"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            강의 목록으로 돌아가기
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Main Content */}
          <div className="lg:col-span-2">
            {/* Course Thumbnail */}
            <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-gray-100 mb-6 shadow-lg">
              {course.thumbnail ? (
                <Image
                  src={course.thumbnail}
                  alt={course.title}
                  fill
                  className="object-cover"
                  priority
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-orange-100 to-yellow-100">
                  <span className="text-6xl">🚀</span>
                </div>
              )}
            </div>

            {/* Course Info */}
            <div className="mb-6 flex flex-wrap items-center gap-3">
              {course.category && (
                <span className="inline-flex items-center rounded-full bg-white px-4 py-1 text-sm font-medium text-gray-700 shadow-sm border">
                  {course.category}
                </span>
              )}
              {course.level && (
                <span
                  className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${getLevelBadgeColor(course.level)}`}
                >
                  {course.level}
                </span>
              )}
              {course.duration && (
                <span className="inline-flex items-center gap-1 text-sm text-gray-500">
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  {course.duration}
                </span>
              )}
            </div>

            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              {course.title}
            </h1>

            {/* Instructor */}
            <div className="flex items-center gap-3 mb-8 pb-8 border-b">
              {instructorProfile?.avatar_url ? (
                <Image
                  src={instructorProfile.avatar_url}
                  alt={instructorName}
                  width={48}
                  height={48}
                  className="rounded-full object-cover"
                />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-yellow-400 text-white text-lg font-medium">
                  {instructorName.charAt(0)}
                </div>
              )}
              <div>
                <p className="text-sm text-gray-500">강사</p>
                <p className="font-semibold text-gray-900">{instructorName}</p>
              </div>
            </div>

            {/* Description */}
            <div className="prose prose-gray max-w-none">
              <h2 className="text-xl font-bold text-gray-900 mb-4">강의 소개</h2>
              <div className="bg-white rounded-xl p-6 shadow-sm border">
                <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                  {course.description}
                </p>
              </div>
            </div>

            {/* Curriculum */}
            {chapters.length > 0 && (
              <div className="mt-8">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-gray-900">커리큘럼</h2>
                  <span className="text-sm text-gray-500">
                    {chapters.length}개 챕터 · {totalLessons}개 회차
                    {previewLessons > 0 && (
                      <span className="ml-2 text-yellow-600">({previewLessons}개 미리보기)</span>
                    )}
                  </span>
                </div>
                <CurriculumSection
                  chapters={chapters}
                  lessons={lessons}
                  courseId={course.id}
                  price={course.price}
                />
              </div>
            )}

            {/* Reviews */}
            <ReviewSection
              courseId={course.id}
              instructorId={course.instructor}
            />
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-8 rounded-2xl bg-white p-6 shadow-lg border">
              <div className="mb-6">
                <p className="text-sm text-gray-500 mb-1">수강료</p>
                <p className={`text-3xl font-bold ${course.price === 0 ? 'text-green-600' : 'text-gray-900'}`}>
                  {formatPrice(course.price)}
                </p>
              </div>

              <PurchaseButton
                courseId={course.id}
                courseTitle={course.title}
                price={course.price}
              />

              <div className="mt-6 pt-6 border-t">
                <h3 className="font-semibold text-gray-900 mb-4">이 강의에 포함된 내용</h3>
                <ul className="space-y-3 text-sm text-gray-600">
                  <li className="flex items-center gap-2">
                    <svg className="h-5 w-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    무제한 액세스
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="h-5 w-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    모바일에서도 수강 가능
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="h-5 w-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    수료증 발급
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

      </main>

      {/* Footer */}
      <footer className="mt-16 border-t bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <p className="text-center text-sm text-gray-500">
            © 2024 MangoRocket. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}

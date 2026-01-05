'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Navbar from '@/components/Navbar'
import Link from 'next/link'
import Image from 'next/image'

interface Course {
  id: string
  title: string
  thumbnail: string | null
  instructor: string
  price: number
}

interface EnrolledCourse {
  id: string
  course_id: string
  created_at: string
  course: Course
  progress: number  // 진행률 (0-100)
  completedLessons: number
  totalLessons: number
}

interface CartItem {
  id: string
  course_id: string
  created_at: string
  course: Course
}

export default function MyCoursesPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'enrolled' | 'cart'>('enrolled')
  const [enrolledCourses, setEnrolledCourses] = useState<EnrolledCourse[]>([])
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [removingFromCart, setRemovingFromCart] = useState<string | null>(null)

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login?redirect=/my-courses')
        return
      }

      // 구매한 강의 목록
      const { data: purchases } = await supabase
        .from('purchases')
        .select(`
          id,
          course_id,
          created_at,
          course:courses (
            id,
            title,
            thumbnail,
            instructor,
            price
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      // 각 강의의 진행률 계산
      const enrolledWithProgress: EnrolledCourse[] = []

      if (purchases) {
        for (const purchase of purchases) {
          const courseId = purchase.course_id

          // 총 레슨 수
          const { count: totalLessons } = await supabase
            .from('lessons')
            .select('id', { count: 'exact' })
            .eq('course_id', courseId)

          // 완료한 레슨 수
          const { count: completedLessons } = await supabase
            .from('lesson_progress')
            .select('id', { count: 'exact' })
            .eq('user_id', user.id)
            .eq('course_id', courseId)
            .eq('completed', true)

          const total = totalLessons || 0
          const completed = completedLessons || 0
          const progress = total > 0 ? Math.round((completed / total) * 100) : 0

          enrolledWithProgress.push({
            id: purchase.id,
            course_id: purchase.course_id,
            created_at: purchase.created_at,
            course: purchase.course as unknown as Course,
            progress,
            completedLessons: completed,
            totalLessons: total,
          })
        }
      }

      setEnrolledCourses(enrolledWithProgress)

      // 장바구니 목록
      const { data: cart } = await supabase
        .from('cart')
        .select(`
          id,
          course_id,
          created_at,
          course:courses (
            id,
            title,
            thumbnail,
            instructor,
            price
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (cart) {
        setCartItems(cart as unknown as CartItem[])
      }

      setLoading(false)
    }

    loadData()
  }, [router])

  // 장바구니에서 삭제
  const removeFromCart = async (cartId: string) => {
    setRemovingFromCart(cartId)

    const { error } = await supabase
      .from('cart')
      .delete()
      .eq('id', cartId)

    if (!error) {
      setCartItems(cartItems.filter(item => item.id !== cartId))
    }

    setRemovingFromCart(null)
  }

  // 가격 포맷
  const formatPrice = (price: number) => {
    if (price === 0) return '무료'
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
    }).format(price)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="pt-24 flex justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-orange-500 border-t-transparent"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="pt-24 pb-12">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">내 강의</h1>

          {/* 탭 */}
          <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
            <button
              onClick={() => setActiveTab('enrolled')}
              className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'enrolled'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              수강중인 강의
              {enrolledCourses.length > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-orange-100 text-orange-600 rounded-full text-xs">
                  {enrolledCourses.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('cart')}
              className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'cart'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              장바구니
              {cartItems.length > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-yellow-100 text-yellow-600 rounded-full text-xs">
                  {cartItems.length}
                </span>
              )}
            </button>
          </div>

          {/* 수강중인 강의 */}
          {activeTab === 'enrolled' && (
            <div>
              {enrolledCourses.length === 0 ? (
                <div className="bg-white rounded-2xl shadow-sm border p-12 text-center">
                  <div className="text-6xl mb-4">📚</div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    수강 중인 강의가 없습니다
                  </h3>
                  <p className="text-gray-500 mb-6">
                    관심 있는 강의를 찾아보세요!
                  </p>
                  <Link
                    href="/courses"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-yellow-500 text-white rounded-full font-medium hover:shadow-lg transition-shadow"
                  >
                    강의 둘러보기
                  </Link>
                </div>
              ) : (
                <div className="grid gap-4">
                  {enrolledCourses.map((item) => (
                    <div
                      key={item.id}
                      className="bg-white rounded-2xl shadow-sm border overflow-hidden hover:shadow-md transition-shadow"
                    >
                      <div className="flex flex-col sm:flex-row">
                        {/* 썸네일 */}
                        <Link
                          href={`/courses/${item.course_id}`}
                          className="relative w-full sm:w-64 h-40 flex-shrink-0"
                        >
                          {item.course?.thumbnail ? (
                            <Image
                              src={item.course.thumbnail}
                              alt={item.course.title}
                              fill
                              className="object-cover"
                            />
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-orange-100 to-yellow-100">
                              <span className="text-5xl">🚀</span>
                            </div>
                          )}
                          {/* 진행률 오버레이 */}
                          {item.progress === 100 && (
                            <div className="absolute inset-0 bg-green-500/80 flex items-center justify-center">
                              <div className="text-white text-center">
                                <svg className="w-12 h-12 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                <span className="text-sm font-medium">수강 완료!</span>
                              </div>
                            </div>
                          )}
                        </Link>

                        {/* 정보 */}
                        <div className="flex-1 p-5">
                          <Link href={`/courses/${item.course_id}`}>
                            <h3 className="font-semibold text-gray-900 text-lg mb-1 hover:text-orange-500 transition-colors">
                              {item.course?.title}
                            </h3>
                          </Link>
                          <p className="text-gray-500 text-sm mb-4">{item.course?.instructor}</p>

                          {/* 진행률 바 */}
                          <div className="mb-3">
                            <div className="flex items-center justify-between text-sm mb-1">
                              <span className="text-gray-600">학습 진행률</span>
                              <span className="font-medium text-orange-600">{item.progress}%</span>
                            </div>
                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  item.progress === 100
                                    ? 'bg-green-500'
                                    : 'bg-gradient-to-r from-orange-500 to-yellow-500'
                                }`}
                                style={{ width: `${item.progress}%` }}
                              />
                            </div>
                            <p className="text-xs text-gray-400 mt-1">
                              {item.completedLessons} / {item.totalLessons} 강의 완료
                            </p>
                          </div>

                          {/* 버튼 */}
                          <div className="flex gap-2">
                            <Link
                              href={`/courses/${item.course_id}`}
                              className="px-4 py-2 bg-gradient-to-r from-orange-500 to-yellow-500 text-white rounded-lg text-sm font-medium hover:shadow-md transition-shadow"
                            >
                              {item.progress === 0 ? '학습 시작' : item.progress === 100 ? '다시 보기' : '이어서 학습'}
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 장바구니 */}
          {activeTab === 'cart' && (
            <div>
              {cartItems.length === 0 ? (
                <div className="bg-white rounded-2xl shadow-sm border p-12 text-center">
                  <div className="text-6xl mb-4">🛒</div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    장바구니가 비어있습니다
                  </h3>
                  <p className="text-gray-500 mb-6">
                    관심 있는 강의를 장바구니에 담아보세요!
                  </p>
                  <Link
                    href="/courses"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-yellow-500 text-white rounded-full font-medium hover:shadow-lg transition-shadow"
                  >
                    강의 둘러보기
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* 장바구니 목록 */}
                  <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
                    {cartItems.map((item, index) => (
                      <div
                        key={item.id}
                        className={`flex items-center gap-4 p-4 ${
                          index > 0 ? 'border-t' : ''
                        }`}
                      >
                        {/* 썸네일 */}
                        <Link
                          href={`/courses/${item.course_id}`}
                          className="relative w-32 h-20 flex-shrink-0 rounded-lg overflow-hidden"
                        >
                          {item.course?.thumbnail ? (
                            <Image
                              src={item.course.thumbnail}
                              alt={item.course.title}
                              fill
                              className="object-cover"
                            />
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-orange-100 to-yellow-100">
                              <span className="text-3xl">🚀</span>
                            </div>
                          )}
                        </Link>

                        {/* 정보 */}
                        <div className="flex-1 min-w-0">
                          <Link href={`/courses/${item.course_id}`}>
                            <h3 className="font-medium text-gray-900 hover:text-orange-500 transition-colors truncate">
                              {item.course?.title}
                            </h3>
                          </Link>
                          <p className="text-sm text-gray-500">{item.course?.instructor}</p>
                        </div>

                        {/* 가격 */}
                        <div className="text-right">
                          <p className={`font-semibold ${item.course?.price === 0 ? 'text-green-600' : 'text-gray-900'}`}>
                            {formatPrice(item.course?.price || 0)}
                          </p>
                        </div>

                        {/* 삭제 버튼 */}
                        <button
                          onClick={() => removeFromCart(item.id)}
                          disabled={removingFromCart === item.id}
                          className="p-2 text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
                          title="장바구니에서 삭제"
                        >
                          {removingFromCart === item.id ? (
                            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                          ) : (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          )}
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* 합계 */}
                  <div className="bg-white rounded-2xl shadow-sm border p-6">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-gray-600">총 {cartItems.length}개 강의</span>
                      <span className="text-2xl font-bold text-gray-900">
                        {formatPrice(cartItems.reduce((sum, item) => sum + (item.course?.price || 0), 0))}
                      </span>
                    </div>
                    <button className="w-full py-3 bg-gradient-to-r from-orange-500 to-yellow-500 text-white rounded-xl font-semibold hover:shadow-lg transition-shadow">
                      전체 결제하기
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

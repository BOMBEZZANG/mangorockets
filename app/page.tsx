'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Image from 'next/image'
import Link from 'next/link'
import Navbar from '@/components/Navbar'

interface Tag {
  id: string
  category: string
  name: string
}

interface Course {
  id: string
  title: string
  description: string
  category: string
  level: string
  price: number
  thumbnail: string | null
  instructor: string
  created_at: string
  tags?: Tag[]
  rating?: {
    average: number
    count: number
  }
}

function getLevelBadgeColor(level: string) {
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

// 태그 카테고리 순서
const TAG_CATEGORY_ORDER = [
  'AI 마케팅',
  '자동화 도구',
  '콘텐츠 마케팅',
  'SNS 마케팅',
  '이메일 마케팅',
  '광고 전략',
  '성장 전략',
  '분석 도구',
  '기타',
]

function HomeContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const selectedTagId = searchParams.get('tag')
  const searchQuery = searchParams.get('q') || ''

  const [courses, setCourses] = useState<Course[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [searchInput, setSearchInput] = useState(searchQuery)

  // 데이터 로드
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true)

      // 태그 로드
      const { data: tagsData } = await supabase
        .from('tags')
        .select('*')
        .order('category')
        .order('name')

      if (tagsData) {
        setTags(tagsData)
      }

      // 상품 로드 (태그 필터 적용)
      let coursesData: Course[] = []

      if (selectedTagId) {
        // 태그로 필터링된 상품 (발행된 상품만)
        const { data } = await supabase
          .from('course_tags')
          .select(`
            course_id,
            courses!inner (*)
          `)
          .eq('tag_id', selectedTagId)
          .eq('courses.published', true)

        if (data) {
          coursesData = data
            .map((item: any) => item.courses)
            .filter(Boolean)
        }
      } else {
        // 전체 상품 (발행된 상품만)
        const { data } = await supabase
          .from('courses')
          .select('*')
          .eq('published', true)
          .order('created_at', { ascending: false })

        if (data) {
          coursesData = data
        }
      }

      // 각 상품의 태그 정보 가져오기
      if (coursesData.length > 0) {
        const courseIds = coursesData.map(c => c.id)
        const { data: courseTagsData } = await supabase
          .from('course_tags')
          .select(`
            course_id,
            tags (*)
          `)
          .in('course_id', courseIds)

        if (courseTagsData) {
          // 상품별 태그 매핑
          const tagsByCourse: Record<string, Tag[]> = {}
          courseTagsData.forEach((ct: any) => {
            if (!tagsByCourse[ct.course_id]) {
              tagsByCourse[ct.course_id] = []
            }
            if (ct.tags) {
              tagsByCourse[ct.course_id].push(ct.tags)
            }
          })

          // 상품에 태그 추가
          coursesData = coursesData.map(course => ({
            ...course,
            tags: tagsByCourse[course.id] || [],
          }))
        }

        // 각 상품의 평점 가져오기
        const { data: reviewsData } = await supabase
          .from('reviews')
          .select('course_id, rating')
          .in('course_id', courseIds)

        if (reviewsData && reviewsData.length > 0) {
          // 상품별 평점 계산
          const ratingsByCourse: Record<string, { total: number; count: number }> = {}
          reviewsData.forEach((review) => {
            if (!ratingsByCourse[review.course_id]) {
              ratingsByCourse[review.course_id] = { total: 0, count: 0 }
            }
            ratingsByCourse[review.course_id].total += review.rating
            ratingsByCourse[review.course_id].count += 1
          })

          // 상품에 평점 추가
          coursesData = coursesData.map(course => ({
            ...course,
            rating: ratingsByCourse[course.id]
              ? {
                  average: Math.round((ratingsByCourse[course.id].total / ratingsByCourse[course.id].count) * 10) / 10,
                  count: ratingsByCourse[course.id].count,
                }
              : undefined,
          }))
        }
      }

      // 검색어 필터링 (제목, 설명, 카테고리, 태그)
      if (searchQuery && coursesData.length > 0) {
        const query = searchQuery.toLowerCase()
        coursesData = coursesData.filter(course => {
          // 제목, 설명, 카테고리에서 검색
          if (course.title.toLowerCase().includes(query)) return true
          if (course.description?.toLowerCase().includes(query)) return true
          if (course.category?.toLowerCase().includes(query)) return true

          // 태그에서 검색
          if (course.tags?.some(tag => tag.name.toLowerCase().includes(query))) return true

          return false
        })
      }

      setCourses(coursesData)
      setIsLoading(false)
    }

    loadData()
  }, [selectedTagId, searchQuery])

  // 태그 선택
  const handleTagClick = (tagId: string | null) => {
    const params = new URLSearchParams()
    if (tagId) params.set('tag', tagId)
    if (searchQuery) params.set('q', searchQuery)
    const queryString = params.toString()
    router.push(queryString ? `/?${queryString}` : '/', { scroll: false })
  }

  // 검색 실행
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const params = new URLSearchParams()
    if (searchInput.trim()) params.set('q', searchInput.trim())
    if (selectedTagId) params.set('tag', selectedTagId)
    const queryString = params.toString()
    router.push(queryString ? `/?${queryString}` : '/', { scroll: false })
  }

  // 검색 초기화
  const clearSearch = () => {
    setSearchInput('')
    const params = new URLSearchParams()
    if (selectedTagId) params.set('tag', selectedTagId)
    const queryString = params.toString()
    router.push(queryString ? `/?${queryString}` : '/', { scroll: false })
  }

  // 선택된 태그 정보
  const selectedTag = tags.find(t => t.id === selectedTagId)

  // 카테고리별 태그 그룹화
  const tagsByCategory = tags.reduce((acc, tag) => {
    if (!acc[tag.category]) {
      acc[tag.category] = []
    }
    acc[tag.category].push(tag)
    return acc
  }, {} as Record<string, Tag[]>)

  return (
    <>
      {/* Hero Section */}
      <section className="pt-24 pb-16 bg-gradient-to-br from-orange-50 via-yellow-50 to-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight">
              <span className="text-gray-900">비즈니스 성장을</span>
              <br />
              <span className="bg-gradient-to-r from-orange-500 to-yellow-500 bg-clip-text text-transparent">
                자동화로 가속하세요
              </span>
            </h1>
            <p className="mt-6 text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto">
              자동화 마케팅 도구와 전략으로 비즈니스를 성장시키세요.
              AI 마케팅, 자동화 도구, 성장 전략 등 다양한 마케팅 상품을 만나보세요.
            </p>

            {/* 검색바 */}
            <form onSubmit={handleSearch} className="mt-8 max-w-xl mx-auto">
              <div className="relative flex items-center">
                <div className="absolute left-4 text-gray-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="상품명, 태그, 카테고리로 검색..."
                  className="w-full pl-12 pr-24 py-4 rounded-full border-2 border-gray-200 bg-white shadow-lg focus:border-orange-400 focus:outline-none focus:ring-4 focus:ring-orange-100 transition-all text-gray-900 placeholder-gray-400"
                />
                {searchInput && (
                  <button
                    type="button"
                    onClick={() => setSearchInput('')}
                    className="absolute right-20 text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
                <button
                  type="submit"
                  className="absolute right-2 px-5 py-2 bg-gradient-to-r from-orange-500 to-yellow-500 text-white rounded-full font-medium hover:shadow-lg transition-shadow"
                >
                  검색
                </button>
              </div>
            </form>

            {/* 통계 */}
            <div className="mt-10 flex flex-wrap justify-center gap-8 sm:gap-16">
              <div className="text-center">
                <div className="text-3xl sm:text-4xl font-bold text-gray-900">{courses.length}+</div>
                <div className="text-sm text-gray-500 mt-1">상품</div>
              </div>
              <div className="text-center">
                <div className="text-3xl sm:text-4xl font-bold text-gray-900">{Object.keys(tagsByCategory).length}+</div>
                <div className="text-sm text-gray-500 mt-1">카테고리</div>
              </div>
              <div className="text-center">
                <div className="text-3xl sm:text-4xl font-bold text-gray-900">100%</div>
                <div className="text-sm text-gray-500 mt-1">디지털 상품</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Tag Filter Section */}
      <header className="bg-white shadow-sm sticky top-16 z-40">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold tracking-tight text-gray-900">
                {searchQuery ? '검색 결과' : '전체 상품'}
              </h2>
              {searchQuery && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm font-medium">
                  &quot;{searchQuery}&quot;
                  <button
                    onClick={clearSearch}
                    className="hover:bg-orange-200 rounded-full p-0.5 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              )}
            </div>
            <span className="text-sm text-gray-500">
              {isLoading ? '로딩 중...' : `총 ${courses.length}개`}
            </span>
          </div>

          {/* Tag Filter Bar */}
          <div className="mt-6">
            {/* 카테고리 필터 */}
            <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-hide">
              <button
                onClick={() => {
                  setSelectedCategory(null)
                  handleTagClick(null)
                }}
                className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
                  !selectedTagId && !selectedCategory
                    ? 'bg-gradient-to-r from-orange-500 to-yellow-500 text-white shadow-md'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                전체
              </button>
              {TAG_CATEGORY_ORDER.filter(cat => tagsByCategory[cat]).map(category => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(selectedCategory === category ? null : category)}
                  className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
                    selectedCategory === category
                      ? 'bg-gradient-to-r from-orange-500 to-yellow-500 text-white shadow-md'
                      : selectedTag?.category === category
                      ? 'bg-orange-100 text-orange-700 border-2 border-orange-300'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>

            {/* 선택된 카테고리의 세부 태그 */}
            {selectedCategory && tagsByCategory[selectedCategory] && (
              <div className="flex gap-2 overflow-x-auto pb-2 pt-2 scrollbar-hide animate-fadeIn">
                {tagsByCategory[selectedCategory].map(tag => (
                  <button
                    key={tag.id}
                    onClick={() => handleTagClick(tag.id)}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
                      selectedTagId === tag.id
                        ? 'bg-orange-500 text-white shadow-md scale-105'
                        : 'bg-white text-gray-600 border border-gray-200 hover:border-orange-300 hover:text-orange-600'
                    }`}
                  >
                    #{tag.name}
                  </button>
                ))}
              </div>
            )}

            {/* 선택된 태그 표시 */}
            {selectedTag && (
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                <span className="text-sm text-gray-500">선택된 태그:</span>
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-gradient-to-r from-orange-500 to-yellow-500 text-white rounded-full text-sm font-medium">
                  #{selectedTag.name}
                  <button
                    onClick={() => handleTagClick(null)}
                    className="ml-1 hover:bg-white/20 rounded-full p-0.5 transition-colors"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Loading State */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-orange-500 border-t-transparent"></div>
          </div>
        ) : courses.length === 0 ? (
          /* No Results */
          <div className="flex flex-col items-center justify-center py-20">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              {searchQuery || selectedTag ? '검색 결과가 없습니다' : '등록된 상품가 없습니다'}
            </h3>
            <p className="text-gray-500 mb-6 text-center">
              {searchQuery
                ? `"${searchQuery}"에 대한 검색 결과가 없습니다.`
                : selectedTag
                ? `"${selectedTag.name}" 태그에 해당하는 상품가 없습니다.`
                : '곧 새로운 상품가 업데이트될 예정입니다'}
            </p>
            {(selectedTag || searchQuery) && (
              <button
                onClick={() => {
                  setSearchInput('')
                  router.push('/', { scroll: false })
                }}
                className="px-6 py-2 bg-gradient-to-r from-orange-500 to-yellow-500 text-white rounded-full font-medium hover:shadow-lg transition-shadow"
              >
                전체 상품 보기
              </button>
            )}
          </div>
        ) : (
          /* Course Grid */
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((course) => (
              <Link key={course.id} href={`/courses/${course.id}`}>
                <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl bg-white shadow-md transition-all duration-300 hover:shadow-xl hover:-translate-y-1 cursor-pointer">
                  {/* Thumbnail */}
                  <div className="relative aspect-video overflow-hidden bg-gray-100">
                    {course.thumbnail ? (
                      <Image
                        src={course.thumbnail}
                        alt={course.title}
                        fill
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center bg-gradient-to-br from-orange-100 to-yellow-100">
                        <span className="text-5xl">🚀</span>
                      </div>
                    )}
                    {/* Category Badge */}
                    <div className="absolute top-3 left-3">
                      <span className="inline-flex items-center rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-gray-700 backdrop-blur-sm">
                        {course.category}
                      </span>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex flex-1 flex-col p-5">
                    {/* Level & Tags */}
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      {course.level && (
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getLevelBadgeColor(course.level)}`}
                        >
                          {course.level}
                        </span>
                      )}
                      {course.tags && course.tags.slice(0, 2).map(tag => (
                        <span
                          key={tag.id}
                          className="inline-flex items-center rounded-full bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-600"
                        >
                          #{tag.name}
                        </span>
                      ))}
                      {course.tags && course.tags.length > 2 && (
                        <span className="text-xs text-gray-400">
                          +{course.tags.length - 2}
                        </span>
                      )}
                    </div>

                    {/* Title */}
                    <h2 className="mb-1 text-lg font-bold text-gray-900 line-clamp-2 group-hover:text-orange-600 transition-colors">
                      {course.title}
                    </h2>

                    {/* Rating */}
                    {course.rating ? (
                      <div className="flex items-center gap-1.5 mb-2">
                        <div className="flex items-center">
                          <svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                          <span className="ml-1 text-sm font-medium text-gray-900">{course.rating.average}</span>
                        </div>
                        <span className="text-xs text-gray-400">({course.rating.count})</span>
                      </div>
                    ) : (
                      <div className="mb-2 h-5" />
                    )}

                    {/* Description */}
                    <p className="mb-4 flex-1 text-sm text-gray-600 line-clamp-2">
                      {course.description}
                    </p>

                    {/* Price & CTA */}
                    <div className="flex items-center justify-between border-t pt-4">
                      <div className="flex flex-col">
                        <span className="text-xs text-gray-500">가격</span>
                        <span className={`text-lg font-bold ${course.price === 0 ? 'text-green-600' : 'text-gray-900'}`}>
                          {formatPrice(course.price)}
                        </span>
                      </div>
                      <span className="rounded-full bg-gradient-to-r from-orange-500 to-yellow-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg hover:from-orange-600 hover:to-yellow-600">
                        구매하기
                      </span>
                    </div>
                  </div>
                </article>
              </Link>
            ))}
          </div>
        )}
      </main>

      {/* Features Section */}
      <section className="bg-white py-16 border-t">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-center text-gray-900 mb-12">
            왜 MangoRocket인가요?
          </h2>
          <div className="grid gap-8 md:grid-cols-3">
            <div className="text-center p-6 rounded-2xl bg-gradient-to-br from-orange-50 to-white">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-100 text-3xl">
                👩‍🏫
              </div>
              <h3 className="text-lg font-semibold text-gray-900">자동화 솔루션</h3>
              <p className="mt-2 text-gray-600">
                검증된 마케팅 자동화 도구로 효율적인 성장을 경험하세요
              </p>
            </div>
            <div className="text-center p-6 rounded-2xl bg-gradient-to-br from-yellow-50 to-white">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-yellow-100 text-3xl">
                📱
              </div>
              <h3 className="text-lg font-semibold text-gray-900">빠른 성과</h3>
              <p className="mt-2 text-gray-600">
                24시간 자동으로 작동하는 마케팅 시스템을 구축하세요
              </p>
            </div>
            <div className="text-center p-6 rounded-2xl bg-gradient-to-br from-orange-50 to-white">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-100 text-3xl">
                🎯
              </div>
              <h3 className="text-lg font-semibold text-gray-900">데이터 기반 전략</h3>
              <p className="mt-2 text-gray-600">
                분석과 인사이트를 통해 효과적인 마케팅 전략을 수립하세요
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🚀</span>
              <span className="text-xl font-bold bg-gradient-to-r from-orange-400 to-yellow-400 bg-clip-text text-transparent">
                MangoRocket
              </span>
            </div>
            <div className="flex gap-6 text-sm text-gray-400">
              <a href="#" className="hover:text-white transition-colors">이용약관</a>
              <a href="#" className="hover:text-white transition-colors">개인정보처리방침</a>
              <a href="#" className="hover:text-white transition-colors">고객센터</a>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-gray-800 text-center text-sm text-gray-500">
            © 2024 MangoRocket. All rights reserved.
          </div>
        </div>
      </footer>
    </>
  )
}

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <Navbar />
      <Suspense fallback={
        <div className="pt-32 flex items-center justify-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-orange-500 border-t-transparent"></div>
        </div>
      }>
        <HomeContent />
      </Suspense>
    </div>
  )
}

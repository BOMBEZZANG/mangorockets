'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Navbar from '@/components/Navbar'
import EbookCard from '@/components/EbookCard'
import type { EbookWithTags, Tag } from '@/types/ebook'

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

function EbooksContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const selectedTagId = searchParams.get('tag')
  const searchQuery = searchParams.get('q') || ''

  const [ebooks, setEbooks] = useState<EbookWithTags[]>([])
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

      // E-book 로드
      let ebooksData: EbookWithTags[] = []

      if (selectedTagId) {
        const { data } = await supabase
          .from('ebook_tags')
          .select(`
            ebook_id,
            ebooks!inner (*)
          `)
          .eq('tag_id', selectedTagId)
          .eq('ebooks.published', true)

        if (data) {
          ebooksData = data
            .map((item: any) => item.ebooks)
            .filter(Boolean)
        }
      } else {
        const { data } = await supabase
          .from('ebooks')
          .select('*')
          .eq('published', true)
          .order('created_at', { ascending: false })

        if (data) {
          ebooksData = data
        }
      }

      // 각 E-book의 태그 정보 가져오기
      if (ebooksData.length > 0) {
        const ebookIds = ebooksData.map(e => e.id)
        const { data: ebookTagsData } = await supabase
          .from('ebook_tags')
          .select(`
            ebook_id,
            tags (*)
          `)
          .in('ebook_id', ebookIds)

        if (ebookTagsData) {
          const tagsByEbook: Record<string, Tag[]> = {}
          ebookTagsData.forEach((et: any) => {
            if (!tagsByEbook[et.ebook_id]) {
              tagsByEbook[et.ebook_id] = []
            }
            if (et.tags) {
              tagsByEbook[et.ebook_id].push(et.tags)
            }
          })

          ebooksData = ebooksData.map(ebook => ({
            ...ebook,
            tags: tagsByEbook[ebook.id] || [],
          }))
        }

        // 각 E-book의 평점 가져오기
        const { data: reviewsData } = await supabase
          .from('ebook_reviews')
          .select('ebook_id, rating')
          .in('ebook_id', ebookIds)

        if (reviewsData && reviewsData.length > 0) {
          const ratingsByEbook: Record<string, { total: number; count: number }> = {}
          reviewsData.forEach((review) => {
            if (!ratingsByEbook[review.ebook_id]) {
              ratingsByEbook[review.ebook_id] = { total: 0, count: 0 }
            }
            ratingsByEbook[review.ebook_id].total += review.rating
            ratingsByEbook[review.ebook_id].count += 1
          })

          ebooksData = ebooksData.map(ebook => ({
            ...ebook,
            rating: ratingsByEbook[ebook.id]
              ? {
                  average: Math.round((ratingsByEbook[ebook.id].total / ratingsByEbook[ebook.id].count) * 10) / 10,
                  count: ratingsByEbook[ebook.id].count,
                }
              : undefined,
          }))
        }
      }

      // 검색어 필터링
      if (searchQuery && ebooksData.length > 0) {
        const query = searchQuery.toLowerCase()
        ebooksData = ebooksData.filter(ebook => {
          if (ebook.title.toLowerCase().includes(query)) return true
          if (ebook.description?.toLowerCase().includes(query)) return true
          if (ebook.category?.toLowerCase().includes(query)) return true
          if (ebook.tags?.some(tag => tag.name.toLowerCase().includes(query))) return true
          return false
        })
      }

      setEbooks(ebooksData)
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
    router.push(queryString ? `/ebooks?${queryString}` : '/ebooks', { scroll: false })
  }

  // 검색 실행
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const params = new URLSearchParams()
    if (searchInput.trim()) params.set('q', searchInput.trim())
    if (selectedTagId) params.set('tag', selectedTagId)
    const queryString = params.toString()
    router.push(queryString ? `/ebooks?${queryString}` : '/ebooks', { scroll: false })
  }

  // 검색 초기화
  const clearSearch = () => {
    setSearchInput('')
    const params = new URLSearchParams()
    if (selectedTagId) params.set('tag', selectedTagId)
    const queryString = params.toString()
    router.push(queryString ? `/ebooks?${queryString}` : '/ebooks', { scroll: false })
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
      <section className="pt-24 pb-16 bg-gradient-to-br from-blue-50 via-indigo-50 to-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight">
              <span className="text-gray-900">지식을 담은</span>
              <br />
              <span className="bg-gradient-to-r from-blue-500 to-indigo-500 bg-clip-text text-transparent">
                E-book 컬렉션
              </span>
            </h1>
            <p className="mt-6 text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto">
              마케팅 전문가들이 직접 집필한 E-book으로
              <br />
              비즈니스 성장의 인사이트를 얻으세요.
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
                  placeholder="E-book 제목, 태그로 검색..."
                  className="w-full pl-12 pr-24 py-4 rounded-full border-2 border-gray-200 bg-white shadow-lg focus:border-blue-400 focus:outline-none focus:ring-4 focus:ring-blue-100 transition-all text-gray-900 placeholder-gray-400"
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
                  className="absolute right-2 px-5 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-full font-medium hover:shadow-lg transition-shadow"
                >
                  검색
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>

      {/* Tag Filter Section */}
      <header className="bg-white shadow-sm sticky top-16 z-40">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold tracking-tight text-gray-900">
                {searchQuery ? '검색 결과' : '전체 E-book'}
              </h2>
              {searchQuery && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                  &quot;{searchQuery}&quot;
                  <button
                    onClick={clearSearch}
                    className="hover:bg-blue-200 rounded-full p-0.5 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              )}
            </div>
            <span className="text-sm text-gray-500">
              {isLoading ? '로딩 중...' : `총 ${ebooks.length}개`}
            </span>
          </div>

          {/* Tag Filter Bar */}
          <div className="mt-6">
            <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-hide">
              <button
                onClick={() => {
                  setSelectedCategory(null)
                  handleTagClick(null)
                }}
                className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
                  !selectedTagId && !selectedCategory
                    ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-md'
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
                      ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-md'
                      : selectedTag?.category === category
                      ? 'bg-blue-100 text-blue-700 border-2 border-blue-300'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>

            {selectedCategory && tagsByCategory[selectedCategory] && (
              <div className="flex gap-2 overflow-x-auto pb-2 pt-2 scrollbar-hide animate-fadeIn">
                {tagsByCategory[selectedCategory].map(tag => (
                  <button
                    key={tag.id}
                    onClick={() => handleTagClick(tag.id)}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
                      selectedTagId === tag.id
                        ? 'bg-blue-500 text-white shadow-md scale-105'
                        : 'bg-white text-gray-600 border border-gray-200 hover:border-blue-300 hover:text-blue-600'
                    }`}
                  >
                    #{tag.name}
                  </button>
                ))}
              </div>
            )}

            {selectedTag && (
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                <span className="text-sm text-gray-500">선택된 태그:</span>
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-full text-sm font-medium">
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
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
          </div>
        ) : ebooks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="text-6xl mb-4">📚</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              {searchQuery || selectedTag ? '검색 결과가 없습니다' : '등록된 E-book이 없습니다'}
            </h3>
            <p className="text-gray-500 mb-6 text-center">
              {searchQuery
                ? `"${searchQuery}"에 대한 검색 결과가 없습니다.`
                : selectedTag
                ? `"${selectedTag.name}" 태그에 해당하는 E-book이 없습니다.`
                : '곧 새로운 E-book이 업데이트될 예정입니다'}
            </p>
            {(selectedTag || searchQuery) && (
              <button
                onClick={() => {
                  setSearchInput('')
                  router.push('/ebooks', { scroll: false })
                }}
                className="px-6 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-full font-medium hover:shadow-lg transition-shadow"
              >
                전체 E-book 보기
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {ebooks.map((ebook) => (
              <EbookCard key={ebook.id} ebook={ebook} />
            ))}
          </div>
        )}
      </main>
    </>
  )
}

function EbooksLoading() {
  return (
    <>
      {/* Hero Section */}
      <section className="pt-24 pb-16 bg-gradient-to-br from-blue-50 via-indigo-50 to-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight">
              <span className="text-gray-900">지식을 담은</span>
              <br />
              <span className="bg-gradient-to-r from-blue-500 to-indigo-500 bg-clip-text text-transparent">
                E-book 컬렉션
              </span>
            </h1>
            <p className="mt-6 text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto">
              마케팅 전문가들이 직접 집필한 E-book으로
              <br />
              비즈니스 성장의 인사이트를 얻으세요.
            </p>
          </div>
        </div>
      </section>
      <div className="flex items-center justify-center py-20">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
      </div>
    </>
  )
}

export default function EbooksPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <Navbar />

      <Suspense fallback={<EbooksLoading />}>
        <EbooksContent />
      </Suspense>

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
    </div>
  )
}

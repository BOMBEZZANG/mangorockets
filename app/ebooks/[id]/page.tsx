'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { EbookWithInstructor } from '@/types/ebook'
import EbookPurchaseButton from '@/components/EbookPurchaseButton'

function getLevelBadgeColor(level: string | null) {
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

function formatFileSize(bytes: number | null) {
  if (!bytes) return ''
  const mb = bytes / (1024 * 1024)
  return `${mb.toFixed(1)}MB`
}

export default function EbookDetailPage() {
  const params = useParams()
  const ebookId = params.id as string

  const [ebook, setEbook] = useState<EbookWithInstructor | null>(null)
  const [tags, setTags] = useState<{ id: string; name: string }[]>([])
  const [rating, setRating] = useState<{ average: number; count: number } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchEbook() {
      try {
        // Fetch ebook with instructor info
        const { data: ebookData, error: ebookError } = await supabase
          .from('ebooks')
          .select(`
            *,
            profiles:instructor (
              id,
              name,
              avatar_url
            )
          `)
          .eq('id', ebookId)
          .eq('published', true)
          .single()

        if (ebookError) {
          setError('E-book을 찾을 수 없습니다.')
          setIsLoading(false)
          return
        }

        setEbook(ebookData)

        // Fetch tags
        const { data: tagsData } = await supabase
          .from('ebook_tags')
          .select('tags:tag_id (id, name)')
          .eq('ebook_id', ebookId)

        if (tagsData) {
          const formattedTags = (tagsData as unknown as { tags: { id: string; name: string } | null }[])
            .map((t) => t.tags)
            .filter((tag): tag is { id: string; name: string } => tag !== null)
          setTags(formattedTags)
        }

        // Fetch rating
        const { data: ratingData } = await supabase
          .from('ebook_ratings')
          .select('*')
          .eq('ebook_id', ebookId)
          .single()

        if (ratingData) {
          setRating({
            average: ratingData.average_rating,
            count: ratingData.review_count,
          })
        }

      } catch (err) {
        console.error('Error fetching ebook:', err)
        setError('E-book을 불러오는 중 오류가 발생했습니다.')
      } finally {
        setIsLoading(false)
      }
    }

    fetchEbook()
  }, [ebookId])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-6xl px-4 py-8">
          <div className="grid gap-8 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-6">
              <div className="h-8 w-24 bg-gray-200 rounded animate-pulse" />
              <div className="h-12 w-3/4 bg-gray-200 rounded animate-pulse" />
              <div className="aspect-[3/4] max-w-md bg-gray-200 rounded-2xl animate-pulse" />
            </div>
            <div className="space-y-4">
              <div className="h-64 bg-gray-200 rounded-2xl animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error || !ebook) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            {error || 'E-book을 찾을 수 없습니다.'}
          </h1>
          <Link
            href="/ebooks"
            className="text-orange-500 hover:text-orange-600 font-medium"
          >
            ← E-book 목록으로 돌아가기
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-6xl px-4 py-8">
        {/* Breadcrumb */}
        <nav className="mb-6 text-sm">
          <ol className="flex items-center gap-2">
            <li>
              <Link href="/" className="text-gray-500 hover:text-gray-700">
                홈
              </Link>
            </li>
            <li className="text-gray-400">/</li>
            <li>
              <Link href="/ebooks" className="text-gray-500 hover:text-gray-700">
                E-book
              </Link>
            </li>
            <li className="text-gray-400">/</li>
            <li className="text-gray-900 font-medium truncate max-w-xs">
              {ebook.title}
            </li>
          </ol>
        </nav>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Left: Ebook Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Category & Level */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800">
                E-book
              </span>
              <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-700">
                {ebook.category}
              </span>
              {ebook.level && (
                <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${getLevelBadgeColor(ebook.level)}`}>
                  {ebook.level}
                </span>
              )}
            </div>

            {/* Title */}
            <h1 className="text-3xl font-bold text-gray-900 lg:text-4xl">
              {ebook.title}
            </h1>

            {/* Rating */}
            {rating && rating.count > 0 && (
              <div className="flex items-center gap-2">
                <div className="flex items-center">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <svg
                      key={star}
                      className={`w-5 h-5 ${star <= rating.average ? 'text-yellow-400' : 'text-gray-300'}`}
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <span className="font-medium text-gray-900">{rating.average.toFixed(1)}</span>
                <span className="text-gray-500">({rating.count}개 리뷰)</span>
              </div>
            )}

            {/* Thumbnail */}
            <div className="relative aspect-[3/4] max-w-md overflow-hidden rounded-2xl bg-gray-100 shadow-lg">
              {ebook.thumbnail ? (
                <Image
                  src={ebook.thumbnail}
                  alt={ebook.title}
                  fill
                  className="object-cover"
                  priority
                />
              ) : (
                <div className="flex h-full items-center justify-center bg-gradient-to-br from-orange-100 to-yellow-100">
                  <span className="text-8xl">📚</span>
                </div>
              )}
            </div>

            {/* Tags */}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <Link
                    key={tag.id}
                    href={`/ebooks?tag=${tag.id}`}
                    className="inline-flex items-center rounded-full bg-orange-50 px-3 py-1 text-sm font-medium text-orange-600 hover:bg-orange-100 transition-colors"
                  >
                    #{tag.name}
                  </Link>
                ))}
              </div>
            )}

            {/* Description */}
            <div className="prose prose-gray max-w-none">
              <h2 className="text-xl font-bold text-gray-900 mb-4">소개</h2>
              <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                {ebook.description || '소개가 없습니다.'}
              </p>
            </div>

            {/* Instructor Info */}
            {ebook.profiles && (
              <div className="rounded-2xl bg-white p-6 shadow-sm">
                <h2 className="text-lg font-bold text-gray-900 mb-4">저자</h2>
                <div className="flex items-center gap-4">
                  <div className="relative h-16 w-16 overflow-hidden rounded-full bg-gray-100">
                    {ebook.profiles.avatar_url ? (
                      <Image
                        src={ebook.profiles.avatar_url}
                        alt={ebook.profiles.name || '저자'}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-orange-100 to-yellow-100 text-2xl">
                        👤
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{ebook.profiles.name || '강사'}</p>
                    <p className="text-sm text-gray-500">E-book 저자</p>
                  </div>
                </div>
              </div>
            )}

            {/* Preview Section */}
            {ebook.preview_pdf_path && (
              <div className="rounded-2xl bg-white p-6 shadow-sm">
                <h2 className="text-lg font-bold text-gray-900 mb-4">미리보기</h2>
                <p className="text-gray-600 mb-4">
                  구매 전 5페이지를 미리 확인해 보세요.
                </p>
                <a
                  href={ebook.preview_pdf_path}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border-2 border-orange-500 px-6 py-3 text-sm font-semibold text-orange-500 hover:bg-orange-50 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  미리보기 PDF 열기
                </a>
              </div>
            )}
          </div>

          {/* Right: Purchase Card */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 rounded-2xl bg-white p-6 shadow-lg">
              {/* Price */}
              <div className="mb-6">
                <span className="text-sm text-gray-500">가격</span>
                <p className={`text-3xl font-bold ${ebook.price === 0 ? 'text-green-600' : 'text-gray-900'}`}>
                  {formatPrice(ebook.price)}
                </p>
              </div>

              {/* Info */}
              <div className="mb-6 space-y-3 text-sm">
                {ebook.page_count && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">페이지 수</span>
                    <span className="font-medium text-gray-900">{ebook.page_count}페이지</span>
                  </div>
                )}
                {ebook.file_size_bytes && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">파일 크기</span>
                    <span className="font-medium text-gray-900">{formatFileSize(ebook.file_size_bytes)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">형식</span>
                  <span className="font-medium text-gray-900">PDF</span>
                </div>
              </div>

              {/* Purchase Button */}
              <EbookPurchaseButton
                ebookId={ebook.id}
                ebookTitle={ebook.title}
                price={ebook.price}
              />

              {/* Features */}
              <div className="mt-6 space-y-2 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  구매 후 즉시 다운로드
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  무제한 재다운로드
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  평생 소장 가능
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

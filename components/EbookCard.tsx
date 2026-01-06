'use client'

import Image from 'next/image'
import Link from 'next/link'
import type { EbookWithTags } from '@/types/ebook'

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

interface EbookCardProps {
  ebook: EbookWithTags
}

export default function EbookCard({ ebook }: EbookCardProps) {
  return (
    <Link href={`/ebooks/${ebook.id}`}>
      <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl bg-white shadow-md transition-all duration-300 hover:shadow-xl hover:-translate-y-1 cursor-pointer">
        {/* Thumbnail */}
        <div className="relative aspect-[3/4] overflow-hidden bg-gradient-to-br from-gray-50 to-gray-100">
          {ebook.thumbnail ? (
            <Image
              src={ebook.thumbnail}
              alt={ebook.title}
              fill
              className="object-contain transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-gradient-to-br from-orange-100 to-yellow-100">
              <span className="text-6xl">📚</span>
            </div>
          )}
          {/* Category Badge */}
          <div className="absolute top-3 left-3">
            <span className="inline-flex items-center rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-gray-700 backdrop-blur-sm">
              {ebook.category}
            </span>
          </div>
          {/* E-book Badge */}
          <div className="absolute top-3 right-3">
            <span className="inline-flex items-center rounded-full bg-blue-500 px-2 py-1 text-xs font-medium text-white">
              E-book
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="flex flex-1 flex-col p-5">
          {/* Level & Tags */}
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {ebook.level && (
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getLevelBadgeColor(ebook.level)}`}
              >
                {ebook.level}
              </span>
            )}
            {ebook.page_count && (
              <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                {ebook.page_count}페이지
              </span>
            )}
            {ebook.tags && ebook.tags.slice(0, 2).map(tag => (
              <span
                key={tag.id}
                className="inline-flex items-center rounded-full bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-600"
              >
                #{tag.name}
              </span>
            ))}
          </div>

          {/* Title */}
          <h2 className="mb-1 text-lg font-bold text-gray-900 line-clamp-2 group-hover:text-orange-600 transition-colors">
            {ebook.title}
          </h2>

          {/* Rating */}
          {ebook.rating ? (
            <div className="flex items-center gap-1.5 mb-2">
              <div className="flex items-center">
                <svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                <span className="ml-1 text-sm font-medium text-gray-900">{ebook.rating.average}</span>
              </div>
              <span className="text-xs text-gray-400">({ebook.rating.count})</span>
            </div>
          ) : (
            <div className="mb-2 h-5" />
          )}

          {/* Description */}
          <p className="mb-4 flex-1 text-sm text-gray-600 line-clamp-2">
            {ebook.description}
          </p>

          {/* Price & Info */}
          <div className="flex items-center justify-between border-t pt-4">
            <div className="flex flex-col">
              <span className="text-xs text-gray-500">가격</span>
              <span className={`text-lg font-bold ${ebook.price === 0 ? 'text-green-600' : 'text-gray-900'}`}>
                {formatPrice(ebook.price)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {ebook.file_size_bytes && (
                <span className="text-xs text-gray-400">
                  {formatFileSize(ebook.file_size_bytes)}
                </span>
              )}
              <span className="rounded-full bg-gradient-to-r from-orange-500 to-yellow-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg hover:from-orange-600 hover:to-yellow-600">
                구매하기
              </span>
            </div>
          </div>
        </div>
      </article>
    </Link>
  )
}

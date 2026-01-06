'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import type { Ebook } from '@/types/ebook'

function formatPrice(price: number) {
  if (price === 0) return '무료'
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW',
  }).format(price)
}

export default function InstructorEbooksPage() {
  const [ebooks, setEbooks] = useState<Ebook[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchEbooks() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('ebooks')
        .select('*')
        .eq('instructor', user.id)
        .order('created_at', { ascending: false })

      if (data) {
        setEbooks(data)
      }
      setIsLoading(false)
    }

    fetchEbooks()
  }, [])

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-8 w-32 bg-gray-200 rounded animate-pulse" />
          <div className="h-10 w-40 bg-gray-200 rounded-lg animate-pulse" />
        </div>
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-gray-200 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">내 E-book</h1>
        <Link
          href="/instructor/ebooks/new"
          className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-orange-500 to-yellow-500 px-4 py-2 text-sm font-semibold text-white shadow-md hover:from-orange-600 hover:to-yellow-600"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          새 E-book 등록
        </Link>
      </div>

      {ebooks.length === 0 ? (
        <div className="rounded-xl bg-white p-12 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-orange-100">
            <span className="text-3xl">📚</span>
          </div>
          <h2 className="mb-2 text-lg font-semibold text-gray-900">
            아직 등록한 E-book이 없습니다
          </h2>
          <p className="mb-6 text-gray-600">
            첫 번째 E-book을 등록하고 판매를 시작해 보세요!
          </p>
          <Link
            href="/instructor/ebooks/new"
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-orange-500 to-yellow-500 px-6 py-3 text-sm font-semibold text-white shadow-md hover:from-orange-600 hover:to-yellow-600"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            E-book 등록하기
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {ebooks.map((ebook) => (
            <Link
              key={ebook.id}
              href={`/instructor/ebooks/${ebook.id}`}
              className="flex items-center gap-4 rounded-xl bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
            >
              {/* Thumbnail */}
              <div className="relative h-24 w-18 flex-shrink-0 overflow-hidden rounded-lg bg-gray-100">
                {ebook.thumbnail ? (
                  <Image
                    src={ebook.thumbnail}
                    alt={ebook.title}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center bg-gradient-to-br from-orange-100 to-yellow-100">
                    <span className="text-2xl">📚</span>
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    ebook.published ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {ebook.published ? '판매중' : '비공개'}
                  </span>
                  <span className="text-xs text-gray-500">{ebook.category}</span>
                </div>
                <h2 className="font-semibold text-gray-900 truncate">{ebook.title}</h2>
                <div className="mt-1 flex items-center gap-4 text-sm text-gray-500">
                  {ebook.page_count && (
                    <span>{ebook.page_count}페이지</span>
                  )}
                  <span className="font-medium text-gray-900">
                    {formatPrice(ebook.price)}
                  </span>
                </div>
              </div>

              {/* Arrow */}
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

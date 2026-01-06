'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import EbookDownloadButton from '@/components/EbookDownloadButton'

interface PurchasedEbook {
  id: string
  ebook_id: string
  download_count: number
  last_downloaded_at: string | null
  created_at: string
  ebook: {
    id: string
    title: string
    description: string | null
    thumbnail: string | null
    category: string
    page_count: number | null
  }
}

export default function MyEbooksPage() {
  const router = useRouter()
  const [ebooks, setEbooks] = useState<PurchasedEbook[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchPurchasedEbooks() {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login?redirect=/my-ebooks')
        return
      }

      const { data } = await supabase
        .from('ebook_purchases')
        .select(`
          id,
          ebook_id,
          download_count,
          last_downloaded_at,
          created_at,
          ebook:ebook_id (
            id,
            title,
            description,
            thumbnail,
            category,
            page_count
          )
        `)
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })

      if (data) {
        setEbooks(data as unknown as PurchasedEbook[])
      }
      setIsLoading(false)
    }

    fetchPurchasedEbooks()
  }, [router])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-6xl px-4 py-8">
          <div className="h-10 w-40 bg-gray-200 rounded animate-pulse mb-8" />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-64 bg-gray-200 rounded-xl animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">내 E-book</h1>
          <p className="text-gray-600 mt-1">구매한 E-book을 다운로드할 수 있습니다.</p>
        </div>

        {ebooks.length === 0 ? (
          <div className="rounded-xl bg-white p-12 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-orange-100">
              <span className="text-3xl">📚</span>
            </div>
            <h2 className="mb-2 text-lg font-semibold text-gray-900">
              아직 구매한 E-book이 없습니다
            </h2>
            <p className="mb-6 text-gray-600">
              다양한 E-book을 둘러보고 구매해 보세요!
            </p>
            <Link
              href="/ebooks"
              className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-orange-500 to-yellow-500 px-6 py-3 text-sm font-semibold text-white shadow-md hover:from-orange-600 hover:to-yellow-600"
            >
              E-book 둘러보기
            </Link>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {ebooks.map((purchase) => (
              <div
                key={purchase.id}
                className="rounded-xl bg-white shadow-sm overflow-hidden"
              >
                {/* Thumbnail */}
                <Link href={`/ebooks/${purchase.ebook.id}`}>
                  <div className="relative aspect-[4/3] bg-gray-100">
                    {purchase.ebook.thumbnail ? (
                      <Image
                        src={purchase.ebook.thumbnail}
                        alt={purchase.ebook.title}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center bg-gradient-to-br from-orange-100 to-yellow-100">
                        <span className="text-5xl">📚</span>
                      </div>
                    )}
                  </div>
                </Link>

                {/* Content */}
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                      E-book
                    </span>
                    <span className="text-xs text-gray-500">{purchase.ebook.category}</span>
                  </div>

                  <Link href={`/ebooks/${purchase.ebook.id}`}>
                    <h2 className="font-semibold text-gray-900 hover:text-orange-500 transition-colors line-clamp-2 mb-2">
                      {purchase.ebook.title}
                    </h2>
                  </Link>

                  <div className="text-xs text-gray-500 mb-4 space-y-1">
                    {purchase.ebook.page_count && (
                      <p>{purchase.ebook.page_count}페이지</p>
                    )}
                    <p>구매일: {new Date(purchase.created_at).toLocaleDateString('ko-KR')}</p>
                    {purchase.download_count > 0 && (
                      <p>다운로드 {purchase.download_count}회</p>
                    )}
                  </div>

                  <EbookDownloadButton
                    ebookId={purchase.ebook.id}
                    ebookTitle={purchase.ebook.title}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

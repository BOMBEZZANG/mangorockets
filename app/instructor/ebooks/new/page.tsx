'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import ThumbnailUploader from '@/components/ThumbnailUploader'
import EbookUploader from '@/components/EbookUploader'

const CATEGORIES = ['디지털 마케팅', '콘텐츠 마케팅', 'SNS 마케팅', '퍼포먼스 마케팅', '브랜드 마케팅', '바이브 코딩', '자동화 프로그램', '기타']
const LEVELS = ['입문', '중급', '고급']

export default function NewEbookPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tags, setTags] = useState<{ id: string; name: string }[]>([])

  // Form state
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [level, setLevel] = useState('')
  const [price, setPrice] = useState('')
  const [thumbnail, setThumbnail] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [pdfUploaded, setPdfUploaded] = useState(false)
  const [ebookId, setEbookId] = useState<string | null>(null)
  const [pageCount, setPageCount] = useState<number | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  // Fetch tags
  useEffect(() => {
    async function fetchTags() {
      const { data } = await supabase
        .from('tags')
        .select('id, name')
        .order('name')

      if (data) {
        setTags(data)
      }
    }
    fetchTags()
  }, [])

  // Create initial ebook record
  useEffect(() => {
    async function createEbook() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data, error } = await supabase
        .from('ebooks')
        .insert({
          title: '새 E-book',
          category: '기타',
          price: 0,
          instructor: user.id,
          published: false,
        })
        .select('id')
        .single()

      if (error) {
        setError('E-book 생성에 실패했습니다.')
        return
      }

      setEbookId(data.id)
    }

    createEbook()
  }, [router])

  function handleTagToggle(tagId: string) {
    setSelectedTags((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId]
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!ebookId) {
      setError('E-book이 생성되지 않았습니다.')
      return
    }

    if (!title.trim()) {
      setError('제목을 입력해주세요.')
      return
    }

    if (!category) {
      setError('카테고리를 선택해주세요.')
      return
    }

    if (!pdfUploaded) {
      setError('PDF 파일을 업로드해주세요.')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // Update ebook
      const { error: updateError } = await supabase
        .from('ebooks')
        .update({
          title: title.trim(),
          description: description.trim() || null,
          category,
          level: level || null,
          price: parseInt(price) || 0,
          thumbnail: thumbnail || null,
        })
        .eq('id', ebookId)

      if (updateError) throw updateError

      // Handle tags
      if (selectedTags.length > 0) {
        // Delete existing tags
        await supabase
          .from('ebook_tags')
          .delete()
          .eq('ebook_id', ebookId)

        // Insert new tags
        const tagInserts = selectedTags.map((tagId) => ({
          ebook_id: ebookId,
          tag_id: tagId,
        }))

        await supabase.from('ebook_tags').insert(tagInserts)
      }

      router.push(`/instructor/ebooks/${ebookId}`)

    } catch (err) {
      console.error('Error saving ebook:', err)
      setError('저장 중 오류가 발생했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  if (!ebookId) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">새 E-book 등록</h1>
        <p className="text-gray-600 mt-1">E-book 정보를 입력하고 PDF 파일을 업로드하세요.</p>
      </div>

      {error && (
        <div className="mb-6 rounded-lg bg-red-50 p-4 text-red-600">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            제목 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="E-book 제목을 입력하세요"
            className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
            required
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            설명
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="E-book에 대한 설명을 입력하세요"
            rows={5}
            className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          />
        </div>

        {/* Category & Level */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              카테고리 <span className="text-red-500">*</span>
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
              required
            >
              <option value="">선택하세요</option>
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              난이도
            </label>
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
            >
              <option value="">선택하세요</option>
              {LEVELS.map((lvl) => (
                <option key={lvl} value={lvl}>{lvl}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Price */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            가격 (원)
          </label>
          <input
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="0 (무료)"
            min="0"
            step="100"
            className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          />
          <p className="mt-1 text-sm text-gray-500">0원으로 설정하면 무료 E-book이 됩니다.</p>
        </div>

        {/* Tags */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            태그
          </label>
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <button
                key={tag.id}
                type="button"
                onClick={() => handleTagToggle(tag.id)}
                className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                  selectedTags.includes(tag.id)
                    ? 'bg-orange-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                #{tag.name}
              </button>
            ))}
          </div>
        </div>

        {/* Thumbnail */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            썸네일 이미지
          </label>
          <ThumbnailUploader
            value={thumbnail}
            onChange={setThumbnail}
          />
        </div>

        {/* PDF Upload */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            PDF 파일 <span className="text-red-500">*</span>
          </label>
          <EbookUploader
            ebookId={ebookId}
            currentPreviewUrl={previewUrl}
            onUploadComplete={(result) => {
              setPdfUploaded(true)
              setPageCount(result.pageCount)
              setPreviewUrl(result.previewPdfUrl)
            }}
            onUploadError={(err) => setError(err)}
          />
          {pageCount && (
            <p className="mt-2 text-sm text-green-600">
              ✓ {pageCount}페이지 PDF 업로드 완료
            </p>
          )}
        </div>

        {/* Submit Buttons */}
        <div className="flex gap-4 pt-4">
          <button
            type="button"
            onClick={() => router.push('/instructor/ebooks')}
            className="flex-1 rounded-lg border border-gray-300 py-3 font-semibold text-gray-700 hover:bg-gray-50"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="flex-1 rounded-lg bg-gradient-to-r from-orange-500 to-yellow-500 py-3 font-semibold text-white shadow-md hover:from-orange-600 hover:to-yellow-600 disabled:opacity-50"
          >
            {isLoading ? '저장 중...' : '저장하고 계속'}
          </button>
        </div>
      </form>
    </div>
  )
}

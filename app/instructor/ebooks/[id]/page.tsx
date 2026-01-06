'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import ThumbnailUploader from '@/components/ThumbnailUploader'
import EbookUploader from '@/components/EbookUploader'
import type { Ebook } from '@/types/ebook'

const CATEGORIES = ['디지털 마케팅', '콘텐츠 마케팅', 'SNS 마케팅', '퍼포먼스 마케팅', '브랜드 마케팅', '이메일 마케팅', 'SEO 마케팅', '마케팅 자동화', '기타']
const LEVELS = ['입문', '중급', '고급']

export default function EditEbookPage() {
  const router = useRouter()
  const params = useParams()
  const ebookId = params.id as string

  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [tags, setTags] = useState<{ id: string; name: string }[]>([])

  // Form state
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [level, setLevel] = useState('')
  const [price, setPrice] = useState('')
  const [thumbnail, setThumbnail] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [published, setPublished] = useState(false)
  const [pageCount, setPageCount] = useState<number | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [fullPdfPath, setFullPdfPath] = useState<string | null>(null)

  // Fetch ebook and tags
  useEffect(() => {
    async function fetchData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      // Fetch ebook
      const { data: ebook, error: ebookError } = await supabase
        .from('ebooks')
        .select('*')
        .eq('id', ebookId)
        .eq('instructor', user.id)
        .single()

      if (ebookError || !ebook) {
        setError('E-book을 찾을 수 없습니다.')
        setIsLoading(false)
        return
      }

      setTitle(ebook.title)
      setDescription(ebook.description || '')
      setCategory(ebook.category)
      setLevel(ebook.level || '')
      setPrice(ebook.price.toString())
      setThumbnail(ebook.thumbnail || '')
      setPublished(ebook.published)
      setPageCount(ebook.page_count)
      setPreviewUrl(ebook.preview_pdf_path)
      setFullPdfPath(ebook.full_pdf_path)

      // Fetch tags
      const { data: allTags } = await supabase
        .from('tags')
        .select('id, name')
        .order('name')

      if (allTags) {
        setTags(allTags)
      }

      // Fetch ebook tags
      const { data: ebookTags } = await supabase
        .from('ebook_tags')
        .select('tag_id')
        .eq('ebook_id', ebookId)

      if (ebookTags) {
        setSelectedTags(ebookTags.map((t) => t.tag_id))
      }

      setIsLoading(false)
    }

    fetchData()
  }, [ebookId, router])

  function handleTagToggle(tagId: string) {
    setSelectedTags((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId]
    )
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()

    if (!title.trim()) {
      setError('제목을 입력해주세요.')
      return
    }

    if (!category) {
      setError('카테고리를 선택해주세요.')
      return
    }

    setIsSaving(true)
    setError(null)
    setSuccess(null)

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
      await supabase
        .from('ebook_tags')
        .delete()
        .eq('ebook_id', ebookId)

      if (selectedTags.length > 0) {
        const tagInserts = selectedTags.map((tagId) => ({
          ebook_id: ebookId,
          tag_id: tagId,
        }))

        await supabase.from('ebook_tags').insert(tagInserts)
      }

      setSuccess('저장되었습니다.')
      setTimeout(() => setSuccess(null), 3000)

    } catch (err) {
      console.error('Error saving ebook:', err)
      setError('저장 중 오류가 발생했습니다.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handlePublish() {
    if (!fullPdfPath) {
      setError('PDF 파일을 먼저 업로드해주세요.')
      return
    }

    if (!pageCount || pageCount < 20) {
      setError('최소 20페이지 이상의 PDF가 필요합니다.')
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      const { error: updateError } = await supabase
        .from('ebooks')
        .update({ published: true })
        .eq('id', ebookId)

      if (updateError) throw updateError

      setPublished(true)
      setSuccess('E-book이 공개되었습니다.')
      setTimeout(() => setSuccess(null), 3000)

    } catch (err) {
      console.error('Error publishing ebook:', err)
      setError('공개 처리 중 오류가 발생했습니다.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleUnpublish() {
    setIsSaving(true)
    setError(null)

    try {
      const { error: updateError } = await supabase
        .from('ebooks')
        .update({ published: false })
        .eq('id', ebookId)

      if (updateError) throw updateError

      setPublished(false)
      setSuccess('E-book이 비공개되었습니다.')
      setTimeout(() => setSuccess(null), 3000)

    } catch (err) {
      console.error('Error unpublishing ebook:', err)
      setError('비공개 처리 중 오류가 발생했습니다.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete() {
    if (!confirm('정말 이 E-book을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
      return
    }

    setIsSaving(true)

    try {
      const { error: deleteError } = await supabase
        .from('ebooks')
        .delete()
        .eq('id', ebookId)

      if (deleteError) throw deleteError

      router.push('/instructor/ebooks')

    } catch (err) {
      console.error('Error deleting ebook:', err)
      setError('삭제 중 오류가 발생했습니다.')
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
      </div>
    )
  }

  if (error && !title) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 mb-4">{error}</p>
        <button
          onClick={() => router.push('/instructor/ebooks')}
          className="text-orange-500 hover:text-orange-600 font-medium"
        >
          ← 목록으로 돌아가기
        </button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">E-book 수정</h1>
          <div className="mt-1 flex items-center gap-2">
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
              published ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
            }`}>
              {published ? '판매중' : '비공개'}
            </span>
            {pageCount && (
              <span className="text-sm text-gray-500">{pageCount}페이지</span>
            )}
          </div>
        </div>
        <button
          onClick={() => router.push('/instructor/ebooks')}
          className="text-gray-500 hover:text-gray-700"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {error && (
        <div className="mb-6 rounded-lg bg-red-50 p-4 text-red-600">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-6 rounded-lg bg-green-50 p-4 text-green-600">
          {success}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
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
            PDF 파일
          </label>
          <EbookUploader
            ebookId={ebookId}
            currentPreviewUrl={previewUrl}
            onUploadComplete={(result) => {
              setPageCount(result.pageCount)
              setPreviewUrl(result.previewPdfUrl)
              setFullPdfPath(result.fullPdfPath)
            }}
            onUploadError={(err) => setError(err)}
          />
        </div>

        {/* Save Button */}
        <div className="flex gap-4 pt-4">
          <button
            type="submit"
            disabled={isSaving}
            className="flex-1 rounded-lg bg-gradient-to-r from-orange-500 to-yellow-500 py-3 font-semibold text-white shadow-md hover:from-orange-600 hover:to-yellow-600 disabled:opacity-50"
          >
            {isSaving ? '저장 중...' : '변경사항 저장'}
          </button>
        </div>

        {/* Publish/Unpublish */}
        <div className="border-t pt-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">공개 설정</h3>
          {published ? (
            <div className="flex items-center justify-between rounded-lg bg-green-50 p-4">
              <div>
                <p className="font-medium text-green-800">현재 판매중입니다</p>
                <p className="text-sm text-green-600">이 E-book은 구매자에게 공개되어 있습니다.</p>
              </div>
              <button
                type="button"
                onClick={handleUnpublish}
                disabled={isSaving}
                className="rounded-lg border border-yellow-500 px-4 py-2 text-sm font-medium text-yellow-600 hover:bg-yellow-50 disabled:opacity-50"
              >
                비공개로 전환
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between rounded-lg bg-yellow-50 p-4">
              <div>
                <p className="font-medium text-yellow-800">현재 비공개입니다</p>
                <p className="text-sm text-yellow-600">공개하면 구매자가 이 E-book을 볼 수 있습니다.</p>
              </div>
              <button
                type="button"
                onClick={handlePublish}
                disabled={isSaving || !fullPdfPath}
                className="rounded-lg bg-green-500 px-4 py-2 text-sm font-medium text-white hover:bg-green-600 disabled:opacity-50"
              >
                공개하기
              </button>
            </div>
          )}
        </div>

        {/* Delete */}
        <div className="border-t pt-6">
          <h3 className="text-lg font-semibold text-red-600 mb-4">위험 구역</h3>
          <div className="flex items-center justify-between rounded-lg bg-red-50 p-4">
            <div>
              <p className="font-medium text-red-800">E-book 삭제</p>
              <p className="text-sm text-red-600">이 작업은 되돌릴 수 없습니다.</p>
            </div>
            <button
              type="button"
              onClick={handleDelete}
              disabled={isSaving}
              className="rounded-lg border border-red-500 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-100 disabled:opacity-50"
            >
              삭제하기
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}

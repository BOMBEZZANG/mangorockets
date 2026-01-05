'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface Tag {
  id: string
  category: string
  name: string
}

interface TagSelectorProps {
  selectedTags: string[]
  onTagsChange: (tagIds: string[]) => void
  maxTags?: number
  minTags?: number
}

// 카테고리 순서 및 표시 이름
const CATEGORY_ORDER = [
  '메이크업',
  '스킨케어',
  '헤어',
  '네일',
  '왁싱',
  '퍼스널 컬러',
  '뷰티 창업',
  '마케팅',
  '기타',
]

export default function TagSelector({
  selectedTags,
  onTagsChange,
  maxTags = 5,
  minTags = 1,
}: TagSelectorProps) {
  const [tags, setTags] = useState<Tag[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  // 태그 로드
  useEffect(() => {
    const loadTags = async () => {
      setError(null)
      const { data, error: fetchError } = await supabase
        .from('tags')
        .select('*')
        .order('category')
        .order('name')

      if (fetchError) {
        console.error('태그 로드 실패:', fetchError)
        setError('태그를 불러오는데 실패했습니다. 새로고침 해주세요.')
      } else if (data) {
        setTags(data)
      }
      setIsLoading(false)
    }

    loadTags()
  }, [])

  // 카테고리별 태그 그룹화
  const tagsByCategory = tags.reduce((acc, tag) => {
    if (!acc[tag.category]) {
      acc[tag.category] = []
    }
    acc[tag.category].push(tag)
    return acc
  }, {} as Record<string, Tag[]>)

  // 태그 선택/해제
  const toggleTag = (tagId: string) => {
    if (selectedTags.includes(tagId)) {
      onTagsChange(selectedTags.filter(id => id !== tagId))
    } else {
      if (selectedTags.length < maxTags) {
        onTagsChange([...selectedTags, tagId])
      }
    }
  }

  // 선택된 태그 정보 가져오기
  const getSelectedTagInfo = () => {
    return selectedTags.map(id => tags.find(t => t.id === id)).filter(Boolean) as Tag[]
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-orange-500 border-t-transparent"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-center">
        <p className="text-red-600 text-sm">{error}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-2 text-sm text-red-500 hover:text-red-700 underline"
        >
          새로고침
        </button>
      </div>
    )
  }

  if (tags.length === 0) {
    return (
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-xl text-center">
        <p className="text-yellow-700 text-sm">등록된 태그가 없습니다. 관리자에게 문의해주세요.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* 선택된 태그 표시 */}
      <div className="flex flex-wrap gap-2 min-h-[40px] p-3 bg-gray-50 rounded-xl border border-gray-200">
        {selectedTags.length === 0 ? (
          <span className="text-sm text-gray-400">태그를 선택해주세요 (최소 {minTags}개, 최대 {maxTags}개)</span>
        ) : (
          getSelectedTagInfo().map(tag => (
            <span
              key={tag.id}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-orange-500 to-yellow-500 text-white rounded-full text-sm font-medium"
            >
              #{tag.name}
              <button
                type="button"
                onClick={() => toggleTag(tag.id)}
                className="ml-1 hover:bg-white/20 rounded-full p-0.5 transition-colors"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          ))
        )}
      </div>

      {/* 태그 수 카운터 */}
      <div className="flex items-center justify-between text-sm">
        <span className={`${selectedTags.length < minTags ? 'text-red-500' : 'text-gray-500'}`}>
          {selectedTags.length}/{maxTags} 선택됨
          {selectedTags.length < minTags && ` (최소 ${minTags}개 필요)`}
        </span>
        {selectedTags.length > 0 && (
          <button
            type="button"
            onClick={() => onTagsChange([])}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            전체 해제
          </button>
        )}
      </div>

      {/* 카테고리 탭 */}
      <div className="flex flex-wrap gap-2">
        {CATEGORY_ORDER.filter(cat => tagsByCategory[cat]).map(category => (
          <button
            key={category}
            type="button"
            onClick={() => setSelectedCategory(selectedCategory === category ? null : category)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
              selectedCategory === category
                ? 'bg-gradient-to-r from-orange-500 to-yellow-500 text-white shadow-md'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {category}
            {tagsByCategory[category]?.some(t => selectedTags.includes(t.id)) && (
              <span className="ml-1.5 inline-flex items-center justify-center w-5 h-5 bg-white/30 rounded-full text-xs">
                {tagsByCategory[category].filter(t => selectedTags.includes(t.id)).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* 선택된 카테고리의 태그들 */}
      {selectedCategory && tagsByCategory[selectedCategory] && (
        <div className="p-4 bg-white border border-gray-200 rounded-xl animate-fadeIn">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm font-medium text-gray-700">{selectedCategory}</span>
            <span className="text-xs text-gray-400">클릭하여 선택</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {tagsByCategory[selectedCategory].map(tag => {
              const isSelected = selectedTags.includes(tag.id)
              const isDisabled = !isSelected && selectedTags.length >= maxTags

              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => !isDisabled && toggleTag(tag.id)}
                  disabled={isDisabled}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                    isSelected
                      ? 'bg-orange-100 text-orange-700 border-2 border-orange-400 shadow-sm'
                      : isDisabled
                      ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                      : 'bg-gray-100 text-gray-600 border-2 border-transparent hover:border-orange-200 hover:bg-orange-50'
                  }`}
                >
                  #{tag.name}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* 전체 태그 미리보기 (카테고리 미선택 시) */}
      {!selectedCategory && (
        <div className="text-center py-6 text-gray-400 text-sm">
          위 카테고리를 클릭하여 태그를 선택하세요
        </div>
      )}
    </div>
  )
}

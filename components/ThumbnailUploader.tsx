'use client'

import { useState, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import Image from 'next/image'

interface ThumbnailUploaderProps {
  value?: string
  onChange: (url: string) => void
  className?: string
}

export default function ThumbnailUploader({
  value,
  onChange,
  className = '',
}: ThumbnailUploaderProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(value || null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const validateFile = (file: File): string | null => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!allowedTypes.includes(file.type)) {
      return 'JPEG, PNG, WebP, GIF 형식만 지원됩니다'
    }

    const maxSize = 5 * 1024 * 1024 // 5MB
    if (file.size > maxSize) {
      return '파일 크기는 5MB 이하여야 합니다'
    }

    return null
  }

  const uploadFile = async (file: File) => {
    const validationError = validateFile(file)
    if (validationError) {
      setError(validationError)
      return
    }

    setError(null)
    setIsUploading(true)

    // 로컬 미리보기 생성
    const localPreview = URL.createObjectURL(file)
    setPreview(localPreview)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        throw new Error('로그인이 필요합니다')
      }

      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/image/upload', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: formData,
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || '업로드에 실패했습니다')
      }

      // Cloudflare URL로 업데이트
      setPreview(result.imageUrl)
      onChange(result.imageUrl)
    } catch (err) {
      setError(err instanceof Error ? err.message : '업로드에 실패했습니다')
      setPreview(value || null)
    } finally {
      setIsUploading(false)
      // 로컬 미리보기 URL 정리
      URL.revokeObjectURL(localPreview)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      uploadFile(file)
    }
  }

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const file = e.dataTransfer.files?.[0]
    if (file) {
      uploadFile(file)
    }
  }, [])

  const handleClick = () => {
    fileInputRef.current?.click()
  }

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation()
    setPreview(null)
    onChange('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className={className}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={handleFileSelect}
        className="hidden"
      />

      <div
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative cursor-pointer rounded-xl border-2 border-dashed transition-all
          ${isDragging
            ? 'border-orange-500 bg-orange-50'
            : preview
              ? 'border-gray-200 bg-gray-50'
              : 'border-gray-300 bg-gray-50 hover:border-orange-400 hover:bg-orange-50/50'
          }
          ${isUploading ? 'pointer-events-none opacity-70' : ''}
        `}
      >
        {preview ? (
          // 이미지 미리보기
          <div className="relative aspect-video">
            <Image
              src={preview}
              alt="썸네일 미리보기"
              fill
              className="rounded-xl object-cover"
              unoptimized
            />
            {/* 오버레이 */}
            <div className="absolute inset-0 bg-black/0 hover:bg-black/40 transition-colors rounded-xl flex items-center justify-center opacity-0 hover:opacity-100">
              <div className="flex gap-3">
                <button
                  type="button"
                  className="px-4 py-2 bg-white text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors"
                >
                  변경하기
                </button>
                <button
                  type="button"
                  onClick={handleRemove}
                  className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 transition-colors"
                >
                  삭제
                </button>
              </div>
            </div>
            {/* 업로드 중 오버레이 */}
            {isUploading && (
              <div className="absolute inset-0 bg-white/80 rounded-xl flex items-center justify-center">
                <div className="flex flex-col items-center gap-2">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-500 border-t-transparent" />
                  <span className="text-sm text-gray-600">업로드 중...</span>
                </div>
              </div>
            )}
          </div>
        ) : (
          // 업로드 영역
          <div className="aspect-video flex flex-col items-center justify-center gap-4 p-6">
            {isUploading ? (
              <>
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-orange-500 border-t-transparent" />
                <span className="text-gray-600">업로드 중...</span>
              </>
            ) : (
              <>
                <div className="w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center">
                  <svg
                    className="w-8 h-8 text-orange-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                </div>
                <div className="text-center">
                  <p className="text-gray-700 font-medium">
                    클릭하거나 이미지를 드래그하세요
                  </p>
                  <p className="text-gray-500 text-sm mt-1">
                    JPEG, PNG, WebP, GIF (최대 5MB)
                  </p>
                </div>
                <p className="text-xs text-gray-400">
                  권장 크기: 1280 x 720px (16:9)
                </p>
              </>
            )}
          </div>
        )}
      </div>

      {error && (
        <p className="mt-2 text-sm text-red-500 flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          {error}
        </p>
      )}
    </div>
  )
}

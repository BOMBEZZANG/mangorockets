'use client'

import { useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import type { PdfUploadResult } from '@/types/ebook'

interface EbookUploaderProps {
  ebookId: string
  currentPreviewUrl?: string | null
  onUploadComplete: (result: PdfUploadResult) => void
  onUploadError: (error: string) => void
}

const MAX_FILE_SIZE = 100 * 1024 * 1024 // 100MB
const MIN_PAGES = 20

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export default function EbookUploader({
  ebookId,
  currentPreviewUrl,
  onUploadComplete,
  onUploadError,
}: EbookUploaderProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentPreviewUrl || null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    // 파일 타입 검증
    if (file.type !== 'application/pdf') {
      onUploadError('PDF 파일만 업로드 가능합니다.')
      return
    }

    // 파일 크기 검증
    if (file.size > MAX_FILE_SIZE) {
      onUploadError(`파일 크기는 ${formatFileSize(MAX_FILE_SIZE)}를 초과할 수 없습니다.`)
      return
    }

    setSelectedFile(file)
  }

  async function handleUpload() {
    if (!selectedFile) return

    setIsUploading(true)
    setUploadProgress(10)

    try {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        onUploadError('로그인이 필요합니다.')
        setIsUploading(false)
        return
      }

      setUploadProgress(20)

      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('ebookId', ebookId)

      setUploadProgress(30)

      const response = await fetch('/api/ebook/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: formData,
      })

      setUploadProgress(80)

      const result = await response.json()

      if (!response.ok) {
        onUploadError(result.error || '업로드에 실패했습니다.')
        setIsUploading(false)
        setUploadProgress(0)
        return
      }

      setUploadProgress(100)
      setPreviewUrl(result.data.previewPdfUrl)
      onUploadComplete(result.data)

      // 파일 선택 초기화
      setSelectedFile(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }

    } catch (error) {
      console.error('업로드 오류:', error)
      onUploadError('업로드 중 오류가 발생했습니다.')
    } finally {
      setIsUploading(false)
      setTimeout(() => setUploadProgress(0), 1000)
    }
  }

  function handleDrop(event: React.DragEvent) {
    event.preventDefault()
    const file = event.dataTransfer.files?.[0]
    if (file) {
      if (file.type !== 'application/pdf') {
        onUploadError('PDF 파일만 업로드 가능합니다.')
        return
      }
      if (file.size > MAX_FILE_SIZE) {
        onUploadError(`파일 크기는 ${formatFileSize(MAX_FILE_SIZE)}를 초과할 수 없습니다.`)
        return
      }
      setSelectedFile(file)
    }
  }

  function handleDragOver(event: React.DragEvent) {
    event.preventDefault()
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-600 mb-2">
        <p>• PDF 파일만 업로드 가능합니다</p>
        <p>• 최소 {MIN_PAGES}페이지 이상이어야 합니다</p>
        <p>• 처음 5페이지가 자동으로 미리보기로 생성됩니다</p>
        <p>• 최대 파일 크기: {formatFileSize(MAX_FILE_SIZE)}</p>
      </div>

      {/* 현재 업로드된 파일 미리보기 */}
      {previewUrl && !selectedFile && (
        <div className="p-4 bg-green-50 rounded-lg border border-green-200">
          <div className="flex items-center gap-3">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1">
              <p className="font-medium text-green-800">PDF 업로드 완료</p>
              <a
                href={previewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-green-600 hover:underline"
              >
                미리보기 PDF 확인하기 →
              </a>
            </div>
          </div>
        </div>
      )}

      {/* 파일 선택 영역 */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onClick={() => fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
          selectedFile
            ? 'border-orange-400 bg-orange-50'
            : 'border-gray-300 hover:border-orange-400 hover:bg-orange-50/50'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          onChange={handleFileSelect}
          className="hidden"
        />

        {selectedFile ? (
          <div className="space-y-2">
            <svg className="w-12 h-12 mx-auto text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="font-medium text-gray-900">{selectedFile.name}</p>
            <p className="text-sm text-gray-500">{formatFileSize(selectedFile.size)}</p>
          </div>
        ) : (
          <div className="space-y-2">
            <svg className="w-12 h-12 mx-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-gray-600">클릭하거나 PDF 파일을 드래그하세요</p>
            <p className="text-sm text-gray-400">PDF (최대 {formatFileSize(MAX_FILE_SIZE)})</p>
          </div>
        )}
      </div>

      {/* 업로드 진행 상태 */}
      {isUploading && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">업로드 중...</span>
            <span className="text-orange-600">{uploadProgress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-gradient-to-r from-orange-500 to-yellow-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* 업로드 버튼 */}
      {selectedFile && !isUploading && (
        <button
          onClick={handleUpload}
          className="w-full py-3 rounded-lg bg-gradient-to-r from-orange-500 to-yellow-500 text-white font-semibold hover:from-orange-600 hover:to-yellow-600 transition-colors"
        >
          PDF 업로드
        </button>
      )}
    </div>
  )
}

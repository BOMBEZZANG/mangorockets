'use client'

import { useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'

interface VideoUploaderProps {
  onUploadComplete: (videoId: string) => void
  onUploadError?: (error: string) => void
}

type UploadStatus = 'idle' | 'preparing' | 'uploading' | 'processing' | 'complete' | 'error'

export default function VideoUploader({ onUploadComplete, onUploadError }: VideoUploaderProps) {
  const [status, setStatus] = useState<UploadStatus>('idle')
  const [progress, setProgress] = useState(0)
  const [errorMessage, setErrorMessage] = useState('')
  const [fileName, setFileName] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  // tus 프로토콜로 청크 업로드
  const uploadWithTus = async (file: File, uploadURL: string, uid: string) => {
    const CHUNK_SIZE = 5 * 1024 * 1024 // 5MB
    const totalSize = file.size
    let offset = 0

    abortControllerRef.current = new AbortController()

    while (offset < totalSize) {
      const chunk = file.slice(offset, offset + CHUNK_SIZE)

      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/offset+octet-stream',
          'Upload-Offset': offset.toString(),
          'Tus-Resumable': '1.0.0',
        }

        const response = await fetch(uploadURL, {
          method: 'PATCH',
          headers,
          body: chunk,
          signal: abortControllerRef.current.signal,
        })

        if (!response.ok) {
          const errorText = await response.text()
          console.error('Cloudflare 응답:', response.status, errorText)
          throw new Error(`업로드 실패: ${response.status} - ${errorText}`)
        }

        // 서버에서 반환한 새 offset 사용
        const newOffset = response.headers.get('Upload-Offset')
        if (newOffset) {
          offset = parseInt(newOffset, 10)
        } else {
          offset += chunk.size
        }

        // 진행률 업데이트
        const percentage = Math.round((offset / totalSize) * 100)
        setProgress(percentage)

      } catch (error) {
        if ((error as Error).name === 'AbortError') {
          return // 취소됨
        }
        throw error
      }
    }

    // 업로드 완료
    setStatus('processing')
    setTimeout(() => {
      setStatus('complete')
      setProgress(100)
      onUploadComplete(uid)
    }, 1000)
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 비디오 파일 검증
    if (!file.type.startsWith('video/')) {
      setErrorMessage('비디오 파일만 업로드할 수 있습니다.')
      setStatus('error')
      return
    }

    // 파일 크기 제한 (2GB)
    const maxSize = 2 * 1024 * 1024 * 1024
    if (file.size > maxSize) {
      setErrorMessage('파일 크기는 2GB 이하여야 합니다.')
      setStatus('error')
      return
    }

    setFileName(file.name)
    setStatus('preparing')
    setProgress(0)
    setErrorMessage('')

    try {
      // 1. Supabase 세션에서 access_token 가져오기
      const { data: { session } } = await supabase.auth.getSession()

      if (!session?.access_token) {
        throw new Error('로그인이 필요합니다.')
      }

      // 2. 서버에서 Direct Creator Upload URL 받기 (tus 프로토콜)
      const response = await fetch('/api/video/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          maxDurationSeconds: 7200, // 최대 2시간
          uploadLength: file.size, // tus 프로토콜에 필요한 파일 크기
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || '업로드 URL을 가져오는데 실패했습니다.')
      }

      const { uploadURL, uid } = await response.json()

      // 3. tus 프로토콜로 업로드 시작
      setStatus('uploading')
      await uploadWithTus(file, uploadURL, uid)

    } catch (error) {
      console.error('업로드 오류:', error)
      setErrorMessage(error instanceof Error ? error.message : '업로드에 실패했습니다.')
      setStatus('error')
      onUploadError?.(error instanceof Error ? error.message : '업로드에 실패했습니다.')
    }
  }

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    setStatus('idle')
    setProgress(0)
    setFileName('')
    setErrorMessage('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleRetry = () => {
    setStatus('idle')
    setProgress(0)
    setErrorMessage('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className="w-full">
      {/* Idle State - 파일 선택 */}
      {status === 'idle' && (
        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-orange-400 hover:bg-orange-50 transition-colors">
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            <svg className="w-8 h-8 mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-sm text-gray-500">
              <span className="font-medium text-orange-500">클릭하여 영상 업로드</span>
            </p>
            <p className="text-xs text-gray-400 mt-1">MP4, MOV, WebM (최대 2GB)</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept="video/*"
            onChange={handleFileSelect}
          />
        </label>
      )}

      {/* Preparing State */}
      {status === 'preparing' && (
        <div className="flex items-center justify-center w-full h-32 border-2 border-gray-200 rounded-xl bg-gray-50">
          <div className="flex items-center gap-3">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-orange-500 border-t-transparent"></div>
            <span className="text-sm text-gray-600">업로드 준비 중...</span>
          </div>
        </div>
      )}

      {/* Uploading State */}
      {status === 'uploading' && (
        <div className="w-full p-4 border-2 border-orange-200 rounded-xl bg-orange-50">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 min-w-0">
              <svg className="w-5 h-5 text-orange-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <span className="text-sm text-gray-700 truncate">{fileName}</span>
            </div>
            <button
              type="button"
              onClick={handleCancel}
              className="text-gray-400 hover:text-red-500 flex-shrink-0"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-orange-500 to-yellow-500 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-gray-500">업로드 중...</span>
            <span className="text-xs font-medium text-orange-600">{progress}%</span>
          </div>
        </div>
      )}

      {/* Processing State */}
      {status === 'processing' && (
        <div className="flex items-center justify-center w-full h-32 border-2 border-purple-200 rounded-xl bg-yellow-50">
          <div className="flex items-center gap-3">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-yellow-500 border-t-transparent"></div>
            <span className="text-sm text-gray-600">영상 처리 중...</span>
          </div>
        </div>
      )}

      {/* Complete State */}
      {status === 'complete' && (
        <div className="flex items-center justify-between w-full p-4 border-2 border-green-200 rounded-xl bg-green-50">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-500">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-green-700">업로드 완료!</p>
              <p className="text-xs text-green-600 truncate max-w-[200px]">{fileName}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleRetry}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            다른 영상
          </button>
        </div>
      )}

      {/* Error State */}
      {status === 'error' && (
        <div className="w-full p-4 border-2 border-red-200 rounded-xl bg-red-50">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-red-500">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <p className="text-sm text-red-700">{errorMessage}</p>
          </div>
          <button
            type="button"
            onClick={handleRetry}
            className="w-full py-2 text-sm font-medium text-red-600 hover:text-red-700"
          >
            다시 시도
          </button>
        </div>
      )}
    </div>
  )
}

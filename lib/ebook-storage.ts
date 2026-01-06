import { createClient } from '@supabase/supabase-js'

// Supabase Admin 클라이언트 (서버 사이드 전용)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// 버킷 이름
export const EBOOK_FILES_BUCKET = 'ebook-files'
export const EBOOK_PREVIEWS_BUCKET = 'ebook-previews'

/**
 * 전체 PDF 파일을 업로드합니다. (Private 버킷)
 */
export async function uploadFullPdf(
  ebookId: string,
  pdfBuffer: Uint8Array | ArrayBuffer
): Promise<{ path: string; error?: string }> {
  const fileName = `${ebookId}.pdf`

  const { error } = await supabaseAdmin.storage
    .from(EBOOK_FILES_BUCKET)
    .upload(fileName, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: true
    })

  if (error) {
    console.error('[Ebook Storage] Full PDF upload error:', error)
    return { path: '', error: error.message }
  }

  return { path: fileName }
}

/**
 * 미리보기 PDF 파일을 업로드합니다. (Public 버킷)
 */
export async function uploadPreviewPdf(
  ebookId: string,
  pdfBuffer: Uint8Array | ArrayBuffer
): Promise<{ path: string; url: string; error?: string }> {
  const fileName = `${ebookId}_preview.pdf`

  const { error } = await supabaseAdmin.storage
    .from(EBOOK_PREVIEWS_BUCKET)
    .upload(fileName, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: true
    })

  if (error) {
    console.error('[Ebook Storage] Preview PDF upload error:', error)
    return { path: '', url: '', error: error.message }
  }

  // Public URL 생성
  const { data: urlData } = supabaseAdmin.storage
    .from(EBOOK_PREVIEWS_BUCKET)
    .getPublicUrl(fileName)

  return {
    path: fileName,
    url: urlData.publicUrl
  }
}

/**
 * 구매자를 위한 서명된 다운로드 URL을 생성합니다.
 * @param path - 파일 경로
 * @param expiresIn - 만료 시간 (초, 기본값: 300 = 5분)
 */
export async function createSignedDownloadUrl(
  path: string,
  expiresIn: number = 300
): Promise<{ url: string; expiresAt: string; error?: string }> {
  const { data, error } = await supabaseAdmin.storage
    .from(EBOOK_FILES_BUCKET)
    .createSignedUrl(path, expiresIn, {
      download: true
    })

  if (error) {
    console.error('[Ebook Storage] Signed URL error:', error)
    return { url: '', expiresAt: '', error: error.message }
  }

  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()

  return {
    url: data.signedUrl,
    expiresAt
  }
}

/**
 * PDF 파일을 삭제합니다.
 */
export async function deletePdfFiles(ebookId: string): Promise<{ error?: string }> {
  // 전체 PDF 삭제
  const { error: fullError } = await supabaseAdmin.storage
    .from(EBOOK_FILES_BUCKET)
    .remove([`${ebookId}.pdf`])

  if (fullError) {
    console.error('[Ebook Storage] Delete full PDF error:', fullError)
  }

  // 미리보기 PDF 삭제
  const { error: previewError } = await supabaseAdmin.storage
    .from(EBOOK_PREVIEWS_BUCKET)
    .remove([`${ebookId}_preview.pdf`])

  if (previewError) {
    console.error('[Ebook Storage] Delete preview PDF error:', previewError)
  }

  if (fullError || previewError) {
    return { error: 'PDF 파일 삭제 중 오류가 발생했습니다.' }
  }

  return {}
}

/**
 * 미리보기 PDF의 공개 URL을 가져옵니다.
 */
export function getPreviewPdfUrl(path: string): string {
  const { data } = supabaseAdmin.storage
    .from(EBOOK_PREVIEWS_BUCKET)
    .getPublicUrl(path)

  return data.publicUrl
}

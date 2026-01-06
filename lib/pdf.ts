import { PDFDocument } from 'pdf-lib'

/**
 * PDF 파일의 페이지 수를 추출합니다.
 */
export async function getPdfPageCount(pdfBuffer: ArrayBuffer): Promise<number> {
  const pdfDoc = await PDFDocument.load(pdfBuffer)
  return pdfDoc.getPageCount()
}

/**
 * PDF에서 처음 N개 페이지를 추출하여 미리보기 PDF를 생성합니다.
 * @param pdfBuffer - 원본 PDF 버퍼
 * @param pageCount - 추출할 페이지 수 (기본값: 5)
 * @returns 미리보기 PDF 버퍼
 */
export async function extractPreviewPages(
  pdfBuffer: ArrayBuffer,
  pageCount: number = 5
): Promise<Uint8Array> {
  const sourcePdf = await PDFDocument.load(pdfBuffer)
  const totalPages = sourcePdf.getPageCount()

  // 추출할 페이지 수 결정 (원본 페이지 수보다 작거나 같아야 함)
  const pagesToExtract = Math.min(pageCount, totalPages)

  // 새 PDF 문서 생성
  const previewPdf = await PDFDocument.create()

  // 페이지 인덱스 배열 생성 (0부터 시작)
  const pageIndices = Array.from({ length: pagesToExtract }, (_, i) => i)

  // 페이지 복사
  const copiedPages = await previewPdf.copyPages(sourcePdf, pageIndices)

  // 복사한 페이지를 새 문서에 추가
  copiedPages.forEach(page => {
    previewPdf.addPage(page)
  })

  // PDF 저장
  return previewPdf.save()
}

/**
 * PDF 파일을 검증합니다.
 * @param pdfBuffer - PDF 버퍼
 * @param minPages - 최소 페이지 수 (기본값: 20)
 * @returns 검증 결과
 */
export async function validatePdf(
  pdfBuffer: ArrayBuffer,
  minPages: number = 20
): Promise<{
  isValid: boolean
  pageCount: number
  error?: string
}> {
  try {
    const pdfDoc = await PDFDocument.load(pdfBuffer)
    const pageCount = pdfDoc.getPageCount()

    if (pageCount < minPages) {
      return {
        isValid: false,
        pageCount,
        error: `PDF는 최소 ${minPages}페이지 이상이어야 합니다. (현재: ${pageCount}페이지)`
      }
    }

    return {
      isValid: true,
      pageCount
    }
  } catch (error) {
    return {
      isValid: false,
      pageCount: 0,
      error: 'PDF 파일을 읽을 수 없습니다. 유효한 PDF 파일인지 확인해주세요.'
    }
  }
}

/**
 * 파일 크기를 사람이 읽기 쉬운 형식으로 변환합니다.
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

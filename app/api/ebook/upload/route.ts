import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { validatePdf, extractPreviewPages } from '@/lib/pdf'
import { uploadFullPdf, uploadPreviewPdf } from '@/lib/ebook-storage'

// Supabase 클라이언트
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// 최대 파일 크기: 100MB
const MAX_FILE_SIZE = 100 * 1024 * 1024
// 최소 페이지 수
const MIN_PAGES = 20
// 미리보기 페이지 수
const PREVIEW_PAGES = 5

export async function POST(request: NextRequest) {
  console.log('[Ebook Upload] 시작')

  try {
    // 1. 인증 확인
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json(
        { error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json(
        { error: '인증에 실패했습니다.' },
        { status: 401 }
      )
    }

    // 2. 강사/관리자 권한 확인
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile || !['instructor', 'admin'].includes(profile.role)) {
      return NextResponse.json(
        { error: '강사 또는 관리자만 E-book을 업로드할 수 있습니다.' },
        { status: 403 }
      )
    }

    // 3. FormData에서 파일 추출
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const ebookId = formData.get('ebookId') as string | null

    if (!file) {
      return NextResponse.json(
        { error: 'PDF 파일이 필요합니다.' },
        { status: 400 }
      )
    }

    if (!ebookId) {
      return NextResponse.json(
        { error: 'E-book ID가 필요합니다.' },
        { status: 400 }
      )
    }

    // 4. 파일 타입 확인
    if (file.type !== 'application/pdf') {
      return NextResponse.json(
        { error: 'PDF 파일만 업로드 가능합니다.' },
        { status: 400 }
      )
    }

    // 5. 파일 크기 확인
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `파일 크기는 ${MAX_FILE_SIZE / 1024 / 1024}MB를 초과할 수 없습니다.` },
        { status: 400 }
      )
    }

    console.log('[Ebook Upload] 파일 정보:', {
      name: file.name,
      size: file.size,
      type: file.type,
      ebookId
    })

    // 6. PDF 읽기 및 검증
    const arrayBuffer = await file.arrayBuffer()
    const validation = await validatePdf(arrayBuffer, MIN_PAGES)

    if (!validation.isValid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      )
    }

    console.log('[Ebook Upload] PDF 검증 완료:', validation.pageCount, '페이지')

    // 7. 미리보기 PDF 생성
    const previewBuffer = await extractPreviewPages(arrayBuffer, PREVIEW_PAGES)
    console.log('[Ebook Upload] 미리보기 생성 완료:', PREVIEW_PAGES, '페이지')

    // 8. 전체 PDF 업로드
    const fullResult = await uploadFullPdf(ebookId, arrayBuffer)
    if (fullResult.error) {
      return NextResponse.json(
        { error: `전체 PDF 업로드 실패: ${fullResult.error}` },
        { status: 500 }
      )
    }
    console.log('[Ebook Upload] 전체 PDF 업로드 완료:', fullResult.path)

    // 9. 미리보기 PDF 업로드
    const previewResult = await uploadPreviewPdf(ebookId, previewBuffer)
    if (previewResult.error) {
      return NextResponse.json(
        { error: `미리보기 PDF 업로드 실패: ${previewResult.error}` },
        { status: 500 }
      )
    }
    console.log('[Ebook Upload] 미리보기 PDF 업로드 완료:', previewResult.path)

    // 10. E-book 레코드 업데이트
    const { error: updateError } = await supabaseAdmin
      .from('ebooks')
      .update({
        full_pdf_path: fullResult.path,
        preview_pdf_path: previewResult.path,
        page_count: validation.pageCount,
        file_size_bytes: file.size
      })
      .eq('id', ebookId)
      .eq('instructor', user.id)

    if (updateError) {
      console.error('[Ebook Upload] E-book 업데이트 오류:', updateError)
      return NextResponse.json(
        { error: 'E-book 정보 업데이트에 실패했습니다.' },
        { status: 500 }
      )
    }

    console.log('[Ebook Upload] 완료')

    return NextResponse.json({
      success: true,
      data: {
        fullPdfPath: fullResult.path,
        previewPdfPath: previewResult.path,
        previewPdfUrl: previewResult.url,
        pageCount: validation.pageCount,
        fileSizeBytes: file.size
      }
    })
  } catch (error) {
    console.error('[Ebook Upload] 오류:', error)
    return NextResponse.json(
      { error: `서버 오류: ${error instanceof Error ? error.message : '알 수 없는 오류'}` },
      { status: 500 }
    )
  }
}

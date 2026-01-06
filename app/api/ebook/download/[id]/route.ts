import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createSignedDownloadUrl } from '@/lib/ebook-storage'

// Supabase 클라이언트
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: ebookId } = await params

  console.log('[Ebook Download] 요청:', ebookId)

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

    // 2. 구매 확인
    const { data: purchase, error: purchaseError } = await supabaseAdmin
      .from('ebook_purchases')
      .select('id, download_count')
      .eq('user_id', user.id)
      .eq('ebook_id', ebookId)
      .single()

    if (purchaseError || !purchase) {
      return NextResponse.json(
        { error: '구매 기록이 없습니다. E-book을 먼저 구매해주세요.' },
        { status: 403 }
      )
    }

    // 3. E-book 정보 조회
    const { data: ebook, error: ebookError } = await supabaseAdmin
      .from('ebooks')
      .select('id, title, full_pdf_path')
      .eq('id', ebookId)
      .single()

    if (ebookError || !ebook || !ebook.full_pdf_path) {
      return NextResponse.json(
        { error: 'E-book을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 4. 서명된 다운로드 URL 생성 (5분 유효)
    const { url, expiresAt, error: urlError } = await createSignedDownloadUrl(
      ebook.full_pdf_path,
      300 // 5분
    )

    if (urlError) {
      return NextResponse.json(
        { error: `다운로드 URL 생성 실패: ${urlError}` },
        { status: 500 }
      )
    }

    // 5. 다운로드 카운트 업데이트
    await supabaseAdmin
      .from('ebook_purchases')
      .update({
        download_count: (purchase.download_count || 0) + 1,
        last_downloaded_at: new Date().toISOString()
      })
      .eq('id', purchase.id)

    console.log('[Ebook Download] 성공:', {
      ebookId,
      userId: user.id,
      downloadCount: (purchase.download_count || 0) + 1
    })

    return NextResponse.json({
      success: true,
      data: {
        downloadUrl: url,
        expiresAt,
        filename: `${ebook.title}.pdf`
      }
    })
  } catch (error) {
    console.error('[Ebook Download] 오류:', error)
    return NextResponse.json(
      { error: `서버 오류: ${error instanceof Error ? error.message : '알 수 없는 오류'}` },
      { status: 500 }
    )
  }
}

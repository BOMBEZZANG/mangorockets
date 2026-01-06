import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Supabase 클라이언트
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(request: NextRequest) {
  console.log('[Ebook Free Enroll] 시작')

  try {
    const body = await request.json()
    const { ebookId } = body

    if (!ebookId) {
      return NextResponse.json(
        { error: 'ebookId가 필요합니다.' },
        { status: 400 }
      )
    }

    // 1. 인증 확인
    const authHeader = request.headers.get('authorization')
    let userId: string | null = null

    if (authHeader) {
      const token = authHeader.replace('Bearer ', '')
      const { data: { user }, error } = await supabase.auth.getUser(token)

      if (!error && user) {
        userId = user.id
      }
    }

    if (!userId) {
      return NextResponse.json(
        { error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    // 2. E-book 정보 확인
    const { data: ebook, error: ebookError } = await supabaseAdmin
      .from('ebooks')
      .select('id, price, title')
      .eq('id', ebookId)
      .single()

    if (ebookError || !ebook) {
      return NextResponse.json(
        { error: 'E-book을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 3. 무료 E-book인지 확인
    if (ebook.price !== 0) {
      return NextResponse.json(
        { error: '무료 E-book이 아닙니다.' },
        { status: 400 }
      )
    }

    // 4. 중복 등록 확인
    const { data: existingPurchase } = await supabaseAdmin
      .from('ebook_purchases')
      .select('id')
      .eq('user_id', userId)
      .eq('ebook_id', ebookId)
      .single()

    if (existingPurchase) {
      return NextResponse.json(
        { error: '이미 등록한 E-book입니다.' },
        { status: 400 }
      )
    }

    // 5. 무료 등록 기록 생성
    const { error: insertError } = await supabaseAdmin
      .from('ebook_purchases')
      .insert({
        user_id: userId,
        ebook_id: ebookId,
        payment_id: `free-ebook-${ebookId}-${userId}-${Date.now()}`,
        amount: 0,
        status: 'completed',
      })

    if (insertError) {
      console.error('[Ebook Free Enroll] 등록 오류:', insertError)
      return NextResponse.json(
        { error: '등록에 실패했습니다.' },
        { status: 500 }
      )
    }

    // 6. 장바구니에서 제거
    await supabaseAdmin
      .from('ebook_cart')
      .delete()
      .eq('user_id', userId)
      .eq('ebook_id', ebookId)

    console.log('[Ebook Free Enroll] 완료:', { userId, ebookId })

    return NextResponse.json({
      success: true,
      message: '무료 E-book에 등록되었습니다.',
      enrollment: {
        userId,
        ebookId,
      },
    })
  } catch (error) {
    console.error('[Ebook Free Enroll] 오류:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

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

// 포트원 API로 결제 정보 조회
async function getPaymentInfo(paymentId: string) {
  const apiSecret = process.env.PORTONE_API_SECRET

  if (!apiSecret) {
    throw new Error('PORTONE_API_SECRET 환경 변수가 설정되지 않았습니다.')
  }

  const response = await fetch(
    `https://api.portone.io/payments/${encodeURIComponent(paymentId)}`,
    {
      method: 'GET',
      headers: {
        'Authorization': `PortOne ${apiSecret}`,
        'Content-Type': 'application/json',
      },
    }
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`포트원 API 오류: ${response.status} - ${errorText}`)
  }

  return response.json()
}

export async function POST(request: NextRequest) {
  console.log('[Ebook Payment] 검증 시작')

  try {
    const body = await request.json()
    const { paymentId, ebookId } = body

    if (!paymentId || !ebookId) {
      return NextResponse.json(
        { error: 'paymentId와 ebookId가 필요합니다.' },
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

    // paymentId에서 userId 추출 (백업)
    if (!userId) {
      const parts = paymentId.split('-')
      if (parts.length >= 12) {
        const userIdParts = parts.slice(6, 11)
        userId = userIdParts.join('-')
      }
    }

    if (!userId) {
      return NextResponse.json(
        { error: '사용자 인증에 실패했습니다.' },
        { status: 401 }
      )
    }

    // 2. 포트원 API로 결제 검증
    let paymentInfo
    try {
      paymentInfo = await getPaymentInfo(paymentId)
    } catch (portoneError) {
      console.error('[Ebook Payment] 포트원 API 오류:', portoneError)
      return NextResponse.json(
        { error: `결제 검증 실패: ${portoneError instanceof Error ? portoneError.message : '알 수 없는 오류'}` },
        { status: 502 }
      )
    }

    // 3. 결제 상태 확인
    if (paymentInfo.status !== 'PAID') {
      return NextResponse.json(
        { error: '결제가 완료되지 않았습니다.', status: paymentInfo.status },
        { status: 400 }
      )
    }

    // 4. E-book 정보 확인
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

    // 5. 결제 금액 검증
    const paidAmount = paymentInfo.amount?.total || paymentInfo.totalAmount
    if (paidAmount !== ebook.price) {
      return NextResponse.json(
        { error: '결제 금액이 일치하지 않습니다.' },
        { status: 400 }
      )
    }

    // 6. 중복 구매 확인
    const { data: existingPurchase } = await supabaseAdmin
      .from('ebook_purchases')
      .select('id')
      .eq('user_id', userId)
      .eq('ebook_id', ebookId)
      .single()

    if (existingPurchase) {
      return NextResponse.json(
        { error: '이미 구매한 E-book입니다.' },
        { status: 400 }
      )
    }

    // 7. 구매 기록 생성
    const { error: insertError } = await supabaseAdmin
      .from('ebook_purchases')
      .insert({
        user_id: userId,
        ebook_id: ebookId,
        payment_id: paymentId,
        amount: ebook.price,
        status: 'completed',
      })

    if (insertError) {
      console.error('[Ebook Payment] 구매 기록 생성 오류:', insertError)
      return NextResponse.json(
        { error: '구매 기록 생성에 실패했습니다.' },
        { status: 500 }
      )
    }

    // 8. 장바구니에서 제거
    await supabaseAdmin
      .from('ebook_cart')
      .delete()
      .eq('user_id', userId)
      .eq('ebook_id', ebookId)

    console.log('[Ebook Payment] 완료:', { userId, ebookId, amount: ebook.price })

    return NextResponse.json({
      success: true,
      message: '결제가 성공적으로 처리되었습니다.',
      purchase: {
        userId,
        ebookId,
        paymentId,
        amount: ebook.price,
      },
    })
  } catch (error) {
    console.error('[Ebook Payment] 오류:', error)
    return NextResponse.json(
      { error: `서버 오류: ${error instanceof Error ? error.message : '알 수 없는 오류'}` },
      { status: 500 }
    )
  }
}

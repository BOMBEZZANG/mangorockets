import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// 서버 사이드용 Supabase 클라이언트 (Service Role Key 사용)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// 일반 Supabase 클라이언트 (사용자 인증용)
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

  console.log('포트원 API 호출:', paymentId)

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
    console.error('포트원 API 오류:', {
      status: response.status,
      statusText: response.statusText,
      body: errorText,
    })
    throw new Error(`포트원 API 오류: ${response.status} - ${errorText}`)
  }

  const data = await response.json()
  console.log('포트원 결제 정보:', JSON.stringify(data, null, 2))
  return data
}

export async function POST(request: NextRequest) {
  console.log('=== 결제 검증 API 시작 ===')

  try {
    const body = await request.json()
    const { paymentId, courseId } = body

    console.log('요청 데이터:', { paymentId, courseId })

    if (!paymentId || !courseId) {
      return NextResponse.json(
        { error: 'paymentId와 courseId가 필요합니다.' },
        { status: 400 }
      )
    }

    // 1. 요청 헤더에서 인증 토큰 확인
    const authHeader = request.headers.get('authorization')
    let userId: string | null = null

    console.log('인증 헤더 확인:', authHeader ? '있음' : '없음')

    if (authHeader) {
      const token = authHeader.replace('Bearer ', '')
      const { data: { user }, error } = await supabase.auth.getUser(token)

      if (error) {
        console.error('Supabase 인증 오류:', error)
      }

      if (!error && user) {
        userId = user.id
        console.log('인증된 사용자:', userId)
      }
    }

    // paymentId에서 userId 추출 (백업)
    if (!userId) {
      const parts = paymentId.split('-')
      console.log('paymentId 파싱:', parts.length, '파트')

      // UUID는 8-4-4-4-12 형식으로 5개의 파트
      // payment(1) + courseId(5) + userId(5) + timestamp(1) = 12 parts
      if (parts.length >= 12) {
        const userIdParts = parts.slice(6, 11)
        userId = userIdParts.join('-')
        console.log('paymentId에서 추출된 userId:', userId)
      }
    }

    if (!userId) {
      console.error('사용자 인증 실패')
      return NextResponse.json(
        { error: '사용자 인증에 실패했습니다.' },
        { status: 401 }
      )
    }

    // 2. 포트원 API로 결제 정보 검증
    console.log('포트원 API 호출 시작...')
    let paymentInfo
    try {
      paymentInfo = await getPaymentInfo(paymentId)
    } catch (portoneError) {
      console.error('포트원 API 호출 실패:', portoneError)
      return NextResponse.json(
        { error: `포트원 결제 검증 실패: ${portoneError instanceof Error ? portoneError.message : '알 수 없는 오류'}` },
        { status: 502 }
      )
    }

    // 3. 결제 상태 확인
    console.log('결제 상태:', paymentInfo.status)
    if (paymentInfo.status !== 'PAID') {
      return NextResponse.json(
        { error: '결제가 완료되지 않았습니다.', status: paymentInfo.status },
        { status: 400 }
      )
    }

    // 4. 강의 정보 확인
    console.log('강의 정보 조회:', courseId)
    const { data: course, error: courseError } = await supabaseAdmin
      .from('courses')
      .select('id, price, title')
      .eq('id', courseId)
      .single()

    if (courseError) {
      console.error('강의 조회 오류:', courseError)
      return NextResponse.json(
        { error: '강의를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    console.log('강의 정보:', course)

    // 5. 결제 금액 검증
    const paidAmount = paymentInfo.amount?.total || paymentInfo.totalAmount
    console.log('금액 비교:', { paid: paidAmount, expected: course.price })

    if (paidAmount !== course.price) {
      console.error('금액 불일치')
      return NextResponse.json(
        { error: '결제 금액이 일치하지 않습니다.' },
        { status: 400 }
      )
    }

    // 6. 이미 구매했는지 확인
    console.log('기존 구매 확인...')
    const { data: existingPurchase, error: purchaseCheckError } = await supabaseAdmin
      .from('purchases')
      .select('id')
      .eq('user_id', userId)
      .eq('course_id', courseId)
      .single()

    if (purchaseCheckError && purchaseCheckError.code !== 'PGRST116') {
      // PGRST116: 결과 없음 (정상적인 경우)
      console.error('구매 확인 오류:', purchaseCheckError)
    }

    if (existingPurchase) {
      console.log('이미 구매한 강의')
      return NextResponse.json(
        { error: '이미 구매한 강의입니다.' },
        { status: 400 }
      )
    }

    // 7. 구매 기록 생성
    console.log('구매 기록 생성...')
    const { data: insertedPurchase, error: insertError } = await supabaseAdmin
      .from('purchases')
      .insert({
        user_id: userId,
        course_id: courseId,
        payment_id: paymentId,
        amount: course.price,
        status: 'completed',
      })
      .select()
      .single()

    if (insertError) {
      console.error('구매 기록 생성 오류:', insertError)
      return NextResponse.json(
        { error: `구매 기록 생성에 실패했습니다: ${insertError.message}` },
        { status: 500 }
      )
    }

    console.log('=== 결제 완료 ===', {
      userId,
      courseId,
      paymentId,
      amount: course.price,
    })

    return NextResponse.json({
      success: true,
      message: '결제가 성공적으로 처리되었습니다.',
      purchase: {
        userId,
        courseId,
        paymentId,
        amount: course.price,
      },
    })
  } catch (error) {
    console.error('결제 검증 오류:', error)
    return NextResponse.json(
      { error: `서버 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}` },
      { status: 500 }
    )
  }
}

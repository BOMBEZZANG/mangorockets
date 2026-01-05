import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// 서버 사이드용 Supabase 클라이언트 (Service Role Key 사용)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// 포트원 API로 결제 정보 조회
async function getPaymentInfo(paymentId: string) {
  const response = await fetch(
    `https://api.portone.io/payments/${encodeURIComponent(paymentId)}`,
    {
      headers: {
        Authorization: `PortOne ${process.env.PORTONE_API_SECRET}`,
      },
    }
  )

  if (!response.ok) {
    throw new Error(`포트원 API 오류: ${response.status}`)
  }

  return response.json()
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { paymentId } = body

    if (!paymentId) {
      return NextResponse.json(
        { error: 'paymentId가 필요합니다.' },
        { status: 400 }
      )
    }

    // 1. 포트원 API로 결제 정보 검증
    const paymentInfo = await getPaymentInfo(paymentId)

    // 2. 결제 상태 확인
    if (paymentInfo.status !== 'PAID') {
      return NextResponse.json(
        { error: '결제가 완료되지 않았습니다.', status: paymentInfo.status },
        { status: 400 }
      )
    }

    // 3. paymentId에서 userId 추출
    // paymentId 형식: payment-{courseId}-{userId}-{timestamp}
    const parts = paymentId.split('-')
    if (parts.length < 4 || parts[0] !== 'payment') {
      return NextResponse.json(
        { error: '잘못된 paymentId 형식입니다.' },
        { status: 400 }
      )
    }

    // UUID는 하이픈이 포함되어 있으므로 courseId 다음부터 timestamp 이전까지가 userId
    // payment-{courseId(UUID)}-{userId(UUID)}-{timestamp}
    // 인덱스: 0: payment, 1-5: courseId(36자), 6-10: userId(36자), 마지막: timestamp
    const courseIdParts = parts.slice(1, 6) // UUID는 5개의 파트로 구성
    const userIdParts = parts.slice(6, 11)

    const courseId = courseIdParts.join('-')
    const userId = userIdParts.join('-')

    if (!userId || userId.length !== 36) {
      // UUID 형식이 아닌 경우 다른 방식으로 파싱 시도
      // paymentId에서 직접 추출이 어려운 경우 포트원 결제 정보의 customData 활용 가능
      console.error('userId 추출 실패:', paymentId)
      return NextResponse.json(
        { error: 'userId를 추출할 수 없습니다.' },
        { status: 400 }
      )
    }

    // 4. profiles 테이블 업데이트
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .upsert(
        {
          id: userId,
          has_paid: true,
        },
        {
          onConflict: 'id',
        }
      )

    if (updateError) {
      console.error('프로필 업데이트 오류:', updateError)
      return NextResponse.json(
        { error: '프로필 업데이트에 실패했습니다.' },
        { status: 500 }
      )
    }

    console.log(`결제 완료 처리: userId=${userId}, paymentId=${paymentId}`)

    return NextResponse.json({
      success: true,
      message: '결제가 성공적으로 처리되었습니다.',
      userId,
      paymentId,
    })
  } catch (error) {
    console.error('Webhook 처리 오류:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { courseId } = body

    if (!courseId) {
      return NextResponse.json(
        { error: 'courseId가 필요합니다.' },
        { status: 400 }
      )
    }

    // 1. 요청 헤더에서 인증 토큰 확인
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

    // 2. 강의 정보 확인
    const { data: course, error: courseError } = await supabaseAdmin
      .from('courses')
      .select('id, price, title')
      .eq('id', courseId)
      .single()

    if (courseError || !course) {
      return NextResponse.json(
        { error: '강의를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 3. 무료 강의인지 확인
    if (course.price !== 0) {
      return NextResponse.json(
        { error: '무료 강의가 아닙니다.' },
        { status: 400 }
      )
    }

    // 4. 이미 등록했는지 확인
    const { data: existingPurchase } = await supabaseAdmin
      .from('purchases')
      .select('id')
      .eq('user_id', userId)
      .eq('course_id', courseId)
      .single()

    if (existingPurchase) {
      return NextResponse.json(
        { error: '이미 등록한 강의입니다.' },
        { status: 400 }
      )
    }

    // 5. 무료 등록 기록 생성
    const { error: insertError } = await supabaseAdmin
      .from('purchases')
      .insert({
        user_id: userId,
        course_id: courseId,
        payment_id: `free-${courseId}-${userId}-${Date.now()}`,
        amount: 0,
        status: 'completed',
      })

    if (insertError) {
      console.error('등록 기록 생성 오류:', insertError)
      return NextResponse.json(
        { error: '등록에 실패했습니다.' },
        { status: 500 }
      )
    }

    console.log(`무료 강의 등록 완료: userId=${userId}, courseId=${courseId}`)

    return NextResponse.json({
      success: true,
      message: '무료 강의에 등록되었습니다.',
      enrollment: {
        userId,
        courseId,
      },
    })
  } catch (error) {
    console.error('무료 등록 오류:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

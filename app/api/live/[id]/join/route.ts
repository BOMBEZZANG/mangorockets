import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { AccessCheckResult } from '@/types/live'

// Supabase Admin 클라이언트
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * 라이브 세션 참여 권한 검증 API
 * POST /api/live/[id]/join
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    console.log('[Live Join API] Checking access for session:', id)

    const body = await request.json().catch(() => ({}))
    const { displayName: clientDisplayName } = body

    // 세션 조회
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('live_sessions')
      .select('*')
      .eq('id', id)
      .single()

    console.log('[Live Join API] Session query result:', { session: session?.id, error: sessionError })

    if (sessionError || !session) {
      console.log('[Live Join API] Session not found')
      const result: AccessCheckResult = {
        allowed: false,
        reason: 'session_not_found',
      }
      return NextResponse.json(result, { status: 404 })
    }

    // 강의 정보 조회
    let course = null
    if (session.course_id) {
      const { data } = await supabaseAdmin
        .from('courses')
        .select('id, title, price')
        .eq('id', session.course_id)
        .single()
      course = data
    }

    // session에 course 정보 추가
    const sessionWithCourse = { ...session, course }

    // 세션 상태 확인 (live 또는 scheduled만 허용)
    if (!['live', 'scheduled'].includes(session.status)) {
      const result: AccessCheckResult = {
        allowed: false,
        reason: 'session_not_live',
        session: sessionWithCourse,
      }
      return NextResponse.json(result)
    }

    // 사용자 정보 확인 (선택적)
    let user = null
    let userProfile = null
    const authHeader = request.headers.get('Authorization')

    if (authHeader?.startsWith('Bearer ')) {
      const accessToken = authHeader.replace('Bearer ', '')
      const { data } = await supabaseAdmin.auth.getUser(accessToken)
      user = data.user

      if (user) {
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('full_name, avatar_url')
          .eq('id', user.id)
          .single()
        userProfile = profile
      }
    }

    // 접근 권한 검증
    if (session.access_type === 'paid') {
      // 로그인 필수
      if (!user) {
        const result: AccessCheckResult = {
          allowed: false,
          reason: 'not_logged_in',
          session: sessionWithCourse,
        }
        return NextResponse.json(result)
      }

      // 강사 본인은 항상 접근 가능
      const isInstructor = user.id === session.instructor_id

      if (!isInstructor) {
        // 강의 연결된 경우 - 구매 여부 확인
        if (session.course_id) {
          const { data: purchase } = await supabaseAdmin
            .from('purchases')
            .select('id')
            .eq('user_id', user.id)
            .eq('course_id', session.course_id)
            .single()

          if (!purchase) {
            const result: AccessCheckResult = {
              allowed: false,
              reason: 'not_purchased',
              session: sessionWithCourse,
            }
            return NextResponse.json(result)
          }
        }
        // 독립 라이브 + paid의 경우: 로그인만 확인 (MVP에서는 별도 결제 없음)
      }
    }

    // 접근 허용 - 참여 정보 생성
    const isHost = user?.id === session.instructor_id
    const displayName = userProfile?.full_name ||
      clientDisplayName ||
      user?.email?.split('@')[0] ||
      'Guest'

    console.log('[Live Join API] Access allowed, creating join info:', {
      isHost,
      displayName,
      roomName: session.room_name
    })

    const result: AccessCheckResult = {
      allowed: true,
      joinInfo: {
        roomName: session.room_name,
        displayName,
        email: user?.email,
        isHost,
      },
      session: sessionWithCourse,
    }

    return NextResponse.json(result)

  } catch (error) {
    console.error('라이브 참여 검증 오류:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

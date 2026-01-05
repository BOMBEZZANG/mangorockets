import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Supabase Admin 클라이언트
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * 라이브 세션 종료 API
 * POST /api/live/[id]/end
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // 인증 확인
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }

    const accessToken = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(accessToken)

    if (userError || !user) {
      return NextResponse.json(
        { error: '유효하지 않은 세션입니다.' },
        { status: 401 }
      )
    }

    // 세션 조회 및 소유권 확인
    const { data: session } = await supabaseAdmin
      .from('live_sessions')
      .select('instructor_id, status, started_at')
      .eq('id', id)
      .single()

    if (!session) {
      return NextResponse.json(
        { error: '라이브 세션을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    if (session.instructor_id !== user.id) {
      return NextResponse.json(
        { error: '본인의 라이브 세션만 종료할 수 있습니다.' },
        { status: 403 }
      )
    }

    // 이미 종료된 세션 확인
    if (session.status === 'ended') {
      return NextResponse.json(
        { error: '이미 종료된 라이브 세션입니다.' },
        { status: 400 }
      )
    }

    // 라이브 종료
    const { data: updatedSession, error: updateError } = await supabaseAdmin
      .from('live_sessions')
      .update({
        status: 'ended',
        ended_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      console.error('라이브 종료 오류:', updateError)
      return NextResponse.json(
        { error: '라이브 종료에 실패했습니다.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      session: updatedSession,
    })

  } catch (error) {
    console.error('라이브 종료 오류:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

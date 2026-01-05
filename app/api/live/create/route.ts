import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { CreateLiveSessionData } from '@/types/live'

// Supabase Admin 클라이언트
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * 라이브 세션 생성 API
 * POST /api/live/create
 */
export async function POST(request: NextRequest) {
  try {
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

    // 강사 권한 확인
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !['instructor', 'admin'].includes(profile.role)) {
      return NextResponse.json(
        { error: '강사만 라이브 세션을 생성할 수 있습니다.' },
        { status: 403 }
      )
    }

    // 요청 바디 파싱
    const body: CreateLiveSessionData = await request.json()
    const { title, description, thumbnail, course_id, scheduled_at, access_type } = body

    if (!title?.trim()) {
      return NextResponse.json(
        { error: '제목을 입력해주세요.' },
        { status: 400 }
      )
    }

    // course_id가 있으면 소유권 확인
    if (course_id) {
      const { data: course } = await supabaseAdmin
        .from('courses')
        .select('id, instructor')
        .eq('id', course_id)
        .single()

      if (!course) {
        return NextResponse.json(
          { error: '강의를 찾을 수 없습니다.' },
          { status: 404 }
        )
      }

      if (course.instructor !== user.id && profile.role !== 'admin') {
        return NextResponse.json(
          { error: '본인의 강의에만 라이브를 연결할 수 있습니다.' },
          { status: 403 }
        )
      }
    }

    // 고유한 room_name 생성
    const roomName = `beautyclass-${crypto.randomUUID()}`

    // 즉시 시작 여부 결정
    const isImmediateStart = !scheduled_at
    const status = isImmediateStart ? 'live' : 'scheduled'
    const startedAt = isImmediateStart ? new Date().toISOString() : null

    // 라이브 세션 생성
    const { data: session, error: insertError } = await supabaseAdmin
      .from('live_sessions')
      .insert({
        instructor_id: user.id,
        course_id: course_id || null,
        title: title.trim(),
        description: description?.trim() || null,
        thumbnail: thumbnail || null,
        scheduled_at: scheduled_at || null,
        started_at: startedAt,
        status,
        access_type: access_type || 'public',
        room_name: roomName,
      })
      .select()
      .single()

    if (insertError) {
      console.error('라이브 세션 생성 오류:', insertError)
      return NextResponse.json(
        { error: '라이브 세션 생성에 실패했습니다.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      session,
      isImmediateStart,
    })

  } catch (error) {
    console.error('라이브 세션 생성 오류:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

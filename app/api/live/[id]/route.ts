import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Supabase Admin 클라이언트
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * 라이브 세션 상세 조회 API
 * GET /api/live/[id]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const { data: session, error } = await supabaseAdmin
      .from('live_sessions')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !session) {
      return NextResponse.json(
        { error: '라이브 세션을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 강사 정보 조회
    let instructor = null
    if (session.instructor_id) {
      const { data } = await supabaseAdmin
        .from('profiles')
        .select('id, full_name, avatar_url')
        .eq('id', session.instructor_id)
        .single()
      instructor = data
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

    return NextResponse.json({ session: { ...session, instructor, course } })

  } catch (error) {
    console.error('라이브 세션 조회 오류:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

/**
 * 라이브 세션 수정 API
 * PATCH /api/live/[id]
 */
export async function PATCH(
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
      .select('instructor_id, status')
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
        { error: '본인의 라이브 세션만 수정할 수 있습니다.' },
        { status: 403 }
      )
    }

    // 진행중이거나 종료된 세션은 일부만 수정 가능
    const body = await request.json()
    const { title, description, thumbnail, scheduled_at, access_type } = body

    const updateData: Record<string, unknown> = {}

    if (title !== undefined) updateData.title = title.trim()
    if (description !== undefined) updateData.description = description?.trim() || null
    if (thumbnail !== undefined) updateData.thumbnail = thumbnail || null

    // 예정된 세션만 일정 및 접근 권한 수정 가능
    if (session.status === 'scheduled') {
      if (scheduled_at !== undefined) updateData.scheduled_at = scheduled_at || null
      if (access_type !== undefined) updateData.access_type = access_type
    }

    const { data: updatedSession, error: updateError } = await supabaseAdmin
      .from('live_sessions')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      console.error('라이브 세션 수정 오류:', updateError)
      return NextResponse.json(
        { error: '수정에 실패했습니다.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      session: updatedSession,
    })

  } catch (error) {
    console.error('라이브 세션 수정 오류:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

/**
 * 라이브 세션 삭제 API
 * DELETE /api/live/[id]
 */
export async function DELETE(
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
      .select('instructor_id, status')
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
        { error: '본인의 라이브 세션만 삭제할 수 있습니다.' },
        { status: 403 }
      )
    }

    // 진행중인 세션은 삭제 불가
    if (session.status === 'live') {
      return NextResponse.json(
        { error: '진행중인 라이브 세션은 삭제할 수 없습니다. 먼저 종료해주세요.' },
        { status: 400 }
      )
    }

    const { error: deleteError } = await supabaseAdmin
      .from('live_sessions')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('라이브 세션 삭제 오류:', deleteError)
      return NextResponse.json(
        { error: '삭제에 실패했습니다.' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('라이브 세션 삭제 오류:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

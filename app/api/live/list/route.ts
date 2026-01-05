import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Supabase Admin 클라이언트
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * 라이브 세션 목록 조회 API
 * GET /api/live/list?status=live&instructor_id=xxx&course_id=xxx
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') // 'scheduled' | 'live' | 'ended' | 'all'
    const instructorId = searchParams.get('instructor_id')
    const courseId = searchParams.get('course_id')
    const mySessionsOnly = searchParams.get('my_sessions') === 'true'

    // 본인 세션만 조회하는 경우 인증 필요
    let userId: string | null = null
    if (mySessionsOnly) {
      const authHeader = request.headers.get('Authorization')
      if (authHeader?.startsWith('Bearer ')) {
        const accessToken = authHeader.replace('Bearer ', '')
        const { data: { user } } = await supabaseAdmin.auth.getUser(accessToken)
        userId = user?.id || null
      }

      if (!userId) {
        return NextResponse.json(
          { error: '인증이 필요합니다.' },
          { status: 401 }
        )
      }
    }

    // 쿼리 빌드 - 기본 세션 정보만 조회
    let query = supabaseAdmin
      .from('live_sessions')
      .select('*')
      .order('scheduled_at', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })

    // 상태 필터
    if (status && status !== 'all') {
      query = query.eq('status', status)
    } else if (!mySessionsOnly) {
      // 공개 목록은 scheduled/live만 표시
      query = query.in('status', ['scheduled', 'live'])
    }

    // 강사 필터
    if (instructorId) {
      query = query.eq('instructor_id', instructorId)
    }

    // 본인 세션만
    if (mySessionsOnly && userId) {
      query = query.eq('instructor_id', userId)
    }

    // 강의 필터
    if (courseId) {
      query = query.eq('course_id', courseId)
    }

    const { data: sessions, error } = await query

    console.log('[Live List API] Query result:', {
      sessionCount: sessions?.length || 0,
      error,
      status,
      mySessionsOnly
    })

    if (error) {
      console.error('라이브 세션 목록 조회 오류:', error)
      return NextResponse.json(
        { error: '목록 조회에 실패했습니다.' },
        { status: 500 }
      )
    }

    // 강사 및 강의 정보 별도 조회
    const sessionsWithDetails = await Promise.all(
      (sessions || []).map(async (session) => {
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

        return { ...session, instructor, course }
      })
    )

    return NextResponse.json({
      sessions: sessionsWithDetails,
    })

  } catch (error) {
    console.error('라이브 세션 목록 조회 오류:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

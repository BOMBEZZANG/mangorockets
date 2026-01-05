import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID!
const CF_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN!

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Cloudflare Stream 영상 삭제 API
 *
 * DELETE /api/video/delete
 * Headers: { Authorization: Bearer <supabase_access_token> }
 * Body: { videoId: string }
 */
export async function DELETE(request: NextRequest) {
  try {
    // 1. Authorization 헤더에서 Supabase 세션 토큰 추출
    const authHeader = request.headers.get('Authorization')

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }

    const accessToken = authHeader.replace('Bearer ', '')

    // 2. Supabase로 유저 정보 확인
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(accessToken)

    if (userError || !user) {
      return NextResponse.json(
        { error: '유효하지 않은 세션입니다.' },
        { status: 401 }
      )
    }

    // 3. 강사 권한 확인
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json(
        { error: '프로필 정보를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    if (profile.role !== 'instructor' && profile.role !== 'admin') {
      return NextResponse.json(
        { error: '강사만 영상을 삭제할 수 있습니다.' },
        { status: 403 }
      )
    }

    // 4. 요청 바디에서 videoId 추출
    const body = await request.json()
    const { videoId } = body

    if (!videoId) {
      return NextResponse.json(
        { error: 'videoId가 필요합니다.' },
        { status: 400 }
      )
    }

    // 5. Cloudflare Stream API로 영상 삭제
    const cfResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/stream/${videoId}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${CF_API_TOKEN}`,
        },
      }
    )

    // Cloudflare에서 404는 이미 삭제된 경우이므로 성공으로 처리
    if (!cfResponse.ok && cfResponse.status !== 404) {
      const errorData = await cfResponse.json().catch(() => ({}))
      console.error('Cloudflare 영상 삭제 오류:', errorData)
      return NextResponse.json(
        { error: 'Cloudflare 영상 삭제에 실패했습니다.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: '영상이 삭제되었습니다.',
      videoId,
    })

  } catch (error) {
    console.error('영상 삭제 오류:', error)
    return NextResponse.json(
      { error: '영상 삭제에 실패했습니다.' },
      { status: 500 }
    )
  }
}

/**
 * 여러 영상 일괄 삭제 API
 *
 * POST /api/video/delete
 * Headers: { Authorization: Bearer <supabase_access_token> }
 * Body: { videoIds: string[] }
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Authorization 헤더에서 Supabase 세션 토큰 추출
    const authHeader = request.headers.get('Authorization')

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }

    const accessToken = authHeader.replace('Bearer ', '')

    // 2. Supabase로 유저 정보 확인
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(accessToken)

    if (userError || !user) {
      return NextResponse.json(
        { error: '유효하지 않은 세션입니다.' },
        { status: 401 }
      )
    }

    // 3. 강사 권한 확인
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json(
        { error: '프로필 정보를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    if (profile.role !== 'instructor' && profile.role !== 'admin') {
      return NextResponse.json(
        { error: '강사만 영상을 삭제할 수 있습니다.' },
        { status: 403 }
      )
    }

    // 4. 요청 바디에서 videoIds 추출
    const body = await request.json()
    const { videoIds } = body

    if (!videoIds || !Array.isArray(videoIds) || videoIds.length === 0) {
      return NextResponse.json(
        { error: 'videoIds 배열이 필요합니다.' },
        { status: 400 }
      )
    }

    // 5. 각 영상을 Cloudflare에서 삭제
    const results = await Promise.allSettled(
      videoIds.map(async (videoId: string) => {
        const cfResponse = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/stream/${videoId}`,
          {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${CF_API_TOKEN}`,
            },
          }
        )

        // 404는 이미 삭제된 경우이므로 성공으로 처리
        if (!cfResponse.ok && cfResponse.status !== 404) {
          throw new Error(`Failed to delete video ${videoId}`)
        }

        return videoId
      })
    )

    const deleted = results
      .filter((r): r is PromiseFulfilledResult<string> => r.status === 'fulfilled')
      .map(r => r.value)

    const failed = results
      .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
      .map((r, i) => videoIds[i])

    return NextResponse.json({
      success: true,
      deleted,
      failed,
      message: `${deleted.length}개 영상 삭제됨, ${failed.length}개 실패`,
    })

  } catch (error) {
    console.error('영상 일괄 삭제 오류:', error)
    return NextResponse.json(
      { error: '영상 삭제에 실패했습니다.' },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Node.js 런타임 사용
export const runtime = 'nodejs'

// Cloudflare 환경변수
const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID!
const CF_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN!

// Supabase Admin 클라이언트
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Cloudflare Stream Direct Creator Upload URL 생성 API
 *
 * POST /api/video/upload
 * Headers: { Authorization: Bearer <supabase_access_token> }
 * Body: { maxDurationSeconds?: number }
 *
 * Response: { uploadURL: string, uid: string }
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
        { error: '강사만 영상을 업로드할 수 있습니다.' },
        { status: 403 }
      )
    }

    // 4. 요청 바디에서 옵션 추출
    const body = await request.json().catch(() => ({}))
    const maxDurationSeconds = body.maxDurationSeconds || 3600 // 기본 1시간

    // 5. Cloudflare Stream Direct Creator Upload URL 요청 (tus 프로토콜)
    const cfResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/stream?direct_user=true`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${CF_API_TOKEN}`,
          'Tus-Resumable': '1.0.0',
          'Upload-Length': body.uploadLength?.toString() || '0', // 클라이언트에서 전달
          'Upload-Creator': user.id,
          'Upload-Metadata': `maxDurationSeconds ${Buffer.from(maxDurationSeconds.toString()).toString('base64')}, requiresignedurls ${Buffer.from('true').toString('base64')}`,
        },
      }
    )

    if (!cfResponse.ok) {
      const errorText = await cfResponse.text()
      console.error('Cloudflare API 오류:', cfResponse.status, errorText)
      return NextResponse.json(
        { error: 'Cloudflare 업로드 URL 생성에 실패했습니다.' },
        { status: 500 }
      )
    }

    // tus 프로토콜은 Location 헤더에서 업로드 URL을 반환
    const uploadURL = cfResponse.headers.get('Location')
    const streamMediaId = cfResponse.headers.get('stream-media-id')

    if (!uploadURL) {
      console.error('Cloudflare 응답에 Location 헤더 없음')
      return NextResponse.json(
        { error: '업로드 URL을 받지 못했습니다.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      uploadURL,
      uid: streamMediaId || uploadURL.split('/').pop(), // URL에서 ID 추출
    })

  } catch (error) {
    console.error('업로드 URL 생성 오류:', error)
    return NextResponse.json(
      { error: '업로드 URL 생성에 실패했습니다.' },
      { status: 500 }
    )
  }
}

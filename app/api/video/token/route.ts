import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { SignJWT } from 'jose'
import { createPrivateKey } from 'crypto'

// Vercel에서 Node.js 런타임 사용 (crypto 모듈 필요)
export const runtime = 'nodejs'

// Cloudflare Stream 환경변수
const CF_STREAM_KEY_ID = process.env.CF_STREAM_KEY_ID!
const CF_STREAM_SIGNING_KEY_BASE64 = process.env.CF_STREAM_SIGNING_KEY!
const CF_STREAM_CUSTOMER_SUBDOMAIN = process.env.CF_STREAM_CUSTOMER_SUBDOMAIN!

// Supabase Admin 클라이언트 (서버용)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Base64로 인코딩된 PEM 키를 디코딩하고 KeyObject로 변환
 * Cloudflare는 PKCS#1 형식 (RSA PRIVATE KEY)을 제공하므로
 * Node.js crypto 모듈을 사용하여 처리
 */
function getPrivateKey() {
  const pemKey = Buffer.from(CF_STREAM_SIGNING_KEY_BASE64, 'base64').toString('utf-8')
  return createPrivateKey({
    key: pemKey,
    format: 'pem',
  })
}

/**
 * Cloudflare Stream Signed URL 토큰 생성 API
 * Signing Key를 사용하여 JWT를 직접 생성합니다.
 *
 * 요청: POST /api/video/token
 * Body: { videoId: string, isPreview?: boolean, lessonId?: string }
 * Headers: { Authorization: Bearer <supabase_access_token> } (미리보기가 아닌 경우 필수)
 *
 * 응답: { token: string, videoId: string, expiresIn: number }
 */
export async function POST(request: NextRequest) {
  try {
    // 요청 바디 파싱
    const body = await request.json()
    const { videoId, isPreview, lessonId, courseId } = body

    if (!videoId) {
      return NextResponse.json(
        { error: 'videoId가 필요합니다.' },
        { status: 400 }
      )
    }

    // 미리보기 레슨인 경우 - 레슨 DB에서 is_preview 확인
    if (isPreview && lessonId) {
      const { data: lesson, error: lessonError } = await supabaseAdmin
        .from('lessons')
        .select('is_preview, video_url')
        .eq('id', lessonId)
        .single()

      if (lessonError || !lesson) {
        return NextResponse.json(
          { error: '레슨을 찾을 수 없습니다.' },
          { status: 404 }
        )
      }

      if (!lesson.is_preview) {
        return NextResponse.json(
          { error: '미리보기가 허용되지 않은 레슨입니다.' },
          { status: 403 }
        )
      }

      // 미리보기 레슨 토큰 생성 (인증 없이)
      const privateKey = getPrivateKey()
      const expiresIn = 3600 // 1시간
      const expirationTime = Math.floor(Date.now() / 1000) + expiresIn

      const token = await new SignJWT({
        sub: videoId,
        kid: CF_STREAM_KEY_ID,
      })
        .setProtectedHeader({ alg: 'RS256', kid: CF_STREAM_KEY_ID })
        .setExpirationTime(expirationTime)
        .sign(privateKey)

      return NextResponse.json({
        token,
        videoId,
        customerSubdomain: CF_STREAM_CUSTOMER_SUBDOMAIN,
        expiresIn,
      })
    }

    // 일반 레슨 - 인증 필요
    const authHeader = request.headers.get('Authorization')

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }

    const accessToken = authHeader.replace('Bearer ', '')

    // Supabase로 유저 정보 확인
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(accessToken)

    if (userError || !user) {
      return NextResponse.json(
        { error: '유효하지 않은 세션입니다.' },
        { status: 401 }
      )
    }

    // purchases 테이블에서 강의 구매 여부 확인
    // courseId가 없으면 lessonId로 course 찾기
    let targetCourseId = courseId

    if (!targetCourseId && lessonId) {
      const { data: lesson } = await supabaseAdmin
        .from('lessons')
        .select('course_id')
        .eq('id', lessonId)
        .single()

      if (lesson) {
        targetCourseId = lesson.course_id
      }
    }

    if (!targetCourseId) {
      return NextResponse.json(
        { error: 'courseId 또는 lessonId가 필요합니다.' },
        { status: 400 }
      )
    }

    // 강의 가격 확인 (무료 강의 처리)
    const { data: course } = await supabaseAdmin
      .from('courses')
      .select('price')
      .eq('id', targetCourseId)
      .single()

    // 무료 강의는 구매 확인 없이 토큰 발급
    if (course && course.price === 0) {
      const privateKey = getPrivateKey()
      const expiresIn = 3600
      const expirationTime = Math.floor(Date.now() / 1000) + expiresIn

      const token = await new SignJWT({
        sub: videoId,
        kid: CF_STREAM_KEY_ID,
      })
        .setProtectedHeader({ alg: 'RS256', kid: CF_STREAM_KEY_ID })
        .setExpirationTime(expirationTime)
        .sign(privateKey)

      return NextResponse.json({
        token,
        videoId,
        customerSubdomain: CF_STREAM_CUSTOMER_SUBDOMAIN,
        expiresIn,
      })
    }

    // 유료 강의 - 구매 여부 확인
    const { data: purchase, error: purchaseError } = await supabaseAdmin
      .from('purchases')
      .select('id')
      .eq('user_id', user.id)
      .eq('course_id', targetCourseId)
      .single()

    if (purchaseError && purchaseError.code !== 'PGRST116') {
      console.error('구매 확인 오류:', purchaseError)
    }

    if (!purchase) {
      return NextResponse.json(
        { error: '결제가 필요합니다.' },
        { status: 403 }
      )
    }

    // Signing Key로 JWT 직접 생성
    const privateKey = getPrivateKey()

    // 토큰 만료 시간 (1시간)
    const expiresIn = 3600
    const expirationTime = Math.floor(Date.now() / 1000) + expiresIn

    const token = await new SignJWT({
      sub: videoId,
      kid: CF_STREAM_KEY_ID,
    })
      .setProtectedHeader({ alg: 'RS256', kid: CF_STREAM_KEY_ID })
      .setExpirationTime(expirationTime)
      .sign(privateKey)

    return NextResponse.json({
      token,
      videoId,
      customerSubdomain: CF_STREAM_CUSTOMER_SUBDOMAIN,
      expiresIn,
    })

  } catch (error) {
    console.error('비디오 토큰 생성 오류:', error)
    return NextResponse.json(
      { error: '토큰 생성에 실패했습니다.' },
      { status: 500 }
    )
  }
}

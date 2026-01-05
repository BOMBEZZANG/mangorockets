import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: NextRequest) {
  try {
    // 인증 확인
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const token = authHeader.split(' ')[1]
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: '인증에 실패했습니다' }, { status: 401 })
    }

    // 강사 권한 확인
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !['instructor', 'admin'].includes(profile.role)) {
      return NextResponse.json({ error: '강사 권한이 필요합니다' }, { status: 403 })
    }

    // FormData에서 이미지 파일 추출
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: '파일이 필요합니다' }, { status: 400 })
    }

    // 파일 타입 검증
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'JPEG, PNG, WebP, GIF 형식만 지원됩니다' },
        { status: 400 }
      )
    }

    // 파일 크기 검증 (5MB)
    const maxSize = 5 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: '파일 크기는 5MB 이하여야 합니다' },
        { status: 400 }
      )
    }

    // Cloudflare 환경 변수 확인
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID
    const apiToken = process.env.CLOUDFLARE_API_TOKEN

    if (!accountId || !apiToken) {
      console.error('Cloudflare credentials missing')
      return NextResponse.json(
        { error: '서버 설정 오류입니다' },
        { status: 500 }
      )
    }

    // Cloudflare Images에 업로드
    const cfFormData = new FormData()
    cfFormData.append('file', file)

    const cfResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiToken}`,
        },
        body: cfFormData,
      }
    )

    const cfResult = await cfResponse.json()

    if (!cfResult.success) {
      console.error('Cloudflare upload failed:', cfResult.errors)
      return NextResponse.json(
        { error: '이미지 업로드에 실패했습니다' },
        { status: 500 }
      )
    }

    // Cloudflare Images 결과에서 URL 추출
    const imageId = cfResult.result.id
    const variants = cfResult.result.variants as string[]

    // public variant URL 사용 (또는 첫 번째 variant)
    const imageUrl = variants.find(v => v.includes('/public')) || variants[0]

    return NextResponse.json({
      success: true,
      imageId,
      imageUrl,
      variants,
    })
  } catch (error) {
    console.error('Image upload error:', error)
    return NextResponse.json(
      { error: '이미지 업로드 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}

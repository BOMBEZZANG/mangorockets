import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// Supabase Admin 클라이언트 (프로필 생성용)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next') || '/'

  if (code) {
    // Supabase 클라이언트 생성 (쿠키 기반)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    // OAuth 코드를 세션으로 교환
    const { data: { session }, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && session?.user) {
      const user = session.user

      // 프로필 정보 추출
      const userMetadata = user.user_metadata
      const fullName = userMetadata?.full_name || userMetadata?.name || ''
      const avatarUrl = userMetadata?.avatar_url || userMetadata?.picture || ''

      // profiles 테이블에 사용자 정보 저장/업데이트
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .upsert({
          id: user.id,
          email: user.email,
          full_name: fullName,
          avatar_url: avatarUrl,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'id',
        })

      if (profileError) {
        console.error('프로필 저장 오류:', profileError)
      }
    }

    if (error) {
      console.error('세션 교환 오류:', error)
      return NextResponse.redirect(new URL('/login?error=auth_failed', requestUrl.origin))
    }
  }

  // 원래 가려던 페이지로 리다이렉트
  return NextResponse.redirect(new URL(next, requestUrl.origin))
}

import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next') || '/'

  console.log('[Auth Callback] Starting...', { code: code ? 'present' : 'missing', next })

  if (code) {
    const cookieStore = await cookies()

    // SSR 클라이언트 생성 (쿠키 기반)
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch (error) {
              console.error('[Auth Callback] Cookie set error:', error)
            }
          },
        },
      }
    )

    // OAuth 코드를 세션으로 교환
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    
    console.log('[Auth Callback] Exchange result:', { 
      hasSession: !!data?.session, 
      hasUser: !!data?.user,
      error: error?.message 
    })

    if (error) {
      console.error('[Auth Callback] Session exchange error:', error)
      return NextResponse.redirect(new URL('/login?error=auth_failed', requestUrl.origin))
    }

    if (data?.session?.user) {
      const user = data.session.user

      // 프로필 정보 추출
      const userMetadata = user.user_metadata
      const fullName = userMetadata?.full_name || userMetadata?.name || ''
      const avatarUrl = userMetadata?.avatar_url || userMetadata?.picture || ''

      console.log('[Auth Callback] User info:', { 
        id: user.id, 
        email: user.email, 
        fullName, 
        hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY 
      })

      // Supabase Admin 클라이언트로 프로필 생성
      if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
        const supabaseAdmin = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        )

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
          console.error('[Auth Callback] Profile upsert error:', profileError)
        } else {
          console.log('[Auth Callback] Profile created/updated successfully')
        }
      } else {
        console.error('[Auth Callback] SUPABASE_SERVICE_ROLE_KEY is not set!')
      }
    }
  }

  // 원래 가려던 페이지로 리다이렉트
  return NextResponse.redirect(new URL(next, requestUrl.origin))
}

import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next') || '/'

  // Log full URL for debugging
  console.log('[Auth Callback] Full URL:', request.url)
  console.log('[Auth Callback] Search params:', Object.fromEntries(requestUrl.searchParams))

  if (code) {
    const cookieStore = await cookies()

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
      const userMetadata = user.user_metadata
      const fullName = userMetadata?.full_name || userMetadata?.name || ''
      const avatarUrl = userMetadata?.avatar_url || userMetadata?.picture || ''

      console.log('[Auth Callback] Creating profile for:', user.email)

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
          console.error('[Auth Callback] Profile error:', profileError)
        } else {
          console.log('[Auth Callback] Profile created successfully')
        }
      }
    }
  } else {
    console.log('[Auth Callback] No code in URL - redirecting to:', next)
  }

  return NextResponse.redirect(new URL(next, requestUrl.origin))
}

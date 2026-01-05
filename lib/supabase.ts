import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Log environment status on client side
if (typeof window !== 'undefined') {
  console.log('[Supabase Client] Initializing with:', {
    hasUrl: !!supabaseUrl,
    hasKey: !!supabaseAnonKey,
    urlPrefix: supabaseUrl?.substring(0, 30) || 'MISSING'
  })
}

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('[Supabase] Missing environment variables:', {
    hasUrl: !!supabaseUrl,
    hasKey: !!supabaseAnonKey
  })
}

export const supabase = createBrowserClient(
  supabaseUrl || '',
  supabaseAnonKey || ''
)

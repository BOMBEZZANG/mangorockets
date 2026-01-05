import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

console.log('[Supabase] URL:', supabaseUrl ? 'SET' : 'NOT SET')
console.log('[Supabase] Anon Key:', supabaseAnonKey ? 'SET' : 'NOT SET')

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

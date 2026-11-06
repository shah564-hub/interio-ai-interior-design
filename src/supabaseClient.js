import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

console.log('Supabase URL:', supabaseUrl)
console.log('Supabase key loaded:', Boolean(supabaseKey))

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Supabase environment variables are missing. Check your .env file.')
}

export const supabase = createClient(supabaseUrl, supabaseKey)
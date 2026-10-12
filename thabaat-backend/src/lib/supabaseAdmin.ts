import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_KEY
// Keep /health available without credentials; protected operations fail closed.
export const supabaseAdmin = url && key ? createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
}) : null

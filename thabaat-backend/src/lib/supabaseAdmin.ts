import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables')
}

// This client uses the service role key — it bypasses RLS
// Never expose this key in the mobile app
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)
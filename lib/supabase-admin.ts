import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Ce client ne doit JAMAIS être importé dans une page "use client"
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)
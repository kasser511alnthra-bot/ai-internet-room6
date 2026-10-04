import { createClient } from '@supabase/supabase-js'

let client = null

// Fetches the Supabase URL + anon key from the app's own backend. The
// service_role key never leaves the server process.
export async function getClient() {
  if (client) return client
  const res = await fetch('/api/config')
  if (!res.ok) return null
  const cfg = await res.json()
  if (!cfg.configured) return null
  client = createClient(cfg.url, cfg.anonKey, { auth: { persistSession: true } })
  return client
}

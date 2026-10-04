import express from 'express'
import crypto from 'node:crypto'

const app = express()
app.use(express.json())

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
// Signs the throttle key so raw emails/IPs are never stored in the database.
const HMAC_SECRET = process.env.LOGIN_HMAC_SECRET || 'dev-only-change-me'

const configured = () => Boolean(SUPABASE_URL && SUPABASE_ANON_KEY && SUPABASE_SERVICE_ROLE_KEY)

app.get('/api/health', (_req, res) => res.json({ ok: true, configured: configured() }))

app.get('/api/config', (_req, res) => {
  if (!configured()) return res.json({ configured: false })
  res.json({ configured: true, url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY })
})

app.post('/api/login', async (req, res) => {
  try {
    if (!configured()) return res.status(503).json({ error: 'Supabase is not configured yet' })
    const { email, password } = req.body || {}
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' })

    const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString().split(',')[0].trim()
    const key = crypto.createHmac('sha256', HMAC_SECRET).update(`${email.toLowerCase()}|${ip}`).digest('hex')

    const limit = await fetch(`${SUPABASE_URL}/rest/v1/rpc/consume_login_attempt`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ p_key: key })
    })
    if (!limit.ok) return res.status(500).json({ error: 'Rate limiter failed' })
    if ((await limit.json()) === false) {
      return res.status(429).json({ error: 'Too many attempts. Try again in 15 minutes.' })
    }

    const auth = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    })
    const data = await auth.json()
    if (!auth.ok) return res.status(401).json({ error: data.error_description || data.msg || 'Invalid email or password' })
    res.json({ session: data })
  } catch {
    res.status(500).json({ error: 'Login failed' })
  }
})

app.listen(4000, '0.0.0.0', () => console.log('api listening on 4000'))

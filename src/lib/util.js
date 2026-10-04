export const TIMEZONE = 'Asia/Riyadh'

export const todayRiyadh = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE }).format(new Date())

export const fmtTime = (ts) =>
  ts
    ? new Intl.DateTimeFormat('en-GB', { timeZone: TIMEZONE, hour: '2-digit', minute: '2-digit' }).format(new Date(ts))
    : '—'

export const fmtDateTime = (ts) =>
  ts
    ? new Intl.DateTimeFormat('en-GB', { timeZone: TIMEZONE, day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(ts))
    : '—'

const MESSAGES = {
  INACTIVE: 'Your account is not active.',
  ALREADY_IN: 'You are already clocked in.',
  DAY_CONFLICT: 'An approved excuse or absence already covers that day.',
  NOT_CLOCKED_IN: 'No open session to close.',
  INVALID_DATE: 'That date is not allowed.',
  NOT_FOUND: 'Record not found.',
  FORBIDDEN: 'Not allowed.',
  SELF_LOCKOUT: 'You cannot lock yourself out.'
}

export function rpcError(err) {
  const msg = err?.message || 'Something went wrong'
  return MESSAGES[msg] || msg
}

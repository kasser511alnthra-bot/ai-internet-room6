import React, { useState } from 'react'

export default function NotificationBell({ pending, unseen, onOpen, goToLabel, onGoTo }) {
  const [open, setOpen] = useState(false)

  const toggle = () => {
    const next = !open
    setOpen(next)
    if (next) onOpen()
  }

  return (
    <div className="bell-wrap">
      <button className="btn ghost bell" onClick={toggle} aria-label="Notifications">
        <span aria-hidden="true">🔔</span>
        {unseen > 0 && <span className="bell-badge">{unseen}</span>}
      </button>
      {open && (
        <div className="card bell-menu">
          <strong>Pending excuses ({pending.length})</strong>
          <ul className="bell-list">
            {pending.map((x) => (
              <li key={x.id}>
                <div>{x.name_snapshot} <span className="muted">({x.code_snapshot})</span> — {x.work_date}</div>
                <div className="muted small">{x.reason}</div>
              </li>
            ))}
            {pending.length === 0 && <li className="muted">Nothing pending.</li>}
          </ul>
          {pending.length > 0 && <button className="btn small primary" onClick={onGoTo}>{goToLabel}</button>}
        </div>
      )}
    </div>
  )
}

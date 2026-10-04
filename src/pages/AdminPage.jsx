import React, { useState } from 'react'
import AdminMembers from '../components/AdminMembers'
import AdminDepartments from '../components/AdminDepartments'
import AdminReview from '../components/AdminReview'
import AdminAudit from '../components/AdminAudit'

const TABS = [
  ['members', 'Members'],
  ['departments', 'Departments'],
  ['review', 'Review'],
  ['audit', 'Audit log']
]

export default function AdminPage() {
  const [tab, setTab] = useState('members')
  return (
    <div>
      <div className="tabs">
        {TABS.map(([id, label]) => (
          <button key={id} className={tab === id ? 'btn primary' : 'btn'} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>
      {tab === 'members' && <AdminMembers />}
      {tab === 'departments' && <AdminDepartments />}
      {tab === 'review' && <AdminReview />}
      {tab === 'audit' && <AdminAudit />}
    </div>
  )
}

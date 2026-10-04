import React, { useCallback, useEffect, useState } from 'react'
import { useApp } from '../lib/context'
import { rpcError } from '../lib/util'

export default function AdminMembers() {
  const { sb } = useApp()
  const [members, setMembers] = useState([])
  const [departments, setDepartments] = useState([])
  const [editing, setEditing] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const [m, d] = await Promise.all([
      sb.from('members').select('id,username,employee_code,full_name,role,is_active,department_id,shift_note,deleted_at,departments(name)').order('full_name'),
      sb.from('departments').select('id,name').order('name')
    ])
    setMembers(m.data || [])
    setDepartments(d.data || [])
  }, [sb])

  useEffect(() => { load() }, [load])

  const startEdit = (m) => setEditing({
    id: m.id,
    full_name: m.full_name,
    employee_code: m.employee_code,
    username: m.username,
    role: m.role,
    is_active: m.is_active,
    department_id: m.department_id,
    shift_note: m.shift_note || ''
  })

  const set = (key, value) => setEditing((e) => ({ ...e, [key]: value }))

  const save = async () => {
    setBusy(true)
    setError('')
    const { error } = await sb.rpc('admin_save_member', {
      p_id: editing.id,
      p_name: editing.full_name,
      p_code: editing.employee_code,
      p_username: editing.username,
      p_role: editing.role,
      p_active: editing.is_active,
      p_department: editing.department_id,
      p_shift: editing.shift_note
    })
    if (error) setError(rpcError(error))
    else { setEditing(null); await load() }
    setBusy(false)
  }

  const archive = async (m, restore) => {
    setBusy(true)
    setError('')
    const { error } = await sb.rpc('admin_archive_member', { p_id: m.id, p_restore: restore })
    if (error) setError(rpcError(error))
    else await load()
    setBusy(false)
  }

  return (
    <div className="card">
      <h1>Members</h1>
      {error && <p className="error">{error}</p>}
      {editing ? (
        <div className="card edit-card">
          <h2 className="section-title">Edit {editing.full_name}</h2>
          <div className="row">
            <div className="grow"><label>Full name</label><input value={editing.full_name} onChange={(e) => set('full_name', e.target.value)} /></div>
            <div><label>Employee code</label><input value={editing.employee_code} onChange={(e) => set('employee_code', e.target.value)} /></div>
          </div>
          <div className="row">
            <div className="grow"><label>Username</label><input value={editing.username} onChange={(e) => set('username', e.target.value)} /></div>
            <div>
              <label>Role</label>
              <select value={editing.role} onChange={(e) => set('role', e.target.value)}>
                <option value="employee">employee</option>
                <option value="manager">manager</option>
                <option value="admin">admin</option>
              </select>
            </div>
            <div>
              <label>Department</label>
              <select value={editing.department_id || ''} onChange={(e) => set('department_id', e.target.value || null)}>
                <option value="">— none —</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label>Active</label>
              <select value={editing.is_active ? 'yes' : 'no'} onChange={(e) => set('is_active', e.target.value === 'yes')}>
                <option value="yes">yes</option>
                <option value="no">no</option>
              </select>
            </div>
          </div>
          <label>Shift note</label>
          <input value={editing.shift_note} onChange={(e) => set('shift_note', e.target.value)} />
          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn primary" disabled={busy} onClick={save}>Save</button>
            <button className="btn ghost" disabled={busy} onClick={() => { setEditing(null); setError('') }}>Cancel</button>
          </div>
        </div>
      ) : (
        <table>
          <thead><tr><th>Name</th><th>Username</th><th>Code</th><th>Role</th><th>Department</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id}>
                <td>{m.full_name}</td>
                <td>{m.username}</td>
                <td>{m.employee_code}</td>
                <td>{m.role}</td>
                <td>{m.departments?.name || '—'}</td>
                <td>
                  {m.deleted_at
                    ? <span className="badge off">archived</span>
                    : m.is_active
                      ? <span className="badge ok">active</span>
                      : <span className="badge pending">inactive</span>}
                </td>
                <td>
                  <button className="btn small" onClick={() => startEdit(m)}>Edit</button>{' '}
                  {m.deleted_at
                    ? <button className="btn small" disabled={busy} onClick={() => archive(m, true)}>Restore</button>
                    : <button className="btn small danger" disabled={busy} onClick={() => archive(m, false)}>Archive</button>}
                </td>
              </tr>
            ))}
            {members.length === 0 && <tr><td colSpan={7} className="muted">No members.</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  )
}

import React, { useCallback, useEffect, useState } from 'react'
import { useApp } from '../lib/context'
import { rpcError } from '../lib/util'

export default function AdminDepartments() {
  const { sb } = useApp()
  const [departments, setDepartments] = useState([])
  const [name, setName] = useState('')
  const [renaming, setRenaming] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const { data } = await sb.from('departments').select('id,name').order('name')
    setDepartments(data || [])
  }, [sb])

  useEffect(() => { load() }, [load])

  const add = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    const { error } = await sb.rpc('admin_save_department', { p_id: null, p_name: name })
    if (error) setError(rpcError(error))
    else { setName(''); await load() }
    setBusy(false)
  }

  const rename = async () => {
    setBusy(true)
    setError('')
    const { error } = await sb.rpc('admin_save_department', { p_id: renaming.id, p_name: renaming.name })
    if (error) setError(rpcError(error))
    else { setRenaming(null); await load() }
    setBusy(false)
  }

  const remove = async (d) => {
    setBusy(true)
    setError('')
    const { error } = await sb.rpc('admin_delete_department', { p_id: d.id })
    if (error) setError(rpcError(error))
    else await load()
    setBusy(false)
  }

  return (
    <div className="card">
      <h1>Departments</h1>
      {error && <p className="error">{error}</p>}
      <form className="row" onSubmit={add}>
        <input required placeholder="New department name" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn primary" disabled={busy} type="submit">Add</button>
      </form>
      <table>
        <thead><tr><th>Name</th><th></th></tr></thead>
        <tbody>
          {departments.map((d) => (
            <tr key={d.id}>
              <td>
                {renaming?.id === d.id
                  ? <input value={renaming.name} onChange={(e) => setRenaming({ ...renaming, name: e.target.value })} />
                  : d.name}
              </td>
              <td>
                {renaming?.id === d.id ? (
                  <>
                    <button className="btn small primary" disabled={busy} onClick={rename}>Save</button>{' '}
                    <button className="btn small ghost" onClick={() => setRenaming(null)}>Cancel</button>
                  </>
                ) : (
                  <>
                    <button className="btn small" onClick={() => setRenaming({ ...d })}>Rename</button>{' '}
                    <button className="btn small danger" disabled={busy} onClick={() => remove(d)}>Delete</button>
                  </>
                )}
              </td>
            </tr>
          ))}
          {departments.length === 0 && <tr><td colSpan={2} className="muted">No departments yet.</td></tr>}
        </tbody>
      </table>
    </div>
  )
}

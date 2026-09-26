import { useEffect, useState } from 'react'
import {
  AlertCircle, ArrowLeft, ArrowUpRight, Check, CircleCheck, Clock3, Inbox,
  LoaderCircle, LockKeyhole, LogOut, Mail, RefreshCw, Search, ShieldCheck,
} from 'lucide-react'
import './Admin.css'

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')

async function adminRequest(path, options = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(result.detail || 'The request could not be completed.')
  return result
}

function formatDate(value, includeTime = true) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Date unavailable'
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...(includeTime ? { hour: 'numeric', minute: '2-digit' } : {}),
  }).format(date)
}

function EmailStatus({ status }) {
  if (status === 'sent') return <span className="admin-status admin-status-sent"><CircleCheck size={14} /> Sent</span>
  if (status === 'failed') return <span className="admin-status admin-status-failed"><AlertCircle size={14} /> Failed</span>
  if (status === 'not_configured') return <span className="admin-status admin-status-pending"><Clock3 size={14} /> Not configured</span>
  return <span className="admin-status admin-status-pending"><Clock3 size={14} /> Pending</span>
}

function AdminBrand() {
  return (
    <a className="admin-brand" href="/" aria-label="Go-Forge home">
      <span className="admin-brand-mark"><span /></span>
      <span>Go-Forge <small>INBOX</small></span>
    </a>
  )
}

function LoginScreen({ onLogin, error, busy }) {
  const [password, setPassword] = useState('')

  function handleSubmit(event) {
    event.preventDefault()
    onLogin(password)
  }

  return (
    <main className="admin-app admin-login-page">
      <header className="admin-login-header"><AdminBrand /><a href="/" className="admin-back-link"><ArrowLeft size={15} /> Back to website</a></header>
      <section className="admin-login-layout">
        <div className="admin-login-copy">
          <span className="admin-kicker"><span /> PRIVATE WORKSPACE</span>
          <h1>Enquiries, in one clear view.</h1>
          <p>Every project request, contact detail, and delivery status, together.</p>
          <div className="admin-login-proof"><ShieldCheck size={17} /> Protected Go-Forge workspace</div>
        </div>
        <form className="admin-login-form" onSubmit={handleSubmit}>
          <div className="admin-login-icon"><LockKeyhole size={20} /></div>
          <h2>Admin sign in</h2>
          <p>Use the admin password configured for this workspace.</p>
          <label htmlFor="admin-password">Password</label>
          <input
            id="admin-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            autoFocus
          />
          {error && <p className="admin-error" role="alert"><AlertCircle size={15} />{error}</p>}
          <button className="admin-primary-button" type="submit" disabled={busy}>
            {busy ? <LoaderCircle size={16} className="admin-spinner" /> : <LockKeyhole size={16} />}
            {busy ? 'Signing in...' : 'Sign in securely'}
          </button>
          <span className="admin-login-note">Your session is private to this browser.</span>
        </form>
      </section>
      <footer className="admin-login-footer"><span>GO-FORGE · ADMIN</span><span>Private workspace</span></footer>
    </main>
  )
}

function AdminPortal() {
  const [isAuthenticated, setIsAuthenticated] = useState(null)
  const [enquiries, setEnquiries] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [query, setQuery] = useState('')
  const [emailFilter, setEmailFilter] = useState('all')
  const [pageError, setPageError] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loginBusy, setLoginBusy] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let active = true

    async function checkSession() {
      try {
        const session = await adminRequest('/api/admin/session')
        if (!active) return
        setIsAuthenticated(session.authenticated)
        if (!session.authenticated) return

        setLoading(true)
        const result = await adminRequest('/api/admin/enquiries')
        if (!active) return
        setEnquiries(result.enquiries)
        setSelectedId(result.enquiries[0]?.id ?? null)
      } catch (error) {
        if (active) {
          setIsAuthenticated(false)
          setLoginError(error.message)
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    checkSession()
    return () => { active = false }
  }, [])

  async function refreshEnquiries() {
    setLoading(true)
    setPageError('')
    try {
      const result = await adminRequest('/api/admin/enquiries')
      setEnquiries(result.enquiries)
      setSelectedId((currentId) => result.enquiries.some((item) => item.id === currentId)
        ? currentId
        : result.enquiries[0]?.id ?? null)
    } catch (error) {
      if (error.message.toLowerCase().includes('sign in')) setIsAuthenticated(false)
      setPageError(error.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleLogin(password) {
    setLoginBusy(true)
    setLoginError('')
    try {
      await adminRequest('/api/admin/login', {
        method: 'POST',
        body: JSON.stringify({ password }),
      })
      setIsAuthenticated(true)
      setLoading(true)
      const result = await adminRequest('/api/admin/enquiries')
      setEnquiries(result.enquiries)
      setSelectedId(result.enquiries[0]?.id ?? null)
    } catch (error) {
      setLoginError(error.message)
      setIsAuthenticated(false)
    } finally {
      setLoginBusy(false)
      setLoading(false)
    }
  }

  async function handleLogout() {
    try {
      await adminRequest('/api/admin/logout', { method: 'POST' })
    } finally {
      setIsAuthenticated(false)
      setEnquiries([])
      setSelectedId(null)
    }
  }

  const searchTerm = query.trim().toLowerCase()
  const visibleEnquiries = enquiries.filter((enquiry) => {
    const matchesQuery = !searchTerm || [
      enquiry.name, enquiry.business, enquiry.email, enquiry.phone,
      enquiry.service, enquiry.message,
    ].some((value) => String(value || '').toLowerCase().includes(searchTerm))
    const matchesStatus = emailFilter === 'all'
      || (emailFilter === 'sent' && enquiry.email_status === 'sent')
      || (emailFilter === 'attention' && enquiry.email_status !== 'sent')
    return matchesQuery && matchesStatus
  })
  const selectedEnquiry = enquiries.find((enquiry) => enquiry.id === selectedId)
  const today = new Date().toDateString()
  const todayCount = enquiries.filter((enquiry) => new Date(enquiry.created_at).toDateString() === today).length
  const sentCount = enquiries.filter((enquiry) => enquiry.email_status === 'sent').length
  const attentionCount = enquiries.length - sentCount

  if (isAuthenticated === null) {
    return <main className="admin-app admin-checking"><LoaderCircle size={19} className="admin-spinner" /> Checking admin session...</main>
  }

  if (!isAuthenticated) {
    return <LoginScreen onLogin={handleLogin} error={loginError} busy={loginBusy} />
  }

  return (
    <main className="admin-app">
      <header className="admin-topbar">
        <AdminBrand />
        <div className="admin-topbar-actions">
          <a href="/" className="admin-site-link">View website <ArrowUpRight size={14} /></a>
          <span className="admin-session-label"><span /> Secure session</span>
          <button className="admin-icon-button" type="button" onClick={handleLogout} title="Sign out" aria-label="Sign out"><LogOut size={17} /></button>
        </div>
      </header>

      <div className="admin-main">
        <section className="admin-page-heading">
          <div>
            <span className="admin-kicker"><span /> ENQUIRY MANAGEMENT</span>
            <h1>Good morning. Here&apos;s the inbox.</h1>
            <p>Every enquiry, with the context to make a thoughtful first reply.</p>
          </div>
          <button className="admin-refresh-button" type="button" onClick={refreshEnquiries} disabled={loading}>
            <RefreshCw size={15} className={loading ? 'admin-spinner' : ''} /> Refresh
          </button>
        </section>

        {pageError && <p className="admin-error admin-page-error" role="alert"><AlertCircle size={15} />{pageError}</p>}

        <section className="admin-stat-grid" aria-label="Enquiry summary">
          <article className="admin-stat"><span>Total enquiries</span><strong>{enquiries.length}</strong><small>All saved requests</small><Inbox size={19} /></article>
          <article className="admin-stat"><span>Received today</span><strong>{todayCount}</strong><small>New conversations</small><Clock3 size={19} /></article>
          <article className="admin-stat"><span>Email alerts sent</span><strong>{sentCount}</strong><small>{attentionCount} need attention</small><Mail size={19} /></article>
        </section>

        <section className="admin-workspace" aria-label="Enquiries and selected enquiry details">
          <div className="admin-inbox-panel">
            <div className="admin-panel-heading">
              <div><span className="admin-panel-kicker">INBOX</span><h2>Project enquiries <span>{enquiries.length}</span></h2></div>
              <a href="mailto:officialshivam2419@gmail.com" className="admin-email-link"><Mail size={14} /> Email inbox</a>
            </div>
            <div className="admin-toolbar">
              <label className="admin-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search people, business, service..." aria-label="Search enquiries" /></label>
              <select value={emailFilter} onChange={(event) => setEmailFilter(event.target.value)} aria-label="Filter by email status">
                <option value="all">All statuses</option>
                <option value="sent">Email sent</option>
                <option value="attention">Needs attention</option>
              </select>
            </div>

            <div className="admin-table-scroll">
              <table className="admin-table">
                <thead><tr><th>CONTACT</th><th>SERVICE</th><th>RECEIVED</th><th>EMAIL ALERT</th></tr></thead>
                <tbody>
                  {visibleEnquiries.map((enquiry) => (
                    <tr
                      key={enquiry.id}
                      className={selectedId === enquiry.id ? 'admin-row-selected' : ''}
                      onClick={() => setSelectedId(enquiry.id)}
                      onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') setSelectedId(enquiry.id) }}
                      tabIndex={0}
                      aria-selected={selectedId === enquiry.id}
                    >
                      <td><strong>{enquiry.name}</strong><span>{enquiry.business}</span></td>
                      <td><span className="admin-service-label">{enquiry.service}</span></td>
                      <td><span className="admin-date-label">{formatDate(enquiry.created_at, false)}</span></td>
                      <td><EmailStatus status={enquiry.email_status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!loading && visibleEnquiries.length === 0 && (
                <div className="admin-empty-state">
                  <span><Inbox size={20} /></span>
                  <strong>{enquiries.length ? 'No matching enquiries' : 'Your inbox is ready'}</strong>
                  <p>{enquiries.length ? 'Try a different search or status filter.' : 'New website enquiries will appear here.'}</p>
                </div>
              )}
              {loading && <div className="admin-table-loading"><LoaderCircle size={17} className="admin-spinner" /> Loading enquiries...</div>}
            </div>
            <div className="admin-table-footer">Showing {visibleEnquiries.length} of {enquiries.length} enquiries</div>
          </div>

          <aside className="admin-detail-panel" aria-label="Selected enquiry details">
            {selectedEnquiry ? (
              <>
                <div className="admin-detail-heading"><div><span className="admin-panel-kicker">ENQUIRY #{selectedEnquiry.id}</span><EmailStatus status={selectedEnquiry.email_status} /></div><span className="admin-detail-date">{formatDate(selectedEnquiry.created_at)}</span></div>
                <h2>{selectedEnquiry.name}</h2>
                <p className="admin-detail-business">{selectedEnquiry.business}</p>
                <div className="admin-detail-actions">
                  <a href={`mailto:${selectedEnquiry.email}`}><Mail size={15} /> Reply by email</a>
                  {selectedEnquiry.phone && <a href={`tel:${selectedEnquiry.phone}`}><ArrowUpRight size={15} /> Call contact</a>}
                </div>
                <dl className="admin-detail-list">
                  <div><dt>EMAIL ADDRESS</dt><dd>{selectedEnquiry.email}</dd></div>
                  <div><dt>PHONE</dt><dd>{selectedEnquiry.phone || 'Not provided'}</dd></div>
                  <div><dt>INTERESTED IN</dt><dd>{selectedEnquiry.service}</dd></div>
                </dl>
                <div className="admin-message-block"><span>PROJECT DETAILS</span><p>{selectedEnquiry.message}</p></div>
                <div className="admin-detail-foot"><Check size={14} /> Saved to the enquiry database</div>
              </>
            ) : (
              <div className="admin-detail-empty"><span><Inbox size={20} /></span><strong>Select an enquiry</strong><p>Contact details and project notes will appear here.</p></div>
            )}
          </aside>
        </section>
        <footer className="admin-footer"><span>GO-FORGE · PRIVATE ADMIN</span><a href="/">Return to website <ArrowUpRight size={13} /></a></footer>
      </div>
    </main>
  )
}

export default AdminPortal
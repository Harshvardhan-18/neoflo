import { useState, useEffect, useCallback } from 'react'
import './index.css'

const API_BASE = 'http://localhost:8000/api/v1'

// ── Types ──────────────────────────────────────────────────────────────────
interface AISummary {
  id: string
  summary_text: string
  page_title?: string
  detected_app?: string
  topics?: string[]
  created_at: string
}

interface Screenshot {
  id: string
  domain: string
  tab_title?: string
  captured_at: string
  data_url?: string
  image_data_b64?: string
  summaries: AISummary[]
}

interface BrowsingEvent {
  id: string
  type: string
  url: string
  domain: string
  occurred_at: string
}

interface SessionItem {
  session_id: string
  started_at: string
  ended_at?: string
  events: BrowsingEvent[]
  screenshots: Screenshot[]
}

interface TimelineResponse {
  items: SessionItem[]
  page: number
  total: number
  limit: number
}

// ── Helpers ────────────────────────────────────────────────────────────────
const EVENT_ICONS: Record<string, string> = {
  navigation: '🌐',
  click: '👆',
  scroll: '📜',
  tab_switch: '🔄',
  tab_close: '✕',
  default: '⚡',
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
}
function uniqueDomains(session: SessionItem): string[] {
  const all = [...session.events.map(e => e.domain), ...session.screenshots.map(s => s.domain)]
  return [...new Set(all.filter(Boolean))].slice(0, 6)
}

// ── Main App ───────────────────────────────────────────────────────────────
export default function App() {
  const [installKey, setInstallKey] = useState(() => localStorage.getItem('install_key') || '')
  const [keyDraft, setKeyDraft] = useState('')
  const [sessions, setSessions] = useState<SessionItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [domainFilter, setDomainFilter] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [activeTab, setActiveTab] = useState<'timeline' | 'screenshots'>('timeline')
  const [selectedSession, setSelectedSession] = useState<SessionItem | null>(null)
  const [replayScreenshot, setReplayScreenshot] = useState<Screenshot | null>(null)
  const [replayIndex, setReplayIndex] = useState(0)
  const [statsTotal, setStatsTotal] = useState(0)
  const LIMIT = 10

  const fetchTimeline = useCallback(async (pg = 1) => {
    if (!installKey) return
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ page: String(pg), limit: String(LIMIT) })
      if (domainFilter) params.set('domain', domainFilter)
      if (fromDate) params.set('from_date', fromDate)
      if (toDate) params.set('to_date', toDate)
      const res = await fetch(`${API_BASE}/activity/timeline?${params}`, {
        headers: { 'X-Install-Key': installKey },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: TimelineResponse = await res.json()
      setSessions(data.items || [])
      setTotal(data.total)
      setStatsTotal(data.total)
    } catch (e: any) {
      setError(e.message || 'Failed to fetch timeline')
    } finally {
      setLoading(false)
    }
  }, [installKey, domainFilter, fromDate, toDate])

  useEffect(() => {
    if (installKey) fetchTimeline(page)
  }, [installKey, page])

  function handleSetKey() {
    if (!keyDraft.trim()) return
    localStorage.setItem('install_key', keyDraft.trim())
    setInstallKey(keyDraft.trim())
  }

  function handleSearch() {
    setPage(1)
    fetchTimeline(1)
  }

  // All screenshots across sessions
  const allScreenshots = sessions.flatMap(s => s.screenshots)

  // ── No install key: prompt ─────────────────────────────────────────────
  if (!installKey) {
    return (
      <div className="app-layout" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div className="install-key-prompt card">
          <h2 style={{ marginBottom: 10, fontFamily: 'var(--font-heading)' }}>☕ Visual AI Agent Dashboard</h2>
          <p style={{ color: 'var(--color-mocha)', marginBottom: 16 }}>
            Enter your extension Install Key to load your activity timeline.
            The key is stored in your Chrome extension's local storage under <code>install_id</code>.
          </p>
          <div className="key-input-group">
            <input
              className="key-input"
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              value={keyDraft}
              onChange={e => setKeyDraft(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSetKey()}
            />
            <button className="btn btn-primary" onClick={handleSetKey}>Connect</button>
          </div>
        </div>
      </div>
    )
  }

  // ── Main Dashboard ─────────────────────────────────────────────────────
  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
            <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
            <line x1="6" y1="1" x2="6" y2="4" />
            <line x1="10" y1="1" x2="10" y2="4" />
            <line x1="14" y1="1" x2="14" y2="4" />
          </svg>
          Visual AI Agent
        </div>

        <div className="sidebar-section">
          <div className="sidebar-label">Navigation</div>
          <div className={`sidebar-item ${activeTab === 'timeline' ? 'active' : ''}`} onClick={() => setActiveTab('timeline')}>
            📋 Activity Timeline
          </div>
          <div className={`sidebar-item ${activeTab === 'screenshots' ? 'active' : ''}`} onClick={() => setActiveTab('screenshots')}>
            🖼 Screenshot Gallery
          </div>
        </div>

        <div className="sidebar-section" style={{ marginTop: 'auto' }}>
          <div className="sidebar-label">Install Key</div>
          <div style={{ fontSize: 11, color: 'rgba(241,228,211,0.5)', wordBreak: 'break-all', padding: '4px 0' }}>
            {installKey.slice(0, 8)}…
          </div>
          <div className="sidebar-item" onClick={() => {
            localStorage.removeItem('install_key')
            setInstallKey('')
            setKeyDraft('')
          }}>
            🔌 Disconnect
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="main-content">
        <div className="page-header">
          <div>
            <h1 className="page-title">Activity Dashboard</h1>
            <div style={{ fontSize: 12, color: 'var(--color-mocha)', marginTop: 4 }}>
              Browsing activity & GPT-4o mini AI analysis
            </div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => fetchTimeline(page)}>
            ↻ Refresh
          </button>
        </div>

        {/* Stats */}
        <div className="stat-grid">
          <div className="stat-card">
            <div className="stat-value">{statsTotal}</div>
            <div className="stat-label">Total Sessions</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{sessions.reduce((a, s) => a + s.events.length, 0)}</div>
            <div className="stat-label">Events (page)</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{allScreenshots.length}</div>
            <div className="stat-label">Screenshots (page)</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">
              {allScreenshots.reduce((a, sc) => a + sc.summaries.length, 0)}
            </div>
            <div className="stat-label">AI Summaries</div>
          </div>
        </div>

        {/* Filter bar */}
        <div className="filter-bar">
          <div className="filter-group">
            <span className="filter-label">Domain</span>
            <input className="filter-input" placeholder="e.g. github.com" value={domainFilter} onChange={e => setDomainFilter(e.target.value)} />
          </div>
          <div className="filter-group">
            <span className="filter-label">From</span>
            <input className="filter-input" type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} />
          </div>
          <div className="filter-group">
            <span className="filter-label">To</span>
            <input className="filter-input" type="date" value={toDate} onChange={e => setToDate(e.target.value)} />
          </div>
          <button className="btn btn-primary" onClick={handleSearch} style={{ alignSelf: 'flex-end' }}>
            Search
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => { setDomainFilter(''); setFromDate(''); setToDate(''); setTimeout(() => fetchTimeline(1), 50) }} style={{ alignSelf: 'flex-end' }}>
            Clear
          </button>
        </div>

        {/* Tabs */}
        <div className="tabs">
          <button className={`tab-btn ${activeTab === 'timeline' ? 'active' : ''}`} onClick={() => setActiveTab('timeline')}>
            Session Timeline
          </button>
          <button className={`tab-btn ${activeTab === 'screenshots' ? 'active' : ''}`} onClick={() => setActiveTab('screenshots')}>
            Screenshot Gallery
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="card" style={{ borderColor: 'var(--color-danger)', background: 'rgba(158,58,52,0.06)', marginBottom: 16 }}>
            <p style={{ color: 'var(--color-danger)', margin: 0 }}>⚠ {error}</p>
          </div>
        )}

        {/* Loading */}
        {loading && <p className="loading-text">Loading timeline data...</p>}

        {/* ── Timeline Tab ─────────────────────────────────────────────── */}
        {!loading && activeTab === 'timeline' && (
          <>
            {sessions.length === 0 ? (
              <div className="empty-state">
                <p style={{ fontSize: 32, marginBottom: 12 }}>☕</p>
                <p>No sessions found. Browse some pages with tracking enabled.</p>
              </div>
            ) : (
              sessions.map(session => (
                <div
                  key={session.session_id}
                  className="session-card"
                  onClick={() => setSelectedSession(selectedSession?.session_id === session.session_id ? null : session)}
                >
                  <div className="session-card-header">
                    <div>
                      <strong style={{ fontSize: 13 }}>Session</strong>
                      <span style={{ fontSize: 11, color: 'var(--color-mocha)', marginLeft: 8 }}>
                        {session.session_id.slice(0, 8)}…
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ fontSize: 11, color: 'var(--color-mocha)' }}>
                        {fmtDate(session.started_at)} · {fmtTime(session.started_at)}
                      </span>
                      <span className="badge badge-active">
                        {session.events.length} events
                      </span>
                      <span className="badge badge-paused">
                        {session.screenshots.length} 📷
                      </span>
                    </div>
                  </div>

                  {/* Domain pills */}
                  <div className="session-domain-list">
                    {uniqueDomains(session).map(d => (
                      <span key={d} className="domain-pill">{d}</span>
                    ))}
                  </div>

                  {/* Expanded session events */}
                  {selectedSession?.session_id === session.session_id && (
                    <div style={{ marginTop: 14 }} onClick={e => e.stopPropagation()}>
                      <div className="card-title" style={{ marginBottom: 8 }}>Events</div>
                      <ul className="event-list">
                        {session.events.slice(0, 20).map(evt => (
                          <li key={evt.id} className="event-item">
                            <div className="event-icon">{EVENT_ICONS[evt.type] || EVENT_ICONS.default}</div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 600, fontSize: 12 }}>{evt.type}</div>
                              <div className="event-meta" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {evt.url}
                              </div>
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--color-mocha)', whiteSpace: 'nowrap' }}>
                              {fmtTime(evt.occurred_at)}
                            </div>
                          </li>
                        ))}
                      </ul>
                      {session.screenshots.length > 0 && (
                        <>
                          <div className="card-title" style={{ margin: '14px 0 8px' }}>Screenshots & AI Summaries</div>
                          <div className="screenshot-grid">
                            {session.screenshots.map((sc) => (
                              <div key={sc.id} className="screenshot-thumb"
                                onClick={() => { setReplayScreenshot(sc); setReplayIndex(session.screenshots.indexOf(sc)) }}>
                                <div style={{
                                  width: '100%', height: 120,
                                  background: 'var(--color-espresso)',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  color: 'var(--color-caramel)', fontSize: 28
                                }}>📷</div>
                                <div className="screenshot-thumb-meta">
                                  <div style={{ fontWeight: 600, marginBottom: 2 }}>{sc.domain}</div>
                                  <div>{fmtTime(sc.captured_at)}</div>
                                  {sc.summaries[0] && (
                                    <div style={{ marginTop: 4, fontStyle: 'italic', lineHeight: 1.3, fontSize: 10 }}>
                                      "{sc.summaries[0].summary_text.slice(0, 80)}…"
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                              {/* Session Replay Scrubber */}
                          {session.screenshots.length > 1 && (
                            <div style={{ marginTop: 14 }}>
                              <div className="card-title" style={{ marginBottom: 10 }}>
                                Session Replay — {session.screenshots.length} Frames
                              </div>
                              <div className="replay-scrubber">
                                <div className="replay-image-area">
                                  {session.screenshots[replayIndex]?.data_url ? (
                                    <img
                                      src={session.screenshots[replayIndex].data_url!}
                                      alt={`Frame ${replayIndex + 1}`}
                                      style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: 6 }}
                                    />
                                  ) : (
                                    <div style={{ color: 'var(--color-caramel)', textAlign: 'center', padding: 20 }}>
                                      <div style={{ fontSize: 48 }}>📷</div>
                                      <div style={{ marginTop: 10, fontSize: 12 }}>
                                        Frame {replayIndex + 1} / {session.screenshots.length}
                                      </div>
                                      <div style={{ fontSize: 11, opacity: 0.6, marginTop: 4 }}>
                                        {session.screenshots[replayIndex]?.domain} · {fmtTime(session.screenshots[replayIndex]?.captured_at)}
                                      </div>
                                    </div>
                                  )}
                                </div>
                                <div className="replay-controls">
                                  <button className="btn btn-secondary btn-sm" onClick={() => setReplayIndex(i => Math.max(0, i - 1))} disabled={replayIndex === 0}>‹ Prev</button>
                                  <input
                                    type="range"
                                    className="replay-slider"
                                    min={0}
                                    max={session.screenshots.length - 1}
                                    value={replayIndex}
                                    onChange={e => setReplayIndex(Number(e.target.value))}
                                  />
                                  <button className="btn btn-secondary btn-sm" onClick={() => setReplayIndex(i => Math.min(session.screenshots.length - 1, i + 1))} disabled={replayIndex === session.screenshots.length - 1}>Next ›</button>
                                </div>
                                {session.screenshots[replayIndex]?.summaries[0] && (
                                  <div className="replay-summary">
                                    <span style={{ fontWeight: 700, color: 'var(--color-mocha)' }}>🤖 GPT-4o mini:</span>{' '}
                                    {session.screenshots[replayIndex].summaries[0].summary_text}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}

            {/* Pagination */}
            {total > LIMIT && (
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 20 }}>
                <button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
                <span style={{ padding: '6px 14px', fontSize: 13, color: 'var(--color-mocha)' }}>
                  Page {page} of {Math.ceil(total / LIMIT)}
                </span>
                <button className="btn btn-secondary btn-sm" disabled={page >= Math.ceil(total / LIMIT)} onClick={() => setPage(p => p + 1)}>Next →</button>
              </div>
            )}
          </>
        )}

        {/* ── Screenshot Gallery Tab ────────────────────────────────────── */}
        {!loading && activeTab === 'screenshots' && (
          <>
            {allScreenshots.length === 0 ? (
              <div className="empty-state">
                <p style={{ fontSize: 32, marginBottom: 12 }}>🖼</p>
                <p>No screenshots found in the current page of sessions.</p>
              </div>
            ) : (
              <div className="screenshot-grid">
                {allScreenshots.map((sc) => (
                  <div key={sc.id} className="screenshot-thumb" onClick={() => setReplayScreenshot(sc)}>
                    {sc.data_url ? (
                      <img
                        src={sc.data_url}
                        alt={sc.domain}
                        style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: '6px 6px 0 0' }}
                      />
                    ) : (
                      <div style={{
                        width: '100%', height: 120,
                        background: 'var(--color-espresso)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'var(--color-caramel)', fontSize: 32
                      }}>📷</div>
                    )}
                    <div className="screenshot-thumb-meta">
                      <div style={{ fontWeight: 600, marginBottom: 2 }}>{sc.domain}</div>
                      <div style={{ fontSize: 10 }}>{fmtDate(sc.captured_at)} · {fmtTime(sc.captured_at)}</div>
                      {sc.summaries[0] && (
                        <div style={{ marginTop: 4, fontStyle: 'italic', lineHeight: 1.3, fontSize: 10 }}>
                          "{sc.summaries[0].summary_text.slice(0, 90)}…"
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {/* ── Screenshot Detail Modal ──────────────────────────────────────── */}
      {replayScreenshot && (
        <div className="modal-overlay" onClick={() => setReplayScreenshot(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setReplayScreenshot(null)}>✕</button>
            <h3 style={{ marginBottom: 4 }}>{replayScreenshot.domain}</h3>
            <div style={{ fontSize: 12, color: 'var(--color-mocha)', marginBottom: 16 }}>
              {replayScreenshot.tab_title && <span>{replayScreenshot.tab_title} · </span>}
              {fmtDate(replayScreenshot.captured_at)} at {fmtTime(replayScreenshot.captured_at)}
            </div>

            <div className="replay-image-area" style={{ marginBottom: 16, minHeight: 240 }}>
              {replayScreenshot.data_url ? (
                <img
                  src={replayScreenshot.data_url}
                  alt={replayScreenshot.domain}
                  style={{ width: '100%', maxHeight: 400, objectFit: 'contain', borderRadius: 6 }}
                />
              ) : (
                <div style={{ textAlign: 'center', padding: 32, color: 'var(--color-caramel)' }}>
                  <div style={{ fontSize: 56 }}>📷</div>
                  <div style={{ marginTop: 10, fontSize: 13 }}>Screenshot data not available</div>
                </div>
              )}
            </div>

            {replayScreenshot.summaries.length > 0 ? (
              replayScreenshot.summaries.map((s) => (
                <div key={s.id} className="replay-summary" style={{ marginBottom: 10 }}>
                  <div style={{ fontWeight: 700, marginBottom: 6, color: 'var(--color-mocha)' }}>
                    🤖 GPT-4o mini Analysis
                    {s.page_title && <span style={{ fontWeight: 400, fontSize: 11, marginLeft: 8 }}>· {s.page_title}</span>}
                  </div>
                  <p style={{ margin: 0 }}>{s.summary_text}</p>
                  {s.topics && s.topics.length > 0 && (
                    <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {s.topics.map(t => (
                        <span key={t} className="domain-pill" style={{ fontSize: 11 }}>{t}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <p style={{ color: 'var(--color-mocha)', fontSize: 13 }}>No AI summaries available for this screenshot yet.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

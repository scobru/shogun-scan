import './App.css'
import { useEffect, useState } from 'react'
import DataBrowser from './com/DataBrowser'
import DataEditor from './com/DataEditor'
import Help from './com/Help'
import RelayDiscovery from './com/RelayDiscovery'
import { GunProvider, useGun } from './api/gunContext'
import { getNode } from './api/gunHelpers'

function AppBody({ peers, setPeers, rootPath, setRootPath }) {
  const gun = useGun()

  const [selection, setSelection] = useState(null)
  const [selectedData, setSelectedData] = useState(null)
  const [showHelp, setShowHelp] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState('disconnected')
  const [activeTab, setActiveTab] = useState('explorer') // 'explorer' or 'discover'

  useEffect(() => {
    if (!gun || !selection) {
      setSelectedData(null)
      return
    }

    const node = getNode(gun, selection)
    node.on(setSelectedData)
    return () => node.off()
  }, [gun, selection])

  useEffect(() => {
    if (gun) {
      setConnectionStatus('connected')
      // You can add more sophisticated connection checking here
    } else {
      setConnectionStatus('disconnected')
    }
  }, [gun])

  const handlePeersChange = (e) => {
    setPeers(e.target.value)
  }

  const handleRootPathChange = (e) => {
    setRootPath(e.target.value)
  }

  const handlePathDeleted = (deletedPath) => {
    // Reset selection if the deleted path matches current selection
    if (selection === deletedPath) {
      setSelection(null)
      setSelectedData(null)
    }
  }

  const handleRelayFound = (relayUrl) => {
    // Add the discovered relay to the peers list
    const currentPeersList = peers ? peers.split(',').map(p => p.trim()).filter(Boolean) : []
    if (!currentPeersList.includes(relayUrl)) {
      const newPeers = [...currentPeersList, relayUrl].join(', ')
      setPeers(newPeers)
    }
  }

  const getCurrentPeersList = () => {
    return peers ? peers.split(',').map(p => p.trim()).filter(Boolean) : []
  }

  return (
    <>
      {/* Header */}
      <header className="app-header">
        <div className="app-header-content">
          <h1 className="app-title"> Shogun Scan</h1>
          <p className="app-subtitle">Real-time decentralized database scan</p>
        </div>
      </header>

      {/* Main Container */}
      <div className="app-container">
        {/* Tab Navigation */}
        <div style={{ 
          marginBottom: 'var(--space-6)',
          borderBottom: '1px solid var(--gray-200)'
        }}>
          <div style={{ 
            display: 'flex', 
            gap: '0',
            marginBottom: '-1px',
            width: '100%'
          }}>
            <button
              onClick={() => setActiveTab('explorer')}
              style={{
                flex: '1',
                padding: 'var(--space-4) var(--space-5)',
                border: 'none',
                borderBottom: activeTab === 'explorer' ? '3px solid var(--primary)' : '3px solid transparent',
                background: activeTab === 'explorer' ? 'var(--primary-light)' : 'transparent',
                color: activeTab === 'explorer' ? 'var(--primary)' : 'var(--text-secondary)',
                fontWeight: activeTab === 'explorer' ? '600' : '500',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                borderRadius: '0',
                fontSize: '1rem',
                textAlign: 'center',
                minHeight: '60px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 'var(--space-2)'
              }}
            >
              📊 Explorer
            </button>
            <button
              onClick={() => setActiveTab('discover')}
              style={{
                flex: '1',
                padding: 'var(--space-4) var(--space-5)',
                border: 'none',
                borderBottom: activeTab === 'discover' ? '3px solid var(--primary)' : '3px solid transparent',
                background: activeTab === 'discover' ? 'var(--primary-light)' : 'transparent',
                color: activeTab === 'discover' ? 'var(--primary)' : 'var(--text-secondary)',
                fontWeight: activeTab === 'discover' ? '600' : '500',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                borderRadius: '0',
                fontSize: '1rem',
                textAlign: 'center',
                minHeight: '60px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 'var(--space-2)'
              }}
            >
              🔍 Discover
            </button>
          </div>
        </div>

        {/* Connection Panel */}
        <div className="connection-panel">
          <h2 className="connection-title">Connection Settings</h2>
          <div className="connection-form">
            <div className="form-group">
              <label className="form-label" htmlFor="peer-input">
                Gun Peer URLs
              </label>
              <input
                id="peer-input"
                type="text"
                placeholder="http://localhost:8765/gun, ws://peer2.example.com"
                value={peers}
                onChange={handlePeersChange}
              />
              <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                Comma-separated list of Gun peer URLs
              </small>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="root-path-input">
                Root Path
              </label>
              <input
                id="root-path-input"
                type="text"
                placeholder="data"
                value={rootPath}
                onChange={handleRootPathChange}
              />
              <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                Starting path for data exploration
              </small>
            </div>
          </div>
          
          {/* Connection Status */}
          <div style={{ marginTop: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
            <span className={`status-indicator ${connectionStatus === 'connected' ? 'status-connected' : 'status-disconnected'}`}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: connectionStatus === 'connected' ? '#10b981' : '#ef4444' }}></span>
              {connectionStatus === 'connected' ? 'Connected' : 'Disconnected'}
            </span>
            {peers && (
              <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                {peers.split(',').length} peer{peers.split(',').length > 1 ? 's' : ''} configured
              </span>
            )}
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'explorer' && (
          <>
            {/* Sticky Navigation Bar */}
            {selection && (
              <div style={{
                position: 'sticky',
                top: 0,
                zIndex: 100,
                background: 'var(--bg-primary)',
                borderRadius: 'var(--radius)',
                padding: 'var(--space-3)',
                marginBottom: 'var(--space-4)',
                boxShadow: 'var(--shadow-md)',
                border: '1px solid var(--gray-200)'
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 'var(--space-3)'
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ 
                      fontSize: '0.75rem', 
                      color: 'var(--text-muted)', 
                      marginBottom: 'var(--space-1)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.025em'
                    }}>
                      Currently Editing
                    </div>
                    <div style={{ 
                      fontFamily: 'var(--font-mono)', 
                      fontSize: '0.875rem', 
                      color: 'var(--primary)',
                      fontWeight: '500',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      /{selection}
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                    <button
                      onClick={() => {
                        setSelection(null)
                        setSelectedData(null)
                      }}
                      className="btn-secondary"
                      style={{
                        padding: 'var(--space-2) var(--space-3)',
                        fontSize: '0.8rem'
                      }}
                    >
                      ✕ Close Editor
                    </button>
                    
                    <button
                      onClick={() => {
                        const pathParts = selection.split('/')
                        if (pathParts.length > 1) {
                          pathParts.pop()
                          const parentPath = pathParts.join('/') || rootPath
                          setSelection(parentPath)
                        }
                      }}
                      className="btn-secondary"
                      style={{
                        padding: 'var(--space-2) var(--space-3)',
                        fontSize: '0.8rem'
                      }}
                      disabled={selection === rootPath}
                    >
                      ← Back
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="content-grid">
              {/* Data Browser */}
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title">
                    📂 Data Browser
                  </h3>
                </div>
                <div className="card-body">
                  <DataBrowser 
                    path={rootPath} 
                    setSelection={setSelection}
                    onNavigate={(newPath) => {
                      setSelection(newPath)
                      // Scroll to top of editor when navigating
                      setTimeout(() => {
                        const editorCard = document.querySelector('.card:last-child')
                        if (editorCard) {
                          editorCard.scrollIntoView({ behavior: 'smooth', block: 'start' })
                        }
                      }, 100)
                    }}
                  />
                </div>
              </div>

              {/* Data Editor */}
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title">
                    ✏️ Data Editor
                  </h3>
                </div>
                <div className="card-body">
                  <DataEditor 
                    data={selectedData || {}} 
                    path={selection} 
                    basePath={rootPath}
                    onPathDeleted={handlePathDeleted}
                  />
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === 'discover' && (
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">
                🔍 Relay Discovery
              </h3>
            </div>
            <div className="card-body">
              <RelayDiscovery 
                onRelayFound={handleRelayFound}
                currentPeers={getCurrentPeersList()}
              />
            </div>
          </div>
        )}
      </div>

      {/* Help Button */}
      <button 
        id="help-button" 
        onClick={() => setShowHelp(!showHelp)}
        title="Help & Documentation"
      >
        {showHelp ? '✕' : '?'}
      </button>

      {/* Floating Navigation Menu */}
      {activeTab === 'explorer' && selection && (
        <div style={{
          position: 'fixed',
          bottom: 'var(--space-6)',
          left: 'var(--space-6)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-2)',
          zIndex: 1000
        }}>
          <button
            onClick={() => {
              setSelection(null)
              setSelectedData(null)
            }}
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: 'var(--error)',
              color: 'var(--text-inverse)',
              border: 'none',
              fontSize: '1.2rem',
              fontWeight: '600',
              boxShadow: 'var(--shadow-lg)',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            onMouseEnter={(e) => {
              e.target.style.transform = 'scale(1.1)'
              e.target.style.background = '#dc2626'
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = 'scale(1)'
              e.target.style.background = 'var(--error)'
            }}
            title="Close Editor"
          >
            ✕
          </button>
          
          <button
            onClick={() => {
              const pathParts = selection.split('/')
              if (pathParts.length > 1) {
                pathParts.pop()
                const parentPath = pathParts.join('/') || rootPath
                setSelection(parentPath)
              }
            }}
            disabled={selection === rootPath}
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: selection === rootPath ? 'var(--gray-400)' : 'var(--primary)',
              color: 'var(--text-inverse)',
              border: 'none',
              fontSize: '1.2rem',
              fontWeight: '600',
              boxShadow: 'var(--shadow-lg)',
              cursor: selection === rootPath ? 'not-allowed' : 'pointer',
              transition: 'all 0.3s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: selection === rootPath ? 0.5 : 1
            }}
            onMouseEnter={(e) => {
              if (selection !== rootPath) {
                e.target.style.transform = 'scale(1.1)'
                e.target.style.background = 'var(--primary-hover)'
              }
            }}
            onMouseLeave={(e) => {
              if (selection !== rootPath) {
                e.target.style.transform = 'scale(1)'
                e.target.style.background = 'var(--primary)'
              }
            }}
            title="Go Back"
          >
            ←
          </button>
          
          <button
            onClick={() => {
              setSelection(rootPath)
            }}
            disabled={selection === rootPath}
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: selection === rootPath ? 'var(--gray-400)' : 'var(--success)',
              color: 'var(--text-inverse)',
              border: 'none',
              fontSize: '1.2rem',
              fontWeight: '600',
              boxShadow: 'var(--shadow-lg)',
              cursor: selection === rootPath ? 'not-allowed' : 'pointer',
              transition: 'all 0.3s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: selection === rootPath ? 0.5 : 1
            }}
            onMouseEnter={(e) => {
              if (selection !== rootPath) {
                e.target.style.transform = 'scale(1.1)'
                e.target.style.background = '#059669'
              }
            }}
            onMouseLeave={(e) => {
              if (selection !== rootPath) {
                e.target.style.transform = 'scale(1)'
                e.target.style.background = 'var(--success)'
              }
            }}
            title="Go to Root"
          >
            🏠
          </button>
        </div>
      )}

      {/* Help Modal */}
      {showHelp && (
        <div className="help-overlay" onClick={() => setShowHelp(false)}>
          <div className="help-modal" onClick={(e) => e.stopPropagation()}>
            <Help />
            <button 
              className="btn-secondary" 
              onClick={() => setShowHelp(false)}
              style={{ marginTop: 'var(--space-4)' }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  )
}

export default function App() {
  const [peers, setPeers] = useState('http://localhost:8765/gun')
  const [rootPath, setRootPath] = useState('data')

  return (
    <GunProvider peers={peers ? peers.split(',').map(p => p.trim()).filter(Boolean) : []}>
      <AppBody
        peers={peers}
        setPeers={setPeers}
        rootPath={rootPath}
        setRootPath={setRootPath}
      />
    </GunProvider>
  )
}

import React, { useState, useEffect } from 'react'

export default function RelayDiscovery({ onRelayFound, currentPeers = [] }) {
  const [discoveredRelays, setDiscoveredRelays] = useState([])
  const [customRelay, setCustomRelay] = useState('')
  const [scanning, setScanning] = useState(false)
  const [testingRelay, setTestingRelay] = useState(null)
  const [savedRelays, setSavedRelays] = useState([])

  // Common relay endpoints to test
  const commonRelays = [
    'https://gun-manhattan.herokuapp.com/gun',
    'https://peer.wallie.io/gun',
  ]

  useEffect(() => {
    // Load saved relays from localStorage
    const saved = localStorage.getItem('gundb_discovered_relays')
    if (saved) {
      try {
        setSavedRelays(JSON.parse(saved))
      } catch (e) {
        console.error('Error loading saved relays:', e)
      }
    }
  }, [])

  const saveRelay = (relay) => {
    // Check if relay already exists
    const existingIndex = savedRelays.findIndex(r => r.url === relay.url)
    
    if (existingIndex >= 0) {
      // Update existing relay
      const newSaved = [...savedRelays]
      newSaved[existingIndex] = { ...relay, savedAt: Date.now() }
      setSavedRelays(newSaved)
      localStorage.setItem('gundb_discovered_relays', JSON.stringify(newSaved))
    } else {
      // Add new relay
      const newSaved = [...savedRelays, { ...relay, savedAt: Date.now() }]
      setSavedRelays(newSaved)
      localStorage.setItem('gundb_discovered_relays', JSON.stringify(newSaved))
    }
  }

  const removeRelay = (url) => {
    const newSaved = savedRelays.filter(r => r.url !== url)
    setSavedRelays(newSaved)
    localStorage.setItem('gundb_discovered_relays', JSON.stringify(newSaved))
  }

  const testRelay = async (url) => {
    setTestingRelay(url)
    
    try {
      const startTime = Date.now()
      
      // Test HTTP/HTTPS endpoints
      if (url.startsWith('http')) {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 5000)
        
        try {
          const response = await fetch(url, {
            method: 'GET',
            signal: controller.signal,
            headers: {
              'Accept': 'application/json'
            }
          })
          
          clearTimeout(timeoutId)
          const responseTime = Date.now() - startTime
          const isOnline = response.ok || response.status === 200
          
          return {
            url,
            online: isOnline,
            responseTime,
            status: response.status,
            type: 'http',
            lastChecked: Date.now()
          }
        } catch (fetchError) {
          clearTimeout(timeoutId)
          const responseTime = Date.now() - startTime
          
          return {
            url,
            online: false,
            responseTime,
            status: fetchError.name === 'AbortError' ? 'timeout' : 'error',
            type: 'http',
            lastChecked: Date.now(),
            error: fetchError.message
          }
        }
      }
      
      // Test WebSocket endpoints
      if (url.startsWith('ws')) {
        return new Promise((resolve) => {
          const ws = new WebSocket(url)
          const timeout = setTimeout(() => {
            ws.close()
            resolve({
              url,
              online: false,
              responseTime: 5000,
              status: 'timeout',
              type: 'websocket',
              lastChecked: Date.now()
            })
          }, 5000)
          
          ws.onopen = () => {
            clearTimeout(timeout)
            const responseTime = Date.now() - startTime
            ws.close()
            resolve({
              url,
              online: true,
              responseTime,
              status: 'connected',
              type: 'websocket',
              lastChecked: Date.now()
            })
          }
          
          ws.onerror = () => {
            clearTimeout(timeout)
            const responseTime = Date.now() - startTime
            resolve({
              url,
              online: false,
              responseTime,
              status: 'error',
              type: 'websocket',
              lastChecked: Date.now()
            })
          }
        })
      }
      
    } catch (error) {
      return {
        url,
        online: false,
        responseTime: 5000,
        status: error.message,
        type: 'unknown',
        lastChecked: Date.now(),
        error: error.message
      }
    } finally {
      setTestingRelay(null)
    }
  }

  const scanCommonRelays = async () => {
    setScanning(true)
    setDiscoveredRelays([])
    
    const results = []
    
    for (const relay of commonRelays) {
      if (currentPeers.includes(relay)) continue // Skip already configured peers
      
      try {
        const result = await testRelay(relay)
        results.push(result)
        setDiscoveredRelays([...results])
      } catch (error) {
        console.error(`Error testing ${relay}:`, error)
      }
    }
    
    setScanning(false)
  }

  const testCustomRelay = async () => {
    if (!customRelay.trim()) return
    
    const result = await testRelay(customRelay.trim())
    setDiscoveredRelays(prev => [result, ...prev])
    setCustomRelay('')
  }

  const addRelayToPeers = (relay) => {
    if (onRelayFound) {
      onRelayFound(relay.url)
    }
    saveRelay(relay)
  }

  const formatResponseTime = (time) => {
    if (time < 1000) return `${time}ms`
    return `${(time / 1000).toFixed(1)}s`
  }

  const getStatusColor = (relay) => {
    if (!relay.online) return 'var(--error)'
    if (relay.responseTime < 500) return 'var(--success)'
    if (relay.responseTime < 2000) return 'var(--warning)'
    return 'var(--error)'
  }

  return (
    <div>
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <h3 style={{ 
          fontSize: '1.125rem', 
          fontWeight: '600', 
          marginBottom: 'var(--space-4)',
          color: 'var(--text-primary)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)'
        }}>
          🔍 Discover New Relays
        </h3>

        {/* Scan Common Relays */}
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <button
            onClick={scanCommonRelays}
            disabled={scanning}
            className="btn-primary"
            style={{ marginBottom: 'var(--space-3)' }}
          >
            {scanning ? (
              <>
                <div className="loading-spinner" style={{ width: '16px', height: '16px' }}></div>
                Scanning...
              </>
            ) : (
              <>
                🌐 Scan Common Relays
              </>
            )}
          </button>
          
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Test popular GunDB relay endpoints to find active peers
          </p>
        </div>

        {/* Custom Relay Input */}
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <div className="form-group">
            <label className="form-label">
              Test Custom Relay
            </label>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <input
                type="text"
                value={customRelay}
                onChange={(e) => setCustomRelay(e.target.value)}
                placeholder="https://your-relay.com/gun or ws://your-relay.com/gun"
                style={{ flex: 1 }}
                onKeyPress={(e) => e.key === 'Enter' && testCustomRelay()}
              />
              <button
                onClick={testCustomRelay}
                disabled={!customRelay.trim() || testingRelay === customRelay.trim()}
                className="btn-secondary"
              >
                {testingRelay === customRelay.trim() ? '⏳' : '🧪'} Test
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Discovered Relays */}
      {discoveredRelays.length > 0 && (
        <div style={{ marginBottom: 'var(--space-6)' }}>
          <h4 style={{ 
            fontSize: '1rem', 
            fontWeight: '600', 
            marginBottom: 'var(--space-3)',
            color: 'var(--text-primary)'
          }}>
            📡 Discovered Relays ({discoveredRelays.length})
          </h4>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {discoveredRelays.map((relay, index) => (
              <div
                key={index}
                style={{
                  padding: 'var(--space-3)',
                  border: `1px solid ${relay.online ? 'var(--success)' : 'var(--error)'}`,
                  borderRadius: 'var(--radius)',
                  background: relay.online ? '#f0fdf4' : '#fef2f2',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 'var(--space-3)'
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ 
                    fontFamily: 'var(--font-mono)', 
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: 'var(--text-primary)',
                    marginBottom: 'var(--space-1)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {relay.url}
                  </div>
                  <div style={{ 
                    fontSize: '0.75rem', 
                    color: 'var(--text-muted)',
                    display: 'flex',
                    gap: 'var(--space-3)'
                  }}>
                    <span style={{ color: getStatusColor(relay) }}>
                      {relay.online ? '🟢 Online' : '🔴 Offline'}
                    </span>
                    <span>⚡ {formatResponseTime(relay.responseTime)}</span>
                    <span>🔗 {relay.type}</span>
                  </div>
                </div>
                
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  {relay.online && (
                    <button
                      onClick={() => addRelayToPeers(relay)}
                      className="btn-success"
                      style={{ 
                        padding: 'var(--space-1) var(--space-3)',
                        fontSize: '0.8rem'
                      }}
                      disabled={currentPeers.includes(relay.url)}
                    >
                      {currentPeers.includes(relay.url) ? '✓ Added' : '➕ Add'}
                    </button>
                  )}
                  <button
                    onClick={() => testRelay(relay.url)}
                    disabled={testingRelay === relay.url}
                    className="btn-secondary"
                    style={{ 
                      padding: 'var(--space-1) var(--space-3)',
                      fontSize: '0.8rem'
                    }}
                  >
                    {testingRelay === relay.url ? '⏳' : '🔄'} Retest
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Saved Relays */}
      {savedRelays.length > 0 && (
        <div>
          <h4 style={{ 
            fontSize: '1rem', 
            fontWeight: '600', 
            marginBottom: 'var(--space-3)',
            color: 'var(--text-primary)'
          }}>
            💾 Saved Relays ({savedRelays.length})
          </h4>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {savedRelays.map((relay, index) => (
              <div
                key={index}
                style={{
                  padding: 'var(--space-3)',
                  border: '1px solid var(--gray-200)',
                  borderRadius: 'var(--radius)',
                  background: 'var(--bg-primary)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 'var(--space-3)'
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ 
                    fontFamily: 'var(--font-mono)', 
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: 'var(--text-primary)',
                    marginBottom: 'var(--space-1)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {relay.url}
                  </div>
                  <div style={{ 
                    fontSize: '0.75rem', 
                    color: 'var(--text-muted)'
                  }}>
                    Saved {new Date(relay.savedAt).toLocaleDateString()}
                  </div>
                </div>
                
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  <button
                    onClick={() => addRelayToPeers(relay)}
                    className="btn-primary"
                    style={{ 
                      padding: 'var(--space-1) var(--space-3)',
                      fontSize: '0.8rem'
                    }}
                    disabled={currentPeers.includes(relay.url)}
                  >
                    {currentPeers.includes(relay.url) ? '✓ Active' : '🔗 Use'}
                  </button>
                  <button
                    onClick={() => removeRelay(relay.url)}
                    className="btn-danger"
                    style={{ 
                      padding: 'var(--space-1) var(--space-3)',
                      fontSize: '0.8rem'
                    }}
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Help Text */}
      <div style={{ 
        marginTop: 'var(--space-6)', 
        padding: 'var(--space-3)',
        background: 'var(--gray-50)',
        borderRadius: 'var(--radius)',
        fontSize: '0.875rem',
        color: 'var(--text-secondary)'
      }}>
        <div style={{ fontWeight: '500', marginBottom: 'var(--space-1)' }}>💡 Tips:</div>
        <ul style={{ marginLeft: 'var(--space-4)', lineHeight: '1.6' }}>
          <li>Green relays are online and ready to use</li>
          <li>Response time indicates relay performance</li>
          <li>WebSocket (ws/wss) connections are generally faster</li>
          <li>Saved relays are stored locally for future use</li>
        </ul>
      </div>
    </div>
  )
} 
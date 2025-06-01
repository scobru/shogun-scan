import React, { useEffect, useState } from 'react'
import { useGun } from '../api/gunContext'
import { getNode } from '../api/gunHelpers'

export default function DataBrowser({ setSelection, path = 'data', onNavigate, basePath = 'data' }) {
  const gun = useGun()
  const [data, setData] = useState({})
  const [loading, setLoading] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [pathHistory, setPathHistory] = useState([basePath])

  useEffect(() => {
    if (!gun) return
    
    setLoading(true)
    const nodeRef = getNode(gun, path)
    nodeRef.on((nodeData) => {
      setData(nodeData || {})
      setLoading(false)
    })

    return () => {
      nodeRef.off()
    }
  }, [gun, path])

  const handleSelect = (key, value) => {
    const nextPath =
      value && typeof value === 'object' && '#' in value
        ? value['#']
        : `${path}/${key}`

    // Add to path history if it's a new path
    if (!pathHistory.includes(nextPath)) {
      setPathHistory(prev => [...prev, nextPath])
    }

    setSelection(nextPath)
    if (onNavigate) {
      onNavigate(nextPath)
    }
  }

  const navigateToPath = (targetPath) => {
    setSelection(targetPath)
    if (onNavigate) {
      onNavigate(targetPath)
    }
  }

  const goBack = () => {
    const pathParts = path.split('/')
    if (pathParts.length > 1) {
      pathParts.pop()
      const parentPath = pathParts.join('/') || basePath
      navigateToPath(parentPath)
    }
  }

  const goToRoot = () => {
    navigateToPath(basePath)
  }

  const renderBreadcrumb = () => {
    const pathParts = path.split('/')
    
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-2)',
        marginBottom: 'var(--space-4)',
        padding: 'var(--space-3)',
        background: 'var(--gray-50)',
        borderRadius: 'var(--radius)',
        border: '1px solid var(--gray-200)',
        flexWrap: 'wrap'
      }}>
        {/* Back Button */}
        {path !== basePath && (
          <button
            onClick={goBack}
            className="btn-secondary"
            style={{
              padding: 'var(--space-1) var(--space-2)',
              fontSize: '0.8rem',
              minWidth: 'auto'
            }}
            title="Go back"
          >
            ← Back
          </button>
        )}

        {/* Root Button */}
        <button
          onClick={goToRoot}
          style={{
            background: path === basePath ? 'var(--primary)' : 'transparent',
            color: path === basePath ? 'var(--text-inverse)' : 'var(--primary)',
            border: '1px solid var(--primary)',
            borderRadius: 'var(--radius-sm)',
            padding: 'var(--space-1) var(--space-2)',
            fontSize: '0.8rem',
            cursor: 'pointer',
            fontWeight: '500',
            transition: 'all 0.2s ease'
          }}
          title="Go to root"
        >
          🏠 {basePath}
        </button>

        {/* Breadcrumb Path */}
        {pathParts.length > 1 && pathParts.slice(1).map((part, index) => {
          const partPath = pathParts.slice(0, index + 2).join('/')
          const isLast = index === pathParts.length - 2
          const truncatedPart = part.length > 20 ? `${part.substring(0, 10)}...${part.substring(part.length - 7)}` : part
          
          return (
            <React.Fragment key={index}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                /
              </span>
              <button
                onClick={() => navigateToPath(partPath)}
                style={{
                  background: isLast ? 'var(--primary)' : 'transparent',
                  color: isLast ? 'var(--text-inverse)' : 'var(--primary)',
                  border: '1px solid var(--primary)',
                  borderRadius: 'var(--radius-sm)',
                  padding: 'var(--space-1) var(--space-2)',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  fontWeight: isLast ? '600' : '500',
                  fontFamily: 'var(--font-mono)',
                  transition: 'all 0.2s ease',
                  maxWidth: '150px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
                title={part}
              >
                {truncatedPart}
              </button>
            </React.Fragment>
          )
        })}
      </div>
    )
  }

  const handleDeleteClick = (e, key) => {
    e.stopPropagation() // Prevent triggering the select action
    setDeleteConfirm(key)
  }

  const confirmDelete = async (key) => {
    if (!gun) return

    setDeleting(key)
    try {
      const nodeRef = getNode(gun, path)
      // In GunDB, to delete a property, we set it to null
      nodeRef.put({ [key]: null })
      
      // Update local state immediately for better UX
      setData(prevData => {
        const newData = { ...prevData }
        delete newData[key]
        return newData
      })
    } catch (error) {
      console.error('Error deleting item:', error)
      // You could add error handling here
    }
    
    setDeleting(null)
    setDeleteConfirm(null)
  }

  const cancelDelete = () => {
    setDeleteConfirm(null)
  }

  const getValueType = (value) => {
    if (value === null) return 'null'
    if (Array.isArray(value)) return 'array'
    return typeof value
  }

  const formatValue = (value) => {
    if (value === null) return 'null'
    if (value === undefined) return 'undefined'
    if (typeof value === 'object') {
      if ('#' in value) return `{ reference: ${value['#']} }`
      return `{ ${Object.keys(value).length} properties }`
    }
    if (typeof value === 'string') return `"${value}"`
    return String(value)
  }

  const truncateKey = (key, maxLength = 40) => {
    if (key.length <= maxLength) return key
    
    // For very long keys (like public keys), show start and end
    const start = key.substring(0, 12)
    const end = key.substring(key.length - 8)
    return `${start}...${end}`
  }

  const renderData = () => {
    const items = Object.entries(data).filter(([key]) => key !== '_' && key !== '#')
    
    if (items.length === 0) {
      return (
        <div style={{ 
          textAlign: 'center', 
          padding: 'var(--space-8)', 
          color: 'var(--text-muted)',
          fontStyle: 'italic'
        }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-2)' }}>
              <div className="loading-spinner"></div>
              Loading data...
            </div>
          ) : (
            <>
              <div style={{ fontSize: '2rem', marginBottom: 'var(--space-2)' }}>📭</div>
              No data found at this path
            </>
          )}
        </div>
      )
    }

    return items.map(([key, value]) => {
      const valueType = getValueType(value)
      const isDeleting = deleting === key
      
      return (
        <div 
          key={key}
          className="data-item"
          onClick={() => handleSelect(key, value)}
          title={`Click to explore: ${key}`}
          style={{
            opacity: isDeleting ? 0.5 : 1,
            pointerEvents: isDeleting ? 'none' : 'auto'
          }}
        >
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 'var(--space-3)', 
            flex: 1,
            minWidth: 0, // Allow shrinking
            overflow: 'hidden'
          }}>
            <span 
              className="data-key" 
              style={{ 
                maxWidth: '200px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-1)'
              }}
              title={key} // Show full key on hover
            >
              {truncateKey(key)}
              {key.length > 40 && (
                <span style={{ 
                  fontSize: '0.7rem', 
                  color: 'var(--text-muted)',
                  fontWeight: 'normal'
                }}>
                  ⋯
                </span>
              )}
            </span>
            <span 
              className="data-value"
              style={{
                maxWidth: '150px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                flexShrink: 1
              }}
              title={formatValue(value)} // Show full value on hover
            >
              {formatValue(value)}
            </span>
          </div>
          
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 'var(--space-2)',
            flexShrink: 0 // Prevent buttons from shrinking
          }}>
            <span className={`data-type-indicator type-${valueType}`}>
              {valueType}
            </span>
            
            {/* Delete Button */}
            <button
              onClick={(e) => handleDeleteClick(e, key)}
              disabled={isDeleting}
              className="delete-btn"
              title={`Delete ${key}`}
            >
              {isDeleting ? '⏳' : '🗑️'}
            </button>
          </div>
        </div>
      )
    })
  }

  return (
    <div>
      {/* Breadcrumb Navigation */}
      {renderBreadcrumb()}

      {/* Data Items */}
      <div style={{ minHeight: '200px' }}>
        {renderData()}
      </div>

      {/* Statistics */}
      {data && Object.keys(data).filter(key => key !== '_' && key !== '#').length > 0 && (
        <div style={{ 
          marginTop: 'var(--space-4)', 
          padding: 'var(--space-3)',
          background: 'var(--gray-50)',
          borderRadius: 'var(--radius)',
          fontSize: '0.875rem',
          color: 'var(--text-secondary)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>📊 {Object.keys(data).filter(key => key !== '_' && key !== '#').length} items found</span>
          
          {/* Quick Navigation */}
          {path !== basePath && (
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <button
                onClick={goBack}
                className="btn-secondary"
                style={{
                  padding: 'var(--space-1) var(--space-2)',
                  fontSize: '0.75rem'
                }}
              >
                ← Back
              </button>
              <button
                onClick={goToRoot}
                className="btn-secondary"
                style={{
                  padding: 'var(--space-1) var(--space-2)',
                  fontSize: '0.75rem'
                }}
              >
                🏠 Root
              </button>
            </div>
          )}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgb(0 0 0 / 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000,
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            background: 'var(--bg-primary)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-6)',
            maxWidth: '400px',
            margin: 'var(--space-4)',
            boxShadow: 'var(--shadow-lg)',
            border: '1px solid var(--gray-200)'
          }}>
            <h3 style={{
              fontSize: '1.25rem',
              fontWeight: '600',
              marginBottom: 'var(--space-4)',
              color: 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)'
            }}>
              ⚠️ Confirm Delete
            </h3>
            
            <p style={{
              marginBottom: 'var(--space-4)',
              color: 'var(--text-secondary)',
              lineHeight: '1.6'
            }}>
              Are you sure you want to delete the item <strong style={{ color: 'var(--text-primary)' }}>"{deleteConfirm}"</strong>?
              <br />
              <span style={{ fontSize: '0.875rem', color: 'var(--error)' }}>
                This action cannot be undone.
              </span>
            </p>
            
            <div style={{
              display: 'flex',
              gap: 'var(--space-3)',
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={cancelDelete}
                className="btn-secondary"
                style={{ padding: 'var(--space-2) var(--space-4)' }}
              >
                Cancel
              </button>
              <button
                onClick={() => confirmDelete(deleteConfirm)}
                style={{
                  background: 'var(--error)',
                  color: 'var(--text-inverse)',
                  border: 'none',
                  borderRadius: 'var(--radius)',
                  padding: 'var(--space-2) var(--space-4)',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => e.target.style.background = '#dc2626'}
                onMouseLeave={(e) => e.target.style.background = 'var(--error)'}
              >
                🗑️ Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
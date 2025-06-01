import React, { useEffect, useState } from 'react'
import { useGun } from '../api/gunContext'
import { getNode } from '../api/gunHelpers'
import JSONItem from './JSONItem'

export default function DataEditor({ data, path, basePath = 'data', onPathDeleted }) {
  const gun = useGun()
  const [keyName, setKeyName] = useState('')
  const [value, setValue] = useState({})
  const [saving, setSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  
  const handleSave = async (e) => {
    e.preventDefault()
    
    if (!gun) {
      setSaveStatus({ type: 'error', message: 'Not connected to Gun' })
      return
    }

    setSaving(true)
    setSaveStatus(null)

    try {
      const target = path ? getNode(gun, path) : getNode(gun, basePath)
      
      if (path) {
        target.put(value)
        setSaveStatus({ type: 'success', message: 'Data updated successfully' })
      } else {
        if (!keyName || value === undefined) {
          setSaveStatus({ type: 'error', message: 'Key name and value are required' })
          setSaving(false)
          return
        }
        target.put({ [keyName]: value })
        setKeyName('')
        setSaveStatus({ type: 'success', message: 'Data saved successfully' })
      }
      
      setValue('')
    } catch (error) {
      setSaveStatus({ type: 'error', message: `Save failed: ${error.message}` })
    }
    
    setSaving(false)
    
    // Clear status after 3 seconds
    setTimeout(() => setSaveStatus(null), 3000)
  }

  const handleDeletePath = async () => {
    if (!gun || !path) return

    setDeleting(true)
    try {
      // Get the parent path and key
      const pathParts = path.split('/')
      const keyToDelete = pathParts.pop()
      const parentPath = pathParts.join('/') || basePath

      // Delete the current path by setting it to null in the parent
      const parentNode = getNode(gun, parentPath)
      parentNode.put({ [keyToDelete]: null })

      setSaveStatus({ type: 'success', message: 'Path deleted successfully' })
      
      // Notify parent component that path was deleted
      if (onPathDeleted) {
        onPathDeleted(path)
      }
      
    } catch (error) {
      setSaveStatus({ type: 'error', message: `Delete failed: ${error.message}` })
    }
    
    setDeleting(false)
    setShowDeleteConfirm(false)
    
    // Clear status after 3 seconds
    setTimeout(() => setSaveStatus(null), 3000)
  }
  
  useEffect(() => {
    const newValue = { ...data }
    delete newValue['#']
    delete newValue['_']
    setValue(newValue)
  }, [data])

  const isFormValid = path || (keyName && value !== undefined)
  
  return (
    <div>
      {/* Current Selection Display */}
      {path && (
        <div style={{ 
          marginBottom: 'var(--space-4)', 
          padding: 'var(--space-2) var(--space-3)',
          background: 'var(--primary-light)',
          borderRadius: 'var(--radius)',
          border: '1px solid var(--primary)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--primary)', marginBottom: 'var(--space-1)' }}>
              EDITING PATH
            </div>
            <div className="font-mono" style={{ fontSize: '0.875rem', color: 'var(--primary)' }}>
              /{path}
            </div>
          </div>
          
          {/* Delete Path Button */}
          <button
            onClick={() => setShowDeleteConfirm(true)}
            disabled={deleting}
            className="btn-danger"
            style={{
              background: 'var(--error)',
              color: 'var(--text-inverse)',
              border: 'none',
              borderRadius: 'var(--radius)',
              padding: 'var(--space-2) var(--space-4)',
              fontSize: '0.875rem',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              opacity: deleting ? 0.5 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              boxShadow: 'var(--shadow-sm)',
              minHeight: '36px'
            }}
            onMouseEnter={(e) => !deleting && (e.target.style.background = '#dc2626', e.target.style.boxShadow = 'var(--shadow)')}
            onMouseLeave={(e) => !deleting && (e.target.style.background = 'var(--error)', e.target.style.boxShadow = 'var(--shadow-sm)')}
            title="Delete this entire path"
          >
            {deleting ? (
              <>
                <div className="loading-spinner" style={{ width: '16px', height: '16px' }}></div>
                Deleting...
              </>
            ) : (
              <>
                🗑️ Delete Path
              </>
            )}
          </button>
        </div>
      )}

      {/* Editor Form */}
      <form onSubmit={handleSave} className="editor-form">
        {/* Key Input (only shown when not editing existing path) */}
        {!path && (
          <div className="form-group">
            <label className="form-label" htmlFor="keyName">
              Key Name
            </label>
            <input
              id="keyName"
              type="text"
              value={keyName}
              onChange={(e) => setKeyName(e.target.value)}
              placeholder="Enter key name..."
              style={{ fontFamily: 'var(--font-mono)' }}
            />
          </div>
        )}
        
        {/* Value Input */}
        <div className="form-group">
          <label className="form-label" htmlFor="value">
            {path ? 'Update Value' : 'Value'}
          </label>
          <JSONItem
            id="value"
            data={value}
            setData={setValue}
          />
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
          <button 
            disabled={!isFormValid || saving} 
            type="submit"
            className="btn-primary"
          >
            {saving ? (
              <>
                <div className="loading-spinner" style={{ width: '16px', height: '16px' }}></div>
                Saving...
              </>
            ) : (
              <>
                💾 {path ? 'Update' : 'Save'} to Gun
              </>
            )}
          </button>

          {/* Clear Button */}
          {(keyName || Object.keys(value).length > 0) && (
            <button 
              type="button"
              className="btn-secondary"
              onClick={() => {
                setKeyName('')
                setValue({})
                setSaveStatus(null)
              }}
            >
              🗑️ Clear
            </button>
          )}
        </div>

        {/* Save Status */}
        {saveStatus && (
          <div style={{
            padding: 'var(--space-3)',
            borderRadius: 'var(--radius)',
            fontSize: '0.875rem',
            fontWeight: '500',
            ...(saveStatus.type === 'success' ? {
              background: '#dcfce7',
              color: '#166534',
              border: '1px solid #bbf7d0'
            } : {
              background: '#fee2e2',
              color: '#991b1b',
              border: '1px solid #fecaca'
            })
          }}>
            {saveStatus.type === 'success' ? '✅' : '❌'} {saveStatus.message}
          </div>
        )}
      </form>
      
      {/* JSON Preview */}
      {Object.keys(value).length > 0 && (
        <div style={{ marginTop: 'var(--space-6)' }}>
          <div className="form-label" style={{ marginBottom: 'var(--space-2)' }}>
            JSON Preview
          </div>
          <pre className="json-preview">
            {JSON.stringify(value, null, 2)}
          </pre>
        </div>
      )}

      {/* Help Text */}
      <div style={{ 
        marginTop: 'var(--space-4)', 
        padding: 'var(--space-3)',
        background: 'var(--gray-50)',
        borderRadius: 'var(--radius)',
        fontSize: '0.875rem',
        color: 'var(--text-secondary)'
      }}>
        <div style={{ fontWeight: '500', marginBottom: 'var(--space-1)' }}>💡 Tips:</div>
        <ul style={{ marginLeft: 'var(--space-4)', lineHeight: '1.6' }}>
          <li>Click on items in the Data Browser to edit them</li>
          <li>Use valid JSON syntax for complex values</li>
          <li>Data is saved in real-time to the Gun network</li>
          <li>Use the 🗑️ buttons to delete individual items or entire paths</li>
        </ul>
      </div>

      {/* Delete Path Confirmation Modal */}
      {showDeleteConfirm && (
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
            maxWidth: '500px',
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
              ⚠️ Delete Entire Path
            </h3>
            
            <p style={{
              marginBottom: 'var(--space-4)',
              color: 'var(--text-secondary)',
              lineHeight: '1.6'
            }}>
              Are you sure you want to delete the entire path{' '}
              <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                /{path}
              </strong>{' '}
              and all its data?
              <br />
              <span style={{ fontSize: '0.875rem', color: 'var(--error)', fontWeight: '500' }}>
                ⚠️ This action cannot be undone and will remove all nested data.
              </span>
            </p>
            
            <div style={{
              display: 'flex',
              gap: 'var(--space-3)',
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="btn-secondary"
                style={{ padding: 'var(--space-2) var(--space-4)' }}
              >
                Cancel
              </button>
              <button
                onClick={handleDeletePath}
                disabled={deleting}
                style={{
                  background: 'var(--error)',
                  color: 'var(--text-inverse)',
                  border: 'none',
                  borderRadius: 'var(--radius)',
                  padding: 'var(--space-2) var(--space-4)',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  opacity: deleting ? 0.5 : 1
                }}
                onMouseEnter={(e) => !deleting && (e.target.style.background = '#dc2626')}
                onMouseLeave={(e) => !deleting && (e.target.style.background = 'var(--error)')}
              >
                {deleting ? '⏳ Deleting...' : '🗑️ Delete Path'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
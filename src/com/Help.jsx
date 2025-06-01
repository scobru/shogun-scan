import React from 'react'

export default function Help() {
  return (
    <div>
      <h2 style={{ 
        fontSize: '1.5rem', 
        fontWeight: '700', 
        marginBottom: 'var(--space-4)',
        color: 'var(--text-primary)'
      }}>
        🔧 GunDB Explorer Help
      </h2>
      
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        gap: 'var(--space-6)',
        color: 'var(--text-primary)',
        lineHeight: '1.6'
      }}>
        
        {/* Getting Started */}
        <section>
          <h3 style={{ 
            fontSize: '1.125rem', 
            fontWeight: '600', 
            marginBottom: 'var(--space-2)',
            color: 'var(--primary)'
          }}>
            🚀 Getting Started
          </h3>
          <ul style={{ marginLeft: 'var(--space-4)' }}>
            <li>Configure your Gun peer URLs in the Connection Settings</li>
            <li>Set the root path where you want to start exploring data</li>
            <li>The connection status indicator shows if you're connected</li>
          </ul>
        </section>

        {/* Data Browser */}
        <section>
          <h3 style={{ 
            fontSize: '1.125rem', 
            fontWeight: '600', 
            marginBottom: 'var(--space-2)',
            color: 'var(--primary)'
          }}>
            📂 Data Browser
          </h3>
          <ul style={{ marginLeft: 'var(--space-4)' }}>
            <li>Browse through your Gun database structure</li>
            <li>Click on any item to navigate deeper or edit it</li>
            <li>Type indicators show the data type (object, string, number, etc.)</li>
            <li>The current path shows your location in the database</li>
          </ul>
        </section>

        {/* Data Editor */}
        <section>
          <h3 style={{ 
            fontSize: '1.125rem', 
            fontWeight: '600', 
            marginBottom: 'var(--space-2)',
            color: 'var(--primary)'
          }}>
            ✏️ Data Editor
          </h3>
          <ul style={{ marginLeft: 'var(--space-4)' }}>
            <li>Edit existing data by selecting it in the Data Browser</li>
            <li>Create new data by entering a key name and value</li>
            <li>Supports JSON syntax for complex objects and arrays</li>
            <li>Changes are saved immediately to the Gun network</li>
          </ul>
        </section>

        {/* Tips & Tricks */}
        <section>
          <h3 style={{ 
            fontSize: '1.125rem', 
            fontWeight: '600', 
            marginBottom: 'var(--space-2)',
            color: 'var(--primary)'
          }}>
            💡 Tips & Tricks
          </h3>
          <ul style={{ marginLeft: 'var(--space-4)' }}>
            <li>Use multiple peer URLs (comma-separated) for redundancy</li>
            <li>Gun automatically syncs data across all connected peers</li>
            <li>Data is stored permanently and syncs in real-time</li>
            <li>Use meaningful key names for better organization</li>
          </ul>
        </section>

        {/* Troubleshooting */}
        <section>
          <h3 style={{ 
            fontSize: '1.125rem', 
            fontWeight: '600', 
            marginBottom: 'var(--space-2)',
            color: 'var(--error)'
          }}>
            🔧 Troubleshooting
          </h3>
          <ul style={{ marginLeft: 'var(--space-4)' }}>
            <li>If disconnected, check your peer URLs and network connection</li>
            <li>Ensure your Gun peers are running and accessible</li>
            <li>Try refreshing the page if data doesn't load</li>
            <li>Check browser console for detailed error messages</li>
          </ul>
        </section>

        {/* About */}
        <section style={{ 
          marginTop: 'var(--space-4)',
          padding: 'var(--space-4)',
          background: 'var(--gray-50)',
          borderRadius: 'var(--radius)',
          border: '1px solid var(--gray-200)'
        }}>
          <h3 style={{ 
            fontSize: '1.125rem', 
            fontWeight: '600', 
            marginBottom: 'var(--space-2)',
            color: 'var(--text-primary)'
          }}>
            ℹ️ About GunDB Explorer
          </h3>
          <p style={{ marginBottom: 'var(--space-2)' }}>
            A modern, user-friendly interface for exploring and editing GunDB databases. 
            Built with React and designed for developers and database administrators.
          </p>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            GunDB is a decentralized, real-time database that automatically syncs data 
            across multiple peers without requiring a central server.
          </p>
        </section>
      </div>
    </div>
  )
}
import React from 'react'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error) {
    return { error }
  }
  componentDidCatch(error, info) {
    console.error('[App Crash]', error, info)
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 32, fontFamily: 'monospace', background: '#fff1f0', minHeight: '100vh' }}>
          <h2 style={{ color: '#c00' }}>⚠ App Render Error</h2>
          <p style={{ color: '#666', fontSize: 13 }}>Open DevTools (F12) for more details.</p>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, color: '#a00', background: '#fff', padding: 12, borderRadius: 6, border: '1px solid #fcc' }}>
            {this.state.error?.message}
            {'\n\n'}
            {this.state.error?.stack}
          </pre>
          <button
            onClick={() => this.setState({ error: null })}
            style={{ marginTop: 16, padding: '8px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14 }}
          >
            Retry
          </button>
        </div>
      )
    }
    return this.props.children
  }
}


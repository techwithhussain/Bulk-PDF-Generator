import { useState } from 'react'

export default function ActivationScreen({ onActivated }) {
  const [key, setKey] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [keyParts, setKeyParts] = useState(['', '', ''])

  // Format key as TWH-XXXX-XXXX-XXXX
  function handleKeyInput(partIndex, value) {
    const clean = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4)
    const newParts = [...keyParts]
    newParts[partIndex] = clean
    setKeyParts(newParts)
    setKey(newParts.join('-'))
    setError('')

    // Auto-focus next input
    if (clean.length === 4 && partIndex < 3) {
      const next = document.getElementById(`key-part-${partIndex + 1}`)
      if (next) next.focus()
    }
  }

  async function handleActivate() {
    const fullKey = 'TWH-' + keyParts.join('-')
    if (keyParts.join('').length < 12) {
      setError('Please enter a complete license key')
      return
    }

    setLoading(true)
    setError('')

    try {
      const result = await window.api.license.activate(fullKey)
      if (result.success) {
        onActivated(result.userName)
      } else {
        setError(result.error || 'Activation failed')
      }
    } catch (err) {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #f0f4ff 0%, #e8f0fe 100%)' }}>
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">

          {/* Header */}
          <div className="px-8 pt-8 pb-6 text-center" style={{ background: 'linear-gradient(135deg, #1a73e8 0%, #0d47a1 100%)' }}>
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(255,255,255,0.2)' }}>
              <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white">Local PDF Studio</h1>
            <p className="text-blue-200 text-sm mt-1">Activation Required</p>
          </div>

          {/* Body */}
          <div className="px-8 py-6">
            <p className="text-gray-600 text-sm text-center mb-6">
              Enter your license key to activate the application.
              <br />
              <span className="text-xs text-gray-400">(Internet required for first-time activation only)</span>
            </p>

            {/* Key Input — single text field */}
            <div className="mb-2">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                License Key
              </label>

              {/* Visual grouped inputs */}
              <div className="flex items-center justify-center gap-1.5 flex-wrap">
                <div className="bg-gray-100 rounded-lg px-3 py-2.5 text-sm font-mono font-bold text-gray-500">
                  TWH
                </div>
                <span className="text-gray-400 font-bold text-lg">-</span>
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <input
                      id={`key-part-${i}`}
                      type="text"
                      maxLength={4}
                      value={keyParts[i]}
                      onChange={e => handleKeyInput(i, e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Backspace' && keyParts[i] === '' && i > 0) {
                          document.getElementById(`key-part-${i - 1}`)?.focus()
                        }
                      }}
                      placeholder="XXXX"
                      className="w-16 text-center font-mono font-bold text-base border-2 border-gray-200 rounded-lg py-2.5 px-1 focus:border-blue-500 focus:outline-none uppercase"
                      style={{ letterSpacing: '0.12em' }}
                    />
                    {i < 2 && <span className="text-gray-400 font-bold text-lg">-</span>}
                  </div>
                ))}
              </div>

              <div className="text-center mt-2">
                <span className="text-xs text-gray-400 font-mono">
                  TWH-{keyParts[0] || 'XXXX'}-{keyParts[1] || 'XXXX'}-{keyParts[2] || 'XXXX'}
                </span>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                <svg className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm text-red-700">{error}</span>
              </div>
            )}

            {/* Activate Button */}
            <button
              onClick={handleActivate}
              disabled={loading || keyParts.join('').length < 12}
              className="w-full mt-5 py-3 px-6 rounded-xl font-semibold text-white transition-all"
              style={{
                background: loading || keyParts.join('').length < 12
                  ? '#9ca3af'
                  : 'linear-gradient(135deg, #1a73e8 0%, #0d47a1 100%)',
                cursor: loading || keyParts.join('').length < 12 ? 'not-allowed' : 'pointer'
              }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Verifying...
                </span>
              ) : '🔑 Activate Application'}
            </button>
          </div>

          {/* Footer */}
          <div className="px-8 pb-6 text-center border-t border-gray-100 pt-4 space-y-3">
            <p className="text-xs text-gray-400">
              Need a license key? Contact us:
            </p>

            {/* Telegram Button */}
            <a
              href="https://t.me/techwithhussain"
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2 mx-auto w-fit px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90"
              style={{ background: '#0088CC' }}
            >
              {/* Telegram icon */}
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
              </svg>
              Telegram: @techwithhussain
            </a>

            {/* Website */}
            <div>
              <a
                href="https://techwithhussain.online/"
                target="_blank"
                rel="noreferrer"
                className="text-xs text-blue-500 hover:text-blue-700"
              >
                techwithhussain.online
              </a>
            </div>
          </div>
        </div>

        {/* Bottom branding */}
        <p className="text-center text-xs text-gray-400 mt-4">
          Made by <span className="font-semibold text-gray-600">Tech With Hussain</span>
        </p>
      </div>
    </div>
  )
}


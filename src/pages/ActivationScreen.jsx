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

            {/* WhatsApp Button */}
            <a
              href="https://wa.me/6005401734?text=Hi%2C%20I%20need%20a%20license%20key%20for%20Local%20PDF%20Studio"
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2 mx-auto w-fit px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90"
              style={{ background: '#25D366' }}
            >
              {/* WhatsApp icon */}
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              WhatsApp: +60 054-0173 4
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


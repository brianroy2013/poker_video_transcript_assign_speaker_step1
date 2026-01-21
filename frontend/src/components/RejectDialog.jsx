import { useState, useEffect, useRef } from 'react'

function RejectDialog({ correction, onConfirm, onCancel }) {
  const [customText, setCustomText] = useState('')
  const inputRef = useRef(null)

  // Pre-fill with suggested text if available, otherwise original
  useEffect(() => {
    if (correction) {
      setCustomText(correction.suggested || correction.original || '')
    }
    // Focus input on open
    setTimeout(() => inputRef.current?.focus(), 100)
  }, [correction])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (customText.trim()) {
      onConfirm(customText.trim())
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onCancel()
    }
  }

  if (!correction) return null

  return (
    <div className="dialog-overlay" onClick={onCancel}>
      <div className="dialog" onClick={e => e.stopPropagation()}>
        <h2>Provide Correct Text</h2>

        <form onSubmit={handleSubmit}>
          <div className="dialog-field">
            <label>Original (from transcript):</label>
            <div className="dialog-text readonly">"{correction.original}"</div>
          </div>

          {correction.suggested && (
            <div className="dialog-field">
              <label>AI Suggested:</label>
              <div className="dialog-text readonly">"{correction.suggested}"</div>
            </div>
          )}

          <div className="dialog-field">
            <label htmlFor="customText">Your correction:</label>
            <input
              ref={inputRef}
              id="customText"
              type="text"
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter the correct text..."
              autoFocus
            />
          </div>

          <div className="dialog-hint">
            Press Enter to confirm, Escape to cancel
          </div>

          <div className="dialog-actions">
            <button type="button" className="btn btn-secondary" onClick={onCancel}>
              Cancel (Esc)
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!customText.trim()}
            >
              Confirm (Enter)
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default RejectDialog

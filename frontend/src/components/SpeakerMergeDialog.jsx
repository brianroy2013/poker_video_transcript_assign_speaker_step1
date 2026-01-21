import { useState, useEffect, useRef } from 'react'

function SpeakerMergeDialog({ suggestion, knownSpeakers, onConfirm, onCancel }) {
  const [selectedSpeaker, setSelectedSpeaker] = useState('')
  const [newSpeakerName, setNewSpeakerName] = useState('')
  const [mode, setMode] = useState('select') // 'select' or 'new'
  const inputRef = useRef(null)

  useEffect(() => {
    if (suggestion?.prev_speaker) {
      setSelectedSpeaker(suggestion.prev_speaker)
    } else if (knownSpeakers.length > 0) {
      setSelectedSpeaker(knownSpeakers[0])
    }
  }, [suggestion, knownSpeakers])

  useEffect(() => {
    if (mode === 'new') {
      inputRef.current?.focus()
    }
  }, [mode])

  const handleSubmit = (e) => {
    e.preventDefault()
    const speaker = mode === 'new' ? newSpeakerName.trim() : selectedSpeaker
    if (speaker) {
      onConfirm(speaker)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onCancel()
    }
  }

  if (!suggestion) return null

  return (
    <div className="dialog-overlay" onClick={onCancel}>
      <div className="dialog speaker-dialog" onClick={e => e.stopPropagation()}>
        <h2>Assign Speaker</h2>

        <div className="dialog-field">
          <label>Segment text:</label>
          <div className="dialog-text readonly">"{suggestion.text}"</div>
        </div>

        <div className="dialog-field">
          <label>Time range:</label>
          <div className="dialog-text readonly">
            {suggestion.start?.toFixed(1)}s - {suggestion.end?.toFixed(1)}s
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="dialog-field">
            <label>Select assignment method:</label>
            <div className="mode-selector">
              <button
                type="button"
                className={`mode-btn ${mode === 'select' ? 'active' : ''}`}
                onClick={() => setMode('select')}
              >
                Choose Existing Speaker
              </button>
              <button
                type="button"
                className={`mode-btn ${mode === 'new' ? 'active' : ''}`}
                onClick={() => setMode('new')}
              >
                Create New Speaker
              </button>
            </div>
          </div>

          {mode === 'select' ? (
            <div className="dialog-field">
              <label htmlFor="speakerSelect">Select speaker:</label>
              <select
                id="speakerSelect"
                value={selectedSpeaker}
                onChange={(e) => setSelectedSpeaker(e.target.value)}
                onKeyDown={handleKeyDown}
              >
                {knownSpeakers.map(speaker => (
                  <option key={speaker} value={speaker}>
                    {speaker}
                    {speaker === suggestion.prev_speaker ? ' (previous)' : ''}
                    {speaker === suggestion.next_speaker ? ' (next)' : ''}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="dialog-field">
              <label htmlFor="newSpeaker">New speaker name:</label>
              <input
                ref={inputRef}
                id="newSpeaker"
                type="text"
                value={newSpeakerName}
                onChange={(e) => setNewSpeakerName(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="e.g., SPEAKER_09, Guest, Coach"
              />
            </div>
          )}

          <div className="quick-actions">
            <span className="quick-label">Quick assign:</span>
            {suggestion.prev_speaker && (
              <button
                type="button"
                className="quick-btn"
                onClick={() => onConfirm(suggestion.prev_speaker)}
              >
                ← {suggestion.prev_speaker}
              </button>
            )}
            {suggestion.next_speaker && suggestion.next_speaker !== suggestion.prev_speaker && (
              <button
                type="button"
                className="quick-btn"
                onClick={() => onConfirm(suggestion.next_speaker)}
              >
                {suggestion.next_speaker} →
              </button>
            )}
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
              disabled={mode === 'new' ? !newSpeakerName.trim() : !selectedSpeaker}
            >
              Assign Speaker (Enter)
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default SpeakerMergeDialog

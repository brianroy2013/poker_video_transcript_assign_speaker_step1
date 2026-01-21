function UnknownSpeakerPanel({ suggestion, onMergeBefore, onMergeAfter, onKeepSeparate, onAssignSpeaker }) {
  if (!suggestion) {
    return (
      <div className="speaker-panel empty">
        <p>No unknown speaker segment selected</p>
      </div>
    )
  }

  const statusClass = suggestion.status !== 'pending' ? `status-${suggestion.decision || suggestion.status}` : ''
  const isDecided = suggestion.status !== 'pending'

  return (
    <div className={`speaker-panel ${statusClass}`}>
      <div className="speaker-header">
        <span className="speaker-id">Segment {suggestion.sentence_id}</span>
        <span className={`confidence-badge confidence-${Math.round(suggestion.confidence * 10)}`}>
          {Math.round(suggestion.confidence * 100)}% confidence
        </span>
        {isDecided && (
          <span className={`speaker-status status-badge-${suggestion.decision}`}>
            {suggestion.decision?.replace('_', ' ')}
          </span>
        )}
      </div>

      <div className="speaker-content">
        <div className="speaker-field">
          <label>Text:</label>
          <div className="speaker-text">"{suggestion.text}"</div>
        </div>

        <div className="speaker-context">
          <div className="context-item">
            <span className="context-label">Time:</span>
            <span>{suggestion.start?.toFixed(1)}s - {suggestion.end?.toFixed(1)}s</span>
          </div>
          <div className="context-item">
            <span className="context-label">Current:</span>
            <span className="speaker-tag unknown">{suggestion.current_speaker}</span>
          </div>
        </div>

        <div className="speaker-neighbors">
          {suggestion.prev_speaker && (
            <div className="neighbor-info">
              <span className="neighbor-label">← Before:</span>
              <span className="speaker-tag">{suggestion.prev_speaker}</span>
              <span className="gap-info">
                ({suggestion.gap_before != null ? `${suggestion.gap_before}s gap` : 'no gap info'})
              </span>
            </div>
          )}
          {suggestion.next_speaker && (
            <div className="neighbor-info">
              <span className="neighbor-label">After →:</span>
              <span className="speaker-tag">{suggestion.next_speaker}</span>
              <span className="gap-info">
                ({suggestion.gap_after != null ? `${suggestion.gap_after}s gap` : 'no gap info'})
              </span>
            </div>
          )}
        </div>

        <div className="suggestion-box">
          <span className="suggestion-label">AI Suggestion:</span>
          <span className={`suggestion-type type-${suggestion.suggestion_type}`}>
            {suggestion.suggestion_type.replace('_', ' ')}
          </span>
          <p className="suggestion-reason">{suggestion.reason}</p>
          {suggestion.has_transition_phrase && (
            <span className="transition-badge">Contains transition phrase</span>
          )}
        </div>

        {suggestion.assigned_speaker && (
          <div className="assigned-speaker">
            <label>Assigned to:</label>
            <span className="speaker-tag assigned">{suggestion.assigned_speaker}</span>
          </div>
        )}
      </div>

      <div className="speaker-actions">
        <button
          className="btn btn-merge-before"
          onClick={onMergeBefore}
          disabled={!suggestion.prev_speaker}
          title={suggestion.prev_speaker ? `Merge with ${suggestion.prev_speaker} (M)` : 'No previous speaker'}
        >
          ← Merge Before (M)
        </button>
        <button
          className="btn btn-merge-after"
          onClick={onMergeAfter}
          disabled={!suggestion.next_speaker}
          title={suggestion.next_speaker ? `Merge with ${suggestion.next_speaker} (N)` : 'No next speaker'}
        >
          Merge After → (N)
        </button>
        <button
          className="btn btn-keep"
          onClick={onKeepSeparate}
          title="Keep as separate/unknown speaker (K)"
        >
          Keep Separate (K)
        </button>
        <button
          className="btn btn-assign"
          onClick={onAssignSpeaker}
          title="Manually assign to a speaker (A)"
        >
          Assign Speaker (A)
        </button>
      </div>

      <div className="shortcut-hint">
        Shortcuts: M=Merge Before, N=Merge After, K=Keep, A=Assign, Space=Play/Pause
      </div>
    </div>
  )
}

export default UnknownSpeakerPanel

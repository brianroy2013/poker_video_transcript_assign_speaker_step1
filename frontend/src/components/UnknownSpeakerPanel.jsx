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
      <div className="speaker-row">
        <div className="speaker-info">
          <span className="speaker-id">Segment {suggestion.sentence_id}</span>
          <span className="speaker-time">{suggestion.start?.toFixed(1)}s</span>
          <span className={`suggestion-type type-${suggestion.suggestion_type}`}>
            {suggestion.suggestion_type.replace('_', ' ')}
          </span>
          {isDecided && (
            <span className={`speaker-status status-badge-${suggestion.decision}`}>
              {suggestion.decision?.replace('_', ' ')}
            </span>
          )}
        </div>

        <div className="speaker-context-inline">
          {suggestion.prev_speaker && (
            <span className="neighbor-inline">
              <span className="speaker-tag">{suggestion.prev_speaker}</span>
              <span className="gap-info">({suggestion.gap_before?.toFixed(1)}s)</span>
              →
            </span>
          )}
          <span className="speaker-tag unknown">{suggestion.current_speaker}</span>
          {suggestion.next_speaker && (
            <span className="neighbor-inline">
              →
              <span className="speaker-tag">{suggestion.next_speaker}</span>
              <span className="gap-info">({suggestion.gap_after?.toFixed(1)}s)</span>
            </span>
          )}
        </div>

        <div className="speaker-actions">
          <button
            className="btn btn-merge-before"
            onClick={onMergeBefore}
            disabled={!suggestion.prev_speaker}
            title={`Merge with ${suggestion.prev_speaker} (M)`}
          >
            ← {suggestion.prev_speaker || 'None'} (M)
          </button>
          <button
            className="btn btn-merge-after"
            onClick={onMergeAfter}
            disabled={!suggestion.next_speaker}
            title={`Merge with ${suggestion.next_speaker} (N)`}
          >
            {suggestion.next_speaker || 'None'} → (N)
          </button>
          <button className="btn btn-keep" onClick={onKeepSeparate} title="Keep separate (K)">
            Keep (K)
          </button>
          <button className="btn btn-assign" onClick={onAssignSpeaker} title="Assign speaker (A)">
            Assign (A)
          </button>
        </div>
      </div>

      <div className="speaker-text-row">
        <span className="speaker-text">"{suggestion.text}"</span>
        {suggestion.assigned_speaker && (
          <span className="assigned-inline">→ <span className="speaker-tag assigned">{suggestion.assigned_speaker}</span></span>
        )}
      </div>
    </div>
  )
}

export default UnknownSpeakerPanel

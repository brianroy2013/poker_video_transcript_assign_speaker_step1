function CorrectionPanel({ correction, onAccept, onReject, onIgnore }) {
  if (!correction) {
    return (
      <div className="correction-panel empty">
        <p>No correction selected</p>
      </div>
    )
  }

  const isUnclear = !correction.suggested
  const statusClass = correction.status !== 'pending' ? `status-${correction.status}` : ''

  return (
    <div className={`correction-panel ${statusClass}`}>
      <div className="correction-header">
        <span className="correction-id">Line {correction.id}</span>
        <span className={`correction-type type-${correction.correction_type}`}>
          {correction.correction_type}
        </span>
        {correction.status !== 'pending' && (
          <span className={`correction-status status-badge-${correction.status}`}>
            {correction.status}
          </span>
        )}
      </div>

      <div className="correction-content">
        <div className="correction-field">
          <label>Original:</label>
          <div className="correction-text original">"{correction.original}"</div>
        </div>

        <div className="correction-arrow">→</div>

        <div className="correction-field">
          <label>Suggested:</label>
          <div className={`correction-text suggested ${isUnclear ? 'unclear' : ''}`}>
            {isUnclear ? (
              <em>??? (Needs your input)</em>
            ) : (
              `"${correction.suggested}"`
            )}
          </div>
        </div>

        {correction.final && correction.status !== 'pending' && (
          <div className="correction-field final-field">
            <label>Final:</label>
            <div className="correction-text final">"{correction.final}"</div>
          </div>
        )}
      </div>

      <div className="correction-meta">
        <span className="meta-item">
          Sentence: {correction.sentence_id}
        </span>
        <span className="meta-item">
          Time: {correction.timestamp?.toFixed(1)}s
        </span>
        <span className="meta-item">
          Speaker: {correction.speaker}
        </span>
      </div>

      <div className="correction-actions">
        <button
          className="btn btn-accept"
          onClick={onAccept}
          disabled={isUnclear}
          title={isUnclear ? 'Cannot accept unclear correction - use Reject to provide text' : 'Accept (A)'}
        >
          Accept (A)
        </button>
        <button
          className="btn btn-reject"
          onClick={onReject}
          title="Reject and provide custom text (R)"
        >
          Reject (R)
        </button>
        <button
          className="btn btn-ignore"
          onClick={onIgnore}
          title="Ignore - exclude from training (I)"
        >
          Ignore (I)
        </button>
      </div>

      <div className="shortcut-hint">
        Shortcuts: A=Accept, R=Reject, I=Ignore, Space=Play/Pause
      </div>
    </div>
  )
}

export default CorrectionPanel

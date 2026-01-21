function Header({
  videoPath,
  currentIndex,
  total,
  reviewPhase,
  onPhaseSwitch,
  hasSpeakerSuggestions,
  onBrowse,
  onSave,
  onExport,
  saveStatus
}) {
  const videoName = videoPath ? videoPath.split(/[/\\]/).pop() : ''

  return (
    <header className="header">
      <div className="header-left">
        <button className="btn btn-secondary" onClick={onBrowse}>
          Browse
        </button>
        <span className="video-name" title={videoPath}>
          {videoName || 'No video loaded'}
        </span>
      </div>

      <div className="header-center">
        <div className="phase-tabs">
          <button
            className={`phase-tab ${reviewPhase === 'corrections' ? 'active' : ''}`}
            onClick={() => onPhaseSwitch('corrections')}
          >
            Text Corrections
          </button>
          {hasSpeakerSuggestions && (
            <button
              className={`phase-tab ${reviewPhase === 'speakers' ? 'active' : ''}`}
              onClick={() => onPhaseSwitch('speakers')}
            >
              Speaker Review
            </button>
          )}
        </div>

        <div className="progress-section">
          <span className="progress-text">
            {reviewPhase === 'corrections' ? 'Correction' : 'Speaker'}: <strong>{currentIndex + 1}</strong> / {total}
          </span>
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${total > 0 ? ((currentIndex + 1) / total) * 100 : 0}%` }}
            />
          </div>
        </div>
      </div>

      <div className="header-right">
        <button
          className="btn btn-primary"
          onClick={onSave}
          disabled={saveStatus === 'saving'}
        >
          {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved!' : 'Save'}
        </button>
        <button className="btn btn-success" onClick={onExport}>
          Export
        </button>
      </div>
    </header>
  )
}

export default Header

function NavigationBar({ currentIndex, total, stats, reviewPhase, onBack, onNext, canGoBack, canGoNext }) {
  const isComplete = reviewPhase === 'corrections'
    ? (stats.pending === 0 && currentIndex === total - 1)
    : (stats.pending === 0 && currentIndex === total - 1)

  return (
    <nav className="navigation-bar">
      <div className="nav-buttons">
        <button
          className="btn btn-nav"
          onClick={onBack}
          disabled={!canGoBack}
          title="Previous (B or Left Arrow)"
        >
          ← Back (B)
        </button>
        <button
          className="btn btn-nav"
          onClick={onNext}
          disabled={!canGoNext}
          title="Next (→ or Right Arrow)"
        >
          Next →
        </button>
      </div>

      <div className="nav-stats">
        {reviewPhase === 'corrections' ? (
          <>
            <span className="stat stat-accepted">
              Accepted: <strong>{stats.accepted}</strong>
            </span>
            <span className="stat stat-rejected">
              Rejected: <strong>{stats.rejected}</strong>
            </span>
            <span className="stat stat-ignored">
              Ignored: <strong>{stats.ignored}</strong>
            </span>
            <span className="stat stat-pending">
              Pending: <strong>{stats.pending}</strong>
            </span>
          </>
        ) : (
          <>
            <span className="stat stat-merge-before">
              Merge←: <strong>{stats.merge_before}</strong>
            </span>
            <span className="stat stat-merge-after">
              Merge→: <strong>{stats.merge_after}</strong>
            </span>
            <span className="stat stat-keep">
              Keep: <strong>{stats.keep_separate}</strong>
            </span>
            <span className="stat stat-assigned">
              Assigned: <strong>{stats.assigned || 0}</strong>
            </span>
            <span className="stat stat-pending">
              Pending: <strong>{stats.pending}</strong>
            </span>
          </>
        )}
      </div>

      {isComplete && (
        <div className="review-complete">
          {reviewPhase === 'corrections'
            ? 'Corrections Complete! Switch to Speaker Review or Export.'
            : 'Speaker Review Complete! Click Export to generate training data.'
          }
        </div>
      )}
    </nav>
  )
}

export default NavigationBar

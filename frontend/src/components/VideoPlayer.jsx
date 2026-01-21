function VideoPlayer({ videoPath, videoRef, playbackSpeed, onSpeedChange, onTimeUpdate }) {
  const videoUrl = videoPath ? `/api/video?path=${encodeURIComponent(videoPath)}` : ''

  const handleRewind = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 2)
      videoRef.current.play().catch(() => {})
    }
  }

  const handleTimeUpdate = (e) => {
    if (onTimeUpdate) {
      onTimeUpdate(e.target.currentTime)
    }
  }

  return (
    <div className="video-player">
      <video
        ref={videoRef}
        src={videoUrl}
        controls
        className="video-element"
        onTimeUpdate={handleTimeUpdate}
      />
      <div className="playback-controls">
        <button className="rewind-btn" onClick={handleRewind} title="Rewind 2 seconds (Q)">
          ↺ -2s
        </button>
        <span className="speed-label">Speed:</span>
        {[0.5, 1.0, 1.5, 2.0].map(speed => (
          <button
            key={speed}
            className={`speed-btn ${playbackSpeed === speed ? 'active' : ''}`}
            onClick={() => onSpeedChange(speed)}
          >
            {speed}x
          </button>
        ))}
        <span className="speed-hint">(Q=rewind, 1-4=speed)</span>
      </div>
    </div>
  )
}

export default VideoPlayer

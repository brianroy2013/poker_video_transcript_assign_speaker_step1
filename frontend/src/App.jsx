import { useState, useEffect, useCallback, useRef } from 'react'
import Header from './components/Header'
import VideoPlayer from './components/VideoPlayer'
import CorrectionPanel from './components/CorrectionPanel'
import UnknownSpeakerPanel from './components/UnknownSpeakerPanel'
import AssignSpeakersPanel from './components/AssignSpeakersPanel'
import TranscriptView from './components/TranscriptView'
import NavigationBar from './components/NavigationBar'
import RejectDialog from './components/RejectDialog'
import SpeakerMergeDialog from './components/SpeakerMergeDialog'
import FileBrowser from './components/FileBrowser'

const API_BASE = '/api'

function App() {
  // File state
  const [videoPath, setVideoPath] = useState(null)
  const [corrections, setCorrections] = useState([])
  const [speakerSuggestions, setSpeakerSuggestions] = useState([])
  const [knownSpeakers, setKnownSpeakers] = useState([])
  const [transcript, setTranscript] = useState(null)
  const [currentIndex, setCurrentIndex] = useState(0)

  // Speaker name assignments (SPEAKER_00 -> "John", etc.)
  const [speakerNames, setSpeakerNames] = useState({})
  const [speakerNamesComplete, setSpeakerNamesComplete] = useState(false)

  // For scrolling transcript to a specific sentence
  const [scrollToSentenceId, setScrollToSentenceId] = useState(null)

  // Three-phase review: 'assign-names', 'speakers', or 'corrections'
  const [reviewPhase, setReviewPhase] = useState('assign-names')

  // UI state
  const [showFileBrowser, setShowFileBrowser] = useState(true)
  const [showRejectDialog, setShowRejectDialog] = useState(false)
  const [showSpeakerDialog, setShowSpeakerDialog] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [saveStatus, setSaveStatus] = useState(null)
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0)
  const [videoTime, setVideoTime] = useState(0)
  const [wordChunk, setWordChunk] = useState({ sentences: [], chunk_start: 0, chunk_end: 0 })

  const videoRef = useRef(null)
  const lastTimeUpdateRef = useRef(0)
  const chunkFetchingRef = useRef(false)

  // Get current items based on phase
  const currentItems = reviewPhase === 'corrections' ? corrections :
                       reviewPhase === 'speakers' ? speakerSuggestions : []
  const currentItem = currentItems[currentIndex] || null

  // Calculate statistics for corrections
  const correctionStats = {
    total: corrections.length,
    accepted: corrections.filter(c => c.status === 'accepted').length,
    rejected: corrections.filter(c => c.status === 'rejected').length,
    ignored: corrections.filter(c => c.status === 'ignored').length,
    pending: corrections.filter(c => c.status === 'pending').length
  }

  // Calculate statistics for speaker decisions
  const speakerStats = {
    total: speakerSuggestions.length,
    merge_before: speakerSuggestions.filter(s => s.decision === 'merge_before').length,
    merge_after: speakerSuggestions.filter(s => s.decision === 'merge_after').length,
    keep_separate: speakerSuggestions.filter(s => s.decision === 'keep_separate').length,
    assigned: speakerSuggestions.filter(s => s.decision === 'assign').length,
    pending: speakerSuggestions.filter(s => s.status === 'pending').length
  }

  // Load video data
  const loadVideo = async (path) => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`${API_BASE}/load?video=${encodeURIComponent(path)}`)
      const data = await response.json()

      if (data.error) {
        throw new Error(data.error)
      }

      setVideoPath(path)
      setTranscript(data.transcript)
      setKnownSpeakers(data.known_speakers || [])

      // Load corrections
      setCorrections(data.corrections)

      // Load speaker suggestions
      setSpeakerSuggestions(data.unknown_speaker_suggestions || [])

      // Load speaker name assignments
      const loadedNames = data.speaker_names || {}
      setSpeakerNames(loadedNames)

      // Determine if speaker names are complete
      const allSpeakersNamed = data.known_speakers?.length > 0 &&
        data.known_speakers.every(s => loadedNames[s] && loadedNames[s].trim() !== '')
      setSpeakerNamesComplete(allSpeakersNamed)

      // Determine starting phase based on completion
      const speakerReviewPending = (data.unknown_speaker_suggestions || []).some(s => s.status === 'pending')
      const correctionsPending = data.corrections.some(c => c.status === 'pending')

      let startPhase = 'assign-names'
      let startIndex = 0

      if (allSpeakersNamed) {
        if (speakerReviewPending && (data.unknown_speaker_suggestions || []).length > 0) {
          startPhase = 'speakers'
          startIndex = (data.unknown_speaker_suggestions || []).findIndex(s => s.status === 'pending')
          if (startIndex < 0) startIndex = 0
        } else {
          startPhase = 'corrections'
          startIndex = data.corrections.findIndex(c => c.status === 'pending')
          if (startIndex < 0) startIndex = 0
        }
      }

      setReviewPhase(startPhase)
      setCurrentIndex(startIndex)
      setShowFileBrowser(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Save progress
  const saveProgress = async () => {
    if (!videoPath) return

    setSaveStatus('saving')

    try {
      const response = await fetch(`${API_BASE}/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          video_path: videoPath,
          corrections: corrections,
          speaker_decisions: speakerSuggestions,
          speaker_names: speakerNames
        })
      })

      const data = await response.json()

      if (data.error) {
        throw new Error(data.error)
      }

      setSaveStatus('saved')
      setTimeout(() => setSaveStatus(null), 2000)
    } catch (err) {
      setSaveStatus('error')
      setError(err.message)
    }
  }


  // Update correction status
  const updateCorrection = useCallback((index, updates) => {
    setCorrections(prev => {
      const newCorrections = [...prev]
      newCorrections[index] = { ...newCorrections[index], ...updates }
      return newCorrections
    })
  }, [])

  // Update speaker suggestion
  const updateSpeakerSuggestion = useCallback((index, updates) => {
    setSpeakerSuggestions(prev => {
      const newSuggestions = [...prev]
      newSuggestions[index] = { ...newSuggestions[index], ...updates }
      return newSuggestions
    })
  }, [])

  // Correction action handlers
  const handleAccept = useCallback(() => {
    if (reviewPhase !== 'corrections' || !currentItem) return

    if (!currentItem.suggested) {
      setShowRejectDialog(true)
      return
    }

    updateCorrection(currentIndex, {
      status: 'accepted',
      final: currentItem.suggested
    })

    if (currentIndex < corrections.length - 1) {
      setCurrentIndex(currentIndex + 1)
    }
  }, [reviewPhase, currentItem, currentIndex, corrections.length, updateCorrection])

  const handleReject = useCallback(() => {
    if (reviewPhase !== 'corrections') return
    setShowRejectDialog(true)
  }, [reviewPhase])

  const handleIgnore = useCallback(() => {
    if (reviewPhase !== 'corrections' || !currentItem) return

    updateCorrection(currentIndex, {
      status: 'ignored',
      final: null
    })

    if (currentIndex < corrections.length - 1) {
      setCurrentIndex(currentIndex + 1)
    }
  }, [reviewPhase, currentItem, currentIndex, corrections.length, updateCorrection])

  const handleRejectConfirm = useCallback((customText) => {
    updateCorrection(currentIndex, {
      status: 'rejected',
      final: customText
    })
    setShowRejectDialog(false)

    if (currentIndex < corrections.length - 1) {
      setCurrentIndex(currentIndex + 1)
    }
  }, [currentIndex, corrections.length, updateCorrection])

  // Speaker action handlers
  const handleMergeBefore = useCallback(() => {
    if (reviewPhase !== 'speakers' || !currentItem || !currentItem.prev_speaker) return

    updateSpeakerSuggestion(currentIndex, {
      status: 'decided',
      decision: 'merge_before',
      assigned_speaker: currentItem.prev_speaker
    })

    if (currentIndex < speakerSuggestions.length - 1) {
      setCurrentIndex(currentIndex + 1)
    }
  }, [reviewPhase, currentItem, currentIndex, speakerSuggestions.length, updateSpeakerSuggestion])

  const handleMergeAfter = useCallback(() => {
    if (reviewPhase !== 'speakers' || !currentItem || !currentItem.next_speaker) return

    updateSpeakerSuggestion(currentIndex, {
      status: 'decided',
      decision: 'merge_after',
      assigned_speaker: currentItem.next_speaker
    })

    if (currentIndex < speakerSuggestions.length - 1) {
      setCurrentIndex(currentIndex + 1)
    }
  }, [reviewPhase, currentItem, currentIndex, speakerSuggestions.length, updateSpeakerSuggestion])

  const handleKeepSeparate = useCallback(() => {
    if (reviewPhase !== 'speakers' || !currentItem) return

    updateSpeakerSuggestion(currentIndex, {
      status: 'decided',
      decision: 'keep_separate',
      assigned_speaker: currentItem.current_speaker
    })

    if (currentIndex < speakerSuggestions.length - 1) {
      setCurrentIndex(currentIndex + 1)
    }
  }, [reviewPhase, currentItem, currentIndex, speakerSuggestions.length, updateSpeakerSuggestion])

  const handleAssignSpeaker = useCallback(() => {
    if (reviewPhase !== 'speakers') return
    setShowSpeakerDialog(true)
  }, [reviewPhase])

  const handleSpeakerAssignConfirm = useCallback((speaker) => {
    updateSpeakerSuggestion(currentIndex, {
      status: 'decided',
      decision: 'assign',
      assigned_speaker: speaker
    })
    setShowSpeakerDialog(false)

    // Add to known speakers if new
    if (!knownSpeakers.includes(speaker)) {
      setKnownSpeakers(prev => [...prev, speaker].sort())
    }

    // Add to speaker names if new (use speaker as its own display name)
    if (!speakerNames[speaker]) {
      setSpeakerNames(prev => ({ ...prev, [speaker]: speaker }))
    }

    if (currentIndex < speakerSuggestions.length - 1) {
      setCurrentIndex(currentIndex + 1)
    }
  }, [currentIndex, speakerSuggestions.length, knownSpeakers, speakerNames, updateSpeakerSuggestion])

  // Navigation handlers
  const handleNext = useCallback(() => {
    if (currentIndex < currentItems.length - 1) {
      setCurrentIndex(currentIndex + 1)
    }
  }, [currentIndex, currentItems.length])

  const handleBack = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
    }
  }, [currentIndex])

  // Phase switch handler
  const handlePhaseSwitch = useCallback((phase) => {
    setReviewPhase(phase)
    setCurrentIndex(0)
  }, [])

  // Speaker names handlers
  const handleUpdateSpeakerNames = useCallback((names) => {
    setSpeakerNames(names)
  }, [])

  const handleSpeakerNamesComplete = useCallback(() => {
    setSpeakerNamesComplete(true)
    // Move to next phase
    if (speakerSuggestions.length > 0) {
      setReviewPhase('speakers')
    } else {
      setReviewPhase('corrections')
    }
    setCurrentIndex(0)
  }, [speakerSuggestions.length])

  // Seek video to current item timestamp (1 second before for context)
  useEffect(() => {
    const items = reviewPhase === 'corrections' ? corrections : speakerSuggestions
    const item = items[currentIndex]
    if (videoRef.current && item) {
      const timestamp = item.timestamp || item.start
      if (timestamp != null) {
        videoRef.current.currentTime = Math.max(0, timestamp - 1)
      }
    }
  }, [currentIndex, reviewPhase, corrections, speakerSuggestions])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
        if (e.key === 'Escape') {
          setShowRejectDialog(false)
          setShowSpeakerDialog(false)
        }
        return
      }

      if (showRejectDialog || showSpeakerDialog) {
        if (e.key === 'Escape') {
          setShowRejectDialog(false)
          setShowSpeakerDialog(false)
        }
        return
      }

      // Phase-specific shortcuts
      if (reviewPhase === 'corrections') {
        switch (e.key.toLowerCase()) {
          case 'a':
            handleAccept()
            break
          case 'r':
            handleReject()
            break
          case 'i':
            handleIgnore()
            break
        }
      } else if (reviewPhase === 'speakers') {
        switch (e.key.toLowerCase()) {
          case 'm':
            handleMergeBefore()
            break
          case 'n':
            if (!e.shiftKey) handleMergeAfter()
            break
          case 'k':
            handleKeepSeparate()
            break
          case 'a':
            handleAssignSpeaker()
            break
        }
      }

      // Common shortcuts
      switch (e.key.toLowerCase()) {
        case 'arrowright':
          handleNext()
          break
        case 'arrowleft':
          handleBack()
          break
        case 'b':
          handleBack()
          break
        case ' ':
          e.preventDefault()
          if (videoRef.current) {
            if (videoRef.current.paused) {
              videoRef.current.play()
            } else {
              videoRef.current.pause()
            }
          }
          break
        case 's':
          if (e.ctrlKey) {
            e.preventDefault()
            saveProgress()
          }
          break
        case 'q':
          if (videoRef.current) {
            videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 2)
            videoRef.current.play().catch(() => {})
          }
          break
        case '1':
          setPlaybackSpeed(0.5)
          break
        case '2':
          setPlaybackSpeed(1.0)
          break
        case '3':
          setPlaybackSpeed(1.5)
          break
        case '4':
          setPlaybackSpeed(2.0)
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    reviewPhase, showRejectDialog, showSpeakerDialog,
    handleAccept, handleReject, handleIgnore,
    handleMergeBefore, handleMergeAfter, handleKeepSeparate, handleAssignSpeaker,
    handleNext, handleBack, saveProgress
  ])

  // Update playback speed
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackSpeed
    }
  }, [playbackSpeed])

  // Fetch word chunk for a given time
  const fetchWordChunk = useCallback((time) => {
    if (!videoPath || chunkFetchingRef.current) return

    // Calculate chunk start (5 min = 300s chunks)
    const chunkStart = Math.floor(time / 300) * 300

    chunkFetchingRef.current = true
    fetch(`${API_BASE}/words-chunk?video=${encodeURIComponent(videoPath)}&start=${chunkStart}`)
      .then(res => res.json())
      .then(data => {
        setWordChunk(data)
        chunkFetchingRef.current = false
      })
      .catch(() => {
        chunkFetchingRef.current = false
      })
  }, [videoPath])

  // Fetch initial word chunk when video loads
  useEffect(() => {
    if (videoPath) {
      fetchWordChunk(0)
    }
  }, [videoPath, fetchWordChunk])

  // Handle video time updates for transcript highlighting
  const handleVideoTimeUpdate = useCallback((time) => {
    const now = Date.now()
    // Update time every 100ms for smooth word highlighting
    if (now - lastTimeUpdateRef.current > 100) {
      lastTimeUpdateRef.current = now
      setVideoTime(time)

      // Check if we need to fetch a new chunk
      if (time < wordChunk.chunk_start || time >= wordChunk.chunk_end) {
        fetchWordChunk(time)
      }
    }
  }, [wordChunk.chunk_start, wordChunk.chunk_end, fetchWordChunk])

  // Handle transcript word click (also used for speaker label clicks)
  const handleWordClick = useCallback((timestamp, sentenceId = null) => {
    if (videoRef.current) {
      videoRef.current.currentTime = timestamp
      videoRef.current.play().catch(() => {})
    }
    if (sentenceId != null) {
      setScrollToSentenceId(sentenceId)
    }
  }, [])

  if (showFileBrowser) {
    return (
      <FileBrowser
        onSelectVideo={loadVideo}
        loading={loading}
        error={error}
      />
    )
  }

  return (
    <div className="app">
      <Header
        videoPath={videoPath}
        currentIndex={currentIndex}
        total={currentItems.length}
        reviewPhase={reviewPhase}
        onPhaseSwitch={handlePhaseSwitch}
        hasSpeakerSuggestions={speakerSuggestions.length > 0}
        speakerNamesComplete={speakerNamesComplete}
        onBrowse={() => setShowFileBrowser(true)}
        onSave={saveProgress}
        saveStatus={saveStatus}
      />

      <div className="top-panel">
        {reviewPhase === 'assign-names' ? (
          <AssignSpeakersPanel
            speakers={knownSpeakers}
            speakerNames={speakerNames}
            transcript={transcript}
            onUpdateSpeakerNames={handleUpdateSpeakerNames}
            onMarkComplete={handleSpeakerNamesComplete}
            onSeek={handleWordClick}
          />
        ) : reviewPhase === 'speakers' ? (
          <UnknownSpeakerPanel
            suggestion={currentItem}
            onMergeBefore={handleMergeBefore}
            onMergeAfter={handleMergeAfter}
            onKeepSeparate={handleKeepSeparate}
            onAssignSpeaker={handleAssignSpeaker}
          />
        ) : (
          <CorrectionPanel
            correction={currentItem}
            onAccept={handleAccept}
            onReject={handleReject}
            onIgnore={handleIgnore}
          />
        )}
      </div>

      <div className="lower-content">
        <div className="lower-left">
          <VideoPlayer
            videoPath={videoPath}
            videoRef={videoRef}
            playbackSpeed={playbackSpeed}
            onSpeedChange={setPlaybackSpeed}
            onTimeUpdate={handleVideoTimeUpdate}
          />
        </div>

        <div className="lower-right">
          <TranscriptView
            transcript={transcript}
            corrections={corrections}
            speakerNames={speakerNames}
            speakerSuggestions={speakerSuggestions}
            currentCorrection={reviewPhase === 'corrections' ? currentItem : null}
            currentSpeakerSuggestion={reviewPhase === 'speakers' ? currentItem : null}
            scrollToSentenceId={scrollToSentenceId}
            videoTime={videoTime}
            wordChunk={wordChunk}
            onWordClick={handleWordClick}
          />
        </div>
      </div>

      <NavigationBar
        currentIndex={currentIndex}
        total={currentItems.length}
        stats={reviewPhase === 'corrections' ? correctionStats : speakerStats}
        reviewPhase={reviewPhase}
        onBack={handleBack}
        onNext={handleNext}
        canGoBack={currentIndex > 0}
        canGoNext={currentIndex < currentItems.length - 1}
      />

      {showRejectDialog && (
        <RejectDialog
          correction={currentItem}
          onConfirm={handleRejectConfirm}
          onCancel={() => setShowRejectDialog(false)}
        />
      )}

      {showSpeakerDialog && (
        <SpeakerMergeDialog
          suggestion={currentItem}
          knownSpeakers={knownSpeakers}
          onConfirm={handleSpeakerAssignConfirm}
          onCancel={() => setShowSpeakerDialog(false)}
        />
      )}

      {error && (
        <div className="error-toast">
          {error}
          <button onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}
    </div>
  )
}

export default App

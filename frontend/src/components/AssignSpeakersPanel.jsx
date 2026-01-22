import { useState, useEffect, useRef } from 'react'

function AssignSpeakersPanel({ speakers, speakerNames, transcript, onUpdateSpeakerNames, onMarkComplete, onSeek }) {
  const [names, setNames] = useState({})
  const lastPlayedIndex = useRef({})

  // Initialize from props
  useEffect(() => {
    setNames(speakerNames || {})
  }, [speakerNames])

  const handleNameChange = (speakerId, name) => {
    const updated = { ...names, [speakerId]: name }
    setNames(updated)
    onUpdateSpeakerNames(updated)
  }

  const handleSpeakerClick = (speakerId) => {
    if (!transcript?.sentences) return

    // Find all sentences for this speaker
    const speakerSentences = transcript.sentences.filter(s => s.speaker === speakerId)
    if (speakerSentences.length === 0) return

    // Get the next index to play (cycles through)
    const lastIdx = lastPlayedIndex.current[speakerId] ?? -1
    const nextIdx = (lastIdx + 1) % speakerSentences.length
    lastPlayedIndex.current[speakerId] = nextIdx

    const sentence = speakerSentences[nextIdx]
    if (sentence.start != null) {
      onSeek(sentence.start, sentence.id)
    }
  }

  const allAssigned = speakers.every(s => names[s] && names[s].trim() !== '')

  if (!speakers || speakers.length === 0) {
    return (
      <div className="assign-panel empty">
        <p>No speakers found in transcript</p>
      </div>
    )
  }

  return (
    <div className="assign-panel">
      <div className="assign-row">
        <div className="assign-instructions">
          Click speaker ID to hear them, then enter name:
        </div>
        <div className="assign-inputs">
          {speakers.map(speakerId => (
            <div key={speakerId} className="speaker-input-group">
              <label
                onClick={() => handleSpeakerClick(speakerId)}
                className="speaker-label-clickable"
                title="Click to hear this speaker"
              >
                {speakerId}:
              </label>
              <input
                type="text"
                value={names[speakerId] || ''}
                onChange={(e) => handleNameChange(speakerId, e.target.value)}
                placeholder="Enter name..."
              />
            </div>
          ))}
        </div>
        <button
          className="btn btn-success"
          onClick={onMarkComplete}
          disabled={!allAssigned}
          title={allAssigned ? 'Mark as complete and continue' : 'Assign all speaker names first'}
        >
          {allAssigned ? 'Done - Continue →' : 'Assign all names'}
        </button>
      </div>
    </div>
  )
}

export default AssignSpeakersPanel

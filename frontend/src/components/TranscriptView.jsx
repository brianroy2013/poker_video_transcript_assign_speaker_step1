import { useEffect, useRef, memo, useMemo } from 'react'

// Memoized sentence component to prevent unnecessary re-renders
const SentenceBlock = memo(function SentenceBlock({
  sentence,
  isCurrentSpeaker,
  isUnknown,
  isHighlighted,
  isPlaying,
  currentWordIndex,
  errorText,
  onSeek
}) {
  // Split text into words and highlight the current one + error text
  const renderText = () => {
    const text = sentence.text

    // Find error text position if applicable
    let errorStart = -1
    let errorEnd = -1
    if (errorText && isHighlighted) {
      const lowerText = text.toLowerCase()
      const lowerError = errorText.toLowerCase()
      errorStart = lowerText.indexOf(lowerError)
      if (errorStart !== -1) {
        errorEnd = errorStart + errorText.length
      }
    }

    // If not playing, just show error highlight (if any) or plain text
    if (currentWordIndex == null || currentWordIndex < 0 || !isPlaying) {
      if (errorStart !== -1) {
        const before = text.slice(0, errorStart)
        const error = text.slice(errorStart, errorEnd)
        const after = text.slice(errorEnd)
        return (
          <>
            <span>{before}</span>
            <span className="error-text">{error}</span>
            <span>{after}</span>
          </>
        )
      }
      return <span>{text}</span>
    }

    // Split on whitespace while preserving punctuation for word-by-word highlighting
    const words = text.split(/(\s+)/)
    let wordIdx = 0
    let charPos = 0

    return words.map((part, idx) => {
      const partStart = charPos
      const partEnd = charPos + part.length
      charPos = partEnd

      // Skip whitespace tokens
      if (/^\s+$/.test(part)) {
        return <span key={idx}>{part}</span>
      }

      const isCurrentWord = wordIdx === currentWordIndex
      wordIdx++

      // Check if this word overlaps with the error text
      const isError = errorStart !== -1 && partStart < errorEnd && partEnd > errorStart

      let className = 'word'
      if (isCurrentWord) className += ' word-playing'
      if (isError) className += ' error-text'

      return (
        <span key={idx} className={className}>
          {part}
        </span>
      )
    })
  }

  return (
    <div
      className={`sentence-block ${isCurrentSpeaker ? 'highlighted-sentence' : ''} ${isUnknown ? 'unknown-speaker' : ''} ${isPlaying ? 'playing' : ''}`}
    >
      <span
        className={`sentence-meta ${isUnknown ? 'unknown' : ''}`}
        onClick={() => onSeek(sentence.start)}
        style={{ cursor: 'pointer' }}
      >
        [{sentence.speaker}] {sentence.start?.toFixed(1)}s
        {isUnknown && <span className="unknown-badge">UNKNOWN</span>}
      </span>
      <p className={`sentence-text ${isHighlighted ? 'highlighted' : ''}`}>
        {renderText()}
      </p>
    </div>
  )
})

function TranscriptView({ transcript, currentCorrection, currentSpeakerSuggestion, videoTime, wordChunk, onWordClick }) {
  const containerRef = useRef(null)
  const scrollTargetRef = useRef(null)
  const lastScrollKeyRef = useRef('')

  // Build a map of sentence_id -> word data from the chunk for quick lookup
  const wordChunkMap = useMemo(() => {
    const map = {}
    if (wordChunk?.sentences) {
      for (const s of wordChunk.sentences) {
        map[s.id] = s
      }
    }
    return map
  }, [wordChunk])

  // Find current sentence and word based on videoTime
  const { playingSentenceId, currentWordIndex } = useMemo(() => {
    if (videoTime == null || !wordChunk?.sentences || wordChunk.sentences.length === 0) {
      return { playingSentenceId: null, currentWordIndex: -1 }
    }

    // Find sentence in chunk that contains current time
    for (const sentence of wordChunk.sentences) {
      if (sentence.start != null && sentence.end != null) {
        if (videoTime >= sentence.start && videoTime <= sentence.end) {
          // Found the sentence, now find the word
          let wordIndex = -1
          if (sentence.words && sentence.words.length > 0) {
            for (let i = 0; i < sentence.words.length; i++) {
              const word = sentence.words[i]
              if (word.start != null && word.end != null) {
                // Highlight word if we're within it OR if we've passed it but not reached the next
                if (videoTime >= word.start && videoTime <= word.end) {
                  wordIndex = i
                  break
                }
                // If we've passed this word's end but haven't reached next word, still highlight this one
                if (videoTime > word.end) {
                  const nextWord = sentence.words[i + 1]
                  if (!nextWord || videoTime < nextWord.start) {
                    wordIndex = i
                  }
                }
              }
            }
          }
          return { playingSentenceId: sentence.id, currentWordIndex: wordIndex }
        }
      }
    }

    return { playingSentenceId: null, currentWordIndex: -1 }
  }, [videoTime, wordChunk])

  // Get the target sentence ID for scrolling
  const scrollTargetId = currentCorrection?.sentence_id ?? currentSpeakerSuggestion?.sentence_id
  const scrollKey = `${currentCorrection?.id ?? 'none'}-${scrollTargetId ?? 'none'}`

  // Auto-scroll when correction/speaker changes
  useEffect(() => {
    if (scrollKey !== lastScrollKeyRef.current && scrollTargetId != null) {
      lastScrollKeyRef.current = scrollKey
      // Use requestAnimationFrame to ensure DOM is ready
      requestAnimationFrame(() => {
        setTimeout(() => {
          if (scrollTargetRef.current) {
            scrollTargetRef.current.scrollIntoView({
              behavior: 'smooth',
              block: 'center'
            })
          }
        }, 50)
      })
    }
  }, [scrollKey, scrollTargetId])

  if (!transcript || !transcript.sentences) {
    return (
      <div className="transcript-view empty">
        <p>No transcript loaded</p>
      </div>
    )
  }

  return (
    <div className="transcript-view" ref={containerRef}>
      <h3>Full Transcript (click timestamp to seek)</h3>
      <div className="transcript-content">
        {transcript.sentences.map((sentence, idx) => {
          const isCurrentSpeaker = sentence.id === currentSpeakerSuggestion?.sentence_id
          const isUnknown = sentence.was_unknown ||
            (sentence.speaker && sentence.speaker.toUpperCase().includes('UNKNOWN'))
          const isHighlighted = sentence.id === currentCorrection?.sentence_id
          const isPlaying = sentence.id === playingSentenceId
          const wordIdx = isPlaying ? currentWordIndex : -1

          // Get the error text (original) from the current correction if this is the highlighted sentence
          const errorText = isHighlighted ? currentCorrection?.original : null

          // Set ref on the sentence that matches the current correction/speaker
          const isScrollTarget = sentence.id === scrollTargetId

          return (
            <div key={sentence.id ?? idx} ref={isScrollTarget ? scrollTargetRef : null}>
              <SentenceBlock
                sentence={sentence}
                isCurrentSpeaker={isCurrentSpeaker}
                isUnknown={isUnknown}
                isHighlighted={isHighlighted}
                isPlaying={isPlaying}
                currentWordIndex={wordIdx}
                errorText={errorText}
                onSeek={onWordClick}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default TranscriptView

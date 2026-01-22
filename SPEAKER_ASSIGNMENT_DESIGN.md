# Speaker Assignment & Unknown Speaker Review - Design Document

## Overview

This web application provides a three-phase workflow for reviewing and correcting video transcripts with speaker diarization. The tool allows users to:

1. Assign human-readable names to speaker IDs (e.g., SPEAKER_00 → "Tommy")
2. Review and resolve UNKNOWN speaker segments
3. Review AI-suggested text corrections

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (React)                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │   Header    │  │  Navigation │  │     Main Content        │ │
│  │  (speakers) │  │    Bar      │  │  ┌─────────┬─────────┐  │ │
│  └─────────────┘  └─────────────┘  │  │ Video   │ Panel   │  │ │
│                                     │  │ Player  │ (task)  │  │ │
│                                     │  ├─────────┴─────────┤  │ │
│                                     │  │   Transcript View │  │ │
│                                     │  └───────────────────┘  │ │
│                                     └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ REST API
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Backend (Flask)                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ /api/load    │  │ /api/save    │  │ /api/words           │  │
│  │ Load video & │  │ Save reviews │  │ Word-level timing    │  │
│  │ transcript   │  │ & decisions  │  │ for playback         │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        File System                              │
│  video.mp4  │  transcription_v7/video_v7.json  │  selected_ai_edits/  │
└─────────────────────────────────────────────────────────────────┘
```

## Three-Phase Review Workflow

### Phase 1: Assign Speaker Names

**Purpose:** Map speaker IDs to human-readable names before reviewing content.

**Component:** `AssignSpeakersPanel.jsx`

**Features:**
- Lists all unique speakers found in transcript (SPEAKER_00, SPEAKER_01, etc.)
- Click speaker ID to hear audio samples of that speaker
- Input field for each speaker to enter name
- "Done" button enabled only when all speakers have names
- Speaker names displayed in header throughout session

**UI Layout:**
```
┌─────────────────────────────────────────────────────────────────┐
│  Click speaker ID to hear them, then enter name:                │
│                                                                 │
│  [SPEAKER_00]: [Tommy_______]  [SPEAKER_01]: [Marc________]    │
│  [SPEAKER_02]: [Villain 1___]  [SPEAKER_03]: [____________]    │
│                                                                 │
│                                    [Done - Continue →]          │
└─────────────────────────────────────────────────────────────────┘
```

### Phase 2: Unknown Speaker Review

**Purpose:** Resolve segments where the diarization system couldn't identify the speaker.

**Component:** `UnknownSpeakerPanel.jsx`

**Detection Logic (`detect_unknown_speakers()` in app.py):**
- Scans transcript for sentences where `speaker` contains "UNKNOWN"
- Analyzes context: previous speaker, next speaker, time gaps
- Generates suggestions based on:
  - **Transition phrases** (e.g., "So...", "Well...") - likely same as surrounding speaker
  - **Small gaps** (< 2 seconds) - likely continuation of previous speaker
  - **Sandwiched segments** - between same speaker on both sides
  - **Short segments** (< 1.5 seconds) - possibly interjections

**Suggestion Types:**
| Type | Confidence | Reason |
|------|------------|--------|
| `likely_merge` | High | Transition phrase or sandwiched between same speaker |
| `possible_merge` | Medium | Small time gap to neighbor |
| `ambiguous` | Low | Between different speakers |
| `distinct` | Low | Large gaps, may be separate speaker |

**Decision Options:**
- **Merge Before (M):** Assign to previous speaker
- **Merge After (N):** Assign to next speaker
- **Keep Separate (K):** Mark as distinct speaker
- **Assign (A):** Open dialog to pick existing or create new speaker

**UI Layout:**
```
┌─────────────────────────────────────────────────────────────────┐
│ Segment 42  │ 125.3s │ likely_merge                            │
│                                                                 │
│ [SPEAKER_00] (0.5s) → [UNKNOWN_01] → (1.2s) [SPEAKER_00]       │
│                                                                 │
│ [← SPEAKER_00 (M)] [SPEAKER_00 → (N)] [Keep (K)] [Assign (A)] │
│                                                                 │
│ "So anyway, I decided to call."  → [SPEAKER_00]                │
└─────────────────────────────────────────────────────────────────┘
```

### Phase 3: Text Corrections Review

**Purpose:** Review AI-suggested spelling, grammar, and terminology corrections.

**Component:** `CorrectionPanel.jsx`

**Decision Options:**
- **Accept (Y):** Use the AI suggestion
- **Reject (R):** Keep original or enter custom text
- **Ignore (I):** Skip this correction

## Key Components

### Header (`Header.jsx`)
- Displays video name
- Shows all speakers with their assigned names
- Color-coded speaker tags
- Save button with status indicator

### TranscriptView (`TranscriptView.jsx`)
- Full scrollable transcript
- Real-time word highlighting during playback
- Speaker labels with names (from `speakerNames` mapping)
- UNKNOWN badge for unresolved segments
- Auto-scrolls to current review item
- Click timestamp to seek video

**Speaker Display Logic:**
```javascript
// Check if sentence was reassigned via speaker decision
const effectiveSpeaker = speakerDecisions[sentence.id] || sentence.speaker
// Use assigned name if available
const displaySpeaker = speakerNames[effectiveSpeaker] || effectiveSpeaker
// Only show UNKNOWN badge if not reassigned
const isUnknown = !hasDecision && speaker.includes('UNKNOWN')
```

### VideoPlayer (`VideoPlayer.jsx`)
- HTML5 video with custom controls
- Playback speed adjustment (0.5x - 2x)
- Seeks to relevant timestamp when reviewing items

### NavigationBar (`NavigationBar.jsx`)
- Progress indicator (e.g., "5/47")
- Statistics (accepted, rejected, pending counts)
- Previous/Next buttons
- Keyboard shortcut hints

## Data Flow

### Loading a Video (`/api/load`)

```
1. User selects video from FileBrowser
2. Frontend calls /api/load?video=path/to/video.mp4
3. Backend loads:
   - transcription_v7/{video}_v7.json (transcript with speaker diarization)
   - online_ai_suggested_edits/{video}_changelog.md (AI corrections)
   - selected_ai_edits/{video}_reviewed.json (previous decisions, if any)
4. Backend returns:
   - transcript: { sentences: [...] }
   - corrections: [...] (parsed from markdown)
   - unknown_speaker_suggestions: [...] (detected UNKNOWN segments)
   - known_speakers: ["SPEAKER_00", "SPEAKER_01", ...]
   - speaker_names: { "SPEAKER_00": "Tommy", ... } (from previous save)
```

### Saving Decisions (`/api/save`)

```
1. User clicks Save (or auto-save triggers)
2. Frontend sends:
   - video_path
   - corrections: [...] (with status: accepted/rejected/ignored)
   - speaker_decisions: [...] (with decision and assigned_speaker)
   - speaker_names: { ... }
   - segment_splits: [...] (optional)
3. Backend creates two output files:
```

**Output Files:**

`selected_ai_edits/{video}_reviewed.json` (metadata only):
```json
{
  "source_video": "path/to/video.mp4",
  "reviewed_at": "2024-01-15T10:30:00",
  "speaker_names": { "SPEAKER_00": "Tommy", ... },
  "text_changes": [...],
  "speaker_decisions": [...],
  "correction_statistics": { "total": 50, "accepted": 30, ... },
  "speaker_statistics": { "total": 10, "merge_before": 5, ... }
}
```

`selected_ai_edits/{video}_speakers.json` (complete corrected transcript):
```json
{
  "source_video": "path/to/video.mp4",
  "assigned_at": "2024-01-15T10:30:00",
  "speaker_names": { "SPEAKER_00": "Tommy", ... },
  "statistics": {
    "total_sentences": 74,
    "speakers_assigned": 5,
    "unknown_resolved": 8,
    "segment_splits": 0
  },
  "sentences": [
    {
      "id": 0,
      "text": "Hello everyone",
      "start": 0.0,
      "end": 1.5,
      "speaker": "SPEAKER_00",
      "speaker_name": "Tommy",
      "was_unknown": false,
      "original_sentences": [...]  // word-level timing preserved
    },
    {
      "id": 5,
      "text": "So anyway...",
      "speaker": "SPEAKER_00",        // reassigned from UNKNOWN
      "speaker_name": "Tommy",
      "original_speaker": "UNKNOWN_01",
      "reassign_reason": "merge_before",
      "was_unknown": true
    }
  ]
}
```

## Keyboard Shortcuts

| Key | Phase | Action |
|-----|-------|--------|
| `Y` | Corrections | Accept correction |
| `R` | Corrections | Reject (opens dialog) |
| `I` | Corrections | Ignore correction |
| `M` | Speakers | Merge with previous speaker |
| `N` | Speakers | Merge with next speaker |
| `K` | Speakers | Keep as separate speaker |
| `A` | Speakers | Assign speaker (opens dialog) |
| `→` | All | Next item |
| `←` | All | Previous item |
| `B` | All | Back (same as ←) |
| `Space` | All | Play/pause video |

## Styling

The application uses a dark theme optimized for video review:

- Background: Dark gray (#1a1a2e)
- Cards/Panels: Slightly lighter (#252540)
- Accent colors for speaker tags (consistent per speaker)
- Highlight colors for current item and playback position
- UNKNOWN segments styled with warning orange border

## File Structure

```
step_2p5_online_doc_clean/
├── backend/
│   └── app.py                 # Flask API server
├── frontend/
│   └── src/
│       ├── App.jsx            # Main app, state management
│       ├── App.css            # Global styles
│       └── components/
│           ├── Header.jsx              # Top bar with speakers
│           ├── VideoPlayer.jsx         # Video playback
│           ├── TranscriptView.jsx      # Scrollable transcript
│           ├── AssignSpeakersPanel.jsx # Phase 1: name assignment
│           ├── UnknownSpeakerPanel.jsx # Phase 2: UNKNOWN review
│           ├── CorrectionPanel.jsx     # Phase 3: text corrections
│           ├── NavigationBar.jsx       # Progress & navigation
│           ├── SpeakerMergeDialog.jsx  # Speaker selection dialog
│           ├── RejectDialog.jsx        # Custom text dialog
│           └── FileBrowser.jsx         # Video selection
└── SPEAKER_ASSIGNMENT_DESIGN.md        # This file
```

## Implementation Details

### Frontend State Management (App.jsx)

```javascript
// Core state variables
const [videoPath, setVideoPath] = useState(null)
const [corrections, setCorrections] = useState([])           // AI text corrections
const [speakerSuggestions, setSpeakerSuggestions] = useState([]) // UNKNOWN segments
const [knownSpeakers, setKnownSpeakers] = useState([])       // ["SPEAKER_00", ...]
const [transcript, setTranscript] = useState(null)           // Full transcript data
const [currentIndex, setCurrentIndex] = useState(0)          // Current review item

// Speaker assignment state
const [speakerNames, setSpeakerNames] = useState({})         // ID -> name mapping
const [speakerNamesComplete, setSpeakerNamesComplete] = useState(false)

// Three-phase workflow: 'assign-names' | 'speakers' | 'corrections'
const [reviewPhase, setReviewPhase] = useState('assign-names')

// UI state
const [showFileBrowser, setShowFileBrowser] = useState(true)
const [videoTime, setVideoTime] = useState(0)
const [playbackSpeed, setPlaybackSpeed] = useState(1.0)
```

### API Contracts

#### GET /api/load?video={path}

**Response:**
```json
{
  "transcript": {
    "sentences": [
      {
        "id": 0,
        "text": "Hello everyone",
        "start": 2.41,
        "end": 5.23,
        "speaker": "SPEAKER_00",
        "speaker_confidence": 0.95,
        "was_unknown": false,
        "original_sentences": [
          {
            "text": "Hello",
            "start": 2.41,
            "end": 2.89,
            "words": [
              { "word": "Hello", "start": 2.41, "end": 2.89, "score": 0.98 }
            ]
          }
        ]
      }
    ]
  },
  "corrections": [
    {
      "id": 0,
      "sentence_id": 5,
      "original": "freezer frame",
      "corrected": "freeze frame",
      "status": "pending",
      "final": null
    }
  ],
  "unknown_speaker_suggestions": [
    {
      "id": 0,
      "sentence_id": 42,
      "text": "So anyway, I decided to call.",
      "start": 125.3,
      "end": 127.8,
      "current_speaker": "UNKNOWN_01",
      "prev_speaker": "SPEAKER_00",
      "next_speaker": "SPEAKER_00",
      "gap_before": 0.5,
      "gap_after": 1.2,
      "suggestion_type": "likely_merge",
      "confidence": "high",
      "reason": "Sandwiched between SPEAKER_00 segments",
      "status": "pending",
      "decision": null,
      "assigned_speaker": null
    }
  ],
  "known_speakers": ["SPEAKER_00", "SPEAKER_01", "SPEAKER_02"],
  "speaker_names": {}
}
```

#### POST /api/save

**Request:**
```json
{
  "video_path": "W:/videos/example.mp4",
  "corrections": [
    {
      "id": 0,
      "sentence_id": 5,
      "original": "freezer frame",
      "corrected": "freeze frame",
      "status": "accepted",
      "final": "freeze frame"
    }
  ],
  "speaker_decisions": [
    {
      "id": 0,
      "sentence_id": 42,
      "decision": "merge_before",
      "assigned_speaker": "SPEAKER_00",
      "status": "decided"
    }
  ],
  "speaker_names": {
    "SPEAKER_00": "Tommy",
    "SPEAKER_01": "Marc"
  },
  "segment_splits": []
}
```

**Response:**
```json
{
  "success": true,
  "json_path": "W:/videos/selected_ai_edits/example_reviewed.json",
  "speakers_json_path": "W:/videos/selected_ai_edits/example_speakers.json",
  "correction_statistics": {
    "total": 50,
    "accepted": 30,
    "rejected": 10,
    "ignored": 5,
    "pending": 5
  }
}
```

#### GET /api/words?video={path}&start={time}&end={time}

Returns word-level timing data for a time range (for playback highlighting).

**Response:**
```json
{
  "sentences": [
    {
      "id": 15,
      "start": 45.2,
      "end": 48.5,
      "words": [
        { "word": "So", "start": 45.2, "end": 45.4 },
        { "word": "anyway", "start": 45.5, "end": 45.9 }
      ]
    }
  ],
  "chunk_start": 45.0,
  "chunk_end": 50.0
}
```

### Backend: UNKNOWN Speaker Detection Algorithm

```python
def detect_unknown_speakers(transcript):
    """
    Analyzes transcript for UNKNOWN speaker segments and generates
    merge suggestions based on context.
    """
    suggestions = []
    sentences = transcript.get('sentences', [])

    for i, sentence in enumerate(sentences):
        speaker = sentence.get('speaker', '')

        # Only process if speaker contains UNKNOWN
        if 'UNKNOWN' not in speaker.upper():
            continue

        # Get neighboring sentences
        prev_sentence = sentences[i - 1] if i > 0 else None
        next_sentence = sentences[i + 1] if i < len(sentences) - 1 else None

        prev_speaker = prev_sentence.get('speaker') if prev_sentence else None
        next_speaker = next_sentence.get('speaker') if next_sentence else None

        # Calculate time gaps
        gap_before = sentence['start'] - prev_sentence['end'] if prev_sentence else float('inf')
        gap_after = next_sentence['start'] - sentence['end'] if next_sentence else float('inf')

        # Determine suggestion type based on context
        text = sentence.get('text', '').lower()
        has_transition = any(phrase in text for phrase in TRANSITION_PHRASES)
        duration = sentence['end'] - sentence['start']

        if has_transition and prev_speaker == next_speaker:
            suggestion_type = 'likely_merge'
            confidence = 'high'
        elif gap_before < 2.0 and prev_speaker == next_speaker:
            suggestion_type = 'likely_merge'
            confidence = 'high'
        elif gap_before < 2.0:
            suggestion_type = 'possible_merge'
            confidence = 'medium'
        elif duration < 1.5:
            suggestion_type = 'short_segment'
            confidence = 'medium'
        else:
            suggestion_type = 'distinct'
            confidence = 'low'

        suggestions.append({
            'sentence_id': sentence['id'],
            'suggestion_type': suggestion_type,
            'confidence': confidence,
            'prev_speaker': prev_speaker,
            'next_speaker': next_speaker,
            # ... other fields
        })

    return suggestions
```

### Backend: Building Corrected Transcript

```python
def build_corrected_transcript(transcript, speaker_names, speaker_decisions, segment_splits=None):
    """
    Creates complete corrected transcript with all speaker assignments applied.
    """
    # Build lookup maps
    decision_map = {
        d['sentence_id']: d['assigned_speaker']
        for d in speaker_decisions
        if d.get('decision') and d.get('assigned_speaker')
    }

    corrected_sentences = []

    for sentence in transcript.get('sentences', []):
        corrected = dict(sentence)  # Copy original
        sentence_id = sentence.get('id')
        original_speaker = sentence.get('speaker', '')

        # Apply reassignment if decision exists
        if sentence_id in decision_map:
            final_speaker = decision_map[sentence_id]
            corrected['original_speaker'] = original_speaker
            corrected['speaker'] = final_speaker
            corrected['reassign_reason'] = 'speaker_decision'
        else:
            final_speaker = original_speaker

        # Add speaker name
        corrected['speaker_name'] = speaker_names.get(final_speaker, final_speaker)
        corrected['was_unknown'] = 'UNKNOWN' in original_speaker.upper()

        corrected_sentences.append(corrected)

    return corrected_sentences
```

### Frontend: TranscriptView Speaker Resolution

```javascript
// Build map of sentence_id -> assigned speaker from decisions
const speakerDecisions = useMemo(() => {
  const map = {}
  if (speakerSuggestions) {
    for (const suggestion of speakerSuggestions) {
      if (suggestion.assigned_speaker && suggestion.decision) {
        map[suggestion.sentence_id] = suggestion.assigned_speaker
      }
    }
  }
  return map
}, [speakerSuggestions])

// In render loop for each sentence:
const effectiveSpeaker = speakerDecisions[sentence.id] || sentence.speaker
const displaySpeaker = speakerNames?.[effectiveSpeaker] || effectiveSpeaker
const hasDecision = speakerDecisions[sentence.id] != null
const isUnknown = !hasDecision && sentence.speaker?.includes('UNKNOWN')
```

### CSS: Key Styles

```css
/* Dark theme base */
body {
  background: #1a1a2e;
  color: #e0e0e0;
}

/* Speaker tags with consistent colors */
.speaker-tag {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.85em;
  font-weight: 500;
}

/* Color assignment based on speaker ID */
.speaker-tag[data-speaker="SPEAKER_00"] { background: #4a9eff; }
.speaker-tag[data-speaker="SPEAKER_01"] { background: #ff6b6b; }
.speaker-tag[data-speaker="SPEAKER_02"] { background: #51cf66; }
/* ... */

/* UNKNOWN speaker styling */
.speaker-tag.unknown {
  background: #ff922b;
  border: 1px dashed #fff;
}

/* Current review item highlight */
.sentence-block.highlighted-sentence {
  background: rgba(74, 158, 255, 0.15);
  border-left: 3px solid #4a9eff;
}

/* Word-by-word playback highlighting */
.word-playing {
  background: #ffd43b;
  color: #1a1a2e;
  border-radius: 2px;
}

/* Decision status badges */
.status-badge-merge_before { background: #51cf66; }
.status-badge-merge_after { background: #4dabf7; }
.status-badge-keep_separate { background: #ff922b; }
.status-badge-assign { background: #da77f2; }
```

### Input File Requirements

**transcription_v7/{video}_v7.json:**
- Must have `sentences` array
- Each sentence needs: `id`, `text`, `start`, `end`, `speaker`
- `original_sentences` array with word-level timing preferred
- `was_unknown` flag if pre-marked

**online_ai_suggested_edits/{video}_changelog*.md:**
- Markdown format with correction lines
- Pattern: `Line {num}: "{original}" → "{corrected}" ✓/✗`
- Optional speaker names section at top

## Recreating This Application

To recreate this application from scratch:

1. **Backend (Flask):**
   - Create `/api/browse` for file discovery
   - Create `/api/load` that parses transcript JSON and corrections markdown
   - Create `/api/save` that writes both metadata and complete transcript
   - Create `/api/words` for word-level timing chunks
   - Create `/api/video` to serve video files

2. **Frontend (React + Vite):**
   - Set up three-phase state machine (assign-names → speakers → corrections)
   - Create AssignSpeakersPanel with click-to-hear and name inputs
   - Create UnknownSpeakerPanel with merge/keep/assign buttons
   - Create TranscriptView that resolves speakers from both original data AND decisions
   - Wire up keyboard shortcuts for efficient review
   - Add video player with seek-on-click functionality

3. **Key Design Decisions:**
   - Never modify original transcript files
   - Store both metadata (for quick loading) and complete transcript (for downstream use)
   - Track original speaker when reassigning for audit trail
   - Use speaker ID as key in speakerNames (not display name)

## Future Enhancements

1. **Segment Splitting:** Allow splitting a sentence and assigning parts to different speakers
2. **Bulk Operations:** Select multiple UNKNOWN segments and assign at once
3. **Audio Waveform:** Visual waveform display for better speaker identification
4. **Undo/Redo:** History of decisions with ability to revert
5. **Export Formats:** SRT subtitles, plain text, or other formats with speaker labels

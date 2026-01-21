# Transcript Correction Review Tool - Technical Specification

## Overview

A web-based tool for reviewing and approving AI-suggested corrections to poker video transcripts. The tool displays video, full transcript, and suggested changes side-by-side, allowing rapid review with keyboard shortcuts.

## Purpose

This tool is part of a pipeline to create training data for a fine-tuned transcript correction model:
1. AI suggests corrections to raw transcripts
2. **This tool** allows human review of suggestions
3. Approved corrections become training pairs for fine-tuning
4. Fine-tuned model processes 2,000+ videos automatically

## Technology Stack

- **Backend:** Flask (Python)
- **Frontend:** React + Vite
- **Storage:** Local filesystem (JSON files)

## File Structure

```
/video_folder/
  video_name.mp4
  /transcription_v7/
    video_name_v7.json              # Original transcript
    video_name_v7_corrections.json  # AI-suggested corrections (input)
    video_name_v7_reviewed.json     # Human-reviewed corrections (output)
    video_name_v7_training.jsonl    # Training pairs (export)
```

---

## Input Format: Corrections File

The AI generates a `_corrections.json` file with suggested changes:

```json
{
  "source_file": "video_name_v7.json",
  "video_file": "video_name.mp4",
  "total_corrections": 247,
  "corrections": [
    {
      "id": 1,
      "sentence_id": 0,
      "word_indices": [0],
      "timestamp": 2.41,
      "original": "Freezer frame",
      "suggested": "Freeze frame",
      "context": "Freezer frame. Yep, that's me. On stream.",
      "correction_type": "transcription_error",
      "confidence": 0.92
    },
    {
      "id": 2,
      "sentence_id": 2,
      "word_indices": [5, 6],
      "timestamp": 51.2,
      "original": "lowjack",
      "suggested": "LJ",
      "context": "First hand, EP opened to 20, lowjack, highjack and button flat.",
      "correction_type": "standardization",
      "confidence": 1.0
    },
    {
      "id": 30,
      "sentence_id": 8,
      "word_indices": [45, 46, 47, 48],
      "timestamp": 201.5,
      "original": "Some of my foes actions on us",
      "suggested": null,
      "context": "...button makes it to 160. Some of my foes actions on us. He got about $400 behind.",
      "correction_type": "unclear",
      "confidence": 0.0
    }
  ]
}
```

### Correction Types

| Type | Description |
|------|-------------|
| `transcription_error` | Mishearing (e.g., "Freezer" → "Freeze") |
| `standardization` | Format consistency (e.g., "lowjack" → "LJ") |
| `poker_terminology` | Domain-specific (e.g., "see bet" → "c-bet") |
| `unclear` | AI couldn't determine correct text (needs human input) |

### Notes on `suggested` field
- For `unclear` corrections, `suggested` is `null`
- Human must provide the correct text

---

## Output Format: Reviewed File

After human review, the tool outputs a `_reviewed.json` file:

```json
{
  "source_file": "video_name_v7.json",
  "video_file": "video_name.mp4",
  "reviewed_at": "2024-01-15T10:30:00Z",
  "total_corrections": 247,
  "accepted": 230,
  "rejected": 12,
  "ignored": 5,
  "corrections": [
    {
      "id": 1,
      "status": "accepted",
      "original": "Freezer frame",
      "final": "Freeze frame"
    },
    {
      "id": 2,
      "status": "accepted",
      "original": "lowjack",
      "final": "LJ"
    },
    {
      "id": 15,
      "status": "rejected",
      "original": "A side",
      "suggested": "ace-high",
      "final": "Ace-high"
    },
    {
      "id": 30,
      "status": "accepted",
      "original": "Some of my foes actions on us",
      "final": "So action folds to us"
    },
    {
      "id": 50,
      "status": "ignored",
      "original": "or sliver",
      "reason": "Cannot determine from audio"
    }
  ]
}
```

### Status Values

| Status | Meaning | Training Data |
|--------|---------|---------------|
| `accepted` | Use suggested correction | Include in training |
| `rejected` | Use human-provided correction | Include in training |
| `ignored` | Skip this correction | Exclude from training |

---

## User Interface

### Layout

```
+------------------------------------------------------------------+
|  [Browse] video_name.mp4    Progress: 45/247    [Save] [Export]  |
+---------------------------+--------------------------------------+
|                           |                                      |
|     Video Player          |     Correction Panel                 |
|     (16:9 aspect)         |                                      |
|                           |  Original: "Freezer frame"           |
|     [   advancement  ]     |  Suggested: "Freeze frame"           |
|                           |  Type: transcription_error           |
|                           |                                      |
|                           |  [Accept (A)]  [Reject (R)]  [Ignore (I)]  |
|                           |                                      |
+---------------------------+--------------------------------------+
|                                                                  |
|     Full Transcript (scrollable)                                 |
|                                                                  |
|     ... Yep, that's me. On stream. New city. Everything         |
|     spiraling. How did I get here? I've played poker all        |
|     over America. I've run good. I've run bad...                |
|                                                                  |
|     [Currently highlighted word/phrase in yellow]                |
|                                                                  |
+------------------------------------------------------------------+
|  [← Back (B)]  [→ Next (N)]  |  Accepted: 44  Rejected: 1  Ignored: 0  |
+------------------------------------------------------------------+
```

### Components

#### 1. Header Bar
- **Browse button** - Select video file (loads matching `_corrections.json`)
- **Progress indicator** - "45/247" showing current position
- **Save button** - Save current review state
- **Export button** - Generate training data file

#### 2. Video Player (Upper Left)
- Standard HTML5 video player
- Playback controls (play/pause, seek, speed)
- Auto-seeks to correction timestamp when navigating
- Plays 2 seconds before and after the correction timestamp for context

#### 3. Correction Panel (Right)
- **Original text** - The text as transcribed
- **Suggested text** - AI's suggested correction (or "Needs input" if null)
- **Context** - Surrounding text for reference
- **Correction type** - Badge showing type
- **Action buttons:**
  - Accept (green) - Use suggested correction
  - Reject (yellow) - Opens dialog for custom input
  - Ignore (gray) - Skip, exclude from training

#### 4. Full Transcript (Bottom)
- Complete transcript text
- Current correction highlighted in yellow
- Auto-scrolls to keep current correction visible
- Click any word to jump video to that timestamp

#### 5. Navigation Bar (Footer)
- Back button - Go to previous correction
- Next button - Go to next correction
- Statistics - Running count of accepted/rejected/ignored

---

## Workflows

### Main Review Flow

1. User clicks "Browse" and selects a video file
2. Tool loads video and corresponding `_corrections.json`
3. Tool displays first correction
4. Video auto-plays from 2 seconds before correction timestamp
5. User reviews and clicks Accept/Reject/Ignore (or uses keyboard)
6. Tool advances to next correction
7. Repeat until all corrections reviewed
8. User clicks "Export" to generate training data

### Reject Flow

1. User clicks "Reject" (or presses R)
2. Modal dialog appears with:
   - Original text (read-only)
   - Suggested text (read-only, for reference)
   - Input field for correct text (pre-filled with suggested if available)
   - Cancel / Confirm buttons
3. User types correct text and confirms
4. Tool records rejection with user's text
5. Tool advances to next correction

### Back Navigation

1. User clicks "Back" (or presses B)
2. Tool navigates to previous correction
3. Previous decision is shown (can be changed)
4. User can modify and re-submit

### Save Flow

1. User clicks "Save" (or presses Ctrl+S)
2. Tool writes current state to `_reviewed.json`
3. Review can be resumed later by loading same video

### Resume Flow

1. User selects video that has existing `_reviewed.json`
2. Tool prompts: "Resume from correction #45 or start over?"
3. If resume, tool loads previous decisions and continues
4. If start over, tool clears previous decisions

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `A` | Accept current correction |
| `R` | Reject (opens dialog) |
| `I` | Ignore current correction |
| `N` or `→` | Next correction |
| `B` or `←` | Previous correction |
| `Space` | Play/pause video |
| `Ctrl+S` | Save progress |
| `Escape` | Close dialog / Cancel |
| `Enter` | Confirm dialog |
| `1` | Playback speed 0.5x |
| `2` | Playback speed 1.0x |
| `3` | Playback speed 1.5x |
| `4` | Playback speed 2.0x |

---

## Export: Training Data

When user clicks "Export", tool generates `_training.jsonl`:

```jsonl
{"original": "Freezer frame. Yep, that's me.", "corrected": "Freeze frame. Yep, that's me."}
{"original": "First hand, EP opened to 20, lowjack, highjack and button flat.", "corrected": "First hand, EP opens to $20, LJ, HJ and BTN flat."}
{"original": "Some of my foes actions on us. He got about $400 behind.", "corrected": "So action folds to us. He got about $400 behind."}
```

### Export Rules

1. Only `accepted` and `rejected` corrections are included
2. `ignored` corrections are excluded
3. Corrections are grouped by sentence for context
4. Multiple corrections in same sentence are combined
5. Original and corrected text include surrounding context (±1 sentence)

---

## Flask API Endpoints

### File Operations

```
GET /api/browse
    Query: path (directory)
    Returns: List of videos with _corrections.json files
    Response: {
      "files": [
        {
          "video_path": "/path/to/video.mp4",
          "corrections_path": "/path/to/video_v7_corrections.json",
          "reviewed_path": "/path/to/video_v7_reviewed.json",  // null if not exists
          "correction_count": 247,
          "reviewed_count": 45  // null if not started
        }
      ]
    }

GET /api/video
    Query: path (video file path)
    Returns: Video stream

GET /api/load
    Query: video (video file path)
    Returns: {
      "corrections": [...],
      "reviewed": {...} or null,
      "transcript": {...}  // Original _v7.json for full text display
    }

POST /api/save
    Body: {
      "video_path": "/path/to/video.mp4",
      "reviewed_data": {...}
    }
    Returns: { "success": true }

POST /api/export
    Body: {
      "video_path": "/path/to/video.mp4"
    }
    Returns: { "success": true, "training_file": "/path/to/video_v7_training.jsonl" }
```

---

## React Component Structure

```
src/
  App.jsx                   # Main app container
  components/
    Header.jsx              # Browse, progress, save, export
    VideoPlayer.jsx         # Video element with controls
    CorrectionPanel.jsx     # Current correction display + buttons
    TranscriptView.jsx      # Full transcript with highlighting
    NavigationBar.jsx       # Back/next buttons, statistics
    RejectDialog.jsx        # Modal for custom correction input
    FileBrowser.jsx         # File picker dialog
    ProgressBar.jsx         # Visual progress indicator
  hooks/
    useVideoSync.js         # Video-correction synchronization
    useKeyboardShortcuts.js # Keyboard navigation
    useReviewState.js       # Track accept/reject/ignore decisions
  utils/
    api.js                  # API client
    formatting.js           # Text formatting utilities
  App.css
  index.jsx
```

---

## State Management

### Review State

```javascript
{
  currentIndex: 45,
  corrections: [
    {
      id: 1,
      status: "accepted",  // "accepted" | "rejected" | "ignored" | "pending"
      original: "Freezer frame",
      suggested: "Freeze frame",
      final: "Freeze frame",  // null until decided
      timestamp: 2.41
    },
    // ...
  ],
  statistics: {
    total: 247,
    accepted: 44,
    rejected: 1,
    ignored: 0,
    pending: 202
  }
}
```

---

## Video Playback Behavior

### On Correction Change

1. Calculate start time: `correction.timestamp - 2.0` (minimum 0)
2. Seek video to start time
3. Auto-play video
4. Video plays for ~5 seconds (user can pause/continue)

### Context Window

- **Before:** 2 seconds before correction timestamp
- **After:** 3 seconds after correction timestamp
- User can extend playback manually

---

## Error Handling

### File Operations
- If video not found: Show error, allow re-browse
- If corrections file not found: Show error "No corrections file for this video"
- If save fails: Show error, retry option, keep state in memory

### Navigation
- At first correction: "Back" button disabled
- At last correction: "Next" shows "Review Complete" dialog
- Invalid correction index: Reset to valid range

---

## Edge Cases

### Empty Suggested Text
- When `suggested` is `null` (unclear corrections)
- "Suggested" field shows "Needs input" in italic
- Accept button is disabled
- User must use Reject to provide text, or Ignore to skip

### Long Corrections
- If original/suggested text is long (>100 chars)
- Show truncated with "..." and "Show more" link
- Full text in expandable section

### Multiple Word Corrections
- Some corrections span multiple words
- Highlight all affected words in transcript
- Show full phrase in correction panel

---

## Future Enhancements (Out of Scope for v1)

- Batch operations (accept all standardization corrections)
- Undo/redo stack
- Audio waveform visualization
- Confidence threshold filtering
- Correction type filtering
- Multi-user review with conflict resolution
- Statistics dashboard across all videos

---

## Acceptance Criteria

### Must Have (MVP)

- [ ] Load video + corrections file
- [ ] Display correction with original/suggested/context
- [ ] Accept, Reject, Ignore buttons
- [ ] Reject dialog for custom input
- [ ] Video auto-seeks to correction timestamp
- [ ] Full transcript display with highlighting
- [ ] Keyboard shortcuts (A, R, I, N, B)
- [ ] Back/Next navigation
- [ ] Save progress to `_reviewed.json`
- [ ] Resume from saved state
- [ ] Export to `_training.jsonl`

### Should Have

- [ ] Progress indicator
- [ ] Statistics display
- [ ] Playback speed control
- [ ] Click transcript word to seek video
- [ ] Auto-scroll transcript

### Nice to Have

- [ ] Correction type badges
- [ ] Confidence display
- [ ] Keyboard shortcuts for playback speed
- [ ] "Review Complete" summary dialog

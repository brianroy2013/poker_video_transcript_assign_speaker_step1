# Transcript Correction Review Tool - Project Status

## Overview
A web-based tool for reviewing AI-suggested corrections to poker video transcripts. Allows human reviewers to accept, reject, or modify corrections while watching the video with synchronized transcript highlighting.

## Architecture

### Backend (Flask)
- **Location**: `backend/app.py`
- **Port**: 5000
- **Base directory for videos**: `W:\video_courses`

### Frontend (React + Vite)
- **Location**: `frontend/`
- **Port**: 5173 (or 5174 if 5173 is in use)
- **Proxy**: `/api` routes proxied to backend

## Running the Project

```bash
# Terminal 1 - Backend
cd backend
python app.py

# Terminal 2 - Frontend
cd frontend
npm run dev
```

Access at: http://localhost:5173 (or 5174)

## Features Implemented

### 1. File Browser
- Searches `W:\video_courses` for videos with `*_changelog*.md` files in `online_ai_suggested_edits` subfolder
- Limited depth search (max 3 levels) for performance
- Shows videos with existing corrections ready for review

### 2. Two-Phase Review Workflow
- **Phase 1: Corrections** - Review AI-suggested text corrections
- **Phase 2: Speakers** - Review UNKNOWN speaker merge suggestions
- Tab-based navigation between phases

### 3. Video Player
- Streams video with range request support
- Playback speed controls (0.5x, 1x, 1.5x, 2x) - Keys: 1, 2, 3, 4
- Rewind 2 seconds button (Q key)
- Space bar to play/pause
- Auto-seeks to 1 second before correction timestamp

### 4. Transcript View with Word Highlighting
- **Sentence highlighting** - Blue background for currently playing sentence
- **Word highlighting** - Yellow highlight follows currently spoken word
- **Error text highlighting** - Red highlight on the original text being corrected
- **Combined highlight** - Gradient when playing word is the error word
- Click timestamp to seek video
- Auto-scrolls to current correction

### 5. Word Timing - Chunked Loading
- Word timing data loaded in 5-minute chunks to prevent lag
- API endpoint: `/api/words-chunk?video=PATH&start=SECONDS`
- Frontend fetches new chunk when video crosses chunk boundary
- Backend caches transcript data for performance

### 6. Correction Panel
- Shows original text, suggested correction, and final decision
- Status badges (pending, accepted, rejected, ignored)
- Keyboard shortcuts: A=Accept, R=Reject, I=Ignore

### 7. Speaker Merge Panel
- Shows UNKNOWN speaker segments with context
- Merge suggestions based on time gaps and transition phrases
- Options: Merge Before (M), Merge After (N), Keep Separate (K), Assign Speaker (A)

### 8. Save/Export
- Save progress to `selected_ai_edits/{video_name}_reviewed.json`
- Export training data to JSONL format
- Ctrl+S to save

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/browse` | GET | Find videos with correction files |
| `/api/browse-folders` | GET | Browse folder structure |
| `/api/video` | GET | Stream video file (supports range requests) |
| `/api/load` | GET | Load video data, corrections, transcript |
| `/api/save` | POST | Save reviewed corrections and speaker decisions |
| `/api/export` | POST | Export training data to JSONL |
| `/api/words-chunk` | GET | Get word timing for 5-minute chunk |

## Key Files

### Backend
- `backend/app.py` - Main Flask server with all API endpoints

### Frontend
- `frontend/src/App.jsx` - Main app component, state management
- `frontend/src/App.css` - All styles
- `frontend/src/components/`
  - `TranscriptView.jsx` - Transcript with word highlighting
  - `VideoPlayer.jsx` - Video player with controls
  - `CorrectionPanel.jsx` - Correction review UI
  - `UnknownSpeakerPanel.jsx` - Speaker merge review UI
  - `Header.jsx` - App header with phase tabs
  - `NavigationBar.jsx` - Bottom nav with stats
  - `FileBrowser.jsx` - Video selection
  - `RejectDialog.jsx` - Custom rejection text input
  - `SpeakerMergeDialog.jsx` - Speaker assignment dialog

## Data Flow

1. **Corrections Markdown** (`*_changelog*.md`):
   ```
   ## Sentence 0 (SPEAKER_00) [2.4s - 30.5s]
   Line 1: "Freezer frame" → "Freeze frame" ✓/✗
   ```

2. **Transcript JSON** (`transcription_v7/*_v7.json`):
   - Sentences with word-level timing in `original_sentences[].words[]`
   - Speaker assignments and UNKNOWN flags

3. **Reviewed JSON** (`selected_ai_edits/*_reviewed.json`):
   - Correction decisions with status and final text
   - Speaker merge decisions

## Technical Decisions

### Word Highlighting Performance
- **Problem**: Loading all word timing caused lag (1.4MB+ payload)
- **Solution**: Chunked loading - 5-minute chunks fetched on demand
- **Implementation**:
  - Backend: `/api/words-chunk` returns sentences in time range
  - Frontend: Tracks current chunk, fetches new one when video crosses boundary
  - Updates throttled to 100ms intervals

### Correction Timestamp Accuracy
- **Problem**: Corrections had sentence start time, not word time
- **Solution**: Backend finds the actual word timing by matching correction's original text to words in transcript
- **Result**: Video seeks to 1 second before the specific word being corrected

### Auto-Scroll Reliability
- **Problem**: Scroll not working for some corrections
- **Solution**: Using `requestAnimationFrame` + `setTimeout` to ensure DOM is ready, tracking scroll key to prevent duplicate scrolls

## Keyboard Shortcuts

### Corrections Phase
- `A` - Accept correction
- `R` - Reject (opens dialog for custom text)
- `I` - Ignore correction
- `→` or `N` - Next correction
- `←` or `B` - Previous correction

### Speakers Phase
- `M` - Merge with previous speaker
- `N` - Merge with next speaker
- `K` - Keep separate
- `A` - Assign specific speaker

### Global
- `Space` - Play/pause video
- `Q` - Rewind 2 seconds
- `1-4` - Set playback speed
- `Ctrl+S` - Save progress

## CSS Variables (Theme)
```css
--bg-primary: #1a1a2e
--bg-secondary: #16213e
--bg-tertiary: #0f3460
--text-primary: #eaeaea
--text-secondary: #a0a0a0
--accent-green: #4ade80
--accent-yellow: #fbbf24
--accent-red: #f87171
--accent-blue: #60a5fa
--accent-purple: #a78bfa
```

## Known Issues / TODO

1. **Word timing mismatch**: If transcript text differs from correction's original text (punctuation, casing), the error highlight may not find the exact match

2. **Large video files**: First load may be slow due to video streaming setup

3. **Browser compatibility**: Tested primarily in Chrome

## Future Improvements

- [ ] Batch operations (accept/reject multiple corrections)
- [ ] Undo/redo functionality
- [ ] Search within corrections
- [ ] Filter by status (show only pending)
- [ ] Export to different formats
- [ ] Audio waveform visualization
- [ ] Multi-user support with conflict resolution

## Dependencies

### Backend
- Flask
- Flask-CORS

### Frontend
- React 18
- Vite
- (No additional UI libraries - custom CSS)

## Session Notes

Last working session focused on:
1. Implementing word-level highlighting with chunked loading
2. Adding error text (original) highlighting in red
3. Fixing scroll-to-correction reliability
4. Updating timestamp to point to specific word being corrected

All core functionality is working. The app successfully:
- Loads videos with corrections
- Plays video with synchronized word highlighting
- Shows error text in red within transcript
- Allows reviewing and saving corrections
- Handles UNKNOWN speaker merge suggestions

Transcript Correction Review Tool
==================================

A web-based tool for reviewing and approving AI-suggested corrections to poker video transcripts.
Now includes UNKNOWN speaker merge review functionality.

SETUP
-----

1. Install Python dependencies (backend):
   cd backend
   pip install -r requirements.txt

2. Install Node.js dependencies (frontend):
   cd frontend
   npm install

RUNNING THE APP
---------------

Option 1: Use the batch files (Windows)
   - Run start_backend.bat in one terminal
   - Run start_frontend.bat in another terminal
   - Open http://localhost:5173 in your browser

Option 2: Manual start
   Terminal 1 (Backend):
      cd backend
      python app.py

   Terminal 2 (Frontend):
      cd frontend
      npm run dev

   Open http://localhost:5173 in your browser

TWO-PHASE REVIEW FLOW
---------------------

Phase 1: Text Corrections
   - Review AI-suggested text corrections
   - Accept (A), Reject (R), or Ignore (I) each correction

Phase 2: Speaker Review (if UNKNOWN speakers exist)
   - Review segments with UNKNOWN speakers
   - Merge Before (M) - assign to previous speaker
   - Merge After (N) - assign to next speaker
   - Keep Separate (K) - keep as unknown/separate
   - Assign Speaker (A) - manually assign to any speaker

Switch between phases using the tabs in the header.

KEYBOARD SHORTCUTS
------------------

Text Corrections Phase:
   A         - Accept correction
   R         - Reject (opens dialog for custom text)
   I         - Ignore correction

Speaker Review Phase:
   M         - Merge with previous speaker
   N         - Merge with next speaker
   K         - Keep as separate speaker
   A         - Assign to specific speaker (opens dialog)

Common Shortcuts:
   B / ←     - Previous item
   → (arrow) - Next item
   Space     - Play/Pause video
   1-4       - Playback speed (0.5x, 1x, 1.5x, 2x)
   Ctrl+S    - Save progress
   Escape    - Close dialog

UNKNOWN SPEAKER DETECTION
-------------------------

The tool automatically detects UNKNOWN speaker segments and provides
intelligent merge suggestions based on:

- Time gaps between segments (closer = more likely same speaker)
- Known transition phrases ("It's coaching time", etc.)
- Surrounding speaker context
- Segment duration

Suggestion types:
- merge_before: Likely belongs to previous speaker
- merge_after: Likely belongs to next speaker
- keep_separate: Likely a distinct speaker
- needs_review: Unclear, requires human judgment

FILE LOCATIONS
--------------

Input files expected:
- Video: {video_folder}/{video_name}.mp4
- Transcript: {video_folder}/transcription_v7/{video_name}_v7.json
- Corrections: {video_folder}/online_ai_suggested_edits/{video_name}_changelog.md

Output files created:
- Reviewed: {video_folder}/selected_ai_edits/{video_name}_reviewed.json
- Training: {video_folder}/selected_ai_edits/{video_name}_training.jsonl

The reviewed.json now includes both:
- corrections: Text correction decisions
- speaker_decisions: UNKNOWN speaker merge decisions

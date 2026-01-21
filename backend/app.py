"""
Flask backend for Transcript Correction Review Tool
"""
import os
import re
import json
from datetime import datetime
from flask import Flask, request, jsonify, send_file, Response
from flask_cors import CORS
from pathlib import Path

app = Flask(__name__)
CORS(app)

BASE_DIR = r"W:\video_courses"

# Known transition phrases that indicate a segment should likely be merged
# These phrases typically appear at boundaries between speakers
KNOWN_TRANSITION_PHRASES = [
    "It's coaching time",
    "Coaching time",
    "Let's take a look",
    "Let's see",
    "Here we go",
    "Alright",
    "Okay so",
    "So anyway",
    "Back to the action",
    "Moving on",
]

# Maximum time gap (seconds) to consider for automatic merge suggestion
MAX_MERGE_GAP_SECONDS = 2.0


def parse_corrections_markdown(md_content):
    """Parse the markdown corrections file into structured data."""
    corrections = []
    current_sentence = None
    current_speaker = None
    current_timestamp = None

    lines = md_content.split('\n')

    # Pattern for sentence headers: ## Sentence 0 (SPEAKER_00) [2.4s - 30.5s]
    sentence_pattern = re.compile(
        r'## Sentence (\d+) \((\w+)\) \[([0-9.]+)s - ([0-9.]+)s\]'
    )

    # Pattern for correction lines - handles various formats:
    # Line 1: "Freezer frame" → "Freeze frame" ✓/✗
    # Line 14: "check, queen suited" → ??? ✓/✗
    # Line 49: "Ace-King" → "AK" (all instances) ✓/✗
    correction_pattern = re.compile(
        r'Line (\d+): "(.+?)" → (\?\?\?|"(.+?)")(?:\s*\([^)]+\))?\s*(✓/✗|✓|✗)(?:\s*→\s*"(.+?)")?'
    )

    for line in lines:
        line = line.strip()

        # Skip empty lines and non-correction content
        if not line or line.startswith('#') and not line.startswith('## Sentence'):
            if line.startswith('## Sentence'):
                sentence_match = sentence_pattern.match(line)
                if sentence_match:
                    current_sentence = int(sentence_match.group(1))
                    current_speaker = sentence_match.group(2)
                    current_timestamp = float(sentence_match.group(3))
            continue

        # Check for sentence header
        sentence_match = sentence_pattern.match(line)
        if sentence_match:
            current_sentence = int(sentence_match.group(1))
            current_speaker = sentence_match.group(2)
            current_timestamp = float(sentence_match.group(3))
            continue

        # Check for correction line
        if line.startswith('Line '):
            corr_match = correction_pattern.match(line)
            if corr_match:
                line_num = int(corr_match.group(1))
                original = corr_match.group(2)

                # Check if suggested is ??? or a quoted string
                suggested_raw = corr_match.group(3)
                if suggested_raw == '???':
                    suggested = None
                else:
                    suggested = corr_match.group(4)  # The content inside quotes

                status_marker = corr_match.group(5)
                custom_text = corr_match.group(6)

                # Determine status
                status = "pending"
                final = None

                if status_marker == "✓":
                    status = "accepted"
                    final = suggested
                elif status_marker == "✗":
                    status = "rejected"
                    if custom_text:
                        final = custom_text
                    else:
                        final = original  # Keep original
                # ✓/✗ means pending (not yet decided)

                corrections.append({
                    "id": line_num,
                    "sentence_id": current_sentence,
                    "speaker": current_speaker,
                    "timestamp": current_timestamp,
                    "original": original,
                    "suggested": suggested,
                    "status": status,
                    "final": final,
                    "correction_type": "unclear" if suggested is None else "standard"
                })

    return corrections


def detect_unknown_speakers(transcript):
    """
    Detect UNKNOWN speaker segments and generate merge suggestions.

    Returns a list of unknown speaker suggestions with merge recommendations.
    """
    sentences = transcript.get('sentences', [])
    suggestions = []

    for i, sentence in enumerate(sentences):
        speaker = sentence.get('speaker', '')

        # Check if this is an UNKNOWN speaker (was_unknown flag or speaker name pattern)
        is_unknown = sentence.get('was_unknown', False) or 'UNKNOWN' in speaker.upper()

        if not is_unknown:
            continue

        # Get context: previous and next sentences
        prev_sentence = sentences[i - 1] if i > 0 else None
        next_sentence = sentences[i + 1] if i < len(sentences) - 1 else None

        # Analyze for merge suggestion
        suggestion_type = "needs_review"
        confidence = 0.0
        reason = ""

        text = sentence.get('text', '')
        start_time = sentence.get('start', 0)
        end_time = sentence.get('end', 0)

        # Check for known transition phrases
        text_lower = text.lower()
        has_transition_phrase = any(
            phrase.lower() in text_lower
            for phrase in KNOWN_TRANSITION_PHRASES
        )

        # Analyze time gaps
        gap_before = start_time - prev_sentence.get('end', 0) if prev_sentence else float('inf')
        gap_after = next_sentence.get('start', float('inf')) - end_time if next_sentence else float('inf')

        # Get neighboring speakers
        prev_speaker = prev_sentence.get('speaker', '') if prev_sentence else None
        next_speaker = next_sentence.get('speaker', '') if next_sentence else None

        # Decision logic
        if has_transition_phrase:
            # Transition phrases often indicate the main speaker
            if prev_speaker and prev_speaker == next_speaker:
                suggestion_type = "merge_before"
                confidence = 0.9
                reason = f"Transition phrase detected, surrounding speaker is {prev_speaker}"
            elif prev_speaker:
                suggestion_type = "merge_before"
                confidence = 0.7
                reason = f"Transition phrase detected, likely continues from {prev_speaker}"
            else:
                suggestion_type = "needs_review"
                confidence = 0.5
                reason = "Transition phrase detected but context unclear"

        elif gap_before < MAX_MERGE_GAP_SECONDS and prev_speaker:
            # Very close to previous sentence - likely same speaker
            if gap_after > MAX_MERGE_GAP_SECONDS or not next_speaker:
                suggestion_type = "merge_before"
                confidence = 0.8
                reason = f"Small gap ({gap_before:.1f}s) from {prev_speaker}"
            elif prev_speaker == next_speaker:
                suggestion_type = "merge_before"
                confidence = 0.85
                reason = f"Sandwiched between {prev_speaker} segments"
            else:
                suggestion_type = "needs_review"
                confidence = 0.5
                reason = f"Between different speakers: {prev_speaker} and {next_speaker}"

        elif gap_after < MAX_MERGE_GAP_SECONDS and next_speaker:
            suggestion_type = "merge_after"
            confidence = 0.7
            reason = f"Small gap ({gap_after:.1f}s) to {next_speaker}"

        else:
            # Check segment length - very short segments are often interjections
            duration = end_time - start_time
            if duration < 2.0:
                suggestion_type = "needs_review"
                confidence = 0.3
                reason = f"Short segment ({duration:.1f}s), possibly interjection"
            else:
                suggestion_type = "keep_separate"
                confidence = 0.4
                reason = "Distinct segment, may be separate speaker"

        suggestions.append({
            "id": i,
            "sentence_id": sentence.get('id', i),
            "text": text,
            "start": start_time,
            "end": end_time,
            "current_speaker": speaker,
            "prev_speaker": prev_speaker,
            "next_speaker": next_speaker,
            "gap_before": round(gap_before, 2) if gap_before != float('inf') else None,
            "gap_after": round(gap_after, 2) if gap_after != float('inf') else None,
            "suggestion_type": suggestion_type,
            "confidence": confidence,
            "reason": reason,
            "has_transition_phrase": has_transition_phrase,
            "status": "pending",
            "decision": None,
            "assigned_speaker": None
        })

    return suggestions


def find_video_folders(base_path, max_depth=3):
    """Find folders containing videos with correction markdown files (limited depth for speed)."""
    results = []
    base = Path(base_path)

    if not base.exists():
        return results

    def search_dir(directory, depth=0):
        if depth > max_depth:
            return

        try:
            # Check for online_ai_suggested_edits in this directory
            edits_dir = directory / "online_ai_suggested_edits"
            if edits_dir.exists():
                for corrections_file in edits_dir.glob("*_changelog*.md"):
                    video_name = corrections_file.stem.split("_changelog")[0]
                    video_dir = directory

                    mp4_file = video_dir / f"{video_name}.mp4"
                    if not mp4_file.exists():
                        continue

                    transcript_file = video_dir / "transcription_v7" / f"{video_name}_v7.json"
                    if not transcript_file.exists():
                        continue

                    reviewed_dir = video_dir / "selected_ai_edits"
                    reviewed_file = reviewed_dir / f"{video_name}_reviewed.json"

                    results.append({
                        "video_path": str(mp4_file),
                        "video_name": video_name,
                        "corrections_path": str(corrections_file),
                        "transcript_path": str(transcript_file),
                        "reviewed_path": str(reviewed_file) if reviewed_file.exists() else None,
                        "has_reviewed": reviewed_file.exists()
                    })

            # Recurse into subdirectories
            for subdir in directory.iterdir():
                if subdir.is_dir() and not subdir.name.startswith('.'):
                    search_dir(subdir, depth + 1)
        except PermissionError:
            pass

    search_dir(base)
    return results


@app.route('/api/browse', methods=['GET'])
def browse_files():
    """Browse for videos with correction files."""
    path = request.args.get('path', BASE_DIR)

    try:
        results = find_video_folders(path)
        return jsonify({"files": results, "base_path": path})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/browse-folders', methods=['GET'])
def browse_folders():
    """Browse folder structure for navigation."""
    path = request.args.get('path', BASE_DIR)

    try:
        p = Path(path)
        if not p.exists():
            return jsonify({"error": "Path does not exist"}), 404

        folders = []
        files = []

        for item in sorted(p.iterdir()):
            if item.is_dir():
                folders.append({
                    "name": item.name,
                    "path": str(item)
                })
            elif item.suffix.lower() == '.mp4':
                files.append({
                    "name": item.name,
                    "path": str(item)
                })

        parent = str(p.parent) if p.parent != p else None

        return jsonify({
            "current_path": str(p),
            "parent_path": parent,
            "folders": folders,
            "files": files
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/video')
def serve_video():
    """Stream video file with range request support."""
    video_path = request.args.get('path')

    if not video_path or not os.path.exists(video_path):
        return jsonify({"error": "Video not found"}), 404

    file_size = os.path.getsize(video_path)

    range_header = request.headers.get('Range')

    if range_header:
        # Parse range header
        match = re.match(r'bytes=(\d+)-(\d*)', range_header)
        if match:
            start = int(match.group(1))
            end = int(match.group(2)) if match.group(2) else file_size - 1

            if start >= file_size:
                return Response(status=416)

            end = min(end, file_size - 1)
            length = end - start + 1

            def generate():
                with open(video_path, 'rb') as f:
                    f.seek(start)
                    remaining = length
                    chunk_size = 8192
                    while remaining > 0:
                        chunk = f.read(min(chunk_size, remaining))
                        if not chunk:
                            break
                        remaining -= len(chunk)
                        yield chunk

            response = Response(
                generate(),
                status=206,
                mimetype='video/mp4',
                direct_passthrough=True
            )
            response.headers['Content-Range'] = f'bytes {start}-{end}/{file_size}'
            response.headers['Accept-Ranges'] = 'bytes'
            response.headers['Content-Length'] = length
            return response

    # No range request - return full file
    return send_file(video_path, mimetype='video/mp4')


@app.route('/api/load', methods=['GET'])
def load_video_data():
    """Load video, corrections, and transcript data."""
    video_path = request.args.get('video')

    if not video_path:
        return jsonify({"error": "Video path required"}), 400

    video_path = Path(video_path)
    video_name = video_path.stem
    video_dir = video_path.parent

    # Find related files - look for any changelog variant
    corrections_dir = video_dir / "online_ai_suggested_edits"
    corrections_path = None
    if corrections_dir.exists():
        for f in corrections_dir.glob(f"{video_name}_changelog*.md"):
            corrections_path = f
            break

    if not corrections_path:
        corrections_path = corrections_dir / f"{video_name}_changelog.md"  # fallback for error message
    transcript_path = video_dir / "transcription_v7" / f"{video_name}_v7.json"
    reviewed_path = video_dir / "selected_ai_edits" / f"{video_name}_reviewed.json"

    if not corrections_path.exists():
        return jsonify({"error": f"Corrections file not found: {corrections_path}"}), 404

    if not transcript_path.exists():
        return jsonify({"error": f"Transcript file not found: {transcript_path}"}), 404

    try:
        # Load corrections
        with open(corrections_path, 'r', encoding='utf-8') as f:
            corrections_md = f.read()
        corrections = parse_corrections_markdown(corrections_md)

        # Load transcript and simplify for frontend (reduce payload size)
        with open(transcript_path, 'r', encoding='utf-8') as f:
            full_transcript = json.load(f)

        # Build a map of sentence_id -> words with timing for finding correction timestamps
        sentence_words = {}
        for i, s in enumerate(full_transcript.get("sentences", [])):
            sentence_id = s.get("id", i)
            words = []
            for orig in s.get("original_sentences", []):
                for w in orig.get("words", []):
                    words.append({
                        "word": w.get("word", "").lower().strip(".,!?;:'\""),
                        "start": w.get("start"),
                        "end": w.get("end")
                    })
            sentence_words[sentence_id] = words

        # Update correction timestamps to point to the specific word being corrected
        for corr in corrections:
            sentence_id = corr.get("sentence_id")
            original = corr.get("original", "").lower()
            words = sentence_words.get(sentence_id, [])

            # Try to find the word(s) in the sentence
            if words and original:
                original_words = original.split()
                first_word = original_words[0].strip(".,!?;:'\"") if original_words else ""

                for w in words:
                    if first_word and first_word in w["word"]:
                        if w["start"] is not None:
                            corr["timestamp"] = w["start"]
                        break

        # Send simplified transcript - no word data to keep it lightweight
        transcript = {
            "sentences": [
                {
                    "id": s.get("id", i),
                    "text": s.get("text", ""),
                    "start": s.get("start"),
                    "end": s.get("end"),
                    "speaker": s.get("speaker", ""),
                    "was_unknown": s.get("was_unknown", False)
                }
                for i, s in enumerate(full_transcript.get("sentences", []))
            ]
        }

        # Load reviewed data if exists
        reviewed = None
        if reviewed_path.exists():
            with open(reviewed_path, 'r', encoding='utf-8') as f:
                reviewed = json.load(f)

        # Detect UNKNOWN speaker segments and generate suggestions
        unknown_speaker_suggestions = detect_unknown_speakers(transcript)

        # If we have reviewed data with speaker decisions, merge them
        if reviewed and reviewed.get('speaker_decisions'):
            speaker_decisions = {d['sentence_id']: d for d in reviewed['speaker_decisions']}
            for suggestion in unknown_speaker_suggestions:
                if suggestion['sentence_id'] in speaker_decisions:
                    decision = speaker_decisions[suggestion['sentence_id']]
                    suggestion['status'] = decision.get('status', 'pending')
                    suggestion['decision'] = decision.get('decision')
                    suggestion['assigned_speaker'] = decision.get('assigned_speaker')

        # Get list of all known speakers for the UI
        known_speakers = list(set(
            s.get('speaker', '') for s in transcript.get('sentences', [])
            if s.get('speaker') and 'UNKNOWN' not in s.get('speaker', '').upper()
        ))

        return jsonify({
            "video_path": str(video_path),
            "corrections": corrections,
            "transcript": transcript,
            "reviewed": reviewed,
            "unknown_speaker_suggestions": unknown_speaker_suggestions,
            "known_speakers": sorted(known_speakers),
            "corrections_path": str(corrections_path),
            "transcript_path": str(transcript_path),
            "reviewed_path": str(reviewed_path)
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/save', methods=['POST'])
def save_reviewed():
    """Save reviewed corrections and speaker decisions to file."""
    data = request.json

    video_path = data.get('video_path')
    corrections = data.get('corrections', [])
    speaker_decisions = data.get('speaker_decisions', [])

    if not video_path:
        return jsonify({"error": "Missing video path"}), 400

    video_path = Path(video_path)
    video_name = video_path.stem
    video_dir = video_path.parent

    # Create output directory
    output_dir = video_dir / "selected_ai_edits"
    output_dir.mkdir(exist_ok=True)

    reviewed_path = output_dir / f"{video_name}_reviewed.json"

    # Calculate correction statistics
    correction_stats = {
        "total": len(corrections),
        "accepted": sum(1 for c in corrections if c.get("status") == "accepted"),
        "rejected": sum(1 for c in corrections if c.get("status") == "rejected"),
        "ignored": sum(1 for c in corrections if c.get("status") == "ignored"),
        "pending": sum(1 for c in corrections if c.get("status") == "pending")
    }

    # Calculate speaker decision statistics
    speaker_stats = {
        "total": len(speaker_decisions),
        "merge_before": sum(1 for s in speaker_decisions if s.get("decision") == "merge_before"),
        "merge_after": sum(1 for s in speaker_decisions if s.get("decision") == "merge_after"),
        "keep_separate": sum(1 for s in speaker_decisions if s.get("decision") == "keep_separate"),
        "pending": sum(1 for s in speaker_decisions if s.get("status") == "pending")
    }

    reviewed_data = {
        "source_video": str(video_path),
        "reviewed_at": datetime.now().isoformat(),
        "correction_statistics": correction_stats,
        "speaker_statistics": speaker_stats,
        "corrections": corrections,
        "speaker_decisions": speaker_decisions
    }

    try:
        with open(reviewed_path, 'w', encoding='utf-8') as f:
            json.dump(reviewed_data, f, indent=2, ensure_ascii=False)

        return jsonify({
            "success": True,
            "path": str(reviewed_path),
            "correction_statistics": correction_stats,
            "speaker_statistics": speaker_stats
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/export', methods=['POST'])
def export_training_data():
    """Export corrected transcript and training data."""
    data = request.json
    video_path = data.get('video_path')

    if not video_path:
        return jsonify({"error": "Video path required"}), 400

    video_path = Path(video_path)
    video_name = video_path.stem
    video_dir = video_path.parent

    reviewed_path = video_dir / "selected_ai_edits" / f"{video_name}_reviewed.json"
    transcript_path = video_dir / "transcription_v7" / f"{video_name}_v7.json"

    if not reviewed_path.exists():
        return jsonify({"error": "No reviewed data found. Save first."}), 404

    try:
        # Load reviewed corrections
        with open(reviewed_path, 'r', encoding='utf-8') as f:
            reviewed = json.load(f)

        # Load original transcript
        with open(transcript_path, 'r', encoding='utf-8') as f:
            transcript = json.load(f)

        # Generate training pairs (only accepted and rejected with custom text)
        training_pairs = []
        for corr in reviewed['corrections']:
            if corr['status'] in ['accepted', 'rejected'] and corr.get('final'):
                if corr['original'] != corr['final']:  # Only if there's an actual change
                    training_pairs.append({
                        "original": corr['original'],
                        "corrected": corr['final']
                    })

        # Save training data
        output_dir = video_dir / "selected_ai_edits"
        training_path = output_dir / f"{video_name}_training.jsonl"

        with open(training_path, 'w', encoding='utf-8') as f:
            for pair in training_pairs:
                f.write(json.dumps(pair, ensure_ascii=False) + '\n')

        return jsonify({
            "success": True,
            "training_file": str(training_path),
            "pair_count": len(training_pairs)
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# Cache for transcript word data to avoid re-reading files
_word_cache = {}

@app.route('/api/words-chunk', methods=['GET'])
def get_words_chunk():
    """Get word timing data for a time range (5 minute chunks)."""
    video_path = request.args.get('video')
    start_time = request.args.get('start', type=float, default=0)
    chunk_duration = 300  # 5 minutes

    if not video_path:
        return jsonify({"error": "Missing video parameter"}), 400

    video_path = Path(video_path)
    video_name = video_path.stem
    video_dir = video_path.parent
    transcript_path = video_dir / "transcription_v7" / f"{video_name}_v7.json"

    cache_key = str(transcript_path)

    # Load and cache transcript data
    if cache_key not in _word_cache:
        if not transcript_path.exists():
            return jsonify({"sentences": [], "chunk_start": start_time, "chunk_end": start_time + chunk_duration})

        try:
            with open(transcript_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            _word_cache[cache_key] = data.get("sentences", [])
        except Exception:
            return jsonify({"sentences": [], "chunk_start": start_time, "chunk_end": start_time + chunk_duration})

    sentences = _word_cache[cache_key]
    end_time = start_time + chunk_duration

    # Get sentences and words within the time range
    chunk_sentences = []
    for sentence in sentences:
        s_start = sentence.get("start")
        s_end = sentence.get("end")

        if s_start is None or s_end is None:
            continue

        # Include sentence if it overlaps with the time range
        if s_end >= start_time and s_start <= end_time:
            # Extract words from original_sentences
            words = []
            orig_sentences = sentence.get("original_sentences", [])
            if orig_sentences:
                for orig in orig_sentences:
                    for w in orig.get("words", []):
                        words.append({
                            "word": w.get("word", ""),
                            "start": w.get("start"),
                            "end": w.get("end")
                        })

            chunk_sentences.append({
                "id": sentence.get("id"),
                "start": s_start,
                "end": s_end,
                "words": words if words else None
            })

    return jsonify({
        "sentences": chunk_sentences,
        "chunk_start": start_time,
        "chunk_end": end_time
    })


if __name__ == '__main__':
    app.run(debug=True, port=5000)

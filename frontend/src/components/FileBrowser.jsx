import { useState, useEffect } from 'react'

const API_BASE = '/api'

function FileBrowser({ onSelectVideo, loading, error }) {
  const [currentPath, setCurrentPath] = useState('W:\\video_courses')
  const [folders, setFolders] = useState([])
  const [videoFiles, setVideoFiles] = useState([])
  const [parentPath, setParentPath] = useState(null)
  const [browsing, setBrowsing] = useState(false)
  const [searchResults, setSearchResults] = useState(null)
  const [searching, setSearching] = useState(false)

  // Browse current folder
  const browsePath = async (path) => {
    setBrowsing(true)
    try {
      const response = await fetch(`${API_BASE}/browse-folders?path=${encodeURIComponent(path)}`)
      const data = await response.json()

      if (data.error) {
        throw new Error(data.error)
      }

      setCurrentPath(data.current_path)
      setFolders(data.folders)
      setVideoFiles(data.files)
      setParentPath(data.parent_path)
      setSearchResults(null)
    } catch (err) {
      console.error('Browse error:', err)
    } finally {
      setBrowsing(false)
    }
  }

  // Search for videos with corrections
  const searchForVideos = async () => {
    setSearching(true)
    try {
      const response = await fetch(`${API_BASE}/browse?path=${encodeURIComponent(currentPath)}`)
      const data = await response.json()

      if (data.error) {
        throw new Error(data.error)
      }

      setSearchResults(data.files)
    } catch (err) {
      console.error('Search error:', err)
    } finally {
      setSearching(false)
    }
  }

  useEffect(() => {
    browsePath(currentPath)
  }, [])

  return (
    <div className="file-browser">
      <div className="browser-header">
        <h1>Transcript Correction Review Tool</h1>
        <p>Select a video file that has an associated corrections file</p>
      </div>

      <div className="browser-controls">
        <div className="path-display">
          <span className="path-label">Current:</span>
          <span className="path-value">{currentPath}</span>
        </div>

        <div className="browser-buttons">
          {parentPath && (
            <button
              className="btn btn-secondary"
              onClick={() => browsePath(parentPath)}
              disabled={browsing}
            >
              ↑ Up
            </button>
          )}
          <button
            className="btn btn-primary"
            onClick={searchForVideos}
            disabled={searching}
          >
            {searching ? 'Searching...' : 'Search for Videos with Corrections'}
          </button>
        </div>
      </div>

      {error && (
        <div className="browser-error">{error}</div>
      )}

      {searchResults ? (
        <div className="search-results">
          <h3>Videos with Correction Files ({searchResults.length} found)</h3>
          {searchResults.length === 0 ? (
            <p className="no-results">No videos with correction files found in this directory.</p>
          ) : (
            <ul className="video-list">
              {searchResults.map((item, idx) => (
                <li key={idx} className="video-item">
                  <div className="video-info">
                    <span className="video-name">{item.video_name}</span>
                    <span className="video-path">{item.video_path}</span>
                    {item.has_reviewed && (
                      <span className="review-badge">Has reviewed data</span>
                    )}
                  </div>
                  <button
                    className="btn btn-success"
                    onClick={() => onSelectVideo(item.video_path)}
                    disabled={loading}
                  >
                    {loading ? 'Loading...' : 'Open'}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button
            className="btn btn-secondary"
            onClick={() => setSearchResults(null)}
          >
            Back to Browser
          </button>
        </div>
      ) : (
        <div className="folder-browser">
          {browsing ? (
            <p>Loading...</p>
          ) : (
            <>
              <div className="folder-list">
                <h3>Folders</h3>
                {folders.length === 0 ? (
                  <p className="no-items">No subfolders</p>
                ) : (
                  <ul>
                    {folders.map((folder, idx) => (
                      <li key={idx}>
                        <button
                          className="folder-btn"
                          onClick={() => browsePath(folder.path)}
                        >
                          📁 {folder.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="file-list">
                <h3>Video Files</h3>
                {videoFiles.length === 0 ? (
                  <p className="no-items">No video files in this folder</p>
                ) : (
                  <ul>
                    {videoFiles.map((file, idx) => (
                      <li key={idx}>
                        <span className="file-name">🎬 {file.name}</span>
                        <button
                          className="btn btn-small"
                          onClick={() => onSelectVideo(file.path)}
                          disabled={loading}
                        >
                          Open
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
      )}

      <div className="browser-footer">
        <h3>Keyboard Shortcuts</h3>
        <div className="shortcuts-grid">
          <div><kbd>A</kbd> Accept correction</div>
          <div><kbd>R</kbd> Reject (custom text)</div>
          <div><kbd>I</kbd> Ignore correction</div>
          <div><kbd>N</kbd> / <kbd>→</kbd> Next</div>
          <div><kbd>B</kbd> / <kbd>←</kbd> Previous</div>
          <div><kbd>Space</kbd> Play/Pause video</div>
          <div><kbd>1-4</kbd> Playback speed</div>
          <div><kbd>Ctrl+S</kbd> Save progress</div>
        </div>
      </div>
    </div>
  )
}

export default FileBrowser

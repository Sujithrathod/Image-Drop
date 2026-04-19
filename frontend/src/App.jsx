import { useState, useRef, useCallback } from 'react';
import axios from 'axios';

// ─── Config ───────────────────────────────────────────────────────────────────
const CLOUD_NAME = "dqtiee3ge";
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
const MAX_IMAGES = 5;
const MAX_FILES = 5;
const MAX_FILE_TOTAL_MB = 15;

// Accepted document types (extension list for filtering + MIME types for picker)
const ACCEPTED_DOC_EXTS = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.csv'];
const ACCEPT_STRING = [
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.csv',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain', 'text/csv',
].join(',');

const getFileIcon = (filename) => {
  const ext = filename.toLowerCase().split('.').pop();
  if (ext === 'pdf')  return '📕';
  if (['doc','docx'].includes(ext))  return '📝';
  if (['xls','xlsx'].includes(ext))  return '📊';
  if (['ppt','pptx'].includes(ext))  return '📊';
  if (ext === 'txt')  return '📄';
  if (ext === 'csv')  return '📋';
  return '📎';
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatBytes = (bytes) => {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
};

// ─── App ──────────────────────────────────────────────────────────────────────
function App() {
  const [mode, setMode]               = useState('upload');       // 'upload' | 'view'
  const [uploadType, setUploadType]   = useState('images');       // 'images' | 'files'
  const [name, setName]               = useState('');
  const [files, setFiles]             = useState([]);
  const [previews, setPreviews]       = useState([]);
  const [isDragOver, setIsDragOver]   = useState(false);
  const [loading, setLoading]         = useState(false);
  const [message, setMessage]         = useState({ text: '', type: '' });
  const [uploadedFiles, setUploadedFiles] = useState([]);

  // View tab
  const [viewName, setViewName]       = useState('');
  const [viewType, setViewType]       = useState('image');
  const [viewResults, setViewResults] = useState([]);
  const [viewLoading, setViewLoading] = useState(false);
  const [downloading, setDownloading] = useState(null);

  const fileInputRef = useRef(null);

  // ── File management ──────────────────────────────────────────────────────────
  const addFiles = useCallback((newFiles) => {
    const arr = Array.from(newFiles);
    setMessage({ text: '', type: '' });
    setUploadedFiles([]);

    if (uploadType === 'images') {
      const valid = arr.filter(f => f.type.startsWith('image/'));
      setFiles(prev => {
        const combined = [...prev, ...valid].slice(0, MAX_IMAGES);
        setPreviews(combined.map(f => URL.createObjectURL(f)));
        return combined;
      });
    } else {
      const valid = arr.filter(f =>
        ACCEPTED_DOC_EXTS.some(ext => f.name.toLowerCase().endsWith(ext))
      );
      setFiles(prev => [...prev, ...valid].slice(0, MAX_FILES));
    }
  }, [uploadType]);

  const removeFile = (index) => {
    setFiles(prev => {
      const updated = prev.filter((_, i) => i !== index);
      if (uploadType === 'images') {
        URL.revokeObjectURL(previews[index]);
        setPreviews(updated.map(f => URL.createObjectURL(f)));
      }
      return updated;
    });
  };

  // Only clears the file picker — does NOT touch message or uploadedFiles
  const clearFileSelection = () => {
    previews.forEach(url => URL.revokeObjectURL(url));
    setFiles([]);
    setPreviews([]);
  };

  // Full reset (used when switching type or re-selecting files)
  const clearAll = () => {
    clearFileSelection();
    setUploadedFiles([]);
    setMessage({ text: '', type: '' });
  };

  const switchUploadType = (type) => {
    clearAll();
    setUploadType(type);
  };

  // ── Drag-and-drop ────────────────────────────────────────────────────────────
  const handleDragOver  = (e) => { e.preventDefault(); setIsDragOver(true); };
  const handleDragLeave = ()  => setIsDragOver(false);
  const handleDrop      = (e) => { e.preventDefault(); setIsDragOver(false); addFiles(e.dataTransfer.files); };

  // ── PDF size guard ───────────────────────────────────────────────────────────
  const filesTotalSize   = files.reduce((sum, f) => sum + f.size, 0);
  const fileSizeExceeded = uploadType === 'files' && filesTotalSize > MAX_FILE_TOTAL_MB * 1024 * 1024;

  // ── Upload ───────────────────────────────────────────────────────────────────
  const handleUpload = async (e) => {
    e.preventDefault();
    if (!name)            return setMessage({ text: '⚠ Enter a name first!', type: 'error' });
    if (!files.length)    return setMessage({ text: '⚠ Select at least one file!', type: 'error' });
    if (fileSizeExceeded) return setMessage({ text: `⚠ Total file size exceeds ${MAX_FILE_TOTAL_MB}MB!`, type: 'error' });

    setLoading(true);
    setMessage({ text: '', type: '' });

    const formData  = new FormData();
    formData.append('name', name);
    const field     = uploadType === 'images' ? 'images' : 'pdfs';  // backend still uses 'pdfs' field name
    files.forEach(f => formData.append(field, f));
    const endpoint  = uploadType === 'images' ? '/api/upload' : '/api/upload/pdf';

    try {
      const { data } = await axios.post(`${API_URL}${endpoint}`, formData);
      // Clear the file picker but KEEP message + uploadedFiles visible
      clearFileSelection();
      setName('');
      setUploadedFiles(data.files);
      setMessage({
        text: `✅ Uploaded ${data.files.length} file(s) successfully! Check them in the Download section below.`,
        type: 'success'
      });
    } catch (err) {
      setMessage({ text: err.response?.data?.error || 'Upload failed. Please try again.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // ── View / fetch ─────────────────────────────────────────────────────────────
  const handleView = async (e) => {
    e.preventDefault();
    if (!viewName) return;
    setViewLoading(true);
    setViewResults([]);

    if (viewType === 'image') {
      // Try exact name + _1…_5; onError on <img> hides the slots that don't exist
      const candidates = [
        viewName,
        ...Array.from({ length: MAX_IMAGES }, (_, i) => `${viewName}_${i + 1}`),
      ];
      setViewResults(candidates.map(n => ({
        name: n,
        url:  `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/${n}`,
        type: 'image',
      })));
      setViewLoading(false);
    } else {
      // For documents: try exact name AND _1…_5 variants, resolved via server
      // The backend stores files as: name.ext (single) or name_1.ext, name_2.ext… (multi)
      const suffixes = ['', ...Array.from({ length: MAX_FILES }, (_, i) => `_${i + 1}`)];

      try {
        const settledResults = await Promise.allSettled(
          suffixes.map(suffix => {
            const keyName = `${viewName}${suffix}`;
            return fetch(`${API_URL}/api/file-info?publicId=${encodeURIComponent(keyName)}&type=raw`)
              .then(r => r.ok ? r.json() : Promise.reject())
              .then(data => ({ ...data, keyName }));
          })
        );

        const found = settledResults
          .filter(r => r.status === 'fulfilled' && r.value?.url)
          .map(r => ({
            name:         r.value.keyName,
            originalName: r.value.originalName || r.value.keyName,
            url:          r.value.url,
            type:         'file',
          }));

        if (found.length > 0) {
          setViewResults(found);
        } else {
          // Fallback: show a single placeholder so user sees "not found" state
          setViewResults([{
            name:         viewName,
            originalName: viewName,
            url:          `https://res.cloudinary.com/${CLOUD_NAME}/raw/upload/${viewName}`,
            type:         'file',
          }]);
        }
      } catch {
        setViewResults([{
          name:         viewName,
          originalName: viewName,
          url:          `https://res.cloudinary.com/${CLOUD_NAME}/raw/upload/${viewName}`,
          type:         'file',
        }]);
      } finally {
        setViewLoading(false);
      }
    }
  };

  // ── Download — proxied via backend so there are no CORS or MIME issues ────────
  const handleDownload = (cloudinaryUrl, filename) => {
    // Build the proxy URL — backend fetches from Cloudinary and streams back
    // with correct Content-Disposition so the browser saves the file properly
    const params = new URLSearchParams({ url: cloudinaryUrl, filename });
    window.open(`${API_URL}/api/download?${params.toString()}`, '_blank');
  };


  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div style={s.page}>
      <div style={s.container}>

        {/* Header */}
        <div style={s.header}>
          <div style={s.logo}>📁 DontPad Files</div>
          <p style={s.subtitle}>Share images &amp; PDFs using just a simple name</p>
        </div>

        {/* Mode tabs */}
        <div style={s.tabs}>
          <button id="tab-upload" onClick={() => setMode('upload')} style={mode === 'upload' ? s.activeTab : s.tab}>
            ⬆&nbsp; Upload
          </button>
          <button id="tab-view"   onClick={() => setMode('view')}   style={mode === 'view'   ? s.activeTab : s.tab}>
            🔍&nbsp; View / Download
          </button>
        </div>

        {/* ── UPLOAD MODE ── */}
        {mode === 'upload' && (
          <div style={s.card}>

            {/* Type toggle */}
            <div style={s.typeToggle}>
              <button id="type-images" onClick={() => switchUploadType('images')}
                style={uploadType === 'images' ? s.typeActive : s.typeBtn}>
                🖼&nbsp; Images&nbsp;<span style={s.badge}>up to 5</span>
              </button>
              <button id="type-files" onClick={() => switchUploadType('files')}
                style={uploadType === 'files' ? s.typeActive : s.typeBtn}>
                📎&nbsp; Files&nbsp;<span style={s.badge}>max 15 MB</span>
              </button>
            </div>

            <form onSubmit={handleUpload} style={s.form}>

              {/* Name input */}
              <input
                id="upload-name"
                type="text"
                placeholder="Enter a unique name (e.g., vacation-2024)"
                value={name}
                onChange={e => setName(e.target.value.toLowerCase().replace(/\s/g, '-'))}
                style={s.input}
              />

              {/* Drop zone */}
              <div
                id="drop-zone"
                style={{
                  ...s.dropZone,
                  ...(isDragOver      ? s.dropZoneActive    : {}),
                  ...(files.length > 0 ? s.dropZoneHasFiles : {}),
                }}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={uploadType === 'images' ? 'image/*' : ACCEPT_STRING}
                  multiple
                  onChange={e => addFiles(e.target.files)}
                  hidden
                />

                {files.length === 0 ? (
                  <div style={s.dropZoneContent}>
                    <div style={s.dropIcon}>{uploadType === 'images' ? '🖼' : '📎'}</div>
                    <div style={s.dropText}>
                      {uploadType === 'images'
                        ? 'Drop images here or click to browse'
                        : 'Drop files here or click to browse'}
                    </div>
                    <div style={s.dropHint}>
                      {uploadType === 'images'
                        ? `Up to ${MAX_IMAGES} images`
                        : `PDF, Word, Excel, PowerPoint, TXT, CSV · Up to ${MAX_FILES} files · Max ${MAX_FILE_TOTAL_MB} MB total`}
                    </div>
                  </div>
                ) : (
                  <div style={s.fileCountBadgeWrap} onClick={e => e.stopPropagation()}>
                    <span style={s.fileCountPill}>
                      {files.length} / {uploadType === 'images' ? MAX_IMAGES : MAX_FILES} files
                    </span>
                    {uploadType === 'files' && (
                      <span style={{ ...s.sizePill, ...(fileSizeExceeded ? s.sizePillError : s.sizePillOk) }}>
                        {formatBytes(filesTotalSize)} / {MAX_FILE_TOTAL_MB} MB
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Image preview grid */}
              {uploadType === 'images' && files.length > 0 && (
                <div style={s.previewGrid}>
                  {files.map((file, i) => (
                    <div key={i} style={s.previewItem}>
                      <img src={previews[i]} alt={file.name} style={s.previewImg} />
                      <button type="button" onClick={() => removeFile(i)} style={s.removeBtn} title="Remove">✕</button>
                      <div style={s.previewLabel}>{formatBytes(file.size)}</div>
                    </div>
                  ))}
                  {files.length < MAX_IMAGES && (
                    <div style={s.addMoreTile} onClick={() => fileInputRef.current?.click()}>
                      <span style={{ fontSize: '1.8rem', color: '#6b7280' }}>+</span>
                      <span style={{ fontSize: '12px', color: '#6b7280' }}>Add</span>
                    </div>
                  )}
                </div>
              )}

              {/* File list (docs) */}
              {uploadType === 'files' && files.length > 0 && (
                <div style={s.pdfList}>
                  {files.map((file, i) => (
                    <div key={i} style={s.pdfItem}>
                      <span style={{ fontSize: '1.3rem' }}>{getFileIcon(file.name)}</span>
                      <div style={s.pdfInfo}>
                        <div style={s.pdfName}>{file.name}</div>
                        <div style={s.pdfSize}>{formatBytes(file.size)}</div>
                      </div>
                      <button type="button" onClick={() => removeFile(i)} style={s.removeBtnSmall}>✕</button>
                    </div>
                  ))}
                  {files.length < MAX_FILES && (
                    <button type="button" style={s.addMorePdf} onClick={() => fileInputRef.current?.click()}>
                      + Add more files
                    </button>
                  )}
                  {fileSizeExceeded && (
                    <div style={s.errorBanner}>⚠ Total size exceeds {MAX_FILE_TOTAL_MB} MB. Please remove some files.</div>
                  )}
                </div>
              )}

              {/* Submit */}
              <button id="upload-btn" type="submit"
                disabled={loading || fileSizeExceeded}
                style={{ ...s.btn, ...(loading || fileSizeExceeded ? s.btnDisabled : {}) }}>
                {loading
                  ? '⏳ Uploading…'
                  : `⬆ Upload ${uploadType === 'images' ? 'Images' : 'Files'}`}
              </button>

              {message.text && (
                <div style={message.type === 'success' ? s.successMsg : s.errorMsg}>
                  {message.text}
                </div>
              )}
            </form>

            {/* Uploaded results — visible right after upload */}
            {uploadedFiles.length > 0 && (
              <div style={s.uploadResults}>
                <div style={s.resultsTitle}>📁 Uploaded — download directly or use the key name in the Downloads tab</div>
                {uploadedFiles.map((f, i) => (
                  <div key={i} style={s.resultItem}>
                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>{getFileIcon(f.originalName || f.name)}</span>
                        {/* Show the ORIGINAL filename prominently */}
                        <span style={s.resultName}>{f.originalName || f.name}</span>
                      </div>
                      <span style={{ fontSize: '11px', color: '#4b5563', paddingLeft: '28px' }}>
                        Key: {f.name}
                      </span>
                    </div>
                    <button
                      onClick={() => handleDownload(f.url, f.originalName || f.name)}
                      style={s.downloadBtn}
                    >
                      ⬇ Download
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── VIEW MODE ── */}
        {mode === 'view' && (
          <div style={s.card}>

            {/* Type toggle */}
            <div style={s.typeToggle}>
              <button id="view-type-image" onClick={() => { setViewType('image'); setViewResults([]); }}
                style={viewType === 'image' ? s.typeActive : s.typeBtn}>
                🖼&nbsp; Images
              </button>
              <button id="view-type-file" onClick={() => { setViewType('pdf'); setViewResults([]); }}
                style={viewType === 'pdf' ? s.typeActive : s.typeBtn}>
                📎&nbsp; Files
              </button>
            </div>

            <form onSubmit={handleView} style={s.form}>
              <input
                id="view-name"
                type="text"
                placeholder="Enter the name (e.g., vacation-2024)"
                value={viewName}
                onChange={e => setViewName(e.target.value.toLowerCase().replace(/\s/g, '-'))}
                style={s.input}
              />
              <button id="fetch-btn" type="submit" style={s.btn}>
                {viewLoading ? '⏳ Fetching…' : '🔍 Fetch Files'}
              </button>
              <p style={s.viewHint}>
                Looks for &ldquo;{viewName || 'name'}&rdquo;, &ldquo;{viewName || 'name'}_1&rdquo; … &ldquo;{viewName || 'name'}_5&rdquo; automatically.
              </p>
            </form>

            {/* Image results */}
            {viewResults.length > 0 && viewType === 'image' && (
              <div style={s.viewResults}>
                {viewResults.map((r, i) => (
                  <div key={i} data-view-slot="true" style={s.viewImageSlot}>
                    <img
                      src={r.url}
                      alt={r.name}
                      style={{ ...s.viewImage, display: 'none' }}
                      onLoad={e  => {
                        e.target.style.display = 'block';
                        e.target.closest('[data-view-slot]').style.display = 'block';
                      }}
                      onError={e => {
                        e.target.closest('[data-view-slot]').style.display = 'none';
                      }}
                    />
                    <div style={s.viewImageActions}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={s.viewImageName}>{r.originalName || r.name}</span>
                        {r.originalName && r.originalName !== r.name && (
                          <span style={{ fontSize: '11px', color: '#4b5563' }}>Key: {r.name}</span>
                        )}
                      </div>
                      <button onClick={() => handleDownload(r.url, r.originalName || r.name)}
                        style={s.downloadBtn}>
                        ⬇ Download
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* PDF results */}
            {viewResults.length > 0 && viewType === 'pdf' && (
              <div style={s.pdfResults}>
                <div style={s.resultsTitle}>Files — click download to save</div>
                {viewResults.map((r, i) => (
                  <div key={i} style={s.pdfResultItem}>
                    <span style={{ fontSize: '1.2rem' }}>{getFileIcon(r.originalName || r.name)}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ ...s.resultName }}>{r.originalName || r.name}</div>
                      {r.originalName && r.originalName !== r.name && (
                        <div style={{ fontSize: '11px', color: '#4b5563' }}>Key: {r.name}</div>
                      )}
                    </div>
                    <button onClick={() => handleDownload(r.url, r.originalName || r.name)}
                      style={s.downloadBtn}>
                      ⬇ Download
                    </button>
                  </div>
                ))}
                <p style={s.viewHint}>Enter the exact key name shown after upload.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #0d0f18 0%, #14102b 50%, #0d0f18 100%)',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    padding: '48px 16px 100px',
    fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
    WebkitFontSmoothing: 'antialiased',
  },
  container: { width: '100%', maxWidth: '580px' },
  header: { textAlign: 'center', marginBottom: '36px' },
  logo: {
    fontSize: '2.2rem', fontWeight: 800,
    background: 'linear-gradient(135deg, #818cf8, #c4b5fd)',
    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
    letterSpacing: '-0.5px',
  },
  subtitle: { color: '#6b7280', marginTop: '8px', fontSize: '15px' },

  // Tabs
  tabs: {
    display: 'flex', gap: '6px', marginBottom: '20px',
    background: 'rgba(255,255,255,0.04)',
    borderRadius: '14px', padding: '5px',
    border: '1px solid rgba(255,255,255,0.07)',
  },
  tab: {
    flex: 1, padding: '11px 16px', border: 'none',
    background: 'transparent', color: '#6b7280',
    cursor: 'pointer', borderRadius: '10px',
    fontSize: '14px', fontWeight: 500, transition: 'all 0.2s',
  },
  activeTab: {
    flex: 1, padding: '11px 16px', border: 'none',
    background: 'linear-gradient(135deg, rgba(99,102,241,0.25), rgba(139,92,246,0.25))',
    color: '#a5b4fc', cursor: 'pointer', borderRadius: '10px',
    fontSize: '14px', fontWeight: 600,
    boxShadow: '0 0 0 1px rgba(99,102,241,0.35)',
  },

  // Card
  card: {
    background: 'rgba(255,255,255,0.035)',
    backdropFilter: 'blur(24px)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '20px', padding: '28px',
    display: 'flex', flexDirection: 'column', gap: '18px',
    boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
  },

  // Type toggle
  typeToggle: {
    display: 'flex', gap: '6px',
    background: 'rgba(0,0,0,0.25)',
    borderRadius: '12px', padding: '4px',
  },
  typeBtn: {
    flex: 1, padding: '9px 10px', border: 'none',
    background: 'transparent', color: '#6b7280',
    cursor: 'pointer', borderRadius: '8px',
    fontSize: '13px', fontWeight: 500,
  },
  typeActive: {
    flex: 1, padding: '9px 10px', border: 'none',
    background: 'rgba(139,92,246,0.18)',
    color: '#c4b5fd', cursor: 'pointer', borderRadius: '8px',
    fontSize: '13px', fontWeight: 600,
    boxShadow: '0 0 0 1px rgba(139,92,246,0.35)',
  },
  badge: {
    fontSize: '11px', padding: '2px 6px',
    background: 'rgba(255,255,255,0.08)',
    borderRadius: '20px', fontWeight: 400,
    marginLeft: '4px', color: '#9ca3af',
  },

  form: { display: 'flex', flexDirection: 'column', gap: '14px' },

  // Input
  input: {
    padding: '13px 16px', fontSize: '15px',
    borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(0,0,0,0.3)', color: '#f9fafb',
    outline: 'none', width: '100%', boxSizing: 'border-box',
    transition: 'border-color 0.2s',
  },

  // Drop zone
  dropZone: {
    padding: '36px 20px',
    border: '2px dashed rgba(255,255,255,0.12)',
    borderRadius: '14px', cursor: 'pointer',
    textAlign: 'center', transition: 'all 0.25s',
    background: 'rgba(0,0,0,0.1)',
  },
  dropZoneActive: {
    border: '2px dashed #8b5cf6',
    background: 'rgba(139,92,246,0.1)',
    transform: 'scale(1.01)',
  },
  dropZoneHasFiles: {
    padding: '18px 20px',
    border: '2px dashed rgba(139,92,246,0.4)',
    background: 'rgba(139,92,246,0.05)',
  },
  dropZoneContent: {},
  dropIcon:  { fontSize: '2.8rem', marginBottom: '10px' },
  dropText:  { color: '#d1d5db', fontSize: '15px', fontWeight: 500, marginBottom: '6px' },
  dropHint:  { color: '#6b7280', fontSize: '13px' },

  fileCountBadgeWrap: { display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'center' },
  fileCountPill: {
    padding: '6px 14px', borderRadius: '20px',
    background: 'rgba(139,92,246,0.15)',
    border: '1px solid rgba(139,92,246,0.35)',
    color: '#c4b5fd', fontWeight: 600, fontSize: '14px',
  },
  sizePill: { padding: '6px 14px', borderRadius: '20px', fontWeight: 600, fontSize: '14px' },
  sizePillOk:    { background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.35)', color: '#34d399' },
  sizePillError: { background: 'rgba(239,68,68,0.12)',  border: '1px solid rgba(239,68,68,0.35)',  color: '#f87171' },

  // Image preview grid
  previewGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
    gap: '10px',
  },
  previewItem: {
    position: 'relative', borderRadius: '12px', overflow: 'hidden',
    border: '1px solid rgba(255,255,255,0.1)',
    background: '#000', aspectRatio: '1',
  },
  previewImg: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  removeBtn: {
    position: 'absolute', top: '5px', right: '5px',
    background: 'rgba(239,68,68,0.85)', border: 'none',
    color: 'white', width: '22px', height: '22px',
    borderRadius: '50%', cursor: 'pointer', fontSize: '11px',
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
  },
  previewLabel: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    background: 'rgba(0,0,0,0.65)', color: '#d1d5db',
    fontSize: '11px', padding: '4px 6px', textAlign: 'center',
  },
  addMoreTile: {
    border: '2px dashed rgba(255,255,255,0.15)',
    borderRadius: '12px', aspectRatio: '1',
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    gap: '4px', cursor: 'pointer', transition: 'all 0.2s',
    background: 'rgba(255,255,255,0.02)',
  },

  // PDF list
  pdfList: { display: 'flex', flexDirection: 'column', gap: '8px' },
  pdfItem: {
    display: 'flex', alignItems: 'center', gap: '10px',
    padding: '11px 14px',
    background: 'rgba(0,0,0,0.2)', borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.07)',
  },
  pdfInfo: { flex: 1, textAlign: 'left', minWidth: 0 },
  pdfName: { color: '#e5e7eb', fontSize: '14px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  pdfSize: { color: '#6b7280', fontSize: '12px', marginTop: '2px' },
  removeBtnSmall: {
    background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
    color: '#f87171', width: '30px', height: '30px',
    borderRadius: '8px', cursor: 'pointer', fontSize: '13px',
    flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  addMorePdf: {
    background: 'transparent', border: '1px dashed rgba(255,255,255,0.15)',
    color: '#9ca3af', padding: '9px', borderRadius: '10px',
    cursor: 'pointer', fontSize: '13px', width: '100%',
  },
  errorBanner: {
    background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
    color: '#f87171', padding: '10px 14px', borderRadius: '10px', fontSize: '13px',
  },

  // Buttons
  btn: {
    padding: '14px 20px', fontSize: '15px', fontWeight: 700,
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    color: 'white', border: 'none', borderRadius: '12px',
    cursor: 'pointer', transition: 'all 0.2s',
    boxShadow: '0 4px 18px rgba(99,102,241,0.4)',
  },
  btnDisabled: { opacity: 0.45, cursor: 'not-allowed', boxShadow: 'none' },
  downloadBtn: {
    padding: '7px 14px', fontSize: '13px', fontWeight: 500,
    background: 'rgba(99,102,241,0.12)', color: '#a5b4fc',
    border: '1px solid rgba(99,102,241,0.3)',
    borderRadius: '8px', cursor: 'pointer', whiteSpace: 'nowrap',
  },

  // Messages
  successMsg: {
    padding: '13px 16px',
    background: 'rgba(16,185,129,0.09)', border: '1px solid rgba(16,185,129,0.3)',
    borderRadius: '12px', color: '#34d399', fontSize: '14px', fontWeight: 500,
  },
  errorMsg: {
    padding: '13px 16px',
    background: 'rgba(239,68,68,0.09)', border: '1px solid rgba(239,68,68,0.3)',
    borderRadius: '12px', color: '#f87171', fontSize: '14px', fontWeight: 500,
  },

  // Upload results
  uploadResults: {
    borderTop: '1px solid rgba(255,255,255,0.08)',
    paddingTop: '18px', display: 'flex', flexDirection: 'column', gap: '8px',
  },
  resultsTitle: { color: '#d1d5db', fontWeight: 600, fontSize: '14px', marginBottom: '4px' },
  resultItem: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '9px 13px', background: 'rgba(0,0,0,0.2)',
    borderRadius: '10px', gap: '8px',
  },
  resultName: { color: '#e5e7eb', fontSize: '14px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  resultLink: {
    color: '#818cf8', fontSize: '13px', textDecoration: 'none',
    padding: '5px 11px', flexShrink: 0,
    background: 'rgba(99,102,241,0.1)', borderRadius: '7px',
    border: '1px solid rgba(99,102,241,0.25)',
  },

  // View results
  viewResults: { display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '4px' },
  viewImageSlot: {
    display: 'none',                       // hidden by default, shown by onLoad
    borderRadius: '14px', overflow: 'hidden',
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(0,0,0,0.25)',
  },
  viewImage: { width: '100%', display: 'block', maxHeight: '320px', objectFit: 'contain', background: '#000' },
  viewImageActions: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '10px 14px',
  },
  viewImageName: { color: '#6b7280', fontSize: '13px' },

  pdfResults: { display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' },
  pdfResultItem: {
    display: 'flex', alignItems: 'center', gap: '10px',
    padding: '11px 14px', background: 'rgba(0,0,0,0.2)',
    borderRadius: '12px', border: '1px solid rgba(255,255,255,0.07)',
  },

  viewHint: { color: '#4b5563', fontSize: '13px', textAlign: 'center', margin: 0 },
};

export default App;

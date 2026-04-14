import { useState } from 'react';
import axios from 'axios';

// Your Cloudinary Cloud Name
const CLOUD_NAME = "dqtiee3ge"; 
// API URL - set VITE_API_URL in Vercel env vars to your Render backend URL
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

function App() {
  const [mode, setMode] = useState('upload'); // 'upload' or 'view'
  const [name, setName] = useState('');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [downloading, setDownloading] = useState(false);
  
  // For viewing
  const [viewUrl, setViewUrl] = useState('');
  const [imageFound, setImageFound] = useState(false);

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    setFile(selected);
    setPreview(URL.createObjectURL(selected));
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!name || !file) return alert("Enter a name and select an image");

    setLoading(true);
    const formData = new FormData();
    formData.append('image', file);
    formData.append('name', name);

    try {
      await axios.post(`${API_URL}/api/upload`, formData);
      setMessage(`Success! Share this name: "${name}"`);
      setFile(null);
      setPreview(null);
    } catch (error) {
      setMessage("Error uploading image. Name might be taken or invalid.");
    } finally {
      setLoading(false);
    }
  };

  const handleView = (e) => {
    e.preventDefault();
    if (!name) return;
    
    // Construct the URL directly. No backend call needed!
    const constructedUrl = `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/${name}`;
    setViewUrl(constructedUrl);
    setImageFound(true); 
  };

  const handleDownload = async () => {
    try {
      setDownloading(true);
      // Fetch the image as a blob to bypass cross-origin download restrictions
      const response = await fetch(viewUrl);
      const blob = await response.blob();
      
      // Determine file extension from the content type
      const contentType = blob.type;
      const ext = contentType.split('/')[1] || 'jpg';
      
      // Create a temporary download link
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `${name}.${ext}`;
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch (error) {
      alert('Failed to download image. Please try again.');
      console.error('Download error:', error);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.logo}>📷 DontPad Images</h1>
      <p style={styles.subtitle}>Share images using just a simple name</p>

      <div style={styles.tabs}>
        <button 
          onClick={() => setMode('upload')} 
          style={mode === 'upload' ? styles.activeTab : styles.tab}
        >
          Upload
        </button>
        <button 
          onClick={() => setMode('view')} 
          style={mode === 'view' ? styles.activeTab : styles.tab}
        >
          View / Download
        </button>
      </div>

      {mode === 'upload' ? (
        <form onSubmit={handleUpload} style={styles.card}>
          <input
            type="text"
            placeholder="Enter a unique name (e.g., vacation-2024)"
            value={name}
            onChange={(e) => setName(e.target.value.toLowerCase().replace(/\s/g, '-'))}
            style={styles.input}
          />
          
          <label style={styles.fileLabel}>
            {file ? file.name : "Click to select image (Max 10MB)"}
            <input type="file" accept="image/*" onChange={handleFileChange} hidden />
          </label>

          {preview && (
            <img src={preview} alt="Preview" style={styles.preview} />
          )}

          <button type="submit" disabled={loading} style={styles.button}>
            {loading ? "Uploading..." : "Upload Image"}
          </button>

          {message && <p style={styles.message}>{message}</p>}
        </form>
      ) : (
        <form onSubmit={handleView} style={styles.card}>
          <input
            type="text"
            placeholder="Enter the name (e.g., vacation-2024)"
            value={name}
            onChange={(e) => setName(e.target.value.toLowerCase().replace(/\s/g, '-'))}
            style={styles.input}
          />
          <button type="submit" style={styles.button}>Fetch Image</button>

          {imageFound && (
            <div style={styles.resultContainer}>
              <img 
                src={viewUrl} 
                alt="Fetched" 
                style={styles.resultImage}
                onError={(e) => {
                  e.target.style.display = 'none';
                  alert("No image found with this name!");
                  setImageFound(false);
                }}
              />
              <button onClick={handleDownload} disabled={downloading} style={styles.downloadBtn}>
                {downloading ? '⏳ Downloading...' : '⬇ Download Image'}
              </button>
            </div>
          )}
        </form>
      )}
    </div>
  );
}

// Simple inline styles for a clean look
const styles = {
  container: { maxWidth: '500px', margin: '50px auto', fontFamily: 'sans-serif', textAlign: 'center' },
  logo: { fontSize: '2rem', marginBottom: 0 },
  subtitle: { color: '#666', marginBottom: '20px' },
  tabs: { display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '20px' },
  tab: { padding: '10px 20px', border: '1px solid #ccc', background: 'white', cursor: 'pointer', borderRadius: '5px' },
  activeTab: { padding: '10px 20px', border: '1px solid #007bff', background: '#007bff', color: 'white', cursor: 'pointer', borderRadius: '5px' },
  card: { display: 'flex', flexDirection: 'column', gap: '15px', padding: '20px', border: '1px solid #eee', borderRadius: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' },
  input: { padding: '12px', fontSize: '16px', borderRadius: '5px', border: '1px solid #ccc' },
  fileLabel: { padding: '20px', border: '2px dashed #ccc', borderRadius: '5px', cursor: 'pointer', color: '#555' },
  preview: { maxWidth: '100%', maxHeight: '200px', borderRadius: '5px', objectFit: 'contain' },
  button: { padding: '12px', fontSize: '16px', background: '#28a745', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' },
  message: { color: '#28a745', fontWeight: 'bold' },
  resultContainer: { marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '15px' },
  resultImage: { maxWidth: '100%', borderRadius: '5px', border: '1px solid #eee' },
  downloadBtn: { padding: '10px', background: '#007bff', color: 'white', textDecoration: 'none', borderRadius: '5px', display: 'inline-block' }
};

export default App;

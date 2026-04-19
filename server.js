const express = require("express");
const cors = require("cors");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
require('dotenv').config();


const app = express();
app.use(cors());

cloudinary.config({
    cloud_name: process.env.CLOUD_NAME,
    api_key: process.env.API_KEY,
    api_secret: process.env.API_SECRET,
});

// 15MB per file limit (to support large PDFs)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 15 * 1024 * 1024 }
});

// ─── Helper ───────────────────────────────────────────────────────────────────
const uploadToCloudinary = (buffer, publicId, resourceType = 'auto', originalName = '') => {
    return new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream(
            {
                public_id: publicId,
                resource_type: resourceType,
                // Store original filename in Cloudinary context so we can retrieve it later
                context: originalName ? { original_filename: originalName } : undefined,
            },
            (err, result) => {
                if (err) reject(err);
                else resolve(result);
            }
        ).end(buffer);
    });
};

// ─── POST /api/upload — Multi-image upload (up to 5 images) ──────────────────
app.post('/api/upload', upload.array('images', 5), async (req, res) => {
    try {
        const { name } = req.body;
        const files = req.files;

        if (!name || !files || files.length === 0) {
            return res.status(400).json({ error: "Name and at least one image are required" });
        }

        const results = await Promise.all(
            files.map((file, index) => {
                const publicId = files.length === 1 ? name : `${name}_${index + 1}`;
                return uploadToCloudinary(file.buffer, publicId, 'image', file.originalname);
            })
        );

        res.json({
            message: "Upload successful",
            files: results.map((r, i) => ({
                name:         files.length === 1 ? name : `${name}_${i + 1}`,
                originalName: files[i].originalname,   // ← original filename for download
                url:          r.secure_url,
                type:         'image'
            }))
        });

    } catch (error) {
        console.error('Image upload error:', error);
        res.status(500).json({ error: "Image upload failed" });
    }
});

// ─── POST /api/upload/pdf — Multi-PDF upload (up to 5 files, 15MB total) ─────
app.post('/api/upload/pdf', upload.array('pdfs', 5), async (req, res) => {
    try {
        const { name } = req.body;
        const files = req.files;

        if (!name || !files || files.length === 0) {
            return res.status(400).json({ error: "Name and at least one PDF are required" });
        }

        // Guard: total size across all PDFs must not exceed 15MB
        const totalSize = files.reduce((sum, f) => sum + f.size, 0);
        if (totalSize > 15 * 1024 * 1024) {
            return res.status(400).json({ error: "Total PDF size exceeds the 15MB limit" });
        }

        const results = await Promise.all(
            files.map((file, index) => {
                const originalExt = (file.originalname || '').split('.').pop().toLowerCase();
                const baseName    = files.length === 1 ? name : `${name}_${index + 1}`;
                // Bypass Cloudinary's PDF delivery block by appending .txt to the public_id
                const publicId    = (originalExt ? `${baseName}.${originalExt}` : baseName) + '.txt';
                return uploadToCloudinary(file.buffer, publicId, 'raw', file.originalname);
            })
        );

        res.json({
            message: "Upload successful",
            files: results.map((r, i) => {
                const originalExt = (files[i].originalname || '').split('.').pop().toLowerCase();
                const baseName    = files.length === 1 ? name : `${name}_${i + 1}`;
                // The filename users see won't have .txt, they just see baseName.
                // The backend proxy will still deliver it as a normal PDF.
                const publicId    = (originalExt ? `${baseName}.${originalExt}` : baseName) + '.txt';
                return {
                    name:         baseName,              // the key name shown to the user (e.g. "hell_1")
                    originalName: files[i].originalname, // original filename (e.g. "my-doc.pdf")
                    url:          r.secure_url,
                    type:         'file'
                };
            })
        });

    } catch (error) {
        console.error('PDF upload error:', error);
        res.status(500).json({ error: "PDF upload failed" });
    }
});

// ─── GET /api/download — Proxy download from Cloudinary (avoids CORS + MIME issues) ────
app.get('/api/download', async (req, res) => {
    const { url, filename } = req.query;
    if (!url) return res.status(400).json({ error: 'url query param is required' });

    let decodedUrl = decodeURIComponent(url);
    const safeFilename = (filename || 'download').replace(/[\"]/g, '');

    try {
        // Node 18+ built-in fetch follows redirects automatically
        const cloudRes = await fetch(decodedUrl);

        if (!cloudRes.ok) {
            console.error('Cloudinary responded with status:', cloudRes.status, 'for URL:', decodedUrl);
            return res.status(cloudRes.status).json({ error: 'File not found on Cloudinary' });
        }

        const contentType = cloudRes.headers.get('content-type') || 'application/octet-stream';

        res.set({
            'Content-Type':        contentType,
            'Content-Disposition': `attachment; filename="${safeFilename}"`,
            'Cache-Control':       'no-cache',
        });

        // Stream the body to the client
        const { Readable } = require('stream');
        Readable.fromWeb(cloudRes.body).pipe(res);

    } catch (err) {
        console.error('Proxy download error:', err);
        res.status(500).json({ error: 'Download failed' });
    }
});

// ─── GET /api/file-info — Get original filename from Cloudinary metadata ─────
// Used by the View tab to retrieve the original filename of any key-named file
app.get('/api/file-info', async (req, res) => {
    const { publicId, type } = req.query;
    if (!publicId) return res.status(400).json({ error: 'publicId required' });

    const resourceType = type === 'image' ? 'image' : 'raw';

    // Helper to look up one publicId
    const tryLookup = (pid) =>
        cloudinary.api.resource(pid, { resource_type: resourceType, context: true })
            .then(result => ({
                originalName: result.context?.custom?.original_filename || null,
                url: result.secure_url,
            }));

    try {
        // 1. Try the exact publicId first
        const result = await tryLookup(publicId);
        return res.json(result);
    } catch {
        // 2. For raw files the publicId stored on Cloudinary includes the extension.
        //    Try appending each common extension until one succeeds.
        //    *Also check the .txt suffixed version we use to bypass PDF blocking.
        if (resourceType === 'raw') {
            const exts = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv'];
            for (const ext of exts) {
                // Check both normal and the .txt fallback
                const candidates = [`${publicId}.${ext}`, `${publicId}.${ext}.txt`, `${publicId}.txt`];
                for (const candidate of candidates) {
                    try {
                        const result = await tryLookup(candidate);
                        return res.json(result);
                    } catch {
                        // keep trying
                    }
                }
            }
        }
        return res.status(404).json({ error: 'File not found', originalName: null });
    }
});

app.listen(process.env.PORT, () => {
    console.log(`Server running on http://localhost:${process.env.PORT}`);
});
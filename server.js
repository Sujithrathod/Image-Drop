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
const uploadToCloudinary = (buffer, publicId, resourceType = 'auto') => {
    return new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream(
            { public_id: publicId, resource_type: resourceType },
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
                return uploadToCloudinary(file.buffer, publicId, 'image');
            })
        );

        res.json({
            message: "Upload successful",
            files: results.map((r, i) => ({
                name: files.length === 1 ? name : `${name}_${i + 1}`,
                url: r.secure_url,
                type: 'image'
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
                const publicId = files.length === 1 ? name : `${name}_${index + 1}`;
                return uploadToCloudinary(file.buffer, publicId, 'raw');
            })
        );

        res.json({
            message: "Upload successful",
            files: results.map((r, i) => ({
                name: files.length === 1 ? name : `${name}_${i + 1}`,
                url: r.secure_url,
                type: 'pdf'
            }))
        });

    } catch (error) {
        console.error('PDF upload error:', error);
        res.status(500).json({ error: "PDF upload failed" });
    }
});

app.listen(process.env.PORT, () => {
    console.log(`Server running on http://localhost:${process.env.PORT}`);
});
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

const storage = multer.memoryStorage();
const upload = multer({ limits: { fileSize: 10 * 1024 * 1024 } }); //10 mb limit


app.post('/api/upload', upload.single('image'), async (req, res) => {
    try {
        const { name } = req.body;
        const fileBuffer = req.file.buffer;

        if (!name || !fileBuffer) {
            return res.status(400).json({ error: "Name and image are required" });
        }

        // Upload to Cloudinary using the user's name as the public_id
        const result = await new Promise((resolve, reject) => {
            cloudinary.uploader.upload_stream(
                {
                    public_id: name, // THIS IS THE MAGIC: Name becomes the URL
                    resource_type: 'auto'
                },
                (err, result) => {
                    if (err) reject(err);
                    else resolve(result);
                }
            ).end(fileBuffer);
        });

        res.json({
            message: "Upload successful",
            url: result.secure_url
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Upload failed" });
    }
});

module.exports = app;

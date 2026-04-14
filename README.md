# 📷 Image Drop

Share images using just a simple name — no sign-up, no links, no hassle.

Upload an image with a custom name, and anyone can view or download it using that name.

## 🌐 Live Demo

🔗 **[https://img-drop.vercel.app](https://img-drop.vercel.app/)**

## ✨ Features

- **Upload** images with a custom name (e.g., `vacation-2024`)
- **View / Download** images by entering the name
- **No sign-up** required — just upload and share the name
- **10MB** max file size
- Powered by **Cloudinary** for image storage

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React + Vite |
| **Backend** | Node.js + Express |
| **Storage** | Cloudinary |
| **Frontend Hosting** | Vercel |
| **Backend Hosting** | Render |

## 📁 Project Structure

```
image-drop/
├── server.js            # Express backend (API)
├── package.json         # Backend dependencies
├── .env                 # Environment variables (not committed)
└── frontend/
    ├── src/
    │   ├── App.jsx      # Main React component
    │   ├── App.css      # Styles
    │   └── main.jsx     # Entry point
    ├── package.json     # Frontend dependencies
    └── vite.config.js   # Vite configuration
```

## 🚀 Getting Started

### Prerequisites

- Node.js (v18+)
- A [Cloudinary](https://cloudinary.com/) account

### 1. Clone the repo

```bash
git clone https://github.com/Sujithrathod/Image-Drop.git
cd Image-Drop
```

### 2. Set up environment variables

Create a `.env` file in the root directory:

```env
PORT=5000
CLOUD_NAME=your_cloud_name
API_KEY=your_api_key
API_SECRET=your_api_secret
```

### 3. Install & run backend

```bash
npm install
npm start
```

### 4. Install & run frontend

```bash
cd frontend
npm install
npm run dev
```

The app will be running at `http://localhost:5173`

## 📄 License

ISC

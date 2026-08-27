# KhizerVideoPlus - Audio-Synced Screenshot Video Creator 🎬

KhizerVideoPlus is a web application and Python CLI video generation engine that automatically creates videos from **N screenshots/images** and **1 audio/voiceover file**. 

It detects the exact audio duration and splits the length evenly across all screenshots so each screenshot stays on screen for its assigned duration, resulting in a video matching the full audio length.

---

## ✨ Features

- ⏱ **Auto Audio Duration Sync**: Measures voiceover length down to milliseconds and splits duration across $N$ screenshots (`Duration / N`).
- 🛑 **No Default Zooming**: Static, high-clarity screenshots by default. Optional Ken Burns zoom/pan effect can be toggled ON if desired.
- 🎨 **Visual Customizations**:
  - **Transitions**: Crossfade, Fade to Black, Slide Left, or Instant Cut.
  - **Aspect Ratios**: 16:9 (YouTube), 9:16 (TikTok / Shorts / Reels), 1:1 (Social).
  - **Fit Modes**: Contain with blurred background, Crop & Cover, or Solid black bars.
  - **Subtitles & Captions**: Custom per-slide text overlays with high-contrast pill styling.
- 🚀 **1-Click Sample Demo**: Test out-of-the-box with synthesized audio and styled slides.
- 🖥 **Dual Engine**: Interactive Web App + Standalone Python CLI script (`render_video.py`).

---

## 🚀 Getting Started

### 1. Web Application
```bash
# Install dependencies
npm install

# Start Vite development server
npm run dev
```
Open `http://localhost:5173/` in your browser.

### 2. Python CLI Video Generator
```bash
# Install python requirements
pip install -r requirements.txt

# Run CLI video renderer
python render_video.py --audio voiceover.mp3 --images img1.png img2.png img3.png --output final_video.mp4

# Optionally enable zoom effect:
python render_video.py --audio voiceover.mp3 --images img1.png img2.png img3.png --zoom --output final_video.mp4
```

---

## 📜 License

**Proprietary & All Rights Reserved.**
Do not copy, modify, sell, resell, sublicense, or commercially exploit this software or any part thereof without prior written authorization from `almasumofficial98-dev`. See [LICENSE](./LICENSE) for full details.

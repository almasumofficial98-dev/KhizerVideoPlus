/**
 * KhizerVideoPlus - Main Application Controller
 */

import { AudioEngine } from './audioEngine.js';
import { TimelineEngine } from './timelineEngine.js';
import { RenderEngine } from './renderEngine.js';
import { VideoExporter } from './videoExporter.js';

class KhizerVideoPlusApp {
  constructor() {
    this.audioEngine = new AudioEngine();
    this.timelineEngine = new TimelineEngine();
    this.renderEngine = null;
    this.videoExporter = null;

    this.initDOM();
    this.initEngines();
    this.bindEvents();
    this.startPreviewLoop();
  }

  initDOM() {
    // Cache DOM Elements
    this.canvas = document.getElementById('videoCanvas');
    this.audioDropzone = document.getElementById('audioDropzone');
    this.audioFileInput = document.getElementById('audioFileInput');
    this.audioCard = document.getElementById('audioCard');
    this.audioName = document.getElementById('audioName');
    this.audioMeta = document.getElementById('audioMeta');

    this.imagesDropzone = document.getElementById('imagesDropzone');
    this.imagesFileInput = document.getElementById('imagesFileInput');
    this.slidesList = document.getElementById('slidesList');
    this.slideCountBadge = document.getElementById('slideCountBadge');

    this.timelineTrack = document.getElementById('timelineTrack');
    this.timelinePlayhead = document.getElementById('timelinePlayhead');
    this.timeDisplay = document.getElementById('timeDisplay');
    this.scrubber = document.getElementById('scrubber');
    
    this.playBtn = document.getElementById('playBtn');
    this.playBtnIcon = document.getElementById('playBtnIcon');
    this.sampleBtn = document.getElementById('sampleBtn');
    this.exportBtn = document.getElementById('exportBtn');

    // Controls
    this.presetSelect = document.getElementById('presetSelect');
    this.aspectSelect = document.getElementById('aspectSelect');
    this.kenBurnsToggle = document.getElementById('kenBurnsToggle');
    this.kenBurnsIntensity = document.getElementById('kenBurnsIntensity');
    this.transitionSelect = document.getElementById('transitionSelect');
    this.transitionDuration = document.getElementById('transitionDuration');
    this.fitModeSelect = document.getElementById('fitModeSelect');
    this.subtitleToggle = document.getElementById('subtitleToggle');

    // Export Modal
    this.exportModal = document.getElementById('exportModal');
    this.exportProgressVal = document.getElementById('exportProgressVal');
    this.exportProgressCircle = document.getElementById('exportProgressCircle');
    this.exportStatusText = document.getElementById('exportStatusText');
  }

  initEngines() {
    this.renderEngine = new RenderEngine(this.canvas);
    this.videoExporter = new VideoExporter(this.renderEngine, this.audioEngine, this.timelineEngine);

    // Sync audio playhead updates to timeline UI
    this.audioEngine.onPlayheadUpdate = (t) => {
      this.updatePlayheadUI(t);
    };

    this.audioEngine.onEnded = () => {
      this.playBtnIcon.innerHTML = `<path d="M8 5v14l11-7z" fill="currentColor"/>`;
    };
  }

  bindEvents() {
    // Audio Upload
    this.audioDropzone.addEventListener('click', () => this.audioFileInput.click());
    this.audioFileInput.addEventListener('change', (e) => this.handleAudioUpload(e.target.files[0]));
    this.setupDropzone(this.audioDropzone, (file) => this.handleAudioUpload(file));

    // Images Upload
    this.imagesDropzone.addEventListener('click', () => this.imagesFileInput.click());
    this.imagesFileInput.addEventListener('change', (e) => this.handleImagesUpload(e.target.files));
    this.setupDropzone(this.imagesDropzone, null, (files) => this.handleImagesUpload(files));

    // Playback Controls
    this.playBtn.addEventListener('click', () => this.togglePlay());
    this.scrubber.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      this.audioEngine.seek(val);
      this.updatePlayheadUI(val);
    });

    // Sample Demo Generator
    this.sampleBtn.addEventListener('click', () => this.loadSampleDemo());

    // Controls Binding
    this.presetSelect.addEventListener('change', (e) => {
      const presetKey = e.target.value;
      this.renderEngine.setPreset(presetKey);
      this.aspectSelect.value = this.renderEngine.currentAspect;
      this.showToast(`Selected Export Preset: ${this.renderEngine.presets[presetKey].name}`, 'info');
    });

    this.aspectSelect.addEventListener('change', (e) => {
      this.renderEngine.setAspectRatio(e.target.value);
    });
    this.kenBurnsToggle.addEventListener('change', (e) => {
      this.renderEngine.enableKenBurns = e.target.checked;
    });
    this.kenBurnsIntensity.addEventListener('input', (e) => {
      this.renderEngine.kenBurnsIntensity = parseFloat(e.target.value);
    });
    this.transitionSelect.addEventListener('change', (e) => {
      this.renderEngine.transitionType = e.target.value;
    });
    this.transitionDuration.addEventListener('input', (e) => {
      this.renderEngine.transitionDuration = parseFloat(e.target.value);
    });
    this.fitModeSelect.addEventListener('change', (e) => {
      this.renderEngine.fitMode = e.target.value;
    });
    this.subtitleToggle.addEventListener('change', (e) => {
      this.renderEngine.showSubtitles = e.target.checked;
    });

    // Export Button
    this.exportBtn.addEventListener('click', () => this.startExport());
  }

  setupDropzone(el, onFile, onFiles) {
    el.addEventListener('dragover', (e) => {
      e.preventDefault();
      el.classList.add('dragover');
    });
    el.addEventListener('dragleave', () => el.classList.remove('dragover'));
    el.addEventListener('drop', (e) => {
      e.preventDefault();
      el.classList.remove('dragover');
      if (onFiles && e.dataTransfer.files.length > 0) {
        onFiles(e.dataTransfer.files);
      } else if (onFile && e.dataTransfer.files.length > 0) {
        onFile(e.dataTransfer.files[0]);
      }
    });
  }

  async handleAudioUpload(file) {
    if (!file) return;
    try {
      this.showToast(`Decoding audio file: ${file.name}...`);
      const meta = await this.audioEngine.loadVoiceover(file);
      
      this.audioName.textContent = file.name;
      this.audioMeta.innerHTML = `
        <span>Duration: <strong>${meta.duration.toFixed(2)}s</strong></span>
        <span>Rate: <strong>${meta.sampleRate}Hz</strong></span>
      `;
      this.audioCard.style.display = 'flex';

      // Update Timeline Engine
      this.timelineEngine.setTotalDuration(meta.duration);
      this.scrubber.max = meta.duration;
      this.renderTimelineTracks();
      this.renderSlideList();
      this.showToast(`Audio loaded! Length: ${meta.duration.toFixed(2)} sec`, 'success');
    } catch (err) {
      console.error(err);
      this.showToast(`Failed to load audio file`, 'error');
    }
  }

  async handleImagesUpload(files) {
    if (!files || files.length === 0) return;
    const fileArray = Array.from(files);

    for (const file of fileArray) {
      if (file.type.startsWith('image/')) {
        const slide = this.timelineEngine.addSlide(file, file.name);
        // Preload Image
        const img = new Image();
        img.src = slide.src;
        await new Promise(r => img.onload = r);
        slide.img = img;
      }
    }

    this.renderSlideList();
    this.renderTimelineTracks();
    this.showToast(`Added ${fileArray.length} screenshots to timeline!`, 'success');
  }

  renderSlideList() {
    const slides = this.timelineEngine.getSlides();
    this.slideCountBadge.textContent = `${slides.length} Slides`;
    this.slidesList.innerHTML = '';

    if (slides.length === 0) {
      this.slidesList.innerHTML = `<div style="text-align: center; padding: 2rem; color: var(--text-muted); font-size: 0.85rem;">No screenshots added yet</div>`;
      return;
    }

    slides.forEach((slide, idx) => {
      const card = document.createElement('div');
      card.className = 'slide-card';
      card.innerHTML = `
        <div class="slide-num">#${idx + 1}</div>
        <img class="slide-thumb" src="${slide.src}" alt="${slide.name}" />
        <div class="slide-info">
          <div class="slide-filename">${slide.name}</div>
          <div class="slide-timing">${slide.startTime.toFixed(1)}s - ${slide.endTime.toFixed(1)}s (${slide.duration.toFixed(1)}s)</div>
          <input type="text" class="text-input" style="padding: 0.2rem 0.5rem; font-size: 0.75rem; margin-top: 0.3rem;" 
                 placeholder="Subtitle caption for slide #${idx + 1}" value="${slide.subtitle}" data-id="${slide.id}" />
        </div>
        <div class="slide-actions">
          <button class="icon-btn" title="Move Up" data-action="up" data-idx="${idx}">↑</button>
          <button class="icon-btn" title="Move Down" data-action="down" data-idx="${idx}">↓</button>
          <button class="icon-btn danger" title="Delete" data-action="del" data-id="${slide.id}">✕</button>
        </div>
      `;

      // Subtitle change event
      const subInput = card.querySelector('input');
      subInput.addEventListener('input', (e) => {
        this.timelineEngine.setSlideSubtitle(slide.id, e.target.value);
      });

      // Actions
      card.querySelectorAll('.icon-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const action = btn.dataset.action;
          if (action === 'up' && idx > 0) {
            this.timelineEngine.moveSlide(idx, idx - 1);
          } else if (action === 'down' && idx < slides.length - 1) {
            this.timelineEngine.moveSlide(idx, idx + 1);
          } else if (action === 'del') {
            this.timelineEngine.removeSlide(slide.id);
          }
          this.renderSlideList();
          this.renderTimelineTracks();
        });
      });

      this.slidesList.appendChild(card);
    });
  }

  renderTimelineTracks() {
    const slides = this.timelineEngine.getSlides();
    const total = this.timelineEngine.totalDuration;
    this.timelineTrack.innerHTML = '';

    if (slides.length === 0 || total <= 0) return;

    slides.forEach((slide, idx) => {
      const pct = (slide.duration / total) * 100;
      const seg = document.createElement('div');
      seg.className = 'timeline-segment';
      seg.style.width = `${pct}%`;
      seg.title = `Slide #${idx + 1}: ${slide.duration.toFixed(1)}s`;
      seg.textContent = `Slide #${idx + 1} (${slide.duration.toFixed(1)}s)`;
      this.timelineTrack.appendChild(seg);
    });
  }

  togglePlay() {
    if (this.timelineEngine.totalDuration <= 0) {
      this.showToast('Please upload an audio file first!', 'warning');
      return;
    }

    if (this.audioEngine.isPlaying) {
      this.audioEngine.pause();
      this.playBtnIcon.innerHTML = `<path d="M8 5v14l11-7z" fill="currentColor"/>`;
    } else {
      this.audioEngine.play();
      this.playBtnIcon.innerHTML = `<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" fill="currentColor"/>`;
    }
  }

  updatePlayheadUI(t) {
    const total = this.timelineEngine.totalDuration;
    this.scrubber.value = t;

    const currentFormatted = this.formatTime(t);
    const totalFormatted = this.formatTime(total);
    this.timeDisplay.textContent = `${currentFormatted} / ${totalFormatted}`;

    if (total > 0) {
      const pct = (t / total) * 100;
      this.timelinePlayhead.style.left = `${pct}%`;
    }
  }

  startPreviewLoop() {
    const render = () => {
      const currentTime = this.audioEngine.getCurrentTime();
      const timelineState = this.timelineEngine.getSlideAtTime(currentTime, this.renderEngine.transitionDuration);
      this.renderEngine.drawFrame(timelineState);
      requestAnimationFrame(render);
    };
    requestAnimationFrame(render);
  }

  async startExport() {
    if (this.timelineEngine.totalDuration <= 0) {
      this.showToast('Upload audio before exporting!', 'warning');
      return;
    }
    if (this.timelineEngine.getSlides().length === 0) {
      this.showToast('Add at least 1 screenshot before exporting!', 'warning');
      return;
    }

    // Stop active audio preview
    this.audioEngine.pause();

    // Show Export Modal
    this.exportModal.classList.add('active');
    this.exportProgressVal.textContent = '0%';
    this.exportStatusText.textContent = 'Encoding video matching exact audio duration...';

    try {
      const result = await this.videoExporter.exportVideo({
        fps: 30,
        onProgress: (pct) => {
          this.exportProgressVal.textContent = `${pct}%`;
          const offset = 283 - (283 * pct / 100);
          this.exportProgressCircle.style.strokeDashoffset = offset;
        }
      });

      // Trigger Browser Download
      const url = URL.createObjectURL(result.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.filename;
      a.click();
      URL.revokeObjectURL(url);

      this.exportStatusText.textContent = 'Export Complete! Video downloaded.';
      this.showToast('Video export successful!', 'success');

      setTimeout(() => {
        this.exportModal.classList.remove('active');
      }, 1500);

    } catch (err) {
      console.error(err);
      this.exportStatusText.textContent = 'Export failed. ' + err.message;
      this.showToast('Video export failed', 'error');
      setTimeout(() => {
        this.exportModal.classList.remove('active');
      }, 3000);
    }
  }

  /**
   * Generates a 1-click synthetic demo (Audio tone + 4 styled screenshots) for instant out-of-the-box testing!
   */
  async loadSampleDemo() {
    this.showToast('Generating 1-click sample audio & screenshots demo...');
    
    // 1. Generate 12-second synthetic voice audio buffer using WebAudio API
    const sampleRate = 44100;
    const duration = 12.0; // 12 seconds
    const numSamples = sampleRate * duration;
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const audioBuffer = ctx.createBuffer(1, numSamples, sampleRate);
    const channel = audioBuffer.getChannelData(0);

    // Synthesize pleasant voice-like melodic chords
    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      const baseFreq = 220 + Math.sin(t * 2) * 50;
      const env = Math.min(1, Math.sin((t / duration) * Math.PI) * 1.5);
      channel[i] = (Math.sin(2 * Math.PI * baseFreq * t) * 0.4 +
                    Math.sin(2 * Math.PI * baseFreq * 1.5 * t) * 0.2) * env;
    }

    this.audioEngine.voiceBuffer = audioBuffer;
    this.audioEngine.voiceDuration = duration;
    this.audioEngine.pauseOffset = 0;

    this.audioName.textContent = 'Sample_Voiceover_12s.wav';
    this.audioMeta.innerHTML = `<span>Duration: <strong>12.00s</strong></span> <span>Rate: <strong>44100Hz</strong></span>`;
    this.audioCard.style.display = 'flex';

    this.timelineEngine.setTotalDuration(duration);
    this.scrubber.max = duration;

    // 2. Generate 4 styled screenshot canvases
    const colors = [
      { bg: ['#4f46e5', '#a855f7'], title: '1. Project Overview & Specs', sub: 'Calculates total audio duration' },
      { bg: ['#06b6d4', '#3b82f6'], title: '2. Duration Auto-Splitting', sub: 'Distributes audio length across N slides' },
      { bg: ['#10b981', '#059669'], title: '3. Visual Effects & Motion', sub: 'Ken Burns zoom, pan & crossfades' },
      { bg: ['#f59e0b', '#ef4444'], title: '4. Final Video Export', sub: 'Matches full audio length perfectly' }
    ];

    this.timelineEngine.slides = []; // Clear existing

    for (let i = 0; i < colors.length; i++) {
      const c = colors[i];
      const sampleCanvas = document.createElement('canvas');
      sampleCanvas.width = 1280;
      sampleCanvas.height = 720;
      const sCtx = sampleCanvas.getContext('2d');

      // Gradient background
      const grad = sCtx.createLinearGradient(0, 0, 1280, 720);
      grad.addColorStop(0, c.bg[0]);
      grad.addColorStop(1, c.bg[1]);
      sCtx.fillStyle = grad;
      sCtx.fillRect(0, 0, 1280, 720);

      // Card box
      sCtx.fillStyle = 'rgba(10, 12, 20, 0.65)';
      sCtx.roundRect(140, 140, 1000, 440, 32);
      sCtx.fill();

      // Title
      sCtx.font = '800 48px "Outfit", sans-serif';
      sCtx.fillStyle = '#ffffff';
      sCtx.textAlign = 'center';
      sCtx.fillText(c.title, 640, 320);

      // Subtitle
      sCtx.font = '500 28px "Outfit", sans-serif';
      sCtx.fillStyle = '#94a3b8';
      sCtx.fillText(c.sub, 640, 400);

      const dataUrl = sampleCanvas.toDataURL('image/png');
      const slide = this.timelineEngine.addSlide(dataUrl, `Screenshot_${i + 1}.png`);
      slide.subtitle = c.sub;

      const img = new Image();
      img.src = dataUrl;
      await new Promise(r => img.onload = r);
      slide.img = img;
    }

    this.renderSlideList();
    this.renderTimelineTracks();
    this.showToast('Sample Demo Loaded! 12s Audio divided into 4 screenshots (3.0s each). Press Play!', 'success');
  }

  formatTime(secs) {
    if (!secs || isNaN(secs)) return '00:00';
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = Math.floor(secs % 60).toString().padStart(2, '0');
    const ms = Math.floor((secs % 1) * 10).toString();
    return `${m}:${s}.${ms}`;
  }

  showToast(msg, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.style.borderLeftColor = type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : '#6366f1';
    toast.innerHTML = `<span>${msg}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
  }
}

// Initialize App when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.app = new KhizerVideoPlusApp();
});

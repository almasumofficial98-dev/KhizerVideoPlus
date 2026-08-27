/**
 * KhizerVideoPlus - Main Wizard Application Controller
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

    this.currentStep = 1;
    this.selectedPreset = 'youtube';

    this.initDOM();
    this.initEngines();
    this.bindEvents();
    this.startPreviewLoop();
  }

  initDOM() {
    // Canvas & Preview
    this.canvas = document.getElementById('videoCanvas');

    // Stepper Navigation Elements
    this.stepItems = document.querySelectorAll('.step-item');
    this.wizardSteps = document.querySelectorAll('.wizard-step');

    // Step 1 Elements
    this.scaleCards = document.querySelectorAll('.scale-card');
    this.toStep2Btn = document.getElementById('toStep2Btn');

    // Step 2 Elements
    this.audioDropzone = document.getElementById('audioDropzone');
    this.audioFileInput = document.getElementById('audioFileInput');
    this.audioCard = document.getElementById('audioCard');
    this.audioName = document.getElementById('audioName');
    this.audioMeta = document.getElementById('audioMeta');
    this.reuploadAudioBtn = document.getElementById('reuploadAudioBtn');
    this.backToStep1Btn = document.getElementById('backToStep1Btn');
    this.toStep3Btn = document.getElementById('toStep3Btn');

    // Step 3 Elements
    this.imagesDropzone = document.getElementById('imagesDropzone');
    this.imagesFileInput = document.getElementById('imagesFileInput');
    this.slidesList = document.getElementById('slidesList');
    this.slideCountBadge = document.getElementById('slideCountBadge');
    this.backToStep2Btn = document.getElementById('backToStep2Btn');
    this.toStep4Btn = document.getElementById('toStep4Btn');

    // Step 4 Elements
    this.activePresetBadge = document.getElementById('activePresetBadge');
    this.timelineTrack = document.getElementById('timelineTrack');
    this.timelinePlayhead = document.getElementById('timelinePlayhead');
    this.timeDisplay = document.getElementById('timeDisplay');
    this.scrubber = document.getElementById('scrubber');
    
    this.playBtn = document.getElementById('playBtn');
    this.playBtnIcon = document.getElementById('playBtnIcon');
    this.sampleBtn = document.getElementById('sampleBtn');
    this.exportBtn = document.getElementById('exportBtn');
    this.backToStep3Btn = document.getElementById('backToStep3Btn');

    // Tweak Settings
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

    this.audioEngine.onPlayheadUpdate = (t) => {
      this.updatePlayheadUI(t);
    };

    this.audioEngine.onEnded = () => {
      this.playBtnIcon.innerHTML = `<path d="M8 5v14l11-7z" fill="currentColor"/>`;
    };
  }

  bindEvents() {
    // Step 1: Scale Card Selection
    this.scaleCards.forEach(card => {
      card.addEventListener('click', () => {
        this.scaleCards.forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        this.selectedPreset = card.dataset.preset;
        this.renderEngine.setPreset(this.selectedPreset);
      });
    });

    // Wizard Navigation Buttons
    this.toStep2Btn.addEventListener('click', () => this.goToStep(2));
    this.backToStep1Btn.addEventListener('click', () => this.goToStep(1));

    this.toStep3Btn.addEventListener('click', () => this.goToStep(3));
    this.backToStep2Btn.addEventListener('click', () => this.goToStep(2));

    this.toStep4Btn.addEventListener('click', () => this.goToStep(4));
    this.backToStep3Btn.addEventListener('click', () => this.goToStep(3));

    // Audio Upload
    this.audioDropzone.addEventListener('click', () => this.audioFileInput.click());
    if (this.reuploadAudioBtn) {
      this.reuploadAudioBtn.addEventListener('click', () => this.audioFileInput.click());
    }
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
    this.transitionSelect.addEventListener('change', (e) => {
      this.renderEngine.transitionType = e.target.value;
    });
    this.fitModeSelect.addEventListener('change', (e) => {
      this.renderEngine.fitMode = e.target.value;
    });
    this.kenBurnsToggle.addEventListener('change', (e) => {
      this.renderEngine.enableKenBurns = e.target.checked;
    });
    this.subtitleToggle.addEventListener('change', (e) => {
      this.renderEngine.showSubtitles = e.target.checked;
    });

    // Export Button
    this.exportBtn.addEventListener('click', () => this.startExport());
  }

  goToStep(stepNum) {
    this.currentStep = stepNum;

    // Update Wizard Steps visibility
    this.wizardSteps.forEach((step, idx) => {
      if (idx + 1 === stepNum) {
        step.classList.add('active');
      } else {
        step.classList.remove('active');
      }
    });

    // Update Stepper Navigation Bar
    this.stepItems.forEach((item, idx) => {
      const stepIdx = idx + 1;
      item.classList.remove('active', 'completed');
      if (stepIdx === stepNum) {
        item.classList.add('active');
      } else if (stepIdx < stepNum) {
        item.classList.add('completed');
      }
    });

    // Update Step 4 preset badge
    if (stepNum === 4) {
      const presetInfo = this.renderEngine.presets[this.selectedPreset] || { name: 'YouTube (16:9)' };
      this.activePresetBadge.textContent = presetInfo.name;
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
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
      this.audioDropzone.style.display = 'none';

      // Update Timeline Engine
      this.timelineEngine.setTotalDuration(meta.duration);
      this.scrubber.max = meta.duration;
      this.renderTimelineTracks();
      this.renderSlideList();

      // Enable Step 2 -> Step 3 button
      this.toStep3Btn.disabled = false;
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
        const img = new Image();
        img.src = slide.src;
        await new Promise(r => img.onload = r);
        slide.img = img;
      }
    }

    this.renderSlideList();
    this.renderTimelineTracks();

    if (this.timelineEngine.getSlides().length > 0) {
      this.toStep4Btn.disabled = false;
    }

    this.showToast(`Added ${fileArray.length} screenshots to timeline!`, 'success');
  }

  renderSlideList() {
    const slides = this.timelineEngine.getSlides();
    this.slideCountBadge.textContent = `${slides.length} Pictures Uploaded`;
    this.slidesList.innerHTML = '';

    if (slides.length === 0) {
      this.slidesList.innerHTML = `<div style="text-align: center; padding: 2rem; color: var(--text-muted); font-size: 0.85rem;">No screenshots uploaded yet</div>`;
      this.toStep4Btn.disabled = true;
      return;
    }

    this.toStep4Btn.disabled = false;

    slides.forEach((slide, idx) => {
      const card = document.createElement('div');
      card.className = 'slide-card';
      card.innerHTML = `
        <div class="slide-num">#${idx + 1}</div>
        <img class="slide-thumb" src="${slide.src}" alt="${slide.name}" />
        <div class="slide-info">
          <div class="slide-filename">${slide.name}</div>
          <div class="slide-timing">${slide.startTime.toFixed(1)}s - ${slide.endTime.toFixed(1)}s (${slide.duration.toFixed(1)}s duration)</div>
          <input type="text" class="text-input" style="padding: 0.2rem 0.5rem; font-size: 0.75rem; margin-top: 0.3rem;" 
                 placeholder="Subtitle caption for picture #${idx + 1}" value="${slide.subtitle}" data-id="${slide.id}" />
        </div>
        <div class="slide-actions">
          <button class="icon-btn" title="Move Up" data-action="up" data-idx="${idx}">↑</button>
          <button class="icon-btn" title="Move Down" data-action="down" data-idx="${idx}">↓</button>
          <button class="icon-btn danger" title="Delete" data-action="del" data-id="${slide.id}">✕</button>
        </div>
      `;

      const subInput = card.querySelector('input');
      subInput.addEventListener('input', (e) => {
        this.timelineEngine.setSlideSubtitle(slide.id, e.target.value);
      });

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
      seg.title = `Pic #${idx + 1}: ${slide.duration.toFixed(1)}s`;
      seg.textContent = `Pic #${idx + 1} (${slide.duration.toFixed(1)}s)`;
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

    this.audioEngine.pause();

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
   * Generates a 1-click synthetic demo (Audio tone + 4 styled screenshots) for instant testing!
   */
  async loadSampleDemo() {
    this.showToast('Generating 1-click sample demo...');
    
    // Synthesize audio
    const sampleRate = 44100;
    const duration = 12.0;
    const numSamples = sampleRate * duration;
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const audioBuffer = ctx.createBuffer(1, numSamples, sampleRate);
    const channel = audioBuffer.getChannelData(0);

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
    this.audioDropzone.style.display = 'none';

    this.timelineEngine.setTotalDuration(duration);
    this.scrubber.max = duration;

    // Generate 4 sample screenshot canvases
    const colors = [
      { bg: ['#4f46e5', '#a855f7'], title: '1. Select Output Scale', sub: 'YouTube, Shorts, Mobile Status, or Square' },
      { bg: ['#06b6d4', '#3b82f6'], title: '2. Upload Voiceover Audio', sub: 'System detects exact audio duration' },
      { bg: ['#10b981', '#059669'], title: '3. Upload N Screenshots', sub: 'Audio duration splits equally per slide' },
      { bg: ['#f59e0b', '#ef4444'], title: '4. Preview & Export MP4', sub: 'Check playback before exporting final MP4' }
    ];

    this.timelineEngine.slides = [];

    for (let i = 0; i < colors.length; i++) {
      const c = colors[i];
      const sampleCanvas = document.createElement('canvas');
      sampleCanvas.width = 1280;
      sampleCanvas.height = 720;
      const sCtx = sampleCanvas.getContext('2d');

      const grad = sCtx.createLinearGradient(0, 0, 1280, 720);
      grad.addColorStop(0, c.bg[0]);
      grad.addColorStop(1, c.bg[1]);
      sCtx.fillStyle = grad;
      sCtx.fillRect(0, 0, 1280, 720);

      sCtx.fillStyle = 'rgba(10, 12, 20, 0.65)';
      sCtx.roundRect(140, 140, 1000, 440, 32);
      sCtx.fill();

      sCtx.font = '800 48px "Outfit", sans-serif';
      sCtx.fillStyle = '#ffffff';
      sCtx.textAlign = 'center';
      sCtx.fillText(c.title, 640, 320);

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
    this.toStep3Btn.disabled = false;
    this.toStep4Btn.disabled = false;

    // Go directly to Step 4 Preview Screen!
    this.goToStep(4);
    this.showToast('Sample Demo Loaded! 12s Audio divided into 4 screenshots (3.0s each).', 'success');
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

document.addEventListener('DOMContentLoaded', () => {
  window.app = new KhizerVideoPlusApp();
});

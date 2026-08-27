/**
 * KhizerVideoPlus - Render Engine
 * HTML5 Canvas rendering engine supporting Ken Burns zoom/pan, crossfades/transitions, aspect ratio fits, and subtitles.
 */

export class RenderEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    // Preset Aspect Ratios
    this.aspectRatios = {
      '16:9': { width: 1920, height: 1080 },
      '9:16': { width: 1080, height: 1920 },
      '1:1':  { width: 1080, height: 1080 }
    };

    this.currentAspect = '16:9';
    this.canvasWidth = 1920;
    this.canvasHeight = 1080;

    // Render Options
    this.enableKenBurns = false; // Disabled by default; user can toggle ON if desired
    this.kenBurnsIntensity = 0.15; // 15% zoom
    this.transitionType = 'crossfade'; // 'crossfade', 'fade-black', 'slide', 'cut'
    this.transitionDuration = 0.6; // 0.6 seconds
    this.fitMode = 'contain-blur'; // 'contain-blur', 'cover', 'contain-black'
    this.showSubtitles = true;
    this.subtitleFontSize = 42;

    this.updateCanvasResolution();
  }

  setAspectRatio(aspectKey) {
    if (this.aspectRatios[aspectKey]) {
      this.currentAspect = aspectKey;
      this.updateCanvasResolution();
    }
  }

  updateCanvasResolution() {
    const dim = this.aspectRatios[this.currentAspect];
    this.canvasWidth = dim.width;
    this.canvasHeight = dim.height;
    this.canvas.width = dim.width;
    this.canvas.height = dim.height;
  }

  /**
   * Main frame draw method called on every timestamp tick
   * @param {Object} timelineState - output of timelineEngine.getSlideAtTime(timestamp)
   */
  drawFrame(timelineState) {
    if (!timelineState || !timelineState.currentSlide) {
      this.drawPlaceholder();
      return;
    }

    const { currentSlide, nextSlide, slideProgress, transitionProgress, isTransitioning } = timelineState;
    const ctx = this.ctx;

    // Clear Canvas
    ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);

    if (!isTransitioning || this.transitionType === 'cut' || !nextSlide) {
      // Single slide rendering
      this.drawSlide(currentSlide, slideProgress, 1.0);
    } else {
      // Transition rendering
      switch (this.transitionType) {
        case 'crossfade':
          // Render current slide fading out, next slide fading in
          this.drawSlide(currentSlide, slideProgress, 1.0);
          this.drawSlide(nextSlide, 0, transitionProgress);
          break;

        case 'fade-black':
          if (transitionProgress < 0.5) {
            const alpha = 1 - (transitionProgress * 2);
            this.drawSlide(currentSlide, slideProgress, alpha);
          } else {
            const alpha = (transitionProgress - 0.5) * 2;
            this.drawSlide(nextSlide, 0, alpha);
          }
          break;

        case 'slide':
          // Slide left transition
          ctx.save();
          const offsetX = transitionProgress * this.canvasWidth;
          
          // Draw Current Slide moving left
          ctx.save();
          ctx.translate(-offsetX, 0);
          this.drawSlide(currentSlide, slideProgress, 1.0);
          ctx.restore();

          // Draw Next Slide entering from right
          ctx.save();
          ctx.translate(this.canvasWidth - offsetX, 0);
          this.drawSlide(nextSlide, 0, 1.0);
          ctx.restore();

          ctx.restore();
          break;

        default:
          this.drawSlide(currentSlide, slideProgress, 1.0);
      }
    }

    // Draw Subtitles on top if enabled
    if (this.showSubtitles) {
      const activeSlide = isTransitioning && transitionProgress > 0.5 ? nextSlide : currentSlide;
      if (activeSlide && activeSlide.subtitle) {
        this.drawSubtitleText(activeSlide.subtitle);
      }
    }
  }

  /**
   * Draws a single slide image onto canvas with scaling, placement, and optional Ken Burns zoom
   */
  drawSlide(slide, progress, globalAlpha = 1.0) {
    if (!slide || !slide.img || !slide.img.complete) return;

    const ctx = this.ctx;
    const img = slide.img;
    const imgW = img.naturalWidth || img.width;
    const imgH = img.naturalHeight || img.height;

    ctx.save();
    ctx.globalAlpha = globalAlpha;

    // Background blur box for contain-blur mode
    if (this.fitMode === 'contain-blur') {
      ctx.save();
      ctx.filter = 'blur(30px) brightness(0.6)';
      ctx.drawImage(img, -50, -50, this.canvasWidth + 100, this.canvasHeight + 100);
      ctx.restore();
    } else {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);
    }

    // Compute Ken Burns scale and translation
    let scale = 1.0;
    let translateX = 0;
    let translateY = 0;

    if (this.enableKenBurns) {
      // Alternate zoom-in and subtle panning directions per slide index
      const seed = Math.abs(this.hashString(slide.id || 'slide')) % 4;
      const intensity = this.kenBurnsIntensity;

      switch (seed) {
        case 0: // Zoom in center
          scale = 1.0 + (progress * intensity);
          break;
        case 1: // Zoom out center
          scale = (1.0 + intensity) - (progress * intensity);
          break;
        case 2: // Zoom in & Pan right
          scale = 1.0 + (progress * intensity);
          translateX = (progress * 40);
          break;
        case 3: // Zoom in & Pan down
          scale = 1.0 + (progress * intensity);
          translateY = (progress * 40);
          break;
      }
    }

    // Fit image inside canvas while maintaining aspect ratio
    let drawW, drawH, drawX, drawY;

    if (this.fitMode === 'cover') {
      const imgAspect = imgW / imgH;
      const canvasAspect = this.canvasWidth / this.canvasHeight;
      if (imgAspect > canvasAspect) {
        drawH = this.canvasHeight;
        drawW = drawH * imgAspect;
      } else {
        drawW = this.canvasWidth;
        drawH = drawW / imgAspect;
      }
    } else {
      // contain mode
      const scaleFit = Math.min(this.canvasWidth / imgW, this.canvasHeight / imgH);
      drawW = imgW * scaleFit;
      drawH = imgH * scaleFit;
    }

    drawX = (this.canvasWidth - drawW) / 2;
    drawY = (this.canvasHeight - drawH) / 2;

    // Apply Ken Burns Transform matrix centered on canvas
    ctx.translate(this.canvasWidth / 2 + translateX, this.canvasHeight / 2 + translateY);
    ctx.scale(scale, scale);
    ctx.translate(-this.canvasWidth / 2, -this.canvasHeight / 2);

    // Draw Image
    ctx.drawImage(img, drawX, drawY, drawW, drawH);

    ctx.restore();
  }

  /**
   * Draw Subtitles text overlay at bottom of video canvas
   */
  drawSubtitleText(text) {
    if (!text || text.trim() === '') return;

    const ctx = this.ctx;
    ctx.save();

    const fontSize = this.subtitleFontSize;
    ctx.font = `600 ${fontSize}px "Outfit", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const paddingX = 30;
    const paddingY = 16;
    const marginBottom = 80;

    const textWidth = ctx.measureText(text).width;
    const boxW = Math.min(textWidth + paddingX * 2, this.canvasWidth - 80);
    const boxH = fontSize + paddingY * 2;
    const boxX = (this.canvasWidth - boxW) / 2;
    const boxY = this.canvasHeight - marginBottom - boxH;

    // Dark glass pill background
    ctx.fillStyle = 'rgba(10, 12, 20, 0.85)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 2;

    this.drawRoundedRect(ctx, boxX, boxY, boxW, boxH, 16);
    ctx.fill();
    ctx.stroke();

    // High contrast white text with soft shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#ffffff';

    ctx.fillText(text, this.canvasWidth / 2, boxY + boxH / 2, boxW - paddingX);

    ctx.restore();
  }

  drawPlaceholder() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);

    ctx.fillStyle = '#121624';
    ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);

    ctx.font = '700 36px "Outfit", sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.textAlign = 'center';
    ctx.fillText('Upload Audio & Screenshots to Preview Video', this.canvasWidth / 2, this.canvasHeight / 2 - 20);

    ctx.font = '500 20px "Outfit", sans-serif';
    ctx.fillStyle = '#475569';
    ctx.fillText('Audio length will automatically split across screenshots', this.canvasWidth / 2, this.canvasHeight / 2 + 25);
  }

  drawRoundedRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return hash;
  }
}

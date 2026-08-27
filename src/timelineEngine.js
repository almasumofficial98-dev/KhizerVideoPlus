/**
 * KhizerVideoPlus - Timeline Engine
 * Calculates timeline split across N screenshots for precise audio alignment.
 */

export class TimelineEngine {
  constructor() {
    this.totalDuration = 0; // Total Audio Duration in seconds
    this.slides = []; // Array of Slide Objects

    // Optional Intro Black Title Screen
    this.introText = '';
    this.introSubtitle = '';
    this.introDuration = 0; // In seconds (0 = disabled)
  }

  /**
   * Set total audio duration and re-calculate slide durations
   * @param {number} duration 
   */
  setTotalDuration(duration) {
    this.totalDuration = Math.max(0, duration);
    this.recalculateTimings();
  }

  /**
   * Add image file or URL to timeline
   * @param {File|string} fileOrUrl 
   * @param {string} name 
   * @param {HTMLImageElement} imgElement 
   */
  addSlide(fileOrUrl, name = 'Slide', imgElement = null) {
    const id = 'slide_' + Math.random().toString(36).substr(2, 9);
    const slide = {
      id,
      name,
      src: typeof fileOrUrl === 'string' ? fileOrUrl : URL.createObjectURL(fileOrUrl),
      file: fileOrUrl instanceof File ? fileOrUrl : null,
      img: imgElement,
      customWeight: 1.0, // Default equal weight
      subtitle: '', // Optional per-slide caption/subtitle
      startTime: 0,
      endTime: 0,
      duration: 0
    };

    if (!slide.img) {
      const img = new Image();
      img.src = slide.src;
      slide.img = img;
    }

    this.slides.push(slide);
    this.recalculateTimings();
    return slide;
  }

  /**
   * Remove a slide by ID
   * @param {string} slideId 
   */
  removeSlide(slideId) {
    const index = this.slides.findIndex(s => s.id === slideId);
    if (index !== -1) {
      const removed = this.slides.splice(index, 1)[0];
      if (removed.file && removed.src) {
        URL.revokeObjectURL(removed.src);
      }
      this.recalculateTimings();
    }
  }

  /**
   * Reorder slide from index to target index
   * @param {number} fromIndex 
   * @param {number} toIndex 
   */
  moveSlide(fromIndex, toIndex) {
    if (fromIndex < 0 || fromIndex >= this.slides.length || toIndex < 0 || toIndex >= this.slides.length) {
      return;
    }
    const [moved] = this.slides.splice(fromIndex, 1);
    this.slides.splice(toIndex, 0, moved);
    this.recalculateTimings();
  }

  /**
   * Set custom weight for a slide (for custom duration weighting)
   */
  setSlideWeight(slideId, weight) {
    const slide = this.slides.find(s => s.id === slideId);
    if (slide) {
      slide.customWeight = Math.max(0.1, weight);
      this.recalculateTimings();
    }
  }

  setSlideSubtitle(slideId, subtitle) {
    const slide = this.slides.find(s => s.id === slideId);
    if (slide) {
      slide.subtitle = subtitle;
    }
  }

  setIntroScreen(text, subtitle = '', duration = 2.5) {
    this.introText = text || '';
    this.introSubtitle = subtitle || '';
    this.introDuration = (this.introText.trim().length > 0 && duration > 0) ? Math.max(0, duration) : 0;
    this.recalculateTimings();
  }

  /**
   * Recalculates start_time, end_time, and duration for every slide
   */
  recalculateTimings() {
    if (this.slides.length === 0 || this.totalDuration <= 0) {
      this.slides.forEach(s => {
        s.startTime = 0;
        s.endTime = 0;
        s.duration = 0;
      });
      return;
    }

    const effectiveIntroDur = Math.min(this.introDuration, this.totalDuration * 0.4); // max 40% of total
    const availableDur = Math.max(0.1, this.totalDuration - effectiveIntroDur);

    const totalWeight = this.slides.reduce((acc, s) => acc + s.customWeight, 0);
    let currentTime = effectiveIntroDur;

    this.slides.forEach((slide, idx) => {
      slide.startTime = currentTime;
      if (idx === this.slides.length - 1) {
        slide.endTime = this.totalDuration;
      } else {
        const slideDur = (availableDur * (slide.customWeight / totalWeight));
        slide.endTime = currentTime + slideDur;
      }
      slide.duration = slide.endTime - slide.startTime;
      currentTime = slide.endTime;
    });
  }

  /**
   * Get active slide and slide transition progress for any timestamp t
   */
  getSlideAtTime(timestamp, transitionDuration = 0.5) {
    if (this.slides.length === 0) return null;

    const t = Math.max(0, Math.min(timestamp, this.totalDuration));

    const effectiveIntroDur = Math.min(this.introDuration, this.totalDuration * 0.4);

    // Check if timestamp is inside Intro Title Screen
    if (effectiveIntroDur > 0 && t < effectiveIntroDur && this.introText.trim().length > 0) {
      const introProgress = t / effectiveIntroDur;
      let nextSlide = null;
      let transitionProgress = 0;

      if (effectiveIntroDur - t <= transitionDuration && this.slides.length > 0) {
        nextSlide = this.slides[0];
        transitionProgress = 1 - ((effectiveIntroDur - t) / transitionDuration);
      }

      return {
        isIntro: true,
        introText: this.introText,
        introSubtitle: this.introSubtitle,
        introProgress,
        currentSlide: null,
        currentIndex: -1,
        nextSlide,
        slideProgress: 0,
        transitionProgress,
        isTransitioning: nextSlide !== null
      };
    }

    // Find current screenshot slide
    let currentIndex = this.slides.findIndex(s => t >= s.startTime && t <= s.endTime);
    if (currentIndex === -1) {
      currentIndex = t >= this.totalDuration ? this.slides.length - 1 : 0;
    }

    const currentSlide = this.slides[currentIndex];
    const slideProgress = currentSlide.duration > 0 
      ? (t - currentSlide.startTime) / currentSlide.duration 
      : 0;

    let nextSlide = null;
    let transitionProgress = 0;

    if (currentIndex < this.slides.length - 1) {
      const timeUntilEnd = currentSlide.endTime - t;
      if (timeUntilEnd <= transitionDuration && transitionDuration > 0) {
        nextSlide = this.slides[currentIndex + 1];
        transitionProgress = 1 - (timeUntilEnd / transitionDuration);
      }
    }

    return {
      isIntro: false,
      currentSlide,
      currentIndex,
      nextSlide,
      slideProgress,
      transitionProgress,
      isTransitioning: nextSlide !== null
    };
  }

  getSlides() {
    return this.slides;
  }
}

/**
 * KhizerVideoPlus - Audio Engine
 * Handles precise audio decoding, duration measurement, WebAudio API playback sync, and BGM track mixing.
 */

export class AudioEngine {
  constructor() {
    this.audioCtx = null;
    this.voiceBuffer = null;
    this.bgmBuffer = null;
    this.voiceSource = null;
    this.bgmSource = null;
    this.destinationNode = null;
    this.voiceGainNode = null;
    this.bgmGainNode = null;
    
    this.voiceDuration = 0;
    this.startTime = 0;
    this.pauseOffset = 0;
    this.isPlaying = false;
    
    this.voiceVolume = 1.0;
    this.bgmVolume = 0.2;
    
    this.onPlayheadUpdate = null;
    this.onEnded = null;
    this._animFrameReq = null;
  }

  initContext() {
    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioCtxClass();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  /**
   * Decode uploaded voiceover audio file
   * @param {File|ArrayBuffer} fileOrBuffer 
   * @returns {Promise<{ duration: number, sampleRate: number }>}
   */
  async loadVoiceover(fileOrBuffer) {
    this.initContext();
    const arrayBuffer = fileOrBuffer instanceof File ? await fileOrBuffer.arrayBuffer() : fileOrBuffer;
    this.voiceBuffer = await this.audioCtx.decodeAudioData(arrayBuffer);
    this.voiceDuration = this.voiceBuffer.duration;
    this.pauseOffset = 0;
    return {
      duration: this.voiceDuration,
      sampleRate: this.voiceBuffer.sampleRate,
      numberOfChannels: this.voiceBuffer.numberOfChannels
    };
  }

  /**
   * Decode optional Background Music (BGM) file
   * @param {File|ArrayBuffer} fileOrBuffer 
   */
  async loadBGM(fileOrBuffer) {
    this.initContext();
    if (!fileOrBuffer) {
      this.bgmBuffer = null;
      return;
    }
    const arrayBuffer = fileOrBuffer instanceof File ? await fileOrBuffer.arrayBuffer() : fileOrBuffer;
    this.bgmBuffer = await this.audioCtx.decodeAudioData(arrayBuffer);
  }

  setBGMVolume(volume) {
    this.bgmVolume = Math.max(0, Math.min(1, volume));
    if (this.bgmGainNode) {
      this.bgmGainNode.gain.setValueAtTime(this.bgmVolume, this.audioCtx.currentTime);
    }
  }

  setVoiceVolume(volume) {
    this.voiceVolume = Math.max(0, Math.min(1, volume));
    if (this.voiceGainNode) {
      this.voiceGainNode.gain.setValueAtTime(this.voiceVolume, this.audioCtx.currentTime);
    }
  }

  /**
   * Start or resume playing audio from target offset in seconds
   * @param {number} startOffset - position in seconds
   */
  play(startOffset = null) {
    if (!this.voiceBuffer) return;
    this.initContext();
    this.stopSources();

    const offset = startOffset !== null ? startOffset : this.pauseOffset;
    this.pauseOffset = offset;
    this.startTime = this.audioCtx.currentTime - offset;

    // Create Nodes
    this.voiceSource = this.audioCtx.createBufferSource();
    this.voiceSource.buffer = this.voiceBuffer;

    this.voiceGainNode = this.audioCtx.createGain();
    this.voiceGainNode.gain.value = this.voiceVolume;

    this.voiceSource.connect(this.voiceGainNode);
    this.voiceGainNode.connect(this.audioCtx.destination);

    // If BGM exists, loop and connect BGM
    if (this.bgmBuffer) {
      this.bgmSource = this.audioCtx.createBufferSource();
      this.bgmSource.buffer = this.bgmBuffer;
      this.bgmSource.loop = true;

      this.bgmGainNode = this.audioCtx.createGain();
      this.bgmGainNode.gain.value = this.bgmVolume;

      this.bgmSource.connect(this.bgmGainNode);
      this.bgmGainNode.connect(this.audioCtx.destination);
      this.bgmSource.start(0, offset % this.bgmBuffer.duration);
    }

    this.voiceSource.start(0, offset);
    this.isPlaying = true;

    this.voiceSource.onended = () => {
      if (this.getCurrentTime() >= this.voiceDuration - 0.05) {
        this.isPlaying = false;
        this.pauseOffset = 0;
        if (this.onEnded) this.onEnded();
      }
    };

    this.tickPlayhead();
  }

  pause() {
    if (!this.isPlaying) return;
    this.pauseOffset = this.getCurrentTime();
    this.stopSources();
    this.isPlaying = false;
    if (this._animFrameReq) cancelAnimationFrame(this._animFrameReq);
  }

  stop() {
    this.pauseOffset = 0;
    this.stopSources();
    this.isPlaying = false;
    if (this._animFrameReq) cancelAnimationFrame(this._animFrameReq);
    if (this.onPlayheadUpdate) this.onPlayheadUpdate(0);
  }

  seek(seconds) {
    const wasPlaying = this.isPlaying;
    if (wasPlaying) this.pause();
    this.pauseOffset = Math.max(0, Math.min(seconds, this.voiceDuration));
    if (this.onPlayheadUpdate) this.onPlayheadUpdate(this.pauseOffset);
    if (wasPlaying) this.play(this.pauseOffset);
  }

  getCurrentTime() {
    if (!this.isPlaying) return this.pauseOffset;
    const time = this.audioCtx.currentTime - this.startTime;
    return Math.min(time, this.voiceDuration);
  }

  tickPlayhead() {
    if (!this.isPlaying) return;
    const current = this.getCurrentTime();
    if (this.onPlayheadUpdate) this.onPlayheadUpdate(current);
    if (current < this.voiceDuration) {
      this._animFrameReq = requestAnimationFrame(() => this.tickPlayhead());
    }
  }

  stopSources() {
    if (this.voiceSource) {
      try { this.voiceSource.stop(); } catch (e) {}
      this.voiceSource.disconnect();
      this.voiceSource = null;
    }
    if (this.bgmSource) {
      try { this.bgmSource.stop(); } catch (e) {}
      this.bgmSource.disconnect();
      this.bgmSource = null;
    }
  }

  /**
   * Setup a MediaStreamDestination for canvas video export with mixed audio
   */
  createStreamDestination() {
    this.initContext();
    const dest = this.audioCtx.createMediaStreamDestination();
    
    // Voiceover offline source for export
    const voiceSource = this.audioCtx.createBufferSource();
    voiceSource.buffer = this.voiceBuffer;
    const voiceGain = this.audioCtx.createGain();
    voiceGain.gain.value = this.voiceVolume;
    voiceSource.connect(voiceGain);
    voiceGain.connect(dest);

    // Optional BGM source
    let bgmSource = null;
    if (this.bgmBuffer) {
      bgmSource = this.audioCtx.createBufferSource();
      bgmSource.buffer = this.bgmBuffer;
      bgmSource.loop = true;
      const bgmGain = this.audioCtx.createGain();
      bgmGain.gain.value = this.bgmVolume;
      bgmSource.connect(bgmGain);
      bgmGain.connect(dest);
    }

    return {
      stream: dest.stream,
      start: () => {
        voiceSource.start(0);
        if (bgmSource) bgmSource.start(0);
      },
      stop: () => {
        try { voiceSource.stop(); } catch (e) {}
        if (bgmSource) { try { bgmSource.stop(); } catch (e) {} }
      }
    };
  }
}

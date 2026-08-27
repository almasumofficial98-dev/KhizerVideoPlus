/**
 * KhizerVideoPlus - Video Exporter Engine
 * Encodes canvas frames + mixed audio into an MP4/WebM video file matching exact audio duration.
 */

export class VideoExporter {
  constructor(renderEngine, audioEngine, timelineEngine) {
    this.renderEngine = renderEngine;
    this.audioEngine = audioEngine;
    this.timelineEngine = timelineEngine;
  }

  /**
   * Export video matching exact audio duration
   * @param {Object} options - { fps: 30, format: 'mp4', onProgress: (pct) => {} }
   * @returns {Promise<Blob>}
   */
  async exportVideo(options = {}) {
    const fps = options.fps || 30;
    const onProgress = options.onProgress || (() => {});
    const totalDuration = this.timelineEngine.totalDuration;

    if (totalDuration <= 0) {
      throw new Error('Audio duration is invalid or zero.');
    }

    // Prepare mixed Audio Stream
    const audioStreamDest = this.audioEngine.createStreamDestination();

    // Prepare Canvas Video Stream
    const canvas = this.renderEngine.canvas;
    const canvasStream = canvas.captureStream(fps);

    // Combine Video + Audio tracks into single MediaStream
    const combinedTracks = [
      ...canvasStream.getVideoTracks(),
      ...audioStreamDest.stream.getAudioTracks()
    ];
    const combinedStream = new MediaStream(combinedTracks);

    // Check supported mimeTypes
    let mimeType = 'video/webm;codecs=vp9,opus';
    if (MediaRecorder.isTypeSupported('video/mp4;codecs=avc1.42E01E,mp4a.40.2')) {
      mimeType = 'video/mp4;codecs=avc1.42E01E,mp4a.40.2';
    } else if (MediaRecorder.isTypeSupported('video/mp4')) {
      mimeType = 'video/mp4';
    } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')) {
      mimeType = 'video/webm;codecs=vp8,opus';
    }

    const recorder = new MediaRecorder(combinedStream, {
      mimeType,
      videoBitsPerSecond: 8000000 // 8 Mbps high quality
    });

    const recordedChunks = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        recordedChunks.push(e.data);
      }
    };

    return new Promise((resolve, reject) => {
      let currentTime = 0;
      const frameInterval = 1 / fps;
      let animId = null;

      recorder.onstop = () => {
        audioStreamDest.stop();
        const blob = new Blob(recordedChunks, { type: mimeType });
        resolve({ blob, filename: `KhizerVideoPlus_${Date.now()}.${mimeType.includes('mp4') ? 'mp4' : 'webm'}` });
      };

      recorder.onerror = (err) => {
        audioStreamDest.stop();
        reject(err);
      };

      // Start Recording & Audio Playback
      recorder.start(100);
      audioStreamDest.start();

      const startTime = performance.now();

      const renderLoop = () => {
        const elapsed = (performance.now() - startTime) / 1000;
        currentTime = Math.min(elapsed, totalDuration);

        // Update progress callback
        const pct = Math.floor((currentTime / totalDuration) * 100);
        onProgress(pct);

        // Render current canvas frame
        const timelineState = this.timelineEngine.getSlideAtTime(currentTime, this.renderEngine.transitionDuration);
        this.renderEngine.drawFrame(timelineState);

        if (currentTime < totalDuration) {
          animId = requestAnimationFrame(renderLoop);
        } else {
          // Finish recording
          onProgress(100);
          setTimeout(() => {
            recorder.stop();
          }, 300);
        }
      };

      renderLoop();
    });
  }
}

import type { AnimationRecording } from '../types/animationEvents';
import { ParticleEngine } from './particleEngine';

/**
 * Replays recorded animation events frame by frame with continuous physics simulation
 */
export class AnimationReplay {
  private engine: ParticleEngine;
  private recording: AnimationRecording;
  private canvasWidth: number;
  private canvasHeight: number;
  private eventIndex = 0;
  private lastPhysicsTime = 0;
  private physicsTimestep = 1000 / 60; // 60 FPS physics simulation
  private replayStartTime: number = 0; // Reference time for pulse timing

  constructor(recording: AnimationRecording) {
    this.recording = recording;
    this.canvasWidth = recording.canvasWidth;
    this.canvasHeight = recording.canvasHeight;
    this.replayStartTime = performance.now(); // Capture start time for pulse timing

    // Create engine with initial settings
    this.engine = new ParticleEngine(recording.initialSettings);
    this.engine.setCanvasSize(this.canvasWidth, this.canvasHeight);
    
    // Set replay base time so pulses execute at correct times
    // Pulses will use replayStartTime as their reference point
    this.engine.setReplayBaseTime(this.replayStartTime);

    // Initialize image synchronously (image data already loaded)
    if (recording.initialImage?.imageData) {
      this.initializeImageSync(recording.initialImage.imageData);
    } else {
      // If no image, create default particles
      this.engine.regenerateParticles();
    }
  }

  private initializeImageSync(base64Data: string): void {
    try {
      // For data URLs, we need to load them as an image first
      const img = new Image();
      let isLoaded = false;

      // We need to wait for image to load, so store particles after loading
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = this.canvasWidth;
          canvas.height = this.canvasHeight;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            const imageData = ctx.getImageData(0, 0, this.canvasWidth, this.canvasHeight);
            this.engine.generateParticlesFromImage(imageData);
            isLoaded = true;
          }
        } catch (e) {
          console.error('[Replay] Failed to generate particles from image:', e);
        }
      };

      img.onerror = () => {
        console.error('[Replay] Failed to load image');
        this.engine.regenerateParticles();
      };

      // Set source - this triggers loading
      img.src = base64Data;

      // If it's a data URL and synchronously available, onload might fire immediately
      // But for safety, also regenerate default particles as fallback
      if (!isLoaded) {
        // Image is still loading, we'll use default particles for now
        // The real particles will load once image is ready
        this.engine.regenerateParticles();
      }
    } catch (e) {
      console.error('[Replay] Failed to initialize image:', e);
      this.engine.regenerateParticles();
    }
  }

  /**
   * Advance replay to a specific timestamp with proper physics simulation
   * This ensures smooth particle movement, not just event-based jumps
   */
  advanceTo(targetTime: number): void {
    // Apply all events that should have happened before targetTime
    while (this.eventIndex < this.recording.events.length) {
      const event = this.recording.events[this.eventIndex];
      if (event.timestamp > targetTime) break;

      this.applyEvent(event);
      this.eventIndex++;
    }

    // Simulate physics from last physics time to target time
    // This ensures smooth, continuous particle movement
    // Run multiple physics steps per frame for smoother particle interpolation (120 FPS internal simulation)
    const stepsPerFrame = 2;
    const framePhysicsTime = this.physicsTimestep / stepsPerFrame;
    
    while (this.lastPhysicsTime < targetTime) {
      this.engine.updateParticles(); // One physics step
      this.lastPhysicsTime += framePhysicsTime;
    }
  }

  private applyEvent(event: any): void {
    switch (event.type) {
      case 'mousemove':
        this.engine.setMousePosition(event.data.x, event.data.y, true);
        break;

      case 'mouseenter':
        {
          const pos = this.engine.getMousePosition();
          this.engine.setMousePosition(pos.x, pos.y, true);
        }
        break;

      case 'mouseleave':
        this.engine.setMousePosition(0, 0, false);
        break;

      case 'settings_change':
        this.engine.updateSettings(event.data);
        break;

      case 'pulse':
        // CRITICAL: Adjust pulse timing so it executes at the right frame
        // The pulse's 'start' time must be relative to replayStartTime, not performance.now()
        // Otherwise pulses never execute because their start time is in the future
        const pulseWithAdjustedTiming = {
          ...event.data,
          // Store the intended event timestamp so we can calculate start time dynamically
          recordedEventTimestamp: event.timestamp,
        };
        this.engine.addPulse(pulseWithAdjustedTiming);
        break;

      case 'toggle_force':
        this.engine.setForceDisabled(!event.data.enabled);
        break;

      default:
        console.warn('[Replay] Unknown event type:', event.type);
    }
  }

  /**
   * Get particle states at current time for rendering
   */
  getParticles(): any[] {
    return this.engine.getParticles();
  }

  /**
   * Draw particles to canvas context at current state
   */
  drawTo(ctx: CanvasRenderingContext2D, backgroundColor: string = '#000000'): void {
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);
    this.engine.drawParticles(ctx);
  }

  /**
   * Get total recording duration
   */
  getDuration(): number {
    return this.recording.duration;
  }

  /**
   * Reset replay to start
   */
  reset(): void {
    this.eventIndex = 0;
    this.lastPhysicsTime = 0;
    this.engine = new ParticleEngine(this.recording.initialSettings);
    this.engine.setCanvasSize(this.canvasWidth, this.canvasHeight);
  }
}

import type { AnimationEvent, AnimationRecording } from '../types/animationEvents';
import type { ForceFieldSettings } from '../types/particle';

/**
 * Records animation events for perfect replay
 */
export class AnimationEventRecorder {
  private isRecording = false;
  private events: AnimationEvent[] = [];
  private recordingStartTime = 0;
  private initialSettings: ForceFieldSettings | null = null;
  private canvasWidth = 0;
  private canvasHeight = 0;
  private initialImageData: { imageData: string; width: number; height: number } | null = null;
  private lastRecording: AnimationRecording | null = null;

  startRecording(
    settings: ForceFieldSettings,
    canvasWidth: number,
    canvasHeight: number,
    initialImage?: { imageData: string; width: number; height: number }
  ): void {
    console.log('[EventRecorder] Starting recording');
    this.isRecording = true;
    this.events = [];
    this.recordingStartTime = performance.now();
    this.initialSettings = { ...settings };
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
    this.initialImageData = initialImage || null;
  }

  stopRecording(): AnimationRecording | null {
    if (!this.isRecording || !this.initialSettings) {
      console.warn('[EventRecorder] No active recording to stop');
      // Return last recording if available
      if (this.lastRecording) {
        console.log('[EventRecorder] Returning last recording (already stopped)');
        return this.lastRecording;
      }
      return null;
    }

    this.isRecording = false;
    const duration = performance.now() - this.recordingStartTime;

    const recording: AnimationRecording = {
      version: 1,
      recordedAt: new Date().toISOString(),
      duration,
      canvasWidth: this.canvasWidth,
      canvasHeight: this.canvasHeight,
      initialSettings: this.initialSettings,
      initialImage: this.initialImageData || {
        imageData: '',
        width: 0,
        height: 0,
      },
      events: this.events,
    };

    // Store as last recording
    this.lastRecording = recording;

    console.log(`[EventRecorder] Recording stopped: ${duration.toFixed(0)}ms, ${this.events.length} events`);
    return recording;
  }

  recordEvent(type: string, data: any): void {
    if (!this.isRecording) return;

    const event: AnimationEvent = {
      timestamp: performance.now() - this.recordingStartTime,
      type,
      data,
    };

    this.events.push(event);
  }

  recordMouseMove(x: number, y: number): void {
    this.recordEvent('mousemove', { x, y });
  }

  recordMouseEnter(): void {
    this.recordEvent('mouseenter', {});
  }

  recordMouseLeave(): void {
    this.recordEvent('mouseleave', {});
  }

  recordSettingsChange(settings: Partial<ForceFieldSettings>): void {
    this.recordEvent('settings_change', settings);
  }

  recordPulse(pulse: any): void {
    this.recordEvent('pulse', pulse);
  }

  recordToggleForce(enabled: boolean): void {
    this.recordEvent('toggle_force', { enabled });
  }

  recordRandomize(pulseId: string): void {
    this.recordEvent('randomize', { pulseId });
  }

  isRecordingActive(): boolean {
    return this.isRecording;
  }

  getRecordedEvents(): AnimationEvent[] {
    return [...this.events];
  }

  getLastRecording(): AnimationRecording | null {
    return this.lastRecording;
  }
}

export const eventRecorder = new AnimationEventRecorder();

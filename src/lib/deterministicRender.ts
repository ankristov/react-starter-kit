/**
 * Deterministic Rendering Service
 * Records animation inputs (pulses, settings) during live play
 * Replays identically on server/worker for smooth video export
 * 
 * Key principle: Store inputs, not outputs. Replay produces identical results.
 */

import type { ForceFieldSettings, ForcePulse } from '../types/particle';

export interface RecordedInput {
  timestamp: number; // ms since start
  pulse?: Omit<ForcePulse, 'id'>;
  settingsChange?: Partial<ForceFieldSettings>;
}

export interface AnimationRecording {
  version: 1;
  imageData: string; // base64 encoded ImageData
  initialSettings: ForceFieldSettings;
  duration: number; // total duration in ms
  fps: number; // recording/playback fps
  inputs: RecordedInput[];
  width: number;
  height: number;
}

/**
 * Start recording animation inputs
 * Call this when user starts animating
 */
export class AnimationRecorder {
  private startTime: number = 0;
  private initialSettings: ForceFieldSettings;
  private inputs: RecordedInput[] = [];
  private isRecording: boolean = false;

  constructor(initialSettings: ForceFieldSettings) {
    this.initialSettings = { ...initialSettings };
  }

  start(): void {
    this.startTime = Date.now();
    this.inputs = [];
    this.isRecording = true;
  }

  stop(): number {
    this.isRecording = false;
    return Date.now() - this.startTime;
  }

  recordPulse(pulse: Omit<ForcePulse, 'id'>): void {
    if (!this.isRecording) return;
    this.inputs.push({
      timestamp: Date.now() - this.startTime,
      pulse,
    });
  }

  recordSettingsChange(settings: Partial<ForceFieldSettings>): void {
    if (!this.isRecording) return;
    this.inputs.push({
      timestamp: Date.now() - this.startTime,
      settingsChange: settings,
    });
  }

  getRecording(
    imageDataUrl: string,
    width: number,
    height: number,
    fps: number = 60
  ): AnimationRecording {
    // Calculate duration based on last input, not time elapsed
    // This prevents idle time from being included in the recording
    const lastInputTime = this.inputs.length > 0 
      ? Math.max(...this.inputs.map(i => i.timestamp))
      : 0;
    
    // Add a buffer for particles to settle (1 second at 60fps = 60 frames)
    const SETTLEMENT_BUFFER_MS = 1000;
    const duration = lastInputTime + SETTLEMENT_BUFFER_MS;
    
    const wallClockDuration = Date.now() - this.startTime;
    
    console.log(`[AnimationRecorder] Duration calculation:`, {
      wallClockDuration,
      lastInputTime,
      settlementBuffer: SETTLEMENT_BUFFER_MS,
      finalDuration: duration,
      inputCount: this.inputs.length,
      durationSeconds: (duration / 1000).toFixed(2),
    });
    
    return {
      version: 1,
      imageData: imageDataUrl,
      initialSettings: this.initialSettings,
      duration,
      fps,
      inputs: this.inputs,
      width,
      height,
    };
  }

  isActive(): boolean {
    return this.isRecording;
  }
}

/**
 * Serialize recording to JSON (for sending to server/worker)
 */
export function serializeRecording(recording: AnimationRecording): string {
  return JSON.stringify(recording);
}

/**
 * Deserialize recording from JSON
 */
export function deserializeRecording(json: string): AnimationRecording {
  return JSON.parse(json);
}

/**
 * Export recording as downloadable JSON (for backup/sharing)
 */
export function exportRecordingJSON(recording: AnimationRecording, filename: string = 'animation.json'): void {
  const json = serializeRecording(recording);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Import recording from JSON file
 */
export function importRecordingJSON(file: File): Promise<AnimationRecording> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = e.target?.result as string;
        const recording = deserializeRecording(json);
        resolve(recording);
      } catch (error) {
        reject(new Error(`Failed to parse recording: ${error}`));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

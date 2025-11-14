import type { ForceFieldSettings, ForcePulse } from './particle';

/**
 * Event-based animation recording
 * Records all interactions and force changes, not particle positions
 * Allows perfect replay by re-running physics with same inputs
 */

export interface AnimationEvent {
  timestamp: number; // ms from start
  type: string;
  data: any;
}

export interface MouseMoveEvent extends AnimationEvent {
  type: 'mousemove';
  data: {
    x: number;
    y: number;
  };
}

export interface MouseEnterEvent extends AnimationEvent {
  type: 'mouseenter';
  data: {};
}

export interface MouseLeaveEvent extends AnimationEvent {
  type: 'mouseleave';
  data: {};
}

export interface SettingsChangeEvent extends AnimationEvent {
  type: 'settings_change';
  data: Partial<ForceFieldSettings>;
}

export interface PulseEvent extends AnimationEvent {
  type: 'pulse';
  data: ForcePulse;
}

export interface ToggleForceEvent extends AnimationEvent {
  type: 'toggle_force';
  data: {
    enabled: boolean;
  };
}

export interface RandomizeEvent extends AnimationEvent {
  type: 'randomize';
  data: {
    pulseId: string;
  };
}

export interface AnimationRecording {
  version: 1;
  recordedAt: string;
  duration: number; // ms
  canvasWidth: number;
  canvasHeight: number;
  initialSettings: ForceFieldSettings;
  initialImage: {
    imageData: string; // base64 encoded
    width: number;
    height: number;
  };
  events: AnimationEvent[];
}

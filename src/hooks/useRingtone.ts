import { useEffect, useRef, useCallback } from 'react';

// Generate a simple ringtone using Web Audio API
const createRingtoneOscillator = (audioContext: AudioContext, gainNode: GainNode) => {
  const oscillator = audioContext.createOscillator();
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(440, audioContext.currentTime); // A4 note
  oscillator.connect(gainNode);
  return oscillator;
};

export const useRingtone = () => {
  const audioContextRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isPlayingRef = useRef(false);

  const playRingtone = useCallback(() => {
    if (isPlayingRef.current) return;
    
    try {
      // Create audio context if needed
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      const audioContext = audioContextRef.current;
      
      // Create gain node for volume control
      gainNodeRef.current = audioContext.createGain();
      gainNodeRef.current.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNodeRef.current.connect(audioContext.destination);

      isPlayingRef.current = true;

      // Create a pulsing ringtone pattern
      const playTone = () => {
        if (!isPlayingRef.current || !audioContextRef.current || !gainNodeRef.current) return;

        const oscillator = createRingtoneOscillator(audioContextRef.current, gainNodeRef.current);
        oscillatorRef.current = oscillator;

        // Two-tone pattern (ring-ring)
        const now = audioContextRef.current.currentTime;
        oscillator.frequency.setValueAtTime(440, now);
        oscillator.frequency.setValueAtTime(480, now + 0.15);
        oscillator.frequency.setValueAtTime(440, now + 0.3);
        oscillator.frequency.setValueAtTime(480, now + 0.45);

        oscillator.start(now);
        oscillator.stop(now + 0.6);
      };

      // Play immediately and then every 1.5 seconds
      playTone();
      intervalRef.current = setInterval(playTone, 1500);
    } catch (error) {
      console.error('Error playing ringtone:', error);
    }
  }, []);

  const stopRingtone = useCallback(() => {
    isPlayingRef.current = false;

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (oscillatorRef.current) {
      try {
        oscillatorRef.current.stop();
      } catch (e) {
        // Oscillator might already be stopped
      }
      oscillatorRef.current = null;
    }

    if (gainNodeRef.current) {
      gainNodeRef.current.disconnect();
      gainNodeRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRingtone();
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
    };
  }, [stopRingtone]);

  return { playRingtone, stopRingtone };
};

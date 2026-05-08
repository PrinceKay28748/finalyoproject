// hooks/useVoiceGuidance.js
// Text-to-speech for accessibility - with turn announcement queue and reroute support

import { useState, useCallback, useRef, useEffect } from 'react';

export function useVoiceGuidance() {
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(() => {
    const saved = localStorage.getItem('voiceGuidanceEnabled');
    return saved === 'true';
  });
  
  const synthesisRef = useRef(null);
  const queueRef = useRef([]);
  const isSpeakingRef = useRef(false);
  const currentUtteranceRef = useRef(null);

  // Initialize speech synthesis
  useEffect(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      synthesisRef.current = window.speechSynthesis;
    }
    
    return () => {
      if (synthesisRef.current) {
        synthesisRef.current.cancel();
      }
    };
  }, []);

  // Save preference to localStorage
  useEffect(() => {
    localStorage.setItem('voiceGuidanceEnabled', isVoiceEnabled);
  }, [isVoiceEnabled]);

  const toggleVoice = useCallback(() => {
    setIsVoiceEnabled(prev => !prev);
  }, []);

  // Process the speech queue
  const processQueue = useCallback(() => {
    if (!isVoiceEnabled) return;
    if (isSpeakingRef.current) return;
    if (queueRef.current.length === 0) return;
    
    const nextText = queueRef.current.shift();
    if (!nextText) return;
    
    isSpeakingRef.current = true;
    
    const utterance = new SpeechSynthesisUtterance(nextText);
    utterance.rate = 0.95;
    utterance.pitch = 1;
    utterance.volume = 1;
    
    utterance.onend = () => {
      isSpeakingRef.current = false;
      currentUtteranceRef.current = null;
      setTimeout(() => processQueue(), 100);
    };
    
    utterance.onerror = () => {
      isSpeakingRef.current = false;
      currentUtteranceRef.current = null;
      processQueue();
    };
    
    currentUtteranceRef.current = utterance;
    synthesisRef.current.speak(utterance);
  }, [isVoiceEnabled]);

  // Add text to speech queue
  const speak = useCallback((text, options = {}) => {
    if (!isVoiceEnabled) return;
    if (!text) return;
    
    const { priority = 'normal' } = options;
    
    if (priority === 'immediate') {
      queueRef.current = [];
      if (synthesisRef.current) {
        synthesisRef.current.cancel();
      }
      isSpeakingRef.current = false;
      queueRef.current.push(text);
      processQueue();
    } else {
      queueRef.current.push(text);
      processQueue();
    }
  }, [isVoiceEnabled, processQueue]);

  // Announce a turn
  const speakTurn = useCallback((instruction, distance, urgency = 'normal') => {
    if (!isVoiceEnabled) return;
    
    let message = '';
    if (distance < 30) {
      message = `Now, ${instruction.toLowerCase()}.`;
    } else if (distance < 100) {
      message = `${instruction} in ${Math.round(distance)} meters.`;
    } else if (distance < 300) {
      message = `${instruction} in about ${Math.round(distance / 10) * 10} meters.`;
    } else {
      message = `${instruction} in ${(distance / 1000).toFixed(1)} kilometers.`;
    }
    
    const priority = distance < 50 ? 'immediate' : 'normal';
    speak(message, { priority });
  }, [isVoiceEnabled, speak]);

  // Announce destination arrival
  const speakArrival = useCallback(() => {
    if (!isVoiceEnabled) return;
    speak("You have arrived at your destination.", { priority: 'immediate' });
  }, [isVoiceEnabled, speak]);

  // Helper to format distance for voice
  const formatDistanceForVoice = useCallback((meters) => {
    if (meters < 1000) return `${Math.round(meters)} meters`;
    return `${(meters / 1000).toFixed(1)} kilometers`;
  }, []);

  // Helper to format time for voice
  const formatTravelTimeForVoice = useCallback((meters, vehicleMode) => {
    let speedKmh;
    if (vehicleMode === 'walk') speedKmh = 5;
    else if (vehicleMode === 'car') speedKmh = 30;
    else if (vehicleMode === 'motorcycle') speedKmh = 25;
    else speedKmh = 5;
    
    const minutes = Math.ceil(meters / (speedKmh * 1000 / 60));
    if (minutes < 1) return "less than 1 minute";
    if (minutes < 60) return `${minutes} minutes`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m === 0 ? `${h} hour` : `${h} hour ${m} minutes`;
  }, []);

  // Announce route summary (with optional reroute prefix)
  const speakRouteSummary = useCallback((distance, time, isReroute = false) => {
    if (!isVoiceEnabled) return;
    const prefix = isReroute ? "Rerouting. " : "";
    speak(`${prefix}Route calculated. ${distance}, about ${time}.`, { priority: 'normal' });
  }, [isVoiceEnabled, speak]);

  // Announce that user has deviated from route
  const speakDeviation = useCallback(() => {
    if (!isVoiceEnabled) return;
    speak("You have deviated from the route. Recalculating...", { priority: 'immediate' });
  }, [isVoiceEnabled, speak]);

  // Announce reroute complete
  const speakRerouteComplete = useCallback((distance, time) => {
    if (!isVoiceEnabled) return;
    speak(`Route updated. ${formatDistanceForVoice(distance)}, about ${time}.`, { priority: 'normal' });
  }, [isVoiceEnabled, speak, formatDistanceForVoice]);

  return {
    isVoiceEnabled,
    toggleVoice,
    speak,
    speakTurn,
    speakArrival,
    speakRouteSummary,
    speakDeviation,
    speakRerouteComplete,
    formatDistanceForVoice,
    formatTravelTimeForVoice
  };
}
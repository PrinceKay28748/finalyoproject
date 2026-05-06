// hooks/useVoiceGuidance.js
// Text-to-speech for accessibility - with turn announcement queue

import { useState, useCallback, useRef, useEffect } from 'react';

export function useVoiceGuidance() {
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(() => {
    const saved = localStorage.getItem('voiceGuidanceEnabled');
    return saved === 'true';
  });
  
  const synthesisRef = useRef(null);
  const queueRef = useRef([]);
  const isSpeakingRef = useRef(false);  // FIXED: added 'const'
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
      // Process next in queue
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
      // Clear queue and speak immediately for urgent announcements
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

  // Announce route summary
  const speakRouteSummary = useCallback((distance, time) => {
    if (!isVoiceEnabled) return;
    speak(`Route calculated. ${distance}, about ${time}.`, { priority: 'normal' });
  }, [isVoiceEnabled, speak]);

  return {
    isVoiceEnabled,
    toggleVoice,
    speak,
    speakTurn,
    speakArrival,
    speakRouteSummary
  };
}
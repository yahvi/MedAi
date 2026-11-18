/**
 * Module 7: Voice Assistance — Speech-to-Text (STT) & Text-to-Speech (TTS)
 * Supports English ('en-IN') and Hindi ('hi-IN') via Web Speech API.
 */

export function isSpeechRecognitionSupported() {
  return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
}

export function isSpeechSynthesisSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function speakText(text, language = 'en', onEnd = null) {
  if (!isSpeechSynthesisSupported() || !text) return;
  window.speechSynthesis.cancel();

  // Strip simple markdown formatting before speaking
  const clean = text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/#+\s?/g, '')
    .replace(/`([^`]+)`/g, '$1');

  const utterance = new SpeechSynthesisUtterance(clean);
  const targetLang = language === 'hi' ? 'hi-IN' : 'en-IN';
  utterance.lang = targetLang;
  utterance.rate = 0.96;

  const voices = window.speechSynthesis.getVoices();
  const matchedVoice =
    voices.find((v) => v.lang.toLowerCase() === targetLang.toLowerCase()) ||
    voices.find((v) => v.lang.toLowerCase().startsWith(language === 'hi' ? 'hi' : 'en'));
  if (matchedVoice) {
    utterance.voice = matchedVoice;
  }

  if (onEnd) {
    utterance.onend = onEnd;
    utterance.onerror = onEnd;
  }
  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking() {
  if (isSpeechSynthesisSupported()) {
    window.speechSynthesis.cancel();
  }
}

export function startListening({ language = 'en', onResult, onError, onEnd }) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    onError?.('Voice input is not supported in this browser. Try Chrome or Edge.');
    return null;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = language === 'hi' ? 'hi-IN' : 'en-IN';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.onresult = (event) => {
    const transcript = event.results?.[0]?.[0]?.transcript || '';
    if (transcript) {
      onResult?.(transcript);
    }
  };
  recognition.onerror = (event) => {
    onError?.(event.error || 'Voice recognition error');
  };
  recognition.onend = () => {
    onEnd?.();
  };

  recognition.start();
  return recognition;
}


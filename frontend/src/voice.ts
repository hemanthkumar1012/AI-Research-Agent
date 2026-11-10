/* ── Voice Input ────────────────────────────────────────── */
/* Web Speech API for dictating research questions            */
/* Animated microphone button with live transcript feedback   */

import { $, esc } from "./utils.js";
import { toast } from "./commands.js";

let recognition: any = null;
let listening = false;
let voiceBtn: HTMLButtonElement | null = null;

export function initVoiceInput(): void {
  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!SpeechRecognition) return; // Browser doesn't support it

  recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.lang = "en-US";

  // Create mic button
  voiceBtn = document.createElement("button");
  voiceBtn.type = "button";
  voiceBtn.className = "voice-btn";
  voiceBtn.innerHTML = '<span class="voice-icon">🎙</span>';
  voiceBtn.title = "Voice input (click to dictate)";

  const wrap = document.querySelector(".search-input-wrap");
  if (wrap) wrap.appendChild(voiceBtn);

  voiceBtn.addEventListener("click", toggleVoice);

  recognition.onresult = (event: any) => {
    const input = $("q") as HTMLInputElement;
    let transcript = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      transcript += event.results[i][0].transcript;
    }
    input.value = transcript;
    input.dispatchEvent(new Event("input"));
  };

  recognition.onend = () => {
    listening = false;
    if (voiceBtn) {
      voiceBtn.classList.remove("voice-active");
      voiceBtn.innerHTML = '<span class="voice-icon">🎙</span>';
    }
  };

  recognition.onerror = (event: any) => {
    listening = false;
    if (voiceBtn) {
      voiceBtn.classList.remove("voice-active");
      voiceBtn.innerHTML = '<span class="voice-icon">🎙</span>';
    }
    if (event.error === "not-allowed") {
      toast("Microphone access denied", "error");
    } else if (event.error !== "aborted") {
      toast("Voice input error: " + event.error, "warn");
    }
  };
}

function toggleVoice(): void {
  if (!recognition) return;

  if (listening) {
    recognition.stop();
    listening = false;
    toast("Voice input stopped", "info");
  } else {
    try {
      recognition.start();
      listening = true;
      if (voiceBtn) {
        voiceBtn.classList.add("voice-active");
        voiceBtn.innerHTML = '<span class="voice-icon voice-pulse">🔴</span>';
      }
      toast("Listening… speak your question", "info", 2000);
    } catch {
      toast("Could not start voice input", "error");
    }
  }
}

export function isVoiceSupported(): boolean {
  return !!(window as any).SpeechRecognition || !!(window as any).webkitSpeechRecognition;
}

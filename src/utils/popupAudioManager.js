// Popup Audio Manager - plays audio directly in extension popup
/* global chrome */

class PopupAudioManager {
  constructor() {
    this.currentAudio = null;
    this.isPlaying = false;
  }

  // Play audio file with proper Chrome extension URL
  async playAudio(filename) {
    try {
      // Stop current audio if playing
      if (this.currentAudio) {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
      }

      // Create audio URL
      const audioUrl = chrome.runtime.getURL(`audio/${filename}`);
      console.log(`Playing audio: ${audioUrl}`);

      // Create new audio instance
      this.currentAudio = new Audio(audioUrl);
      this.currentAudio.volume = 0.7;

      return new Promise((resolve, reject) => {
        this.currentAudio.onended = () => {
          console.log(`Audio finished: ${filename}`);
          this.isPlaying = false;
          resolve();
        };

        this.currentAudio.onerror = (error) => {
          console.error(`Audio error for ${filename}:`, error);
          this.isPlaying = false;
          reject(error);
        };

        this.currentAudio.oncanplaythrough = () => {
          console.log(`Audio ready to play: ${filename}`);
          this.isPlaying = true;
          this.currentAudio.play().catch(reject);
        };

        // Start loading
        this.currentAudio.load();
      });
    } catch (error) {
      console.error(`Error playing ${filename}:`, error);
      this.isPlaying = false;
      throw error;
    }
  }

  // Get random audio file from array
  getRandomAudio(audioArray) {
    const randomIndex = Math.floor(Math.random() * audioArray.length);
    return audioArray[randomIndex];
  }

  // Play full Pomodoro audio sequence
  async playPomodoroSequence(context) {
    try {
      console.log(`Playing Pomodoro sequence for: ${context}`);

      // 1. Play alarm first
      await this.playAudio("pomodoro_alarm.m4a");

      // 2. Small delay between sounds
      await new Promise((resolve) => setTimeout(resolve, 300));

      // 3. Play context-specific audio
      let contextAudios = [];

      if (context === "break") {
        contextAudios = ["break_time_1.m4a", "break_time_2.m4a", "break_time_3.m4a"];
      } else if (context === "focus") {
        contextAudios = ["focus_time_1.m4a", "focus_time_2.m4a", "focus_time_3.m4a"];
      }

      if (contextAudios.length > 0) {
        const selectedAudio = this.getRandomAudio(contextAudios);
        await this.playAudio(selectedAudio);
      }

      console.log(`Pomodoro sequence completed for: ${context}`);
    } catch (error) {
      console.error(`Error playing Pomodoro sequence for ${context}:`, error);
      // Fallback: play a simple beep
      this.playBeep(context);
    }
  }

  // Fallback beep using Web Audio API
  playBeep(context) {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      // Different frequencies for different contexts
      if (context === "break") {
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      } else {
        oscillator.frequency.setValueAtTime(400, audioContext.currentTime);
      }

      oscillator.type = "sine";
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.1);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);

      console.log(`Fallback beep played for: ${context}`);
    } catch (error) {
      console.error("Fallback beep failed:", error);
    }
  }

  // Stop current audio
  stop() {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.isPlaying = false;
    }
  }

  // Check if audio is currently playing
  isAudioPlaying() {
    return this.isPlaying;
  }
}

// Create and export popup audio manager instance
window.popupAudioManager = new PopupAudioManager();

export default window.popupAudioManager;

// Audio Manager for Pomodoro notifications
class AudioManager {
  constructor() {
    this.audioContext = null;
    this.currentAudio = null;
    this.isPlaying = false;
  }

  // Initialize audio context
  async initAudio() {
    try {
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      }

      // Resume audio context if suspended
      if (this.audioContext.state === "suspended") {
        await this.audioContext.resume();
      }

      return true;
    } catch (error) {
      console.error("Failed to initialize audio:", error);
      return false;
    }
  }

  // Play audio file
  async playAudio(audioPath) {
    try {
      await this.initAudio();

      // Stop current audio if playing
      if (this.currentAudio) {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
      }

      // Create new audio instance
      this.currentAudio = new Audio(audioPath);
      this.currentAudio.volume = 0.8;

      return new Promise((resolve, reject) => {
        this.currentAudio.onended = () => {
          this.isPlaying = false;
          resolve();
        };

        this.currentAudio.onerror = (error) => {
          console.error("Audio playback error:", error);
          this.isPlaying = false;
          reject(error);
        };

        this.currentAudio.oncanplaythrough = () => {
          this.isPlaying = true;
          this.currentAudio.play().catch(reject);
        };

        this.currentAudio.load();
      });
    } catch (error) {
      console.error("Error playing audio:", error);
      this.isPlaying = false;
      throw error;
    }
  }

  // Get random audio file from array
  getRandomAudio(audioArray) {
    const randomIndex = Math.floor(Math.random() * audioArray.length);
    return audioArray[randomIndex];
  }

  // Play sequence: alarm + context audio
  async playNotificationSequence(context) {
    try {
      // 1. Play alarm first
      await this.playAudio("/audio/pomodoro_alarm.m4a");

      // 2. Small delay between sounds
      await new Promise((resolve) => setTimeout(resolve, 300));

      // 3. Play context-specific audio
      let contextAudios = [];

      if (context === "break") {
        contextAudios = ["/audio/break_time_1.m4a", "/audio/break_time_2.m4a", "/audio/break_time_3.m4a"];
      } else if (context === "focus") {
        contextAudios = ["/audio/focus_time_1.m4a", "/audio/focus_time_2.m4a", "/audio/focus_time_3.m4a"];
      }

      if (contextAudios.length > 0) {
        const selectedAudio = this.getRandomAudio(contextAudios);
        await this.playAudio(selectedAudio);
      }
    } catch (error) {
      console.error("Error playing notification sequence:", error);
      this.playFallbackNotification(context);
    }
  }

  // Fallback notification using Web Audio API beep
  playFallbackNotification(context) {
    try {
      if (!this.audioContext) return;

      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      // Different tones for different contexts
      if (context === "break") {
        oscillator.frequency.setValueAtTime(800, this.audioContext.currentTime);
      } else {
        oscillator.frequency.setValueAtTime(400, this.audioContext.currentTime);
      }

      oscillator.type = "sine";
      gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.3, this.audioContext.currentTime + 0.1);
      gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.5);

      oscillator.start(this.audioContext.currentTime);
      oscillator.stop(this.audioContext.currentTime + 0.5);
    } catch (error) {
      console.error("Fallback notification failed:", error);
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

// Create singleton instance
const audioManager = new AudioManager();

export default audioManager;

# 🎧 Audio Processor Worklet

A high-performance audio processor built on the Web Audio API and `AudioWorklet` — optimized for real-time audio chunking, voice activity detection (VAD), and browser-based recording.

---

## 🔧 Features

- ✅ Pure Web Audio API (`AudioWorklet`-based)
- 🎙️ Lightweight RMS-based Voice Activity Detection (VAD)
- ⚙️ Configurable silence threshold and speech delay
- 📦 Real-time Int16 chunk conversion for efficient transmission
- 🔁 Works with or without VAD enabled
- 🚀 Minimal branching inside `process()` for high performance
- 🧩 Built-in session recording and time-based chunked capture
- 🌐 Designed for modern browsers and streaming use cases

---

## 🚀 Use Cases

- Live transcription apps (speech-to-text)
- Audio waveform visualizers with accurate volume tracking
- Low-latency browser-based audio streaming and processing

---

## 📦 Installation

```bash
npm install react-audio-processor
```

---

## ⚙️ Quick Start

```js
import { useAudioProcessorKit } from 'react-audio-processor';

const {
  Start,
  Pause,
  Resume,
  Stop,
  Subscribe,
  unSubscribe,
} = useAudioProcessorKit({
  vad: {
    enabled: true,
    speakDetectionDelayMs: 30,
    silenceDetectionDelayMs: 50,
  },
  recording: {
    enabled: true,
    onComplete: (blob) => {
      console.log('Full recording:', blob);
    },
  },
  timing: {
    interval: 1000, // 1 second
    volumeVisualization: true,
  },
  data: {
    onAvailable: (blob) => {
      console.log('Sending audio data:', blob);
    },
  },
  audio: {
    wav: true,
    sampleRate: 16000,
  },
});
```

---

## 🧩 Hook API: `useAudioProcessorKit(config)`

### 🔘 Control Methods

| Method          | Description                                               |
|-----------------|-----------------------------------------------------------|
| `Start()`       | Starts the microphone and begins audio processing         |
| `Pause()`       | Temporarily halts processing (microphone remains active)  |
| `Resume()`      | Resumes processing after `Pause()`                        |
| `Stop()`        | Stops everything and triggers `onComplete()` if enabled   |
| `Subscribe()`   | Begins receiving audio chunks                             |
| `unSubscribe()` | Stops receiving audio chunks                              |

---

### ⚙️ Configuration Options

#### 🧠 `vad`

| Option                    | Type      | Default | Description                            |
|---------------------------|-----------|---------|----------------------------------------|
| `enabled`                 | `boolean` | `true`  | Enable Voice Activity Detection         |
| `speakDetectionDelayMs`   | `number`  | `30`    | Delay before confirming speech started |
| `silenceDetectionDelayMs` | `number`  | `50`    | Delay before confirming silence        |

#### 🕒 `timing`

| Option                | Type      | Default | Description                          |
|-----------------------|-----------|---------|--------------------------------------|
| `interval`            | `number`  | `1000`  | Time interval (ms) for audio chunks  |
| `volumeVisualization` | `boolean` | `false` | Enable live volume tracking          |

#### 💾 `recording`

| Option             | Type       | Default | Description                                 |
|--------------------|------------|---------|---------------------------------------------|
| `enabled`          | `boolean`  | `false` | Enable session-level recording              |
| `onComplete(blob)` | `function` | —       | Called on `Stop()` with final recorded Blob |

#### 📤 `data`

| Option              | Type       | Description                                                |
|---------------------|------------|------------------------------------------------------------|
| `onAvailable(blob)` | `function` | Called every `interval` ms or on VAD trigger with a Blob   |

#### 🎧 `audio`

| Option       | Type      | Default | Description                     |
|--------------|-----------|---------|---------------------------------|
| `wav`        | `boolean` | `true`  | Encode audio as WAV (else PCM) |
| `sampleRate` | `number`  | `16000` | Target sample rate in Hz       |

---

## 🧪 Example UI Integration

```jsx
function AudioControls() {
  const {
    Start,
    Stop,
    Pause,
    Resume,
    volume,
  } = useAudioProcessorKit({ /* config here */ });

  return (
    <div>
      <button onClick={Start}>🎙️ Start</button>
      <button onClick={Pause}>⏸ Pause</button>
      <button onClick={Resume}>▶️ Resume</button>
      <button onClick={Stop}>⏹ Stop</button>

      <div>🔊 Volume: {volume.toFixed(3)}</div>
    </div>
  );
}
```

---

## 📁 Output

- `onAvailable(blob)` — returns a `Blob` per interval or VAD event
- `onComplete(blob)` — returns full session audio on `Stop()`

```js
onAvailable(blob); // Example: every 1s or on speech
onComplete(blob);  // Final WAV/PCM blob for entire session
```

---

## 🌐 Browser Support

| Browser         | Support     |
|-----------------|-------------|
| Chrome 66+      | ✅ Likely supported (not fully tested) |
| Firefox 76+     | ✅ Likely supported (not fully tested) |
| Edge (Chromium) | ✅ Likely supported (not fully tested) |
| Safari 14.1+    | ✅ Likely supported (not fully tested) |
| iOS Safari      | ✅ Likely supported (not fully tested) |

> **Note:** Microphone access requires HTTPS or `localhost`.

---

## 👨‍💻 Author

**Akash V**  
📧 [akashv2000.dev@gmail.com](mailto:akashv2000.dev@gmail.com)

---

## 📄 License

**MIT** — Free for personal and commercial use

# 🎧 react-audio-processor-kit

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
- 🔊 Audio Virtualization — Provide real-time audio volume visualization values, enabling the creation of dynamic virtual audio feedback in the UI (e.g., volume meters or audio visualizations)

---

## 🚀 Use Cases

- Live transcription apps (speech-to-text)
- Audio waveform visualizers with accurate volume tracking
- Low-latency browser-based audio streaming and processing

---

**🌐 View live demo:** [https://your-website-url.com](https://your-website-url.com)


## 📦 Installation

```bash
npm install react-audio-processor-kit
```

---

## ⚙️ Quick Start

```js
const {
  micState,
  Start,
  Pause,
  Resume,
  Stop,
  Subscribe,
  unSubscribe
} = useAudioProcessorKit({
  vad: {
    enabled: false,
    speakDetectionDelayMs: 60,
    silenceDetectionDelayMs: 310,
    noiseFloor: 20,
  },
  timing: {
    interval: 1000,
    volumeVisualization: true,
  },
  recording: {
    enabled: true,
    onComplete: (blob) => {
      console.log(blob);
      // setFullRecord(URL.createObjectURL(blob));
    },
  },
  data: {
    onAvailable: (blob) => {
      setAudioBlobs(prev => [...prev, URL.createObjectURL(blob)]);
    },
  },
  audio: {
    wav: false, // pcm Or wav , by default wav is provided
    sampleRate: 16000,
  },
});
```

---

## 🎛 Microphone Controls UI

```jsx
<div>
  <button onClick={Start} disabled={micState !== "S"}>Start</button>
  <button onClick={Pause} disabled={micState !== "R"}>Pause</button>
  <button onClick={Resume} disabled={micState !== "P"}>Resume</button>
  <button onClick={Stop} disabled={micState === "S"}>Stop</button>
</div>
```

* `"S"` = Stopped
* `"R"` = Recording
* `"P"` = Paused

---

## ⚙️ Configuration Reference

### 🧠 `vad`

Voice Activity Detection

| Property                  | Type      | Description                                            |
| ------------------------- | --------- | ------------------------------------------------------ |
| `enabled`                 | `boolean` | Enables or disables VAD                                |
| `speakDetectionDelayMs`   | `number`  | Delay before confirming speaking has started           |
| `silenceDetectionDelayMs` | `number`  | Delay before confirming silence                        |
| `noiseFloor`              | `number`  | Sensitivity threshold (1–100). Lower is more sensitive |

```js
vad: {
  enabled: true,
  speakDetectionDelayMs: 30,
  silenceDetectionDelayMs: 50,
  noiseFloor: 4,
}
```

---

### 💾 `recording`

Record the entire audio session.

| Property           | Type       | Description                              |
| ------------------ | ---------- | ---------------------------------------- |
| `enabled`          | `boolean`  | Enables recording                        |
| `onComplete(blob)` | `function` | Called on `Stop()` with final audio blob |

```js
recording: {
  enabled: true,
  onComplete: (blob) => {
    setFullRecord(URL.createObjectURL(blob));
  },
}
```

---

### 🕒 `timing`

Time-based audio capture

| Property              | Type      | Description                         |
| --------------------- | --------- | ----------------------------------- |
| `interval`            | `number`  | Time interval in ms between chunks  |
| `volumeVisualization` | `boolean` | Enables real-time volume data (RMS) |

```js
timing: {
  interval: 1000,
  volumeVisualization: true,
}
```

---

### 📤 `data`

Handle real-time audio chunks

| Property            | Type       | Description                                           |
| ------------------- | ---------- | ----------------------------------------------------- |
| `onAvailable(blob)` | `function` | Called when an audio chunk is ready (VAD or interval) |

```js
data: {
  onAvailable: (blob) => {
    setAudioBlobs(prev => [...prev, URL.createObjectURL(blob)]);
  },
}
```

---

### 🎧 `audio`

Audio format configuration

| Property     | Type      | Description                |
| ------------ | --------- | -------------------------- |
| `sampleRate` | `number`  | Target sample rate (Hz)    |
| `wav`        | `boolean` | Output format (WAV or PCM) |

```js
audio: {
  sampleRate: 16000,
  wav: true,
}
```

---

## 🔘 Control API

| Method                | Description                      |
| --------------------- | -------------------------------- |
| `Start()`             | Starts the audio pipeline        |
| `Pause()`             | Temporarily halts processing     |
| `Resume()`            | Resumes processing               |
| `Stop()`              | Finalizes and stops everything   |
| `Subscribe(callback)` | Subscribe to audio events        |
| `unSubscribe(index)`  | Unsubscribe using returned index |

---

### 📡 Subscribe Example

```js
useEffect(() => {
  const index = Subscribe((data) => {
    setSpeaking(data.isSpeaking);
  });

  return () => unSubscribe(index);
}, []);
```

---

## 🧪 Output

* `onAvailable(blob)` — Called every time interval or per VAD event
* `onComplete(blob)` — Final session recording blob on Stop

---


> Requires HTTPS or `localhost` for microphone access.

---

## 👨‍💻 Author

**dev.akash**
📧 [akashv2000.dev@gmail.com](mailto:akashv2000.dev@gmail.com)

---

## 📄 License

**MIT** — Free for personal and commercial use

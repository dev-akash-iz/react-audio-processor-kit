import { useEffect, useRef, useState } from "react";
import { url, AUDIO_PROCESSOR_NAME, signal } from './audioProcessorV4'





//------------------------------------------------CONSTANTS end here -----------------------------------------------

/**
 * !NOTE!
 * 
 * AUDIOCONTEXT WITH AUDIOPROCESSOR - Initalization
 * very important
 * idea is to create single audioContext with audioProcessor otherwise it may heavy to mobile/old devices
 */
const audioContext = new (window?.AudioContext || window?.webkitAudioContext)();
const promiseAudioContext = audioContext?.audioWorklet?.addModule?.(url);

promiseAudioContext?.catch?.((e) => {
    console.log("not able add addModule audioProcessor.js ")
})
async function isAudioContextReady() {
    try {
        if (!promiseAudioContext) throw new Error("issue with initializing audioWorklet addModule , please use https or localhost");

        await promiseAudioContext
        return audioContext;
    } catch (e) {
        console.error(e);
        return undefined
    }
}
//------------------------------------------------AUDIOCONTEXT WITH AUDIOPROCESSOR init end here -----------------------------------------------




const Static_MicState = {
    STOPPED: 0,
    RECORDING: 1,
    PAUSED: 2
};

async function init(onMessage, options) {
    try {
        const audioContextInstance = await isAudioContextReady();
        if (!audioContextInstance) throw new Error("issue with initializing audioContext");
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        //const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });

        const source = audioContextInstance.createMediaStreamSource(stream);
        const workletNodeThread = new AudioWorkletNode(audioContextInstance, AUDIO_PROCESSOR_NAME);
        //=== attaching call back of main thread  so from audioworklet thread can call this callbacks ====
        workletNodeThread.port.onmessage = onMessage;

        //=== passing initial of settings to audio thread
        options["signal"] = signal;
        options["status"] = signal.INIT;
        workletNodeThread.port.postMessage(options);

        source.connect(workletNodeThread);
        await audioContextInstance.resume();
        return { STREAM: stream, SOURCE: source, WORKLETHREAD: workletNodeThread, AUDIOCONTEXT: audioContextInstance, POSTMESSAGE: workletNodeThread.port.postMessage };

    } catch (e) {
        console.log(e);
        return undefined;
    }
}

/**
 * Akash v
 * email: akashv2000.dev@gmail.com
 * last update : 25-04-2025
 */
function useAudioKitPro(parameters = {}) {
    const [MicState, setMicState] = useState(Static_MicState.STOPPED);
    const initialMainAudioResources = useRef(undefined);

    //======Subscribe way run each small componensts function so reducing maximum reload of component ========
    const subscribeCallback = useRef([]);
    const values = useRef({
        volume: 0,
        isSpeaking: false,
    });

    // seperate thread which run process 

    const recorderRef = useRef(null);
    const streamRef = useRef(null);

    const getCurrent = (KEY) => {
        return initialMainAudioResources.current?.[KEY];
    }
    const postMessage = (params) => {
        getCurrent("WORKLETHREAD")?.port?.postMessage?.(params);
    }

    useEffect(() => {
        return () => {
            try {
                const source = getCurrent("SOURCE");
                const workletthread = getCurrent("WORKLETHREAD");
                const audioContext = getCurrent("AUDIOCONTEXT");
                source && source.disconnect();
                workletthread && workletthread.disconnect();
                if (audioContext && audioContext.state !== 'closed') {
                    audioContext.suspend(); // we only create one instance per on browser tab so no close
                }
                getCurrent("STREAM")?.getTracks().forEach((track) => track.stop());
            } catch (error) {
                console.error("cleanup errror");
            }
        }
    }, [])


    const Subscribe = (callback) => {
        if (callback && typeof callback === "function") {
            return subscribeCallback.current.push(callback) - 1;

        }
    };

    const unSubscribe = (index) => {
        if (typeof index === "number" && index >= 0 && index < subscribeCallback.current.length) {
            subscribeCallback.current[index] = null;// not remove if remove all index change lead wrong unsubscribe by other compoenrrs
        }
    };






    const Start = async () => {
        if (MicState !== Static_MicState.STOPPED) {
            console.error("Session already running.");
            return;
        }

        try {

            if (!initialMainAudioResources.current) {
                const ondataAvailable = parameters.ondataAvailable;
                parameters.ondataAvailable = undefined;
                const AudioRefrence = await init((event) => {
                    const data = event.data;
                    switch (data.status) {
                        case signal.SPEAKING_STARTED:
                            values.current["isSpeaking"] = true;
                            break;
                        case signal.SPEAKING_STOPED:
                            values.current["isSpeaking"] = false;
                            console.log("called stop");
                            /**
                             * encode 16bit integer chunk  to wav formate, just add a light weight header, 
                             */
                            const wavChunk = encodeWav(data.chunks, data.length);
                            ondataAvailable?.(wavChunk);
                            // call the callback onDataAvailable
                            break;
                        case 15:// included on enabling vad
                            values.current["volume"] = data.volume;
                            window.requestAnimationFrame(() => {
                                subscribeCallback.current.forEach((callbackFn) => {
                                    callbackFn(values.current);
                                })
                            });

                            break;
                        default:
                            console.log("not matching status key");
                    }


                }, parameters);

                if (AudioRefrence) {
                    initialMainAudioResources.current = AudioRefrence;
                    //getCurrent("AUDIOCONTEXT")?.resume();
                    setMicState(Static_MicState.RECORDING);
                }

            } else {
                getCurrent("AUDIOCONTEXT")?.resume();
                setMicState(Static_MicState.RECORDING);
            }

        } catch (err) {
            console.error("Microphone permission denied or error:", err);
        }
    };

    const Pause = () => {
        getCurrent("AUDIOCONTEXT")?.suspend();
        setMicState(Static_MicState.PAUSED);

        // if (recorderRef.current && MicState === Static_MicState.RECORDING) {
        //     recorderRef.current.pauseRecording();
        //     setMicState(Static_MicState.PAUSED);
        // } else {
        //     console.error("No active session to pause.");
        // }
    };

    const Resume = () => {
        if (recorderRef.current && MicState === Static_MicState.PAUSED) {
            recorderRef.current.resumeRecording();
            setMicState(Static_MicState.RECORDING);
        } else {
            console.error("Nothing to resume.");
        }
    };

    const Stop = () => {
        postMessage({ status: signal.STOP });
        setMicState(0);
        // if (recorderRef.current && MicState !== Static_MicState.STOPPED) {
        //     recorderRef.current.stopRecording(() => {
        //         const audioBlob = recorderRef.current.getBlob();

        //         recorderRef.current.destroy();
        //         recorderRef.current = null;

        //         streamRef.current?.getTracks().forEach((track) => track.stop());
        //         streamRef.current = null;
        //         setMicState(Static_MicState.STOPPED);
        //     });
        // } else {
        //     console.error("Nothing to stop.");
        // }
    };

    return {
        mediaRecorder: getCurrent("MEDIARECORDER"),
        MicState,
        Start,
        Pause,
        Resume,
        Stop,
        Subscribe,
        unSubscribe
    };
}

export default useAudioKitPro;









function encodeWav(int16ArrayChunks, length, sampleRate = 48000) {
    const bytesPerSample = 2;
    const numChannels = 1;

    const totalLength = length || int16ArrayChunks.reduce((sum, arr) => sum + arr.length, 0);
    const buffer = new ArrayBuffer(44 + totalLength * bytesPerSample);
    const view = new DataView(buffer);

    // ===== Write WAV header =====
    writeString(view, 0, 'RIFF'); // ChunkID
    view.setUint32(4, 36 + totalLength * bytesPerSample, true); // ChunkSize
    writeString(view, 8, 'WAVE'); // Format

    writeString(view, 12, 'fmt '); // Subchunk1ID
    view.setUint32(16, 16, true); // Subchunk1Size (PCM)
    view.setUint16(20, 1, true);  // AudioFormat (1 = PCM)
    view.setUint16(22, numChannels, true); // NumChannels
    view.setUint32(24, sampleRate, true); // SampleRate
    view.setUint32(28, sampleRate * numChannels * bytesPerSample, true); // ByteRate
    view.setUint16(32, numChannels * bytesPerSample, true); // BlockAlign
    view.setUint16(34, 16, true); // BitsPerSample

    writeString(view, 36, 'data'); // Subchunk2ID
    view.setUint32(40, totalLength * bytesPerSample, true); // Subchunk2Size

    // ===== Write PCM samples =====
    let offset = 44;
    for (const chunk of int16ArrayChunks) {
        for (let i = 0; i < chunk.length; i++, offset += 2) {
            view.setInt16(offset, chunk[i], true); // Little-endian PCM
        }
    }

    return new Blob([buffer], { type: 'audio/wav' });
}

function writeString(view, offset, str) {
    for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
    }
}

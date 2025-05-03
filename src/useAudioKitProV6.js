import { useEffect, useRef, useState } from "react";
import { url, AUDIO_PROCESSOR_NAME, signal } from './audioProcessorV6'


function isAudioContextActive(context) {
    return context && context.state !== "closed";
}

function isFun(funRefrence) {
    return funRefrence && typeof funRefrence === "function";
}

//------------------------------------------------CONSTANTS end here -----------------------------------------------

/**
 * !NOTE!
 * 
 * AUDIOCONTEXT WITH AUDIOPROCESSOR - Initalization
 * very important
 * idea is to create single audioContext with audioProcessor otherwise it may be heavy
 */

let audioContextCache;
let sampleRateCache;
let workletNodeThreadCache;

async function getAudioContextInstance(sampleRate = 16000) {

    try {
        if (isAudioContextActive(audioContextCache) && (sampleRateCache === sampleRate)) {
            console.log("used cache");
            return [audioContextCache, workletNodeThreadCache];
        } else {
            audioContextCache = new (window?.AudioContext || window?.webkitAudioContext)({ sampleRate });
            sampleRateCache = sampleRate;
            console.log("Actual sample rate:", audioContextCache.sampleRate);
            const promiseOfAddModuleWorklet = audioContextCache?.audioWorklet?.addModule?.(url);
            promiseOfAddModuleWorklet?.catch?.((e) => {
                console.log("not able add addModule VocalProcessor.js may be browser not supporting")
            });
            await promiseOfAddModuleWorklet;
            workletNodeThreadCache = new AudioWorkletNode(audioContextCache, AUDIO_PROCESSOR_NAME);
            console.log("one time initalization");
            console.log("created new");
            return [audioContextCache, workletNodeThreadCache];
        }
    } catch (error) {
        audioContextCache = undefined;
        sampleRateCache = undefined;
        console.error("AudioContext/webkitAudioContext Instance Creation  Or audioWorklet addModule issue ", error);
        return false
    }

}

//------------------------------------------------AUDIOCONTEXT WITH AUDIOPROCESSOR init end here -----------------------------------------------




export const MIC_STATE = {
    STOPPED: signal.STOP,
    RECORDING: signal.START,
    PAUSED: signal.PAUSE
};


const MIC_STATE_CHAR = {
    [signal.STOP]: "S",
    [signal.START]: "R",
    [signal.PAUSE]: "P"
};

async function init(onMessage, unFilteredKey, initialMainAudioResources) {
    const initialSettings = filterKey(unFilteredKey);
    let audioContextInstance;
    try {
        const instanceReady = await getAudioContextInstance(initialSettings.sampleRate);
        if (!instanceReady) throw new Error("Failed to initialize audioContext");
        audioContextInstance = instanceReady[0];
        const workletNodeThread = instanceReady[1];
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                sampleRate: initialSettings.sampleRate,
                channelCount: 1
            }
        });
        //const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });

        const source = audioContextInstance.createMediaStreamSource(stream);
        //=== attaching call back of main thread  so from audioworklet thread can call this callbacks ====
        workletNodeThread.port.onmessage = onMessage;

        /**
         *  passing initial of settings to audio thread
         *  mainly passing signal object refrence one time at start
         */
        initialSettings["signal"] = signal;
        initialSettings["status"] = signal.INIT;


        workletNodeThread.port.postMessage(initialSettings);

        source.connect(workletNodeThread);

        initialMainAudioResources.current['STREAM'] = stream;
        initialMainAudioResources.current['SOURCE'] = source;
        initialMainAudioResources.current['WORKLETHREAD'] = workletNodeThread;
        initialMainAudioResources.current['AUDIOCONTEXT'] = audioContextInstance;
        initialMainAudioResources.current['POSTMESSAGE'] = workletNodeThread.port.postMessage;
        await audioContextInstance.resume();
        return true;

    } catch (e) {
        initialMainAudioResources.current['WORKLETHREAD'] = null;
        console.error("Error during audio initialization:", e);
        await audioContextInstance.suspend();
        return false;
    }
}


/**
 * @author Akash V
 * @contact akashv2000.dev@gmail.com
 * @lastUpdated 03-05-2025
 * 
 * A custom hook for managing audio processing in React.
 */
function useAudioProcessorKit(settings = {}) {
    const [micState, setMicState] = useState(MIC_STATE_CHAR[MIC_STATE.STOPPED]);
    const initialMainAudioResources = useRef({});
    const settingsStateOfaudioProcessing = useRef({ ...settings });
    /**
     * Subscribe way run each small componensts function 
     * so reducing maximum reload of component
     */
    const subscribeCallback = useRef([]);
    const values = useRef({
        volume: 0,
        isSpeaking: false,
        // isStopped: true,
        // isStarted: false,
        // isPause: false,
        micCode: signal.STOP
    });

    const close = () => {
        const currentRef = initialMainAudioResources.current;
        try {
            const source = currentRef?.SOURCE;
            //const workletThread = currentRef?.WORKLETHREAD;
            const audioContext = currentRef?.AUDIOCONTEXT;
            const stream = currentRef?.STREAM;

            source && source.disconnect();
            //workletThread && workletThread.disconnect();
            if (audioContext && audioContext.state !== 'closed') {
                audioContext.suspend(); // we only create one instance per on browser tab so no close
            }
            stream?.getTracks().forEach((track) => track.stop());
            currentRef.STREAM && (currentRef.STREAM = undefined);
        } catch (error) {
            console.error("issue with cleanup");
        }
    }

    useEffect(() => {
        return () => {
            close();
        }
    }, [])

    /**
     * Initializes the audio encoding function based on settings.
     * Chooses either PCM or WAV encoding function based on the provided settings.
     */
    const changeToSenarioBasedFunction = (passedSettings) => {
        const selectedFnToEncode = passedSettings?.audio?.wav === false ? encodePCM16ToBlob : encodeWav;

        const onDataAvailable = isFun(passedSettings?.data?.onAvailable) ? passedSettings.data.onAvailable : () => { };
        const onComplete = isFun(passedSettings?.recording?.onComplete) ? passedSettings.recording.onComplete : () => { };

        settingsStateOfaudioProcessing.current._selectedAudioEncodingFunction = selectedFnToEncode;
        settingsStateOfaudioProcessing.current._onDataAvailable = onDataAvailable;
        settingsStateOfaudioProcessing.current._onComplete = onComplete;

    }

    const onDataAvailableCallBackLogic = (data) => {
        const { _selectedAudioEncodingFunction, _onDataAvailable } = settingsStateOfaudioProcessing.current;
        const audioChunk = _selectedAudioEncodingFunction(data.chunks, data.length, sampleRateCache);
        _onDataAvailable(audioChunk);
    }

    const onComplete_Full_Recording = (data) => {
        const { _selectedAudioEncodingFunction, _onComplete } = settingsStateOfaudioProcessing.current;
        const audioChunk = _selectedAudioEncodingFunction(data.chunks, data.length, sampleRateCache);
        _onComplete(audioChunk);
    }


    const getCurrent = (KEY) => {
        return initialMainAudioResources.current?.[KEY];
    }

    const postMessage = (params) => {
        getCurrent("WORKLETHREAD")?.port?.postMessage?.(params);
    }




    const Subscribe = (callback) => {
        if (callback && typeof callback === "function") {
            return subscribeCallback.current.push(callback) - 1;
        }
    };

    const triggerSubscribeCallback = () => {
        subscribeCallback.current.forEach((callbackFn) => {
            callbackFn?.(values.current);
        })
    }

    const unSubscribe = (index) => {
        if (typeof index === "number" && index >= 0 && index < subscribeCallback.current.length) {
            subscribeCallback.current[index] = null;// not remove if remove all index change lead wrong unsubscribe by other compoenrrs
        }
    };


    const changeStatus = (key) => {
        // values.current.isPause = key === signal.PAUSE;
        // values.current.isStarted = key === signal.START;
        // values.current.isStopped = key === signal.STOP;
        values.current.micCode = key;
        values.current.volume = 0;
        triggerSubscribeCallback();
        setMicState(MIC_STATE_CHAR[key]);
    }



    const Start = async () => {
        if (micState !== "S") {
            console.error("Session already running.");
            return false;
        }

        try {

            if (!initialMainAudioResources.current?.['STREAM']) {
                /**
                 * changeToSenarioBasedFunction function can be used to write your logic to change 
                 * function refrence based on user given settings in audio .
                 */
                changeToSenarioBasedFunction(settingsStateOfaudioProcessing.current);
                const AudioRefrence = await init((event) => {
                    const data = event.data;
                    switch (data.status) {

                        case signal.VAD_SPEAKING_STARTED:
                            values.current["isSpeaking"] = true;
                            break;

                        case signal.VAD_SPEAKING_STOPED:
                            values.current["isSpeaking"] = false;
                            onDataAvailableCallBackLogic(data);
                            break;

                        case signal.AUDIO_CHUNK_TIMER_TRIGGER:
                            onDataAvailableCallBackLogic(data);
                            break;

                        case signal.ON_COMPLETE_FULL_RECORDING_TRIGGER:
                            onComplete_Full_Recording(data);
                            break;

                        case 15:// included on enabling vad
                            values.current["volume"] = data.volume;
                            window.requestAnimationFrame(triggerSubscribeCallback);
                            break;

                        default:
                            console.log("not matching status key");
                    }


                }, settings, initialMainAudioResources);

                if (AudioRefrence) {
                    //initialMainAudioResources.current = AudioRefrence;
                    changeStatus(signal.START);
                }

            } else {
                await getCurrent("AUDIOCONTEXT")?.resume();
                postMessage({ status: signal.START });
                changeStatus(signal.START);
            }
            return true;
        } catch (err) {
            console.error("Microphone permission denied or error:", err);
            return false;
        }
    };

    const Pause = async () => {
        if (micState !== "R") {
            console.error("Not running.");
            return;
        }
        postMessage({ status: signal.PAUSE });
        await getCurrent("AUDIOCONTEXT")?.suspend();
        changeStatus(signal.PAUSE);
    };

    const Resume = async () => {
        if (micState !== "P") {
            console.error("Not Resumed.");
            return;
        }
        postMessage({ status: signal.RESUME });
        await getCurrent("AUDIOCONTEXT")?.resume();
        changeStatus(signal.START);
    };

    const Stop = async () => {
        if (micState === "S") {
            console.error("Not started.");
            return;
        }
        postMessage({ status: signal.STOP });
        await getCurrent("AUDIOCONTEXT")?.suspend();
        changeStatus(signal.STOP);
        close();
    };

    return {
        micState,
        Start,
        Pause,
        Resume,
        Stop,
        Subscribe,
        unSubscribe
    };
}

export { useAudioProcessorKit };




// direct convert int16bit to blob pcm / system that read need to be read with 2 byte to get proper data
function encodePCM16ToBlob(int16ArrayChunks) {
    return new Blob([int16ArrayChunks.buffer], { type: 'audio/pcm' });
}


/**
 * encode 16bit integer chunk  to wav formate, just add a light weight header,
 */
function encodeWav(int16ArrayChunks, length, sampleRate = 16000) {
    const bytesPerSample = 2;
    const numChannels = 1;

    const totalLength = length || int16ArrayChunks.reduce((sum, arr) => sum + arr.length, 0);
    const buffer = new ArrayBuffer(44 + totalLength * bytesPerSample);
    const view = new DataView(buffer);

    // ===== Write WAV header =====
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + totalLength * bytesPerSample, true);
    writeString(view, 8, 'WAVE');

    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * bytesPerSample, true);
    view.setUint16(32, numChannels * bytesPerSample, true);
    view.setUint16(34, 16, true);

    writeString(view, 36, 'data');
    view.setUint32(40, totalLength * bytesPerSample, true);

    // ===== Write PCM samples =====
    let offset = 44;
    for (const chunk of int16ArrayChunks) {
        for (let i = 0; i < chunk.length; i++, offset += 2) {
            view.setInt16(offset, chunk[i], true);
        }
    }

    return new Blob([buffer], { type: 'audio/wav' });
}

function writeString(view, offset, str) {
    for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
    }
}

/**
 * clearning function from initialSettings beacaue workletNodeThread cannot serialize function
 */
function filterKey(unCleanObject) {
    const result = {};

    const vad = unCleanObject?.vad;
    if (vad && typeof vad === 'object') {
        result.vad = {
            enabled: !!vad.enabled,
            speakDetectionDelayMs: vad.speakDetectionDelayMs || 30,
            silenceDetectionDelayMs: vad.silenceDetectionDelayMs || 50,
            noiseFloor: vad.noiseFloor || 0.008,
        };
    }

    const recording = unCleanObject?.recording;
    if (recording && typeof recording === 'object') {
        result.recording = {
            enabled: !!recording.enabled,
        };
    }

    const timing = unCleanObject?.timing;
    if (timing && typeof timing === 'object') {
        result.timing = {
            interval: timing.interval || 1000,
            volumeVisualization: !!timing.volumeVisualization,
        };
    }

    const audio = unCleanObject?.audio;
    if (audio && typeof audio === 'object') {
        result.audio = {
            wav: !!audio.wav,
            sampleRate: audio.sampleRate || 16000,
        };
    }

    return result;
}

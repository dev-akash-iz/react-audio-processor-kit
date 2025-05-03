
export const AUDIO_PROCESSOR_NAME = 'audio-processor';
const signal = {
    PAUSE: 2,
    RESUME: 4,
    STOP: 3,
    INIT: 1,
    START: 6,
    VAD_SPEAKING_STARTED: 10,
    VAD_SPEAKING_STOPED: 12,
    AUDIO_CHUNK_TIMER_TRIGGER: 11,
    ON_COMPLETE_FULL_RECORDING_TRIGGER: 13,
}

// ! important currenly 128 is contantly given in each channelData.length given are
// by AudioWorkletProcessor documentation can have posiblity to change to more than 128
// so change to dynamic by using length . if found more than 128 currently  iam not able to
// see more than 128 so to impove some performance i just add constant of 128

/**
 * @author Akash V
 * @contact akashv2000.dev@gmail.com
 * @lastUpdated 03-04-2025
 * 
 * AudioProcessor written to give VOD  , time based , full recording audio by default
 * and architechtured in a way to make out maximum performance
 */


const AudioProcessor = `

class AudioProcessor extends AudioWorkletProcessor {

    constructor() {
        super();
        console.log("Hello :) from AudioProcessor V6");
        this._readyTolisten = false;
        this._needToSaveAudio = false;
        this._enableVad = false;

        /**
         * WebAudio calls process() every time, we can't replace it.
         * So we use _runtimeProcess inside it, and change _runtimeProcess
         * to whatever function we need (like with VAD or without).
         * This way we avoid if checks and get better performance.
         */
        this._runtimeProcess = () => true; // default dummy function

        /**
         * variables for vad feature
         */
        this._peakNoticedFrameCount = 0;
        this._peakMaxFrame = 30;//sound start 90ms
        this._silenceNoticedFrameCount = 0;
        this._silentMaxFrame = 70; // 70 FRAME OF EACH 3MS TO 60*3 GIVES '180MS' OF SILENT MEANS TRIGGERS
        this._facedAnyPeakVolume = false; // a variable which allow to vad to save if meet peak condtion
        this._noiseFloor = 0.004;
        /**
         * variables for need to save audio to record total session from start to stop
         */
        this._totalSessionLength = 0;
        this._totalSession = [];

        /**
         * variables for need to save audio per given Time in frame or based on VAD
         */
        this._buffer2dArray16Bit = [];
        this._buffer2dpreCaluculatingLength = 0;


        /**
         * for Volume level of audio needed for virtualization and others
         * this rms volume data is update to main thread per the given frame
         */
        this._VolumeUpdateframe = 5; //15MS to get 60 frame rate like smooth
        this._currentVolumeFrame = 0;

        /***
         * calls callback to get pass audio chunk data in nonvad senario data to main thread by  given frame time
         */
        this.maxTimeTriggerSecondsInFrame = 333; // here 1 second default time , 3 ms apprx be the time to call process ,
        this.currentTimeTriggerSecondsInFrame = 0;

        this._enabledTimeIntervalVolumeVisualization = false;


        /**
         *  Communicate with main thread
         */
        this.port.onmessage = (event) => {
            const params = event.data;
            switch (params.status) {
                case 1://this.signal.INIT
                    this._initialAssign(params);
                    break;
                case this.signal.PAUSE:
                    this._readyTolisten = false;
                    break;

                case this.signal.START:
                    this._readyTolisten = true;
                    break;

                case this.signal.RESUME:
                    this._readyTolisten = true;
                    break;

                case this.signal.STOP:
                    this._readyTolisten = false;

                    if (this._needToSaveAudio) {
                        const transferList = this._totalSession.map(chunk => chunk.buffer);
                        this.port.postMessage({
                            status: this.signal.ON_COMPLETE_FULL_RECORDING_TRIGGER,
                            chunks: this._totalSession,
                            length: this._totalSessionLength
                        }, transferList);
                        this._totalSession = [];
                        this._totalSessionLength = 0;
                    }

                    break;
                default:
                    console.log("not matching status key");
            }
        };
    }

    _initialAssign(params) {
        this.signal = params.signal;
        this._updateSettings(params);
        this._readyTolisten = true;
    }

    _updateSettings(params) {
        this._enableVad = !!params?.vad?.enabled; //default False
        this._needToSaveAudio = !!params?.recording?.enabled; //default False
        /**
         * time based settings
         * all in Millisecond
         */
        this.maxTimeTriggerSecondsInFrame = this.msToFrame(params?.timing?.interval || 1000) //default timeSlice is 1000 ms
        this._enabledTimeIntervalVolumeVisualization = params?.timing?.volumeVisualization;
        /**
         * vad based settings
         * all in Millisecond
         */
        this._peakMaxFrame = this.msToFrame(params?.vad?.speakDetectionDelayMs || 90); // default max time confirm by system that user is started speaking
        this._silentMaxFrame = this.msToFrame(params?.vad?.silenceDetectionDelayMs || 210); // default max time confirm by system that user is stopped speaking
        this._noiseFloor = params?.vad?.noiseFloor || 0.004;
        this._chooseProcess();
    }

    /**
     * logic to assign audioworklet process function to a function refrent  wich only do the nesscery work ,Not other things
     *  to reduce performance
     */
    _chooseProcess() {
        if (this._enableVad && this._needToSaveAudio) {
            this._runtimeProcess = this.Process_With_Vad_And_FullRecording.bind(this);
        } else if (this._enableVad) {
            this._runtimeProcess = this.Process_With_Vad.bind(this);
        } else if (this._enabledTimeIntervalVolumeVisualization) {
            this._runtimeProcess = this.Process_TiME_BASED_With_Only_VolumeVisualization.bind(this);
        } else {
            this._runtimeProcess = this.Process_TiME_BASED_Without_vad_and_FullRecording.bind(this);
        }
        // why this pattern ? it reduce braching improve performance way more
    }

    process(inputs, outputs, parameters) { //  at run time we can change inner funtion , this is dynamically changged
        if (!this._readyTolisten) return true;

        return this._runtimeProcess(inputs, outputs, parameters);
    }

    Process_TiME_BASED_Without_vad_and_FullRecording(inputs, outputs, parameters) {

        const input = inputs[0];

        const channelData = input[0]; // taking first channel
        if (this.currentTimeTriggerSecondsInFrame > this.maxTimeTriggerSecondsInFrame) {
            const transferList = this._buffer2dArray16Bit.map(chunk => chunk.buffer);
            this.port.postMessage({
                status: this.signal.AUDIO_CHUNK_TIMER_TRIGGER,
                // speaking: false,
                chunks: this._buffer2dArray16Bit,
                length: this._buffer2dpreCaluculatingLength
            }, transferList);

            this.currentTimeTriggerSecondsInFrame = 0;
            this._buffer2dArray16Bit = [];
            this._buffer2dpreCaluculatingLength = 0;
            return true;
        } else {
            this.currentTimeTriggerSecondsInFrame++;
        }
        const converted16bit_array = this.float32ToInt16(channelData);
        this._buffer2dArray16Bit.push(converted16bit_array);
        this._buffer2dpreCaluculatingLength += converted16bit_array.length;
        return true;
    }

    Process_TiME_BASED_With_Only_VolumeVisualization(inputs, outputs, parameters) {

        const input = inputs[0];

        const channelData = input[0]; // taking first channel

        this.isSilent(channelData);

        if (this.currentTimeTriggerSecondsInFrame > this.maxTimeTriggerSecondsInFrame) {
            const transferList = this._buffer2dArray16Bit.map(chunk => chunk.buffer);
            this.port.postMessage({
                status: this.signal.AUDIO_CHUNK_TIMER_TRIGGER,
                // speaking: false,
                chunks: this._buffer2dArray16Bit,
                length: this._buffer2dpreCaluculatingLength
            }, transferList);

            this.currentTimeTriggerSecondsInFrame = 0;
            this._buffer2dArray16Bit = [];
            this._buffer2dpreCaluculatingLength = 0;
            return true;
        } else {
            this.currentTimeTriggerSecondsInFrame++;
        }
        const converted16bit_array = this.float32ToInt16(channelData);
        this._buffer2dArray16Bit.push(converted16bit_array);
        this._buffer2dpreCaluculatingLength += converted16bit_array.length;
        return true;
    }


    Process_With_Vad_And_FullRecording(inputs, outputs, parameters) {
        const input = inputs[0];
        if (input.length) {

            const channelData = input[0]; // taking first channel
            //faced any peak audio is important because it ensure we not passing empty data to backed
            if (this.isSilent(channelData)) {

                if (!this._facedAnyPeakVolume) {
                    this._peakNoticedFrameCount && (this._peakNoticedFrameCount = 0);
                    return true;   //early exit not valid audio
                }


                this._silenceNoticedFrameCount++;

                //60 FRAME OF EACH 3MS TO 60*3 GIVES '180MS'
                if (this._silenceNoticedFrameCount > this._silentMaxFrame) {
                    const transferList = this._buffer2dArray16Bit.map(chunk => chunk.buffer);

                    this.port.postMessage({
                        status: this.signal.VAD_SPEAKING_STOPED,
                        // speaking: false,
                        chunks: this._buffer2dArray16Bit,
                        length: this._buffer2dpreCaluculatingLength
                    }, transferList);

                    this._buffer2dArray16Bit = [];
                    this._buffer2dpreCaluculatingLength = 0;
                    this._silenceNoticedFrameCount = 0;
                    this._facedAnyPeakVolume = false;
                    this._peakNoticedFrameCount = 0;
                    return true;
                }


            } else {
                // here the logic is i show is speaking data after some real word passed so i wait 180 ms of continuos speach before declaring it is speaking
                if ((!this._facedAnyPeakVolume) && this._peakNoticedFrameCount > this._peakMaxFrame) {
                    // Notify UI that voice HEARD and may started speaking
                    this.port.postMessage({ status: this.signal.VAD_SPEAKING_STARTED });
                    this._facedAnyPeakVolume = true;
                }

                !this._facedAnyPeakVolume && this._peakNoticedFrameCount++;
                this._silenceNoticedFrameCount = 0;

            }

            const converted16bit_array = this.float32ToInt16(channelData);
            this._totalSession.push(new Int16Array(converted16bit_array));
            this._buffer2dArray16Bit.push(converted16bit_array);
            this._totalSessionLength += converted16bit_array.length;
            this._buffer2dpreCaluculatingLength += converted16bit_array.length;

        }

        // Keep processor alive
        return true;
    }

    Process_With_Vad(inputs, outputs, parameters) {
        const input = inputs[0];
        if (input.length) {

            const channelData = input[0]; // taking first channel
            //faced any peak audio is important because it ensure we not passing empty data to backed
            if (this.isSilent(channelData)) {

                if (!this._facedAnyPeakVolume) {
                    this._peakNoticedFrameCount && (this._peakNoticedFrameCount = 0);
                    return true;   //early exit not valid audio
                }


                this._silenceNoticedFrameCount++;

                //60 FRAME OF EACH 3MS TO 60*3 GIVES '180MS'
                if (this._silenceNoticedFrameCount > this._silentMaxFrame) {
                    const transferList = this._buffer2dArray16Bit.map(chunk => chunk.buffer);

                    this.port.postMessage({
                        status: this.signal.VAD_SPEAKING_STOPED,
                        // speaking: false,
                        chunks: this._buffer2dArray16Bit,
                        length: this._buffer2dpreCaluculatingLength
                    }, transferList);

                    this._buffer2dArray16Bit = [];
                    this._buffer2dpreCaluculatingLength = 0;
                    this._silenceNoticedFrameCount = 0;
                    this._facedAnyPeakVolume = false;
                    this._peakNoticedFrameCount = 0;
                    return true;
                }


            } else {
                // here the logic is i show is speaking data after some real word passed so i wait 180 ms of continuos speach before declaring it is speaking
                if ((!this._facedAnyPeakVolume) && this._peakNoticedFrameCount > this._peakMaxFrame) {
                    // Notify UI that voice HEARD and may started speaking
                    this.port.postMessage({ status: this.signal.VAD_SPEAKING_STARTED });
                    this._facedAnyPeakVolume = true;
                }

                !this._facedAnyPeakVolume && this._peakNoticedFrameCount++;
                this._silenceNoticedFrameCount = 0;

            }

            const converted16bit_array = this.float32ToInt16(channelData);
            this._buffer2dArray16Bit.push(converted16bit_array);
            this._buffer2dpreCaluculatingLength += converted16bit_array.length;
        }

        // Keep processor alive
        return true;
    }


    /**
     * Convert 32 bit float to 16 bit int
     * example
     * [
     *  1.99999988079071044921875  to normalize between 16 bit int meaning convert under 35000
     *  by just multipling point number to 35000 and also (32000 for negative value )
     *  by this we get convert 32 bit to 16 bit
     *  int
     * ]
     * @param {*} float32Array
     * @returns INTEGER
     */
    float32ToInt16(float32Array) {
        const len=float32Array.length;
        const int16Array = new Int16Array(len);
        for (let i = 0; i < len; i++) {
            let s = Math.max(-1, Math.min(1, float32Array[i]));
            int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        return int16Array;
    }

    /**
     * get silent and peak from value under 0 to 1
     *
     * v3 - new changes
     * In this version i simply only checking half value
     * it is ok till we get positive result same reslt not major accurasy issue
     * and get performance bost
     *
     * @param {*} buffer
     * @returns float
     */
    getRMS(buffer) {
        let sumSquares = 0;
        const len = buffer.length;
        /**
         * idea is to get a single value from 0 to 1 from all 128 values from this list;
         * mathematically just 20/100 gives 0.2 like that adding each  give 128 value and total is 128.
         * which is 128/128 gives 1
         *
         * this is base idea other than it all normallization of each single 128 value
         * like if value is minus making is positive ,  any way it will not exede 1 so allways
         * its total lesst than or equal to 128 why becaous is each maxmimum is 1 then 1*128 gives 128
         *
         * finally sqaure rooting to get lowest round value we are doing this
         * without it also we can work in this
         *
         */
        for (let i = 0; i < len; i++) {
            sumSquares += buffer[i] * buffer[i];
        }
        /**
         *  here constent 0.0078125 equivalent of 128  basically iam doing division in fastest way
         *  multiplicational divition is faster than actual division in cpu
         *  1/128 gives 0.0078125 simply just multiply by it you get its value
         */
        return Math.sqrt(sumSquares / len);
    }

    /**
     * analyse for silence in audio bit
     * with our given constant value
     * @param {*} buffer 128 32bit float
     * @returns boolean
     */
    isSilent(buffer) {
        const rms = this.getRMS(buffer);
        // this.port.postMessage({
        //     status: 15,
        //     volume: rms,
        // });
        if (this._currentVolumeFrame > this._VolumeUpdateframe) {
            this._currentVolumeFrame = 0;
            this.port.postMessage({
                status: 15,
                volume: rms,
            });
        } else {
            this._currentVolumeFrame++;
        }

        return rms < this._noiseFloor;
    }

    /**
     *
     * a function to convert millisecond to frame
     * here 3ms i choosen for one frame so i precalculated fast division way by multiplying 1/3 to
     */
    msToFrame(totalMs = 0) {
        return 0.5 + (totalMs * 0.3333333333333333) | 0;
    }



}


   registerProcessor('audio-processor', AudioProcessor);
`;

// Convert string to Blob and Object URL
const blob = new Blob([AudioProcessor], { type: 'application/javascript' });
const url = URL.createObjectURL(blob);



export { url, signal };


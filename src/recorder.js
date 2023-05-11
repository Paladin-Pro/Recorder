import getRecorderWorker from './worker';

export class Recorder {
    config = {
        bufferLen: 4096,
        numChannels: 2,
        mimeType: 'audio/wav'
    };

    recording = false;

    callbacks = {
        getBuffer: [],
        exportWAV: []
    };

    constructor(source, cfg) {
        Object.assign(this.config, cfg);
        this.setup(source);

        this.worker = getRecorderWorker();

        this.worker.postMessage({
            command: 'init',
            config: {
                sampleRate: this.context.sampleRate,
                numChannels: this.config.numChannels
            }
        });

        this.worker.onmessage = (e) => {
            let cb = this.callbacks[e.data.command].pop();
            if (typeof cb == 'function') {
                cb(e.data.data);
            }
        };
    }

    setup(source) {
        if(this.node) { // Disconnect previous node
            this.node.disconnect();
        }

        if(source) {
            this.context = source.context;
            this.node = (this.context.createScriptProcessor ||
            this.context.createJavaScriptNode).call(this.context,
                this.config.bufferLen, this.config.numChannels, this.config.numChannels);
    
            this.node.onaudioprocess = (e) => {
                if (!this.recording) return;
    
                var buffer = [];
                for (var channel = 0; channel < this.config.numChannels; channel++) {
                    buffer.push(e.inputBuffer.getChannelData(channel));
                }
                this.worker.postMessage({
                    command: 'record',
                    buffer: buffer
                });
            };
    
            source.connect(this.node);
            this.node.connect(this.context.destination);    //this should not be necessary
        }
    }


    record() {
        this.recording = true;
    }

    stop() {
        this.recording = false;
    }

    clear() {
        this.worker.postMessage({command: 'clear'});
    }

    getBuffer(cb) {
        cb = cb || this.config.callback;
        if (!cb) throw new Error('Callback not set');

        this.callbacks.getBuffer.push(cb);

        this.worker.postMessage({command: 'getBuffer'});
    }

    exportWAV(cb, mimeType) {
        mimeType = mimeType || this.config.mimeType;
        cb = cb || this.config.callback;
        if (!cb) throw new Error('Callback not set');

        this.callbacks.exportWAV.push(cb);

        this.worker.postMessage({
            command: 'exportWAV',
            type: mimeType
        });
    }

    static
    forceDownload(blob, filename) {
        if(window.navigator && window.navigator.msSaveOrOpenBlob) {
            window.navigator.msSaveOrOpenBlob(e, filename);
        } else {
            let link = window.document.createElement("a");
            let url = (window.URL || window.webkitURL).createObjectURL(blob);
            window.document.body.appendChild(link);
            link.href = url;
            link.download = filename || "output.wav";
            link.click();
            window.URL.revokeObjectURL(url);
        }
    }
}

export default Recorder;

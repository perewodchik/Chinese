// Hands the microphone's raw samples to the page, a couple of thousand at a
// time. A static file rather than an inline blob, because the site's
// Content-Security-Policy allows scripts from its own origin only.
class Capture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = new Float32Array(2048);
    this.filled = 0;
  }

  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (channel) {
      let at = 0;
      while (at < channel.length) {
        const n = Math.min(channel.length - at, this.buffer.length - this.filled);
        this.buffer.set(channel.subarray(at, at + n), this.filled);
        this.filled += n;
        at += n;
        if (this.filled === this.buffer.length) {
          this.port.postMessage(this.buffer);
          this.buffer = new Float32Array(2048);
          this.filled = 0;
        }
      }
    }
    return true;
  }
}

registerProcessor('capture', Capture);

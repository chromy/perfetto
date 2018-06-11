/*
 * Copyright (C) 2018 The Android Open Source Project
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

class TraceProcessorBridge {
  wasm_?: any = undefined;
  file_?: File = undefined;
  // @ts-ignore
  fileReader = new FileReaderSync();

  constructor() {
  }

  get file(): File {
    console.assert(this.file_);
    if (!this.file_)
      throw "Error!";
    return this.file_;
  }

  set file(f: File) {
    console.assert(!this.file_);
    this.file_ = f;
    this.maybeInitialize();
  }

  onRuntimeInitialized(wasm: any) {
    console.assert(!this.wasm_);
    this.wasm_ = wasm;
    this.maybeInitialize();
  }

  maybeInitialize() {
    console.log('maybeInitialize', this.wasm_, this.file_);
    if (!this.wasm_ || !this.file_)
      return;
    const readTraceFn = this.wasm_.addFunction(this.readTraceData.bind(this), 'iiii');
    const replyFn = this.wasm_.addFunction(this.reply.bind(this), 'viiii');
    this.wasm_.ccall('Initialize', 'void',
      ['number', 'number'],
      [readTraceFn, replyFn]);
  }

  readTraceData(offset: number, len: number, dstPtr: number): number {
    const slice = this.file.slice(offset, offset + len);
    const buf: ArrayBuffer = this.fileReader.readAsArrayBuffer(slice);
    const buf8 = new Uint8Array(buf);
    this.wasm_.HEAPU8.set(buf8, dstPtr);
    return buf.byteLength;
  }

  reply(reqId: number, success: boolean, heapPtr: number, size: number) {
    const data = this.wasm_.HEAPU8.slice(heapPtr, heapPtr + size);
    console.log('reply', reqId, success, data);
  }

  query() {
    this.wasm_.ccall('ExecuteQuery', 'void', [], []);
  }
}

function main() {
  console.log('Hello from processor!');

  const bridge = new TraceProcessorBridge();

  (self as any).onmessage = (msg: any) => {
    switch (msg.data.topic) {
      case "load_file":
        const file = msg.data.file;
        bridge.file = file;
        break;
      case "query":
        bridge.query();
        break
    }
  };

  (self as any).Module = {
    locateFile: (s: any) => {
      const parts = location.pathname.split('/');
      const base = parts.splice(0, parts.length-1).join('/');
      const path = `${base}/${s}`
      console.log('locateFile', s, base, path);
      return path;
    },
    onRuntimeInitialized: () => bridge.onRuntimeInitialized((self as any).Module),
    print: (s: string) => console.log(s),
    printErr: (s: string) => console.warn(s), 
  };

  (self as any).importScripts('trace_processor.js');
}

export {
  main,
}

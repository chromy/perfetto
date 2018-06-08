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
  wasm?: any;
  file?: File;
  wasmReady: boolean = false;
  // @ts-ignore
  fileReader = new FileReaderSync();

  constructor() {
    this.wasm = null;
  }

  onRuntimeInitialized(wasm: any) {
    console.assert(!this.wasmReady);
    this.wasmReady = true;
    this.wasm = wasm;
    console.log('onRuntimeInitialized');
    const readTraceFn = this.wasm.addFunction(this.readTraceData.bind(this), 'iiii');
    this.wasm.ccall('Initialize', 'void', ['number'], [readTraceFn]);
  }

  readTraceData(offset: number, len: number, dstPtr: number): number {
    if (!this.file) {
      console.assert(false);
      return 0;
    }
    const slice = this.file.slice(offset, offset + len);
    const buf: ArrayBuffer = this.fileReader.readAsArrayBuffer(slice);
    const buf8 = new Uint8Array(buf);
    this.wasm.HEAPU8.set(buf8, dstPtr);
    return buf.byteLength;
  }
}

function main() {
  console.log('Hello from processor!');

  const bridge = new TraceProcessorBridge();

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

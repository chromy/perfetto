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

import { createReceiver } from '../ipc';
import { RawQueryArgs, RawQueryResult } from '../backend/protos';

class TraceProcessorBridge {
  wasm_?: any = undefined;
  blob_?: Blob = undefined;
  ready: boolean = false;
  pendingInitialized: Promise<void>;
  resolvePendingInitialized: () => void;
  requestId: number;
  pendingRequests: {[id: number]: (result: any) => void};

  // @ts-ignore
  blobReader = new FileReaderSync();

  constructor() {
    this.pendingRequests = {};
    this.requestId = 0;
    this.resolvePendingInitialized = () => {};
    this.pendingInitialized = new Promise<void>(resolve => {
      this.resolvePendingInitialized = resolve;
    });
  }

  get blob(): Blob {
    console.assert(this.blob_);
    if (!this.blob_)
      throw "Error!";
    return this.blob_;
  }

  set blob(f: Blob) {
    console.assert(!this.blob_);
    this.blob_ = f;
    this.maybeInitialize();
  }

  loadBlob(blob: Blob): Promise<void> {
    this.blob = blob;
    return this.pendingInitialized;
  }

  onRuntimeInitialized(wasm: any) {
    console.assert(!this.wasm_);
    this.wasm_ = wasm;
    this.maybeInitialize();
  }

  maybeInitialize() {
    if (!this.wasm_ || !this.blob_)
      return;
    const readTraceFn = this.wasm_.addFunction(this.readTraceData.bind(this), 'iiii');
    const replyFn = this.wasm_.addFunction(this.reply.bind(this), 'viiii');
    this.wasm_.ccall('Initialize', 'void',
      ['number', 'number'],
      [readTraceFn, replyFn]);
  }

  readTraceData(offset: number, len: number, dstPtr: number): number {
    const slice = this.blob.slice(offset, offset + len);
    const buf: ArrayBuffer = this.blobReader.readAsArrayBuffer(slice);
    const buf8 = new Uint8Array(buf);
    this.wasm_.HEAPU8.set(buf8, dstPtr);
    return buf.byteLength;
  }

  reply(requestId: number, success: boolean, heapPtr: number, size: number) {
    if (!this.ready) {
      this.ready = true;
      this.resolvePendingInitialized();
      return;
    }

    const data = this.wasm_.HEAPU8.slice(heapPtr, heapPtr + size);
    console.assert(success);
    console.assert(this.pendingRequests[requestId]);

    const result = RawQueryResult.decode(data);

    this.pendingRequests[requestId](result);
    delete this.pendingRequests[requestId];
  }

  query(s: string): Promise<void> {
    const requestId = this.requestId++;
    const pending = new Promise<void>(resolve => {
      this.pendingRequests[requestId] = resolve;
    });

    const buf = RawQueryArgs.encode({
      sqlQuery: s
    }).finish();

    this.wasm_.ccall('ExecuteQuery', 'void', [
      'number', 'array', 'number',
    ], [
      requestId, buf, buf.length
    ]);
    return pending;
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
      return path;
    },
    onRuntimeInitialized: () => bridge.onRuntimeInitialized((self as any).Module),
    print: (s: string) => console.log(s),
    printErr: (s: string) => console.warn(s), 
  };

  (self as any).importScripts('trace_processor.js');
  const channel = new MessageChannel();
  const txPort = channel.port1;
  const rxPort = channel.port2;

  createReceiver<TraceProcessorBridge>(rxPort, bridge);
  (self as any).postMessage(txPort, [txPort]);
}

export {
  main,
  TraceProcessorBridge,
}

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

class Receiver<T extends object> {
  client: T;
  port: MessagePort;

  constructor(port: MessagePort, client: T) {
    this.port = port;
    this.client = client;
    this.port.onmessage = this.recv.bind(this);
  }

  recv(msg: any) {
    const name: string = msg.data.name;
    const args: any[] = msg.data.args;
    const requestId: number = msg.data.requestId;
    const pending: Promise<any> = (this.client as any)[name].apply(this.client, args);
    pending.then(result => this.send(requestId, result));
  }

  send(requestId: number, result: any) {
    this.port.postMessage({
      requestId,
      result,
    });
  }

};

class SenderTarget {
  port: MessagePort;
  requestId: number;
  pendingRequests: {[id: number]: (result: any) => void};

  constructor(port: MessagePort) {
    this.port = port;
    this.requestId = 0;
    this.pendingRequests = {};
    this.port.onmessage = this.recv.bind(this);
  }

  recv(msg: any) {
    const requestId = msg.data.requestId;
    const result = msg.data.result;
    console.assert(this.pendingRequests[requestId]);
    this.pendingRequests[requestId](result);
    delete this.pendingRequests[requestId];
  }

  send(name: PropertyKey, args: any[]): Promise<any> {
    const requestId = this.requestId++;
    const pending = new Promise(resolve => {
      this.pendingRequests[requestId] = resolve;
    });
    this.port.postMessage({
      requestId,
      name,
      args, 
    });
    return pending;
  } 
}

class SenderHandler<T extends object> implements ProxyHandler<T> {
  constructor() {
  }

  get(rawTarget: T, p: PropertyKey, _receiver: any) {
    const target = (rawTarget as SenderTarget);
    return function(...args: any[]) {
      return target.send(p, args);
    };
  }
};

function createReceiver<T extends object>(port: MessagePort, client: T): Receiver<T> {
  return new Receiver<T>(port, client);
}

function createSender<T extends object>(port: MessagePort): T {
  const target = new SenderTarget(port);
  return new Proxy<T>((target as any), new SenderHandler<T>());
}

export {
  createSender,
  createReceiver,
};


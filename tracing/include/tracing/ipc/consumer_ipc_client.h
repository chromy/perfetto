/*
 * Copyright (C) 2017 The Android Open Source Project
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

#ifndef TRACING_INCLUDE_IPC_CONSUMER_IPC_CLIENT_H_
#define TRACING_INCLUDE_IPC_CONSUMER_IPC_CLIENT_H_

#include <memory>
#include <string>

#include "tracing/core/service.h"

namespace perfetto {

class Consumer;

// Allows to connect to a remote Service through a UNIX domain socket.
// Exposed to:
//   Consumer(s) and Consumer(s) of the tracing library.
// Implemented in:
//   src/ipc/producer/producer_ipc_client_impl.cc
class ConsumerIPCClient {
 public:
  // Connects to the producer port of the Service listening on the given
  // |service_sock_name|. If the connection is successful, the OnConnect()
  // method will be invoked asynchronously on the passed Consumer interface.
  // If the connection fails, OnDisconnect() will be invoked instead.
  // The returned ConsumerEndpoint serves also to delimit the scope of the
  // callbacks invoked on the Consumer interface: no more Consumer callbacks are
  // invoked immediately after its destruction and any pending callback will be
  // dropped.
  static std::unique_ptr<Service::ConsumerEndpoint>
  Connect(const char* service_sock_name, Consumer*, base::TaskRunner*);

 protected:
  ConsumerIPCClient() = delete;
};

}  // namespace perfetto

#endif  // TRACING_INCLUDE_IPC_CONSUMER_IPC_CLIENT_H_

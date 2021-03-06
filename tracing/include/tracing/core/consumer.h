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

#ifndef TRACING_INCLUDE_TRACING_CORE_CONSUMER_H_
#define TRACING_INCLUDE_TRACING_CORE_CONSUMER_H_

#include "tracing/core/basic_types.h"

#include <vector>

namespace perfetto {

class DataSourceConfig;
class SharedMemory;
class TracePacket;

class Consumer {
 public:
  virtual ~Consumer() = default;

  // Called by Service (or more typically by the transport layer, on behalf of
  // the remote Service), once the Consumer <> Service connection has been
  // established.
  virtual void OnConnect() = 0;

  // Called by the Service or by the transport layer if the connection with the
  // service drops, either voluntarily (e.g., by destroying the ConsumerEndpoint
  // obtained through Service::ConnectConsumer()) or involuntarily (e.g., if the
  // Service process crashes).
  virtual void OnDisconnect() = 0;

  virtual void OnTraceData(const std::vector<TracePacket>&, bool has_more) = 0;
};

}  // namespace perfetto

#endif  // TRACING_INCLUDE_TRACING_CORE_CONSUMER_H_

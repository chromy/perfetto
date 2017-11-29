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

#include "tracing/src/ipc/service/consumer_ipc_service.h"

#include <inttypes.h>

#include "base/logging.h"
#include "base/task_runner.h"
#include "ipc/host.h"
#include "tracing/core/service.h"
#include "tracing/core/trace_config.h"
#include "tracing/core/trace_packet.h"

namespace perfetto {

ConsumerIPCService::ConsumerIPCService(Service* core_service)
    : core_service_(core_service), weak_ptr_factory_(this) {}

ConsumerIPCService::~ConsumerIPCService() = default;

ConsumerIPCService::RemoteConsumer*
ConsumerIPCService::GetConsumerForCurrentRequest() {
  const ipc::ClientID ipc_client_id = ipc::Service::client_info().client_id();
  PERFETTO_CHECK(ipc_client_id);
  auto it = consumers_.find(ipc_client_id);
  if (it == consumers_.end()) {
    auto* remote_consumer = new RemoteConsumer();
    consumers_[ipc_client_id].reset(remote_consumer);
    remote_consumer->service_endpoint =
        core_service_->ConnectConsumer(remote_consumer);
    return remote_consumer;
  }
  return it->second.get();
}

// Called by the IPC layer.
void ConsumerIPCService::OnClientDisconnected() {
  ipc::ClientID client_id = ipc::Service::client_info().client_id();
  PERFETTO_DLOG("Consumer %" PRIu64 " disconnected", client_id);
  consumers_.erase(client_id);
}

// Called by the IPC layer.
void ConsumerIPCService::EnableTracing(const EnableTracingRequest& req,
                                       DeferredEnableTracingResponse resp) {
  // TODO: fix const correctness by adding a ctor that takes a const& ref to
  // TraceConfig.
  const TraceConfig trace_config(
      const_cast<EnableTracingRequest&>(req).mutable_trace_config());
  GetConsumerForCurrentRequest()->service_endpoint->EnableTracing(trace_config);
  resp.Resolve(ipc::AsyncResult<EnableTracingResponse>::Create());
}

void ConsumerIPCService::DisableTracing(const DisableTracingRequest& req,
                                        DeferredDisableTracingResponse resp) {
  GetConsumerForCurrentRequest()->service_endpoint->DisableTracing();
  resp.Resolve(ipc::AsyncResult<DisableTracingResponse>::Create());
}

void ConsumerIPCService::ReadBuffers(const ReadBuffersRequest& req,
                                     DeferredReadBuffersResponse resp) {
  RemoteConsumer* remote_consumer = GetConsumerForCurrentRequest();
  remote_consumer->read_buffers_response = std::move(resp);
  remote_consumer->service_endpoint->ReadBuffers();
}

void ConsumerIPCService::FreeBuffers(const FreeBuffersRequest& req,
                                     DeferredFreeBuffersResponse resp) {
  GetConsumerForCurrentRequest()->service_endpoint->FreeBuffers();
  resp.Resolve(ipc::AsyncResult<FreeBuffersResponse>::Create());
}

////////////////////////////////////////////////////////////////////////////////
// RemoteConsumer methods
////////////////////////////////////////////////////////////////////////////////

ConsumerIPCService::RemoteConsumer::RemoteConsumer() = default;
ConsumerIPCService::RemoteConsumer::~RemoteConsumer() = default;

// Invoked by the |core_service_| business logic after the ConnectConsumer()
// call. There is nothing to do here, we really expected the ConnectConsumer()
// to just work in the local case.
void ConsumerIPCService::RemoteConsumer::OnConnect() {}

// Invoked by the |core_service_| business logic after we destroy the
// |service_endpoint| (in the RemoteConsumer dtor).
void ConsumerIPCService::RemoteConsumer::OnDisconnect() {}

void ConsumerIPCService::RemoteConsumer::OnTraceData(
    const std::vector<TracePacket>& trace_packets,
    bool has_more) {
  if (!read_buffers_response.IsBound())
    return;

  auto result = ipc::AsyncResult<ReadBuffersResponse>::Create();
  result.set_has_more(has_more);
  for (const TracePacket& trace_packet : trace_packets)
    result->add_trace_packets(trace_packet.start(), trace_packet.size());

  // TODO lifetime: does the IPC layer guarantee that the arguments of the
  // resolved responses are used inline and not kept around? If not, the
  // start() trace_packet pointers will become invalid.
  read_buffers_response.Resolve(std::move(result));
}

}  // namespace perfetto

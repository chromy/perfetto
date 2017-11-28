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

#include "tracing/src/ipc/consumer/consumer_ipc_client_impl.h"

#include <inttypes.h>
#include <string.h>

#include "base/task_runner.h"
#include "ipc/client.h"
#include "tracing/core/consumer.h"
#include "tracing/core/trace_config.h"
#include "tracing/core/trace_packet.h"

// TODO think to what happens when ConsumerIPCClientImpl gets destroyed
// w.r.t. the Consumer pointer. Also think to lifetime of the Consumer* during
// the callbacks.

namespace perfetto {

// static. (Declared in include/tracing/ipc/consumer_ipc_client.h).
std::unique_ptr<Service::ConsumerEndpoint> ConsumerIPCClient::Connect(
    const char* service_sock_name,
    Consumer* consumer,
    base::TaskRunner* task_runner) {
  return std::unique_ptr<Service::ConsumerEndpoint>(
      new ConsumerIPCClientImpl(service_sock_name, consumer, task_runner));
}

ConsumerIPCClientImpl::ConsumerIPCClientImpl(const char* service_sock_name,
                                             Consumer* consumer,
                                             base::TaskRunner* task_runner)
    : consumer_(consumer),
      ipc_channel_(ipc::Client::CreateInstance(service_sock_name, task_runner)),
      consumer_port_(this /* event_listener */),
      weak_ptr_factory_(this) {
  ipc_channel_->BindService(consumer_port_.GetWeakPtr());
}

ConsumerIPCClientImpl::~ConsumerIPCClientImpl() = default;

// Called by the IPC layer if the BindService() succeeds.
void ConsumerIPCClientImpl::OnConnect() {
  connected_ = true;
  consumer_->OnConnect();
}

void ConsumerIPCClientImpl::OnDisconnect() {
  PERFETTO_DLOG("Tracing service connection failure");
  connected_ = false;
  consumer_->OnDisconnect();
}

void ConsumerIPCClientImpl::EnableTracing(const TraceConfig& trace_config) {
  if (!connected_) {
    PERFETTO_DLOG("Cannot EnableTracing(), not connected to tracing service");
    return;
  }

  // Serialize the |trace_config| into a EnableTracingRequest protobuf.
  // Keep this in sync with changes in consumer_port.proto.
  EnableTracingRequest req;
  for (const TraceConfig::BufferConfig& buf_cfg : trace_config.buffers)
    req.add_buffers()->set_size_kb(buf_cfg.size_kb);

  for (const TraceConfig::DataSource& ds_cfg : trace_config.data_sources) {
    auto* data_source = req.add_data_sources();
    for (const std::string& producer_name_filter : ds_cfg.producer_name_filter)
      data_source->add_producer_name_filter(producer_name_filter);
    auto* proto_cfg = data_source->mutable_config();
    proto_cfg->set_name(ds_cfg.config.name);
    proto_cfg->set_target_buffer(ds_cfg.config.target_buffer);
    proto_cfg->set_trace_category_filters(ds_cfg.config.trace_category_filters);
  }
  ipc::Deferred<EnableTracingResponse> async_response;
  async_response.Bind([](ipc::AsyncResult<EnableTracingResponse> response) {
    if (!response)
      PERFETTO_DLOG("EnableTracing() failed");
  });
  consumer_port_.EnableTracing(req, std::move(async_response));
}

void ConsumerIPCClientImpl::DisableTracing() {
  if (!connected_) {
    PERFETTO_DLOG("Cannot DisableTracing(), not connected to tracing service");
    return;
  }

  ipc::Deferred<DisableTracingResponse> async_response;
  async_response.Bind([](ipc::AsyncResult<DisableTracingResponse> response) {
    if (!response)
      PERFETTO_DLOG("DisableTracing() failed");
  });
}

void ConsumerIPCClientImpl::ReadBuffers() {
  if (!connected_) {
    PERFETTO_DLOG("Cannot ReadBuffers(), not connected to tracing service");
    return;
  }

  ReadBuffersRequest req;
  ipc::Deferred<ReadBuffersResponse> async_response;

  // The IPC layer guarantees that callbacks are destroyed after this object
  // is destroyed (by virtue of destroying the |consumer_port_|). In turn the
  // contract of this class expects the caller to not destroy the Consumer class
  // before having destroyed this class. Hence binding consumer here is safe.
  async_response.Bind([this](ipc::AsyncResult<ReadBuffersResponse> response) {
    OnReadBuffersResponse(std::move(response));
  });
  consumer_port_.ReadBuffers(req, std::move(async_response));
}

void ConsumerIPCClientImpl::OnReadBuffersResponse(
    ipc::AsyncResult<ReadBuffersResponse> response) {
  if (!response) {
    PERFETTO_DLOG("ReadBuffers() failed");
    return;
  }
  std::vector<TracePacket> trace_packets;
  trace_packets.reserve(response->trace_packets().size());
  for (const std::string& bytes : response->trace_packets())
    trace_packets.emplace_back(reinterpret_cast<const void*>(bytes.data()),
                               bytes.size());
  consumer_->OnTraceData(trace_packets, response.has_more());
}

void ConsumerIPCClientImpl::FreeBuffers() {
  if (!connected_) {
    PERFETTO_DLOG("Cannot FreeBuffers(), not connected to tracing service");
    return;
  }

  FreeBuffersRequest req;
  ipc::Deferred<FreeBuffersResponse> async_response;

  // The IPC layer guarantees that callbacks are destroyed after this object
  // is destroyed (by virtue of destroying the |consumer_port_|). In turn the
  // contract of this class expects the caller to not destroy the Consumer class
  // before having destroyed this class. Hence binding consumer here is safe.
  async_response.Bind([](ipc::AsyncResult<FreeBuffersResponse> response) {
    if (!response)
      PERFETTO_DLOG("FreeBuffers() failed");
  });
  consumer_port_.FreeBuffers(req, std::move(async_response));
}

}  // namespace perfetto

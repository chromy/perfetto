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

#include "tracing/src/ipc/producer/producer_ipc_client_impl.h"

#include <inttypes.h>
#include <string.h>

#include "base/task_runner.h"
#include "ipc/client.h"
#include "tracing/core/data_source_config.h"
#include "tracing/core/data_source_descriptor.h"
#include "tracing/core/producer.h"
#include "tracing/core/trace_writer.h"
#include "tracing/src/core/producer_shared_memory_arbiter.h"
#include "tracing/src/ipc/posix_shared_memory.h"

// TODO think to what happens when ProducerIPCClientImpl gets destroyed
// w.r.t. the Producer pointer. Also think to lifetime of the Producer* during
// the callbacks.

namespace perfetto {

namespace {
// TODO: this should be configurable by the library client. Hardcoding for the
// moment.
constexpr uint32_t kTracingPageSize = 4096;
}  // namespace

// static. (Declared in include/tracing/ipc/producer_ipc_client.h).
std::unique_ptr<Service::ProducerEndpoint> ProducerIPCClient::Connect(
    const char* service_sock_name,
    Producer* producer,
    base::TaskRunner* task_runner) {
  return std::unique_ptr<Service::ProducerEndpoint>(
      new ProducerIPCClientImpl(service_sock_name, producer, task_runner));
}

ProducerIPCClientImpl::ProducerIPCClientImpl(const char* service_sock_name,
                                             Producer* producer,
                                             base::TaskRunner* task_runner)
    : producer_(producer),
      task_runner_(task_runner),
      ipc_channel_(ipc::Client::CreateInstance(service_sock_name, task_runner)),
      producer_port_(this /* event_listener */),
      weak_ptr_factory_(this) {
  ipc_channel_->BindService(producer_port_.GetWeakPtr());
}

ProducerIPCClientImpl::~ProducerIPCClientImpl() = default;

// Called by the IPC layer if the BindService() succeeds.
void ProducerIPCClientImpl::OnConnect() {
  connected_ = true;

  // The IPC layer guarantees that any outstanding callback will be dropped on
  // the floor if producer_port_ is destroyed between the request and the reply.
  // Binding |this| is hence safe.
  ipc::Deferred<InitializeConnectionResponse> on_init;
  on_init.Bind([this](ipc::AsyncResult<InitializeConnectionResponse> resp) {
    OnConnectionInitialized(resp.success());
  });
  InitializeConnectionRequest init_req;
  init_req.set_shared_buffer_page_size_bytes(kTracingPageSize);
  producer_port_.InitializeConnection(init_req, std::move(on_init));

  // Create the back channel to receive commands from the Service.
  ipc::Deferred<GetAsyncCommandResponse> on_cmd;
  on_cmd.Bind([this](ipc::AsyncResult<GetAsyncCommandResponse> resp) {
    if (!resp)
      return;  // The IPC channel was closed and |resp| was auto-rejected.
    OnServiceRequest(*resp);
  });
  producer_port_.GetAsyncCommand(GetAsyncCommandRequest(), std::move(on_cmd));
}

void ProducerIPCClientImpl::OnDisconnect() {
  PERFETTO_DLOG("Tracing service connection failure");
  connected_ = false;
  producer_->OnDisconnect();
}

void ProducerIPCClientImpl::OnConnectionInitialized(bool connection_succeeded) {
  // If connection_succeeded == false, the OnDisconnect() call will follow next
  // and there we'll notify the |producer_|. TODO: add a test for this.
  if (!connection_succeeded)
    return;

  base::ScopedFile shmem_fd = ipc_channel_->TakeReceivedFD();
  PERFETTO_CHECK(shmem_fd);
  shared_memory_ = PosixSharedMemory::AttachToFd(std::move(shmem_fd));
  auto weak_this = weak_ptr_factory_.GetWeakPtr();
  auto on_page_complete_callback =
      [weak_this](const std::vector<uint32_t>& changed_pages) {
        if (!weak_this)
          return;
        weak_this->NotifySharedMemoryUpdate(changed_pages);
      };
  shared_memory_arbiter_.reset(new ProducerSharedMemoryArbiter(
      shared_memory_->start(), shared_memory_->size(), kTracingPageSize,
      on_page_complete_callback, task_runner_));
  producer_->OnConnect();
}

void ProducerIPCClientImpl::OnServiceRequest(
    const GetAsyncCommandResponse& cmd) {
  if (cmd.cmd_case() == GetAsyncCommandResponse::kStartDataSource) {
    // Keep this in sync with chages in data_source_config.proto.
    const auto& req = cmd.start_data_source();
    const DataSourceInstanceID dsid = req.new_instance_id();

    // TODO: fix const correctness adding a const& ctor to DataSourceConfig.
    const DataSourceConfig ds_config(
        const_cast<GetAsyncCommandResponse::StartDataSource&>(req)
            .mutable_config());
    producer_->CreateDataSourceInstance(dsid, ds_config);
    return;
  }

  if (cmd.cmd_case() == GetAsyncCommandResponse::kStopDataSource) {
    const DataSourceInstanceID dsid = cmd.stop_data_source().instance_id();
    producer_->TearDownDataSourceInstance(dsid);
    return;
  }

  PERFETTO_DLOG("Unknown async request %d received from tracing service",
                cmd.cmd_case());
}

void ProducerIPCClientImpl::RegisterDataSource(
    const DataSourceDescriptor& descriptor,
    RegisterDataSourceCallback callback) {
  if (!connected_) {
    PERFETTO_DLOG(
        "Cannot RegisterDataSource(), not connected to tracing service");
    return task_runner_->PostTask(std::bind(callback, 0));
  }
  // Keep this in sync with changes in data_source_descriptor.proto.
  RegisterDataSourceRequest req;
  req.mutable_data_source_descriptor()->CopyFrom(descriptor.proto());
  ipc::Deferred<RegisterDataSourceResponse> async_response;
  // TODO: add a test that destroys the IPC channel soon after this call and
  // checks that the callback(0) is invoked.
  // TODO: add a test that destroyes ProducerIPCClientImpl soon after this call
  // and checks that the callback is dropped.
  async_response.Bind(
      [callback](ipc::AsyncResult<RegisterDataSourceResponse> response) {
        if (!response) {
          PERFETTO_DLOG("RegisterDataSource() failed: connection reset");
          return callback(0);
        }
        if (response->data_source_id() == 0) {
          PERFETTO_DLOG("RegisterDataSource() failed: %s",
                        response->error().c_str());
        }
        callback(response->data_source_id());
      });
  producer_port_.RegisterDataSource(req, std::move(async_response));
}

void ProducerIPCClientImpl::UnregisterDataSource(DataSourceID id) {
  if (!connected_) {
    PERFETTO_DLOG(
        "Cannot UnregisterDataSource(), not connected to tracing service");
    return;
  }
  UnregisterDataSourceRequest req;
  req.set_data_source_id(id);
  producer_port_.UnregisterDataSource(
      req, ipc::Deferred<UnregisterDataSourceResponse>());
}

void ProducerIPCClientImpl::NotifySharedMemoryUpdate(
    const std::vector<uint32_t>& changed_pages) {
  if (!connected_) {
    PERFETTO_DLOG(
        "Cannot NotifySharedMemoryUpdate(), not connected to tracing service");
    return;
  }
  NotifySharedMemoryUpdateRequest req;
  req.mutable_changed_pages()->Reserve(static_cast<int>(changed_pages.size()));
  for (uint32_t changed_page : changed_pages)
    req.add_changed_pages(changed_page);
  producer_port_.NotifySharedMemoryUpdate(
      req, ipc::Deferred<NotifySharedMemoryUpdateResponse>());
  PERFETTO_DLOG("NotifySharedMemoryUpdate %zu", changed_pages.size());
}

std::unique_ptr<TraceWriter> ProducerIPCClientImpl::CreateTraceWriter(
    size_t target_buffer) {
  return shared_memory_arbiter_->CreateTraceWriter(target_buffer);
}

SharedMemory* ProducerIPCClientImpl::shared_memory() const {
  return shared_memory_.get();
}

}  // namespace perfetto

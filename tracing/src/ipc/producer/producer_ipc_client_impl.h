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

#ifndef TRACING_SRC_IPC_PRODUCER_IPC_PROXY_H_
#define TRACING_SRC_IPC_PRODUCER_IPC_PROXY_H_

#include <stdint.h>

#include <vector>

#include "base/weak_ptr.h"
#include "ipc/service_proxy.h"
#include "tracing/core/basic_types.h"
#include "tracing/core/service.h"

#include "protos/ipc/producer_port.ipc.h"  // From producer_port.proto.
#include "tracing/ipc/producer_ipc_client.h"

namespace perfetto {

namespace base {
class TaskRunner;
}  // namespace base

namespace ipc {
class Client;
}  // namespace ipc

class Producer;
class ProducerSharedMemoryArbiter;
class PosixSharedMemory;

// Exposes a Service endpoint to Producer(s), proxying all requests through a
// IPC channel to the remote Service. This class is the glue layer between the
// generic Service interface exposed to the clients of the library and the
// actual IPC transport.
class ProducerIPCClientImpl : public Service::ProducerEndpoint,
                              public ipc::ServiceProxy::EventListener {
 public:
  ProducerIPCClientImpl(const char* service_sock_name,
                        Producer*,
                        base::TaskRunner*);
  ~ProducerIPCClientImpl() override;

  // Service::ProducerEndpoint implementation.
  // These methods are invoked by the actual Producer(s) code by clients of the
  // tracing library, which know nothing about the IPC transport.
  void RegisterDataSource(const DataSourceDescriptor&,
                          RegisterDataSourceCallback) override;
  void UnregisterDataSource(DataSourceID) override;
  void NotifySharedMemoryUpdate(
      const std::vector<uint32_t>& changed_pages) override;
  std::unique_ptr<TraceWriter> CreateTraceWriter(size_t target_buffer) override;
  SharedMemory* shared_memory() const override;

  // ipc::ServiceProxy::EventListener implementation.
  // These methods are invoked by the IPC layer, which knows nothing about
  // tracing, producers and consumers.
  void OnConnect() override;
  void OnDisconnect() override;

 private:
  // Invoked soon after having established the connection with the service.
  void OnConnectionInitialized(bool connection_succeeded);

  // Invoked when the remote Service sends an IPC to tell us to do something
  // (e.g. start/stop a data source).
  void OnServiceRequest(const GetAsyncCommandResponse&);

  // TODO think to destruction order, do we rely on any specific dtor sequence?
  Producer* const producer_;
  base::TaskRunner* const task_runner_;

  // The object that owns the client socket and takes care of IPC traffic.
  std::unique_ptr<ipc::Client> ipc_channel_;

  // The proxy interface for the producer port of the service. It is bound
  // to |ipc_channel_| and (de)serializes method invocations over the wire.
  ProducerPortProxy producer_port_;

  std::unique_ptr<PosixSharedMemory> shared_memory_;
  std::unique_ptr<ProducerSharedMemoryArbiter> shared_memory_arbiter_;
  base::WeakPtrFactory<ProducerIPCClientImpl> weak_ptr_factory_;

  bool connected_ = false;
};

}  // namespace perfetto

#endif  // TRACING_SRC_IPC_PRODUCER_IPC_PROXY_H_

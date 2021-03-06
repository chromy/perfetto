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

#ifndef TRACING_SRC_CORE_PRODUCER_SHARED_MEMORY_ARBITER_H_
#define TRACING_SRC_CORE_PRODUCER_SHARED_MEMORY_ARBITER_H_

#include <stdint.h>

#include <functional>
#include <mutex>
#include <vector>

#include "tracing/core/basic_types.h"
#include "tracing/core/shared_memory_abi.h"

namespace perfetto {

class TraceWriter;

namespace base {
class TaskRunner;
}  // namespace base

// This class handles the shared memory buffer on the producer side. It is used
// to obtain thread-local chunks and to partition pages from several threads.
// There is one arbiter instance per Producer.
// This class is thread-safe and uses locks to do so. Data sources are supposed
// to interact with this sporadically, only when they run out of space on their
// current thread-local chunk.
class ProducerSharedMemoryArbiter {
 public:
  using OnPageCompleteCallback =
      std::function<void(const std::vector<uint32_t>&)>;

  // Args:
  // |start|,|size|: boundaries of the shared memory buffer.
  // |page_size|: a multiple of 4KB that defines the granularity of tracing
  // pagaes. See tradeoff considerations in shared_memory_abi.h.
  // |OnPageCompleteCallback|: a callback that will be posted on the passed
  // |TaskRunner| when a page is complete (and hence the Producer should send
  // a NotifySharedMemoryUpdate()).
  ProducerSharedMemoryArbiter(void* start,
                              size_t size,
                              size_t page_size,
                              OnPageCompleteCallback,
                              base::TaskRunner*);

  SharedMemoryABI::Chunk GetNewChunk(const SharedMemoryABI::ChunkHeader&,
                                     size_t target_buffer,
                                     size_t size_hint = 0);

  void ReturnCompletedChunk(SharedMemoryABI::Chunk chunk);

  // Creates a new TraceWriter and assigns it a new WriterID. The WriterID is
  // written in each chunk header owned by a given TraceWriter and is used by
  // the Service to reconstruct reorder TracePackets written by the same
  // TraceWriter. CHECK(s) if all WriterID slots are exhausted.
  // TODO: instad of crashing this should return a NoopWriter.
  std::unique_ptr<TraceWriter> CreateTraceWriter(size_t target_buffer = 0);

 private:
  friend class TraceWriter;
  ProducerSharedMemoryArbiter(const ProducerSharedMemoryArbiter&) = delete;
  ProducerSharedMemoryArbiter& operator=(const ProducerSharedMemoryArbiter&) =
      delete;

  WriterID AcquireWriterID();

  // Called by the TraceWriter destructor.
  void ReleaseWriterID(WriterID);

  void InvokeOnPageCompleteCallback();

  std::mutex lock_;
  SharedMemoryABI shmem_;
  size_t page_idx_ = 0;
  WriterID last_writer_id_ = 0;
  std::vector<bool> active_writer_ids_;
  std::vector<uint32_t> pages_to_notify_;
  bool scheduled_notification_ = false;
  OnPageCompleteCallback on_page_complete_callback_;
  base::TaskRunner* const task_runner_;
};

}  // namespace perfetto

#endif  // TRACING_SRC_CORE_PRODUCER_SHARED_MEMORY_ARBITER_H_

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

#ifndef TRACING_INCLUDE_TRACING_TRACE_CONFIG_H_
#define TRACING_INCLUDE_TRACING_TRACE_CONFIG_H_

#include <stdint.h>

#include <memory>
#include <string>

#include "tracing/core/data_source_config.h"
#include "tracing/core/proto_pimpl_macros.h"

namespace perfetto {

namespace proto {
// From trace_config.proto .
class TraceConfig;
class TraceConfig_BufferConfig;
class TraceConfig_DataSource;
}  // namespace proto

// See protos/ipc/trace_config.proto for comments.
class TraceConfig {
 public:
  class BufferConfig {
   public:
    BufferConfig();
    explicit BufferConfig(proto::TraceConfig_BufferConfig*);
    BufferConfig(BufferConfig&&) noexcept;
    ~BufferConfig();

    void set_size_kb(uint32_t);
    uint32_t size_kb() const;

    enum OptimizeFor { ONE_SHOT_READ = 0 };
    OptimizeFor optimize_for() const;
    void set_optimize_for(OptimizeFor);

    enum FillPolicy { RING_BUFFER = 0 };
    FillPolicy fill_policy() const;
    void set_fill_policy(FillPolicy);

    void CopyFrom(const proto::TraceConfig_BufferConfig&);
    const proto::TraceConfig_BufferConfig& proto() const { return *impl_; }

    PERFETTO_DECLARE_PROTO_PIMPL(BufferConfig, proto::TraceConfig_BufferConfig)
  };  // class BufferConfig

  class DataSource {
   public:
    DataSource();
    explicit DataSource(proto::TraceConfig_DataSource*);
    DataSource(DataSource&&) noexcept;
    ~DataSource();

    const DataSourceConfig config() const;
    DataSourceConfig mutable_config();

    int producer_name_filter_size() const;
    const std::string& producer_name_filter(int index) const;
    std::string* add_producer_name_filter();
    void clear_producer_name_filter();

    void CopyFrom(const proto::TraceConfig_DataSource&);
    const proto::TraceConfig_DataSource& proto() const { return *impl_; }

    PERFETTO_DECLARE_PROTO_PIMPL(DataSource, proto::TraceConfig_DataSource)
  };

  TraceConfig();
  explicit TraceConfig(proto::TraceConfig*);
  TraceConfig(TraceConfig&&) noexcept;
  ~TraceConfig();

  int buffers_size() const;
  const BufferConfig buffers(int index) const;
  BufferConfig add_buffers();
  void clear_buffers();

  int data_sources_size() const;
  const DataSource data_sources(int index) const;
  DataSource add_data_sources();
  void clear_data_sources();

  void CopyFrom(const proto::TraceConfig&);
  const proto::TraceConfig& proto() const { return *impl_; }

  PERFETTO_DECLARE_PROTO_PIMPL(TraceConfig, proto::TraceConfig)
};  // namespace perfetto

}  // namespace perfetto

#endif  // TRACING_INCLUDE_TRACING_TRACE_CONFIG_H_

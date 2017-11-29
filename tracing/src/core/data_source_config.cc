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

#include "tracing/core/data_source_config.h"

#include "protos/ipc/data_source_config.pb.h"

namespace perfetto {

PERFETTO_DEFINE_CTOR_AND_COPY_OPERATORS(DataSourceConfig,
                                        DataSourceConfig,
                                        proto::DataSourceConfig)
PERFETTO_DEFINE_STRING_ACCESSORS(DataSourceConfig, name)
PERFETTO_DEFINE_POD_ACCESSORS(DataSourceConfig, uint32_t, target_buffer)
PERFETTO_DEFINE_STRING_ACCESSORS(DataSourceConfig, trace_category_filters)

}  // namespace perfetto

// Copyright (C) 2021 The Android Open Source Project
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import {Plugin, PluginContextTrace, PluginDescriptor} from '../../public';
import {
  LONG_NULL,
  NUM,
  NUM_NULL,
  STR_NULL,
} from '../../trace_processor/query_result';
import {assertExists} from '../../base/logging';

import {
  Config as ProcessSchedulingTrackConfig,
  PROCESS_SCHEDULING_TRACK_KIND,
  ProcessSchedulingTrack,
} from './process_scheduling_track';
import {
  Config as ProcessSummaryTrackConfig,
  PROCESS_SUMMARY_TRACK,
  ProcessSummaryTrack,
} from './process_summary_track';

// This plugin now manages both process "scheduling" and "summary" tracks.
class ProcessSummaryPlugin implements Plugin {
  async onTraceLoad(ctx: PluginContextTrace): Promise<void> {
    await this.addProcessTrackGroups(ctx);
    await this.addKernelThreadSummary(ctx);
  }

  private async addProcessTrackGroups(ctx: PluginContextTrace): Promise<void> {
    const result = await ctx.engine.query(`
      select *
      from (
        select
          _process_available_info_summary.upid,
          null as utid,
          pid,
          null as tid,
          process.name as processName,
          null as threadName,
          sum_running_dur > 0 as hasSched,
          max_running_dur as maxRunningDur,
          running_count as runningCount,
          android_process_metadata.debuggable as isDebuggable
        from _process_available_info_summary
        join process using(upid)
        left join android_process_metadata using(upid)
      )
      union all
      select *
      from (
        select
          null,
          utid,
          null as pid,
          tid,
          null as processName,
          thread.name threadName,
          sum_running_dur > 0 as hasSched,
          max_running_dur as maxRunningDur,
          running_count as runningCount,
          0 as isDebuggable
        from _thread_available_info_summary
        join thread using (utid)
        where upid is null
      )
  `);

    const it = result.iter({
      upid: NUM_NULL,
      utid: NUM_NULL,
      pid: NUM_NULL,
      tid: NUM_NULL,
      processName: STR_NULL,
      threadName: STR_NULL,
      hasSched: NUM_NULL,
      maxRunningDur: LONG_NULL,
      runningCount: NUM_NULL,
      isDebuggable: NUM_NULL,
    });
    for (; it.valid(); it.next()) {
      const utid = it.utid;
      const tid = it.tid;
      const upid = it.upid;
      const pid = it.pid;
      const hasSched = Boolean(it.hasSched);
      const maxRunningDur = it.maxRunningDur;
      const runningCount = it.runningCount;
      const isDebuggable = Boolean(it.isDebuggable);

      const pidForColor = pid ?? tid ?? upid ?? utid ?? 0;
      const type = hasSched ? 'schedule' : 'summary';
      const uri = `perfetto.ProcessScheduling#${upid}.${utid}.${type}`;

      if (hasSched) {
        const config: ProcessSchedulingTrackConfig = {
          pidForColor,
          upid,
          utid,
        };

        ctx.registerTrack({
          uri,
          displayName: `${upid === null ? tid : pid} schedule`,
          kind: PROCESS_SCHEDULING_TRACK_KIND,
          tags: {
            isDebuggable,
          },
          trackFactory: () =>
            new ProcessSchedulingTrack(
              ctx.engine,
              config,
              assertExists(maxRunningDur),
              assertExists(runningCount),
            ),
        });
      } else {
        const config: ProcessSummaryTrackConfig = {
          pidForColor,
          upid,
          utid,
        };

        ctx.registerTrack({
          uri,
          displayName: `${upid === null ? tid : pid} summary`,
          kind: PROCESS_SUMMARY_TRACK,
          tags: {
            isDebuggable,
          },
          trackFactory: () => new ProcessSummaryTrack(ctx.engine, config),
        });
      }
    }
  }

  private async addKernelThreadSummary(ctx: PluginContextTrace): Promise<void> {
    const {engine} = ctx;

    // Identify kernel threads if this is a linux system trace, and sufficient
    // process information is available. Kernel threads are identified by being
    // children of kthreadd (always pid 2).
    // The query will return the kthreadd process row first, which must exist
    // for any other kthreads to be returned by the query.
    // TODO(rsavitski): figure out how to handle the idle process (swapper),
    // which has pid 0 but appears as a distinct process (with its own comm) on
    // each cpu. It'd make sense to exclude its thread state track, but still
    // put process-scoped tracks in this group.
    const result = await engine.query(`
      select
        t.utid, p.upid, (case p.pid when 2 then 1 else 0 end) isKthreadd
      from
        thread t
        join process p using (upid)
        left join process parent on (p.parent_upid = parent.upid)
        join
          (select true from metadata m
             where (m.name = 'system_name' and m.str_value = 'Linux')
           union
           select 1 from (select true from sched limit 1))
      where
        p.pid = 2 or parent.pid = 2
      order by isKthreadd desc
    `);

    const it = result.iter({
      utid: NUM,
      upid: NUM,
    });

    // Not applying kernel thread grouping.
    if (!it.valid()) {
      return;
    }

    const config: ProcessSummaryTrackConfig = {
      pidForColor: 2,
      upid: it.upid,
      utid: it.utid,
    };

    ctx.registerTrack({
      uri: 'perfetto.ProcessSummary#kernel',
      displayName: `Kernel thread summary`,
      kind: PROCESS_SUMMARY_TRACK,
      trackFactory: () => new ProcessSummaryTrack(ctx.engine, config),
    });
  }
}

export const plugin: PluginDescriptor = {
  pluginId: 'perfetto.ProcessSummary',
  plugin: ProcessSummaryPlugin,
};

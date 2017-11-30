#!/bin/bash

set -e

outdir=out/android_release_arm64

ninja -C $outdir perfetto

adb push $outdir/perfetto /data/local/tmp/perfetto

if tmux has-session -t demo; then
  tmux kill-session -t demo
fi

tmux -2 new-session -d -s demo

if tmux -V | awk '{split($2, ver, "."); if (ver[1] < 2) exit 1 ; else if (ver[1] == 2 && ver[2] < 1) exit 1 }'; then
  tmux set-option -g mouse on
else
  tmux set-option -g mode-mouse on
  tmux set-option -g mouse-resize-pane on
  tmux set-option -g mouse-select-pane on
  tmux set-option -g mouse-select-window on
fi

tmux split-window -v
tmux split-window -v

tmux select-layout even-vertical

tmux select-pane -t 0
tmux send-keys "clear" C-m
tmux send-keys "adb shell" C-m

tmux select-pane -t 1
tmux send-keys "clear" C-m
tmux send-keys "adb shell" C-m

tmux select-pane -t 2
tmux send-keys "clear" C-m
tmux send-keys "adb shell" C-m

sleep 3

tmux select-pane -t 0
tmux send-keys "/data/local/tmp/perfetto producer"

tmux select-pane -t 1
tmux send-keys "/data/local/tmp/perfetto service"

tmux select-pane -t 2
tmux send-keys "/data/local/tmp/perfetto consumer"

# Select consumer pane.
tmux select-pane -t 1

tmux -2 attach-session -t demo

#!/bin/bash

set -e

outdir=out/android_debug_arm64

ninja -C $outdir

eu-strip $outdir/producer 
eu-strip $outdir/service 
eu-strip $outdir/consumer

adb push $outdir/producer /data/local/tmp/producer
adb push $outdir/service /data/local/tmp/service
adb push $outdir/consumer /data/local/tmp/consumer

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

tmux split-window -h
tmux split-window -h

tmux select-layout even-horizontal

tmux select-pane -t 0
tmux send-keys "adb shell" C-m

tmux select-pane -t 1
tmux send-keys "adb shell" C-m

tmux select-pane -t 2
tmux send-keys "adb shell" C-m

sleep 3

tmux select-pane -t 0
tmux send-keys "echo Producer" C-m
tmux send-keys "/data/local/tmp/producer"

tmux select-pane -t 1
tmux send-keys "echo Service" C-m
tmux send-keys "/data/local/tmp/service"

tmux select-pane -t 2
tmux send-keys "echo Consumer" C-m
tmux send-keys "/data/local/tmp/consumer"

tmux -2 attach-session -t demo

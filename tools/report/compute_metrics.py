#!/usr/bin/env python

from __future__ import print_function

import errno
import json
import os
import subprocess
import argparse
import shutil
from datetime import datetime, date, timedelta
from itertools import izip
from functools import wraps

try:
  from subprocess import DEVNULL
except ImportError:
  import os
  DEVNULL = open(os.devnull, 'wb')

METRICS = {}
SUMMARIES = {}
BEGINING_OF_TIME = datetime(2017, 9, 25, 4, 0, 0, 0)

class Summary(object):
  def __init__(self, f, metrics):
    self.f = f
    self.metrics = set(metrics)

class NotValidHere(Exception):
  pass

def is_cloc_installed():
  # return subprocess.check_call(['cloc', '--help'])
  pass

def metric(valid_from=None):
  def decorator(f):
    def wrapper(out_dir, checkout_dir, left, right):
      if valid_from and left < valid_from:
        raise NotValidHere
      return f(out_dir, checkout_dir, left, right)
    METRICS[f.__name__] = wrapper
    return wrapper
  return decorator

def summary(*metrics):
  def decorator(f):
    SUMMARIES[f.__name__] = Summary(f, metrics)
    return f
  return decorator

def dates_in_range(start, end):
  delta = end - start
  for i in range(delta.days + 1):
    yield start + timedelta(days=i)

def day_pairs():
  left = dates_since_start()
  right = dates_since_start()
  right.next()
  return izip(left, right)

def date_to_left_right(date):
  left = date
  right = date + timedelta(days=1)
  return left, right

def best_commit_for_day(date):
  left, right = date_to_left_right(date)
  args = [
    'git',
    'log',
    'origin/master',
    '--before={}'.format(right.isoformat()),
    '--pretty=%H',
  ]
  output = subprocess.check_output(args)
  return output.split('\n')[0]

@metric()
def commit_log(out_dir, checkout_dir, left, right):
  args = [
    'git',
    'log',
    'origin/master',
    '--after={}'.format(left.isoformat()),
    '--before={}'.format(right.isoformat()),
    '--no-merges',
    '--numstat',
    '--pretty=format:%h,%ae,%cI,%s',
  ]
  output = subprocess.check_output(args)
  commits = output.split('\n\n')
  json_output = []
  for commit in commits:
    lines = commit.split('\n')
    summary = lines.pop(0)
    if not summary:
      continue
    try:
      hash, author_email, commit_date, first_line = summary.split(',', 3)
    except ValueError:
      print(output)
      raise
    changes = []
    total_insertions = 0
    total_deletions = 0
    total_changes = 0
    for line in lines:
      if not line:
        continue
      insertions, deletions, filename = line.split('\t')
      try:
        insertions = 0 if insertions == '-' else int(insertions)
        deletions = 0 if deletions == '-' else int(deletions)
      except ValueError:
        raise

      total_changes += 1
      total_insertions += insertions
      total_deletions += deletions
      changes.append({
        'filename': filename,
        'insertions': insertions,
        'deletions': deletions,
      })
    json_output.append({
      'left': left.date().isoformat(),
      'right': right.date().isoformat(),
      'hash': hash,
      'author_email': author_email,
      'commit_date': commit_date,
      'first_line': first_line,
      'changes': changes,
      'total_changes': {
        'insertions': total_insertions,
        'deletions': total_deletions,
        'files_changed': total_changes,
      },
    })
    path = os.path.join(out_dir, 'commit_log.json')
    with open(path, 'w') as fd:
      json.dump({'commits': json_output}, fd)

@metric(valid_from=BEGINING_OF_TIME+timedelta(days=1))
def cloc(out_dir, checkout_dir, left, right):
  path = os.path.join(out_dir, 'cloc.json')

  args = [
    'cloc',
    '--git',
    'HEAD',
    '--json',
  ]
  output = subprocess.check_output(args, cwd=checkout_dir)
  j = json.loads(output)
  j['left'] = left.date().isoformat()
  j['right'] = right.date().isoformat()
  try:
    with open(path, 'w') as fd:
      json.dump(j, fd)
  except:
    print(output)

@metric()
def todos(out_dir, checkout_dir, left, right):
  path = os.path.join(out_dir, 'todos.json')
  args = [
    'git',
    '-C',
    checkout_dir,
    'grep',
    '// TODO(.*)',
  ]

  try:
    output = subprocess.check_output(args)
    lines = output.split('\n')
  except subprocess.CalledProcessError:
    lines = []
  count = len(lines)
  for line in lines:
    pass
  with open(path, 'w') as fd:
    json.dump({
      'left': left.date().isoformat(),
      'right': right.date().isoformat(),
      'count': count,
    }, fd)

@summary('todos')
def todo_count(date_dir_pairs):
  args = [
    'jq',
    '--slurp',
    'map({date: .left, data: .count})',
  ] + [os.path.join(path, 'todos', 'todos.json') for date, path in date_dir_pairs if path]
  try:
    output = subprocess.check_output(args)
  except ValueError:
    print(' '.join(args))
    raise
  return json.loads(output)

@summary('cloc')
def comment_count(*args):
  return jq_command('cloc/cloc.json', 'map({date: .left, data: .SUM.comment})')(*args)

@summary('cloc')
def code_count(*args):
  return jq_command('cloc/cloc.json', 'map({date: .left, data: .SUM.code})')(*args)

def jq_command(suffix, command):
  def f(date_dir_pairs):
    args = [
      'jq',
      '--slurp',
      command,
    ] + [os.path.join(path, suffix) for date, path in date_dir_pairs if path]
    try:
      output = subprocess.check_output(args)
    except ValueError:
      print(' '.join(args))
      raise
    return json.loads(output)
  return f

def mkdir(path):
  try:
    os.makedirs(path)
  except OSError as e:
    if e.errno != errno.EEXIST or not os.path.isdir(path):
      raise

def metric_directory(root, date, metric_name):
  return os.path.join(root, date.date().isoformat(), metric_name)

def is_metric_computed(root, date, metric_name):
  return os.path.isdir(metric_directory(root, date, metric_name))

def compute_metric_for_day(root, checkout_path, name, date, overwrite=False):
  metric_path = metric_directory(root, date, name)
  if os.path.isdir(metric_path):
    if overwrite:
      shutil.rmtree(metric_path)
    else:
      return

  mkdir(metric_path)

  left, right = date_to_left_right(date)
  try:
    METRICS[name](metric_path, checkout_path, left, right)
  except NotValidHere:
    shutil.rmtree(metric_path)
  except:
    shutil.rmtree(metric_path)
    raise

def compute_summary(root, name, dates):
  summary = SUMMARIES[name]
  def can_compute_summary(d):
    if not os.path.isdir(d):
      return False
    for metric in summary.metrics:
      if not os.path.isdir(os.path.join(d, metric)):
        return False
    return True

  dirs = [os.path.join(root, date.date().isoformat()) for date in dates]
  dirs = [(d if can_compute_summary(d) else None) for d in dirs]
  result = summary.f(zip(dates, dirs))
  dates_to_result = {row['date']: row['data'] for row in result}
  output = []
  for date in [date.date().isoformat() for date in dates]:
    output.append(dates_to_result.get(date, None))
  return output

class App(object):
  def __init__(self, start=None, end=None):
    assert start
    assert end
    self.start = start
    self.end = end
    self.checkout_dir = '/Users/chromy/.report-card-perfetto'
    self.output_dir = 'tools/report/data'

  def do_compute(self, args):
    chosen_metrics = args.metrics
    overwrite = args.overwrite
    for date in dates_in_range(self.start, self.end):
      if any((not is_metric_computed(self.output_dir, date, metric) for metric in chosen_metrics)):
        commit = best_commit_for_day(date)
        subprocess.check_call(['tools/report/checkout', commit], stdout=DEVNULL)
      for name in chosen_metrics:
        compute_metric_for_day(self.output_dir, self.checkout_dir, name, date, overwrite=overwrite)

  def do_summarise(self, args):
    path = os.path.join(self.output_dir, 'summary.json')
    dates = list(dates_in_range(self.start, self.end))
    output = [{'date': date.date().isoformat()} for date in dates]
    for summary in SUMMARIES:
      for i, row in enumerate(compute_summary(self.output_dir, summary, dates)):
        output[i][summary] = row
    with open(path, 'wb') as fd:
      json.dump(output, fd)

  def do_upload(self, args):
    pass

def main():
  def comma_seperated_metrics(s):
    metrics = s.split(',')
    for metric in metrics:
      if not metric in METRICS:
        raise argparse.ArgumentTypeError('"{}" is not a metric.'.format(metric))
    return metrics

  start = BEGINING_OF_TIME
  now = datetime.utcnow()
  today = datetime.utcnow().replace(hour=4, minute=0,  second=0, microsecond=0)
  yesterday = today - timedelta(days=1)
  tomorrow = today + timedelta(days=1)
  end = yesterday

  parser = argparse.ArgumentParser(description='Compute prefetto report.')
  subparsers = parser.add_subparsers(dest='name')

  compute = subparsers.add_parser('compute')
  summarise = subparsers.add_parser('summarise')
  commit = subparsers.add_parser('commit')
  compute.add_argument(
      '--overwrite',
      dest='overwrite',
      action='store_const',
      const=True,
      default=False,
      help='overwrite metrics (default: False)')
  compute.add_argument(
      '--metrics',
      dest='metrics',
      action='store',
      type=comma_seperated_metrics,
      default=[],
      help='choose metrics (default: {})'.format(','.join(METRICS.keys())))

  args = parser.parse_args()

  app = App(start=start, end=end)
  if args.name == 'compute':
    return app.do_compute(args)
  if args.name == 'summarise':
    return app.do_summarise(args)
  if args.name == 'upload':
    return app.do_upload(args)

  #if not is_cloc_installed():
  #  print('Should install cloc')

if __name__ == "__main__":
  main()

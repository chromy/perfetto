#!/usr/bin/env python

from datetime import date, timedelta
from itertools import izip
import subprocess

def dates_since_start():
  start = date(2017, 9, 25)
  end = date(2018, 04, 24)
  delta = end - start
  for i in range(delta.days + 1):
    yield start + timedelta(days=i)

def day_pairs():
  left = dates_since_start()
  right = dates_since_start()
  right.next()
  return izip(left, right)

if __name__ == "__main__":
  for l, r in day_pairs():
    print l, r

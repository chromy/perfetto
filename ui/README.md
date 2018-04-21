# UI Prototype Build Instructions

## Setup

- Install [serveit](https://github.com/garybernhardt/serveit).
- Install npm.
- Install js deps.

```
$ brew install serveit
$ brew install npm
$ npm install 
```

## Building

```
$ serveit -s out/mac_debug/ui -i out -i buildtools -i src/ftrace_reader/test/data 'ninja -C out/mac_debug -v'
$ open http://localhost:8000/index.html
```

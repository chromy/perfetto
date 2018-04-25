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
$ serveit -s out/mac_debug/ui -i out -i buildtools -i src/ftrace_reader/test/data -i node_modules -i ui/node_modules -i .git 'ninja -C out/mac_debug -v'
$ open http://localhost:8000/index.html
```


## Building the react-redux-typescript ui

```
$ npm install
$ npm start
```



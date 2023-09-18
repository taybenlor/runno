# Experimental Docker WASI Images

Docker has announced a beta of [Wasm workloads](https://docs.docker.com/desktop/wasm/) which introduces
a WASI runtime that is used to run the entrypoint. OIC images are mostly just a series of tar files,
loaded into a filesystem, which matches well with how the Runno filesystem is used and loaded.

This is an experiment to see if those images can be run in Runno. For prior work see: [Running WASI binaries from your HTML using Web Components](https://runno.dev/articles/wasi-web-component). This experiment is
pretty dodgy, so it's likely there is a bunch of stuff that will break.

## Loading a docker image

1. Save a wasm docker image into a tar file

```
$ docker save secondstate/rust-example-hello -o rust-example-hello.tar
```

2. Using the file button below select that tar file

<website-docker-playground></website-docker-playground>

## Docker image component

This is using a docker image web component that looks like:

```html
<runno-container src=".../someImage.tar"></runno-container>
```

## Limitations

I haven't implemented the actual layer semantics specified in OCI, I just write each layer over the top of the
previous one. So any deletion steps won't work.

Currently the Runno WASI runtime does not support any `wasi-preview2` features. It also does not support the
WasmEdge [TODO: Is that the right runtime?] features used for sockets and TCP/UDP.

Other implementations solve the sockets issue by bouncing out via websockets to a server that forwards a "real" socket. I'd much rather have an in-browser emulation of sockets that is available internally in the page using a service worker. I haven't thought through how this would work practically or built any demos, but I think it should be possible. `wasi-preview2` would have a better story around this, because the `wasi:http` interface better matches the service worker API.

---
head:
  - - meta
    - name: description
      content: Explains how to get started with UmaDB including downloading, installation and running the server.
  - - meta
    - name: keywords
      content: download, downloads, install, UmaDB, linux, macOS, Cargo 
---
# Install Guide

## Installing UmaDB

Pre-built `umadb` binaries are available to download for Linux and macOS.

Alternatively, you can install using Cargo or run [Docker](./docker) containers.

## Download Binaries

Pre-built UmaDB binaries are available for:

* x86_64 (AMD64)
  * Linux (glibc)
  * Linux (musl, static build)
  * macOS
* aarch64 (ARM64)
  * Linux (glibc)
  * Linux (musl, static build)
  * macOS
  
The downloads are available on [GitHub Releases](https://github.com/umadb-io/umadb/releases).

## Build with Cargo

You can install UmaDB directly from [source](https://crates.io/crates/umadb) using Cargo:

```
cargo install umadb
```

Cargo will compile UmaDB locally and place the resulting `umadb` binary in your `PATH`.

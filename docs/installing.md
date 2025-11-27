# Installing UmaDB Server

## Binaries from GitHub Releases

Pre-built UmaDB binaries are available for:

* x86_64 (AMD64)
  * Linux (glibc)
  * Linux (musl, static build)
  * macOS
* aarch64 (ARM64)
  * Linux (glibc)
  * Linux (musl, static build)
  * macOS
  
The files are available on [GitHub Releases](https://github.com/umadb-io/umadb/releases).

## Build with Cargo

You can install UmaDB directly from source using Cargo:

```
cargo install umadb
```

Cargo will compile UmaDB locally and place the resulting `umadb` binary in your `PATH`.


---
head:
  - - meta
    - name: description
      content: How to build the UmaDB server from source
  - - meta
    - name: keywords
      content: UmaDB, build, server, source, Cargo, Rust
---
# Building the UmaDB Server

To build the UmaDB server binary executable, you need to have Rust and Cargo installed. If you don't have them installed, you can get them from [rustup.rs](https://rustup.rs/).

Clone the [project repo](https://github.com/umadb-io/umadb) and build `umadb` from source.

```bash
cargo build -p umadb --release
```

This will create `umadb` in `./target/release/`.

```bash
./target/release/umadb --listen 127.0.0.1:50051 --db-path ./uma.db
```

You can do `cargo run` for a faster dev build (builds faster, runs slower):

```bash
cargo run --bin umadb -- --listen 127.0.0.1:50051 --db-path ./uma.db
```

# Getting Started

Get started with UmaDB by installing and running the server.

Then try out the [Rust client](./rust-client) or [Python client](./python-client) examples.

## Installing UmaDB Server

Pre-built binaries are available for Linux and macOS.

Alternatively, you can install using Cargo or run [Docker](./docker) containers.

### Pre-built Binaries

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

### Build with Cargo

You can install UmaDB directly from [source](https://crates.io/crates/umadb) using Cargo:

```
cargo install umadb
```

Cargo will compile UmaDB locally and place the resulting `umadb` binary in your `PATH`.

## Running UmaDB Server

Start the `umadb` server by specifying the listen address and the database path:

```
umadb --listen 127.0.0.1:50051 --db-path ./uma.db
```

`umadb` supports the following command-line options:

- `--listen`:  Address to bind to (e.g. `127.0.0.1:50051`)
- `--db-path`: Path to the database file or directory
- `--tls-cert`: TLS server certificate (PEM), optional
- `--tls-key`: TLS server private key (PEM), optional
- `-h, --help`: Show help information
- `-V, --version`: Show version information

The TLS options can also be provided using environment variables:
* `UMADB_TLS_CERT` — Path to the server TLS certificate (PEM), equivalent to `--tls-cert`
* `UMADB_TLS_KEY` — Path to the server TLS private key (PEM), equivalent to `--tls-key`

### Self-signed TLS Certificate

For development and testing purposes, you can create a self-signed TSL certificate with the following command:

```bash
openssl req \
  -x509 \
  -newkey rsa:4096 \
  -keyout server.key \
  -out server.pem \
  -days 365 \
  -nodes \
  -subj "/CN=localhost" \
  -addext "basicConstraints = CA:FALSE" \
  -addext "subjectAltName = DNS:localhost"
```

Explanation:
* `-x509` — creates a self-signed certificate (instead of a CSR).
* `-newkey` rsa:4096 — generates a new 4096-bit RSA key.
* `-keyout` server.key — output file for the private key.
* `-out` server.pem — output file for the certificate.
* `-days` 365 — validity period (1 year).
* `-nodes` — don’t encrypt the private key with a passphrase.
* `-subj` "/CN=localhost" — sets the certificate’s Common Name (CN).
* `-addext` "basicConstraints = CA:FALSE" — marks the cert as not a Certificate Authority.
* `-addext` "subjectAltName = DNS:localhost" — adds a SAN entry, required by modern TLS clients.

This one-liner will produce a valid self-signed server certificate usable by the Rust client examples below.

```bash
umadb --listen 127.0.0.1:50051 --db-path ./uma.db  --tls-cert server.pem --tls-key server.key
```

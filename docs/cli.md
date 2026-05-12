---
head:
  - - meta
    - name: description
      content: How to use the UmaDB CLI
  - - meta
    - name: keywords
      content: UmaDB, binary, download, downloads, install, linux, macOS, Cargo 
---

# Using the CLI

## Command Line Interface

After [installing](./install) the `umadb` binary, you can run it from the command line.

```
umadb --listen 127.0.0.1:50051 --db-path ./uma.db
```

`umadb` supports the following command-line options:

- `--db-path` — Path to the database file or directory 
    - also via environment variable `UMADB_DB_PATH`
- `--listen` — Server bind address (e.g. `127.0.0.1:50051`)
    - also via environment variable `UMADB_LISTEN`
- `--tls-cert` — Optional file path to TLS server certificate
    - also via environment variable `UMADB_TLS_CERT`
- `--tls-key` — Optional file path to TLS server private key
    - also via environment variable `UMADB_TLS_KEY`
- `--api-key` — Optional API key for authenticating clients
    - also via environment variable `UMADB_API_KEY`
- `--read-method` — Read method (mmap or fileio)
    - also via environment variable `UMADB_READ_METHOD`
- `--page-cache-max-pages` — Page cache max pages (0 to disable)
    - also via environment variable `UMADB_PAGE_CACHE_MAX_PAGES`
- `--page-cache-max-mb` — Page cache max size in MB (0 to disable)
    - also via environment variable `UMADB_PAGE_CACHE_MAX_MB`
- `--zero-fill-pages` — Zero-fill pages (true/false)
    - also via environment variable `UMADB_ZERO_FILL_PAGES`
- `-h, --help` — Print help
- `-V, --version` - Print version

## Example with TLS and API key

The following command starts a UmaDB server with TLS enabled and an API key:

```bash
umadb \
  --db-path ./uma.db  \
  --listen 127.0.0.1:50051 \
  --tls-cert server.pem \
  --tls-key server.key \
  --api-key umadb:example-api-key-4f7c2b1d9e5f4a038c1a \
  --page-cache-max-mb 3000
```

You can generate a `server.key` and `server.pem` pair using `openssl`.

## Self-signed Certificate

For development and testing purposes, you can create a self-signed certificate with the following command:

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

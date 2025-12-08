---
head:
  - - meta
    - name: description
      content: Explains how to download and install UmaDB binary.
  - - meta
    - name: keywords
      content: UmaDB, binary, download, downloads, install, linux, macOS, Cargo 
---

# Using the CLI

## Options

Start the `umadb` server by specifying the listen address and the database path:

```
umadb --listen 127.0.0.1:50051 --db-path ./uma.db
```

`umadb` supports the following command-line options:

- `--listen`:  Address to bind to (e.g. `127.0.0.1:50051`)
- `--db-path`: Path to the database file or directory
- `--tls-cert`: Path to TLS server certificate (PEM), optional
- `--tls-key`: Path to TLS server private key (PEM), optional
- `--api-key`: API key for authenticating clients, optional
- `-h, --help`: Show help information
- `-V, --version`: Show version information

The TLS options can also be provided using environment variables:
* `UMADB_TLS_CERT` — Path to the server TLS certificate (PEM), equivalent to `--tls-cert`
* `UMADB_TLS_KEY` — Path to the server TLS private key (PEM), equivalent to `--tls-key`
* `UMADB_API_KEY` — API key for authenticating clients, equivalent to `--api-key`

## Self-signed TLS Certificate

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

## Example

```bash
umadb \
  --listen 127.0.0.1:50051 \
  --db-path ./uma.db  \
  --tls-cert server.pem \
  --tls-key server.key \
  --api-key umadb:example-api-key-4f7c2b1d9e5f4a038c1a
```

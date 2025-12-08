---
head:
  - - meta
    - name: description
      content: How to use UmaDB with Rust
  - - meta
    - name: keywords
      content: UmaDB, client, Rust
---
# Rust Clients

The [official Rust client](https://crates.io/crates/umadb-client) for UmaDB is available on crates.io.

The Rust crate `umadb-client` provides both **asynchronous** and **synchronous** clients for reading and
appending events in UmaDB via the UmaDB [gRPC API](./grpc-api).

The synchronous client functions effectively as a wrapper around the asynchronous client.

The Rust clients implement the same traits and types used internally in the UmaDB server, and so
effectively represent remotely the essential internal server operations, with gRPC used as a transport
layer for inter-process communication (IPC).

The clients and common DCB structs are described below, followed by some examples.

## Connection Builder

The `UmaDCBClient::new` function is the main entry point for the Rust UmaDB clients.

```rust
pub fn new(url: String) -> Self
```

It must be called with a URL. It returns an instance of `UmaDBClient`. Optional configuration options
can be set with chainable methods. Asynchronous and synchronous client instances can then be constructed with
the accumulated configuration.

If the `url` has `"https"` or `"grpcs"` then a "secure" gRPC channel using TLS will be created.
Otherwise, an "insecure" channel without TLS will be used.

### Optional Configuration

When using TLS, if the server's root certificate is not installed locally, perhaps if the server is using
a self-signed certificate, then the path to a file containing the certificate can be provided by calling
`ca_path()`.

```rust
pub fn ca_path(self, ca_path: String) -> Self
```

The `ca_path` argument should be a path to the PEM-encoded root or CA certificate used to sign the server's certificate.

The client can be configured to use an API key for authentication by calling `api_key()`.

```rust
pub fn api_key(self, api_key: String) -> Self
```

The `api_key` argument should be a string containing the API key to use for authentication, and must match
the server's configured API key.

The `batch_size()` method can be used to set a hint for how many events to buffer per batch when reading events.

```rust
pub fn batch_size(self, batch_size: u32) -> Self
```

The `batch_size` value can modestly affect latency and throughput. The server will also cap this value at a reasonable level.
If unset, the server will use a sensible default batch size.

### Connecting to the Server

The `connect_async()` method returns an instance of [`AsyncUmaDbClient`](#asynchronous-client).

```rust
pub async fn connect_async(&self) -> DCBResult<AsyncUmaDBClient>
```

The `connect()` method returns an instance of [`SyncUmaDbClient`](#synchronous-client).

```rust
pub fn connect(&self) -> DCBResult<SyncUmaDBClient>
```


### Examples

The examples below show how to construct synchronous and asynchronous connections to UmaDB.

::: tabs
== sync
```rust
use umadb_client::UmaDBClient;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Synchronous client without TLS (insecure connection)
    let client = UmaDBClient::new("http://localhost:50051".to_string())
        .connect()?;

    // Synchronous client with TLS (secure connection)
    let client = UmaDBClient::new("https://example.com:50051".to_string())
        .connect()?;

    // Synchronous client with TLS (self-signed server certificate)
    let client = UmaDBClient::new("https://localhost:50051".to_string())
        .ca_path("server.pem".to_string())
        .connect()?;

    // Synchronous client with TLS and API key
    let client = UmaDBClient::new("https://example.com:50051".to_string())
        .ca_path("server.pem".to_string())
        .api_key("umadb:example-api-key-4f7c2b1d9e5f4a038c1a".to_string())
        .connect()?;

    // Synchronous client with TLS and API key and batch size
    let client = UmaDBClient::new("https://example.com:50051".to_string())
        .ca_path("server.pem".to_string())
        .api_key("umadb:example-api-key-4f7c2b1d9e5f4a038c1a".to_string())
        .batch_size(1000)
        .connect()?;

    Ok(())
}
```
== async
```rust
use umadb_client::UmaDBClient;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Asynchronous client without TLS (insecure connection)
    let client = UmaDBClient::new("http://localhost:50051".to_string())
        .connect_async().await?;

    // Asynchronous client with TLS (secure connection)
    let client = UmaDBClient::new("https://example.com:50051".to_string())
        .connect_async().await?;

    // Asynchronous client with TLS (self-signed server certificate)
    let client = UmaDBClient::new("https://localhost:50051".to_string())
        .ca_path("server.pem".to_string())
        .connect_async().await?;

    // Asynchronous client with TLS and API key
    let client = UmaDBClient::new("https://example.com:50051".to_string())
        .ca_path("server.pem".to_string())
        .api_key("umadb:example-api-key-4f7c2b1d9e5f4a038c1a".to_string())
        .connect_async().await?;

    // Asynchronous client with TLS and API key and batch size
    let client = UmaDBClient::new("https://example.com:50051".to_string())
        .ca_path("server.pem".to_string())
        .api_key("umadb:example-api-key-4f7c2b1d9e5f4a038c1a".to_string())
        .batch_size(1000)
        .connect_async().await?;

    Ok(())
}
```
:::

## Asynchronous Client

The asynchronous UmaDB client implements the client-side of the gRPC API, and provides an asynchronous Rust API
for interacting with the UmaDB event store.

## Synchronous Client

The synchronous client is a thin wrapper around the asynchronous client. It provides synchronous, but otherwise
identical methods, with blocking behavior.


## Reading Events

The `read()` method reads events from the UmaDB server.

::: tabs
== sync
```rust
fn read<'a>(
    &'a self,
    query: Option<DCBQuery>,
    start: Option<u64>,
    backwards: bool,
    limit: Option<u32>,
    subscribe: bool,
) -> DCBResult<Box<dyn DCBReadResponseSync + Send + 'static>>
```
== async
```rust
async fn read<'a>(
    &'a self,
    query: Option<DCBQuery>,
    start: Option<u64>,
    backwards: bool,
    limit: Option<u32>,
    subscribe: bool,
) -> DCBResult<Box<dyn DCBReadResponseAsync + Send + 'static>>
```
:::

This method can be used both for constructing decision models in a domain layer, and for projecting events into
materialized views in CQRS. An optional [`DCBQuery`](#query) can be provided to select by tags and types.

### Parameters

| Name        | Type               | Description                                                                                                                                                  |
|-------------|--------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `query`     | `Option<DCBQuery>` | Optional structured query to filter events (by tags, event types, etc).                                                                                      |
| `start`     | `Option<u64>`      | Read events *from* this sequence number. Only events with positions greater than or equal will be returned (or less than or equal if `backwards` is `true`.  |
| `backwards` | `bool`             | If `true` events will be read backwards, either from the given position or from the last recorded event.                                                     |
| `limit`     | `Option<u32>`      | Optional cap on the number of events to retrieve.                                                                                                            |
| `subscribe` | `bool`             | If `true`, keeps the stream open to deliver future events as they arrive.                                                                                    |

Returns a "read response" instance from which [`DCBSequencedEvent`](#sequenced-event) instances, and the most relevant "last known" sequence number, can be obtained.

## Appending Events

The `append()` method writes new events to the UmaDB server.
::: tabs
== sync
```rust
fn append(
    &self,
    events: Vec<DCBEvent>,
    condition: Option<DCBAppendCondition>,
) -> DCBResult<u64>
```
== async
```rust
async fn append(
    &self,
    events: Vec<DCBEvent>,
    condition: Option<DCBAppendCondition>,
) -> DCBResult<u64>
```
:::

This method can be used to append new [`DCBEvent`](#event) to the store atomically, with optional optimistic
concurrency conditions. Events are written in order. This method is idempotent for events that have UUIDs.

### Parameters

| Name        | Type                         | Description                                                                          |
|-------------|------------------------------|--------------------------------------------------------------------------------------|
| `events`    | `Vec<DCBEvent>`              | The list of events to append. Each includes an event type, tags, and data payload.   |
| `condition` | `Option<DCBAppendCondition>` | Optional append condition (e.g. `After(u64)`) to ensure no conflicting writes occur. |

Returns the **sequence number** (`u64`) of the last successfully appended event from this operation. This
value can be used to wait for downstream event-processing components in a CQRS system to become up-to-date.

## Query

A `DCBQuery` defines criteria for selecting events in the event store.

| Field   | Type                | Description                                |
|---------|---------------------|--------------------------------------------|
| `items` | `Vec<DCBQueryItem>` | A list of selection criteria (logical OR). |

A [`DCBEvent`](#event) is selected if any [`DCBQueryItem`](#query-item) matches or the `items` field is empty.

Include in:
* [`Read requests`](#reading-events) to select events returned by the server.
* [`DCBAppendCondition`](#append-condition) to select conflicting events.

## Query Item

A `DCBQueryItem` defines a criterion for matching events.

| Field   | Type          | Description                       |
|---------|---------------|-----------------------------------|
| `types` | `Vec<String>` | List of event types (logical OR). |
| `tags`  | `Vec<String>` | List of tags (logical AND).       |

A `DCBQueryItem` will match a [`DCBEvent`](#event) if:
* one of its `types` matches the [`DCBEvent.type`](#event) or its `types` field is empty; AND
* all of its `tags` match one of the [`DCBEvent.tags`](#event) or its `tags` field is empty.

## Sequenced Event

A `DCBSequencedEvent` message represents a recorded [`DCBEvent`](#event) along with its assigned sequence number.

| Field      | Type       | Description          |
|------------|------------|----------------------|
| `position` | `u64`      | The sequence number. |
| `event`    | `DCBEvent` | The recorded event.  |

Included in:
* [`Read responses`](#reading-events) when the server responds to read requests.

## Event

A `DCBEvent` represents a single event either to be appended or already stored in the event log.

| Field        | Type           | Description                                                   |
|--------------|----------------|---------------------------------------------------------------|
| `event_type` | `String`       | The event’s logical type (e.g. `"UserRegistered"`).           |
| `tags`       | `Vec<String>`  | Tags assigned to the event (used for filtering and indexing). |
| `data`       | `Vec<u8>`      | Binary payload associated with the event.                     |
| `uuid`       | `Option<Uuid>` | Unique event ID.                                              |

Idempotent support for append operations is activated by setting a UUID on appended events.

Include in:
* [Append request](#appending-events) when writing new events to the store.

Included in:
* [`DCBSequencedEvent`](#sequenced-event) when the server responds to read requests.

Matched by:
* [`DCBQueryItem`](#query-item) during [`read()`](#reading-events) and [`append()`](#appending-events) operations.


## Append Condition

A `DCBAppendCondition` causes an append request to fail if events match its [`DCBQuery`](#query), optionally after
a sequence number.

| Field                  | Type          | Description                   |
|------------------------|---------------|-------------------------------|
| `fail_if_events_match` | `DCBQuery`    | Query for conflicting events. |
| `after`                | `Option<u64>` | Sequence number.              |

Include in:
* [Append requests](#appending-events) to define optimistic concurrent control.

To implement a consistency boundary, command handlers can use the same [`DCBQuery`](#query) used when
[reading events](#read-request) as the value of `fail_if_events_match`, and the "head" sequence
number received from the read response as the value of `after`.

## Error

The `DCBError` enum represents all errors that can occur in UmaDB.

| Variant                          | Description                                            |
|----------------------------------|--------------------------------------------------------|
| `Io(error)`                      | I/O or filesystem error.                               |
| `IntegrityError(message)`        | Append condition failed or data integrity violated.    |
| `Corruption(message)`            | Corruption detected in stored data.                    |
| `PageNotFound(page_id)`          | Referenced page not found in storage.                  |
| `DirtyPageNotFound(page_id)`     | Dirty page expected in cache not found.                |
| `RootIDMismatch(old_id, new_id)` | Mismatch between stored and computed root page IDs.    |
| `DatabaseCorrupted(message)`     | Database file corrupted or invalid.                    |
| `InternalError(message)`         | Unexpected internal logic error.                       |
| `SerializationError(message)`    | Failure to serialize data to bytes.                    |
| `DeserializationError(message)`  | Failure to parse serialized data.                      |
| `PageAlreadyFreed(page_id)`      | Attempted to free a page that was already freed.       |
| `PageAlreadyDirty(page_id)`      | Attempted to mark a page dirty that was already dirty. |
| `TransportError(message)`        | Client-server connection failed.                       |
| `AuthenticationError(message)`   | Client-server authentication failed.                   |

## Result

`type DCBResult<T>` A convenience alias for results returned by the methods:

```rust
type DCBResult<T> = Result<T, DCBError>
```

All the client methods return this type, which yields either a successful result `T` or a `DCBError`.

## Examples

The examples below show how to use the Rust clients for UmaDB:

::: tabs
== sync
```rust
use umadb_client::UmaDBClient;
use umadb_dcb::{
    DCBAppendCondition, DCBError, DCBEvent, DCBEventStoreSync, DCBQuery, DCBQueryItem,
};
use uuid::Uuid;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Connect to the gRPC server
    let url = "https://localhost:50051".to_string();
    let client = UmaDBClient::new(url)
        .ca_path("server.pem".to_string()) // For self-signed server certificates.
        .api_key("umadb:example-api-key-4f7c2b1d9e5f4a038c1a".to_string())
        .connect()?;

    // Define a consistency boundary
    let cb = DCBQuery {
        items: vec![DCBQueryItem {
            types: vec!["example".to_string()],
            tags: vec!["tag1".to_string(), "tag2".to_string()],
        }],
    };

    // Read events for a decision model
    let mut read_response = client.read(Some(cb.clone()), None, false, None, false)?;

    // Build decision model
    while let Some(result) = read_response.next() {
        match result {
            Ok(event) => {
                println!(
                    "Got event at position {}: {:?}",
                    event.position, event.event
                );
            }
            Err(status) => panic!("gRPC stream error: {}", status),
        }
    }

    // Remember the last-known position
    let last_known_position = read_response.head().unwrap();
    println!("Last known position is: {:?}", last_known_position);

    // Produce new event
    let event = DCBEvent {
        event_type: "example".to_string(),
        tags: vec!["tag1".to_string(), "tag2".to_string()],
        data: b"Hello, world!".to_vec(),
        uuid: Some(Uuid::new_v4()),
    };

    // Append event in consistency boundary
    let commit_position1 = client.append(
        vec![event.clone()],
        Some(DCBAppendCondition {
            fail_if_events_match: cb.clone(),
            after: last_known_position,
        }),
    )?;

    println!("Appended event at position: {}", commit_position1);

    // Append conflicting event - expect an error
    let conflicting_event = DCBEvent {
        event_type: "example".to_string(),
        tags: vec!["tag1".to_string(), "tag2".to_string()],
        data: b"Hello, world!".to_vec(),
        uuid: Some(Uuid::new_v4()), // different UUID
    };

    let conflicting_result = client.append(
        vec![conflicting_event],
        Some(DCBAppendCondition {
            fail_if_events_match: cb.clone(),
            after: last_known_position,
        }),
    );

    // Expect an integrity error
    match conflicting_result {
        Err(DCBError::IntegrityError(integrity_error)) => {
            println!("Conflicting event was rejected: {:?}", integrity_error);
        }
        other => panic!("Expected IntegrityError, got {:?}", other),
    }

    // Appending is idempotent for the same event IDs and append condition.
    println!(
        "Retrying to append event at position: {:?}",
        last_known_position
    );
    let commit_position2 = client.append(
        vec![event.clone()],
        Some(DCBAppendCondition {
            fail_if_events_match: cb.clone(),
            after: last_known_position,
        }),
    )?;

    if commit_position1 == commit_position2 {
        println!(
            "Append method returned same commit position: {}",
            commit_position2
        );
    } else {
        panic!("Expected idempotent retry!")
    }

    // Subscribe to all events for a projection
    let mut subscription = client.read(None, None, false, None, true)?;

    // Build an up-to-date view
    while let Some(result) = subscription.next() {
        match result {
            Ok(ev) => {
                println!("Processing event at {}: {:?}", ev.position, ev.event);
                if ev.position == commit_position2 {
                    println!("Projection has processed new event!");
                    break;
                }
            }
            Err(status) => panic!("gRPC stream error: {}", status),
        }
    }

    Ok(())
}
```
== async
```rust
use futures::StreamExt;
use umadb_client::UmaDBClient;
use umadb_dcb::{
    DCBAppendCondition, DCBError, DCBEvent, DCBEventStoreAsync, DCBQuery, DCBQueryItem,
};
use uuid::Uuid;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Connect to the gRPC server
    let url = "https://localhost:50051".to_string();
    let client = UmaDBClient::new(url)
        .ca_path("server.pem".to_string()) // For self-signed server certificates.
        .api_key("umadb:example-api-key-4f7c2b1d9e5f4a038c1a".to_string())
        .connect_async()
        .await?;

    // Define a consistency boundary
    let cb = DCBQuery {
        items: vec![DCBQueryItem {
            types: vec!["example".to_string()],
            tags: vec!["tag1".to_string(), "tag2".to_string()],
        }],
    };

    // Read events for a decision model
    let mut read_response = client
        .read(Some(cb.clone()), None, false, None, false)
        .await?;

    // Build decision model
    while let Some(result) = read_response.next().await {
        match result {
            Ok(event) => {
                println!(
                    "Got event at position {}: {:?}",
                    event.position, event.event
                );
            }
            Err(status) => panic!("gRPC stream error: {}", status),
        }
    }

    // Remember the last-known position
    let last_known_position = read_response.head().await?;
    println!("Last known position is: {:?}", last_known_position);

    // Produce new event
    let event = DCBEvent {
        event_type: "example".to_string(),
        tags: vec!["tag1".to_string(), "tag2".to_string()],
        data: b"Hello, world!".to_vec(),
        uuid: Some(Uuid::new_v4()),
    };

    // Append event in consistency boundary
    let commit_position1 = client
        .append(
            vec![event.clone()],
            Some(DCBAppendCondition {
                fail_if_events_match: cb.clone(),
                after: last_known_position,
            }),
        )
        .await?;

    println!("Appended event at position: {}", commit_position1);

    // Append conflicting event - expect an error
    let conflicting_event = DCBEvent {
        event_type: "example".to_string(),
        tags: vec!["tag1".to_string(), "tag2".to_string()],
        data: b"Hello, world!".to_vec(),
        uuid: Some(Uuid::new_v4()), // different UUID
    };

    let conflicting_result = client
        .append(
            vec![conflicting_event.clone()],
            Some(DCBAppendCondition {
                fail_if_events_match: cb.clone(),
                after: last_known_position,
            }),
        )
        .await;

    // Expect an integrity error
    match conflicting_result {
        Err(DCBError::IntegrityError(integrity_error)) => {
            println!("Conflicting event was rejected: {:?}", integrity_error);
        }
        other => panic!("Expected IntegrityError, got {:?}", other),
    }

    // Appending is idempotent for the same event IDs and append condition.
    println!(
        "Retrying to append event at position: {:?}",
        last_known_position
    );
    let commit_position2 = client
        .append(
            vec![event.clone()],
            Some(DCBAppendCondition {
                fail_if_events_match: cb.clone(),
                after: last_known_position,
            }),
        )
        .await?;

    if commit_position1 == commit_position2 {
        println!(
            "Append method returned same commit position: {}",
            commit_position2
        );
    } else {
        panic!("Expected idempotent retry!")
    }

    // Subscribe to all events for a projection
    let mut subscription = client.read(None, None, false, None, true).await?;

    // Build an up-to-date view
    while let Some(result) = subscription.next().await {
        match result {
            Ok(ev) => {
                println!("Processing event at {}: {:?}", ev.position, ev.event);
                if ev.position == commit_position2 {
                    println!("Projection has processed new event!");
                    break;
                }
            }
            Err(status) => panic!("gRPC stream error: {}", status),
        }
    }
    Ok(())
}
```
:::

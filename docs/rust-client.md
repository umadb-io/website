# Rust Clients

The [official Rust client](https://crates.io/crates/umadb-client) for UmaDB is available on crates.io.

The Rust crate `umadb-client` provides both **asynchronous** and **synchronous** clients for reading and
appending events in UmaDB via the UmaDB [gRPC API](./grpc-api).

The synchronous client functions effectively as a wrapper around the asynchronous client.

The Rust clients implement the same traits and types used internally in the UmaDB server, and so
effectively represent remotely the essential internal server operations, with gRPC used as a transport
layer for inter-process communication (IPC).

The client methods, and DCB object types, are described below, followed by some examples.

## `struct UmaDCBClient`

Config and connection builder, which constructs synchronous and async client instances.

### Fields

| Name         | Type             | Description                                                                                  |
|--------------|------------------|----------------------------------------------------------------------------------------------|
| `url`        | `String`         | Database URL                                                                                 |
| `ca_path`    | `Option<String>` | Path to server certificate (default `None`)                                                  |
| `batch_size` | `Option<u32>`    | Optional hint for how many events to buffer per batch when reading events (default `None`).  |

### Examples

The examples below use the `UmaDCBClient` builder to construct synchronous and asynchronous clients.

```rust
use umadb_client::UmaDBClient;

fn main() -> Result<(), Box<dyn std::error::Error>> {
   // Synchronous client without TLS (insecure connection)
   let client = UmaDBClient::new("http://localhost:50051".to_string()).connect()?;

   // Synchronous client with TLS (secure connection)
   let client = UmaDBClient::new("https://example.com:50051".to_string()).connect()?;
  
   // Synchronous client with TLS (self-signed server certificate)
   let client = UmaDBClient::new("https://localhost:50051".to_string()).ca_path("server.pem".to_string()).connect()?;
  
   // Asynchronous client without TLS (insecure connection)
   let client = UmaDBClient::new("http://localhost:50051".to_string()).connect_async().await?;

   // Asynchronous client with TLS (secure connection)
   let client = UmaDBClient::new("https://example.com:50051".to_string()).connect_async().await?;

   // Asynchronous client with TLS (self-signed server certificate)
   let client = UmaDBClient::new("https://localhost:50051".to_string()).ca_path("server.pem".to_string()).connect_async().await?;
```

### `fn new()`

Returns a new `UmaDCBClient` config object with the optional `ca_path` and `batch_size` fields set to `None`.

Arguments:

| Parameter | Type     | Description                                                                                                                                                                                       |
|-----------|----------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `url`     | `String` | Database URL, for example: `"http://localhost:50051".to_string()` for an UmaDB server running without TLS or `"https://localhost:50051".to_string()` for an UmaDB server running with TLS enabled |

If the required `url` argument has protocol `"https"` or `"grpcs"`, then a secure gRPC channel will created
when `connect()` or `connect_async()` is called. In this case, if the server's root certificate is not installed
locally, then the path to a file containing the certificate must be provided by calling `ca_path()`.

### `fn ca_path()`

Returns a copy of the `UmaDCBClient` config object with the optional `ca_path` field set to `Some(String)`.

Arguments:

| Parameter | Type     | Description                                                                          |
|-----------|----------|--------------------------------------------------------------------------------------|
| `ca_path` | `String` | Path to PEM-encoded server root certificate, for example: `"server.pem".to_string()` |


### `fn batch_size()`

Returns a copy of the `UmaDCBClient` config object with the optional `batch_size` field set to a `Some(u32)`.

Arguments:

| Parameter    | Type  | Description                                                                          |
|--------------|-------|--------------------------------------------------------------------------------------|
| `batch_size` | `u32` | Hint for how many events to buffer per batch when reading events, for example: `100` |

This value can modestly affect latency and throughput. If unset, a sensible default value will be used by the
server. The server will also cap this value at a reasonable level.

### `fn connect()`

Returns an instance of `SyncUmaDbClient`, the synchronous UmaDB client.

### `async fn connect_async()`

Returns an instance of `AsyncUmaDbClient`, the asynchronous UmaDB client.


## `struct SyncUmaDCBClient`

The synchronous UmaDB client.

### Example

Here's an example of how to use the synchronous Rust client for UmaDB:

```rust
use umadb_client::UmaDBClient;
use umadb_dcb::{
    DCBAppendCondition, DCBError, DCBEvent, DCBEventStoreSync, DCBQuery, DCBQueryItem,
};
use uuid::Uuid;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Connect to the gRPC server
    let url = "http://localhost:50051".to_string();
    let client = UmaDBClient::new(url).connect()?;

    // Define a consistency boundary
    let boundary = DCBQuery::new().item(
        DCBQueryItem::new()
            .types(["example"])
            .tags(["tag1", "tag2"]),
    );

    // Read events for a decision model
    let mut read_response = client.read(Some(boundary.clone()), None, false, None, false)?;

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
    let event = DCBEvent::default()
        .event_type("example")
        .tags(["tag1", "tag2"])
        .data(b"Hello, world!")
        .uuid(Uuid::new_v4());

    // Append event in consistency boundary
    let append_condition = DCBAppendCondition::new(boundary.clone()).after(last_known_position);
    let position1 = client.append(vec![event.clone()], Some(append_condition.clone()))?;

    println!("Appended event at position: {}", position1);

    // Append conflicting event - expect an error
    let conflicting_event = DCBEvent::default()
        .event_type("example")
        .tags(["tag1", "tag2"])
        .data(b"Hello, world!")
        .uuid(Uuid::new_v4()); // different UUID

    let conflicting_result = client.append(vec![conflicting_event], Some(append_condition.clone()));

    // Expect an integrity error
    match conflicting_result {
        Err(DCBError::IntegrityError(integrity_error)) => {
            println!("Conflicting event was rejected: {:?}", integrity_error);
        }
        other => panic!("Expected IntegrityError, got {:?}", other),
    }

    // Appending with identical event IDs and append condition is idempotent.
    println!(
        "Retrying to append event at position: {:?}",
        last_known_position
    );
    let position2 = client.append(vec![event.clone()], Some(append_condition.clone()))?;

    if position1 == position2 {
        println!("Append method returned same commit position: {}", position2);
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
                if ev.position == position2 {
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

### `fn read()`

Reads events from the event store, optionally with filters, sequence number, limit, and live subscription support.

This method can be used both for constructing decision models in a domain layer, and for projecting events into
materialized views in CQRS.

Arguments:

| Parameter    | Type               | Description                                                                                                                                                  |
|--------------|--------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `query`      | `Option<DCBQuery>` | Optional structured query to filter events (by tags, event types, etc).                                                                                      |
| `start`      | `Option<u64>`      | Read events *from* this sequence number. Only events with positions greater than or equal will be returned (or less than or equal if `backwards` is `true`.  |
| `backwards`  | `bool`             | If `true` events will be read backwards, either from the given position or from the last recorded event.                                                     |
| `limit`      | `Option<u32>`      | Optional cap on the number of events to retrieve.                                                                                                            |
| `subscribe`  | `bool`             | If `true`, keeps the stream open to deliver future events as they arrive.                                                                                    |

Returns a `SyncReadResponse` instance from which `DCBSequencedEvent` instances, and the most relevant "last known" sequence number, can be obtained.

### `fn append()`

Appends new events to the store atomically, with optional optimistic concurrency conditions.

Writes one or more events to the event log in order. This method is idempotent for events that have UUIDs.

Arguments:

| Parameter   | Type                         | Description                                                                          |
|-------------|------------------------------|--------------------------------------------------------------------------------------|
| `events`    | `Vec<DCBEvent>`              | The list of events to append. Each includes an event type, tags, and data payload.   |
| `condition` | `Option<DCBAppendCondition>` | Optional append condition (e.g. `After(u64)`) to ensure no conflicting writes occur. |

Returns the **sequence number** (`u64`) of the last successfully appended event from this operation.

This value can be used to wait for downstream event-processing components in
a CQRS system to become up-to-date.

### `fn head()`

Returns the **sequence number** (`u64`) of the very last successfully appended event in the database.

## `struct AsyncUmaDCBClient`

The asynchronous UmaDB client.

### Example

Here's an example of how to use the asynchronous Rust client for UmaDB:

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
    let url = "http://localhost:50051".to_string();
    let client = UmaDBClient::new(url).connect_async().await?;

    // Define a consistency boundary
    let boundary = DCBQuery::new().item(
        DCBQueryItem::new()
            .types(["example"])
            .tags(["tag1", "tag2"]),
    );

    // Read events for a decision model
    let mut read_response = client
        .read(Some(boundary.clone()), None, false, None, false)
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
    let event = DCBEvent::default()
        .event_type("example")
        .tags(["tag1", "tag2"])
        .data(b"Hello, world!")
        .uuid(Uuid::new_v4());

    // Append event in consistency boundary
    let condition = DCBAppendCondition::new(boundary.clone()).after(last_known_position);
    let position1 = client
        .append(vec![event.clone()], Some(condition.clone()))
        .await?;

    println!("Appended event at position: {}", position1);

    // Append conflicting event - expect an error
    let conflicting_event = DCBEvent::default()
        .event_type("example")
        .tags(["tag1", "tag2"])
        .data(b"Hello, world!")
        .uuid(Uuid::new_v4()); // different UUID

    let conflicting_result = client
        .append(vec![conflicting_event.clone()], Some(condition.clone()))
        .await;

    // Expect an integrity error
    match conflicting_result {
        Err(DCBError::IntegrityError(integrity_error)) => {
            println!("Conflicting event was rejected: {:?}", integrity_error);
        }
        other => panic!("Expected IntegrityError, got {:?}", other),
    }

    // Appending with identical events IDs and append conditions is idempotent.
    println!(
        "Retrying to append event at position: {:?}",
        last_known_position
    );
    let position2 = client
        .append(vec![event.clone()], Some(condition.clone()))
        .await?;

    if position1 == position2 {
        println!("Append method returned same commit position: {}", position2);
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
                if ev.position == position2 {
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


### `async fn read()`

See `fn read()` above.

Returns an `AsyncReadResponse` instance from which `DCBSequencedEvent` instances, and the most relevant "last known" sequence number, can be obtained.

### `async fn append()`

See `fn append()` above.

### `async fn head()`

See `fn head()` above.

## `struct DCBSequencedEvent`

A recorded event with its assigned **sequence number** in the event store.

| Field      | Type       | Description          |
|------------|------------|----------------------|
| `event`    | `DCBEvent` | The recorded event.  |
| `position` | `u64`      | The sequence number. |

## `struct DCBEvent`

Represents a single event either to be appended or already stored in the event log.

| Field        | Type           | Description                                                   |
|--------------|----------------|---------------------------------------------------------------|
| `event_type` | `String`       | The event’s logical type or name.                             |
| `data`       | `Vec<u8>`      | Binary payload associated with the event.                     |
| `tags`       | `Vec<String>`  | Tags assigned to the event (used for filtering and indexing). |
| `uuid`       | `Option<Uuid>` | Unique event ID.                                              |

Giving events UUIDs activates idempotent support for append operations.

## `struct DCBQuery`

A query composed of one or more `DCBQueryItem` filters.  
An event matches the query if it matches **any** of the query items.

| Field   | Type                | Description                                                                            |
|---------|---------------------|----------------------------------------------------------------------------------------|
| `items` | `Vec<DCBQueryItem>` | A list of query items. Events matching **any** of these items are included in results. |

## `struct DCBQueryItem`

Represents a single **query clause** for filtering events.

| Field   | Type          | Description                                                     |
|---------|---------------|-----------------------------------------------------------------|
| `types` | `Vec<String>` | Event types to match. If empty, all event types are considered. |
| `tags`  | `Vec<String>` | Tags that must **all** be present in the event for it to match. |

## `struct DCBAppendCondition`

Conditions that must be satisfied before an append operation succeeds.

| Field                  | Type           | Description                                                                                                    |
|------------------------|----------------|----------------------------------------------------------------------------------------------------------------|
| `fail_if_events_match` | `DCBQuery` | If this query matches **any** existing events, the append operation will fail.                                 |
| `after`                | `Option<u64>`  | Optional position constraint. If set, the append will only succeed if no events exist **after** this position. |

## `enum DCBError`

Represents all errors that can occur in UmaDB.

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

## `type DCBResult<T>`

A convenience alias for results returned by the methods:

```rust
type DCBResult<T> = Result<T, DCBError>;
```

All the client methods return this type, which yields either a successful result `T` or a `DCBError`.


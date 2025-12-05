---
head:
  - - meta
    - name: description
      content: Details of the gRPC API for UmaDB.
  - - meta
    - name: keywords
      content: UmaDB, gRPC, API
---
# gRPC API

## Services

You can interact with an UmaDB server using its **gRPC API**. The server implements the following services:

* [`UmaDBService`](#umadb-service) Main service for reading and appending events.
* [`grpc.health.v1.Health`](https://github.com/grpc/grpc/blob/master/doc/health-checking.md) Service for checking server health.

The following sections detail the [`UmaDBService`](#umadb-service) protocol defined in
[`umadb.proto`](https://github.com/umadb-io/umadb/blob/main/umadb-proto/umadb.proto).

## UmaDB Service

The `UmaDBService` is the main gRPC service for reading and appending events.

It has three RPCs:

- [`Read`](#rpcs) Get events from the event store
- [`Append`](#rpcs) Write events to the event store
- [`Head`](#rpcs) Get the sequence number of the last recorded event

### RPCs

| Name     | Request                            | Response                                   | Description                                                                               |
|----------|------------------------------------|--------------------------------------------|-------------------------------------------------------------------------------------------|
| `Read`   | [`ReadRequest`](#read-request)     | **stream**&nbsp;[`ReadResponse`](#read-response) | Streams batches of events matching the query; may remain open if `subscribe=true`.        |
| `Append` | [`AppendRequest`](#append-request) | [`AppendResponse`](#append-response)       | Appends new events atomically, returning the final sequence number.                       |
| `Head`   | [`HeadRequest`](#head-request)     | [`HeadResponse`](#head-response)           | Returns the current head position of the store.                                           |


## Read Request

Send a `ReadRequest` message to the [`Read`](#rpcs) RPC to read events from the event store.

| Field        | Type                                | Description                                                           |
|--------------|-------------------------------------|-----------------------------------------------------------------------|
| `query`      | **optional**&nbsp;[`Query`](#query) | Optional filter for selecting specific event types or tags.           |
| `start`      | **optional**&nbsp;`uint64`          | Read from this sequence number.                                       |
| `backwards`  | **optional**&nbsp;`bool`            | Start reading backwards.                                              |
| `limit`      | **optional**&nbsp;`uint32`          | Maximum number of events to return.                                   |
| `subscribe`  | **optional**&nbsp;`bool`            | If true, the stream remains open and continues delivering new events. |
| `batch_size` | **optional**&nbsp;`uint32`          | Optional batch size hint for streaming responses.                     |

The server will return a stream of [`ReadResponse`](#read-response) messages.

When `subscribe = false`, multiple `ReadResponse` messages may be streamed, but the stream will end when the "head"
position (when the read request was received) is reached.

When `subscribe = true`, the stream will continue as new events are appended to the store.

When `subscribe = true`, the value of [`ReadResponse.head`](#read-response) will be empty.

When `limit` is empty, the value of  [`ReadResponse.head`](#read-response) will be the position of the last recorded event in the database,
otherwise it will be the position of the last selected event.


## Query

The `Query` message defines a filter for selecting events by types and tags.

Used in [`ReadRequest`](#read-request) messages to filter the events returned by the server.

Used in [`AppendCondition`](#append-condition) messages to define a consistency boundary.


| Field   | Type                                         | Description                           |
|---------|----------------------------------------------|---------------------------------------|
| `items` | **repeated**&nbsp;[`QueryItem`](#query-item) | A list of query clauses (logical OR). |

Events will match if any of the [`QueryItem`](#query-item) clauses match.

If the `items` list is empty, all events will match.

## Query Item

The `QueryItem` message represents a **query clause** that matches a subset of events.

Used in [`Query`](#query) messages to detail which tags and types to match.

| Field   | Type                       | Description                       |
|---------|----------------------------|-----------------------------------|
| `types` | **repeated**&nbsp;`string` | List of event types (logical OR). |
| `tags`  | **repeated**&nbsp;`string` | List of tags (logical AND).       |

An [`Event`](#event) in the event store will match a query item if both: the [`Event.type`](#event) is mentioned in the
query item's `types` or if the query item's `types` is empty; and if all the [`Event.tags`](#)
are mentioned in the query item's `tags` or if the query items's `tags` is .

## Read Response 

The server returns a stream of `ReadResponse` messages in response to each [`ReadRequest`](#read-request)
message sent by clients to the [`Read`](#rpcs) RPC.

A `ReadResponse` message has a collection of [`SequencedEvent`](#sequenced-event) messages.

| Field    | Type                                                   | Description                                                      |
|----------|--------------------------------------------------------|------------------------------------------------------------------|
| `events` | **repeated**&nbsp;[`SequencedEvent`](#sequenced-event) | A batch of events matching the query.                            |
| `head`   | **optional**&nbsp;`uint64`                             | The current head position of the store when this batch was sent. |


## Sequenced Event

The `SequencedEvent` message represents a recorded [`Event`](#event) along with its assigned sequence number.

| Field      | Type              | Description                                                |
|------------|-------------------|------------------------------------------------------------|
| `position` | `uint64`          | Monotonically increasing event position in the global log. |
| `event`    | [`Event`](#event) | The underlying event payload.                              |

Used in [`ReadResponse`](#read-response) messages.

## Event

The `Event` message represents a single event in the event store.

| Field        | Type                       | Description                                                      |
|--------------|----------------------------|------------------------------------------------------------------|
| `event_type` | `string`                   | The logical type or name of the event (e.g. `"UserRegistered"`). |
| `tags`       | **repeated**&nbsp;`string` | Tags associated with the event for query matching and indexing.  |
| `data`       | `bytes`                    | Serialized event data (e.g. JSON, CBOR, or binary payload).      |
| `uuid`       | `string`                   | Serialized event UUID (e.g. A version 4 UUIDv4).                 |

Used by [`SequencedEvent`](#sequenced-event) messages when responding to read requests.

Used by [`AppendRequest`](#append-request) message when writing new events to the store.


## Append Request

Send a `AppendRequest` message to the [`Append`](#rpcs) RPC to append new events to the event store.

All the [`Event`](#event) messages in the `events` field will be appended atomically in order, unless
the [`AppendCondition`](#append-condition) given in the `condition` field fails.

| Field       | Type                                                     | Description                                                                |
|-------------|----------------------------------------------------------|----------------------------------------------------------------------------|
| `events`    | **repeated**&nbsp;[`Event`](#event)                      | Events to append, in order.                                                |
| `condition` | **optional**&nbsp;[`AppendCondition`](#append-condition) | Optional condition to enforce optimistic concurrency or prevent conflicts. |

If the `condition` does not fail, the server will return an [`AppendResponse`](#append-response) message. 

If the append condition fails, the server will return a gRPC error response with gRPC status `FAILED_PRECONDITION`
and a human-readable message string.  In addition, the gRPC status details attribute will have a serialised
`ErrorResponse` message that has the same human-readable message string, and [`INTEGRITY`](#error-type) as
the `error_type`., which can be unpacked and converted into a client "integrity" error.

If an operation fails, the server will return a gRPC error response with a suitable gRPC status code
and a human-readable message string. In addition, the gRPC status details attribute will have a serialised
`ErrorResponse` message that has the same human-readable message string, and an `error_type`
set to a appropriate [`ErrorType`](#error-type), which can be unpacked and converted into a client
error.


## Append Condition

The `AppendCondition` message causes an append to fail if any events matching a given [`Query`](#query) have
been recorded after a given position.

| Field                  | Type                                | Description                                                     |
|------------------------|-------------------------------------|-----------------------------------------------------------------|
| `fail_if_events_match` | **optional**&nbsp;[`Query`](#query) | Prevents append if any events matching the query already exist. |
| `after`                | **optional**&nbsp;`uint64`          | Only match events sequenced after this position.                |

Used by [`AppendRequest`](#append-request) messages to define a consistency boundary.

## Append Response

The server returns an `AppendResponse` message in response to each successful [`AppendRequest`](#append-request) message sent by clients to the [`Append`](#rpcs) RPC.

| Field      | Type     | Description                                 |
|------------|----------|---------------------------------------------|
| `position` | `uint64` | Sequence number of the last appended event. |

With CQRS-style eventually consistent projections, clients can use the returned position to wait until downstream
event processing components have become up-to-data.

## Head Request

Send a `HeadRequest` message to the [`Head`](#rpcs) RPC to get the position of the last recorded event in the event store.

_No fields._

## Head Response

The server returns an `HeadResponse` message in response to each [`HeadRequest`](#head-request) message sent by clients to the [`Head`](#rpcs) RPC.

The `position` field contains the sequence position of the last recorded event in the store, or `None` if the store is empty.

| Field      | Type                       | Description                                                       |
|------------|----------------------------|-------------------------------------------------------------------|
| `position` | **optional**&nbsp;`uint64` | The latest known event position, or `None` if the store is empty. |

## Error Response

The `ErrorResponse` message is used to return errors from the gRPC API.

| Field        | Type                       | Description                              |
|--------------|----------------------------|------------------------------------------|
| `message`    | `string`                   | Human-readable description of the error. |
| `error_type` | [`ErrorType`](#error-type) | Classification of the error.             |

If an operation fails, the server will return a gRPC error response with a suitable gRPC status code
and a human-readable message string. In addition, the gRPC status details attribute will have a serialised
`ErrorResponse` message that has the same human-readable message string, and an `error_type`
set to a appropriate [`ErrorType`](#error-type), which can be unpacked and converted into a client
error.

## Error Type

The `ErrorType` enum indicates UmaDB error types returned within an [`ErrorResponse`](#error-response) .

| Value | Name            | Description                                          |
|-------|-----------------|------------------------------------------------------|
| `0`   | `IO`            | Input/output error (e.g. storage or filesystem).     |
| `1`   | `SERIALIZATION` | Serialization or deserialization failure.            |
| `2`   | `INTEGRITY`     | Logical integrity violation (e.g. condition failed). |
| `3`   | `CORRUPTION`    | Corrupted or invalid data detected.                  |
| `4`   | `INTERNAL`      | Internal server or database error.                   |

## Summary

| Category        | Message                                                                                                                | Description                         |
|-----------------|------------------------------------------------------------------------------------------------------------------------|-------------------------------------|
| **Event Model** | [`Event`](#event), [`SequencedEvent`](#sequenced-event)                                                                | Core event representation.          |
| **Queries**     | [`Query`](#query), [`QueryItem`](#query-item)                                                                          | Define filters for event selection. |
| **Conditions**  | [`AppendCondition`](#append-condition)                                                                                 | Control write preconditions.        |
| **Read/Write**  | [`ReadRequest`](#read-request), [`ReadResponse`](#read-response), [`AppendRequest`](#append-request), [`AppendResponse`](#append-response) | Reading and appending APIs.         |
| **Meta**        | [`HeadRequest`](#head-request), [`HeadResponse`](#head-response)                                                       | Retrieve current head position.     |
| **Errors**      | [`ErrorResponse`](#error-response)                                                                                     | Consistent error representation.    |

## Example

Using the gRPC API directly in Python code might look something like this.

```python
from umadb_pb2 import (
    Event,
    QueryItem,
    Query,
    AppendCondition,
    ReadRequest,
    AppendRequest,
)
from umadb_pb2_grpc import UmaDBServiceStub
import grpc

# Connect to the gRPC server
channel = grpc.insecure_channel("127.0.0.1:50051")
client = UmaDBServiceStub(channel)

# Define a consistency boundary
cb = Query(
    items=[
        QueryItem(
            types=["example"],
            tags=["tag1", "tag2"],
        )
    ]
)

# Read events for a decision model
read_request = ReadRequest(
    query=cb,
    start=None,
    backwards=False,
    limit=None,
    subscribe=False,
    batch_size=None,
)
read_stream = client.Read(read_request)

# Build decision model
last_head = None
for read_response in read_stream:
    for sequenced_event in read_response.events:
        print(
            f"Got event at position {sequenced_event.position}: {sequenced_event.event}"
        )
    last_head = read_response.head

print("Last known position is:", last_head)

# Produce new event
event = Event(
    event_type="example",
    tags=["tag1", "tag2"],
    data=b"Hello, world!",
)

# Append event in consistency boundary
append_request = AppendRequest(
    events=[event],
    condition=AppendCondition(
        fail_if_events_match=cb,
        after=last_head,
    ),
)
commit_response = client.Append(append_request)
commit_position = commit_response.position
print("Appended event at position:", commit_position)

# Append conflicting event - expect an error
conflicting_request = AppendRequest(
    events=[event],
    condition=AppendCondition(
        fail_if_events_match=cb,
        after=last_head,
    ),
)
try:
    conflicting_response = client.Append(conflicting_request)
    # If no exception, this is unexpected
    raise RuntimeError("Expected IntegrityError but append succeeded")
except grpc.RpcError as e:
    # Translate gRPC error codes to logical DCB errors if desired
    if e.code() == grpc.StatusCode.FAILED_PRECONDITION:
        print("Error appending conflicting event:", e.details())
    else:
        raise

# Subscribe to all events for a projection
subscription_request = ReadRequest()

subscription_stream = client.Read(subscription_request)

# Build an up-to-date view
for read_response in subscription_stream:
    for ev in read_response.events:
        print(f"Processing event at {ev.position}: {ev.event}")
        if ev.position == commit_position:
            print("Projection has processed new event!")
            break

```
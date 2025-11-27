# gRPC API

You can interact with an UmaDB server using its **gRPC API**. The server implements the following methods:

- `Read`: Read events from the event store
- `Append`: Append events to the event store
- `Head`: Get the sequence number of the last recorded event

The following sections detail the protocol defined in `umadb.proto`.

## Service Definition — `UmaDBService`

The main gRPC service for reading and appending events.

| RPC      | Request              | Response                            | Description                                                                        |
|----------|----------------------|-------------------------------------|------------------------------------------------------------------------------------|
| `Read`   | `ReadRequestProto`   | **stream**&nbsp;`ReadResponseProto` | Streams batches of events matching the query; may remain open if `subscribe=true`. |
| `Append` | `AppendRequestProto` | `AppendResponseProto`               | Appends new events atomically, returning the final sequence number.                |
| `Head`   | `HeadRequestProto`   | `HeadResponseProto`                 | Returns the current head position of the store.                                    |


## Read Request — **`ReadRequestProto`**

Request to read events from the event store.

| Field        | Type                           | Description                                                           |
|--------------|--------------------------------|-----------------------------------------------------------------------|
| `query`      | **optional**&nbsp;`QueryProto` | Optional filter for selecting specific event types or tags.           |
| `start`      | **optional**&nbsp;`uint64`     | Read from this sequence number.                                       |
| `backwards`  | **optional**&nbsp;`bool`       | Start reading backwards.                                              |
| `limit`      | **optional**&nbsp;`uint32`     | Maximum number of events to return.                                   |
| `subscribe`  | **optional**&nbsp;`bool`       | If true, the stream remains open and continues delivering new events. |
| `batch_size` | **optional**&nbsp;`uint32`     | Optional batch size hint for streaming responses.                     |

## Read Response — **`ReadResponseProto`**

Returned for each streamed batch of messages in response to a `Read` request.

| Field    | Type                                    | Description                                                      |
|----------|-----------------------------------------|------------------------------------------------------------------|
| `events` | **repeated**&nbsp;`SequencedEventProto` | A batch of events matching the query.                            |
| `head`   | **optional**&nbsp;`uint64`              | The current head position of the store when this batch was sent. |

When `subscribe = true`, multiple `ReadResponseProto` messages may be streamed as new events arrive.

When `subscribe = true`, the value of `head` will be empty.

When `limit` is empty, the value of `head` will be the position of the last recorded event in the database,
otherwise it will be the position of the last selected event.

## Append Request — **`AppendRequestProto`**

Request to append new events to the store.

| Field       | Type                                     | Description                                                                |
|-------------|------------------------------------------|----------------------------------------------------------------------------|
| `events`    | **repeated**&nbsp;`EventProto`           | Events to append, in order.                                                |
| `condition` | **optional**&nbsp;`AppendConditionProto` | Optional condition to enforce optimistic concurrency or prevent conflicts. |

## Append Response — **`AppendResponseProto`**

Response after successfully appending events.

| Field      | Type     | Description                                 |
|------------|----------|---------------------------------------------|
| `position` | `uint64` | Sequence number of the last appended event. |

With CQRS-style eventually consistent projections, clients can use the returned position to wait until downstream
event processing components have become up-to-data.

## Head Request — **`HeadRequestProto`**

Empty request used to query the current head of the event store.

_No fields._

## Head Response — **`HeadResponseProto`**

Response containing the current head position.

| Field      | Type                       | Description                                                       |
|------------|----------------------------|-------------------------------------------------------------------|
| `position` | **optional**&nbsp;`uint64` | The latest known event position, or `None` if the store is empty. |

## Sequenced Event — **`SequencedEventProto`**

Represents an event along with its assigned sequence number.

| Field      | Type         | Description                                                |
|------------|--------------|------------------------------------------------------------|
| `position` | `uint64`     | Monotonically increasing event position in the global log. |
| `event`    | `EventProto` | The underlying event payload.                              |

## Event — **`EventProto`**

Represents a single event.

| Field        | Type                       | Description                                                      |
|--------------|----------------------------|------------------------------------------------------------------|
| `event_type` | `string`                   | The logical type or name of the event (e.g. `"UserRegistered"`). |
| `tags`       | **repeated**&nbsp;`string` | Tags associated with the event for query matching and indexing.  |
| `data`       | `bytes`                    | Serialized event data (e.g. JSON, CBOR, or binary payload).      |
| `uuid`       | `string`                   | Serialized event UUID (e.g. A version 4 UUIDv4).                 |

## Query — **`QueryProto`**

Encapsulates one or more `QueryItemProto`ueryitemproto) entries.

| Field   | Type                               | Description                           |
|---------|------------------------------------|---------------------------------------|
| `items` | **repeated**&nbsp;`QueryItemProto` | A list of query clauses (logical OR). |

## Query Item — **`QueryItemProto`**

Represents a **query clause** that matches a subset of events.

| Field   | Type                       | Description                       |
|---------|----------------------------|-----------------------------------|
| `types` | **repeated**&nbsp;`string` | List of event types (logical OR). |
| `tags`  | **repeated**&nbsp;`string` | List of tags (logical AND).       |


## Append Condition  — **`AppendConditionProto`**

Optional conditions used to control whether an append should proceed.

| Field                  | Type                           | Description                                                     |
|------------------------|--------------------------------|-----------------------------------------------------------------|
| `fail_if_events_match` | **optional**&nbsp;`QueryProto` | Prevents append if any events matching the query already exist. |
| `after`                | **optional**&nbsp;`uint64`     | Only match events sequenced after this position.                |

## Error Response — **`ErrorResponseProto`**

Represents an application-level error returned by the service.

| Field        | Type        | Description                              |
|--------------|-------------|------------------------------------------|
| `message`    | `string`    | Human-readable description of the error. |
| `error_type` | `ErrorType` | Classification of the error.             |

## Error Type — **ErrorType**

| Value | Name            | Description                                          |
|-------|-----------------|------------------------------------------------------|
| `0`   | `IO`            | Input/output error (e.g. storage or filesystem).     |
| `1`   | `SERIALIZATION` | Serialization or deserialization failure.            |
| `2`   | `INTEGRITY`     | Logical integrity violation (e.g. condition failed). |
| `3`   | `CORRUPTION`    | Corrupted or invalid data detected.                  |
| `4`   | `INTERNAL`      | Internal server or database error.                   |

The "rich status" message can be used to extract structured error details.

## Summary

| Category        | Message                                                                              | Description                         |
|-----------------|--------------------------------------------------------------------------------------|-------------------------------------|
| **Event Model** | `EventProto`, `SequencedEventProto`                                                  | Core event representation.          |
| **Queries**     | `QueryProto`, `QueryItemProto`                                                       | Define filters for event selection. |
| **Conditions**  | `AppendConditionProto`                                                               | Control write preconditions.        |
| **Read/Write**  | `ReadRequestProto`, `ReadResponseProto`, `AppendRequestProto`, `AppendResponseProto` | Reading and appending APIs.         |
| **Meta**        | `HeadRequestProto`, `HeadResponseProto`                                              | Retrieve current head position.     |
| **Errors**      | `ErrorResponseProto`                                                                 | Consistent error representation.    |

## Example

Using the gRPC API directly in Python code might look something like this.

```python
from umadb_pb2 import (
    EventProto,
    QueryItemProto,
    QueryProto,
    AppendConditionProto,
    ReadRequestProto,
    AppendRequestProto,
)
from umadb_pb2_grpc import UmaDBServiceStub
import grpc

# Connect to the gRPC server
channel = grpc.insecure_channel("127.0.0.1:50051")
client = UmaDBServiceStub(channel)

# Define a consistency boundary
cb = QueryProto(
    items=[
        QueryItemProto(
            types=["example"],
            tags=["tag1", "tag2"],
        )
    ]
)

# Read events for a decision model
read_request = ReadRequestProto(
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
event = EventProto(
    event_type="example",
    tags=["tag1", "tag2"],
    data=b"Hello, world!",
)

# Append event in consistency boundary
append_request = AppendRequestProto(
    events=[event],
    condition=AppendConditionProto(
        fail_if_events_match=cb,
        after=last_head,
    ),
)
commit_response = client.Append(append_request)
commit_position = commit_response.position
print("Appended event at position:", commit_position)

# Append conflicting event - expect an error
conflicting_request = AppendRequestProto(
    events=[event],
    condition=AppendConditionProto(
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
subscription_request = ReadRequestProto()

subscription_stream = client.Read(subscription_request)

# Build an up-to-date view
for read_response in subscription_stream:
    for ev in read_response.events:
        print(f"Processing event at {ev.position}: {ev.event}")
        if ev.position == commit_position:
            print("Projection has processed new event!")
            break

```
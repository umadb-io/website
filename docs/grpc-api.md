---
head:
  - - meta
    - name: description
      content: Details the gRPC API for UmaDB
  - - meta
    - name: keywords
      content: UmaDB, gRPC, API
---
# gRPC API

You can interact with an UmaDB server using its **gRPC API**.

* [`grpc.health.v1.Health`](https://github.com/grpc/grpc/blob/master/doc/health-checking.md) — for checking **server health**.
* [`umadb.v1.DCB`](#dcb-service) — for **reading and appending** DCB events.

The sections below detail the `umadb.v1.DCB` service defined in
[`umadb.proto`](https://github.com/umadb-io/umadb/blob/main/umadb-proto/proto/v1/umadb.proto).


## DCB Service

UmaDB's gRPC service for reading and appending events exposes four RPC methods:

| Name              | Request                                | Response                                         | Description                                                                                                                            |
|-------------------|----------------------------------------|--------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------|
| `Append`          | [`AppendRequest`](#append-request)     | [`AppendResponse`](#append-response)             | Appends new events atomically, with optional append condition, and optional tracking information.                                      |
| `Read`            | [`ReadRequest`](#read-request)         | **stream**&nbsp;[`ReadResponse`](#read-response) | Streams stored events from the server to the client, optionally as a subscription.                                                     |
| `Head`            | [`HeadRequest`](#head-request)         | [`HeadResponse`](#head-response)                 | Returns the position of the last event in the database; used to measure the volume of stored events.                                   |
| `GetTrackingInfo` | [`TrackingRequest`](#tracking-request) | [`TrackingResponse`](#tracking-response)         | Returns the last recorded position in an upstream sequence of events; used when starting or resuming event processing components. |


## Append Request

Send an `AppendRequest` to the [`Append`](#dcb-service) RPC to store new events.
All the [`Event`](#event) messages in the `events` field will be appended atomically in order, unless
the [`AppendCondition`](#append-condition) given in the `condition` field fails.

| Field           | Type                                                     | Description                                                                                      |
|-----------------|----------------------------------------------------------|--------------------------------------------------------------------------------------------------|
| `events`        | **repeated**&nbsp;[`Event`](#event)                      | Events to append, in order.                                                                      |
| `condition`     | **optional**&nbsp;[`AppendCondition`](#append-condition) | Optional condition to enforce optimistic concurrency and detect conflicts.                       |
| `tracking_info` | **optional**&nbsp;[`TrackingInfo`](#tracking-info)       | Optional tracking information; used by event processing components to checkpoint their progress. |

The server will return an [`AppendResponse`](#append-response) message if the `condition` does not fail.

If the append condition fails, or if the tracking information conflicts, the server will return a gRPC error response
with gRPC status `FAILED_PRECONDITION` and a human-readable message string.  In addition, the gRPC status details
attribute will have a serialised [`ErrorResponse`](#error-response) message, that has the same human-readable message string
and [`INTEGRITY`](#error-type) as the `error_type`.

Conditional appending of events with UUIDs is idempotent. The server does not enforce uniqueness of event IDs.


## Append Response

The server returns an `AppendResponse` message for each successful [`AppendRequest`](#append-request).

| Field      | Type     | Description                                 |
|------------|----------|---------------------------------------------|
| `position` | `uint64` | Sequence number of the last appended event. |

Clients can use the returned `position` to wait until downstream
event processing components have become up-to-date, avoiding out-of-date views being presented to users.


## Read Request

Send a `ReadRequest` to the [`Read`](#dcb-service) RPC to read events from the event store.

Set `query` to select only specific events. Set `start` to read only from a specific position. If `start` is not set,
events will be read from the first recorded event, or the last if `backwards` is `true`.

| Field        | Type                                | Description                                                           |
|--------------|-------------------------------------|-----------------------------------------------------------------------|
| `query`      | **optional**&nbsp;[`Query`](#query) | Optional filter for selecting specific event types or tags.           |
| `start`      | **optional**&nbsp;`uint64`          | Read from this sequence number.                                       |
| `backwards`  | **optional**&nbsp;`bool`            | Start reading backwards (default `false`).                            |
| `limit`      | **optional**&nbsp;`uint32`          | Maximum number of events to return (default unlimited).               |
| `subscribe`  | **optional**&nbsp;`bool`            | If true, the stream remains open and continues delivering new events. |
| `batch_size` | **optional**&nbsp;`uint32`          | Optional batch size hint for streaming responses.                     |

The server will return a stream of [`ReadResponse`](#read-response) messages. The default value of `subscribe` is
`false`, meaning the stream will end when all selected events have been received. When `subscribe` is `true`, the stream
will continue as new events are appended to the store.


## Read Response

A stream of `ReadResponse` messages are sent in response to each [`ReadRequest`](#read-request).
A collection of [`SequencedEvent`](#sequenced-event) messages can be obtained from the `events` field.


| Field    | Type                                                   | Description                                                          |
|----------|--------------------------------------------------------|----------------------------------------------------------------------|
| `events` | **repeated**&nbsp;[`SequencedEvent`](#sequenced-event) | A batch of events matching the [`ReadRequest.query`](#read-request). |
| `head`   | **optional**&nbsp;`uint64`                             | The position of the last recorded event.                             |

When [`ReadRequest.subscribe`](#read-request) was `false` and [`ReadRequest.limit`](#read-request) was `None`,
the value of  `head` will be the position of the last recorded event in the database during the reader transaction.

Otherwise, if [`ReadRequest.subscribe`](#read-request) was `true`, the value of `head` will be empty.

Otherwise, if [`ReadRequest.limit`](#read-request) was a `uint64`, the value of `head` will be the position
of the last event in the message's `events` field.


## Head Request

Send a `HeadRequest` to the [`Head`](#dcb-service) RPC to get the position of the last recorded event in the event store.

_This message has no fields._


## Head Response

The server returns a `HeadResponse` message in response to each [`HeadRequest`](#head-request) message sent by clients to the [`Head`](#dcb-service) RPC.

| Field      | Type                       | Description                                                       |
|------------|----------------------------|-------------------------------------------------------------------|
| `position` | **optional**&nbsp;`uint64` | The latest known event position, or `None` if the store is empty. |

The `position` field contains the sequence position of the last recorded event in the store, or `None` if the store is empty.


## Tracking Request

Send a `TrackingRequest` to the [`GetTrackingInfo`](#dcb-service) RPC to get the last recorded position in an upstream sequence of events.

| Field    | Type     | Description             |
|----------|----------|-------------------------|
| `source` | `string` | Upstream sequence name. |


## Tracking Response

The server returns a `TrackingResponse` message in response to each [`TrackingRequest`](#tracking-request) message sent by clients to the [`GetTrackingInfo`](#dcb-service) RPC.

| Field      | Type                       | Description                 |
|------------|----------------------------|-----------------------------|
| `position` | **optional**&nbsp;`uint64` | The last recorded position. |

The `position` field contains the last recorded position in an upstream sequence of events, or `None` if the sequence name is not found.


## Event

An `Event` represents a single event either to be appended or already stored in the event log.

| Field        | Type                       | Description                                                   |
|--------------|----------------------------|---------------------------------------------------------------|
| `event_type` | `string`                   | The event’s logical type (e.g. `"UserRegistered"`).           |
| `tags`       | **repeated**&nbsp;`string` | Tags assigned to the event (used for filtering and indexing). |
| `data`       | `bytes`                    | Binary payload associated with the event.                     |
| `uuid`       | `string`                   | Unique event ID (e.g. serialized version 4 UUIDv4).           |

Idempotent support for append operations is activated by setting a UUID on appended events. The server
does not enforce uniqueness of event IDs.

Include in:
* [`AppendRequest`](#append-request) when writing new events to the store.

Included in:
* [`SequencedEvent`](#sequenced-event) when the server responds to read requests.

Matched by:
* [`QueryItem`](#query-item) during [`Read`](#dcb-service) and [`Append`](#dcb-service) operations.


## Append Condition

An `AppendCondition` causes an append request to fail if events match its [`Query`](#query), optionally after
a sequence number.

| Field                  | Type                                | Description                   |
|------------------------|-------------------------------------|-------------------------------|
| `fail_if_events_match` | **optional**&nbsp;[`Query`](#query) | Query for conflicting events. |
| `after`                | **optional**&nbsp;`uint64`          | Sequence number.              |

Include in:
* [`AppendRequest`](#append-request) to define optimistic concurrent control.

To implement a consistency boundary, command handlers can use the same [`Query`](#query) used in
[`ReadRequest`](#read-request) as the value of `fail_if_events_match`, and the "head" received in
the [`ReadResponse`](#read-response) as the value of `after`, when appending new events generated
by a decision model.


## Tracking Info

A `TrackingInfo` message represents the source and position of an upstream event.

| Field      | Type     | Description               |
|------------|----------|---------------------------|
| `source`   | `string` | Upstream sequence name.   |
| `position` | `uint64` | Upstream sequence number. |

Include in:
* [`AppendRequest`](#append-request) when recording the results of processing an upstream event.


## Query

A `Query` defines criteria for selecting events in the event store.

| Field   | Type                                 | Description                                |
|---------|--------------------------------------|--------------------------------------------|
| `items` | **repeated**&nbsp;[`QueryItem`](#query-item) | A list of selection criteria (logical OR). |

An [`Event`](#event) is selected if any [`QueryItem`](#query-item) matches or the `items` field is empty.

Include in:
* [`ReadRequest`](#read-request) to select events returned by the server.
* [`AppendCondition`](#append-condition) to select conflicting events.


## Query Item

A `QueryItem` defines a criterion for matching events.

| Field   | Type                       | Description                       |
|---------|----------------------------|-----------------------------------|
| `types` | **repeated**&nbsp;`string` | List of event types (logical OR). |
| `tags`  | **repeated**&nbsp;`string` | List of tags (logical AND).       |

A `QueryItem` will match an [`Event`](#event) if:
* one of its `types` matches the [`Event.event_type`](#event) or its `types` field is empty; AND
* all of its `tags` match one of the [`Event.tags`](#event) or its `tags` field is empty.

Include in:
* [`Query`](#query) to define which events to select.


## Sequenced Event

A `SequencedEvent` represents a recorded [`Event`](#event) along with its assigned sequence number.

| Field      | Type              | Description          |
|------------|-------------------|----------------------|
| `position` | `uint64`          | The sequence number. |
| `event`    | [`Event`](#event) | The recorded event.  |

Included in:
* [`ReadResponse`](#read-response) when the server responds to read requests.


## Authentication

UmaDB servers can be configured to require TLS and an API key for client requests. When enabled, clients must include
the API key in the `Authorization` metadata of each gRPC request.

```
Authorization: Bearer <API_KEY>
```

### Example (Python gRPC client)

```python
import grpc

metadata = [('authorization', f'Bearer {API_KEY}')]
stub = UmaDBStub(channel)
response = stub.SomeRpcMethod(request, metadata=metadata)
```

Notes:
- Header keys are case-insensitive; the server will recognize Authorization, authorization, or any variation.
- The header value (Bearer <API_KEY>) is case-sensitive, so Bearer must be capitalized exactly as shown, with a single space between Bearer and the API key.
- Requests without a valid API key will be rejected with an `UNAUTHENTICATED` gRPC status, with status
  details showing an `AUTHENTICATION` [error](#error-response).
- Replace <API_KEY> with the key provided by the server administrator.


## Error Response

An `ErrorResponse` is used to return errors from the gRPC API.

If an operation fails, the server will return a gRPC response with a standard gRPC error status,
and a human-readable message string. In addition, the gRPC status details will have a serialised
`ErrorResponse` message with the same human-readable message string and an `error_type`
set to a appropriate API [`ErrorType`](#error-type).

| Field        | Type                       | Description                              |
|--------------|----------------------------|------------------------------------------|
| `message`    | `string`                   | Human-readable description of the error. |
| `error_type` | [`ErrorType`](#error-type) | Classification of the error.             |

Clients should attempt to read the status details attribute and deserialize an `ErrorResponse`
message into a suitable error or exception, and it that fails, then fall back to using
standard gRPC error status with the given message string.

## Error Type

The `ErrorType` enum indicates UmaDB error types returned within an [`ErrorResponse`](#error-response) .

| Value | Name               | Description                                          |
|-------|--------------------|------------------------------------------------------|
| `0`   | `IO`               | Input/output error (e.g. storage or filesystem).     |
| `1`   | `SERIALIZATION`    | Serialization or deserialization failure.            |
| `2`   | `INTEGRITY`        | Logical integrity violation (e.g. condition failed). |
| `3`   | `CORRUPTION`       | Corrupted or invalid data detected.                  |
| `4`   | `INTERNAL`         | Internal server or database error.                   |
| `5`   | `AUTHENTICATION`   | Client-server authentication error.                  |
| `6`   | `INVALID_ARGUMENT` | Request contains an invalid argument.                |


## Summary

| Category        | Message                                                                                                                                    | Description                          |
|-----------------|--------------------------------------------------------------------------------------------------------------------------------------------|--------------------------------------|
| **Event Model** | [`Event`](#event), [`SequencedEvent`](#sequenced-event)                                                                                    | Core event representation.           |
| **Queries**     | [`Query`](#query), [`QueryItem`](#query-item)                                                                                              | Define filters for event selection.  |
| **Conditions**  | [`AppendCondition`](#append-condition)                                                                                                     | Control write preconditions.         |
| **Read/Write**  | [`ReadRequest`](#read-request), [`ReadResponse`](#read-response), [`AppendRequest`](#append-request), [`AppendResponse`](#append-response) | Reading and appending APIs.          |
| **Meta**        | [`HeadRequest`](#head-request), [`HeadResponse`](#head-response)                                                                           | Retrieve current head position.      |
| **Tracking**    | [`TrackingRequest`](#tracking-request), [`TrackingResponse`](#tracking-response)                                                           | Retrieve current head position.      |
| **Errors**      | [`ErrorResponse`](#error-response)                                                                                                         | Consistent error representation.     |


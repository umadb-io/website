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

## gRPC Services

You can interact with an UmaDB server using its **gRPC API**. The server implements the following services:

* [`grpc.health.v1.Health`](https://github.com/grpc/grpc/blob/master/doc/health-checking.md) — for checking server **health**.
* [`umadb.v1.DCB`](#dcb-service) — for **reading and appending** DCB events.

The following sections detail the `umadb.v1.DCB` protocol defined in
[`umadb.proto`](https://github.com/umadb-io/umadb/blob/main/umadb-proto/proto/v1/umadb.proto).


## DCB Service


This is UmaDB's gRPC service for reading and appending events. It has three RPCs:

- [`Read`](#rpcs) — get events from the event store.
- [`Append`](#rpcs) — write events to the event store.
- [`Head`](#rpcs) — position of the last recorded event.

### RPCs

| Name     | Request                            | Response                                   | Description                                                                               |
|----------|------------------------------------|--------------------------------------------|-------------------------------------------------------------------------------------------|
| `Read`   | [`ReadRequest`](#read-request)     | **stream**&nbsp;[`ReadResponse`](#read-response) | Streams batches of events matching the query; may remain open if `subscribe=true`.        |
| `Append` | [`AppendRequest`](#append-request) | [`AppendResponse`](#append-response)       | Appends new events atomically, returning the final sequence number.                       |
| `Head`   | [`HeadRequest`](#head-request)     | [`HeadResponse`](#head-response)           | Returns the current head position of the store.                                           |


## Read Request

Send a `ReadRequest` message to the [`Read`](#rpcs) RPC to read events from the event store.

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

## Query

A `Query` message defines criteria for selecting events in the event store.

| Field   | Type                                         | Description                                |
|---------|----------------------------------------------|--------------------------------------------|
| `items` | **repeated**&nbsp;[`QueryItem`](#query-item) | A list of selection criteria (logical OR). |

An [`Event`](#event) is selected if any [`QueryItem`](#query-item) matches or the `items` field is empty.

Include in:
* [`ReadRequest`](#read-request) to select events returned by the server.
* [`AppendCondition`](#append-condition) to select conflicting events.

## Query Item

A `QueryItem` message defines a criterion for matching events.

| Field   | Type                       | Description                       |
|---------|----------------------------|-----------------------------------|
| `types` | **repeated**&nbsp;`string` | List of event types (logical OR). |
| `tags`  | **repeated**&nbsp;`string` | List of tags (logical AND).       |

A `QueryItem` will match an [`Event`](#event) if:
* one of the `types` matches the [`Event.type`](#event) or the `types` field is empty; AND
* all of the `tags` match one of the [`Event.tags`](#event) or the `tags` field is empty.

Include in:
* [`Query`](#query) messages to define which events to select.

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

## Sequenced Event

A `SequencedEvent` message represents a recorded [`Event`](#event) along with its assigned sequence number.

| Field      | Type              | Description                                                |
|------------|-------------------|------------------------------------------------------------|
| `position` | `uint64`          | Monotonically increasing event position in the global log. |
| `event`    | [`Event`](#event) | The underlying event payload.                              |

Included in:
* [`ReadResponse`](#read-response) messages when the server responds to read requests.

## Event

An `Event` message represents a single event in the event store.

| Field        | Type                       | Description                                                      |
|--------------|----------------------------|------------------------------------------------------------------|
| `event_type` | `string`                   | The logical type or name of the event (e.g. `"UserRegistered"`). |
| `tags`       | **repeated**&nbsp;`string` | Tags associated with the event for query matching and indexing.  |
| `data`       | `bytes`                    | Serialized event data (e.g. JSON, CBOR, or binary payload).      |
| `uuid`       | `string`                   | Serialized event UUID (e.g. A version 4 UUIDv4).                 |

Include in:
* [`AppendRequest`](#append-request) when writing new events to the store.

Included in:
* [`SequencedEvent`](#sequenced-event) when the server responds to read requests.

Matched by:
* [`QueryItem`](#query-item) during [`Read`](#rpcs) and [`Append`](#rpcs) operations. 


## Append Request

Send a `AppendRequest` message to the [`Append`](#rpcs) RPC to append new events.
All the [`Event`](#event) messages in the `events` field will be appended atomically in order, unless
the [`AppendCondition`](#append-condition) given in the `condition` field fails.

| Field       | Type                                                     | Description                                                                |
|-------------|----------------------------------------------------------|----------------------------------------------------------------------------|
| `events`    | **repeated**&nbsp;[`Event`](#event)                      | Events to append, in order.                                                |
| `condition` | **optional**&nbsp;[`AppendCondition`](#append-condition) | Optional condition to enforce optimistic concurrency and detect conflicts. |

The server will return an [`AppendResponse`](#append-response) message if the `condition` does not fail.

If the append condition fails, the server will return a gRPC error response with gRPC status `FAILED_PRECONDITION`
and a human-readable message string.  In addition, the gRPC status details attribute will have a serialised
[`ErrorResponse`](#error-response) message, that has the same human-readable message string and [`INTEGRITY`](#error-type) as
the `error_type`.


## Append Condition

An `AppendCondition` message causes an append request to fail if events match, optionally after
the "last known position".

| Field                  | Type                                | Description                   |
|------------------------|-------------------------------------|-------------------------------|
| `fail_if_events_match` | **optional**&nbsp;[`Query`](#query) | Query for conflicting events. |
| `after`                | **optional**&nbsp;`uint64`          | The "last known position".    |

Include in:
* [`AppendRequest`](#append-request) to define optimistic concurrent control.

Command handlers can use the given value of [`ReadRequest.query`](#read-request) as the value of `fail_if_events_match`, and the
received value of [`ReadResponse.head`](#read-response) as the value of `after`, when appending new events generated
by a decision model.

## Append Response

The server returns an `AppendResponse` message for each successful [`AppendRequest`](#append-request).

| Field      | Type     | Description                                 |
|------------|----------|---------------------------------------------|
| `position` | `uint64` | Sequence number of the last appended event. |

Clients can use the returned `position` to wait until downstream
event processing components have become up-to-date, avoiding out-of-date views being presented to users.

## Head Request

Send a `HeadRequest` message to the [`Head`](#rpcs) RPC to get the position of the last recorded event in the event store.

_This message has no fields._

## Head Response

The server returns an `HeadResponse` message in response to each [`HeadRequest`](#head-request) message sent by clients to the [`Head`](#rpcs) RPC.

| Field      | Type                       | Description                                                       |
|------------|----------------------------|-------------------------------------------------------------------|
| `position` | **optional**&nbsp;`uint64` | The latest known event position, or `None` if the store is empty. |

The `position` field contains the sequence position of the last recorded event in the store, or `None` if the store is empty.

## Error Response

The `ErrorResponse` message is used to return errors from the gRPC API.

| Field        | Type                       | Description                              |
|--------------|----------------------------|------------------------------------------|
| `message`    | `string`                   | Human-readable description of the error. |
| `error_type` | [`ErrorType`](#error-type) | Classification of the error.             |

If an operation fails, the server will return a gRPC error response with a suitable gRPC status code
and a human-readable message string. In addition, the gRPC status details attribute will have a serialised
`ErrorResponse` message that has the same human-readable message string, and an `error_type`
set to a appropriate [`ErrorType`](#error-type).

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


---
head:
  - - meta
    - name: description
      content: How to use UmaDB with Python
  - - meta
    - name: keywords
      content: UmaDB, client, Python
---
# Python Client for UmaDB

The Python package [`umadb`](https://pypi.org/project/umadb/) is available on PyPI and provides a synchronous
client for reading and appending events to UmaDB over its [gRPC API](../grpc-api.md) using [Rust-powered bindings](./rust) via
[PyO3](https://pyo3.rs/).

It is adapted into the Python [eventsourcing](https://eventsourcing.readthedocs.io/en/stable/topics/dcb.html)
library via the [eventsourcing-umadb](https://pypi.org/project/eventsourcing-umadb/) package.

## Installation

Add [`umadb`](https://pypi.org/project/umadb/) to your Python project:

::: tabs
== uv
```bash
uv add "umadb"
```
== poetry
```bash
poetry add "umadb"
```
== pipenv
```bash
pipenv install "umadb"
```
== pip
```bash
pip install "umadb" && pip freeze > requirements.txt
```
:::

## Connecting to UmaDB

Use the `Client` class as the main entry point for connecting to an UmaDB server.

```python
class Client(
    url: str,
    ca_path: str | None = None,
    api_key: str | None = None,
    batch_size: int | None = None,
):
    ...
```

### Parameters

| Name         | Type        | Description                                                                                                                                         |
|--------------|-------------|-----------------------------------------------------------------------------------------------------------------------------------------------------|
| `url`        | `str`       | Required connection string. If the argument starts with `https` or `grpcs`, a secure TLS channel is created; otherwise an insecure channel is used. |
| `ca_path`    | `str\|None` | Optional path to a PEM-encoded root/CA certificate for TLS connections (useful for self-signed servers).                                            |
| `api_key`    | `str\|None` | Optional API key used for authenticating with the server.                                                                                           |
| `batch_size` | `int\|None` | Optional hint for how many events to buffer per batch when reading. The server may cap this; a sensible default is used if unset..                  |

### Connection Examples

```python
import umadb

# Without TLS (insecure connection)
client = umadb.Client("http://localhost:50051")

    
# With batch size hint (insecure connection)
client = umadb.Client(
    url="http://example.com:50051",
    batch_size=1000,
)

# With TLS (system CAs)
client = umadb.Client("https://example.com:50051")

# With TLS (system CAs) + API key
client = umadb.Client(
    url="https://example.com:50051",
    api_key="umadb:example-api-key-4f7c2b1d9e5f4a038c1a",
)

# With TLS (self-signed)
client = umadb.Client(
    url="https://localhost:50051",
    ca_path="server.pem",
)

# With TLS (self-signed) + API key
client = umadb.Client(
    url="https://example.com:50051",
    ca_path="server.pem",
    api_key="umadb:example-api-key-4f7c2b1d9e5f4a038c1a",
)

# With TLS (self-signed) + API key + batch size hint
client = umadb.Client(
    url="https://example.com:50051",
    ca_path="server.pem",
    api_key="umadb:example-api-key-4f7c2b1d9e5f4a038c1a",
    batch_size=1000,
)
```
## Appending Events

The `Client.append()` method writes new events to an UmaDB server.

```python
def append(
    events: list[Event],
    condition: AppendCondition | None = None,
    tracking_info: TrackingInfo | None = None,
) -> int:
    ...
```

The `Client.append()` method can be used to append new [`Event`](#event) instances to UmaDB atomically, with an optional append
condition, and optional tracking information. Events are written in order.

Conditional appends with event UUIDs are idempotent. The server does not enforce uniqueness of events IDs.

### Parameters

| Name            | Type                              | Description                                                                        |
|-----------------|-----------------------------------|------------------------------------------------------------------------------------|
| `events`        | `list[`[`Event`](#event)`]`       | The list of events to append. Each includes an event type, tags, and data payload. |
| `condition`     | [`AppendCondition`](#append-condition)`\|None` | Optional append condition to ensure no conflicting writes occur.                   |
| `tracking_info` | [`TrackingInfo`](#tracking-info)`\|None`    | Optional tracking information – for event-processing components only.              |

### Return Value

Returns the sequence number (`int`) of the last successfully appended event from this operation. This
value can be used to wait for downstream event-processing components in a CQRS system to become up-to-date.

### Example

```python
import uuid
import umadb

client = umadb.Client("http://localhost:50051")

# Produce a new event with a UUID (for idempotent retries) and metadata
new_event = umadb.Event(
    event_type="example",
    tags=["tag1", "tag2"],
    data=b"Hello, world!",
    uuid=uuid.uuid4(),
    metadata={
        "source": "example",
        "correlation_id": str(uuid.uuid4()),
    },
)

# Define a consistency boundary (same query you use while reading)
consistency_boundary = umadb.Query(
    items=[
        umadb.QueryItem(
            types=["example"],
            tags=["tag1", "tag2"],
        )
    ]
)

# Define an append condition, fails if events
# match after last known position
append_condition = umadb.AppendCondition(
    fail_if_events_match=consistency_boundary,
    after=client.head(),
)

# Append new events with append condition
position1 = client.append(
    events=[new_event],
    condition=append_condition,
)
print("Appended at:", position1)


# Idempotent operation: retry with same event UUID
# and same append condition, returns same commit
# position without recording any new events.
position1_retry = client.append(
    events=[new_event],
    condition=append_condition,
)
assert position1 == position1_retry
print("Idempotent retry position:", position1_retry)

# Conflicting events raise an integrity error
try:
    client.append(
        [
            umadb.Event(
                event_type="example",
                tags=["tag1", "tag2"],
                data=b"Hello, world!",
                uuid=uuid.uuid4(),  # <-- different event ID
                metadata={},
            )
        ],
        condition=append_condition,
    )
except umadb.IntegrityError as e:
    print("Conflicting event was rejected:", e)
```

## Reading Events

The `Client.read()` method returns recorded events from an UmaDB server.

```python
def read(
    query: Query | None = None,
    start: int | None = None,
    backwards: bool = False,
    limit: int | None = None,
) -> ReadResponse:
    ...
```
The `Client.read()` method can be used both for constructing decision models in a domain layer, and for projecting events into
materialized views in CQRS. An optional [`Query`](#query) can be provided to select by tags and types.


### Parameters

| Name        | Type                     | Description                                                                                                                                                 |
|-------------|--------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `query`     | [`Query`](#query)`\|None` | Optional structured query to filter events (by tags, event types, etc).                                                                                     |
| `start`     | `int\|None`              | Read events *from* this sequence number. Only events with positions greater than or equal will be returned (or less than or equal if `backwards` is `True`. |
| `backwards` | `bool`                   | If `True` events will be read backwards, either from the given position or from the last recorded event.                                                    |
| `limit`     | `int\|None`              | Optional cap on the number of events to retrieve.                                                                                                           |


### Return Value

Returns an iterable "read response" from which [`SequencedEvent`](#sequenced-event) instances can be obtained.  The "last known" sequence number can be obtained from the `head()` method on the response object.

if `limit` was a `int`, the value returned by the response's `head()` method will be the sequence position
of the last event received from the server.

Otherwise, the value returned by the response's `head()` method will be the position of the last recorded
event in the database when the reader transaction started.


### Example

```python
import umadb

client = umadb.Client("http://localhost:50051")

# Select by type(s) and tag(s)
query = umadb.Query(
    items=[
        umadb.QueryItem(
            types=["example"],
            tags=["tag1", "tag2"],
        )
    ]
)

for item in client.read(query):
    print(f"Read sequenced event: {item.position}: {item.event}")

last_known = resp.head()
print("Last known position:", last_known)
```

## Subscribing

The `Client.subscribe()` method returns recorded events from an UmaDB server, and delivers new events as they arrive.

```python
def subscribe(
    query: Query | None = None,
    after: int | None = None,
) -> Subscription:
    ...
```
The `Client.subscription()` method can be used for projecting events into
materialized views in CQRS. An optional [`Query`](#query) can be provided to select by tags and types.

### Parameters

| Name        | Type                     | Description                                                                                              |
|-------------|--------------------------|----------------------------------------------------------------------------------------------------------|
| `query`     | [`Query`](#query)`\|None` | Optional structured query to filter events (by tags, event types, etc).                                  |
| `after`     | `int\|None`              | Receive events *after* this sequence number. Only events with greater positions will be received.        |

### Return Value

Returns an iterable "subscription" instance from which [`SequencedEvent`](#sequenced-event) instances can be obtained.

### Example

```python
import umadb

client = umadb.Client("http://localhost:50051")

# Filter by type(s) and tag(s)
query = umadb.Query(
    items=[
        umadb.QueryItem(
            types=["example"],
            tags=["tag1", "tag2"],
        )
    ]
)

# Subscribe to sequenced events
for item in client.subscribe(query):
    print("Received:", item.position, item.event)
    # Break infinite loop...
    break
```

## Getting Head Position

The `Client.head()` method returns the position of the last event recorded in an UmaDB server.

```python
def head(self) -> int | None: ...
```

The `Client.head()` method can be used for counting the number of recorded events in the database, or for determining the position
of the last recorded event when subscribing only to new events.

### Return Value

Returns the position (`u64`) of the last recorded event in the event store, or `None` if no events have been recorded yet.


## Getting Tracking Info

The `Client.get_tracking_info()` method returns the position after which to subscribe to
events in an upstream sequence.

```python
def get_tracking_info(self, source: str) -> int | None: ...
```

The `Client.get_tracking_info()` method can be used when starting or resuming an
event-processing component. The event-processing component will start or resume processing
upstream events after this position. The positions of processed events can be recorded
when [appending new events](#appending-events) generated by processing those upstream events.

### Parameters

| Name        | Type  | Description             |
|-------------|-------|-------------------------|
| `source`    | `str` | Upstream sequence name. |

Returns the last recorded upstream position (`int`), or `None` if the sequence name is not found.


## Checking Health

The `Client.check_health()` method performs a unary health check against the server using the standard gRPC Health Checking protocol.

```python
def check_health(self, service: str = "") -> ServingStatus: ...
```

The `Client.check_health()` method queries the health status of the server or a specific service.

### Parameters

| Name      | Type  | Description                                                                                                                                           |
|-----------|-------|-------------------------------------------------------------------------------------------------------------------------------------------------------|
| `service` | `str` | Optional service name to check (default `""`). Use an empty string for overall server health, or a fully-qualified gRPC service name (e.g. `"umadb.v1.DCB"`). |

### Return Value

Returns the current [`ServingStatus`](#serving-status) of the server or service.

### Example

```python
import umadb

client = umadb.Client("http://localhost:50051")

# Check overall server health
status = client.check_health()
assert status == umadb.ServingStatus.SERVING
print("Overall server health:", status)

# Check health of a specific service
dcb_status = client.check_health("umadb.v1.DCB")
print("DCB service health:", dcb_status)
```


## Watching Health

The `Client.watch_health()` method opens a server-streaming health watch for the given service name.

```python
def watch_health(self, service: str = "") -> HealthWatch: ...
```

The `Client.watch_health()` method opens a stream of health status updates for the server or a specific service.
The server immediately sends the current serving status and then pushes updates whenever the status changes.
The returned [`HealthWatch`](#health-watch) iterator yields status updates until cancelled or the stream ends.

### Parameters

| Name      | Type  | Description                                                                                                                                           |
|-----------|-------|-------------------------------------------------------------------------------------------------------------------------------------------------------|
| `service` | `str` | Optional service name to watch (default `""`). Use an empty string for overall server health, or a fully-qualified gRPC service name (e.g. `"umadb.v1.DCB"`). |

### Return Value

Returns a [`HealthWatch`](#health-watch) iterator over [`ServingStatus`](#serving-status) values.

### Example

```python
import umadb

client = umadb.Client("http://localhost:50051")

# Watch overall server health updates
try:
    watch = client.watch_health()
    for status in watch:
        if status == umadb.ServingStatus.SERVING:
            print("Server is ready to handle requests")
        elif status == umadb.ServingStatus.NOT_SERVING:
            print("Server is shutting down")
    else:
        print("Server shutdown gracefully")
except umadb.TransportError:
    print("Lost connection to the server abruptly!")
```

## Event

An `Event` represents a single event either to be appended or already stored in the event log.

| Field        | Type             | Description                                                                  |
|--------------|------------------|------------------------------------------------------------------------------|
| `event_type` | `str`            | The event's logical type (e.g. `"UserRegistered"`).                          |
| `tags`       | `list[str]`      | Tags assigned to the event (used for filtering and indexing).                |
| `data`       | `bytes`          | Binary payload associated with the event.                                    |
| `uuid`       | `UUID\|None`     | Unique event ID.                                                             |
| `metadata`   | `dict[str, str]` | Key-value metadata attached to the event (e.g. provenance, correlation IDs). |

Idempotent support for append operations is activated by setting `uuid` on appended events.

The `metadata` field allows storing arbitrary string key-value pairs alongside events. This is useful for
storing provenance information, correlation IDs, causation IDs, or other contextual data that should be
preserved with the event. Metadata is stored with the event and returned unchanged when the event is read.
Each metadata key and value may be up to 65535 bytes long; appending an event with a longer key or value
fails with a validation error. Appending an event with duplicate metadata keys also fails with a validation error.

Include in:
* [Append requests](#appending-events) when writing new events to the store.

Included in:
* [`SequencedEvent`](#sequenced-event) objects when the server responds to read requests.

Matched by:
* [`QueryItem`](#query-item) during [`read()`](#reading-events) and [`append()`](#appending-events) operations.


## Append Condition

An `AppendCondition` causes an append request to fail if events match its [`Query`](#query), optionally after
a sequence number.

| Field                  | Type                  | Description                   |
|------------------------|-----------------------|-------------------------------|
| `fail_if_events_match` | [`Query`](#query)     | Query for conflicting events. |
| `after`                | `int\|None`           | Sequence number.              |

Include in:
* [Append requests](#appending-events) to define optimistic concurrent control.

To implement a consistency boundary, command handlers can use the same [`Query`](#query) used when
[reading events](#reading-events) as the value of `fail_if_events_match`, and the "head" sequence
number received from the read response as the value of `after`.


## Tracking Info

A `TrackingInfo` instance indicates the source and position of an upstream event.

| Field      | Type  | Description               |
|------------|-------|---------------------------|
| `source`   | `str` | Upstream sequence name.   |
| `position` | `int` | Upstream sequence number. |

Include in:
* [Append requests](#appending-events) when recording the results of processing an upstream event.

Returned by:
* [`SequencedEvent`](#sequenced-event) when reading events from the store.


To implement exactly-once semantics in event-processing components, pull events from an upstream
source after the [last recorded position](#getting-tracking-info), then record the upstream positions
of upstream events along with [new state](#appending-events) that results from processing those events.
By processing event sequentially in this way, each event will be processed at least once. And by
recording tracking information along with new state, the new state will be recorded at most once.
The combination of "at least once" processing and "at most once" recording gives "exactly once"
semantics from the point of view of consumers of the recorded state.


## Query

A `Query` defines criteria for selecting events in the event store.

| Field   | Type                            | Description                                |
|---------|---------------------------------|--------------------------------------------|
| `items` | `list[`[`QueryItem`](#query-item)`]` | A list of selection criteria (logical OR). |

An [`Event`](#event) is selected if any [`QueryItem`](#query-item) matches or the `items` field is empty.

Include in:
* [Read requests](#reading-events) to select events returned by the server.
* An [`AppendCondition`](#append-condition) to select conflicting events.


## Query Item

A `QueryItem` defines a criterion for matching events.

| Field   | Type        | Description                       |
|---------|-------------|-----------------------------------|
| `types` | `list[str]` | List of event types (logical OR). |
| `tags`  | `list[str]` | List of tags (logical AND).       |

A `QueryItem` will match an [`Event`](#event) if:
* one of its `types` matches the [`Event.event_type`](#event) or its `types` field is empty; AND
* all of its `tags` match one of the [`Event.tags`](#event) or its `tags` field is empty.


## Sequenced Event

A `SequencedEvent` represents a recorded [`Event`](#event) along with its assigned sequence number.

| Field           | Type                                   | Description           |
|-----------------|----------------------------------------|-----------------------|
| `position`      | `int`                                  | The sequence number.  |
| `event`         | [`Event`](#event)                      | The recorded event.   |
| `tracking_info` | [`TrackingInfo\|None`](#tracking-info) | Tracking information. |

The `tracking_info` field presents tracking information given when calling [`append()`](#appending-events).

Included in:
* [Read responses](#reading-events) when the server responds to read requests.


## Serving Status

The `ServingStatus` enum represents the health status of the server or a service returned by [`check_health()`](#checking-health) and [`watch_health()`](#watching-health).

| Name              | Description                                                                            |
|-------------------|----------------------------------------------------------------------------------------|
| `UNKNOWN`         | The serving status is unknown.                                                         |
| `SERVING`         | The server is ready to handle requests.                                                |
| `NOT_SERVING`     | The server is not ready to handle requests.                                            |
| `SERVICE_UNKNOWN` | The requested service is not known, used by [`watch_health()`](#watching-health) only. |


## Health Watch

A `HealthWatch` iterator provides a stream of [`ServingStatus`](#serving-status) updates.

| Method     | Description                                                                                                        |
|------------|--------------------------------------------------------------------------------------------------------------------|
| `__iter__` | Returns the iterator itself.                                                                                       |
| `__next__` | Returns the next [`ServingStatus`](#serving-status) update, or raises `StopIteration` when the stream ends.         |
| `cancel()` | Explicitly cancels this individual health watch stream. Iterating after cancellation raises `CancelledByUserError`. |


## Error Handling

The Python client raises Python exceptions on error:

- Integrity/condition failure: `IntegrityError`
- Transport/connection errors: `TransportError`
- Authentication failures: `AuthenticationError`
- Cancellation: `CancelledByUserError`
- Invalid argument errors: `ValueError`
- Other internal errors: `RuntimeError` or `OSError`

Your application should catch these as appropriate.

## Complete Example

This example demonstrates reading and appending events.
The append condition enables concurrency control.
The event's UUID is used to support idempotency.

```python
import uuid
import umadb

# Connect to the gRPC server
client = umadb.Client(url="http://localhost:50051")

# Define a consistency boundary
consistency_boundary = umadb.Query(
    items=[
        umadb.QueryItem(
            types=["example"],
            tags=["tag1", "tag2"],
        )
    ]
)

# Read events for a decision model
read_response = client.read(query=consistency_boundary)
for result in read_response:
    print(f"Got event at position {result.position}: {result.event}")

# Remember the "last known" position for the read
last_known = read_response.head()
print("Last known position is:", last_known)

# Create an event with a UUID and metadata
event = umadb.Event(
    event_type="example",
    tags=["tag1", "tag2"],
    data=b"Hello, world!",
    uuid=uuid.uuid4(),
    metadata={
        "source": "example",
        "correlation_id": str(uuid.uuid4()),
    },
)

# Append event within the consistency boundary
condition = umadb.AppendCondition(
    fail_if_events_match=consistency_boundary,
    after=last_known,
)
commit_position1 = client.append([event], condition=condition)
print("Appended event at position:", commit_position1)

# Append conflicting event — expect an error
try:
    conflicting_event = umadb.Event(
        event_type="example",
        tags=["tag1", "tag2"],
        data=b"Hello, world!",
        uuid=uuid.uuid4(),  # different UUID
        metadata={},
    )
    client.append([conflicting_event], condition=condition)
except umadb.IntegrityError as e:
    print("Conflicting event was rejected:", e)

# Idempotent retry — same event ID and condition
print("Retrying to append event at position:", last_known)
commit_position2 = client.append([event], condition=condition)
assert commit_position1 == commit_position2
print("Append returned same commit position:", commit_position2)
```

## Example with Tracking

This example demonstrates recording events generated by
processing events from an upstream source. Tracking information
is atomically recorded along with the generated events.
Trying to record again with the same tracking information
causes an error. The tracking information is returned with
sequenced events, which supports replication of the
tracking information to another instance of the database.

```python
import uuid
import umadb

# Connect to the server
client = umadb.Client(url="http://localhost:50051")

# Get last processed upstream event position
last_processed_position = client.get_tracking_info("upstream")

# Pull next unprocessed upstream event...
next_upstream_position = 1 + (last_processed_position or 0)

# Construct tracking information from next unprocessed event
tracking_info = umadb.TrackingInfo(
    source="upstream",
    position=next_upstream_position,
 )

# Define a consistency boundary
consistency_boundary = umadb.Query(
    items=[
        umadb.QueryItem(
            types=["example"],
            tags=["tag1", "tag2"],
        )
    ]
)

# Read events for a decision model
read_response = client.read(query=consistency_boundary)
for result in read_response:
    print(f"Got event at position {result.position}: {result.event}")

# Remember the "last known" position for the read
last_known = read_response.head()
print("Last known position is:", last_known)

# Create an event with a UUID to enable idempotent append and metadata
event = umadb.Event(
    event_type="example",
    tags=["tag1", "tag2"],
    data=b"Hello, world!",
    uuid=uuid.uuid4(),
    metadata={
        "source": "tracking_example",
        "correlation_id": str(uuid.uuid4()),
    },
)

# Append event within a consistency boundary
append_condition = umadb.AppendCondition(
    fail_if_events_match=consistency_boundary,
    after=last_known,
)

commit_position1 = client.append(
    [event],
    condition=append_condition,
    tracking_info=tracking_info,
)
print("Appended event at position:", commit_position1)

# Idempotent retry — same event ID and condition
print("Retrying to append event at position:", last_known)
commit_position2 = client.append(
    events=[event],
    condition=append_condition,
    tracking_info=tracking_info,
)
assert commit_position1 == commit_position2
print("Append returned same commit position:", commit_position2)

# Check tracking information
assert tracking_info.position == client.get_tracking_info("upstream")

# Unconditional append with conflicting tracking information — expect an error
try:
    conflicting_event = umadb.Event(
        event_type="example",
        tags=["tag1", "tag2"],
        data=b"Hello, world!",
        uuid=uuid4(),  # different UUID
        metadata={},
    )
    client.append(
        events=[conflicting_event],
        condition=None,
        tracking_info=tracking_info,
    )
except umadb.IntegrityError as e:
    print("Conflicting event was rejected:", e)
    
# Show sequenced event has the given tracking information
for sequenced in client.read(start=commit_position1):
    assert sequenced.tracking_info == tracking_info 
```

## Example with Health Checking

This example demonstrates checking the health of an UmaDB server and streaming health status updates.

```python
import umadb

# Connect to the server
client = umadb.Client("http://localhost:50051")

# Check overall server health
try:
    status = client.check_health()
    print("Overall server health:", status)
    if status == umadb.ServingStatus.SERVING:
        print("Server is ready to accept requests")
except umadb.TransportError as e:
    print("Failed to reach server:", e)

# Check health of a specific service
dcb_status = client.check_health("umadb.v1.DCB")
print("DCB service health:", dcb_status)

# Stream health updates using watch_health()
watch = client.watch_health()
for status in watch:
    print("Health update received:", status)
    # Cancel the watch stream after inspecting initial status
    watch.cancel()
    break
```

## Notes

- Python client is synchronous and blocking; if you need async integration, run client calls in a thread pool or use an async worker that offloads to threads.
- Event data is binary (`bytes`). Use a consistent serialization (e.g., JSON serialized to UTF-8 bytes, protobuf, msgpack) for your domain.
- API keys must match the server configuration.
- For TLS with self-signed certs, pass `ca_path` with your root/CA certificate.


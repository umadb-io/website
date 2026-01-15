---
head:
  - - meta
    - name: description
      content: How to use UmaDB with Python
  - - meta
    - name: keywords
      content: UmaDB, client, Python
---
# Python Client

The Python package [`umadb`](https://pypi.org/project/umadb/) is available on PyPI and provides a synchronous
client for reading and appending events to UmaDB over its [gRPC API](./grpc-api) using [Rust-powered bindings](./rust-client) via
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

Use the `Client` class as the main entry point.

```python
Client(
    url: str,
    ca_path: str | None = None,
    api_key: str | None = None,
    batch_size: int | None = None,
)
```

A `url` argument is required. If the argument starts with `https` or `grpcs`, a secure TLS channel is created; otherwise an insecure channel is used.

### Optional Configuration

* `ca_path`: Path to a PEM-encoded root/CA certificate for TLS connections (useful for self-signed servers).

* `api_key`: API key string used for authenticating with the server.

* `batch_size`: Hint for how many events to buffer per batch when reading. The server may cap this; a sensible default is used if unset.

### Examples

```python
from umadb import Client

# Insecure (no TLS)
client = Client("http://localhost:50051")

# Secure with TLS (system CAs)
client = Client("https://example.com:50051")

# Secure with TLS using self-signed CA
client = Client(
    url="https://localhost:50051",
    ca_path="server.pem",
)

# TLS + API key
client = Client(
    url="https://example.com:50051",
    ca_path="server.pem",
    api_key="umadb:example-api-key-4f7c2b1d9e5f4a038c1a",
)

# TLS + API key + batch size hint
client = Client(
    url="https://example.com:50051",
    ca_path="server.pem",
    api_key="umadb:example-api-key-4f7c2b1d9e5f4a038c1a",
    batch_size=1000,
)
```

## Reading Events

Use `read()` to retrieve events. It can be used for decision models and for building projections (CQRS). When `subscribe=True`, the server keeps the stream open to deliver future events.

```python
read(
    query: Query | None = None,
    start: int | None = None,
    backwards: bool = False,
    limit: int | None = None,
    subscribe: bool = False,
) -> ReadResponse
```

- `query`: Optional structured filter (types/tags). See Query below.

- `start`: Read from this sequence number (inclusive). When `backwards=True`, reads backwards from `start` (or the log tail if `start` is `None`).

- `backwards`: Read direction flag.

- `limit`: Optional maximum number of events to read.

- `subscribe`: If `True`, the stream remains open for new events.

The returned `ReadResponse` is iterable and yields `SequencedEvent` instances; it also exposes `head()` to retrieve the most relevant last-known sequence number for the stream.

### Example

```python
from umadb import Client, Query, QueryItem

client = Client("http://localhost:50051")

# Filter by type(s) and tag(s)
q = Query(items=[QueryItem(types=["example"], tags=["tag1", "tag2"])])

resp = client.read(query=q, start=None, backwards=False, limit=None, subscribe=False)
for item in resp:
    print(f"Got event at position {item.position}: {item.event}")

last_known = resp.head()
print("Last known position:", last_known)

# Subscribe to new events
subscription = client.read(subscribe=True)
for se in subscription:
    print("New event:", se.position, se.event)
    # Break for demo purposes
    break
```

## Appending Events

Use `append()` to write new events atomically with optional optimistic concurrency control. Events are written
in order. Conditional appends with event UUIDs are idempotent. The server does not enforce uniqueness of event IDs.

```python
append(
    events: list[Event],
    condition: AppendCondition | None = None,
    tracking: Tracking | None = None,
) -> int  # returns last appended position
```

- `events`: List of `Event` objects to append.
- `condition`: Optional `AppendCondition` (e.g., guard against conflicting writes).
- `tracking`: Optional `Tracking` (source and position of upstream event, for event-processing components only).

### Example

```python
from umadb import Client, Event, Query, QueryItem, AppendCondition, IntegrityError
import uuid

client = Client("http://localhost:50051")

# Define a consistency boundary (same query you use while reading)
cb = Query(items=[QueryItem(types=["example"], tags=["tag1", "tag2"])])

# Read to build decision model
read_resp = client.read(query=cb)
for r in read_resp:
    print(f"Existing event at {r.position}: {r.event}")

last_known = read_resp.head()
print("Last known position:", last_known)

# Produce a new event with a UUID (for idempotent retries)
ev = Event(
    event_type="example",
    tags=["tag1", "tag2"],
    data=b"Hello, world!",
    uuid=str(uuid.uuid4()),
)

# Append with an optimistic condition: fail if conflicting events exist after last_known
cond = AppendCondition(fail_if_events_match=cb, after=last_known)
position1 = client.append([ev], condition=cond)
print("Appended at:", position1)

# Conflicting append should raise an error (e.g. IntegrityError)
try:
    client.append([Event(event_type="example", tags=["tag1", "tag2"], data=b"Hello, world!", uuid=str(uuid.uuid4()))], condition=cond)
except IntegrityError as e:
    print("Conflicting event was rejected:", e)

# Idempotent retry with same event UUID and condition should return same commit position
position2 = client.append([ev], condition=cond)
assert position1 == position2
print("Idempotent retry returned position:", position2)
```

## Data Structures

### Query

A `Query` defines criteria for selecting events in the event store.

- `items: list[QueryItem]` — A list of selection criteria (logical OR). If empty, all events match.

Use in:
- Read requests to select returned events.
- `AppendCondition` to define conflicts.

### QueryItem

A `QueryItem` defines one criterion:

- `types: list[str] | None` — Event types (logical OR). If empty/None, any type matches.
- `tags: list[str] | None` — Required tags (logical AND). If empty/None, any tags match.

A `QueryItem` matches an `Event` if one of its `types` equals `Event.event_type` (or `types` is empty) AND all of its `tags` are present in `Event.tags` (or `tags` is empty).

### Event

Represents a single event to append or already stored in the log.

- `event_type: str` — Logical type (e.g., `"UserRegistered"`).
- `tags: list[str]` — Tags for filtering and indexing.
- `data: bytes` — Binary payload.
- `uuid: str | None` — Unique event ID enabling idempotent append retries.

Included in:
- Append requests when writing new events.
- `SequencedEvent.event` when reading.

### SequencedEvent

Represents a recorded `Event` with its sequence number.

- `position: int` — Sequence number.
- `event: Event` — The recorded event.

Returned from:
- Read responses.

### AppendCondition

Causes an append to fail if events matching `fail_if_events_match` exist, optionally only for events after a given position.

- `fail_if_events_match: Query` — Query for conflicting events.
- `after: int | None` — Sequence number boundary.

Use in:
- Append requests to implement optimistic concurrency control across a consistency boundary.

### Tracking

Details the position of an upstream event that has been processed.

- `source: str` — Upstream source or context name.
- `position: int` — Upstream event sequence number.

Use in:
- Append requests to implement exactly-once event processing.


## Error Handling

The Python client raises Python exceptions on error:

- Integrity/condition failure: `IntegrityError`
- Transport/connection errors: `TransportError`
- Authentication failures: `AuthenticationError`
- Other internal errors: `RuntimeError` or `OSError`

Your application should catch these as appropriate.

## Complete Example

```python
from umadb import Client, Event, Query, QueryItem, AppendCondition, IntegrityError
import uuid

# Connect to the gRPC server (TLS + API key)
client = Client(
    url="http://localhost:50051",
)

# Define a consistency boundary
cb = Query(items=[QueryItem(types=["example"], tags=["tag1", "tag2"])])

# Read events for a decision model
read_response = client.read(query=cb)
for result in read_response:
    print(f"Got event at position {result.position}: {result.event}")

# Remember the last-known position
last_known_position = read_response.head()
print("Last known position is:", last_known_position)

# Create an event with a UUID to enable idempotent append
event = Event(
    event_type="example",
    tags=["tag1", "tag2"],
    data=b"Hello, world!",
    uuid=str(uuid.uuid4()),
)

# Append event within the consistency boundary
condition = AppendCondition(fail_if_events_match=cb, after=last_known_position)
commit_position1 = client.append([event], condition=condition)
print("Appended event at position:", commit_position1)

# Append conflicting event — expect an error
try:
    conflicting_event = Event(
        event_type="example",
        tags=["tag1", "tag2"],
        data=b"Hello, world!",
        uuid=str(uuid.uuid4()),  # different UUID
    )
    client.append([conflicting_event], condition=condition)
except IntegrityError as e:
    print("Conflicting event was rejected:", e)

# Idempotent retry — same event ID and condition
print("Retrying to append event at position:", last_known_position)
commit_position2 = client.append([event], condition=condition)
assert commit_position1 == commit_position2
print("Append returned same commit position:", commit_position2)

# Subscribe to all events for a projection
subscription = client.read(subscribe=True)
for ev in subscription:
    print(f"Processing event at {ev.position}: {ev.event}")
    if ev.position == commit_position2:
        print("Projection has processed new event!")
        break
```

## Example with Tracking

```python
from umadb import Client, Event, Query, QueryItem, AppendCondition, Tracking, IntegrityError
import uuid

# Connect to the gRPC server (TLS + API key)
client = Client(
    url="http://localhost:50051",
)

# Get last processed upstream event position
last_processed_position = client.tracking("upstream")

# Pull next unprocessed upstream event...
next_upstream_event_position = 1 + (last_processed_position or 0)

# Construct tracking information from next unprocessed event
tracking = Tracking("upstream", next_upstream_event_position)

# Define a consistency boundary
cb = Query(items=[QueryItem(types=["example"], tags=["tag1", "tag2"])])

# Read events for a decision model
read_response = client.read(query=cb)
for result in read_response:
    print(f"Got event at position {result.position}: {result.event}")

# Remember the last-known position
last_known_position = read_response.head()
print("Last known position is:", last_known_position)

# Create an event with a UUID to enable idempotent append
event = Event(
    event_type="example",
    tags=["tag1", "tag2"],
    data=b"Hello, world!",
    uuid=str(uuid.uuid4()),
)

# Append event within the consistency boundary
condition = AppendCondition(fail_if_events_match=cb, after=last_known_position)
commit_position1 = client.append([event], condition=condition, tracking=tracking)
print("Appended event at position:", commit_position1)

# Idempotent retry — same event ID and condition and tracking information
print("Retrying to append event at position:", last_known_position)
commit_position2 = client.append([event], condition=condition, tracking=tracking)
assert commit_position1 == commit_position2
print("Append returned same commit position:", commit_position2)

# Check tracking information
assert tracking.position == client.tracking("upstream")

# Unconditional append with conflicting tracking information — expect an error
try:
    conflicting_event = Event(
        event_type="example",
        tags=["tag1", "tag2"],
        data=b"Hello, world!",
        uuid=str(uuid.uuid4()),  # different UUID
    )
    client.append([conflicting_event], condition=None, tracking=tracking)
except IntegrityError as e:
    print("Conflicting event was rejected:", e)
```

## Notes

- Python client is synchronous and blocking; if you need async integration, run client calls in a thread pool or use an async worker that offloads to threads.
- Event data is binary (`bytes`). Use a consistent serialization (e.g., JSON serialized to UTF-8 bytes, protobuf, msgpack) for your domain.
- API keys must match the server configuration.
- For TLS with self-signed certs, pass `ca_path` with your root/CA certificate.

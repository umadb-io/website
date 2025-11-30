
![UmaDB logo](/images/UmaDB-logo.png)


# What is UmaDB?

UmaDB is a specialist open-source event store built for Dynamic Consistency Boundaries.

UmaDB supports event-driven architectures where consistency rules can adapt dynamically to
business needs, rather than being hardwired into the database.

UmaDB directly implements the [independent specification](https://dcb.events/specification/) for
Dynamic Consistency Boundaries created by Bastian Waidelich, Sara Pellegrini,
and Paul Grimshaw.

UmaDB stores events in an append-only sequence, indexed by monotonically increasing gapless positions,
and can be tagged for fast, precise filtering.

UmaDB offers:

* **High-performance concurrency** with non-blocking reads and writes
* **Optimistic concurrency control** to prevent simultaneous write conflicts
* **Dynamic business-rule enforcement** via query-driven append conditions
* **Real-time subscriptions** with seamless catch-up and continuous delivery
* **OSI-approved permissive open-source licenses** (MIT and Apache License 2.0)

UmaDB makes new events fully durable before acknowledgements are returned to clients.

## Quick Start

Run Docker image (publish port 50051).

```
docker run --publish 50051:50051 umadb/umadb:latest
```

Install Python client (in a virtual environment).

```
pip install umadb
```

Read and write events (using the Python client).

```python
from umadb import Client, Event

# Connect to UmaDB server
client = Client("http://localhost:50051")

# Create and append events
event = Event(
    event_type="UserCreated",
    data=b"user data",
    tags=["user", "creation"],
)
position = client.append([event])
print(f"Event appended at position: {position}")

# Read events
events = client.read()
for seq_event in events:
    print(f"Position {seq_event.position}: {seq_event.event.event_type}")

```


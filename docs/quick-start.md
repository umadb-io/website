---
head:
  - - meta
    - name: description
      content: How to get started with UmaDB
  - - meta
    - name: keywords
      content: UmaDB, quick start, Python, PHP, Rust, Java, Docker
---
# Quick Start

## Docker

Run Docker image (publish port 50051).

```
docker run --publish 50051:50051 umadb/umadb:latest
```

## Python

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


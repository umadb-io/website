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

The [official Python client](https://pypi.org/project/umadb/) for UmaDB is available on PyPI. It uses the [Rust client](./rust-client) via [PyO3](https://pyo3.rs/), and is super fast.

It is adapted into the Python [eventsourcing](https://eventsourcing.readthedocs.io/en/stable/topics/dcb.html)
library via the [eventsourcing-umadb](https://pypi.org/project/eventsourcing-umadb/) package.

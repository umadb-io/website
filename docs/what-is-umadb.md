---
head:
  - - meta
    - name: description
      content: High-performance open-source event store for Dynamic Consistency Boundaries
  - - meta
    - name: keywords
      content: UmaDB, event store, DCB, append-only, real-time, event sourcing, event-driven, database
---

![UmaDB logo](/images/UmaDB-brand-figure-torso-and-lettering.png)


# Introduction

## What is UmaDB?

UmaDB is a specialist open-source event store built for Dynamic Consistency Boundaries.

UmaDB supports event sourcing and event-driven architectures where consistency rules can adapt dynamically to
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

## Getting Started

Get started with UmaDB by [installing](./install) and [running](./cli) the `umadb` binary,
or use the [Docker image](./docker).

Then try out the [Python](./python-client), [PHP](./php-client), or [Rust](./rust-client) client examples.


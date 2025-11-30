# Key Features

## Dynamic Consistency Boundaries

UmaDB is designed to be directly consistent with the [specification for DCB](https://dcb.events/specification/).

The API is simple and intuitive, and has been tested and approved by the DCB team.

UmaDB has one method for reading events, and one method for writing events.

UmaDB lets you define exactly when an event can be appended, creating a flexible consistency boundary. You can:

* **Enforce business rules** by ensuring new events are appended only if certain events do not already exist
* **Prevent concurrency conflicts** by ensuring no new events have been added since a known point

These controls can be combined to implement patterns like uniqueness constraints, idempotency, or coordinating
multi-step processes **without relying on fixed aggregate boundaries**.

## Multi-Version Concurrency Control

UmaDB uses **MVCC** to enable high-concurrency reads and writes without blocking. Each transaction sees a
consistent snapshot of the database. UmaDB reclaims space efficiently from unreachable older versions.

* Readers see a **consistent snapshot** and never block writers or other readers.
* The writer uses **copy-on-write**, creating new versions of database pages.
* New versions are **published atomically** after being made **fully durable**.
* Old database **pages are reused** only when no active readers can reference them.

This design combines non-blocking concurrency, atomic commits, crash safety, and efficient space management,
making UmaDB fast, safe, and consistent under load.

## Append Request Batching

Concurrent append requests are automatically grouped and processed together:

* Requests are queued and collected into batches.
* Each request in the batch is processed individually, maintaining per-request **atomicity** and **isolation**.
* Individual responses are returned once the entire batch is successfully committed.

This approach **significantly improves throughput under concurrent load** by amortizing disk I/O
across concurrent requests, while ensuring **atomic per-request semantics** and **crash safety**.

## Reading and Subscribing

UmaDB supports both normal reads and streaming subscriptions with "catch-up and continue" semantics:

* Normal reads deliver existing events and terminate
* Subscription reads deliver existing events, then block waiting for new events
* Read responses are streamed in batches, with each batch using a new reader to avoid long-held TSNs
* Server shutdown signals gracefully terminate all active subscriptions


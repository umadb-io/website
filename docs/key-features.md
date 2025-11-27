# Key Features

## Dynamic Consistency Boundaries

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

## Simple Compliant DCB API

UmaDB has one method for reading events, and one method for writing events.

The `read()` and `append()` methods are fully documented and easy to use.

They are designed and implemented to comply with the original, well-written, and thoughtful specification for DCB.

## Append Request Batching

Concurrent append requests are automatically grouped and processed as a nested transaction:

* Requests are queued and collected into batches.
* A dedicated writer thread processes batches of waiting requests.
* Each request in the batch is processed individually, maintaining per-request **atomicity** and **isolation**.
* Dirty pages are flushed to disk once all requests in the batch have been processed.
* A new header page is written and flushed after all dirty pages are persisted.
* Individual responses are returned once the entire batch is successfully committed.

This approach **significantly improves throughput under concurrent load** by amortizing disk I/O
across concurrent requests, while ensuring **atomic per-request semantics** and **crash safety**.

## Reading and Subscribing

UmaDB supports both normal reads and streaming subscriptions with "catch-up and continue" semantics:

* Normal reads deliver existing events and terminate
* Subscription reads deliver existing events, then block waiting for new events
* Read responses are streamed in batches, with each batch using a new reader to avoid long-held TSNs
* Server shutdown signals gracefully terminate all active subscriptions


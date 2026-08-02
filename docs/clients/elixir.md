---
head:
  - - meta
    - name: description
      content: How to use UmaDB with Elixir
  - - meta
    - name: keywords
      content: UmaDB, client, Elixir
---
# Elixir Client for UmaDB

The Hex package [`uma_db_client`](https://hex.pm/packages/uma_db_client) provides an Elixir client for
reading and appending events to UmaDB over its [gRPC API](../grpc-api.md). API documentation is published
on [HexDocs](https://hexdocs.pm/uma_db_client) and the source is on
[GitHub](https://github.com/evntd/uma_db_client).

It is a pure Elixir client built on [`grpc`](https://hex.pm/packages/grpc) and
[`protobuf`](https://hex.pm/packages/protobuf), speaking gRPC over HTTP/2. Unlike the
[Python client](./python), nothing is bundled — there is no Rust binary and no NIF to compile. The only
prerequisite is a reachable UmaDB server.

It requires Elixir `~> 1.18` and is tested against OTP 27.

## Installation

Add [`uma_db_client`](https://hex.pm/packages/uma_db_client) to your dependencies in `mix.exs`:

```elixir
def deps do
  [
    {:uma_db_client, "~> 0.6.14"}
  ]
end
```

Then fetch it:

```bash
mix deps.get
```

## Application Setup

The underlying gRPC client requires `GRPC.Client.Supervisor` to be running. Add it to your application's
supervision tree — `UmaDbClient.connect/2` raises without it.

```elixir
children = [
  {GRPC.Client.Supervisor, []}
]

Supervisor.start_link(children, strategy: :one_for_one, name: MyApp.Supervisor)
```

In scripts, tests, or `iex`, start it manually instead:

```elixir
{:ok, _pid} = DynamicSupervisor.start_link(strategy: :one_for_one, name: GRPC.Client.Supervisor)
```

There is no client process to start. A channel is a plain value that you pass to every call.

## Connecting to UmaDB

Use `UmaDbClient.connect/2` to open a gRPC channel to an UmaDB server.

```elixir
@spec connect(target :: String.t(), opts :: keyword()) ::
        {:ok, GRPC.Channel.t()} | {:error, term()}
```

### Parameters

| Name     | Type        | Description                                                                                                                                                          |
|----------|-------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `target` | `String.t()` | Required connection target. A bare `"host:port"` string, or a scheme-qualified target — `dns://`, `ipv4:`, `unix:` or `xds:///`. The default port is `50051`.        |
| `opts`   | `keyword()`  | Optional. Passed straight through to `GRPC.Stub.connect/2`. Commonly `:cred` for TLS; also `:interceptors`, `:codec`, `:compressor`, `:headers` and `:adapter`.      |

### Return Value

`{:ok, channel}` on success, otherwise `{:error, reason}`.

### Connection Examples

```elixir
# Without TLS (insecure connection)
{:ok, channel} = UmaDbClient.connect("localhost:50051")

# Explicit DNS target
{:ok, channel} = UmaDbClient.connect("dns:///example.com:50051")

# With TLS (self-signed or private CA)
cred = GRPC.Credential.new(ssl: [cacertfile: "/path/to/ca.pem"])
{:ok, channel} = UmaDbClient.connect("example.com:443", cred: cred)
```

The server certificate is verified against the given CA, but a verification failure surfaces from
`connect/2` as `{:error, :timeout}` rather than a TLS-specific error. If a TLS connection times out, check
that the `cacertfile` matches the CA that signed the server's certificate.

Close the channel when you are done:

```elixir
GRPC.Stub.disconnect(channel)
```

## Appending Events

`UmaDbClient.append/3` writes one or more events atomically. All events in a single call are committed
together.

```elixir
@spec append(channel :: GRPC.Channel.t(), events :: [UmaDb.V1.Event.t()], opts :: keyword()) ::
        {:ok, non_neg_integer()} | {:error, term()}
```

### Parameters

| Name             | Type                    | Description                                                                                            |
|------------------|-------------------------|--------------------------------------------------------------------------------------------------------|
| `channel`        | `GRPC.Channel.t()`      | Required channel returned by `connect/2`.                                                              |
| `events`         | `[UmaDb.V1.Event.t()]`  | Required list of events, built with `UmaDbClient.Builder.event/1`.                                     |
| `:condition`     | `UmaDb.V1.AppendCondition.t()` | Optional append condition for optimistic concurrency. See [Optimistic Concurrency](#optimistic-concurrency). |
| `:tracking_info` | `UmaDb.V1.TrackingInfo.t()`    | Optional tracking cursor to advance in the same transaction. See [Tracking Consumer Positions](#tracking-consumer-positions). |

### Return Value

`{:ok, position}`, where `position` is the log position after the append, otherwise `{:error, reason}`.

### Example

```elixir
alias UmaDbClient.Builder

event =
  Builder.event(
    type: "OrderPlaced",
    tags: ["order:1"],
    data: Jason.encode!(%{id: 1, total: 99})
  )

{:ok, position} = UmaDbClient.append(channel, [event])
```

Multiple events commit together:

```elixir
events = [
  Builder.event(type: "OrderPlaced", tags: ["order:1"], data: Jason.encode!(%{id: 1})),
  Builder.event(type: "PaymentReceived", tags: ["order:1"], data: Jason.encode!(%{amount: 99}))
]

{:ok, position} = UmaDbClient.append(channel, events)
```

### Event Metadata

Attach metadata as a map or a list of `{key, value}` string pairs. Each pair becomes an
`UmaDb.V1.MetadataEntry`.

```elixir
event =
  Builder.event(
    type: "OrderPlaced",
    tags: ["order:1"],
    data: Jason.encode!(%{id: 1}),
    metadata: %{"correlation_id" => "abc-123", "user" => "alice"}
  )
```

Metadata keys must be unique within an event — appending an event with duplicate keys fails with a
validation error.

## Reading Events

`UmaDbClient.read/2` returns a lazy `Enumerable` of `UmaDb.V1.SequencedEvent` structs. Events are fetched
from the server as you iterate.

```elixir
@spec read(channel :: GRPC.Channel.t(), opts :: keyword()) ::
        {:ok, Enumerable.t()} | {:error, term()}
```

### Parameters

| Name          | Type                 | Description                                                                       |
|---------------|----------------------|-------------------------------------------------------------------------------------|
| `channel`     | `GRPC.Channel.t()`   | Required channel returned by `connect/2`.                                          |
| `:query`      | `UmaDb.V1.Query.t()` | Optional filter by event type and/or tags. See [Query](#query).                    |
| `:start`      | `non_neg_integer()`  | Optional starting position, inclusive.                                             |
| `:backwards`  | `boolean()`          | Optional. When `true`, reads in reverse order from the head.                       |
| `:limit`      | `non_neg_integer()`  | Optional maximum number of events to return.                                       |
| `:batch_size` | `non_neg_integer()`  | Optional hint for how many events the server packs into each response batch.       |

### Return Value

`{:ok, stream}`, where `stream` yields `UmaDb.V1.SequencedEvent` structs, otherwise `{:error, reason}`.

### Example

```elixir
{:ok, stream} = UmaDbClient.read(channel)

Enum.each(stream, fn %UmaDb.V1.SequencedEvent{position: position, event: event} ->
  IO.puts("#{position}: #{event.event_type}")
end)
```

Filter with a query:

```elixir
query =
  Builder.query([
    Builder.query_item(["OrderPlaced", "OrderCancelled"], ["order:1"])
  ])

{:ok, stream} = UmaDbClient.read(channel, query: query)
events = Enum.to_list(stream)
```

Read backwards, or from a position onwards:

```elixir
# The 10 most recent events.
{:ok, stream} = UmaDbClient.read(channel, backwards: true, limit: 10)

# Everything from position 100 onward, in batches of 500.
{:ok, stream} = UmaDbClient.read(channel, start: 100, batch_size: 500)
```

::: warning The stream is single-use
The stream is backed by a live gRPC server stream, so it can only be enumerated once. A second pass — for
example `Enum.count/1` followed by `Enum.to_list/1` — blocks forever waiting for data that will never
arrive. Enumerate once and keep the result:

```elixir
{:ok, stream} = UmaDbClient.read(channel)
events = Enum.to_list(stream)
count = length(events)
```
:::

`read/2` does not surface the server's head position; use [`head/1`](#getting-the-head-position) instead.

## Subscribing

`UmaDbClient.subscribe/2` returns a lazy `Enumerable` that first catches up on recorded events and then
continues yielding new ones as they arrive.

```elixir
@spec subscribe(channel :: GRPC.Channel.t(), opts :: keyword()) ::
        {:ok, Enumerable.t()} | {:error, term()}
```

### Parameters

| Name          | Type                 | Description                                                                  |
|---------------|----------------------|--------------------------------------------------------------------------------|
| `channel`     | `GRPC.Channel.t()`   | Required channel returned by `connect/2`.                                     |
| `:query`      | `UmaDb.V1.Query.t()` | Optional filter by event type and/or tags. See [Query](#query).               |
| `:after`      | `non_neg_integer()`  | Optional. Only receive events recorded after this position.                   |
| `:batch_size` | `non_neg_integer()`  | Optional hint for how many events the server packs into each response batch.  |

### Return Value

`{:ok, stream}`, where `stream` yields `UmaDb.V1.SequencedEvent` structs, otherwise `{:error, reason}`.

### Example

```elixir
{:ok, stream} = UmaDbClient.subscribe(channel, query: query, after: last_position)

Enum.each(stream, fn %UmaDb.V1.SequencedEvent{position: position, event: event} ->
  handle_event(position, event)
end)
```

Iteration blocks indefinitely — the stream only ends when the server closes it or an error occurs. Run it
in a dedicated process:

```elixir
Task.start_link(fn ->
  {:ok, stream} = UmaDbClient.subscribe(channel, after: last_position)
  Enum.each(stream, &handle_event/1)
end)
```

## Getting the Head Position

`UmaDbClient.head/1` returns the position of the last recorded event.

```elixir
@spec head(channel :: GRPC.Channel.t()) ::
        {:ok, non_neg_integer() | nil} | {:error, term()}
```

### Return Value

`{:ok, position}`, or `{:ok, nil}` when the log is empty, otherwise `{:error, reason}`.

### Example

```elixir
{:ok, position} = UmaDbClient.head(channel)
```

## Tracking Consumer Positions

UmaDB can store a cursor for a named source, so a consumer can resume where it left off. Read it with
`UmaDbClient.get_tracking_info/2`.

```elixir
@spec get_tracking_info(channel :: GRPC.Channel.t(), source :: String.t()) ::
        {:ok, non_neg_integer() | nil} | {:error, term()}
```

### Parameters

| Name      | Type               | Description                                                     |
|-----------|--------------------|-------------------------------------------------------------------|
| `channel` | `GRPC.Channel.t()` | Required channel returned by `connect/2`.                        |
| `source`  | `String.t()`       | Required identifier of the tracked source, e.g. a projection name. |

### Return Value

`{:ok, position}`, or `{:ok, nil}` when no tracking record exists for `source`, otherwise
`{:error, reason}`.

### Example

```elixir
{:ok, position} = UmaDbClient.get_tracking_info(channel, "projection:orders")
```

Advance the cursor atomically as part of an append by passing `:tracking_info`. This is what makes
exactly-once processing possible, since the events and the cursor commit together:

```elixir
tracking = Builder.tracking_info("projection:orders", source_position)

{:ok, position} = UmaDbClient.append(channel, [event], tracking_info: tracking)
```

## Optimistic Concurrency

An append condition makes the append fail if events matching a query already exist — the core of DCB's
consistency model. Build one with `UmaDbClient.Builder.append_condition/1`.

```elixir
@spec append_condition(opts :: keyword()) :: UmaDb.V1.AppendCondition.t()
```

### Parameters

| Name                    | Type                 | Description                                                                       |
|-------------------------|----------------------|-------------------------------------------------------------------------------------|
| `:fail_if_events_match` | `UmaDb.V1.Query.t()` | Optional query; the append fails if any matching event exists.                     |
| `:after`                | `non_neg_integer()`  | Optional. Only consider events recorded after this position when evaluating the condition. |

### Example

```elixir
# Fail if this order was already placed.
query = Builder.query([Builder.query_item(["OrderPlaced"], ["order:1"])])
condition = Builder.append_condition(fail_if_events_match: query)

case UmaDbClient.append(channel, [event], condition: condition) do
  {:ok, position} ->
    {:ok, position}

  {:error, reason} ->
    # The condition matched — another writer got there first.
    {:error, {:conflict, reason}}
end
```

Use `:after` to only consider events recorded after a position you have already seen — the usual
read-decide-write cycle:

```elixir
{:ok, head} = UmaDbClient.head(channel)

condition =
  Builder.append_condition(
    fail_if_events_match: query,
    after: head
  )

{:ok, position} = UmaDbClient.append(channel, [event], condition: condition)
```

## Idempotent Appends

The server does **not** enforce uniqueness of event `uuid`s — appending the same `uuid` twice without a
condition simply stores two events. Idempotency comes from combining `uuid`s with an append condition: when
a conditional append would fail, the server first checks whether the events that trip the condition are the
same events being submitted, comparing their `uuid`s. If they match, it treats the call as a retry and
returns the original commit position instead of a conflict.

Two requirements follow from how this is implemented:

* **Every event in the append must carry a `uuid`.** If any one of them is missing, the check is skipped
  entirely and the retry fails as a conflict.
* **The `uuid`s are compared in order.** The server takes the first N events matching the condition — where
  N is the number of events you submitted — and compares their `uuid`s positionally against yours; all N
  must match. Submitting the same events in a different order is therefore treated as a conflict.

The `:uuid` option must be a **valid UUID string**. The server rejects anything else with
`deserialization error: Invalid UUID in Event`, so an application-specific key like `"order-1"` will not
work.

```elixir
event =
  Builder.event(
    type: "OrderPlaced",
    tags: ["order:1"],
    data: Jason.encode!(%{id: 1}),
    uuid: "550e8400-e29b-41d4-a716-446655440000"
  )

query = Builder.query([Builder.query_item(["OrderPlaced"], ["order:1"])])
condition = Builder.append_condition(fail_if_events_match: query)

# Both calls return {:ok, same_position}; only one event is stored.
{:ok, position} = UmaDbClient.append(channel, [event], condition: condition)
{:ok, ^position} = UmaDbClient.append(channel, [event], condition: condition)
```

Retrying with the same condition but a *different* `uuid` is treated as a genuine conflict and fails with
an integrity error. This makes a retry after an ambiguous failure — a timeout, say, where you do not know
whether the first attempt landed — safe to issue blindly.

## Configuring Encode and Decode

Event `data` is raw bytes on the wire, so encoding and decoding payloads at every call site gets
repetitive. `use UmaDbClient` to configure both once and get a client facade that applies them.

```elixir
defmodule MyApp.DB do
  use UmaDbClient, encode: &Jason.encode!/1, decode: &Jason.decode!/1
end
```

### Options

| Name      | Description                                                             |
|-----------|---------------------------------------------------------------------------|
| `:encode` | Optional. Applied to `event/1`'s `:data` before it is sent.              |
| `:decode` | Optional. Applied to each event's `data` when read.                      |

Both are optional and independent — `encode` only, `decode` only, or neither all work. Each accepts a
one-argument function, a `{module, function}` tuple, or a module exporting `encode!/1` and `decode!/1`
respectively:

::: tabs
== function
```elixir
use UmaDbClient, encode: &Jason.encode!/1, decode: &Jason.decode!/1
```
== tuple
```elixir
use UmaDbClient, encode: {Jason, :encode!}, decode: {Jason, :decode!}
```
== module
```elixir
use UmaDbClient, encode: Jason, decode: Jason
```
:::

### Example

`:data` is then a plain term on the way in, and already decoded on the way out:

```elixir
{:ok, channel} = MyApp.DB.connect("localhost:50051")

event = MyApp.DB.event(type: "OrderPlaced", tags: ["order:1"], data: %{id: 1})
{:ok, position} = MyApp.DB.append(channel, [event])

{:ok, stream} = MyApp.DB.read(channel)

Enum.each(stream, fn %UmaDbClient.Event{position: position, type: type, data: data} ->
  IO.inspect({position, type, data})
end)
```

For values that are already encoded, `:raw_data` bypasses the encoder:

```elixir
event = MyApp.DB.event(type: "Snapshot", raw_data: <<1, 2, 3>>)
```

Passing both `:data` and `:raw_data` raises `ArgumentError`.

### Generated Functions

The facade delegates the rest of the API, so it can replace `UmaDbClient` and `UmaDbClient.Builder`
entirely:

| Function                                                              | Behaviour                                                                    |
|-----------------------------------------------------------------------|--------------------------------------------------------------------------------|
| `event/1`                                                             | Like `Builder.event/1`, but `:data` is run through `:encode`. Accepts `:raw_data`. |
| `read/2`, `subscribe/2`                                               | Return a lazy stream of `UmaDbClient.Event` structs with `data` decoded via `:decode`. |
| `connect/2`, `append/3`, `head/1`, `get_tracking_info/2`              | Delegate to `UmaDbClient`.                                                    |
| `query/1`, `query_item/2`, `append_condition/1`, `tracking_info/2`    | Delegate to `UmaDbClient.Builder`.                                            |

```elixir
query = MyApp.DB.query([MyApp.DB.query_item(["OrderPlaced"], ["order:1"])])
{:ok, stream} = MyApp.DB.read(channel, query: query)
```

`UmaDbClient.read/2` and `UmaDbClient.subscribe/2` are unchanged and still return
`UmaDb.V1.SequencedEvent` structs. The single-use caveat applies to facade streams too.

## Event

`UmaDbClient.Builder.event/1` builds an `UmaDb.V1.Event`. Only `:type` is required. Passing unknown options,
or omitting `:type`, raises `ArgumentError`.

| Name        | Type                          | Description                                                                                               |
|-------------|-------------------------------|-------------------------------------------------------------------------------------------------------------|
| `:type`     | `String.t()`                  | **Required.** The event type, e.g. `"OrderPlaced"`.                                                        |
| `:tags`     | `[String.t()]`                | List of tag strings. Defaults to `[]`.                                                                     |
| `:data`     | `binary()`                    | The serialized payload. Defaults to `""`.                                                                  |
| `:metadata` | `map()` \| `[{String.t(), String.t()}]` | Key/value string pairs, each converted into an `UmaDb.V1.MetadataEntry`. Defaults to `[]`.        |
| `:uuid`     | `String.t()`                  | Identifier enabling idempotent conditional appends. Must be a valid UUID. Defaults to `""` (no identifier). |

The resulting struct has fields `event_type`, `tags`, `data`, `uuid` and `metadata`.

## Sequenced Event

`UmaDb.V1.SequencedEvent` is what `UmaDbClient.read/2` and `UmaDbClient.subscribe/2` yield.

| Field      | Type                 | Description                          |
|------------|----------------------|----------------------------------------|
| `position` | `non_neg_integer()`  | The event's global position in the log. |
| `event`    | `UmaDb.V1.Event.t()` | The event itself.                     |

The [facade](#configuring-encode-and-decode) yields `UmaDbClient.Event` structs instead:

| Field      | Type                            | Description                                                     |
|------------|---------------------------------|-------------------------------------------------------------------|
| `position` | `non_neg_integer()`             | The event's global position in the log.                          |
| `type`     | `String.t()`                    | The event type.                                                  |
| `tags`     | `[String.t()]`                  | List of tag strings.                                             |
| `data`     | `term()`                        | Decoded payload, or raw bytes when no `:decode` is set.          |
| `uuid`     | `String.t() \| nil`             | `nil` when the event carries no identifier.                      |
| `metadata` | `%{String.t() => String.t()}`   | A plain map, not `MetadataEntry` structs.                        |

An event recorded **without** a payload comes back as `data: nil`. The decoder is never handed an empty
binary, since decoders like `Jason.decode!/1` raise on one.

## Query

`UmaDbClient.Builder.query/1` builds an `UmaDb.V1.Query` from a list of query items. An empty list matches
all events.

| Field   | Type                        | Description                                            |
|---------|-----------------------------|----------------------------------------------------------|
| `items` | `[UmaDb.V1.QueryItem.t()]`  | Query items, OR'd together. Empty matches all events.   |

## Query Item

`UmaDbClient.Builder.query_item/2` builds an `UmaDb.V1.QueryItem`. Within an item, `types` match as OR and
`tags` match as AND. Multiple items in a query are OR'd together.

| Field   | Type            | Description                                          |
|---------|-----------------|--------------------------------------------------------|
| `types` | `[String.t()]`  | Event types to match. Matched as OR. Empty matches any type. |
| `tags`  | `[String.t()]`  | Tags to match. Matched as AND. Empty matches any tags. |

## Append Condition

`UmaDbClient.Builder.append_condition/1` builds an `UmaDb.V1.AppendCondition`.

| Field                  | Type                 | Description                                                                 |
|------------------------|----------------------|-------------------------------------------------------------------------------|
| `fail_if_events_match` | `UmaDb.V1.Query.t()` | The append fails if any event matching this query exists.                    |
| `after`                | `non_neg_integer()`  | Only consider events recorded after this position when evaluating the condition. |

## Tracking Info

`UmaDbClient.Builder.tracking_info/2` builds an `UmaDb.V1.TrackingInfo`.

| Field      | Type                 | Description                                          |
|------------|----------------------|--------------------------------------------------------|
| `source`   | `String.t()`         | Identifier of the tracked source, e.g. a projection name. |
| `position` | `non_neg_integer()`  | The position to record for that source.               |

## Error Handling

All API functions return `{:ok, result}` or `{:error, reason}`, where `reason` is typically a
`GRPC.RPCError`:

```elixir
case UmaDbClient.append(channel, [event], condition: condition) do
  {:ok, position} -> {:ok, position}
  {:error, %GRPC.RPCError{status: status, message: message}} -> {:error, {status, message}}
end
```

`read/2` and `subscribe/2` are the exception. They return `{:ok, stream}` immediately, but an error that
occurs **mid-stream** is raised as a `GRPC.RPCError` while iterating. Wrap iteration if you need to recover:

```elixir
try do
  Enum.each(stream, &handle_event/1)
rescue
  e in GRPC.RPCError -> Logger.error("stream failed: #{e.message}")
end
```

Server-side failures are categorized by `UmaDb.V1.ErrorResponse.ErrorType` — `IO`, `SERIALIZATION`,
`INTEGRITY`, `CORRUPTION`, `INTERNAL`, `AUTHENTICATION` and `INVALID_ARGUMENT`. A failed append condition
arrives as a `GRPC.RPCError` with status `9` (failed precondition) and a message beginning
`integrity error: condition failed`, naming the event that matched.

## Complete Example

Read current state, decide, then append conditionally so a concurrent writer cannot slip in between:

```elixir
alias UmaDbClient.Builder

{:ok, channel} = UmaDbClient.connect("localhost:50051")

# 1. Capture the current head to scope the condition.
{:ok, head} = UmaDbClient.head(channel)

# 2. Read what already happened for this order.
query = Builder.query([Builder.query_item([], ["order:1"])])
{:ok, stream} = UmaDbClient.read(channel, query: query)
history = Enum.to_list(stream)

# 3. Decide, based on that history.
if Enum.any?(history, &(&1.event.event_type == "OrderPlaced")) do
  {:error, :already_placed}
else
  # 4. Append, failing if anything matching arrived since we read.
  condition =
    Builder.append_condition(
      fail_if_events_match: query,
      after: head
    )

  event =
    Builder.event(type: "OrderPlaced", tags: ["order:1"], data: Jason.encode!(%{id: 1}))

  case UmaDbClient.append(channel, [event], condition: condition) do
    {:ok, position} -> {:ok, position}
    {:error, reason} -> {:error, {:conflict, reason}}
  end
end
```

## Example with Tracking

A consumer that processes events and checkpoints its position in the same transaction:

```elixir
{:ok, last} = UmaDbClient.get_tracking_info(channel, "projection:orders")

{:ok, stream} = UmaDbClient.subscribe(channel, after: last)

Enum.each(stream, fn %UmaDb.V1.SequencedEvent{position: position, event: event} ->
  derived = handle_event(event)

  # Commit the derived event and the cursor together.
  UmaDbClient.append(channel, [derived],
    tracking_info: Builder.tracking_info("projection:orders", position)
  )
end)
```

## Notes

* **Calls are blocking.** Each function call blocks the calling process until the server responds.
  `subscribe/2` blocks for as long as the stream is open.
* **`data` is raw bytes on the wire.** The protocol carries an opaque byte string, so
  `UmaDbClient.Builder.event/1` and `UmaDbClient.read/2` leave the choice of format to you — pick one
  (JSON, protobuf, `:erlang.term_to_binary/1`) and use it consistently across writers and readers. To stop
  repeating it at every call site, configure it once with
  [`use UmaDbClient`](#configuring-encode-and-decode).
* **Read and subscribe streams are single-use.** They are backed by a live gRPC stream, so enumerating one
  twice blocks forever. Enumerate once and keep the result.
* **Event `uuid`s must be valid UUIDs, and are not enforced to be unique.** A non-UUID string is rejected
  with `deserialization error: Invalid UUID in Event`. The server will store the same valid `uuid` twice
  quite happily; it only has an effect when paired with an append condition.
* **API-key authentication is not supported.** The client does not thread per-call metadata through to the
  underlying stub. TLS via `:cred` is supported.
* **`read/2` does not surface the server's head position.** `ReadResponse.head` is dropped when the batched
  responses are flattened into a single event stream; use `head/1` instead.

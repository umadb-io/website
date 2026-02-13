---
head:
  - - meta
    - name: description
      content: How to use UmaDB with .NET
  - - meta
    - name: keywords
      content: UmaDB, client, .NET
---
# .NET Clients

UmaDB provides first-class .NET support via dedicated [C#](/clients/dotnet/csharp) and [F#](/clients/dotnet/fsharp) clients targeting .NET 10.0+.
Both clients share the same gRPC core and protocol, while providing idiomatic APIs for each language.

| Language | Package                                       | Status                                                                                     |
|----------|-----------------------------------------------|--------------------------------------------------------------------------------------------|
| C#       | [UmaDb.Client](/clients/dotnet/csharp)        | [![NuGet](https://img.shields.io/nuget/v/UmaDb.Client.svg)](/clients/dotnet/csharp)        |
| F#       | [UmaDb.Client.Fsharp](/clients/dotnet/fsharp) | [![NuGet](https://img.shields.io/nuget/v/UmaDb.Client.Fsharp.svg)](/clients/dotnet/fsharp) |


Quick NuGet commands:

```bash
dotnet add package UmaDb.Client          # C#
dotnet add package UmaDb.Client.Fsharp   # F#
```

Supported features:

- gRPC transport
- TLS encryption
- Authentication
- Streaming
- Transactions
- Async workflows and cancellation


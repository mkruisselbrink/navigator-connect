# Design Alternatives

This document outlines the various designs that have been proposed for cross-origin communication between ServiceWorkers. It also includes ideas for features/optimizations of the implementation that are of interest, but perhaps not core to the fundamental design.

This document is meant to be a work in progress that should be updated as new designs and ideas are brought to the table.

## Designs for Cross-Origin Communication Between Service Workers

### MessagePorts

   - `navigator.connect("https://example.com/services/v1")` can be accepted/rejected by a Service Worker that has registered to handle this URL
   - A `MessagePort` is opened between the origins on accept
   - Explicit connection attempt to a Service Worker allows potential for browser to pull down the Service Worker if it is not installed

### Local look-aside `fetch()`

   - A `local_fetch()` request to `https://example.com/services/v1` is routed to a local Service Worker if one is installed
   - The `local_fetch()` does not then go to the network if no Service Worker is installed for the relevant scope
   - This is also a somewhat explicit connection attempt to a Service Worker, so the browser could potentially pull down the Service Worker if it is not installed

### Universal look-aside `fetch()`

   - Same as the local look-aside `fetch()`, except if no Service Worker is installed for the relevant scope, then the `fetch()`` goes to the network just as it would in today's world
   - This new mode for `fetch()` would need to be enabled explicitly, either as an option in the `Request` or as a new kind of scope the cross-origin Service Worker could opt into.

## Features & Optimizations

### `MessagePort` lifetime management

[Stashed MessagePorts](https://gist.github.com/mkruisselbrink/536632fcd99d45005064) would allow a Service Worker to transfer a `MessagePort` to or from "external" ownership, in order to allow any `MessagePort` to outlive the JavaScript context of a Service Worker.

A variant of this idea might allow a Service Worker to keep using the `MessagePort` as an object, but record that it should be stashed when the Service Worker is destroyed.
Then the top-level script could reconstitute its object graph, including `MessagePort`s when it receives a message.

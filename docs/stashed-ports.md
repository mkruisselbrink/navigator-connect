# Stashed MessagePorts
`MessagePort`s aren't too useful in service workers as is, since to be able to use them the javascript code needs to keep a reference to them. This is a proposal for a mechanism to "stash" a `MessagePort` in a service worker so the port can outlive the service workers javascript context.

```idl
partial interface ServiceWorkerGlobalScope {
    void stashPort(USVString key, MessagePort port);
    Promise<sequence<MessagePort>> getStashedPorts(USVString key);
};

interface StashedMessageEvent : MessageEvent {
    readonly attribute USVString key;
};
```

Each Service Worker registration has multiple lists of stashed message ports associated with them, each list with its own key. With the `stashPort` method a service worker can add a new `MessagePort` to the list of ports with a specific key. Once a port has been "stashed" this way, messages sent to it no longer result in `message` events on the port, but instead `message` events (or maybe some new event type) will be sent to the service workers global scope. When a message is from a stashed message port, the source attribute of the `MessageEvent` is set to the `MessagePort`, and additionally a `key` property is present to indicate the key the `MessagePort` was stashed with.

## Why is this helpful?
This makes it possible to change the `navigator.connect` proposal to return a MessagePort on both sides of the connection. This is both simpler, and more powerful: now the service side connection can also be transferred, and on top of that if the client side of a navigator.connect channel is a service worker, with this stashed ports thing it is now possible for that port to survive the service worker being shut down.

### Updated CrossOriginConnectEvent
```idl
[Exposed=ServiceWorker]
interface CrossOriginConnectEvent : Event {
    readonly attribute DOMString origin;
    readonly attribute DOMString targetUrl;
    Promise<MessagePort> acceptConnection (Promise<boolean> shouldAccept);
};
```

### Sample code
Client side service worker:
```js
// client-worker.js
navigator.connect('https://example.com/services/push')
  .then(function(port) {
      port.postMessage({register: 'apikey'});
      self.stashPort('pushService', port);
    });

self.addEventListener('message', function(e) {
  if (e.key === 'pushService') {
    // Do something with the message.
  }
});
```

Service side service worker:
```js
// service-worker.js
self.addEventListener('crossoriginconnect', function(e) {
  // Optionally check e.origin
  e.acceptConnection(e.targetUrl === 'https://example.com/service/push')
    .then(function(port) {
        self.stashPort('pushClients', port);
      });
});

self.addEventListener('message', function(e) {
  if (e.key === 'pushClients') {
    // Do something with the data sent
    e.source.postMessage('registered');
  }
});

self.addEventListener('push', function(e) {
  self.getStashedPorts('pushClients')
    .then(function(ports) {
        for (var i = 0; i < ports.length; ++i) {
          ports[i].postMessage('pushmessage');
        }
      });
});
```

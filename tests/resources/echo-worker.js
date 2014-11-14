importScripts('../../polyfill/service-polyfill.js');

self.addEventListener('crossoriginconnect', function(event) {
  event.acceptConnection(true);
});


self.addEventListener('crossoriginmessage', function(event) {
  event.source.postMessage(event.data, event.ports);
});

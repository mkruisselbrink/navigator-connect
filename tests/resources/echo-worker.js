importScripts('../../polyfill/service-polyfill.js');

self.addEventListener('foreignconnect', function(event) {
  event.acceptConnection(true);
});


self.addEventListener('foreignmessage', function(event) {
  event.source.postMessage(event.data, event.ports);
});

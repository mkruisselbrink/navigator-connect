self.workerLogLevel = self.workerLogLevel || 1;

importScripts('coroutine.js#' + location.hash.replace(/^#/, ''));

function *slowCounter(count, seconds, port) {
  for (var i = 0, j = count; i < j; ++i) {
    var $result, $coroutine = sleep(seconds);
    // start "async function* call" boilerplate; call assigned to $coroutine
    for (var $inject = $action(); !($result = $coroutine.next($inject)).done;) $inject = yield $result.value;
    // end "async function* call" boilerplate; return value in $result.value
    port.postMessage({
      type: 'service-posted',
      peerInfo: port.peerInfo,
      data: 'sleep(' + seconds + ') -> ' + $result.value});
    port.peerInfo.lastSent = Date.now();
  }
  return i;
}

addEventListener('install', function() {
  if (self.workerLogLevel) console.log('worker installed', location.href);
  if (typeof(skipWaiting) != 'undefined') skipWaiting().then(function(){
    if (self.workerLogLevel) console.log('skipped wait');
  });
});

addEventListener('activate', function() {
  if (self.workerLogLevel) console.log('worker activated', location.href);
});

allClientPorts = [];

function broadcast(data) {
  var oldPorts = allClientPorts;
  allClientPorts = [];
  while (oldPorts.length) {
    var port = oldPorts.pop();
    try {
      port.postMessage({type: 'broadcast', peerInfo: port.peerInfo, data: data});
      port.peerInfo.lastSent = Date.now();
      allClientPorts.push(port);
    } catch (ex) {
      console.log('lost port due to exception ', ex, {origin: port.origin, targetUrl: port.targetUrl});
    }
  }
}

addEventListener('crossoriginconnect', function(ev) {
  var port = ev.client;
  // TODO(bsittler): Remove this once the implementation allows the
  // source port to be determined reliably when handling a message.
  var connectionId = 'connection' + String(crypto.getRandomValues(new Uint32Array(1))[0] & 0x7fffffff);
  var now = Date.now();
  port.peerInfo = {
    connectionId: connectionId,
    origin: port.origin,
    targetUrl: port.targetUrl,
    worker: location.href,
    lastSent: now,
    lastReceived: now};
  if (self.workerLogLevel) console.log('xoconnected', port.peerInfo);
  ev.acceptConnection(true);
  allClientPorts.push(port);
  port.postMessage({type: 'connected', peerInfo: port.peerInfo});
  port.peerInfo.lastSent = Date.now();
  broadcast({
    type: 'client-connected',
    origin: port.origin,
    targetUrl: port.targetUrl,
    worker: location.href});
  coroutine(slowCounter(5, 1, port), function (value) {
    port.postMessage({
      type: 'service-posted',
      peerInfo: port.peerInfo,
      data: 'slowCounter(5, 1, ...) -> ' + value});
    port.peerInfo.lastSent = Date.now();
  });
  coroutine(slowCounter(15, 0.5, port), function (value) {
    port.postMessage({
      type: 'service-posted',
      peerInfo: port.peerInfo,
      data: 'slowCounter(15, 0.5, ...) -> ' + value});
    port.peerInfo.lastSent = Date.now();
  });
});

addEventListener('crossoriginmessage', function(ev) {
  if (!ev.data) {
    console.log('worker ', location.href, ' read a malformed message with false-y data. client at ', JSON.stringify(ev.origin), ' said:', ev.data);
    return;
  }
  var peerInfo = ev.data.peerInfo;
  if (!peerInfo) {
    console.log('worker ', location.href, ' read a malformed message with no peerInfo. client at ', JSON.stringify(ev.origin), ' said:', ev.data);
    return;
  }
  var port;
  for (var i = 0, j = allClientPorts.length; (i < j) && !port; ++i) {
    var candidate = allClientPorts[i];
    if (candidate.peerInfo.connectionId == peerInfo.connectionId) port = candidate;
  }
  if (!port) {
    console.log('worker ', location.href, ' read an unsolicited message. client at ', JSON.stringify(ev.origin), ' with connectionId ', JSON.stringify(peerInfo.connectionId), ' said:', ev.data);
    return;
  }
  if ((port.peerInfo.origin != ev.origin) && (ev.origin != "")) {
    console.log('worker ', location.href, ' read a message with mismatching origin.  client at ', JSON.stringify(ev.origin), ' (should have been ', JSON.stringify(port.peerInfo.origin), ') said:', ev.data);
    return;
  }
  if (port.peerInfo.targetUrl != peerInfo.targetUrl) {
    console.log('worker ', location.href, ' read a message with mismatching targetUrl. client at ', JSON.stringify(ev.origin), ' with connectionId ', JSON.stringify(peerInfo.connectionId), ' and targetUrl ', JSON.stringify(peerInfo.targetUrl), ' (should have been ', JSON.stringify(port.peerInfo.targetUrl), ') said:', ev.data);
    return;
  }
  port.peerInfo.lastReceived = Date.now();
  var messageType = ev.data.type;
  console.log('worker ', location.href, ' read a ', JSON.stringify(messageType), ' message. client at ', JSON.stringify(port.peerInfo.origin), ' with connectionId ', JSON.stringify(peerInfo.connectionId), ' said:', ev.data.data);
  if (messageType == 'broadcast') {
    broadcast({
      type: 'client-posted',
      data: ev.data.data,
      origin: ev.origin});
  }
});

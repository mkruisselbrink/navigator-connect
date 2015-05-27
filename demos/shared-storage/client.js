function getOrigin(target) {
  if (!target.origin || target.origin === 'null' || target.protocol === 'data:') {
    return 'http://localhost:8181';
  }
  return target.origin;
}

function getFolder(target, deltaUp) {
  if (!target.pathname || target.protocol === 'data:') {
    return '/';
  }
  return target.pathname.replace(new RegExp("(?:\\\/+[^\\\/]*){0," + (deltaUp ? deltaUp + 1 : 1) + "}$"), "/");
}

self.clientLogLevel = self.clientLogLevel || 0;

self.slowCounterServiceInfo = self.slowCounterServiceInfo || {
  'origin': getOrigin(location),
  'pathPrefix': getFolder(location),
  'service': 'slow-counter',
  'loader': 'loader.html'
};

console.log('slowCounterServiceInfo:', self.slowCounterServiceInfo);

function *connectToService(serviceInfo) {
  if (!navigator.connect) throw new Error('Missing navigator.connect');
  var $result, $inner = getpid();
  // start "async function* call" boilerplate; call assigned to $inner
  for (var $inject = $action(); !($result = $inner.next($inject)).done;) $inject = yield $result.value;
  // end "async function* call" boilerplate; return value in $result.value
  var pid = $result.value;
  var token =
      encodeURIComponent(pid + '_' + String(crypto.getRandomValues(new Uint32Array(1))[0] & 0x7fffffff));
  var snapBackPrefix = 'SNAP_BACK_'; // must be a valid identifier
  var serviceOrigin = serviceInfo.origin;
  var servicePathPrefix = serviceInfo.pathPrefix;
  var serviceUrl = serviceOrigin + servicePathPrefix + serviceInfo.service + '#' + token;
  var bootstrapUrl = serviceOrigin + servicePathPrefix + serviceInfo.loader + '#' + token;
  if (self.clientLogLevel) console.log('coroutine ', pid, ' connecting to service...');
  // start "async system call" boilerplate; system call inside yielded
  // closure with normal $resume closure, injecting $signal closure,
  // and coroutine identifier $pid as parameters; $resume forwards
  // parameters to $action.
  var $result, $inner = yield function ($resume, $signal, $pid) {
    var resume = $resume, signal = $signal, pid = $pid;
    if (self.clientLogLevel) console.log('coroutine ', pid, ' outer n.c...');
    navigator.connect(serviceUrl).then(resume).catch(function(reason) {
      if (self.clientLogLevel) {
	console.log('coroutine ', pid, ' could not connect to service; failure reason: ', reason);
      }
      if (self.clientLogLevel) console.log('coroutine ', pid, ' adding loader IFRAME');
      var ifr = document.createElement('iframe');
      ifr.src = bootstrapUrl;
      var bootDetector;
      addEventListener('message', bootDetector = function(ev){
	if (ev.origin == serviceOrigin && ev.data == ('ready#' + token)) {
	  if (self.clientLogLevel) console.log('coroutine ', pid, ' loader said the worker is ready');
	  if (self.clientLogLevel) console.log('coroutine ', pid, ' removing loader IFRAME');
	  removeEventListener('message', bootDetector);
	  ifr.parentNode.removeChild(ifr);
	  if (self.clientLogLevel) console.log('coroutine ', pid, ' connecting to service again...');
	  navigator.connect(serviceUrl).then(resume).catch($thrower(signal));
	} else if (ev.origin == serviceOrigin && ev.data == ('failed#' + token)) {
	  console.log('coroutine ', pid, ' loader said the worker setup failed');
	  if (self.clientLogLevel) console.log('coroutine ', pid, ' removing loader IFRAME');
	  removeEventListener('message', bootDetector);
	  ifr.parentNode.removeChild(ifr);
	  var retried =
	      (self.name.indexOf(snapBackPrefix + history.length + '_') == 0) ||
	      (self.name.indexOf(snapBackPrefix + (history.length - 1) + '_') == 0);
	  if (!retried) {
	    console.log('coroutine ', pid, ' attempting snapback flow...');
	    self.name = snapBackPrefix + history.length + '_' + self.name;
	    var sep = '&?'.charAt(serviceInfo.loader.indexOf('?') == -1);
	    var snapBackUrl =
		serviceOrigin + servicePathPrefix + serviceInfo.loader +
		sep + 'snapback=' + history.length +
		'#' + token;
	    location = snapBackUrl;
	  } else {
	    self.name = self.name.split('_').slice(snapBackPrefix.split('_').length).join('_');
	    console.log('coroutine ', pid, ' already tried snapback flow, giving up');
	    resume(undefined, 'worker setup failed for coroutine ' + pid);
	  }
	} else if (ev.origin == serviceOrigin && ev.data == ('registered#' + token)) {
	  if (self.clientLogLevel) {
	    console.log('coroutine ', pid, ' loader said the worker is registered, waiting for it to be ready...');
	  }
	} else if (ev.origin == serviceOrigin && ev.data == ('loaded#' + token)) {
	  if (self.clientLogLevel) {
	    console.log('coroutine ', pid, ' loader started, waiting for worker registration...');
	  }
	}
      });
      document.body.appendChild(ifr);
      if (self.clientLogLevel) console.log('coroutine ', pid, ' created bootstrap iframe');
    });
    if (self.clientLogLevel) console.log('coroutine ', pid, ' outer n.c. called');
  };
  if (self.clientLogLevel) {
    console.log('coroutine ', pid, ' back from outer n.c yield with coroutine ', $inner);
  }
  // middle of "async system call" boilerplate; injector assigned to $inner
  {
    // start "async function* call" boilerplate; call assigned to $inner
    for (var $inject = $action(); !($result = $inner.next($inject)).done;) $inject = yield $result.value;
    // end "async function* call" boilerplate; return value in $result.value
  }
  // end of "async system call" boilerplate; $result.value has
  // opt_result parameter passed to $resume
  var retried =
      (self.name.indexOf(snapBackPrefix + history.length + '_') == 0) ||
      (self.name.indexOf(snapBackPrefix + (history.length - 1) + '_') == 0);
  if (retried) self.name = self.name.split('_').slice(snapBackPrefix.split('_').length).join('_');
  var port = $result.value;
  var now = Date.now();
  port.peerInfo = {
    connectionId: undefined,
    origin: serviceOrigin,
    targetUrl: serviceUrl,
    worker: undefined,
    lastSent: now,
    lastReceived: now};
  if (self.clientLogLevel) console.log('coroutine ', pid, ' connected to service!', port);
  return port;
}

allServicePorts = [];

function broadcast(data) {
  var oldPorts = allServicePorts;
  allServicePorts = [];
  while (oldPorts.length) {
    var port = oldPorts.pop();
    try {
      port.postMessage({type: 'broadcast', peerInfo: port.peerInfo, data: data});
      port.peerInfo.lastSent = Date.now();
      allServicePorts.push(port);
    } catch (ex) {
      if (self.clientLogLevel) {
	console.log('lost port', {origin: port.origin, targetUrl: port.targetUrl});
      }
    }
  }
}

function *setupClient(serviceInfo) {
  var $result, $inner = getpid();
  // start "async function* call" boilerplate; call assigned to $inner
  for (var $inject = $action(); !($result = $inner.next($inject)).done;) $inject = yield $result.value;
  // end "async function* call" boilerplate; return value in $result.value
  var pid = $result.value;
  if (self.clientLogLevel) console.log('coroutine ', pid, ' starting setupClient...');
  var $result, $inner = connectToService(serviceInfo);
  // start "async function* call" boilerplate; call assigned to $inner
  for (var $inject = $action(); !($result = $inner.next($inject)).done;) $inject = yield $result.value;
  // end "async function* call" boilerplate; return value in $result.value
  var port = $result.value;
  console.log('coroutine ', pid, ' setupClient done, port is ', port);
  allServicePorts.push(port);
  var queued = [];
  var wakeup = [];
  port.onmessage = function(ev) {
    port.peerInfo.lastReceived = Date.now();
    if (self.clientLogLevel) {
      console.log('async message ', ev, ' for coroutine ', pid, ' listening: ', !!wakeup.length);
    }
    try {
      (wakeup.pop() || function(ev) { queued.push(ev); })(ev);
    } catch (ex) {
      if (self.clientLogLevel) {
	console.log('exception ', ex, ' while enqueuing for coroutine ', pid, ' so removing listener');
      }
      port.onmessage = undefined;
      throw ex;
    }
  };
  while(1) {
    if (self.clientLogLevel) console.log('coroutine ', pid, ' main loop body starting...');
    try {
      // start "async system call" boilerplate; system call inside yielded
      // closure with normal $resume closure and injecting $signal closure
      // as parameters; $resume forwards parameters to $action.
      var $result, $inner = yield function ($resume, ignored_$signal, $pid) {
	if (self.clientLogLevel) console.log('coroutine ', pid, ' has queued message? ', !!queued.length);
	if (queued.length) return $resume(queued.pop());
	if (self.clientLogLevel) {
	  console.log('coroutine ', pid, ' going to sleep until an async message arrives');
	}
	wakeup = [$resume];
      };
      // middle of "async system call" boilerplate; injector assigned to $inner
      {
	// start "async function* call" boilerplate; call assigned to $inner
	for (var $inject = $action(); !($result = $inner.next($inject)).done;) $inject = yield $result.value;
	// end "async function* call" boilerplate; return value in $result.value
      }
      // end of "async system call" boilerplate; $result.value has
      // opt_result parameter passed to $resume
      var ev = $result.value;
      if (!ev.data) {
	console.log('coroutine ', pid, ' read a malformed message with false-y data. service at ', JSON.stringify(ev.origin), ' said:', ev.data);
	continue;
      }
      var peerInfo = ev.data.peerInfo;
      if (!peerInfo) {
	console.log('coroutine ', pid, ' read a malformed message with no peerInfo. service at ', JSON.stringify(ev.origin), ' said:', ev.data);
	continue;
      }
      var port;
      for (var i = 0, j = allServicePorts.length; (i < j) && !port; ++i) {
	var candidate = allServicePorts[i];
	if (candidate.peerInfo.targetUrl == peerInfo.targetUrl) port = candidate;
      }
      if (!port) {
	console.log('coroutine ', pid, ' read an unsolicited message. service at ', JSON.stringify(ev.origin), ' said:', ev.data);
	continue;
      }
      if ((port.peerInfo.origin != ev.origin) && (ev.origin != "")) {
	console.log('coroutine ', pid, ' read a message with mismatching origin. service at ', JSON.stringify(ev.origin), ' (should have been ', JSON.stringify(port.peerInfo.origin), ') said:', ev.data);
	continue;
      }
      port.peerInfo.connectionId = port.peerInfo.connectionId || peerInfo.connectionId;
      if (port.peerInfo.connectionId != peerInfo.connectionId) {
	console.log('coroutine ', pid, ' read a message with mismatching connectionId. service at ', JSON.stringify(ev.origin), ' with connectionId ', JSON.stringify(peerInfo.connectionId), ' (should have been ', JSON.stringify(port.peerInfo.connectionId), ') said:', ev.data);
	continue;
      }
      port.peerInfo.worker = port.peerInfo.worker || peerInfo.worker;
      if (port.peerInfo.worker != peerInfo.worker) {
	console.log('coroutine ', pid, ' changed workers. service at ', JSON.stringify(port.peerInfo.origin), ' with worker ', JSON.stringify(peerInfo.worker), ' (previously ', JSON.stringify(port.peerInfo.worker), ') said:', ev.data);
	port.peerInfo.worker = peerInfo.worker;
      }
      var messageType = ev.data.type;
      console.log('coroutine ', pid, ' read a ', JSON.stringify(messageType), ' message. service at ', JSON.stringify(port.peerInfo.origin), ' with connectionId ', JSON.stringify(peerInfo.connectionId), ' said:', ev.data.data);
    } finally {
      if (self.clientLogLevel) console.log('coroutine ', pid, ' main loop body ending');
    }
  }
}

function whenClientLoaded() {
  var startClient = function() {
    signalClient = coroutine(setupClient(slowCounterServiceInfo));
  };
  if (typeof(coroutine) == 'undefined') {
    (self.coroutineLoadHandlers = self.coroutineLoadHandlers || []).push(startClient);
    var scr = document.createElement('script');
    scr.src = slowCounterServiceInfo.origin + slowCounterServiceInfo.pathPrefix + 'coroutine.js';
    document.head.appendChild(scr);
  } else {
    startClient();
  }
}

if (document.readyState == 'complete') whenClientLoaded();
else addEventListener('load', whenClientLoaded);

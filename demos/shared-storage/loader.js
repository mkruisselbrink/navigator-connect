self.loaderLogLevel = self.loaderLogLevel || 1;

function *setupLoader() {
  var $result, $inner = getpid();
  // start "async function* call" boilerplate; call assigned to $inner
  for (var $inject = $action(); !($result = $inner.next($inject)).done;) $inject = yield $result.value;
  // end "async function* call" boilerplate; return value in $result.value
  var pid = $result.value;
  if (self.loaderLogLevel) console.log('coroutine ', pid, ' starting setupLoader...');
  var token = location.hash.replace(/^#/, '');
  if (self != parent) {
    parent.postMessage('loaded#' + token, '*');
  }
  if (self.loaderLogLevel) console.log('got load event', location.href);
  try {
    // start "async system call" boilerplate; system call inside yielded
    // closure with normal $resume closure and injecting $signal closure
    // as parameters; $resume forwards parameters to $action.
    var $result, $inner = yield function ($resume, $signal, $pid) {
      navigator.serviceWorker.register('worker.js?$unique=' + (crypto.getRandomValues(new Uint32Array(1))[0]&0x7fffffff) + '#' + token).then($resume).catch($thrower($signal));
    };
    // middle of "async system call" boilerplate; injector assigned to $inner
    {
      // start "async function* call" boilerplate; call assigned to $inner
      for (var $inject = $action(); !($result = $inner.next($inject)).done;) $inject = yield $result.value;
      // end "async function* call" boilerplate; return value in $result.value
    }
    // end of "async system call" boilerplate; $result.value has
    // opt_result parameter passed to $resume
  } catch (ex) {
    if (self.loaderLogLevel) console.log('coroutine ', pid, ' worker registration failed: ', ex);
    parent.postMessage('failed#' + token, '*');
    throw ex;
  }
  if (self.loaderLogLevel) console.log('coroutine ', pid, ' worker registered');
  if (self != parent) {
    parent.postMessage('registered#' + token, '*');
  }
  try {
    // start "async system call" boilerplate; system call inside yielded
    // closure with normal $resume closure and injecting $signal closure
    // as parameters; $resume forwards parameters to $action.
    var $result, $inner = yield function ($resume, $signal, $pid) {
	navigator.serviceWorker.ready.then($resume).catch($thrower($signal));
    };
    // middle of "async system call" boilerplate; injector assigned to $inner
    {
      // start "async function* call" boilerplate; call assigned to $inner
      for (var $inject = $action(); !($result = $inner.next($inject)).done;) $inject = yield $result.value;
      // end "async function* call" boilerplate; return value in $result.value
    }
    // end of "async system call" boilerplate; $result.value has
    // opt_result parameter passed to $resume
  } catch (ex) {
    if (self.loaderLogLevel) console.log('coroutine ', pid, ' worker failed to get ready: ', ex);
    parent.postMessage('failed#' + token, '*');
    throw ex;
  }
  if (self.loaderLogLevel) console.log('coroutine ', pid, ' worker ready');
  if (self != parent) {
    parent.postMessage('ready#' + token, '*');
  } else {
    var snapBack = ((location.search.match(/^[?]?(.*[&])?snapback=([^&]*)([&].*)?$/) || [])[2]||'-1')|0;
    if ((snapBack >= 0) && (snapBack <= history.length)) {
      console.log('coroutine ', pid, ' snapping back to ', snapBack);
      history.go((snapBack - history.length) || -1);
    }
  }
}

function whenLoaderLoaded() {
  var startLoader = function() {
    signalLoader = coroutine(setupLoader());
  };
  if (typeof(coroutine) == 'undefined') {
    (self.coroutineLoadHandlers = self.coroutineLoadHandlers || []).push(startLoader);
    var scr = document.createElement('script');
    scr.src = 'coroutine.js?$unique=' + (crypto.getRandomValues(new Uint32Array(1))[0]&0x7fffffff);
    document.head.appendChild(scr);
  } else {
    startLoader();
  }
}

if (document.readyState == 'complete') whenLoaderLoaded();
else addEventListener('load', whenLoaderLoaded);

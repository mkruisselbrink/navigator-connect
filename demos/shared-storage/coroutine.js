self.coroutineLogLevel = self.coroutineLogLevel || 0;

// Default injected coroutine; throws an exception if provided;
// returns provided value (or undefined) otherwise. Not allowed to
// yield.
function *$action(opt_result, opt_exception) {
  if (self.coroutineLogLevel) console.log('$action', arguments);
  if (typeof opt_exception != 'undefined') throw opt_exception;
  return opt_result;
}

// Put the current coroutine to sleep for the given number of seconds,
// then return the number of seconds remaining in case of early
// return or zero otherwise.
function *sleep(seconds) {
  var endTime = (new Date).getTime() + seconds * 1000;
  // start "async system call" boilerplate; system call inside yielded
  // closure with normal $resume closure, injecting $signal closure,
  // and coroutine identifier $pid as parameters; $resume forwards
  // parameters to $action.
  var $result, $inner = yield function ($resume, ignored_$signal, ignored_$pid) {
    setTimeout($resume, seconds * 1000);
  };
  // middle of "async system call" boilerplate; injector assigned to $inner
  {
    // start "async function* call" boilerplate; call assigned to $inner
    for (var $inject = $action(); !($result = $inner.next($inject)).done;) $inject = yield $result.value;
    // end "async function* call" boilerplate; return value in $result.value
  }
  // end of "async system call" boilerplate; $result.value has
  // opt_result parameter passed to $resume
  var now = (new Date).getTime();
  return (now < endTime) ? (endTime - now) / 1000 : 0;
}

// Return the coroutine identifier for the currently executing
// coroutine.
function *getpid() {
  // start "async system call" boilerplate; system call inside yielded
  // closure with normal $resume closure, injecting $signal closure,
  // and coroutine identifier $pid as parameters; $resume forwards
  // parameters to $action.
  var $result, $inner = yield function ($resume, ignored_$signal, $pid) {
    $resume($pid);
  };
  // middle of "async system call" boilerplate; injector assigned to $inner
  {
    // start "async function* call" boilerplate; call assigned to $inner
    for (var $inject = $action(); !($result = $inner.next($inject)).done;) $inject = yield $result.value;
    // end "async function* call" boilerplate; return value in $result.value
  }
  // end of "async system call" boilerplate; $result.value has
  // opt_result parameter passed to $resume
  return $result.value;
}

// This is the default yielding action for a coroutine. It gives
// events (and hence other coroutines too) a chance to run.  $resume
// will be filled in by coroutine(...) with an appropriate closure to
// revive the stack of the suspended coroutine.
function $yield($resume, ignored_$signal, $pid) {
  if (self.coroutineLogLevel) console.log('coroutine ', $pid, ' $yield');
  var resume = $resume;
  setTimeout(resume, 0);
}

// Return a closure which will throw its first parameter into a
// coroutine using the passed-in $signal closure.
function $thrower($signal) {
  var signal = $signal;
  return function (ex) { signal($action(undefined, ex)); };
}

// Wraps a coroutine and returns $signal which can be used to run an
// inner coroutine in the target coroutine asynchronously. The
// optional opt_onReturn handler handles return values; opt_onThrow
// handles exceptions; the optional opt_onYield handler runs when the
// coroutine yields prior to returning and gets the return value of
// the yield closure passed to it.
function coroutine($coroutine, opt_onReturn, opt_onThrow, opt_onYield) {
  var $pid = location.pathname.split('/').pop() + '_' + (crypto.getRandomValues(new Uint32Array(1))[0]&0x7fffffff);
  var onReturn = opt_onReturn || function(value) {
    if (self.coroutineLogLevel) console.log('coroutine ', $pid, ' default return ', arguments);
  };
  var onThrow = opt_onThrow || function(reason) {
    if (self.coroutineLogLevel) console.log('coroutine ', $pid, ' default throw ', arguments);
    throw reason;
  };
  var onYield = opt_onYield || function(opt_args) {
    if (self.coroutineLogLevel) console.log('coroutine ', $pid, ' default yield ', arguments);
  };
  var outer = $coroutine, running = false, terminated = false, injected = [];
  var $signal, $resume;
  var resumeFrom = function(whence) {
    var savedWhence = whence;
    return function(var_args) {
      if (self.coroutineLogLevel) {
	console.log('coroutine ', $pid, ' resumeFrom ', whence, ' with ', arguments);
      }
      return $resume.apply(this, arguments);
    };
  };
  $resume = function(opt_result, opt_exception) {
    if (self.coroutineLogLevel) console.log('coroutine ', $pid, ' $resume ', arguments);
    if (terminated) {
      if (self.coroutineLogLevel) console.log('ignoring attempt to resume terminated coroutine ', $pid);
      throw 'resumption after termination of coroutine ' + $pid;
    }
    var action, parameter;
    if (arguments.length) injected.push($action(opt_result, opt_exception));
    try {
      var inner = injected.pop() || $action();
      try {
	running = true;
	if (!($result = outer.next(inner)).done) {
	  running = false;
	  action = onYield;
	  var once = false;
	  var resumeOnce = function(var_args) {
	    if (self.coroutineLogLevel) console.log('coroutine ', $pid, ' resumeOnce ', arguments);
	    if (once) {
	      if (self.coroutineLogLevel) {
		console.log('ignoring attempt to resume again from the same yield');
	      }
	      throw 'double resumption of coroutine ' + $pid;
	    }
	    once = true;
	    return resumeFrom('resumeOnce').apply(this, arguments);
	  };
	  var signalResumeOnce = function(inner) {
	    if (self.coroutineLogLevel) console.log('coroutine ', $pid, ' signalResumeOnce ', arguments);
	    injected.push(inner);
	    setTimeout(resumeOnce, 0);
	  };
	  parameter = ($result.value || $yield)(resumeOnce, signalResumeOnce, $pid);
	} else {
	  terminated = true;
	  if (self.coroutineLogLevel) {
	    console.log('terminated coroutine ', $pid, ' at regular return ', $result.value);
	  }
	  action = onReturn;
	  parameter = $result.value;
	}
      } finally {
	running = false;
      }
    } catch (e) {
      terminated = true;
      if (self.coroutineLogLevel) console.log('terminated coroutine ', $pid, ' at exception ', e);
      action = onThrow;
      parameter = e;
    }
    return action(parameter);
  };
  $signal = function (inner) {
    injected.push(inner);
    setTimeout(resumeFrom('$signal'), 0);
  };
  setTimeout(resumeFrom('initial setTimeout'), 0);
  return $signal;
}

(self.coroutineLoadHandlers || []).forEach(function(handler) { setTimeout(handler, 0); });

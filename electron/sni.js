var fs = require('fs');
var os = require('os');
var path = require('path');
var tls = require('tls');
var util = require('util');
var spawn = require('child_process').spawn;


var tmpdir = os.tmpdir();

var key = fs.readFileSync('telepod.key.pem');
var keyPath = fs.realpathSync('telepod.key.pem');
var caPath = fs.realpathSync('telepod.ca.pem');

function Cache(capacity) {
  this._capacity = util.isNumber(capacity) ? capacity : 120;
  this._purgeNum = Math.floor(this._capacity / 3);
  this._cache = new Map();
}

Cache.prototype.get = function(key) {
  var hit = this._cache.get(key);
  if (hit) {
    hit.fresh = Date.now();
    return hit.value;
  }
  return null;
};

Cache.prototype.set = function(key, value) {
  this._cache.set(key, {value: value, fresh: Date.now()});
  if (this._cache.size > this._capacity) {
    var pairs = [];
    this._cache.forEach(function(value, key) {
      pairs.push({key: key, value: value})
    });

    pairs.sort(function(a, b) {
      var af = a.value.fresh;
      var bf = b.value.fresh;
      return af - bf;
    });

    for (var i = 0; i < this._purgeNum; i++) {
      this._cache.delete(pairs[i].key);
    }
  }
};

var secureContextCache = new Cache();

function createCSR(hostname, callback) {
  var subj = '/C=CN/ST=Solar System/L=Earth/O=Telepod Electron Empire/OU=Telepod Electron Unit/CN=' + hostname;
  var args = ['req', '-new', '-sha256', '-key', keyPath, '-subj', subj];

  var openssl = spawn('openssl', args);
  var csrPath = path.join(tmpdir, Date.now() + '_' + openssl.pid);
  var stream = fs.createWriteStream(csrPath);
  var stderr = [];

  openssl.stdout.pipe(stream);
  openssl.stderr.on('data', function(data) {
    stderr.push(data.toString());
  });

  openssl.on('close', function(code, signal) {
    if (code === 0) {
      callback(null, csrPath);
    } else {
      fs.unlink(csrPath, function(ignoreError) {});
      var messageTemplate = 'Fail to create CSR for: %s Invalid openssl exit code: %d signal: %s error: %s';
      callback(new Error(util.format(messageTemplate, hostname, code, signal, stderr.join(''))));
    }
  });
}

function signCSR(csrPath, callback) {
  var args = ['x509', '-req', '-sha256', '-in', csrPath, '-CA', caPath, '-CAkey', keyPath, '-days', 3650, '-set_serial', Date.now()];

  var openssl = spawn('openssl', args);
  var stdout = [];
  var stderr = [];

  openssl.stdout.on('data', function(data) {
    stdout.push(data);
  });
  openssl.stderr.on('data', function(data) {
    stderr.push(data)
  });

  openssl.on('close', function(code, signal) {
    fs.unlink(csrPath, function(ignoreError) {});
    if (code === 0) {
      var cert = Buffer.concat(stdout);
      callback(null, cert);
    } else {
      var messageTemplate = 'Fail to sign CSR: %s Invalid openssl exit code: %d signal: %s error: %s';
      callback(new Error(util.format(messageTemplate, csrPath, code, signal, stderr.join(''))));
    }
  });
}

function createCert(hostname, callback) {
  createCSR(hostname, function(err, csrPath) {
    if (err) {
      callback(err);
    } else {
      signCSR(csrPath, callback);
    }
  });
}

var SNICallbackFunc = function(hostname, callback) {
  var ctx = secureContextCache.get(hostname);
  if (ctx) {
    callback(null, ctx);
  } else {
    createCert(hostname, function(err, cert) {
      if (!err) {
        var details = {key: key, cert: cert};
        var ctx = tls.createSecureContext(details);
        callback(null, ctx);
        secureContextCache.set(hostname, ctx);
      } else {
        callback(err);
      }
    });
  }
};

exports.SNICallbackFunc = SNICallbackFunc;


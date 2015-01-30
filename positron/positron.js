var http = require('http');
var https = require('https');
var util = require("util");
var stream = require('stream');
var crypto = require('crypto');
var zlib = require('zlib');
var logger = require('./logger');


var algorithm = 'aes128';
var password = 'telepod';

var port = process.env.PORT || 3000;
var host = process.env.IP || '127.0.0.1';


function DarkMatter(options) {
  if (!(this instanceof DarkMatter)) {
    return new DarkMatter(options);
  }

  stream.Transform.call(this, options);
  this._decipher = crypto.createDecipher(algorithm, password);
  this._bytesMetaNeeded = undefined;
  this._metadata = [];
}

util.inherits(DarkMatter, stream.Transform);

DarkMatter.prototype._transform = function(chunk, encoding, callback) {
  var buf = this._decipher.update(chunk);

  if (this._bytesMetaNeeded === undefined) {
    this._bytesMetaNeeded = buf.readUInt32BE(0);
    buf = buf.slice(4)
  }

  if (this._bytesMetaNeeded > 0) {
    var meta = buf.slice(0, this._bytesMetaNeeded);
    this._metadata.push(meta.toString());

    this._bytesMetaNeeded -= meta.length;
    if (this._bytesMetaNeeded == 0) {
      this._emitMetadata();

      if (buf.length - meta.length > 0) {
        this.push(buf.slice(meta.length));
      }
    }
  } else {
    this.push(buf);
  }

  callback();
};

DarkMatter.prototype._flush = function(callback) {
  var data = this._decipher.final();
  if (this._bytesMetaNeeded > 0) {
    this._metadata.push(data);
    this._emitMetadata();
  } else {
    this.push(data);
  }

  callback();
};

DarkMatter.prototype._emitMetadata = function() {
  try {
    var metadata = JSON.parse(this._metadata.join(''));
    this.emit('metadata', metadata);
  } catch (err) {
    this.emit('error', new Error('invalid metadata'));
  }
};


var app = http.createServer(function(req, res) {
  var url = req.url;
  if (/^\/_portal/.test(url)) {
    var request;
    var darkMatter = new DarkMatter();
    darkMatter.on('metadata', function(metadata) {
      logger.debug(metadata);
      var options = {
        hostname: metadata.headers.host,
        path: metadata.url,
        method: metadata.method,
        headers: metadata.headers
      };
      var client = metadata.scheme === 'https' ? https : http;
      request = client.request(options, function(response) {
        res.statusCode = response.statusCode;
        var headers = response.headers;
        for (var name in headers) {
          if (headers.hasOwnProperty(name)) {
            res.setHeader(name, headers[name]);
          }
        }
        response.pipe(res);
      });
      var requestInfo = util.format('%s: %s://%s%s', options.method, metadata.scheme, options.hostname, options.path);
      request.on('error', function(err) {
        logger.error('%s with error: ', requestInfo, err);
        req.socket.destroy();
      });
      darkMatter.pipe(request);
    });

    var decompress = zlib.createGunzip();
    req.pipe(decompress).pipe(darkMatter);
  } else if (/^\/$/.test(url)) {
    res.statusCode = 200;
    res.end('Hello Telepod!');
  } else {
    res.statusCode = 404;
    res.end('404 Not Found.');
  }
});

app.on('clientError', function(exception, socket) {
  socket.destroy();
  logger.error('clientError:', exception);
});

app.listen(port, host, function() {
  var slogan = '';
  slogan += '=============================================================\n';
  slogan += '  App Listening on: %s:%d\n';
  slogan += '=============================================================\n';
  logger.log(slogan, host, port);
});

process.on('uncaughtException', function(err) {
  logger.error('Exception: ' + err.stack);
});

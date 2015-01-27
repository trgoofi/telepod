var http = require('http');
var https = require('https');
var util = require("util");
var events = require("events");
var crypto = require('crypto');
var logger = require('./logger');


var algorithm = 'aes128';
var password = 'telepod';

var port = process.env.PORT || 3000;
var host = process.env.IP || '127.0.0.1';


function DarkMatter() {
  events.EventEmitter.call(this);
  this._decipher = crypto.createDecipher(algorithm, password);
  this._bytesMetaNeeded = undefined;
  this._metadata = [];
}

util.inherits(DarkMatter, events.EventEmitter);

DarkMatter.prototype.parse = function(data) {
  var buf = this._decipher.update(data);

  if (this._bytesMetaNeeded === undefined) {
    this._bytesMetaNeeded = buf.readUInt32BE(0);
    buf = buf.slice(4)
  }

  if (this._bytesMetaNeeded > 0) {
    var meta = buf.slice(0, this._bytesMetaNeeded);
    this._metadata.push(meta.toString());

    this._bytesMetaNeeded -= meta.length;
    if (this._bytesMetaNeeded == 0) {
      this.emit('metadata', this._metadata.join(''));

      if (buf.length - meta.length > 0) {
        this.emit('data', buf.slice(meta.length))
      }
    }
  } else {
    this.emit('data', buf);
  }
};

DarkMatter.prototype.end = function() {
  var data = this._decipher.final();
  if (this._bytesMetaNeeded > 0) {
    this._metadata.push(data);
    this.emit('metadata', this._metadata.join(''));
  } else {
    this.emit('data', data);
  }
  this.emit('end');
};

var app = http.createServer(function(req, res) {
  var url = req.url;
  if (/^\/_portal/.test(url)) {
    var request;
    var darkMatter = new DarkMatter();
    darkMatter.on('metadata', function(metadata) {
      metadata = JSON.parse(metadata);
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
    });
    darkMatter.on('data', function(data) {
      request.write(data);
    });
    darkMatter.on('end', function() {
      request.end();
    });

    req.on('data', function(chunk) {
      darkMatter.parse(chunk);
    });
    req.on('end', function() {
      darkMatter.end();
    });
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

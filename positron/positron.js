var http = require('http');
var https = require('https');
var util = require("util");
var zlib = require('zlib');
var logger = require('./logger');
var dm = require('./darkmatter');


var algorithm = 'aes128';
var password = 'telepod';

var port = process.env.PORT || 3000;
var host = process.env.IP || '127.0.0.1';


var app = http.createServer(function(req, res) {
  var url = req.url;
  if (/^\/_portal/.test(url)) {
    var darkMatter = dm.createDarkMatter({algorithm: algorithm, password: password});
    darkMatter.on('metadata', function(metadata) {
      logger.debug(metadata);
      var options = {
        hostname: metadata.headers.host,
        path: metadata.url,
        method: metadata.method,
        headers: metadata.headers
      };
      var client = metadata.scheme === 'https' ? https : http;
      var request = client.request(options, function(response) {
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

var util = require('util');

function prefixOf(level) {
  var date = new Date();
  var prefix = util.format('[%s] %s: ', date.toISOString(), level);
  return prefix;
}

function log() {
  process.stdout.write(util.format.apply(this, arguments) + '\n');
}

function error() {
  process.stderr.write(prefixOf('ERROR') + util.format.apply(this, arguments) + '\n');
}

function warn() {
  process.stderr.write(prefixOf('WARN') + util.format.apply(this, arguments) + '\n');
}

function info() {
  process.stdout.write(prefixOf('INFO') + util.format.apply(this, arguments) + '\n');
}

function debug() {
  process.stdout.write(prefixOf('DEBUG') + util.format.apply(this, arguments) + '\n');
}

exports.log = log;
exports.error = error;
exports.warn = warn;
exports.info = info;
exports.debug = debug;
var stream = require('stream');
var crypto = require('crypto');
var util = require("util");


function DarkMatter(options) {
  if (!(this instanceof DarkMatter)) {
    return new DarkMatter(options);
  }

  stream.Transform.call(this, options);
  this._decipher = crypto.createDecipher(options.algorithm, options.password);
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

exports.createDarkMatter = function(options) {
  return new DarkMatter(options);
}
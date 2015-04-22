var fs = require('fs');
var path = require('path');


var src = path.join(__dirname, 'build/Release/hadron.node');
var dest = path.join(__dirname, 'hadron-' + process.platform + '-' + process.arch + '.node');

console.log('Deploy: [%s] as [%s]', src, dest);
fs.createReadStream(src).pipe(fs.createWriteStream(dest));

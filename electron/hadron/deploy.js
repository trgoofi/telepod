var fs = require('fs');


var src = './build/Release/hadron.node';
var dest = 'hadron-' + process.platform + '-' + process.arch + '.node';

fs.createReadStream(src).pipe(fs.createWriteStream(dest));

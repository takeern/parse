const fs = require('fs');
const debug = require('debug')('parse: io');
console.log(__dirname);
const r = fs.createReadStream('/Users/takeern/work/biliPlayer/parse/sei_test1.flv');
r.on('data', (chunk) => {
    console.log(chunk);
    r.pause();
});
r.on('end', () => console.log('end'));
r.on('error', (e) => console.log(e));
class Loader {
}
//# sourceMappingURL=loader.js.map
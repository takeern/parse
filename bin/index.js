#!/usr/bin/env node



const program = require('commander');
const package = require('../package.json');
program
  .version(package.version)
  .option('-p, --path', 'input parse video local path')  
  .option('-v, --showVideo', 'only showVideo frame')
  .option('-a, --showAudio', 'only showAudio frame')
  .option('-l, --length', 'show frame max length')
  .option('-w, --showWeb', 'show parse data in web');
  program.on('--help', function(){  
        const codeHelp = [
            {
                code: '--path -p',
                desc: 'input parse video local path',
                example: '--path=../test.flv , -p ../test.flv'
            },
            {
                code: '--showVideo -v',
                desc: 'input parse video local path',
                example: '--showVideo=false , -v false'
            },
            {
                code: '--showAudio -a',
                desc: 'input parse Audio local path',
                example: '--showAudio=false , -a false'
            },
            {
                code: '--length -l',
                desc: 'show flv tag max length',
                example: '--length=100 , -v 100'
            },
            {
                code: '--help -h',
                desc: 'help example',
                example: ''
            },
            {
                code: '--showWeb -w',
                desc: 'show parse data in web',
                example: '--showWeb=true, -w=true'
            },
        ];
        console.table(codeHelp);
  });

  program.parse(process.argv);




const Parse = require('../dist/index').default;

new Parse({
    path: program.path,
    showVideo: program.showVideo,
    showAudio: program.showAudio,
    length: program.length,
    showWeb: program.showWeb,
});
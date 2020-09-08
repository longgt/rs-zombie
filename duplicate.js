#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { parse, parseLines, stringify } = require('dot-properties');
const glob = require("glob");
const cliProgress = require('cli-progress');
const colors = require('colors');
 
const cwd = process.cwd();
const resourcesDir = path.join(cwd, 'resources');
const literalCaches = {};

function main() {
	glob("**/*.properties", {cwd: resourcesDir, root: path.resolve(resourcesDir, "/"), ignore: '**/{node_modules,www,target,build,dist}/**' }, function (er, resourceFiles) {
	  if (resourceFiles && resourceFiles.length > 0) {
		// create a new progress bar instance and use shades_classic theme
		const bar = new cliProgress.Bar({ 
		  format: '[{bar}] {percentage}% | {value}/{total} | ' + colors.green('{file}'),
		  stream: process.stdout,
		}, cliProgress.Presets.shades_classic);	  
	      // start the progress bar with a total value of 200 and start value of 0
	      bar.start(resourceFiles.length, 0, { file: '<none>' });
			 
		  for (let i = 0; i < resourceFiles.length; i++) {
		      const rsFile = resourceFiles[i];
			  const src = fs.readFileSync(path.resolve(resourcesDir, rsFile), 'utf8');
			  const obj = parse(src);
			  const keys = Object.keys(obj).map(key => key.trim());

			  for (let key of keys) {
			    const value = (obj[key] || '').trim();
			    let cacheObj = literalCaches[value] || {};
			    let fileArr = cacheObj.files || [];
			    fileArr.push({ file: rsFile, key });
			    cacheObj.files = fileArr;
			    literalCaches[value] = cacheObj;
			  }

			  // update the current value in your application..
			  bar.update(i + 1, { file: rsFile });
		  }

			const keys = Object.keys(literalCaches);
			let duplicateArr = [];
			for (let key of keys) {
				let cacheObj = literalCaches[key] || {};
			    let fileArr = cacheObj.files || [];
			    if (fileArr.length > 1) {
			      fileArr.sort((a, b) => {
			        let fileDiff = a.file - b.file;
			        
			        if (fileDiff == 0) {
			          return a.key - b.key;
			        }
			        
			        return fileDiff;
			      });
			      duplicateArr.push({literal: key, count: fileArr.length, files: fileArr});
			    }
			}
			if (duplicateArr.length > 0) {
			  duplicateArr.sort((a, b) => b.files.length - a.files.length);
			  fs.writeFileSync('duplicate.json', '\ufeff' + JSON.stringify(duplicateArr, null, 4), 'utf8');
			}
			// stop the progress bar
			bar.stop();	           
	  }  
	});
}

main();

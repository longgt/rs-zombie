#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { parse, parseLines, stringify } = require('dot-properties');
const glob = require("glob");
const cliProgress = require('cli-progress');
const colors = require('colors');
const cwd = process.cwd();
const resourcesDir = path.join(cwd, 'resources');
let fileCaches = {};
let keyZoombies = {};
let _state = {};

function main() {
    // create a new progress bar instance and use shades_classic theme
    const bar = new cliProgress.Bar({
        format: '[{bar}] {percentage}% | {value}/{total} | elapsed: ' + colors.bold('{time}') + '(s) | ' + colors.green('{file}'),
        stream: process.stdout,
        barsize: 20
    }, cliProgress.Presets.shades_classic);

    // options is optional
    const startTime = new Date().getTime();
    bar.start(9999, 0, { time: 0, file: '<none>' });

    _state = { index: 0, startTime };

    let update = (state) => {
        bar.update(state.index, { file: (state.file ? state.file : '<none>'), time: Math.round((new Date().getTime() - state.startTime) / 1000) });
	};
	
	update(_state);
    glob("**/*.{java,xhtml,html,js,jsp,json,ftl}", { cwd: cwd, root: path.resolve(cwd, "/"), ignore: '**/{node_modules,www,target,build,dist}/**' }, (pathErr, files) => {
		update(_state);
		glob("**/*.properties", { cwd: resourcesDir, root: path.resolve(resourcesDir, "/"), ignore: '**/{node_modules,www,target,build,dist}/**' }, (propErr, resourceFiles) => {
            let zombiesArr = [];

            if (resourceFiles && resourceFiles.length > 0) {
                // start the progress bar with a total value of 200 and start value of 0
                bar.setTotal(resourceFiles.length);
				update(_state);

                const fileLength = files.length;
                let cacheKeys = [];

                for (let i = 0; i < resourceFiles.length; i++) {
                    const rsFile = resourceFiles[i];
                    const src = fs.readFileSync(path.resolve(resourcesDir, rsFile), 'utf8');
                    const obj = parse(src);
                    const keys = Object.keys(obj).map(key => key.trim());
					update(_state);
					
                    let zombies = [...keys].filter(x => !cacheKeys.includes(x));

                    if (files && files.length > 0) {
                        for (let index = 0; index < fileLength; index++) {
                            zombies = findInFile(files[index], zombies);
                            
                            if (zombies.length === 0) {
                              break;
                            }
                            update(_state);
                        }
                    } else {
                        zombies = [];
                    }
                    if (zombies.length > 0) {
                        for (const key of zombies) {
                            keyZoombies[key] = key;
                        }

                        zombiesArr.push({ file: rsFile, keys: zombies });
                    }
                    
                    cacheKeys = [...keys].filter(x => !zombies.includes(x));
                    // update the current value in your application..
                    _state.index = i + 1;
					_state.file = rsFile;
					update(_state);
                }                
            }
            if (zombiesArr.length > 0) {
                fs.writeFileSync('zombies.json', JSON.stringify(zombiesArr, null, 4), 'utf8');
			}
			
			update(_state);

            // empty cache
            emptyCache();

            // stop the progress bar
            bar.stop();
        });
    });
}

function emptyCache() {
    fileCaches = {};
	keyZoombies = {};
	_state = {};
}

function findInFile(file, keys) {
    const zombies = [...keys];
    try {
        let data = fileCaches[file];

        if (!data) {
            data = fs.readFileSync(path.resolve(cwd, file), 'utf8');
            fileCaches[file] = data;
        }

        for (const key of keys) {
            const zombieIndex = zombies.indexOf(key);
            const alreadyZombie = zombieIndex !== -1;

            if (keyZoombies[key]) {
                if (!alreadyZombie) zombies.push(key);
                continue;
            }
            if (key.startsWith('javax.faces') || key.startsWith('org.jboss')) {
                if (alreadyZombie) {
                    zombies.splice(zombieIndex, 1);
                }

                continue;
            }
            const found = data.indexOf(key) !== -1;

            if (!found && !alreadyZombie) {
                zombies.push(key);
            }
            if (found && alreadyZombie) {
                zombies.splice(zombieIndex, 1);
            }
        }
    } catch (err) {
        console.error('error while reading file: ' + file, err);
    }

    return zombies;
}

main();
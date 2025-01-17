const ExpoConfig = require('@expo/config');
const path = require('path');
const fs = require("fs");

const projectDir = path.join(__dirname, '..');

const { exp } = ExpoConfig.getConfig(projectDir, {
    skipSDKVersionRequirement: true,
    isPublicConfig: true,
});

const appJsonPath = path.resolve(`${projectDir}/app.json`);
const appJsonBuffer = fs.readFileSync(path.resolve(appJsonPath), null);
const appJson = JSON.parse(appJsonBuffer.toString('utf-8'));

appJson.expo = deepMerge(appJson.expo, exp);

console.log(JSON.stringify(appJson, null, '  '));

//**********************************************
//* Source: https://medium.com/@abbas.ashraf19/8-best-methods-for-merging-nested-objects-in-javascript-ff3c813016d9#30b6
//**********************************************
function deepMerge(obj1, obj2) {
  for (let key in obj2) {
    if (obj2.hasOwnProperty(key)) {
      if (obj2[key] instanceof Object && obj1[key] instanceof Object) {
        obj1[key] = deepMerge(obj1[key], obj2[key]);
      } else {
        obj1[key] = obj2[key];
      }
    }
  }
  return obj1;
}

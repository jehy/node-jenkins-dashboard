# Node Jenkins dashboard

[![Build Status](https://travis-ci.org/jehy/node-jenkins-dashboard.svg?branch=master)](https://travis-ci.org/jehy/node-jenkins-dashboard)
[![dependencies Status](https://david-dm.org/jehy/node-jenkins-dashboard/status.svg)](https://david-dm.org/jehy/node-jenkins-dashboard)
[![devDependencies Status](https://david-dm.org/jehy/node-jenkins-dashboard/dev-status.svg)](https://david-dm.org/jehy/node-jenkins-dashboard?type=dev)

Shows current state of all projects on all environments and servers based on jenkins logs.
This code has some customizations which you should edit or remove before usage.

## Installation
```bash
npm install git+ssh://git@github.com:jehy/node-jenkins-dashboard.git
```

## Usage
**config.json**
```json
{
  "port": 8000,
  "maxBuilds": 40,
  "cacheFile": "cache/data.json",
  "cacheTime": 10,
  "jenkins": {
    "baseUrl": "https://username:password@jenkins.domain.ru",
    "crumbIssuer": true,
    "promisify": true
  }
}
```
## Config parameters
* `port` - web service port
* `maxBuilds` - how many build to index in job history
* `cacheTime` - cache time for data in minutes
* `jenkins` - data for connection to jenkins
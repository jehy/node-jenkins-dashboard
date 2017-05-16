# Node Jenkins dashboard

[![Build Status](https://travis-ci.org/jehy/node-jenkins-dashboard.svg?branch=master)](https://travis-ci.org/jehy/node-jenkins-dashboard)
[![dependencies Status](https://david-dm.org/jehy/node-jenkins-dashboard/status.svg)](https://david-dm.org/jehy/node-jenkins-dashboard)
[![devDependencies Status](https://david-dm.org/jehy/node-jenkins-dashboard/dev-status.svg)](https://david-dm.org/jehy/node-jenkins-dashboard?type=dev)

Shows current state of all projects on all environments and servers based on jenkins logs.

It also provides links to projects, branches and commits from gitlab (in case gitlab project
 names are equal to jenkins project names).
 
This code uses some custom jenkins parameters which you should edit or remove before usage
 (team, project, commit, author, branch, some formatting).

![Dashboard looks liek this](dashboard.png?raw=true "Dashboard")

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
  "cacheDir": "cache",
  "cacheTime": 10,
  "taskFilter":"деплоя приложений",
  "crawl":
  {
    "delayMin":10,
    "delayMax":5000
  },
  "jenkins": {
    "baseUrl": "https://username:password@jenkins.domain.ru",
    "crumbIssuer": true,
    "promisify": true
  },
  "gitlab": {
    "url": "https://gitlab.domain.ru",
    "token": "yyr8***AAxydd***Gvxu"
  }
}
```
## Config parameters
* `port` - web service port
* `maxBuilds` - how many build to index in job history
* `cacheTime` - cache time for data in minutes
* `jenkins` - data for connection to jenkins
* `taskFilter` - show only tasks which contain `taskFilter` string
* `crawl` - min and max delay for asking jenkins to avoid jenkins overload
* `gitlab` - gitlab connection data for fetching links to branches, commits and projects
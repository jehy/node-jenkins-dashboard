/* eslint-disable no-console*/
const Jenkins = require('jenkins'),
      Promise = require('bluebird'),
      fs      = require('fs-extra'),
      config  = require('../config/default.json'),
      jenkins = Jenkins(config.jenkins),
      Gitlab  = require('gitlab'),
      gitlab  = Gitlab(config.gitlab);

let gitlabProjects = [];
// Listing projects
function getGitlabProjects() {
  return new Promise((resolve, reject)=> {
      gitlab.projects.all(function (projects) {
        projects = projects.map(function (project) {
          return {
            name: project.name.toLowerCase().replace('pmv3-', '').replace('-app', '').replace('api', ''),
            url: project.web_url,
            fullName: project.name_with_namespace.toLowerCase()
          }
        });
        resolve(projects);
      })
    }
  )
}

function getRandomIntInclusive(min, max) {
  const minValue = Math.ceil(min);
  const maxValue = Math.floor(max);
  return Math.floor(Math.random() * (maxValue - minValue + 1)) + minValue;
}

function PromiseRandomDelay() {
  return Promise.delay(getRandomIntInclusive(config.crawl.delayMin, config.crawl.delayMax));
}

function getJobData(job) {
  return PromiseRandomDelay()
    .then(()=>jenkins.job.get(job.name))
    .then((jobData)=> {
      const promisesArray = [];
      let minBuild = jobData.lastBuild.number - config.maxBuilds;
      if (minBuild < 1) {
        minBuild = 1;
      }
      for (let i = jobData.lastBuild.number; i > minBuild; i--) {
        const getBuildInfo = PromiseRandomDelay()
          .then(()=>jenkins.build.get(job.name, i))
          .catch((err)=> {
            console.log(`Warning: ${err}`);
          });
        promisesArray.push(getBuildInfo);
      }
      return Promise.all(promisesArray);
    })
    .then((allBuildData)=> {
      const currentState = {};
      allBuildData.forEach((buildData)=> {
        const params = {};
        if (buildData === undefined || buildData.actions === undefined ||
          buildData.actions[0] === undefined || buildData.actions[0].parameters === undefined) {
          return;
        }
        buildData.actions[0].parameters.forEach((param)=> {
          params[param.name] = param.value;
        });
        // console.log(params);
        let team;
        if (params.team === undefined && params.index === undefined) {
          team = 'no team';
        }
        else {
          team = params.team + params.index;
        }
        let project;
        if (params.project === undefined) {
          project = 'no project';
        }
        else {
          project = params.project;
        }
        currentState[job.name] = currentState[job.name] || {};
        currentState[job.name][team] = currentState[job.name][team] || {};
        if (currentState[job.name][team][project] === undefined || currentState[job.name][team][project].timestamp < buildData.timestamp) {
          currentState[job.name][team][project] = {
            id: buildData.id,
            url: buildData.url,
            result: buildData.result,
            timestamp: buildData.timestamp,
            branch: params.branch,
            user: params.user,
          };
        }
      });
      return currentState;
    });
}

function updateDataFromJenkins() {
  console.log('fetching jobs');
  return jenkins.job.list()
    .then((data)=> {
      let filteredJobs = data;
      if (config.taskFilter !== undefined && config.taskFilter.length > 1) {
        filteredJobs = data.filter((job)=> {
          return job.name.indexOf(config.taskFilter) !== -1;
        });
      }
      const ProcessPromises = filteredJobs.map(getJobData);
      return Promise.all(ProcessPromises);
    })
    .then((currentState)=> {
      console.log('fetching logs for last builds');
      const getLogPromises = [];
      currentState.forEach((jobData)=> {
        Object.keys(jobData).forEach((jobName)=> {
          const teamData = (jobData[jobName]);
          Object.keys(teamData).forEach((teamName)=> {
            const projectData = (teamData[teamName]);
            Object.keys(projectData).forEach((projectName)=> {
              const buildData = (projectData[projectName]);
              const getLogPromise = PromiseRandomDelay()
                .then(()=>jenkins.build.log(jobName, buildData.id))
                .then((logData)=> {
                  // buildData.log = logData; //.substr(0,50); // no need for full log

                  // get corresponding gitlab project
                  let thisGitlabProject = null;
                  gitlabProjects.forEach((project)=> {
                    if (project.name === projectName && (project.fullName.indexOf('legacy') === -1)) {
                      thisGitlabProject = project;
                    }
                  });
                  // set corresponding gitlab project urls
                  if (thisGitlabProject != null) {
                    buildData.projectUrl = thisGitlabProject.url;
                    buildData.branchUrl = `${thisGitlabProject.url}/tree/${buildData.branch}`;
                  }

                  // get user and commit from log
                  let pos = logData.indexOf("\n");
                  buildData.user = logData.substr(0, pos).replace('Started by user', '').trim();
                  const searchString = '== `Branch';
                  pos = logData.indexOf(searchString);
                  if (pos === -1) {
                    return;
                  }
                  const searchString2 = '(at ';
                  pos = logData.indexOf(searchString2, pos);
                  buildData.commit = logData.substr(pos + searchString2.length, 7);
                  // set commit log
                  if (thisGitlabProject != null) {
                    buildData.commit = `<a href="${thisGitlabProject.url}/commits/${buildData.commit}">${buildData.commit}</a>`
                  }
                });
              getLogPromises.push(getLogPromise);
            });
          });
        });
      });
      return Promise.all(getLogPromises).then(()=> {
        return currentState;
      });
    })
    .then((currentState)=> {
      console.log('finished');
      fs.writeJson(config.cacheFile, currentState);
      return (currentState);
      // console.log(JSON.stringify(currentState, null, 3));
    })
    .catch((err)=> {
      console.log('Error: ');
      console.log(err);
    });
}
module.exports = (app)=> {
  app.post('/get', (req, res) => {
    fs.stat(config.cacheFile)
      .then((fileDate)=> {
        const cacheAge = (new Date().getTime() - fileDate.mtime.getTime());
        if (cacheAge < config.cacheTime * 1000 * 60) {
          return fs.readJson(config.cacheFile)
            .then((cacheObject)=> {
              res.send(cacheObject);
            });
        }
        console.log(`Cache file too old (${cacheAge / 1000 / 60} minutes), updating cache`);
        throw new Error('reloading cache');
      }).catch((e)=> {
      console.log(`Warning: ${e}`);
      console.log('fetching gitlab projects');
      getGitlabProjects()
        .then((projects)=>gitlabProjects = projects)
        .then(()=>updateDataFromJenkins())
        .then((data)=> {
          res.send(data);
        });
    });
  });

};

/* eslint-disable no-console*/
const Jenkins = require('jenkins'),
      Promise = require('bluebird'),
      fs      = require('fs-extra'),
      config  = require('../config/default.json'),
      jenkins = Jenkins(config.jenkins),
      Gitlab  = require('gitlab'),
      gitlab  = Gitlab(config.gitlab),
      json    = require('json-promise');


let gitlabProjects = [];
// Listing projects
function getGitlabProjects() {
  return new Promise((resolve, reject)=> {
    gitlab.projects.all((projects)=> {
      projects = projects.map((project)=> {
        return {
          name: project.name.toLowerCase().replace('pmv3-', '').replace('-app', '').replace('api', ''),
          url: project.web_url,
          id: project.id,
          fullName: project.name_with_namespace.toLowerCase(),
        };
      });
      resolve(projects);
    });
  });
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
      for (let jobId = jobData.lastBuild.number; jobId > minBuild; jobId--) {
        const cacheFilePath = `${config.cacheDir}/${job.name}_${jobId}.json`;
        const getBuildInfo = fs.readJson(cacheFilePath)
          .catch(()=> { // no cache file for job exists
            console.log(`no cache found for ${cacheFilePath}`);
            return PromiseRandomDelay()
              .then(()=>jenkins.build.get(job.name, jobId))
              .then((fetchedJobData)=> {
                fs.writeJson(cacheFilePath, fetchedJobData);
                return fetchedJobData;
              })
              .catch((err)=> {
                console.log(`Warning: ${err}`);
              });
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
  const jenkinsProject2gitlabProject = [];
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
    .then((projectInfo1)=> {
      console.log('fetching logs for last builds');
      const getLogPromises = [];
      projectInfo1.forEach((jobData)=> {
        Object.keys(jobData).forEach((jobName)=> {
          const teamData = (jobData[jobName]);
          Object.keys(teamData).forEach((teamName)=> {
            const projectData = (teamData[teamName]);
            Object.keys(projectData).forEach((projectName)=> {
              const buildData = (projectData[projectName]);
              const cacheFilePath = `${config.cacheDir}/${jobName}_${buildData.id}_log.json`;
              const getLogPromise = fs.readFile(cacheFilePath, 'utf8')
                .catch(()=> { // no cache file for job exists
                  console.log(`no cache found for ${cacheFilePath}`);
                  return PromiseRandomDelay()
                    .then(()=> {
                      return jenkins.build.log(jobName, buildData.id);
                    })
                    .then((logData)=> {
                      fs.writeFile(cacheFilePath, logData);
                      return logData;
                    });
                })
                .then((logData)=> {
                  // buildData.log = logData; //.substr(0,50); // no need for full log

                  // get corresponding gitlab project
                  let thisGitlabProject = null;
                  gitlabProjects.forEach((project)=> {
                    if (project.name === projectName && (project.fullName.indexOf('legacy') === -1)) {
                      thisGitlabProject = project;
                    }
                  });

                  // get gitlab project data from log

                  if (thisGitlabProject == null) {
                    const gitlabData = logData.match(new RegExp('--heads git(.*?):(.*?)/(.*?).git'));
                    // console.log(`gitlabData: ${gitlabData}`);
                    if (gitlabData !== null) {
                      gitlabProjects.forEach((project)=> {
                        // console.log(`${project.name} vs ${gitlabData[3]}`);
                        if (project.name === gitlabData[3] && (project.fullName.indexOf('legacy') === -1)) {
                          thisGitlabProject = project;
                          // console.log('\n\nproject found\n\n');
                        }
                      });
                    }
                  }
                  if (thisGitlabProject != null) {
                    jenkinsProject2gitlabProject[projectName] = thisGitlabProject;
                  }
                  // get user from log
                  let pos = logData.indexOf('\n');
                  buildData.user = logData.substr(0, pos).replace('Started by user', '').trim();

                  // get commit from log
                  const searchString = '== `Branch';
                  pos = logData.indexOf(searchString);
                  if (pos === -1) {
                    return null;
                  }
                  const searchString2 = '(at ';
                  pos = logData.indexOf(searchString2, pos);
                  buildData.commit = logData.substr(pos + searchString2.length, 7);
                  return null;
                });
              getLogPromises.push(getLogPromise);
            });
          });
        });
      });
      return Promise.all(getLogPromises)
        .then(()=> {
          return projectInfo1;
        });
    })
    .then((projectInfo2)=> {
      const getVersionPromises = [];
      projectInfo2.forEach((jobData)=> {
        Object.keys(jobData).forEach((jobName)=> {
          const teamData = (jobData[jobName]);
          Object.keys(teamData).forEach((teamName)=> {
            const projectData = (teamData[teamName]);
            Object.keys(projectData).forEach((projectName)=> {
              const thisGitlabProject = jenkinsProject2gitlabProject[projectName];
              const buildData = (projectData[projectName]);

              // set corresponding gitlab project urls
              if (thisGitlabProject == null || !buildData.branch || !buildData.commit) {
                return;
              }
              buildData.projectUrl = thisGitlabProject.url;
              buildData.branchUrl = `${thisGitlabProject.url}/tree/${buildData.branch}`;


              buildData.commitUrl = `${thisGitlabProject.url}/commits/${buildData.commit}`;

              // get version info
              const getVersionPromise = PromiseRandomDelay()
                // .timeout(5000)
                .then(()=> {
                  return new Promise((resolve, reject)=> {
                    gitlab.projects.repository.showFile({
                      projectId: thisGitlabProject.id,
                      ref: buildData.commit,
                      file_path: 'package.json',
                    }, (file)=> {
                      // console.log;
                      // console.log("=== File ===");
                      // console.log(file);
                      if (file) {
                        resolve((new Buffer(file.content, 'base64')).toString());
                      }
                      else reject(new Error(`could not get package.json file for ${projectName}`));
                    });
                  });
                })
                .then((content)=> {
                  return json.parse(content);
                })
                .then((packageObject)=> {
                  buildData.version = packageObject.version;
                })
                .catch((err)=> {
                  console.log(`Warning: ${err.toString()}`);
                });
              getVersionPromises.push(getVersionPromise);
            });
          });
        });
      });
      return Promise.all(getVersionPromises)
        .then(()=> {
          return projectInfo2;
        });
    })
    .then((projectInfo3)=> {
      console.log('finished');
      const cacheFile = `${config.cacheDir}/data.json`;
      fs.writeJson(cacheFile, projectInfo3);
      return (projectInfo3);
      // console.log(JSON.stringify(currentState, null, 3));
    })
    .catch((err)=> {
      console.log('Error: ');
      console.log(err);
    });
}
module.exports = (app)=> {
  const cacheFile = `${config.cacheDir}/data.json`;
  app.post('/get', (req, res) => {
    fs.stat(cacheFile)
      .then((fileDate)=> {
        const cacheAge = (new Date().getTime() - fileDate.mtime.getTime());
        if (cacheAge < config.cacheTime * 1000 * 60) {
          return fs.readJson(cacheFile)
            .then((cacheObject)=> {
              console.log('Loading data from cache');
              res.send(cacheObject);
            });
        }
        console.log(`Cache file too old (${cacheAge / 1000 / 60} minutes), updating cache`);
        throw new Error('reloading cache');
      }).catch((e)=> {
      console.log(`Warning: ${e}`);
      console.log('fetching gitlab projects');
      getGitlabProjects()
        .then((projects)=> {
          gitlabProjects = projects;
          return null;
        })
        .then(()=>updateDataFromJenkins())
        .then((data)=> {
          res.send(data);
        });
    });
  });

};

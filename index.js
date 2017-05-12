const Jenkins = require('jenkins'),
      Promise = require('bluebird'),
      config  = require('./config/default.json'),
      jenkins = Jenkins(config.jenkins);

function getJobData(job) {
  return jenkins.job.get(job.name)
    .then((jobData)=> {
      let promisesArray = [];
      let minBuild = jobData.lastBuild.number - config.maxBuilds;
      if (minBuild < 1) {
        minBuild = 1;
      }
      for (let i = jobData.lastBuild.number; i > minBuild; i--) {
        let getBuildInfo = jenkins.build.get(job.name, i)
          .catch((err)=> {
            console.log('Warning: ' + err)
          });
        promisesArray.push(getBuildInfo);
      }
      return Promise.all(promisesArray);
    })
    .then((allBuildData)=> {
      let currentState = {};
      allBuildData.forEach((buildData)=> {
        //console.log(buildData);
        let params = {};
        if (buildData === undefined || buildData.actions === undefined || buildData.actions[0] === undefined || buildData.actions[0].parameters === undefined) {
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
            user: params.user
          };
        }
      });
      return currentState;
    })
}

jenkins.job.list()
  .then((data=> {
    // console.log('info', data);
    const filteredJobs = data.filter((job)=> {
      return job.name.indexOf('деплоя приложений') != -1
    });
    const ProcessPromises = filteredJobs.map(getJobData);
    return Promise.all(ProcessPromises);
  }))
  .then((currentState)=> {
    console.log('fetching logs for last builds');
    let getLogPromises = [];
    currentState.forEach((jobData)=> {
      Object.keys(jobData).forEach(function (jobName) {
        const teamData = (jobData[jobName]);
        Object.keys(teamData).forEach(function (key2) {
          const projectData = (teamData[key2]);
          Object.keys(projectData).forEach(function (key3) {
            const buildData = (projectData[key3]);
            let getLogPromise = jenkins.build.log(jobName, buildData.id)
              .then((logData)=> {
                // buildData.log = logData; //.substr(0,50); // no need for full log
                let pos = logData.indexOf("\n");
                buildData.user = logData.substr(0, pos).replace('Started by user', '').trim();
                let searchString = '== `Branch';
                pos = logData.indexOf(searchString);
                if (pos === -1) {
                  return;
                }
                let searchString2 = '(at ';
                pos = logData.indexOf(searchString2, pos);
                buildData.commit = logData.substr(pos + searchString2.length, 7);
              });
            getLogPromises.push(getLogPromise);
          });
        });
      });
    });
    return Promise.all(getLogPromises).then(()=> {
      return currentState
    });
  })
  .then((currentState)=> {
    console.log('finished');
    console.log(JSON.stringify(currentState, null, 3));
  })
  .catch((err)=> {
    console.log('Error: ');
    console.log(err)
  });
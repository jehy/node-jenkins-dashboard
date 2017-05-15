/* eslint-disable func-names*/
/* that's because JQuery does not work with ES6*/

const $              = require('jquery'),
      moment         = require('moment'),
      config         = require('../../config/default.json'),
      requestPromise = require('request-promise');

window.$ = $;
window.jQuery = $;
require('bootstrap');

$(function () {

  const parent = $('#dashboard');
  parent.html('');
  $('#alerts').html();
  $('#progressBar').show();

  // console.log(`Sending data: ${JSON.stringify(requestData)}`);
  const options = {
    method: 'POST',
    uri: `${location.protocol}//${window.location.hostname}:${config.port}/get/`,
    json: true,
    headers: {},
  };

  parent.css('display', 'none');
  requestPromise(options)
    .then((data)=> {
      if (!data || !data.length || data.length === 0) {
        throw new Error(`Не пришло данных!' ${data}`);
      }
      data.forEach((jobData)=> {
        Object.keys(jobData).forEach(function (jobName) {

          let jobDisplayName = jobName;
          const pos = jobName.indexOf(' на ');
          if (pos !== -1) {
            if (jobDisplayName.indexOf('test_') === -1) {
              jobDisplayName = jobName.substr(pos + 4);
            }
            else {
              jobDisplayName = `test_${jobName.substr(pos + 4)}`;
            }
          }
          parent.append(`<h2>${jobDisplayName}</h2>`);
          const teamData = (jobData[jobName]);
          Object.keys(teamData).forEach(function (teamName) {
            parent.append(`<h3>${teamName}</h3>`);
            const projectsTable = $('<table></table>');
            const projectsTableBody = $('<tbody></tbody>');
            projectsTable.append(projectsTableBody);
            projectsTable.attr('class', 'table table-striped');
            const projectsTableTitle = $('<tr></tr>');
            projectsTableTitle.append('<td>Проект</td>');
            projectsTableTitle.append('<td>Результат</td>');
            projectsTableTitle.append('<td>Дата выкатки</td>');
            projectsTableTitle.append('<td>Билд</td>');
            projectsTableTitle.append('<td>Автор</td>');
            projectsTableTitle.append('<td>Ветка</td>');
            projectsTableTitle.append('<td>Коммит</td>');
            projectsTable.append($('<thead></thead>').append(projectsTableTitle));
            const projectData = (teamData[teamName]);
            Object.keys(projectData).forEach(function (projectName) {
              const projectsTableRow = $('<tr></tr>');
              const buildData = (projectData[projectName]);
              if (buildData.projectUrl !== undefined) {
                projectsTableRow.append(`<td><a href="${buildData.projectUrl}">${projectName}</a></td>`);
              }
              else {
                projectsTableRow.append(`<td>${projectName}</td>`);
              }
              projectsTableRow.append(`<td>${buildData.result}</td>`);
              projectsTableRow.append(`<td>${moment(new Date(buildData.timestamp)).format('YYYY.MM.DD HH:mm:ss')}</td>`);
              projectsTableRow.append(`<td><a href="${buildData.url}">${buildData.id}</a></td>`);
              projectsTableRow.append(`<td style="width:400px">${buildData.user}</td>`);
              if (buildData.branchUrl !== undefined) {
                projectsTableRow.append(`<td><a href="${buildData.branchUrl}">${buildData.branch}</a></td>`);
              }
              else {
                projectsTableRow.append(`<td>${buildData.branch}</td>`);
              }
              projectsTableRow.append(`<td>${buildData.commit}</td>`);
              if (buildData.result !== 'SUCCESS') {
                projectsTableRow.attr('class', 'alert alert-danger');
              }
              projectsTableBody.append(projectsTableRow);
            });
            parent.append(projectsTable);
          });
        });
      });
      parent.css('display', 'inline-block');
    })
    .catch((err)=> {
      const alert = $(`<div>${err.toString()} ${err.stack}</div>`);
      alert.attr('class', 'alert alert-danger');
      alert.attr('role', 'alert');
      $('#alerts').html(alert);
    })
    .finally(()=> {
      $('#progressBar').hide();
    });
});

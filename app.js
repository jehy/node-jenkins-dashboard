/* eslint-disable no-console*/

const
  express    = require('express'),
  // Создаем инстанс вебсервера
  app        = express(),
  Routes     = require('./routes/index'),
  bodyParser = require('body-parser'),
  sendResult = require('./modules/sendResult.js'),
  // Настройки приложения и middleware
  config     = require('./config/default.json');

// Все урлы перехватываются соответсвующими модулями из ./routes
// при необходимости в require можно передавать кроме app другие параметры


app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static('public'));
app.use(sendResult);
app.firstLaunch = true;
for (let i = 0; i < Routes.length; i++) {
  Routes[i](app);
}

app.listen(config.port);
console.log('Express is up on port %d in %s mode', config.port, app.settings.env);

module.exports = app;

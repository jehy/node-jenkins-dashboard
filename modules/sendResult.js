// Кастомная отправка результатов для API
// на входе может быть как JSON, текст или промис.

/* eslint-disable no-param-reassign*/

module.exports = (req, res, next)=> {

  res.sendError = (error)=> {
    res.status(error.errorCode || 500)
      .json({error: error.message, code: error.errorCode || 500});
  };

  res.sendResult = (promise)=> {
    if (!promise.then || !promise.catch) {
      // Пришли данные
      res.json(promise);
    } else {
      // Пришел промис
      promise.then((result) => {
        // Промис успешно завершился и вернул данные
        res.json(result);
      }).catch((error) => {
        // Промис завершился ошибкой
        res.sendError(error, res);
      });
    }
  };

  next();

};

// Возможность кидать саможельные ошибки - очень полезна для промисов

module.exports = ()=> {

  function CustomError(name, message, code) {
    this.name = name;
    this.message = message || '';
    this.errorCode = code || 500;
  }

  CustomError.prototype = Error.prototype;
  return CustomError;
};

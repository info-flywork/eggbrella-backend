// Makine okunur hata kodları (uygulama lokalize eder).
const CODES = {
  INVALID_REQUEST: 'invalid_request',
  UNAUTHORIZED: 'unauthorized',
  NOT_FOUND: 'not_found',
  INSUFFICIENT_COINS: 'insufficient_coins',
  TOO_MANY_REQUESTS: 'too_many_requests',
  SERVER_ERROR: 'server_error',
};

class ApiError extends Error {
  constructor(httpStatus, code, detail) {
    super(code);
    this.httpStatus = httpStatus;
    this.code = code;
    this.detail = detail;
  }

  static badRequest(detail) {
    return new ApiError(400, CODES.INVALID_REQUEST, detail);
  }

  static unauthorized(detail) {
    return new ApiError(401, CODES.UNAUTHORIZED, detail);
  }

  static notFound(detail) {
    return new ApiError(404, CODES.NOT_FOUND, detail);
  }

  static conflict(code, detail) {
    return new ApiError(409, code, detail);
  }

  static tooMany(detail) {
    return new ApiError(429, CODES.TOO_MANY_REQUESTS, detail);
  }

  static server(detail) {
    return new ApiError(500, CODES.SERVER_ERROR, detail);
  }
}

module.exports = { ApiError, CODES };

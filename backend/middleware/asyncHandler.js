// Express 4 does NOT catch rejected promises from async route handlers —
// an unhandled rejection inside `async (req, res) => {...}` just hangs
// the request instead of reaching the error-handling middleware in
// server.js. Wrapping every async route in this converts a thrown/
// rejected error into `next(err)`, so the centralized handler in
// server.js is the only place that formats error responses.
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = asyncHandler;

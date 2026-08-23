// Guards every /api/admin/* route except POST /api/admin/login (that one
// is what ISSUES the token, so it obviously can't require one).
//
// Usage in routes/admin.js: router.use(requireAuth) placed AFTER the
// /login route definition — Express middleware only applies to routes
// registered after it, so /login stays open and everything below the
// router.use() call is gated.
const jwt = require("jsonwebtoken");

function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or malformed Authorization header" });
  }

  const token = header.slice("Bearer ".length);

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.moderator = payload; // { moderator_id, email } — set at sign time in routes/admin.js
    next();
  } catch (err) {
    // jwt.verify throws for both "bad signature" and "expired" — either
    // way the client just needs to log in again, so one generic 401 is
    // clearer than leaking which specific validation failed.
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

module.exports = requireAuth;

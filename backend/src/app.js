const express = require('express');
const cors = require('cors');
const env = require('./config/env');
const routes = require('./routes');
const errorHandler = require('./middleware/errorHandler');
const notFound = require('./middleware/notFound');
const requestId = require('./middleware/requestId');

const app = express();

// Render (like Heroku) puts the app behind its own reverse proxy. Without
// this, Express can't see a real client IP on any request -- req.ip falls
// back to the proxy's own address for everyone, which silently turns the
// login rate limiter's "10 attempts per IP" into "10 attempts total,
// shared by every visitor" (this is what caused a same-day 429 after only
// one or two real login attempts). `1` trusts exactly one proxy hop,
// matching Render's setup -- req.ip then reads the first entry of
// X-Forwarded-For, which Render's own proxy sets and a client cannot spoof
// past it.
app.set('trust proxy', 1);

app.use(requestId);
app.use(cors({ origin: env.corsOrigin }));
app.use(express.json({ limit: env.maxJsonBodySize }));
app.use(express.urlencoded({ extended: true, limit: env.maxJsonBodySize }));

app.use('/api/v1', routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;

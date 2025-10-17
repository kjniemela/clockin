const express = require('express');
const path = require('path');
const api = require('./api');

const CookieParser = require('./middleware/cookieParser');
const Auth = require('./middleware/auth');

const app = express();
const { ADDR_PREFIX, PORT } = require('./config');
const { executeQuery } = require('./db/utils');

app.use((req, res, next) => {
  console.log(req.method, req.path);
  next();
})

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(CookieParser);
app.use(Auth.createSession);
app.use(`${ADDR_PREFIX}/`, express.static(path.join(__dirname, '../client')));

app.get(`${ADDR_PREFIX}/verify`, Auth.verifySession, async (req, res) => {
  try {
    const data = structuredClone(req.session);
    if (data.user) {
      delete data.user.password;
      delete data.user.salt;
    }
    res.json(data);
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
});

app.get(`${ADDR_PREFIX}/data/:id`, Auth.verifySession, async (req, res) => {
  try {
    const data = {
      log: await executeQuery('SELECT * FROM shift WHERE job_id = ? AND user_id = ? ORDER BY in_time', [req.params.id, req.session.user.id]),
      payroll: await executeQuery('SELECT * FROM payroll WHERE job_id = ? AND user_id = ? ORDER BY pay_time', [req.params.id, req.session.user.id]),
    };
    res.json(data);
  } catch (err) {
    console.error(err);
    res.sendStatus(404);
  }
});

app.get(`${ADDR_PREFIX}/jobs/:userId`, Auth.verifySession, async (req, res) => {
  try {
    const jobs = await executeQuery(`
      SELECT DISTINCT job.*
      FROM shift
      INNER JOIN job ON job.id = shift.job_id
      WHERE shift.user_id = ?
    `, [req.params.userId]);
    res.json(jobs);
  } catch (err) {
    console.error(err);
    res.sendStatus(404);
  }
});

app.post(`${ADDR_PREFIX}/pay/:id`, Auth.verifySession, async (req, res) => {
  console.log(req.body)
  try {
    await executeQuery('INSERT INTO payroll (pay_time, job_id, user_id) VALUES (?, ?, ?)', [new Date(req.body.lastPayroll), req.params.id, req.session.user.id]);
    res.sendStatus(201);
  } catch (err) {
    console.error(err);
    res.sendStatus(404);
  }
});

app.post(`${ADDR_PREFIX}/clock/:id`, Auth.verifySession, async (req, res) => {
  try {
    const clockNow = req.body.time === null;
    const date = clockNow ? new Date() : new Date(req.body.time);
    const lastLog = (await executeQuery('SELECT * FROM shift WHERE job_id = ? AND user_id = ? ORDER BY in_time DESC', [req.params.id, req.session.user.id]))[0];
    if (lastLog && lastLog.out_time === null) {
      if (date < lastLog.in_time) return res.sendStatus(400);
      await executeQuery('UPDATE shift SET out_time = ? WHERE id = ?', [date, lastLog.id]);
    } else {
      if (date < lastLog.out_time) return res.sendStatus(400);

      if (clockNow) {
        // If we're clocked in elsewhere, clock us out
        const otherShifts = await executeQuery('SELECT id FROM shift WHERE out_time IS NULL AND user_id = ?', [req.session.user.id]);
        for (const shift of otherShifts) {
          await executeQuery('UPDATE shift SET out_time = ? WHERE id = ?', [date, shift.id]);
        }
      }

      await executeQuery('INSERT INTO shift (in_time, job_id, user_id) VALUES (?, ?, ?)', [date, req.params.id, req.session.user.id]);
    }
    res.sendStatus(201);
  } catch (err) {
    console.error(err);
    res.sendStatus(404);
  }
});

app.delete(`${ADDR_PREFIX}/clock/:id`, Auth.verifySession, async (req, res) => {
  try {
    const lastLog = (await executeQuery('SELECT * FROM shift WHERE job_id = ? AND user_id = ? ORDER BY in_time DESC', [req.params.id, req.session.user.id]))[0];
    if (lastLog) {
      if (lastLog.out_time === null) {
        await executeQuery('DELETE FROM shift WHERE id = ?', [lastLog.id]);
      } else {
        await executeQuery('UPDATE shift SET out_time = ? WHERE id = ?', [null, lastLog.id]);
      }
    }
    res.sendStatus(201);
  } catch (err) {
    console.error(err);
    res.sendStatus(404);
  }
});

// AUTH ROUTES

app.get(`${ADDR_PREFIX}/logout`, async (req, res) => {
  try {
    await api.delete.session(req.session.id)
    res.clearCookie('clockinuid', req.session.id);
    res.redirect(`${ADDR_PREFIX}/`);
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
});

app.post(`${ADDR_PREFIX}/login`, async (req, res) => {
  try {
    const [errCode, user] = await api.get.user(req.body.email);
    if (user) {
      req.loginId = user.id;
      const isValidUser = api.validatePassword(req.body.password, user.password, user.salt);
      if (isValidUser) {
        await api.put.session(req.session.id, req.loginId);
        res.status(200);
        return res.redirect(`${ADDR_PREFIX}/`);
      } else {
        return res.sendStatus(401);
      }
    } else {
      return res.sendStatus(401);
    }
  } catch (err) {
    console.error(err);
    return res.sendStatus(500);
  }
});

app.post(`${ADDR_PREFIX}/signup`, async (req, res) => {
  console.log(req.body);
  try {
    const data = await api.post.user( req.body );
    try {
      await api.put.session(req.session.id, data.insertId);
      res.status(201);
      return res.redirect(`${ADDR_PREFIX}/`);
    } catch (err) {
      console.error(err);
      return res.sendStatus(500);
    }
  } catch (err) {
    console.error(err);
    if (err.code === 'ER_DUP_ENTRY') {
      res.status(400);
      return res.end('email taken')
    } else if (err.message === 'malformed email') {
      res.status(400);
      return res.end('malformed email')
    }
    return res.sendStatus(500);
  }
});

app.listen(PORT, () => {
  console.log(`App listening on port ${PORT}`);
});
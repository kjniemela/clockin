const express = require('express');
const path = require('path');
const fsPromises = require('fs/promises');
const api = require('./api');

const CookieParser = require('./middleware/cookieParser');
const Auth = require('./middleware/auth');

const app = express();
const { ADDR_PREFIX, PORT } = require('./config');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(CookieParser);
app.use(Auth.createSession);
app.use(`${ADDR_PREFIX}/`, express.static(path.join(__dirname, '../client')));

app.get(`${ADDR_PREFIX}/verify`, Auth.verifySession, async (req, res) => {
  try {
    const data = req.session;
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
    const data = JSON.parse(await fsPromises.readFile(path.join(__dirname, `data/${req.params.id}.json`)));
    res.json(data);
  } catch (err) {
    console.error(err);
    res.sendStatus(404);
  }
});

app.post(`${ADDR_PREFIX}/pay/:id`, Auth.verifySession, async (req, res) => {
  console.log(req.body)
  try {
    const data = JSON.parse(await fsPromises.readFile(path.join(__dirname, `data/${req.params.id}.json`)));
    data.lastPayroll = req.body.lastPayroll;
    await fsPromises.writeFile(path.join(__dirname, `data/${req.params.id}.json`), JSON.stringify(data));
    res.sendStatus(201);
  } catch (err) {
    console.error(err);
    res.sendStatus(404);
  }
});

app.post(`${ADDR_PREFIX}/clock/:id`, Auth.verifySession, async (req, res) => {
  console.log(req.body)
  try {
    const data = JSON.parse(await fsPromises.readFile(path.join(__dirname, `data/${req.params.id}.json`)));
    if (data.clockedIn !== req.body.state) {
      data.clockedIn = req.body.state;
      data.log.push([req.body.state, req.body.time, req.body.memo ?? null]);
    }
    await fsPromises.writeFile(path.join(__dirname, `data/${req.params.id}.json`), JSON.stringify(data));
    res.sendStatus(201);
  } catch (err) {
    console.error(err);
    res.sendStatus(404);
  }
});

app.delete(`${ADDR_PREFIX}/clock/:id`, Auth.verifySession, async (req, res) => {
  try {
    const data = JSON.parse(await fsPromises.readFile(path.join(__dirname, `data/${req.params.id}.json`)));
    if (data.log.length > 0) {
      const oldState = data.log.pop();
      data.clockedIn = !oldState[0];
    }
    await fsPromises.writeFile(path.join(__dirname, `data/${req.params.id}.json`), JSON.stringify(data));
    res.sendStatus(201);
  } catch (err) {
    console.error(err);
    res.sendStatus(404);
  }
});

// AUTH ROUTES

app.get(`${ADDR_PREFIX}/logout`, async (req, res) => {
  try {
    await api.delete.session({ id: req.session.id })
    res.clearCookie('clockinuid', req.session.id);
    res.redirect(`${ADDR_PREFIX}/`);
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
});

app.post(`${ADDR_PREFIX}/login`, async (req, res) => {
  try {
    const [errCode, user] = await api.get.user({ email: req.body.email }, true);
    if (user) {
      req.loginId = user.id;
      const isValidUser = api.validatePassword(req.body.password, user.password, user.salt);
      if (isValidUser) {
        await api.put.session({ id: req.session.id }, { userId: req.loginId });
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
      await api.put.session({ id: req.session.id }, { userId: data.insertId });
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
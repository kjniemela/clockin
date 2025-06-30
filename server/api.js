const fsPromises = require('fs/promises');
const utils = require('./lib/hashUtils');
const path = require('path');

const fetchJSON = async (pathList) => {
  return JSON.parse(
    await fsPromises.readFile(path.join(__dirname, `data/${pathList.join('/')}.json`))
  );
};

const saveJSON = async (pathList, json) => {
  await fsPromises.writeFile(path.join(__dirname, `data/${pathList.join('/')}.json`), JSON.stringify(json));
};

const appendJSON = async (pathList, json) => {
  const data = await fetchJSON(pathList);
  if (!(data instanceof Array)) throw new TypeError();
  json.id = data[data.length-1]?.id+1 ?? 0;
  data.push(json);
  saveJSON(pathList, data);
  return { insertId: json.id };
};

const doesMatch = (keys, entry) => {
  let match = true;
  for (const key in keys) {
    if (keys[key] !== entry[key]) {
      match = false;
      break;
    }
  }
  return match;
};

const findMatch = (keys, array) => {
  const results = [];
  for (const entry of array) {
    if (doesMatch(keys, entry)) results.push(entry);
  }
  return results;
};

class APIGetMethods {
  /**
   * @param {*} options
   * @returns {Promise<session>}
   */
  async session(options) {
    const data = findMatch(options, await fetchJSON(['sessions']));
    const session = data[0];
    if (!session || !('userId' in session)) return session;
    const [_, user] = await api.get.user({ id: session.userId });
    session.user = user;
    return session;
  }

  /**
   * @param {*} options
   * @returns {Promise<[errCode, user]>}
   */
   async user(options) {
    const data = findMatch(options, await fetchJSON(['users']));
    const user = data[0];
    return [null, user];
  }
}

class APIPostMethods {
  /**
   * for internal use only - does not conform to the standard return format!
   * @returns
   */
  session() {
    const data = utils.createRandom32String();
    const hash = utils.createHash(data);
    return appendJSON(['sessions'], { hash });
  }

  /**
   *
   * @param {*} userData
   * @returns
   */
   async user({ email, password }) {
    const salt = utils.createRandom32String();

    if (!email) throw new Error('malformed email')

    const newUser = {
      email,
      salt,
      password: utils.createHash(password, salt)
    };

    const data = await appendJSON(['users'], newUser);
    await saveJSON([data.insertId], {
      clockedIn: false,
      lastPayroll: null,
      log: [],
    });
    return data;
  }
}

class APIPutMethods {
  /**
   * for internal use only - does not conform to the standard return format!
   * @param {{key: value}} options
   * @param {{key: value}} values
   * @returns
   */
  async session(options, values) {
    const data = await fetchJSON(['sessions']);
    for (const entry of data) {
      if (doesMatch(options, entry)) {
        for (const key in values) {
          entry[key] = values[key];
        }
      }
    }
    return saveJSON(['sessions'], data);
  }
}

class APIDeleteMethods {
  /**
   * for internal use only - does not conform to the standard return format!
   * @param {*} options
   * @returns
   */
   async session(options) {
    const data = await fetchJSON(['sessions']);
    for (let i = 0; i < data.length; i++) {
      const entry = data[i];
      if (doesMatch(options, entry)) {
        data.splice(i, 1);
        i--;
      }
    }
    return saveJSON(['sessions'], data);
  }
}

/**
 *
 * @param {*} attempted
 * @param {*} password
 * @param {*} salt
 * @returns
 */
 function validatePassword(attempted, password, salt) {
  return utils.compareHash(attempted, password, salt);
};

const api = {
  get: new APIGetMethods(),
  post: new APIPostMethods(),
  put: new APIPutMethods(),
  delete: new APIDeleteMethods(),
  validatePassword: validatePassword,
};

module.exports = api;
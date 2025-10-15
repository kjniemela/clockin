const utils = require('./lib/hashUtils');
const { executeQuery } = require('./db/utils');

class APIGetMethods {
  async _session(session) {
    if (!session || !('user_id' in session)) return session;
    const users = await executeQuery('SELECT * FROM user WHERE id = ?', [session.user_id]);
    session.user = users[0];
    return session;
  }

  /**
   * @param {*} options
   * @returns {Promise<session>}
   */
  async session(id) {
    const sessions = await executeQuery('SELECT * FROM session WHERE id = ?', [id]);
    return await this._session(sessions[0]);
  }

  async sessionByHash(hash) {
    const sessions = await executeQuery('SELECT * FROM session WHERE hash = ?', [hash]);
    return await this._session(sessions[0]);
  }

  /**
   * @param {*} options
   * @returns {Promise<[errCode, user]>}
   */
   async user(email) {
    const data = await executeQuery('SELECT * FROM user WHERE email = ?', [email]);
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
    return executeQuery('INSERT INTO session (hash, created_at) VALUES (?, ?)', [hash, new Date()]);
  }

  /**
   *
   * @param {*} userData
   * @returns
   */
   async user({ email, password }) {
    const salt = utils.createRandom32String();

    if (!email) throw new Error('malformed email')

    const newUser = [
      email,
      utils.createHash(password, salt),
      salt,
    ];

    return await executeQuery('INSERT INTO user (email, password, salt) VALUES (?, ?, ?)', newUser);
  }
}

class APIPutMethods {
  /**
   * for internal use only - does not conform to the standard return format!
   * @param {{key: value}} options
   * @param {{key: value}} values
   * @returns
   */
  async session(id, userId) {
    await executeQuery('UPDATE session SET user_id = ? WHERE id = ?', [userId, id]);
  }
}

class APIDeleteMethods {
  /**
   * for internal use only - does not conform to the standard return format!
   * @param {*} options
   * @returns
   */
   async session(id) {
    await executeQuery('DELETE FROM session WHERE id = ?', [id]);
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
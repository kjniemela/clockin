const db = require('.');

async function executeQuery(query, values = []) {
  const [ results ] = await db.execute(query, values);
  return results;
}

module.exports = {
  executeQuery,
};

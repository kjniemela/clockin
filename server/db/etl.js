const mysql = require('mysql2/promise');
const { DB_CONFIG } = require('../config');
const fsPromises = require('fs/promises');
const path = require('path');
const { loadSchema } = require("./import");

const fetchJSON = async (pathList) => {
  return JSON.parse(
    await fsPromises.readFile(path.join(__dirname, `../data/${pathList.join('/')}.json`))
  );
};

async function main() {
  
  const db = await mysql.createConnection({ ...DB_CONFIG, multipleStatements: true });
  await loadSchema(db)
  const users = await fetchJSON(['users']);
  for (const user of users) {
    const [{ insertId: userId }] = await db.execute('INSERT INTO user (email, salt, password) VALUES (?, ?, ?)', [user.email, user.salt, user.password]);
    const [{ insertId: jobId }] = await db.execute('INSERT INTO job (title) VALUES (?)', [user.email]);

    const { log, lastPayroll } = await fetchJSON([user.id]);
    const sortedLog = log.map(([isOpen, date, memo]) => [isOpen, new Date(date), memo]).sort((a, b) => a[1] > b[1]);
    let currentShift = null;
    for (const [isOpen, date, memo] of sortedLog) {
      if (isOpen) {
        if (currentShift) throw 'Unclosed shift!';
        const [{ insertId }] = await db.execute(`
          INSERT INTO shift (in_time, job_id, user_id)
          VALUES (?, ?, ?)
        `, [date, jobId, userId]);
        currentShift = insertId;
      } else {
        if (!currentShift) throw 'Unopened shift!';
        await db.execute('UPDATE shift SET out_time = ?, memo = ? WHERE id = ?', [date, memo || null, currentShift]);
        currentShift = null;
      }
    }

    if (lastPayroll) {
      await db.execute('INSERT INTO payroll (pay_time, job_id, user_id) VALUES (?, ?, ?)', [new Date(lastPayroll), jobId, userId]);
    }
  }
  db.end();
}

main();

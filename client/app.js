let data = {};
let hoursLoggedToday = 0;
let hoursTab = 0;
let sessionData;
let jobs;
let user;
let job;

function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
  const weekNo = Math.ceil((( (d - yearStart) / 86400000) + 1)/7);
  
  return weekNo;
}

async function fetchData() {
  let dots = 1;
  document.getElementById('refresh').innerText = ' • '.repeat(dots);
  const refreshInterval = setInterval(() => {
    dots = (dots % 3) + 1;
    document.getElementById('refresh').innerText = ' • '.repeat(dots);
  }, 200);
  document.getElementById('refresh').disabled = true;
  try {
    data = await (await fetch(`data/${job.id}`)).json();
    if (data.log.length > 0) {
      data.clockedIn = data.log[data.log.length - 1].out_time === null;
    }
    if (data.payroll.length > 0) {
      data.lastPayroll = data.payroll[data.payroll.length - 1].pay_time;
    }
  } catch (err) {
    console.log(err);
    data = null;
  } finally {
    clearInterval(refreshInterval);
    document.getElementById('refresh').innerText = 'Refresh';
    document.getElementById('refresh').disabled = false;
  }
  // document.getElementById('job').innerText = `Job: ${job.title}`;
  document.getElementById('jobs').innerHTML = '';
  for (const jobItem of jobs) {
    const btn = document.createElement('button');
    btn.disabled = job.id === jobItem.id;
    btn.innerText = jobItem.title;
    btn.onclick = () => {
      job = jobItem;
      fetchData();
    };
    document.getElementById('jobs').appendChild(btn);
  }
  updateLists(data);
  updateBtns(data);
  updateTarget(data);
}

function updateLists(data) {
  const logList = document.getElementById('log');
  logList.innerHTML = '';

  const hoursPerDay = {};
  const memosPerDay = {};
  const memosPerWeek = {};
  const memosPerMonth = {};
  const hoursPerWeek = {};
  const hoursPerMonth = {};
  let hoursSinceLastPayroll = 0;
  let dayDiv = document.createElement('div');
  const dayLogs = {};
  if (data?.log) {
    const lastPayroll = new Date(data.lastPayroll || 0);
    for (const entry of data.log) {
      const inDate = new Date(entry.in_time);
      const outDate = entry.out_time && new Date(entry.out_time);
      const memo = entry.memo ?? null;
      const dayKey = inDate.toLocaleDateString();
      if (!(dayKey in dayLogs)) dayLogs[dayKey] = [];
      dayLogs[dayKey].push([true, inDate]);

      if (outDate) {
        const outDayKey = outDate.toLocaleDateString();
        if (!(outDayKey in dayLogs)) dayLogs[outDayKey] = [];
        dayLogs[outDayKey].push([false, outDate]);

        const monthKey = `${inDate.getFullYear()}-${inDate.getMonth()}`;
        const weekKey = `${inDate.getFullYear()} - week ${getWeekNumber(inDate)}`;
        if (!(dayKey in hoursPerDay)) hoursPerDay[dayKey] = 0;
        if (!(dayKey in memosPerDay)) memosPerDay[dayKey] = [];
        if (!(weekKey in memosPerWeek)) memosPerWeek[weekKey] = [];
        if (!(monthKey in memosPerMonth)) memosPerMonth[monthKey] = [];
        if (!(weekKey in hoursPerWeek)) hoursPerWeek[weekKey] = 0;
        if (!(monthKey in hoursPerMonth)) hoursPerMonth[monthKey] = 0;
        const hours = (outDate - inDate) / 1000 / 60 / 60;
        hoursPerDay[dayKey] += hours;
        if (memo) {
          memosPerDay[dayKey].push(memo);
          memosPerWeek[weekKey].push(memo);
          memosPerMonth[monthKey].push(memo);
        }
        hoursPerWeek[weekKey] += hours;
        hoursPerMonth[monthKey] += hours;
        if (inDate >= lastPayroll) {
          hoursSinceLastPayroll += hours;
        }
      }
    }
    let previousDay = null;
    for (const dayKey in dayLogs) {
      if (dayKey !== previousDay) {
        const headingElement = document.createElement('dt');
        headingElement.innerHTML = `${previousDay ? '<br>' : ''}<b>${dayKey}:</b>`
        logList.prepend(dayDiv);
        dayDiv = document.createElement('div');
        dayDiv.prepend(headingElement);
      }
      for (const [isStart, date] of dayLogs[dayKey]) {
        const entryElement = document.createElement('dd');
        entryElement.innerText = `Clocked ${isStart ? 'in' : 'out'} at ${date.toLocaleTimeString()}`;
        entryElement.onclick = function() {
          // console.log(index);
        };
        dayDiv.appendChild(entryElement);
        previousDay = dayKey;
      }
    }
    logList.prepend(dayDiv);
  }

  let currentTime = 0;

  if (data?.clockedIn) {
    const previousTime = new Date(data.log[data.log.length-1].in_time);
    const key = previousTime.toLocaleDateString();
    const weekKey = `${previousTime.getFullYear()} - week ${getWeekNumber(previousTime)}`;
    const monthKey = `${previousTime.getFullYear()}-${previousTime.getMonth()}`;
    if (!(key in hoursPerDay)) hoursPerDay[key] = 0;
    if (!(weekKey in hoursPerWeek)) hoursPerWeek[weekKey] = 0;
    if (!(monthKey in hoursPerMonth)) hoursPerMonth[monthKey] = 0;
    currentTime = (new Date() - previousTime) / 1000 / 60 / 60;
    hoursPerDay[key] += currentTime;
    hoursPerWeek[weekKey] += currentTime;
    hoursPerMonth[monthKey] += currentTime;
  }

  const d = new Date();
  const todaysKey = d.toLocaleDateString();
  const thisWeekKey = `${d.getFullYear()} - week ${getWeekNumber(d)}`;
  const thisMonthKey = `${d.getFullYear()}-${d.getMonth()}`;
  const hoursToday = document.getElementById('hoursToday');
  const hoursThisWeek = document.getElementById('hoursThisWeek');
  const hoursThisMonth = document.getElementById('hoursThisMonth');
  const hoursList = document.getElementById('totalHoursList');
  const showMemos = document.getElementById('showMemosCheckbox').checked;
  hoursToday.innerText = '';
  hoursThisWeek.innerText = '';
  hoursThisMonth.innerText = '';
  hoursList.innerHTML = '';
  hoursToday.innerText = `${(hoursPerDay[todaysKey] ?? 0).toFixed(2)}hrs`;
  hoursThisWeek.innerText = `${(hoursPerWeek[thisWeekKey] ?? 0).toFixed(2)}hrs`;
  hoursThisMonth.innerText = `${(hoursPerMonth[thisMonthKey] ?? 0).toFixed(2)}hrs`;
  hoursToday.title = `Est. net: $${((hoursPerDay[todaysKey] ?? 0) * 35 * 0.75).toFixed(2)}`;
  hoursThisWeek.title = `Est. net: $${((hoursPerWeek[thisWeekKey] ?? 0) * 35 * 0.75).toFixed(2)}`;
  hoursThisMonth.title = `Est. net: $${((hoursPerMonth[thisMonthKey] ?? 0) * 35 * 0.75).toFixed(2)}`;
  if (todaysKey in hoursPerDay) {
    hoursLoggedToday = hoursPerDay[todaysKey];
  }
  if (hoursTab === 0) {
    Object.keys(hoursPerDay).forEach(function(key) {
      const entryElement = document.createElement('li');
      entryElement.innerHTML = `On ${key}: <b>${hoursPerDay[key].toFixed(2)}</b>hrs`;
      if (showMemos && memosPerDay[key]?.length > 0) {
        entryElement.innerHTML += `<br><span class="memo">${memosPerDay[key].join('<br>')}</span><br><br>`;
      }
      hoursList.prepend(entryElement);
    })
  }
  else if (hoursTab === 1) {
    Object.keys(hoursPerWeek).forEach(function(key) {
      const entryElement = document.createElement('li');
      entryElement.innerHTML = `${key}: <b>${hoursPerWeek[key].toFixed(2)}</b>hrs`;
      if (showMemos && memosPerWeek[key]?.length > 0) {
        entryElement.innerHTML += `<br><span class="memo">${memosPerWeek[key].join('<br>')}</span><br><br>`;
      }
      hoursList.prepend(entryElement);
    })
  }
  else if (hoursTab === 2) {
    const months = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ]
    Object.keys(hoursPerMonth).forEach(function(key) {
      const [year, month] = key.split('-');
      const entryElement = document.createElement('li');
      entryElement.innerHTML = `${months[month]} ${year}: <b>${hoursPerMonth[key].toFixed(2)}</b>hrs`;
      if (showMemos && memosPerMonth[key]?.length > 0) {
        entryElement.innerHTML += `<br><span class="memo">${memosPerMonth[key].join('<br>')}</span><br><br>`;
      }
      hoursList.prepend(entryElement);
    })
  }

  const date = new Date();
  const hoursSince = document.getElementById('hoursSince');
  const hoursSinceDate = document.getElementById('hoursSinceDate');
  const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
  hoursSince.innerText = `${(hoursSinceLastPayroll + currentTime).toFixed(2)}hrs`;
  hoursSince.title = `Est. net: $${((hoursSinceLastPayroll + currentTime) * 35 * 0.75).toFixed(2)}`
  hoursSinceDate.innerText = new Date(data?.lastPayroll || 0).toLocaleDateString() || '';
  const hoursSinceInput = document.getElementById('hoursSinceInput');
  const hoursSinceSubmit = document.getElementById('hoursSinceSubmit');
  hoursSinceSubmit.onclick = async function() {
    await fetch(`pay/${job.id}`, {
      method: "post",
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        lastPayroll: new Date(hoursSinceInput.value + 'T00:00'),
      })
    });
    fetchData();
  };

  const payrollNow = document.getElementById('payrollNow');
  payrollNow.onclick = async function() {
    await fetch(`pay/${job.id}`, {
      method: "post",
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        lastPayroll: new Date(),
      })
    });
    fetchData();
  };
}

function updateBtns(data) {
  const clockBtn = document.getElementById('clockBtn');
  clockBtn.innerText = `Clock ${data?.clockedIn ? 'Out' : 'In'}`;
  clockBtn.onclick = async function() {
    const payload = {
      state: !data.clockedIn,
      time: null,
    };
    if (data.clockedIn) {
      payload.memo = document.getElementById('memoInput').value
    }
    await fetch(`clock/${job.id}`, {
      method: "post",
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    fetchData();
  };


  const undoBtn = document.getElementById('undoBtn');
  undoBtn.onclick = async function() {
    await fetch(`clock/${job.id}`, { method: "delete" });
    fetchData();
  };

  const submitBtn = document.getElementById('manualClock');
  submitBtn.onclick = async function() {
    const lastDate = new Date(((data.log[data.log.length-1] ?? [])[1]) ?? 0);
    const newDate = new Date(document.getElementById('manualClockInput').value);
    if (newDate > lastDate && new Date() > newDate) {
      const payload = {
        state: !data.clockedIn,
        time: newDate,
      };
      if (data.clockedIn) {
        payload.memo = document.getElementById('memoInput').value
      }
      await fetch(`clock/${job.id}`, {
        method: "post",
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      fetchData();
    }
  };
}

function updateTarget(data) {
  const targetHours = Number(document.getElementById('targetHoursInput').value);
  const remainingHours = targetHours - hoursLoggedToday;
  const clockoutTime = new Date(new Date().getTime() + Math.round(remainingHours * 60 * 60 * 1000));
  document.getElementById('targetClockout').innerText = formatTime(clockoutTime);
}

function formatTime(t) {
  const hour = `${t.getHours() < 10 ? '0' : ''}${t.getHours()}`
  const minute = `${t.getMinutes() < 10 ? '0' : ''}${t.getMinutes()}`
  const second = `${t.getSeconds() < 10 ? '0' : ''}${t.getSeconds()}`
  return `${hour}:${minute}:${second}`
}

async function main() {
  try {
    document.getElementById('refresh').disabled = true;
    sessionData = await (await fetch('verify')).json();
    document.getElementById('usr').innerText = `Logged in as: ${sessionData.user.email}`;
    user = sessionData.user.id;
    jobs = await (await fetch(`jobs/${user}`)).json();
    job = jobs[0];
    document.getElementById('targetHoursInput').onchange = async function() {
      updateTarget(data);
    }
    document.getElementById('refresh').onclick = async function() {
      fetchData();
    }
    document.getElementById('showMemosCheckbox').onchange = async function() {
      updateLists(data);
    }
    fetchData();
  }
  catch (error) {
    location = 'login.html'
  }
};

main();
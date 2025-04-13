// script.js - Synced Auction with Timer, Budget, and Captain Display

let players = [];
let currentIndex = -1;
let currentBid = 0;
let currentCaptain = '';
let currentTimer;
let timerEndTime = null;

let teams = {
  captain1: [],
  captain2: []
};

let caps = {
  c1: '',
  c2: ''
};

let budgets = {
  captain1: 10000,
  captain2: 10000
};

function saveState() {
  localStorage.setItem('volleyAuction', JSON.stringify({
    players,
    currentIndex,
    currentBid,
    currentCaptain,
    teams,
    caps,
    budgets,
    timerEndTime
  }));
}

function loadState() {
  const data = JSON.parse(localStorage.getItem('volleyAuction'));
  if (data) {
    players = data.players || [];
    currentIndex = data.currentIndex ?? -1;
    currentBid = data.currentBid || 0;
    currentCaptain = data.currentCaptain || '';
    teams = data.teams || { captain1: [], captain2: [] };
    caps = data.caps || { c1: '', c2: '' };
    budgets = data.budgets || { captain1: 10000, captain2: 10000 };
    timerEndTime = data.timerEndTime || null;
  }
}

function generateLinks() {
  caps.c1 = document.getElementById('captain1').value;
  caps.c2 = document.getElementById('captain2').value;

  budgets.captain1 = parseInt(document.getElementById('budget1').value) || 10000;
  budgets.captain2 = parseInt(document.getElementById('budget2').value) || 10000;

  const base = window.location.origin + window.location.pathname.replace('index.html', '');
  const linksDiv = document.getElementById('captainLinks');
  linksDiv.innerHTML = `
    <p>Captain 1: <input id="c1Link" value="${base}captain.html?c=1" readonly /> <button onclick="copyLink('c1Link')">Copy</button></p>
    <p>Captain 2: <input id="c2Link" value="${base}captain.html?c=2" readonly /> <button onclick="copyLink('c2Link')">Copy</button></p>
    <p>Viewer Link: <input id="viewerLink" value="${base}view.html" readonly /> <button onclick="copyLink('viewerLink')">Copy</button></p>
  `;
  saveState();
}

function copyLink(id) {
  const input = document.getElementById(id);
  input.select();
  document.execCommand('copy');
}

function addPlayer() {
  const name = document.getElementById('pName').value;
  const pos = document.getElementById('pPos').value;
  const base = Number(document.getElementById('pBase').value);
  if (name && pos && base) {
    players.push({ name, pos, base, sold: false });
    document.getElementById('playerList').innerHTML += `<li>${name} (${pos}) - $${base}</li>`;
    document.getElementById('pName').value = '';
    document.getElementById('pPos').value = '';
    document.getElementById('pBase').value = '';
    saveState();
  }
}

function startAuction() {
  currentIndex = -1;
  nextPlayer();
}

function nextPlayer() {
  currentIndex++;
  if (currentIndex >= players.length) return alert('No more players.');
  currentBid = players[currentIndex].base;
  currentCaptain = '';
  players[currentIndex].sold = false;
  timerEndTime = null;
  updateAll();
  saveState();
}

function placeBid(amount) {
  const urlParams = new URLSearchParams(window.location.search);
  const c = urlParams.get('c') === '1' ? 'captain1' : 'captain2';

  if (!players[currentIndex] || players[currentIndex].sold) return;

  if (budgets[c] < currentBid + amount) {
    alert("Not enough budget!");
    return;
  }

  currentBid += amount;
  currentCaptain = c;
  timerEndTime = Date.now() + 10000; // restart countdown
  updateAll();
  saveState();
}

function sellPlayer() {
  if (!currentCaptain || !players[currentIndex]) return;
  const player = players[currentIndex];
  if (player.sold) return;

  player.price = currentBid;
  player.sold = true;

  if (!teams[currentCaptain].some(p => p.name === player.name)) {
    teams[currentCaptain].push(player);
    budgets[currentCaptain] -= currentBid;
  }

  timerEndTime = null;
  updateAll();
  saveState();
}

function getTimeRemaining() {
  if (!timerEndTime) return 0;
  return Math.max(0, Math.floor((timerEndTime - Date.now()) / 1000));
}

function updateAll() {
  const cp = players[currentIndex];

  // Admin
  if (document.getElementById('currentPlayerDisplay')) {
    if (cp?.sold) {
      document.getElementById('currentPlayerDisplay').innerHTML = `<h3>Player Sold: ${cp.name} to ${currentCaptain} for $${currentBid}</h3>`;
    } else if (cp) {
      document.getElementById('currentPlayerDisplay').innerHTML = `<h3>Now Bidding: ${cp.name} (${cp.pos})<br/>Current Bid: $${currentBid} by ${caps[currentCaptain === 'captain1' ? 'c1' : 'c2'] || '---'}</h3><div id="timerDisplay">Time Left: ${getTimeRemaining()}s</div>`;
    }
    updateTeams();
  }

  // Captain
  if (document.getElementById('currentPlayer')) {
    if (cp?.sold) {
      document.getElementById('currentPlayer').innerHTML = `<h3>Player Sold: ${cp.name} for $${currentBid}</h3>`;
    } else if (cp) {
      document.getElementById('currentPlayer').innerHTML = `<h3>${cp.name} (${cp.pos}) - Base $${cp.base}<br/>Current Bid: $${currentBid} by ${caps[currentCaptain === 'captain1' ? 'c1' : 'c2'] || '---'}</h3><div id="timerDisplay">Time Left: ${getTimeRemaining()}s</div>`;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const myTeam = urlParams.get('c') === '1' ? 'captain1' : 'captain2';

    document.getElementById('budget').textContent = `Remaining Budget: $${budgets[myTeam]}`;
    const teamList = teams[myTeam].map(p => `<li>${p.name} (${p.pos}) - $${p.price}</li>`).join('');
    document.getElementById('yourTeam').innerHTML = teamList;

    const upcoming = players.map((p, i) => {
      const label = i === currentIndex ? '<strong>▶</strong> ' : '';
      return `${label}${p.name} (${p.pos}) - $${p.base}`;
    }).join('<br/>');
    document.getElementById('upcomingPlayers').innerHTML = upcoming;

    if (document.getElementById('captainNameDisplay')) {
      const capName = myTeam === 'captain1' ? caps.c1 : caps.c2;
      document.getElementById('captainNameDisplay').textContent = `Captain: ${capName}`;
    }
  }

  // Viewer
  if (document.getElementById('livePlayer')) {
    if (cp?.sold) {
      document.getElementById('livePlayer').innerHTML = `<h3>Player Sold: ${cp.name} for $${currentBid}</h3>`;
    } else if (cp) {
      document.getElementById('livePlayer').innerHTML = `<h3>${cp.name} (${cp.pos}) - Current Bid: $${currentBid} by ${caps[currentCaptain === 'captain1' ? 'c1' : 'c2'] || '---'}</h3><div id="timerDisplay">Time Left: ${getTimeRemaining()}s</div>`;
    }
    updateTeams();
  }
}

function updateTeams() {
  const t1 = teams.captain1.map(p => `<li>${p.name} (${p.pos}) - $${p.price}</li>`).join('');
  const t2 = teams.captain2.map(p => `<li>${p.name} (${p.pos}) - $${p.price}</li>`).join('');

  const list1 = document.getElementById('team1List') || document.getElementById('team1ViewerList');
  const list2 = document.getElementById('team2List') || document.getElementById('team2ViewerList');

  if (list1) list1.innerHTML = t1;
  if (list2) list2.innerHTML = t2;

  if (document.getElementById('team1Name')) document.getElementById('team1Name').textContent = caps.c1;
  if (document.getElementById('team2Name')) document.getElementById('team2Name').textContent = caps.c2;

  if (document.getElementById('team1Viewer')) document.getElementById('team1Viewer').textContent = caps.c1;
  if (document.getElementById('team2Viewer')) document.getElementById('team2Viewer').textContent = caps.c2;
}

function resetAuction() {
  localStorage.removeItem('volleyAuction');
  location.reload();
}

window.onload = () => {
  loadState();
  updateAll();
  setInterval(() => {
    loadState();
    if (timerEndTime && getTimeRemaining() === 0) {
      sellPlayer();
    }
    updateAll();
  }, 1000); // Every second for timer + sync
};
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, onValue, remove } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDbRz9x-oPOrdx1kNuQR9xxsOlBT2spC1I",
  authDomain: "volleyball-bidding-app.firebaseapp.com",
  projectId: "volleyball-bidding-app",
  storageBucket: "volleyball-bidding-app.firebasestorage.app",
  messagingSenderId: "1058330685866",
  appId: "1:1058330685866:web:884d60835ff580e217fbd3"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auctionStateRef = ref(db, 'auctionData');

// ____________________________________________________________ //

let players = [];
let currentIndex = -1;
let currentBid = 0;
let currentCaptain = '';
let timerEndTime = null;

let biddingPermissions = { // New state for controlling bidding
  captain1: true,
  captain2: true,
  captain3: true
};

let teams = {
  captain1: [],
  captain2: [],
  captain3: []
};

let caps = {
  c1: 'Captain 1',
  c2: 'Captain 2',
  c3: 'Captain 3'
};

let budgets = {
  captain1: 10000,
  captain2: 10000,
  captain3: 10000
};

// Function to write the current state to Firebase
function updateFirebaseState() {
  const state = {
    players,
    currentIndex,
    currentBid,
    currentCaptain,
    teams,
    caps,
    budgets,
    timerEndTime,
    biddingPermissions // Add to Firebase state
  };
  set(auctionStateRef, state);
}

function generateLinks() {
  try {
    const captain1Input = document.getElementById('captain1');
    const captain2Input = document.getElementById('captain2');
    const captain3Input = document.getElementById('captain3'); // New
    const budget1Input = document.getElementById('budget1');
    const budget2Input = document.getElementById('budget2');
    const budget3Input = document.getElementById('budget3'); // New
    const linksDiv = document.getElementById('captainLinks');

    if (!captain1Input || !captain2Input || !captain3Input || !budget1Input || !budget2Input || !budget3Input || !linksDiv) {
      console.error("generateLinks: One or more required HTML elements (captain inputs, budget inputs, or linksDiv) were not found.");
      alert("Error: Could not find necessary HTML elements to generate links. Please check the console.");
      return;
    }

    caps.c1 = captain1Input.value || 'Captain 1';
    caps.c2 = captain2Input.value || 'Captain 2';
    caps.c3 = captain3Input.value || 'Captain 3'; // New

    budgets.captain1 = parseInt(budget1Input.value) || 10000;
    budgets.captain2 = parseInt(budget2Input.value) || 10000;
    budgets.captain3 = parseInt(budget3Input.value) || 10000; // New

    // The existing base URL calculation logic is generally robust.
    // window.location.origin: e.g., "http://localhost:3000"
    // window.location.pathname: e.g., "/", "/index.html", "/app/", "/app/index.html"
    // replace('index.html', ''): removes "index.html" if present at the end.
    // replace(/\/$/, ''): removes a trailing slash, unless it's the root path "/".
    // For root path "/": replace(/\/$/, '') results in an empty string.
    // For path "/app/": replace(/\/$/, '') results in "/app".
    const pathPart = window.location.pathname
      .replace(/index\.html$/, '') // More robustly remove index.html only from the end
      .replace(/\/$/, ''); // Remove trailing slash
    
    // base will be like "http://localhost:3000" or "http://localhost:3000/app"
    const base = window.location.origin + pathPart;

    linksDiv.innerHTML = `
      <p>Captain 1: <input id="c1Link" value="${base}/captain.html?c=1" readonly /> <button onclick="copyLink('c1Link')">Copy</button></p>
      <p>Captain 2: <input id="c2Link" value="${base}/captain.html?c=2" readonly /> <button onclick="copyLink('c2Link')">Copy</button></p>
      <p>Captain 3: <input id="c3Link" value="${base}/captain.html?c=3" readonly /> <button onclick="copyLink('c3Link')">Copy</button></p> 
      <p>Viewer Link: <input id="viewerLink" value="${base}/view.html" readonly /> <button onclick="copyLink('viewerLink')">Copy</button></p>
    `;
    // console.log('Generated links with base:', base); // For debugging
    updateFirebaseState();

  } catch (error) {
    console.error("Error in generateLinks function:", error);
    alert("An error occurred while generating links. Please check the browser console for more details.");
  }
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
  if (name && pos && base > 0) {
    players.push({ name, pos, base, sold: false, price: 0, soldToCaptainId: null });
    // Admin page local list update (UI will also refresh from Firebase)
    document.getElementById('playerList').innerHTML = players.map(p => `<li>${p.name} (${p.pos}) - $${p.base}</li>`).join('');
    document.getElementById('pName').value = '';
    document.getElementById('pPos').value = '';
    document.getElementById('pBase').value = '';
    updateFirebaseState();
  } else {
    alert("Please fill all player fields with valid data (Base price must be > 0).");
  }
}

function startAuction() {
  currentIndex = -1; // nextPlayer will increment this to 0
  nextPlayer();
}

function nextPlayer() {
  currentIndex++;
  if (currentIndex >= players.length) {
    alert('No more players or auction ended.');
    // Optionally update a state variable like auctionEnded = true
    updateFirebaseState(); // Save the state where currentIndex is out of bounds
    return;
  }
  
  // Ensure player exists and reset relevant fields for bidding
  if (players[currentIndex]) {
    currentBid = players[currentIndex].base;
    currentCaptain = '';
    // players[currentIndex].sold = false; // Should already be false unless re-auctioning
    timerEndTime = null;
  } else {
    // Should not happen if currentIndex is managed properly
    alert('Error: Player not found at current index.');
    return;
  }
  updateFirebaseState();
}

function placeBid(amount) {
  const urlParams = new URLSearchParams(window.location.search);
  const captainIdParam = urlParams.get('c');
  
  if (!captainIdParam) {
    // This function should ideally only be callable from a captain page with 'c' param
    console.error("placeBid called without captain context.");
    return;
  }
  let c;
  if (captainIdParam === '1') {
    c = 'captain1';
  } else if (captainIdParam === '2') {
    c = 'captain2';
  } else if (captainIdParam === '3') {
    c = 'captain3'; // New
  } else {
    console.error("Invalid captain ID parameter:", captainIdParam);
    return;
  }

  // Check bidding permission
  if (!biddingPermissions[c]) {
    alert(`Bidding is currently disabled for ${caps[c.replace('captain', 'c')] || c}.`);
    return;
  }

  if (currentIndex < 0 || currentIndex >= players.length || !players[currentIndex] || players[currentIndex].sold) {
    alert("Bidding is not active for this player.");
    return;
  }

  if (budgets[c] < currentBid + amount) {
    alert("Not enough budget!");
    return;
  }

  currentBid += amount;
  currentCaptain = c;
  timerEndTime = Date.now() + 10000; // 10 second countdown
  updateFirebaseState();
}

function sellPlayer() {
  if (currentIndex < 0 || currentIndex >= players.length || !players[currentIndex] || players[currentIndex].sold) {
    return; // Player not available or already sold
  }
  
  const player = players[currentIndex];

  if (currentCaptain) { // If there was a bid
    player.price = currentBid;
    player.sold = true;
    player.soldToCaptainId = currentCaptain;

    // Deduct budget and add to team, ensure player not added twice
    if (!teams[currentCaptain].some(p => p.name === player.name)) { // Basic check
      teams[currentCaptain].push({ ...player }); // Add a copy
      budgets[currentCaptain] -= currentBid;
    }
  } else {
    // Player goes unsold if no currentCaptain (no bids)
    // No changes to player.sold or teams/budgets needed for unsold
    // Player remains in players array, admin can click "Next Player"
  }

  timerEndTime = null; // Stop the timer
  // currentBid and currentCaptain will be reset by nextPlayer() or if admin starts new bid
  updateFirebaseState();
}

function getTimeRemaining() {
  if (!timerEndTime) return 0;
  return Math.max(0, Math.floor((timerEndTime - Date.now()) / 1000));
}

function updateAllUI() {
  const cp = (currentIndex >= 0 && currentIndex < players.length) ? players[currentIndex] : null;

  // Admin Page
  const adminCurrentPlayerDisplay = document.getElementById('currentPlayerDisplay');
  if (adminCurrentPlayerDisplay) {
    const playerListElement = document.getElementById('playerList');
    if (playerListElement) {
      playerListElement.innerHTML = players.map(p => {
        let soldInfo = '';
        if (p.sold && p.soldToCaptainId) {
          const captainName = caps[p.soldToCaptainId] || p.soldToCaptainId;
          soldInfo = ` (Sold to ${captainName} for $${p.price})`;
        }
        return `<li>${p.name} (${p.pos}) - Base $${p.base}${soldInfo}</li>`;
      }).join('');
    }

    // Update captain names and budgets inputs
    const cap1Input = document.getElementById('captain1');
    const budget1Input = document.getElementById('budget1');
    const cap2Input = document.getElementById('captain2');
    const budget2Input = document.getElementById('budget2');
    const cap3Input = document.getElementById('captain3'); // New
    const budget3Input = document.getElementById('budget3'); // New

    if (cap1Input && document.activeElement !== cap1Input) cap1Input.value = caps.c1 || '';
    if (budget1Input && document.activeElement !== budget1Input) budget1Input.value = budgets.captain1 || 0;
    if (cap2Input && document.activeElement !== cap2Input) cap2Input.value = caps.c2 || '';
    if (budget2Input && document.activeElement !== budget2Input) budget2Input.value = budgets.captain2 || 0;
    if (cap3Input && document.activeElement !== cap3Input) cap3Input.value = caps.c3 || ''; // New
    if (budget3Input && document.activeElement !== budget3Input) budget3Input.value = budgets.captain3 || 0; // New

    // Update "Control Bidding" checkboxes state
    const c1AllowedCheckbox = document.getElementById('c1Allowed');
    const c2AllowedCheckbox = document.getElementById('c2Allowed');
    const c3AllowedCheckbox = document.getElementById('c3Allowed');

    if (c1AllowedCheckbox && document.activeElement !== c1AllowedCheckbox) c1AllowedCheckbox.checked = biddingPermissions.captain1;
    if (c2AllowedCheckbox && document.activeElement !== c2AllowedCheckbox) c2AllowedCheckbox.checked = biddingPermissions.captain2;
    if (c3AllowedCheckbox && document.activeElement !== c3AllowedCheckbox) c3AllowedCheckbox.checked = biddingPermissions.captain3;

    if (cp?.sold) {
      const soldToCaptainName = cp.soldToCaptainId ? (caps[cp.soldToCaptainId.replace('captain','c')] || cp.soldToCaptainId) : 'N/A'; // Adjusted
      adminCurrentPlayerDisplay.innerHTML = `<h3>Player Sold: ${cp.name} to ${soldToCaptainName} for $${cp.price}</h3>`;
    } else if (cp) {
      const currentBidderName = currentCaptain ? (caps[currentCaptain.replace('captain','c')] || currentCaptain) : '---'; // Adjusted
      adminCurrentPlayerDisplay.innerHTML = `<h3>Now Bidding: ${cp.name} (${cp.pos})<br/>Base Price: $${cp.base}<br/>Current Bid: $${currentBid} by ${currentBidderName}</h3><div id="timerDisplay">Time Left: ${getTimeRemaining()}s</div>`;
    } else if (currentIndex >= players.length && players.length > 0) {
      adminCurrentPlayerDisplay.innerHTML = `<h3>Auction Ended. All players processed.</h3>`;
    } else {
      adminCurrentPlayerDisplay.innerHTML = `<h3>Auction Not Started or No Player Selected</h3>`;
    }
    updateTeamsUI();
  }

  // Captain Page
  const captainCurrentPlayer = document.getElementById('currentPlayer');
  if (captainCurrentPlayer) {
    if (cp?.sold) {
      const soldToCaptainName = cp.soldToCaptainId ? (caps[cp.soldToCaptainId.replace('captain', 'c')] || cp.soldToCaptainId) : 'N/A'; // Adjusted for consistency
      captainCurrentPlayer.innerHTML = `<h3>Player Sold: ${cp.name} to ${soldToCaptainName} for $${cp.price}</h3>`;
    } else if (cp) {
      const currentBidderName = currentCaptain ? (caps[currentCaptain.replace('captain', 'c')] || currentCaptain) : '---'; // Adjusted for consistency
      captainCurrentPlayer.innerHTML = `<h3>${cp.name} (${cp.pos}) - Base $${cp.base}<br/>Current Bid: $${currentBid} by ${currentBidderName}</h3><div id="timerDisplay">Time Left: ${getTimeRemaining()}s</div>`;
    } else if (currentIndex >= players.length && players.length > 0) {
      captainCurrentPlayer.innerHTML = `<h3>Auction Ended. No more players.</h3>`;
    } else {
      captainCurrentPlayer.innerHTML = `<h3>Waiting for next player...</h3>`;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const captainIdParam = urlParams.get('c'); // Expected '1', '2', or '3'
    let myTeamId = null;
    let myCapKey = null;

    if (captainIdParam && ['1', '2', '3'].includes(captainIdParam)) {
        myTeamId = `captain${captainIdParam}`; // e.g., 'captain1'
        myCapKey = `c${captainIdParam}`;       // e.g., 'c1'
    }

    if (myTeamId && budgets[myTeamId] !== undefined) {
      document.getElementById('budget').textContent = `Remaining Budget: $${budgets[myTeamId]}`;
    }
    if (myTeamId && teams[myTeamId]) {
      const teamList = teams[myTeamId].map(p => `<li>${p.name} (${p.pos}) - $${p.price}</li>`).join('');
      document.getElementById('yourTeam').innerHTML = teamList;
    }

    let upcomingHTML = '';
    players.forEach((p, idx) => {
        if (!p.sold) {
            const label = idx === currentIndex ? '<strong>▶</strong> ' : '';
            upcomingHTML += `<li>${label}${p.name} (${p.pos}) - Base $${p.base}</li>`;
        }
    });
    document.getElementById('upcomingPlayers').innerHTML = `<ul>${upcomingHTML}</ul>`;

    const captainNameDisplay = document.getElementById('captainNameDisplay');
    if (captainNameDisplay && myCapKey && caps[myCapKey]) {
      const capName = caps[myCapKey];
      captainNameDisplay.textContent = `Welcome, ${capName}`;
    } else if (captainNameDisplay) {
      // Fallback if captain info is not available
      captainNameDisplay.textContent = `Welcome, Captain`;
    }
  }

  // Viewer Page
  const viewerLivePlayer = document.getElementById('livePlayer');
  if (viewerLivePlayer) {
    if (cp?.sold) {
      const soldToCaptainName = cp.soldToCaptainId ? (caps[cp.soldToCaptainId.replace('captain','c')] || cp.soldToCaptainId) : 'N/A'; // Adjusted
      viewerLivePlayer.innerHTML = `<h3>Player Sold: ${cp.name} to ${soldToCaptainName} for $${cp.price}</h3>`;
    } else if (cp) {
      const currentBidderName = currentCaptain ? (caps[currentCaptain.replace('captain','c')] || currentCaptain) : '---'; // Adjusted
      viewerLivePlayer.innerHTML = `<h3>${cp.name} (${cp.pos}) - Base $${cp.base}<br/>Current Bid: $${currentBid} by ${currentBidderName}</h3><div id="timerDisplay">Time Left: ${getTimeRemaining()}s</div>`;
    } else if (currentIndex >= players.length && players.length > 0) {
      viewerLivePlayer.innerHTML = `<h3>Auction Ended.</h3>`;
    } else {
      viewerLivePlayer.innerHTML = `<h3>Auction starting soon...</h3>`;
    }
    updateTeamsUI();
  }
}

function updateTeamsUI() {
  const t1 = teams.captain1 ? teams.captain1.map(p => `<li>${p.name} (${p.pos}) - $${p.price}</li>`).join('') : '';
  const t2 = teams.captain2 ? teams.captain2.map(p => `<li>${p.name} (${p.pos}) - $${p.price}</li>`).join('') : '';
  const t3 = teams.captain3 ? teams.captain3.map(p => `<li>${p.name} (${p.pos}) - $${p.price}</li>`).join('') : ''; // New

  const list1Admin = document.getElementById('team1List');
  const list2Admin = document.getElementById('team2List');
  const list3Admin = document.getElementById('team3List'); // New
  const list1Viewer = document.getElementById('team1ViewerList');
  const list2Viewer = document.getElementById('team2ViewerList');
  const list3Viewer = document.getElementById('team3ViewerList'); // New

  if (list1Admin) list1Admin.innerHTML = t1;
  if (list2Admin) list2Admin.innerHTML = t2;
  if (list3Admin) list3Admin.innerHTML = t3; // New
  if (list1Viewer) list1Viewer.innerHTML = t1;
  if (list2Viewer) list2Viewer.innerHTML = t2;
  if (list3Viewer) list3Viewer.innerHTML = t3; // New

  const team1NameAdmin = document.getElementById('team1Name');
  const team2NameAdmin = document.getElementById('team2Name');
  const team3NameAdmin = document.getElementById('team3Name'); // New
  const team1NameViewer = document.getElementById('team1Viewer');
  const team2NameViewer = document.getElementById('team2Viewer');
  const team3NameViewer = document.getElementById('team3Viewer'); // New

  if (team1NameAdmin) team1NameAdmin.textContent = caps.c1 || 'Captain 1';
  if (team2NameAdmin) team2NameAdmin.textContent = caps.c2 || 'Captain 2';
  if (team3NameAdmin) team3NameAdmin.textContent = caps.c3 || 'Captain 3'; // New
  if (team1NameViewer) team1NameViewer.textContent = caps.c1 || 'Captain 1';
  if (team2NameViewer) team2NameViewer.textContent = caps.c2 || 'Captain 2';
  if (team3NameViewer) team3NameViewer.textContent = caps.c3 || 'Captain 3'; // New
}

function resetAuction() {
  const defaultState = {
    players: [],
    currentIndex: -1,
    currentBid: 0,
    currentCaptain: '',
    teams: { captain1: [], captain2: [], captain3: [] }, // New
    caps: { c1: 'Captain 1', c2: 'Captain 2', c3: 'Captain 3' }, // New
    budgets: { captain1: 10000, captain2: 10000, captain3: 10000 }, // New
    timerEndTime: null,
    biddingPermissions: { captain1: true, captain2: true, captain3: true } // Add to default state
  };
  set(auctionStateRef, defaultState).then(() => {
    alert("Auction has been reset. The page will now reload to reflect the changes.");
    location.reload();
  }).catch((error) => {
    console.error("Error resetting auction:", error);
    alert("Failed to reset auction. Check console for details.");
  });
}

// Function to handle changes in bidding permission checkboxes
function handlePermissionChange(captainKey, isChecked) {
  if (biddingPermissions.hasOwnProperty(captainKey)) {
    biddingPermissions[captainKey] = isChecked;
    updateFirebaseState();
  }
}

window.onload = () => {
  console.log("window.onload event triggered."); // Diagnostic log

  onValue(auctionStateRef, (snapshot) => {
    console.log("Firebase onValue callback triggered."); // Diagnostic log
    if (snapshot.exists()) {
      const data = snapshot.val();
      players = data.players || [];
      currentIndex = data.currentIndex ?? -1; // Use nullish coalescing for 0 index
      currentBid = data.currentBid || 0;
      currentCaptain = data.currentCaptain || '';
      teams = data.teams || { captain1: [], captain2: [], captain3: [] }; // Updated
      if (!Array.isArray(teams.captain1)) teams.captain1 = [];
      if (!Array.isArray(teams.captain2)) teams.captain2 = [];
      if (!Array.isArray(teams.captain3)) teams.captain3 = []; // New
      
      caps = data.caps || { c1: 'Captain 1', c2: 'Captain 2', c3: 'Captain 3' }; // Updated
      budgets = data.budgets || { captain1: 10000, captain2: 10000, captain3: 10000 }; // Updated
      timerEndTime = data.timerEndTime || null;
      biddingPermissions = data.biddingPermissions || { captain1: true, captain2: true, captain3: true }; // Load permissions
      console.log("Local state updated from Firebase snapshot."); // Diagnostic log
    } else {
      console.log("Firebase snapshot does not exist. Initializing with default local state."); // Diagnostic log
      // Firebase has no data, initialize with local defaults
      // This state will be pushed to Firebase if an admin action (like generateLinks or addPlayer) occurs.
      // Or, explicitly push default state here if desired for first-ever load.
      // For now, local defaults are set, and updateAllUI will render this.
      // If admin page is first to load and saves, it initializes Firebase.
        players = [];
        currentIndex = -1;
        currentBid = 0;
        currentCaptain = '';
        teams = { captain1: [], captain2: [], captain3: [] }; // Updated
        caps = { c1: 'Captain 1', c2: 'Captain 2', c3: 'Captain 3' }; // Updated
        budgets = { captain1: 10000, captain2: 10000, captain3: 10000 }; // Updated
        timerEndTime = null;
        biddingPermissions = { captain1: true, captain2: true, captain3: true }; // Initialize permissions
        // Consider calling updateFirebaseState() here if you want to ensure
        // Firebase is initialized with these defaults if it's empty.
        // updateFirebaseState(); // This would make this client initialize Firebase.
    }
    updateAllUI();
  });

  // Add event listeners for bidding permission checkboxes (Admin page)
  const c1AllowedCheckbox = document.getElementById('c1Allowed');
  const c2AllowedCheckbox = document.getElementById('c2Allowed');
  const c3AllowedCheckbox = document.getElementById('c3Allowed');

  if (c1AllowedCheckbox) {
    c1AllowedCheckbox.addEventListener('change', (e) => handlePermissionChange('captain1', e.target.checked));
  }
  if (c2AllowedCheckbox) {
    c2AllowedCheckbox.addEventListener('change', (e) => handlePermissionChange('captain2', e.target.checked));
  }
  if (c3AllowedCheckbox) {
    c3AllowedCheckbox.addEventListener('change', (e) => handlePermissionChange('captain3', e.target.checked));
  }

  setInterval(() => {
    const timeLeft = getTimeRemaining();
    if (timerEndTime && timeLeft === 0) {
      // Only one client should ideally trigger sellPlayer.
      // A simple check: if current player is not sold.
      // More robust solutions involve Cloud Functions or admin-only trigger.
      if (currentIndex >= 0 && currentIndex < players.length && players[currentIndex] && !players[currentIndex].sold) {
        // Check if this client is an admin or has a specific role to sell.
        // For simplicity, any client can trigger sell if timer ends. Firebase handles consistency.
        sellPlayer();
      }
    }
    // Update timer display continuously if it exists
    const timerDisplays = document.querySelectorAll('#timerDisplay');
    if (timerDisplays.length > 0) {
        const cp = (currentIndex >= 0 && currentIndex < players.length) ? players[currentIndex] : null;
        if (cp && !cp.sold && timerEndTime) {
            timerDisplays.forEach(el => el.textContent = `Time Left: ${timeLeft}s`);
        } else if (cp && cp.sold) {
            timerDisplays.forEach(el => el.textContent = `Time Left: 0s`);
        } else if (!cp && timeLeft === 0) { // No current player, timer display should be cleared or show 0
             timerDisplays.forEach(el => el.textContent = `Time Left: 0s`);
        }
    }
  }, 1000);

  // Expose functions to global scope for HTML onclick handlers
  window.generateLinks = generateLinks;
  window.copyLink = copyLink;
  window.addPlayer = addPlayer;
  window.startAuction = startAuction;
  window.nextPlayer = nextPlayer;
  window.placeBid = placeBid;
  window.resetAuction = resetAuction;
  // sellPlayer is called internally by timer or admin action

  console.log("Functions exposed to window object:", {
    generateLinksExists: typeof window.generateLinks === 'function',
    copyLinkExists: typeof window.copyLink === 'function',
    addPlayerExists: typeof window.addPlayer === 'function',
    startAuctionExists: typeof window.startAuction === 'function',
    nextPlayerExists: typeof window.nextPlayer === 'function',
    placeBidExists: typeof window.placeBid === 'function',
    resetAuctionExists: typeof window.resetAuction === 'function',
  }); // Diagnostic log
};
let gameData = {
  players: [],
  captains: {},
  teams: {},
  budget: 0
};

function getQueryParam(param) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(param);
}

if (document.getElementById("setupForm")) {
  document.getElementById("setupForm").addEventListener("submit", e => {
    e.preventDefault();
    const c1 = document.getElementById("captain1").value;
    const c2 = document.getElementById("captain2").value;
    const budget = parseInt(document.getElementById("budget").value);
    const playerLines = document.getElementById("players").value.trim().split("\n");

    gameData.captains = { [c1]: [], [c2]: [] };
    gameData.budget = budget;
    gameData.teams = { [c1]: [], [c2]: [] };
    gameData.players = playerLines.map(line => {
      const [name, role, pos] = line.split(",").map(p => p.trim());
      return { name, role, pos, bidBy: null };
    });

    sessionStorage.setItem("gameData", JSON.stringify(gameData));

    document.getElementById("captainLinks").innerHTML = `
      <div>
        <p>${c1}'s Link:
          <input type="text" id="link1" value="captain.html?name=${encodeURIComponent(c1)}" readonly>
          <button onclick="copyLink('link1')">Copy</button>
        </p>
        <p>${c2}'s Link:
          <input type="text" id="link2" value="captain.html?name=${encodeURIComponent(c2)}" readonly>
          <button onclick="copyLink('link2')">Copy</button>
        </p>
        <p>View Only:
          <input type="text" id="viewLink" value="view.html" readonly>
          <button onclick="copyLink('viewLink')">Copy</button>
        </p>
      </div>
    `;
  });

  window.copyLink = function (id) {
    const input = document.getElementById(id);
    input.select();
    input.setSelectionRange(0, 99999); // for mobile
    document.execCommand("copy");
    alert("Copied: " + input.value);
  };
}

if (window.location.pathname.includes("captain.html")) {
  const captain = getQueryParam("name");
  const stored = sessionStorage.getItem("gameData");
  if (!captain || !stored) {
    document.body.innerHTML = "<h2>Invalid or expired session</h2>";
  } else {
    gameData = JSON.parse(stored);
    document.getElementById("captainName").innerText = "Captain: " + captain;
    document.getElementById("budgetAmount").innerText = gameData.budget;

    const list = document.getElementById("playerList");
    gameData.players.forEach((p, i) => {
      if (!p.bidBy) {
        const div = document.createElement("div");
        div.innerHTML = `
          <strong>${p.name}</strong> (${p.role}, ${p.pos})
          <input type="number" id="bid${i}" placeholder="Bid ₹">
          <button onclick="placeBid(${i}, '${captain}')">Bid</button>
        `;
        list.appendChild(div);
      }
    });
  }
}

function placeBid(index, captain) {
  const bidVal = parseInt(document.getElementById("bid" + index).value);
  if (!bidVal || bidVal > gameData.budget) {
    alert("Invalid bid");
    return;
  }
  gameData.budget -= bidVal;
  gameData.players[index].bidBy = captain;
  gameData.teams[captain].push(gameData.players[index]);

  sessionStorage.setItem("gameData", JSON.stringify(gameData));
  location.reload();
}

if (window.location.pathname.includes("view.html")) {
  const stored = sessionStorage.getItem("gameData");
  if (!stored) {
    document.body.innerHTML = "<h2>No ongoing bidding session</h2>";
  } else {
    gameData = JSON.parse(stored);
    const [t1, t2] = Object.keys(gameData.teams);
    document.getElementById("team1Name").innerText = t1;
    document.getElementById("team2Name").innerText = t2;

    gameData.teams[t1].forEach(p => {
      const li = document.createElement("li");
      li.innerText = `${p.name} (${p.pos})`;
      document.getElementById("team1List").appendChild(li);
    });
    gameData.teams[t2].forEach(p => {
      const li = document.createElement("li");
      li.innerText = `${p.name} (${p.pos})`;
      document.getElementById("team2List").appendChild(li);
    });
  }
}
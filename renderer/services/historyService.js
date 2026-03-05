export async function addHistory(entry) {
  await window.api.addHistory(entry);
}

export async function loadHistory() {
  const list = document.getElementById("historyList");
  list.innerHTML = "";

  const history = await window.api.getHistory();

  history.forEach(entry => {
    const li = document.createElement("li");
    li.textContent = `${entry.name} (${entry.country}) - zuletzt gespielt: ${entry.lastPlayed}`;
    list.appendChild(li);
  });
}
export async function getFavorites() {
  return await window.api.getFavorites();
}

export async function loadFavorites() {
  const list = document.getElementById("favList");
  list.innerHTML = "";

  // DB über IPC im Main abrufen
  const favorites = await window.api.getFavorites();

  favorites.forEach(fav => {
    const li = document.createElement("li");
    li.textContent = `${fav.name} (${fav.country})`;
    list.appendChild(li);
  });
}

export async function addFavorite(fav) {
  await window.api.addFavorite(fav);
}
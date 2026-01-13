// js/search.js
export function initSearchComponent() {
  const input = document.getElementById('searchInput');
  const suggestions = document.getElementById('searchSuggestions');
  const searchIcon = document.getElementById('searchIcon');

  if (!input || !suggestions) return;

  let selectedType = null;

  /* =========================
     SEARCH FUNCTION
  ========================= */

  const runSearch = () => {
    const q = input.value.trim();
    const params = new URLSearchParams();

    // type filter
    if (selectedType) {
      params.set('type', selectedType);
    }

    // text search
    if (
      q &&
      !['Аренда', 'Туры', 'Все услуги'].includes(q)
    ) {
      params.set('q', q);
    }

    window.location.href = `/catalog.html?${params.toString()}`;
  };

  /* =========================
     SHOW / HIDE SUGGESTIONS
  ========================= */

  input.addEventListener('focus', () => {
    suggestions.style.display = 'block';
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-box')) {
      suggestions.style.display = 'none';
    }
  });

  /* =========================
     SUGGESTION CLICK
  ========================= */

  suggestions.querySelectorAll('.suggestion').forEach((el) => {
    el.addEventListener('click', () => {
      selectedType = el.dataset.type || null;
      input.value = el.textContent;
      suggestions.style.display = 'none';

      // 🔥 автопоиск
      runSearch();
    });
  });

  /* =========================
     ENTER KEY
  ========================= */

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      runSearch();
    }
  });

  /* =========================
     🔍 ICON CLICK (ШАГ 2.3)
  ========================= */

  searchIcon?.addEventListener('click', runSearch);
}

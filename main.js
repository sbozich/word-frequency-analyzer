document.addEventListener('DOMContentLoaded', () => {
  // ----- DOM refs -----
  const textInput = document.getElementById('text-input');
  const analyzeButton = document.getElementById('analyze-button');
  const languageSelect = document.getElementById('language-select');
  const themeToggle = document.getElementById('theme-toggle');
  const caseHandlingSelect = document.getElementById('case-handling');
  const stripPunctuationCheckbox = document.getElementById('strip-punctuation');
  const ignoreNumbersCheckbox = document.getElementById('ignore-numbers');
  const minWordLengthInput = document.getElementById('min-word-length');
  const stopwordFilteringCheckbox = document.getElementById('stopword-filtering');
  const phraseCountingSelect = document.getElementById('phrase-counting');
  const excludeCustomWordsInput = document.getElementById('exclude-custom-words');
  const largeTextWarning = document.getElementById('large-text-warning');

  const statTotalWords = document.getElementById('stat-total-words');
  const statUniqueWords = document.getElementById('stat-unique-words');
  const statLanguageUsed = document.getElementById('stat-language-used');
  const statStopwordsRemoved = document.getElementById('stat-stopwords-removed');
  const statMostFrequentWord = document.getElementById('stat-most-frequent-word');
  const statAnalysisTime = document.getElementById('stat-analysis-time');

  const wordFrequencyTableBody = document.querySelector('#word-frequency-table tbody');
  const wordFilterInput = document.getElementById('word-filter-input');
  const wordPageSizeSelect = document.getElementById('word-page-size');
  const wordPaginationInfo = document.getElementById('word-pagination-info');
  const wordPrevPageButton = document.getElementById('word-prev-page');
  const wordNextPageButton = document.getElementById('word-next-page');

  const phraseFrequencySection = document.getElementById('phrase-frequency-section');
  const phraseFrequencyTableBody = document.querySelector('#phrase-frequency-table tbody');
  const phraseFilterInput = document.getElementById('phrase-filter-input');
  const phrasePageSizeSelect = document.getElementById('phrase-page-size');
  const phrasePaginationInfo = document.getElementById('phrase-pagination-info');
  const phrasePrevPageButton = document.getElementById('phrase-prev-page');
  const phraseNextPageButton = document.getElementById('phrase-next-page');

    // set initial document language
  if (languageSelect) {
    document.documentElement.setAttribute('lang', languageSelect.value);
  }


  const fileUploadInput = document.getElementById('file-upload');
  const pasteButton = document.getElementById('paste-button');

    // ----- theme handling -----
  const THEME_STORAGE_KEY = 'tmseo-theme';

  function applyTheme(mode) {
    document.body.classList.toggle('dark', mode === 'dark');
    if (themeToggle) {
      themeToggle.textContent = mode === 'dark' ? 'Light mode' : 'Dark mode';
    }
  }

  let currentTheme = localStorage.getItem(THEME_STORAGE_KEY);
  if (!currentTheme) {
    const prefersDark =
      window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    currentTheme = prefersDark ? 'dark' : 'light';
  }
  applyTheme(currentTheme);

  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
      localStorage.setItem(THEME_STORAGE_KEY, currentTheme);
      applyTheme(currentTheme);
    });
  }

  // ----- state -----
  let currentStopwords = new Set();
  let currentWordResults = [];
  let currentPhraseResults = [];
  let wordCurrentPage = 1;
  let phraseCurrentPage = 1;

  const STOPWORD_SOURCES = {
    en: 'assets/stopwords/en.json',
    de: 'assets/stopwords/de.json',
    sx: 'assets/stopwords/sr-hr-bs.json'
  };

  // ----- helpers -----
  async function loadStopwords(lang) {
    const url = STOPWORD_SOURCES[lang] || STOPWORD_SOURCES.en;
    try {
      const res = await fetch(url);
      const arr = await res.json();
      currentStopwords = new Set(arr);
    } catch (err) {
      console.warn('Stopwords load failed for', lang, err);
      currentStopwords = new Set();
    }
  }

  function buildPhrases(tokens, n) {
    const map = new Map();
    if (tokens.length < n) return [];
    for (let i = 0; i <= tokens.length - n; i++) {
      const phrase = tokens.slice(i, i + n).join(' ');
      map.set(phrase, (map.get(phrase) || 0) + 1);
    }
    return Array.from(map.entries())
      .map(([phrase, count]) => ({ phrase, count }))
      .sort((a, b) => b.count - a.count);
  }

  function analyzeText(text, options) {
    let t = text;

    // normalize case
    if (options.caseHandling === 'lowercase_all') {
      t = t.toLowerCase();
    }

    // strip punctuation (browser-safe)
    if (options.stripPunctuation) {
      // keep letters, numbers, spaces
      t = t.replace(/[^\p{L}\p{N}\s]/gu, ' ');
    }

    // base tokens (used for phrases)
    let baseTokens = t.split(/\s+/).filter(Boolean);

    // ignore numbers
    if (options.ignoreNumbers) {
      baseTokens = baseTokens.filter(tok => !/^\d+$/.test(tok));
    }

    // custom excludes
    const excludeSet = new Set(
      options.excludeCustomWords
        .split(',')
        .map(x => x.trim().toLowerCase())
        .filter(Boolean)
    );
    if (excludeSet.size > 0) {
      baseTokens = baseTokens.filter(tok => !excludeSet.has(tok.toLowerCase()));
    }

    // word path
    const wordCounts = new Map();
    const wordTokens = [];
    let stopwordsRemoved = 0;

    for (const tok of baseTokens) {
      if (tok.length < options.minWordLength) continue;

      const tokForStop =
        options.caseHandling === 'lowercase_all' ? tok : tok.toLowerCase();
      if (options.stopwordFiltering && currentStopwords.has(tokForStop)) {
        stopwordsRemoved++;
        continue;
      }

      wordTokens.push(tok);
      wordCounts.set(tok, (wordCounts.get(tok) || 0) + 1);
    }

    const wordResults = Array.from(wordCounts.entries())
      .map(([word, count]) => ({ word, count }))
      .sort((a, b) => b.count - a.count);

    // phrase path (looser – uses baseTokens)
    let phraseResults = [];
    if (options.phraseCounting !== 'off') {
      const n = options.phraseCounting === 'bigrams' ? 2 : 3;
      phraseResults = buildPhrases(baseTokens, n);
    }

    return {
      wordResults,
      phraseResults,
      totalWords: wordTokens.length,
      uniqueWords: wordResults.length,
      stopwordsRemoved
    };
  }

  function updateUI(results) {
    // stats
    statTotalWords.textContent = results.totalWords;
    statUniqueWords.textContent = results.uniqueWords;
    statStopwordsRemoved.textContent = results.stopwordsRemoved;
    statMostFrequentWord.textContent =
      results.wordResults.length > 0 ? results.wordResults[0].word : '-';
    statLanguageUsed.textContent =
      languageSelect.options[languageSelect.selectedIndex].text;

    // store
    currentWordResults = results.wordResults;
    currentPhraseResults = results.phraseResults;

    // render word table
    wordCurrentPage = 1;
    wordFilterInput.value = '';
    renderTable('word');

    // render phrase table
    if (currentPhraseResults.length > 0) {
      phraseFrequencySection.style.display = 'block';
      phraseCurrentPage = 1;
      phraseFilterInput.value = '';
      renderTable('phrase');
    } else {
      phraseFrequencySection.style.display = 'none';
    }
  }



  function renderTable(type) {
    const data = type === 'word' ? currentWordResults : currentPhraseResults;
    const totalWords = parseInt(statTotalWords.textContent, 10) || 0;
    const tableBody =
      type === 'word' ? wordFrequencyTableBody : phraseFrequencyTableBody;
    const filterInput = type === 'word' ? wordFilterInput : phraseFilterInput;
    const pageSizeSelect =
      type === 'word' ? wordPageSizeSelect : phrasePageSizeSelect;
    let currentPage = type === 'word' ? wordCurrentPage : phraseCurrentPage;

    const filterText = filterInput.value.toLowerCase();
    const pageSize = parseInt(pageSizeSelect.value, 10);

    const filtered = filterText
      ? data.filter(item =>
          (type === 'word' ? item.word : item.phrase)
            .toLowerCase()
            .includes(filterText)
        )
      : data;

    const totalPages = Math.ceil(filtered.length / pageSize) || 1;
    currentPage = Math.min(currentPage, totalPages);
    if (type === 'word') {
      wordCurrentPage = currentPage;
    } else {
      phraseCurrentPage = currentPage;
    }

    const start = (currentPage - 1) * pageSize;
    const page = filtered.slice(start, start + pageSize);

    tableBody.innerHTML = '';
    if (page.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="4">No data to display.</td></tr>`;
    } else {
      page.forEach((item, idx) => {
        const row = tableBody.insertRow();
        row.insertCell(0).textContent = start + idx + 1;
        row.insertCell(1).textContent =
          type === 'word' ? item.word : item.phrase;
        row.insertCell(2).textContent = item.count;
        row.insertCell(3).textContent =
          totalWords > 0
            ? ((item.count / totalWords) * 100).toFixed(2) + '%'
            : '0.00%';
      });
    }

    updatePagination(type, totalPages, currentPage, filtered.length);
  }

  function updatePagination(type, totalPages, currentPage, totalItems) {
    const info =
      type === 'word' ? wordPaginationInfo : phrasePaginationInfo;
    const prevBtn =
      type === 'word' ? wordPrevPageButton : phrasePrevPageButton;
    const nextBtn =
      type === 'word' ? wordNextPageButton : phraseNextPageButton;

    info.textContent =
      totalItems > 0
        ? `Page ${currentPage} of ${totalPages} (${totalItems} items)`
        : '';
    prevBtn.disabled = currentPage <= 1;
    nextBtn.disabled = currentPage >= totalPages;
  }

  async function handleAnalysis() {
    const text = textInput.value;
    if (!text.trim()) {
      updateUI({
        wordResults: [],
        phraseResults: [],
        totalWords: 0,
        uniqueWords: 0,
        stopwordsRemoved: 0
      });
      statAnalysisTime.textContent = '0';
      largeTextWarning.style.display = 'none';
      return;
    }

    const start = performance.now();
    largeTextWarning.style.display = text.length > 50000 ? 'block' : 'none';

    const options = {
      caseHandling: caseHandlingSelect.value,
      stripPunctuation: stripPunctuationCheckbox.checked,
      ignoreNumbers: ignoreNumbersCheckbox.checked,
      minWordLength: parseInt(minWordLengthInput.value, 10) || 1,
      stopwordFiltering: stopwordFilteringCheckbox.checked,
      phraseCounting: phraseCountingSelect.value,
      excludeCustomWords: excludeCustomWordsInput.value
    };

    await loadStopwords(languageSelect.value);
    const results = analyzeText(text, options);
    updateUI(results);

    statAnalysisTime.textContent = (performance.now() - start).toFixed(2);
  }

  // ----- events -----
  analyzeButton.addEventListener('click', handleAnalysis);
  languageSelect.addEventListener('change', () => {
    document.documentElement.setAttribute('lang', languageSelect.value);
    handleAnalysis();
  });
  caseHandlingSelect.addEventListener('change', handleAnalysis);
  stripPunctuationCheckbox.addEventListener('change', handleAnalysis);
  ignoreNumbersCheckbox.addEventListener('change', handleAnalysis);
  minWordLengthInput.addEventListener('change', handleAnalysis);
  stopwordFilteringCheckbox.addEventListener('change', handleAnalysis);
  phraseCountingSelect.addEventListener('change', handleAnalysis);
  excludeCustomWordsInput.addEventListener('input', handleAnalysis);

  fileUploadInput.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      textInput.value = ev.target.result;
      handleAnalysis();
    };
    reader.readAsText(file);
  });

  pasteButton.addEventListener('click', async () => {
    try {
      const txt = await navigator.clipboard.readText();
      textInput.value = txt;
      handleAnalysis();
    } catch (err) {
      console.error(err);
    }
  });

  wordFilterInput.addEventListener('input', () => renderTable('word'));
  wordPageSizeSelect.addEventListener('change', () => {
    wordCurrentPage = 1;
    renderTable('word');
  });
  wordPrevPageButton.addEventListener('click', () => {
    wordCurrentPage = Math.max(1, wordCurrentPage - 1);
    renderTable('word');
  });
  wordNextPageButton.addEventListener('click', () => {
    wordCurrentPage += 1;
    renderTable('word');
  });

  phraseFilterInput.addEventListener('input', () => renderTable('phrase'));
  phrasePageSizeSelect.addEventListener('change', () => {
    phraseCurrentPage = 1;
    renderTable('phrase');
  });
  phrasePrevPageButton.addEventListener('click', () => {
    phraseCurrentPage = Math.max(1, phraseCurrentPage - 1);
    renderTable('phrase');
  });
  phraseNextPageButton.addEventListener('click', () => {
    phraseCurrentPage += 1;
    renderTable('phrase');
  });

  // ----- init -----
  const yearEl = document.getElementById('current-year');
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }
  loadStopwords(languageSelect.value);
});

(function() {
'use strict';

function CursedWordsIDBProvider(db) {
	throw new Error(
		'Do not call the constructor directly! Use CursedWordsIDBProvider.open() instead.');
}

CursedWordsIDBProvider.open = function(transcriptUrl, dbName, dbVersion) {
	return new CursedWordsTranslator.Request(function(resolve, reject) {
		dbName = dbName || 'CWTranscript';
		dbVersion = dbVersion || 1;
		
		var provider = Object.create(CursedWordsIDBProvider.prototype);
		var dbOpen = indexedDB.open(dbName, dbVersion);
		var transcriptReq;
		
		// TODO: dbOpen.onblocked
		
		dbOpen.onupgradeneeded = function(e) {
			console.log('Database is out of date');
			var db = dbOpen.result;
			
			db.onversionchange = function() {
				db.close();
				window.location.reload();
				alert('Database version changed in another tab! Reload required.');
			}
			
			if (e.oldVersion < 1) {
				var pageStore = db.createObjectStore('pages');
				var indexStore = db.createObjectStore('index');
			}
			
			console.log('Downloading transcript...');
			
			// Download and parse the transcript
			transcriptReq = new XMLHttpRequest();
			
			transcriptReq.open('GET', transcriptUrl);
			transcriptReq.responseType = 'document';
			
			transcriptReq.onload = function() {
				console.log('Transcript downloaded');
				var transaction = db.transaction(
					['pages', 'index'], 'readwrite');
				
				populateIDb(
					transaction.objectStore('pages'),
					transaction.objectStore('index'),
					transcriptReq.response.documentElement);
				
				provider.db = db;
				resolve(provider);
			};
			
			transcriptReq.onerror = reject;
			
			transcriptReq.send();
		};
		
		dbOpen.onsuccess = function(e) {
			if (!transcriptReq) {
				console.log('Database is up-to-date');
				provider.db = dbOpen.result;
				resolve(provider);
			}
		};
		
		dbOpen.onerror = reject;
		
		return function() {
			if (transcriptReq) transcriptReq.abort();
			dbOpen.abort();
		};
	});
};

// `word` can be an array.
CursedWordsIDBProvider.prototype.requestWord = function(chapter, page, word) {
	var db = this.db;
	
	return new CursedWordsTranslator.Request(function(resolve, reject) {
		var transaction = db.transaction('pages');
		transaction.onerror = reject;
		
		transaction.objectStore('pages')
			.get(chapter + ',' + page)
			.onsuccess = function() {
				if (this.result === undefined) {
					return reject(new Error("No such entry."));
				}
				
				if (Array.isArray(word)) {
					var results = [];
					
					for (var i = 0; i < word.length; i++) {
						results[i] = this.result[word[i - 1]];
					}
					
					resolve(results);
				} else {
					resolve(this.result[word - 1]);
				}
			};
		
		return transaction.abort.bind(transaction);
	});
};

CursedWordsIDBProvider.prototype.requestOccurrences = function(word) {
	var db = this.db;
	
	return new CursedWordsTranslator.Request(function(resolve, reject) {
		var transaction = db.transaction('index');
		transaction.onerror = reject;
		
		transaction.objectStore('index')
			.get(word)
			.onsuccess = function() {
				if (this.result === undefined) {
					return reject(new Error("No such entry."));
				}
				
				resolve(this.result);
			};
		
		return transaction.abort.bind(transaction);
	});
};

CursedWordsIDBProvider.prototype.requestSuggestions = function(prefix, maxCount) {
	maxCount = maxCount || 10;
	var db = this.db;
	
	return new CursedWordsTranslator.Request(function(resolve, reject) {
		var transaction = db.transaction('index');
		transaction.onerror = reject;
		
		var suggestions = [];
		
		transaction.objectStore('index')
			.openCursor(IDBKeyRange.bound(prefix, prefix + '\uFFFF'))
			.onsuccess = function() {
				if (this.result === undefined) {
					return reject(new Error("No such entry."));
				}
				
				if (this.result && this.result.key) {
					suggestions.push([
						this.result.key,
						this.result.key === prefix
							? Infinity // Ensure typed word is
							           // first, if found.
							: this.result.value.length]);
					this.result.continue();
				} else {
					resolve(suggestions.sort(function(a, b) {
						return b[1] - a[1];
					}).slice(0, maxCount).map(function(a) {
						return a[0];
					}));
				}
			};
		
		return transaction.abort.bind(transaction);
	});
};

var wordRE = /\S+/g;

function populateIDb(pageStore, indexStore, xmlRoot) {	
	var index = Object.create(null);
	// Iter chapters
	for (var chapEl = xmlRoot.firstElementChild;
			chapEl; chapEl = chapEl.nextElementSibling) {
		
		var chapNum = +chapEl.getAttribute('num');
		
		// Iter pages
		for (var pageEl = chapEl.firstElementChild;
				pageEl; pageEl = pageEl.nextElementSibling) {
			
			var pageNum = +pageEl.getAttribute('num'),
			    currPage = [];
			
			// Iter text
			for (var textEl = pageEl.firstChild; textEl;
					textEl = textEl.nextSibling) {
				
				var reResult;
				if (textEl.nodeType === Node.TEXT_NODE) {
					// Normal text. Add to both page and index.
					while (reResult = wordRE.exec(textEl.nodeValue)) {
						var word = reResult[0];
						var wordNum = currPage.push(word);
						var indexArr = index[word] || (index[word] = []);
						
						indexArr.push([chapNum, pageNum, wordNum]);
					}
				} else if (textEl.tagName
						&& textEl.tagName.toLowerCase() === 'lang') {
					// Text in a <lang> element. Add to page only.
					for (var langTextEl = textEl.firstChild; langTextEl;
							langTextEl = langTextEl.nextSibling) {
						while (reResult = wordRE.exec(langTextEl.nodeValue)) {
							currPage.push(reResult[0]);
						}
					}
				}
			}
			
			pageStore.add(currPage, chapNum + ',' + pageNum);
		}
	}

	for (var word in index) {
		indexStore.add(index[word], word);
	}
}

this.CursedWordsIDBProvider = CursedWordsIDBProvider;
}).call(this);

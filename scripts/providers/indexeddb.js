(function() {
'use strict';

var POS_INT_RE = /^\d+$/;

function CursedWordsIDBProvider(db) {
	throw new Error(
		'Do not call the constructor directly! Use CursedWordsIDBProvider.open() instead.');
}

CursedWordsIDBProvider.open = function(transcriptUrl, dbName, dbVersion) {
	return new CursedWordsTranslator.Request(function(resolve, reject) {
		dbName = dbName || 'CWTranscript';
		dbVersion = dbVersion || 1;

		var provider = Object.create(CursedWordsIDBProvider.prototype);
		try {
			var dbOpen = indexedDB.open(dbName, dbVersion);
		} catch (err) {
			console.log(err);
			return reject(err, true); // Try something else
		}
		var transcriptReq;

		dbOpen.onupgradeneeded = function(e) {
			console.log('Database is out of date');
			var db = dbOpen.result;

			if (e.oldVersion < 1) {
				db.createObjectStore('meta');
				db.createObjectStore('pages');
				db.createObjectStore('index');
			}

			console.log('Downloading transcript...');

			// Download and parse the transcript
			transcriptReq = new XMLHttpRequest();

			transcriptReq.open('GET', transcriptUrl);
			transcriptReq.setRequestHeader('Cache-Control', 'no-cache');
			transcriptReq.setRequestHeader('Cache-Control', 'max-age=0');
			transcriptReq.responseType = 'document';

			transcriptReq.onload = function() {
				if (this.status < 200 || this.status >= 300) {
					db.close();
					indexedDB.deleteDatabase(dbName);
					return reject(new Error('Failed to download transcript!'));
				}
				console.log('Transcript downloaded');

				var transaction, metaStore, pageStore, indexStore;
				try {
					transaction = db.transaction(
						['meta', 'pages', 'index'], 'readwrite');
					metaStore = transaction.objectStore('meta');
					pageStore = transaction.objectStore('pages');
					indexStore = transaction.objectStore('index');

					populateIDb(pageStore, indexStore,
						transcriptReq.response.documentElement);

					// TODO: Add "version" attr to transcript,
					// store that instead of this. If transcript version
					// is lower than db version, reload on page load.
					metaStore.add(true, 'verify');
				} catch (err) {
					console.error(err);
					db.close();
					indexedDB.deleteDatabase(dbName);
					return reject(
						new Error('Failed to parse transcript!'));
				}

				transaction.oncomplete = function() {
					provider.db = db;
					resolve(provider);
				};

				transaction.onerror = function() {
					console.error(transaction.error);
					db.close();
					indexedDB.deleteDatabase(dbName);
					reject(new Error('Failed to save transcript!'));
				};
			};

			transcriptReq.onerror = function(err) {
				console.error(err);
				db.close();
				indexedDB.deleteDatabase(dbName);
				reject(new Error('Failed to download transcript!'));
			};

			transcriptReq.send();
		};

		dbOpen.onsuccess = function(e) {
			if (transcriptReq) return;

			var db = dbOpen.result;
			var verifyRequest = db.transaction('meta')
				.objectStore('meta').get('verify');

			verifyRequest.onsuccess = function() {
				if (verifyRequest.result === true) {
					console.log('Database is up-to-date');
					provider.db = db;
					resolve(provider);
				} else {
					db.close();
					indexedDB.deleteDatabase(dbName);
					reject(new Error('Need to refresh the transcript! ' +
						'Please close all but one Cursed Words Translator ' +
						'tabs and reload.'));
				}
			};

			verifyRequest.onerror = function() {
				console.error(verifyRequest.error);
				db.close();
				indexedDB.deleteDatabase(dbName);
				reject(err);
			};
		};

		dbOpen.onblocked = function() {
			alert('Failed to refresh the transcript! Please close all ' +
				'but one Cursed Words Translator tabs and reload.');
		};

		dbOpen.onerror = function() {
			console.error(dbOpen.error);
			indexedDB.deleteDatabase(dbName);
			var myErr = new Error('Unable to open indexedDB!');
			reject(myErr, true); // Try something else
		};

		return function() {
			if (transcriptReq) transcriptReq.abort();
			dbOpen.abort();
		};
	});
};

CursedWordsIDBProvider.prototype.purge = function() {
	var name = this.db.name;
	this.db.close();
	indexedDB.deleteDatabase(name);
};

CursedWordsIDBProvider.prototype.requestWord = function(chapter, page, word) {
	var db = this.db;

	return new CursedWordsTranslator.Request(function(resolve, reject) {
		var transaction = db.transaction('pages');
		transaction.onerror = reject;

		transaction.objectStore('pages')
			.get(chapter + ',' + page)
			.onsuccess = function() {
				if (this.result === undefined) {
					return reject(new Error('No such entry.'));
				}

				var result = this.result[word - 1];

				if (result === undefined) {
					return reject(new Error('No such entry.'));
				}

				resolve(result);
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
					return reject(new Error('No such entry.'));
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
					return reject(new Error('No such entry.'));
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

function populateIDb(pageStore, indexStore, transcriptNode) {
	pageStore.clear();
	indexStore.clear();

	var walker = transcriptNode.ownerDocument.createTreeWalker(
		transcriptNode,
		NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
		null, true);

	var index = Object.create(null);

	// Iter over chapters
	walker.firstChild();
	do {
		if (walker.currentNode.tagName !== 'chapter') continue;

		var chapNumStr = walker.currentNode.getAttribute('num');
		if (!POS_INT_RE.test(chapNumStr)) {
			console.error('Invalid chapter number: ', walker.currentNode);
			continue;
		}
		var chapNum = +chapNumStr;

		// Enter chapter
		walker.firstChild();
		do {
			if (walker.currentNode.tagName !== 'page') continue;

			var pageNumStr = walker.currentNode.getAttribute('num');
			if (!POS_INT_RE.test(pageNumStr)) {
				console.error('Invalid page number: ', walker.currentNode);
				continue;
			}
			var pageNum = +pageNumStr;

			var currPage = [];

			// Enter page
			walker.firstChild();
			do {

				var reResult;

				if (walker.currentNode.nodeType === Node.TEXT_NODE) {
					// Parse text
					while (reResult =
							wordRE.exec(walker.currentNode.nodeValue)) {
						var word = reResult[0];
						var wordNum = currPage.push(word);
						var indexArr = index[word] || (index[word] = []);

						indexArr.push([chapNum, pageNum, wordNum]);
					}
				} else if (walker.currentNode.tagName === 'lang') {
					// Enter language element
					walker.firstChild();
					do {
						if (walker.currentNode.nodeType === Node.TEXT_NODE) {
							// Parse text
							while (reResult =
									wordRE.exec(walker.currentNode.nodeValue)) {
								var word = reResult[0];
								currPage.push(word);
								// Do not add to index
							}
						}
					} while (walker.nextSibling());
					walker.parentNode();
					// End of language element
				}

			} while (walker.nextSibling());
			walker.parentNode();
			// End of page

			pageStore.add(currPage, chapNum + ',' + pageNum);

		} while (walker.nextSibling());
		walker.parentNode();
		// End of chapter

	} while (walker.nextSibling());
	// End of transcript

	for (var word in index) {
		indexStore.add(index[word], word);
	}
}

this.CursedWordsIDBProvider = CursedWordsIDBProvider;
}).call(this);

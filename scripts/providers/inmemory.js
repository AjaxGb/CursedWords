(function() {
'use strict';

function MultiTrie() {
	this.root = {
		next: Object.create(null),
	};
}

MultiTrie.prototype.add = function(key, value) {
	var currNode = this.root;
	
	for (var i = 0; i < key.length; i++) {
		var nextNode = currNode.next[key[i]];
		
		if (!nextNode) {
			nextNode = currNode.next[key[i]] = {
				next: Object.create(null),
			};
		}
		
		currNode = nextNode;
	}
	
	currNode.key = key;
	(currNode.values || (currNode.values = [])).push(value);
};

MultiTrie.prototype.getAll = function(key) {
	var currNode = this.root;
	
	for (var i = 0; i < key.length; i++) {
		currNode = currNode.next[key[i]];
		
		if (!currNode) return;
	}
	
	return currNode.values;
};

MultiTrie.prototype.getAllPrefix = function(prefix, maxCount) {
	var currNode = this.root;
	
	for (var i = 0; i < prefix.length; i++) {
		currNode = currNode.next[prefix[i]];
		
		if (!currNode) return;
	}
	
	var valueNodes = MultiTrie._getChildValueNodes(
		currNode, maxCount, prefix);
	
	var suggestions = [];
	for (var i = 0; i < valueNodes.length; i++) {
		suggestions[i] = valueNodes[i].key;
	}
	return suggestions;
};

MultiTrie._getChildValueNodes = function(currNode, maxCount, prefix) {
	var childValueNodes = [];
	
	if (currNode.values) {
		childValueNodes.push(currNode);
	}
	for (var c in currNode.next) {
		Array.prototype.push.apply(
			childValueNodes,
			MultiTrie._getChildValueNodes(
				currNode.next[c], maxCount, prefix));
	}
	
	childValueNodes.sort(function(a, b) {
		var aPriority = (a.key === prefix ? Infinity : a.length);
		var bPriority = (b.key === prefix ? Infinity : b.length);
		if (aPriority === bPriority) {
			// Alphabetical
			if (a.key > b.key) return 1;
			if (a.key < b.key) return -1;
			return 0;
		}
		return aPriority - bPriority;
	});
	
	if (childValueNodes.length > maxCount) {
		childValueNodes.length = maxCount;
	}
	
	return childValueNodes;
}

function CursedWordsInMemoryProvider(db) {
	throw new Error(
		'Do not call the constructor directly! Use CursedWordsInMemoryProvider.open() instead.');
}

CursedWordsInMemoryProvider.open = function(transcriptUrl) {
	return new CursedWordsTranslator.Request(function(resolve, reject) {
		
		var provider = Object.create(CursedWordsInMemoryProvider.prototype);
		provider.index = new MultiTrie();
		provider.pages = [];
		
		console.log('Downloading transcript...');
			
		// Download and parse the transcript
		var transcriptReq = new XMLHttpRequest();
		
		transcriptReq.open('GET', transcriptUrl);
		transcriptReq.responseType = 'document';
		
		transcriptReq.onload = function() {
			if (this.status < 200 || this.status >= 300) {
				return reject(new Error('Failed to download transcript!'));
			}
			console.log('Transcript downloaded');
			
			try {
				parseTranscript(provider.index, provider.pages,
					transcriptReq.response.documentElement);
			} catch (err) {
				return reject(
					new Error('Failed to parse transcript!'));
			}
			
			resolve(provider);
		};
		
		transcriptReq.onerror = function() {
			reject(new Error('Failed to download transcript!'));
		};
		
		transcriptReq.send();
		
		return transcriptReq.abort.bind(transcriptReq);
	});
};

CursedWordsInMemoryProvider.prototype.requestWord = function(chapter, page, word) {
	var pageList = this.pages[chapter - 1];
	
	return new CursedWordsTranslator.Request(function(resolve, reject) {
		if (!pageList) {
			return reject(new Error('No such entry.'));
		}
		
		var wordList = pageList[page - 1];
		
		if (!wordList) {
			return reject(new Error('No such entry.'));
		}
		
		var result = wordList[word - 1];
		
		if (result === undefined) {
			reject(new Error('No such entry.'));
		} else {
			resolve(result);
		}
	});
};

CursedWordsInMemoryProvider.prototype.requestOccurrences = function(word) {
	var result = this.index.getAll(word);
	
	return new CursedWordsTranslator.Request(function(resolve, reject) {
		if (result) {
			resolve(result.slice());
		} else {
			reject(new Error('No such entry.'));
		}
	});
};

CursedWordsInMemoryProvider.prototype.requestSuggestions = function(prefix, maxCount) {
	maxCount = maxCount || 10;
	var result = this.index.getAllPrefix(prefix, maxCount);
	
	return new CursedWordsTranslator.Request(function(resolve, reject) {
		if (result) {
			resolve(result);
		} else {
			reject(new Error('No such entry.'));
		}
	});
};

var wordRE = /\S+/g;

function parseTranscript(index, chapterList, transcriptNode) {
	
	var walker = transcriptNode.ownerDocument.createTreeWalker(
		transcriptNode,
		NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
		null, true);
	
	// Iter over chapters
	walker.firstChild();
	do {
		if (walker.currentNode.tagName !== 'chapter') continue;
		
		var chapNum = +walker.currentNode.getAttribute('num');
		
		if (!chapNum || chapNum < 0) {
			console.error('Invalid chapter number: ', walker.currentNode);
			continue;
		}
		
		var pageList = chapterList[chapNum - 1] = [];
		
		// Enter chapter
		walker.firstChild();
		do {
			if (walker.currentNode.tagName !== 'page') continue;
			
			var pageNum = +walker.currentNode.getAttribute('num');
			
			if (!pageNum || pageNum < 0) {
				console.error('Invalid page number: ', walker.currentNode);
				continue;
			}
			
			var currPage = pageList[pageNum - 1] = [];
			
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
						index.add(word, [chapNum, pageNum, wordNum]);
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
			
		} while (walker.nextSibling());
		walker.parentNode();
		// End of chapter
		
	} while (walker.nextSibling());
	// End of transcript
}

this.CursedWordsInMemoryProvider = CursedWordsInMemoryProvider;
}).call(this);

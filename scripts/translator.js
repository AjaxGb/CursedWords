'use strict';

function CursedWordsTranslator(provider, options) {
	this.provider = provider;

	options = options || {};

	this.avoidChaptersAbove4 = (options.avoidChaptersAbove4 === undefined) ?
		true : options.avoidChaptersAbove4;
}

CursedWordsTranslator.autoProvider = function(transcriptURL, dbVersion) {
	if (window.indexedDB) {
		return new CursedWordsTranslator.Request(function(resolve, reject) {
			CursedWordsIDBProvider
				.open(transcriptURL, 'CWTranscript', dbVersion)
				.onsuccess(resolve)
				.onerror(function(error, trySomethingElse) {
					if (trySomethingElse) {
						// The error was simple inability to open the
						// database. Fall back to in-memory provider.
						providerRequest = CursedWordsInMemoryProvider
							.open(transcriptURL)
							.onsuccess(resolve)
							.onerror(reject);
					} else {
						reject(error);
					}
				});
		});
	} else {
		return CursedWordsInMemoryProvider.open(transcriptURL);
	}
};

CursedWordsTranslator.wordRE = /\S+/g;
CursedWordsTranslator.explicitEntryRE = /^{(?:\w+:)?(\d+),(?:\w+:)?(\d+),(?:\w+:)?(\d+)}$/;

CursedWordsTranslator.missingSkull = new Skull(0, 'X', 0);
CursedWordsTranslator.missingSkullPair = [
	CursedWordsTranslator.missingSkull, CursedWordsTranslator.missingSkull
];

CursedWordsTranslator.blankSkull = new Skull(0, '', 0);
CursedWordsTranslator.blankSkullPair = [
	CursedWordsTranslator.blankSkull, CursedWordsTranslator.blankSkull
];

CursedWordsTranslator.makeBlankSkullArray = function(numPairs) {
	var arr = [];
	for (; numPairs > 0; numPairs--) {
		arr.push(CursedWordsTranslator.blankSkullPair);
	}
	return arr;
};

CursedWordsTranslator.markupToSkullPairs = function(markup) {
	var skulls = Skull.getAllInText(markup);
	var result = [];

	for (var i = 0; i < skulls.length; i += 2) {
		result.push(skulls.slice(i, i + 2));
	}

	return result;
};

CursedWordsTranslator.skullPairsToMarkup = function(skullPairs, pairsPerLine) {
	if (pairsPerLine === 0) {
		// No whitespace
		var plain = '';

		for (var i = 0; i < skullPairs.length; i++) {
			for (var j = 0; j < skullPairs[i].length; j++) {
				plain += skullPairs[i][j].markup.whole;
			}
		}

		return plain;
	}

	pairsPerLine = pairsPerLine || 2;

	var plain = '';

	for (var i = 0; i < skullPairs.length; i++) {
		if (i !== 0) {
			plain += (i % pairsPerLine === 0) ? '\n' : '  ';
		}
		for (var j = 0; j < skullPairs[i].length; j++) {
			if (j !== 0) plain += ' ';
			plain += skullPairs[i][j].markup.whole;
		}
	}

	return plain;
};

CursedWordsTranslator.plainToWords = function(plain) {
	var words = plain.toLowerCase().match(CursedWordsTranslator.wordRE);
	if (!words) words = [];

	return words;
};

CursedWordsTranslator.wordsToPlain = function(words) {
	var plain = '';

	for (var i = 0; i < words.length; i++) {
		if (i !== 0) plain += ' ';

		var word = words[i];

		if (Array.isArray(word)) {
			// CPW
			plain +=
				'{chap:' + word[0] +
				',page:' + word[1] +
				',word:' + word[2] + '}';
		} else if (typeof word === 'string') {
			plain += words[i].toUpperCase();
		} else if (word === Skull.MISSING) {
			plain += '{NOTFOUND}';
		} else if (word === Skull.PIRATE) {
			plain += '{PIRATE}';
		} else {
			throw new Error('Invalid word "' + word + '" found.');
		}
	}

	return plain;
}

CursedWordsTranslator.skullPairsToCPWs = function(skullPairs) {
	var cpws = [];

	for (var i = 0; i < skullPairs.length; i++) {
		var skull1 = skullPairs[i][0];
		var skull2 = skullPairs[i][1];

		if (!skull2) {
			// If there are an odd number of skulls,
			// the last skull will be unpaired.
			continue;
		}

		cpws.push(skull1.type || skull2.type || [
			(skull1.eyes + skull2.eyes)|0,
			(skull1.horns + '' + skull1.teeth)|0,
			(skull2.horns + '' + skull2.teeth)|0,
		]);
	}

	return cpws;
};

CursedWordsTranslator.cpwToSkullPair = function(chap, page, word) {
	// If array, spread
	word = chap[2] || word;
	page = chap[1] || page;
	chap = chap[0] || chap;

	var chapP1 = Math.floor(chap / 2);
	var chapP2 = chapP1;

	if (chap % 2 === 1) {
		// Odd number, split the difference randomly.
		if (Math.random() >= 0.5) {
			chapP1++;
		} else {
			chapP2++;
		}
	}

	return [
		new Skull(Math.floor(page / 10), chapP1, page % 10),
		new Skull(Math.floor(word / 10), chapP2, word % 10),
	];
};

CursedWordsTranslator.cpwToURL = function(cpw) {
	return 'http://www.paranatural.net/comic/chapter-'+cpw[0]+'-page-'+cpw[1];
};

CursedWordsTranslator.prototype.cpwsToWords = function(cpws) {
	var provider = this.provider;

	return CursedWordsTranslator.makeTranslation(cpws,
		function(cpw, indices, setWord, makeCallback, reject) {
			if (Array.isArray(cpw)) {
				var request = provider.requestWord(cpw[0], cpw[1], cpw[2])
					.onsuccess(makeCallback(indices))
					.onerror(makeCallback(indices, cpw));

				return function() {
					if (request.state === CursedWordsTranslator.Request.RUNNING) {
						request.abort();
					}
				};
			} else if (cpw === Skull.MISSING || cpw === Skull.PIRATE) {
				setWord(indices);
			} else {
				reject(new Error('Invalid CPW at indices ' + indices));
			}
		});
};

CursedWordsTranslator.prototype.wordsToSkullPairs = function(words) {
	var avoidChaptersAbove4 = this.avoidChaptersAbove4;
	var provider = this.provider;

	if (typeof words === 'string') {
		words = words.toLowerCase().match(CursedWordsTranslator.wordRE)
	}

	return CursedWordsTranslator.makeTranslation(words,
		function(word, indices, setWord, makeCallback, reject) {
			var explicit = CursedWordsTranslator.explicitEntryRE.exec(word);
			if (explicit) {
				// CPW is explicitly specified like {chap:1,page:2,word:3}
				setWord(indices,
					CursedWordsTranslator.cpwToSkullPair(
						+explicit[1], +explicit[2], +explicit[3]));
			} else if (word === '{notfound}') {
				// Missing word
				setWord(indices, CursedWordsTranslator.missingSkullPair);
			} else {
				var request = provider.requestOccurrences(word)
					.onsuccess(makeCallback(indices, function(indices, cpws) {
						var range = cpws.length;

						if (avoidChaptersAbove4) {
							// Restrict the range to entries from chapters 1-4,
							// unless none such exist.
							for (var i = range - 1; i >= 0; i--) {
								if (1 <= cpws[i][0] || cpws[i][0] <= 4) {
									// Found a valid entry; this and all
									// previous entries are good.
									range = i + 1;
									break;
								}
							}
							// If the loop runs through without finding any
							// valid entries, range will never be updated,
							// so all entries will be fair game.
						}

						var results = [];
						for (var i = indices.length - 1; i >= 0; i--) {
							var selection = Math.floor(Math.random() * range);
							results.push(
								CursedWordsTranslator.cpwToSkullPair(
									cpws[selection]));
						}

						return results;
					}))
					.onerror(makeCallback(indices,
						CursedWordsTranslator.missingSkullPair));

				return function() {
					if (request.state === CursedWordsTranslator.Request.RUNNING) {
						request.abort();
					}
				};
			}
		});
};

CursedWordsTranslator.prototype.getSuggestions = function(prefix, maxCount) {
	return this.provider.requestSuggestions(prefix.toLowerCase(), maxCount);
};

CursedWordsTranslator.Request = function(action) {
	var me = this;

	this.state = CursedWordsTranslator.Request.RUNNING;
	this._onprogress = [];
	this._onsuccess = [];
	this._onerror = [];
	this._onabort = [];
	this._isErrorCaught = false;

	function resolve() {
		// Takes an arbitrary number of arguments

		if (me.state !== CursedWordsTranslator.Request.RUNNING) {
			throw new Error('The request has already finalized.');
		} else {
			me.state = CursedWordsTranslator.Request.SUCCESS;
		}

		me.results = arguments;

		for (var i = 0; i < me._onsuccess.length; i++) {
			me._onsuccess[i].apply(me, arguments);
		}
	}

	function reject() {
		// Takes an arbitrary number of arguments

		if (me.state !== CursedWordsTranslator.Request.RUNNING) {
			throw new Error('The request has already finalized.');
		} else {
			me.state = CursedWordsTranslator.Request.ERROR;
		}

		me.errors = arguments;

		if (!me._isErrorCaught) {
			console.error.apply(console, arguments);
		}

		for (var i = 0; i < me._onerror.length; i++) {
			me._onerror[i].apply(me, arguments);
		}
	}

	function progress() {
		// Takes an arbitrary number of arguments

		if (me.state !== CursedWordsTranslator.Request.RUNNING) {
			throw new Error('The request has already finalized.');
		}

		for (var i = 0; i < me._onprogress.length; i++) {
			me._onprogress[i].apply(me, arguments);
		}
	}

	try {
		this._abort = action(resolve, reject, progress);
	} catch (error) {
		reject(error);
	}
};

CursedWordsTranslator.Request.RUNNING = 0;
CursedWordsTranslator.Request.SUCCESS = 1;
CursedWordsTranslator.Request.ERROR   = 2;
CursedWordsTranslator.Request.ABORTED = 3;

CursedWordsTranslator.Request.prototype.abort = function() {
	if (this.state !== CursedWordsTranslator.Request.RUNNING) {
		throw new Error('The request has already finalized.');
	} else {
		if (this._abort) this._abort();

		this.state = CursedWordsTranslator.Request.ABORTED;
	}

	for (var i = 0; i < this._onabort.length; i++) {
		this._onabort[i].call(this);
	}
};

CursedWordsTranslator.Request.prototype.onprogress = function(callback) {
	this._onprogress.push(callback);
	return this;
};

CursedWordsTranslator.Request.prototype.onsuccess = function(callback) {
	if (this.state === CursedWordsTranslator.Request.SUCCESS) {
		callback.apply(this, this.results);
	} else {
		this._onsuccess.push(callback);
	}
	return this;
};

CursedWordsTranslator.Request.prototype.onerror = function(callback) {
	this._isErrorCaught = true;
	if (this.state === CursedWordsTranslator.Request.ERROR) {
		callback.apply(this, this.errors);
	} else {
		this._onerror.push(callback);
	}
	return this;
};

CursedWordsTranslator.Request.prototype.onabort = function(callback) {
	if (this.state === CursedWordsTranslator.Request.ABORTED) {
		callback.call(this);
	} else {
		this._onabort.push(callback);
	}
	return this;
};

CursedWordsTranslator.Request.prototype.onfinalize = function(callback) {
	switch (this.state) {
	case CursedWordsTranslator.Request.RUNNING:
		this._onsuccess.push(callback);
		this._onerror.push(callback);
		this._onabort.push(callback);
		break;
	case CursedWordsTranslator.Request.SUCCESS:
		callback.apply(this, this.results);
		break;
	case CursedWordsTranslator.Request.ERROR:
		callback.apply(this, this.errors);
		break;
	case CursedWordsTranslator.Request.ABORTED:
		callback.call(this);
	}
	return this;
};

CursedWordsTranslator.makeTranslation = function Translation(input, process) {
	if (input.length === 0) {
		throw new Error('Passed zero-length input to a translation.');
	}

	return new CursedWordsTranslator.Request(function(resolve, reject, progress) {

		var inputMap = Object.create(null);
		for (var i = input.length - 1; i >= 0; i--) {
			// Create a dict that lists each value once,
			// along with all its occurences. Works for
			// primitives and arrays of primitives.
			(inputMap[input[i]] || (inputMap[input[i]] = {
				value: input[i],
				indices: []
			})).indices.push(i);
		}

		var output = [];

		var numTranslated = 0;
		var numTotal = input.length;
		var allTranslated = false;

		function setWord(index, word) {
			if (Array.isArray(index)) {
				// Array of indices
				for (var i = index.length - 1; i >= 0; i--) {
					var curr = index[i];

					if (output[curr] === undefined) numTranslated++;
					output[curr] = word || input[curr];

					progress(output[curr], curr);
				}
			} else {
				if (typeof index !== 'number') {
					throw new Error('Tried to set word at index ' + index);
				}

				// Single index
				if (output[index] === undefined) numTranslated++;
				output[index] = word || input[index];

				progress(output[index], index);
			}

			if (!allTranslated && numTranslated >= numTotal) {
				// Last one!
				allTranslated = true;
				resolve(output);
				return true;
			}

			return false;
		}

		function makeCallback(indices, value) {
			if (arguments.length > 1) {
				return function() {
					if (typeof value === 'function') {
						var args = [indices];
						args.push.apply(args, arguments);
						value = value.apply(null, args);

						if (Array.isArray(value)) {
							var lastOne = false;

							for (var i = value.length - 1; i >= 0; i--) {
								if (setWord(indices[i], value[i])) lastOne = true;
							}

							return lastOne;
						}
					}

					return setWord(indices, value);
				}
			} else {
				return function(word) {
					return setWord(indices, word);
				};
			}
		}

		var aborts = [];

		for (var key in inputMap) {
			var curr = inputMap[key];

			var abort = process(curr.value, curr.indices, setWord, makeCallback, reject);
			if (abort) aborts.push(abort);
		}

		return function() {
			for (var i = aborts.length - 1; i >= 0; i--) {
				aborts[i]();
			}
		};
	});
};

(function() {
'use strict';

function CursedWordsTranslator(provider, options) {
	this.provider = provider;
	
	options = options || {};
	
	this.avoidChaptersAbove4 = (options.avoidChaptersAbove4 === undefined) ?
		true : options.avoidChaptersAbove4;
}

CursedWordsTranslator.wordRE = /\S+/g;
CursedWordsTranslator.explicitEntryRE = /^{(?:\w+:)?(\d+),(?:\w+:)?(\d+),(?:\w+:)?(\d+)}$/;

CursedWordsTranslator.missingSkull = new Skull(0, 'X', 0);
CursedWordsTranslator.missingSkullPair = [CursedWordsTranslator.missingSkull, CursedWordsTranslator.missingSkull];

CursedWordsTranslator.markupToCPWs = function(markup) {
	var skulls = Skull.getAllInText(markup);
	var result = [];
	
	for (var i = 0; i < skulls.length; i += 2) {
		result.push(
			CursedWordsTranslator.skullPairToCPW(skulls[i], skulls[i + 1]));
	}
	
	return result;
};

CursedWordsTranslator.skullPairToCPW = function(skull1, skull2) {
	// If array, spread
	skull2 = skull1[1] || skull2;
	skull1 = skull1[0] || skull1;
	
	if (!skull2) {
		// If there are an odd number of skulls,
		// the last skull will be unpaired.
		return skull1;
	} else {
		return skull1.type || skull2.type || [
			(skull1.eyes + skull2.eyes)|0,
			(skull1.horns + '' + skull1.teeth)|0,
			(skull2.horns + '' + skull2.teeth)|0,
		];
	}
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

CursedWordsTranslator.prototype.markupToPlain = function(input) {
	var provider = this.provider;
	return CursedWordsTranslator.makeTranslation(
		(typeof input === 'string')
			? CursedWordsTranslator.markupToCPWs(input)
			: input,
		
		function(cpw, indices, setWord, makeCallback, reject) {
			if (Array.isArray(cpw)) {
				provider.requestWord(cpw[0], cpw[1], cpw[2])
					.onsuccess(makeCallback(indices))
					.onerror(reject);
			} else {
				setWord(indices);
			}
		});
};

CursedWordsTranslator.prototype.plainToSkullPairs = function(input) {
	var avoidChaptersAbove4 = this.avoidChaptersAbove4;
	var provider = this.provider;
	
	return CursedWordsTranslator.makeTranslation(
		(typeof input === 'string')
			? input.toLowerCase().match(CursedWordsTranslator.wordRE)
			: input,
		
		function(word, indices, setWord, makeCallback, reject) {
			var explicit = CursedWordsTranslator.explicitEntryRE.exec(word);
			if (explicit) {
				// CPW is explicitly specified like {chap:1,page:2,word:3}
				setWord(indices,
					CursedWordsTranslator.cpwToSkullPair(
						+explicit[1], +explicit[2], +explicit[3]));
			} else if (word.toUpperCase() === '{NOTFOUND}') {
				// Missing word
				setWord(i, CursedWordsTranslator.missingSkullPair);
			} else {
				provider.requestOccurrences(word)
					.onsuccess(makeCallback(indices, function(indices, cpws) {
						var range = cpws.length;
						
						if (avoidChaptersAbove4) {
							// Restrict the range to entries from chapter 4
							// and earlier, unless none such exist.
							for (var i = range - 1; i >= 0; i--) {
								if (cpws[i][0] <= 4) {
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
					.onerror(reject);
			}
		});
};

CursedWordsTranslator.Request = function(action) {
	var me = this;
	
	this.state = CursedWordsTranslator.Request.RUNNING;
	this._onprogress = [];
	this._onsuccess = [];
	this._onerror = [];
	this._onabort = [];
	
	function resolve(result) {
		if (me.state !== CursedWordsTranslator.Request.RUNNING) {
			throw 'Already finalized';
		} else {
			me.state = CursedWordsTranslator.Request.SUCCESS;
		}
		
		me.result = result;
		
		for (var i = me._onsuccess.length - 1; i >= 0; i--) {
			me._onsuccess[i](result);
		}
	}
	
	function reject(error) {
		if (me.state !== CursedWordsTranslator.Request.RUNNING) {
			throw 'Already finalized';
		} else {
			me.state = CursedWordsTranslator.Request.ERROR;
		}
		
		me.error = error;
		
		for (var i = me._onerror.length - 1; i >= 0; i--) {
			me._onerror[i](error);
		}
	}
	
	function progress(result) {
		if (me.state !== CursedWordsTranslator.Request.RUNNING) {
			throw 'Already finalized';
		}
		
		for (var i = me._onprogress.length - 1; i >= 0; i--) {
			me._onprogress[i](result);
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
CursedWordsTranslator.Request.ERROR = 2;
CursedWordsTranslator.Request.ABORTED = 3;

CursedWordsTranslator.Request.prototype.abort = function() {
	if (this.state !== CursedWordsTranslator.Request.RUNNING) {
		throw 'Already finalized';
	} else {
		this._abort();
		
		this.state = CursedWordsTranslator.Request.ABORTED;
	}
	
	for (var i = this._onabort.length - 1; i >= 0; i--) {
		this._onabort[i]();
	}
};

CursedWordsTranslator.Request.prototype.onprogress = function(callback) {
	this._onprogress.push(callback);
	return this;
};

CursedWordsTranslator.Request.prototype.onsuccess = function(callback) {
	if (this.state === CursedWordsTranslator.Request.SUCCESS) {
		callback(this.result);
	} else {
		this._onsuccess.push(callback);
	}
	return this;
};

CursedWordsTranslator.Request.prototype.onerror = function(callback) {
	if (this.state === CursedWordsTranslator.Request.ERROR) {
		callback(this.error);
	} else {
		this._onerror.push(callback);
	}
	return this;
};

CursedWordsTranslator.Request.prototype.onabort = function(callback) {
	if (this.state === CursedWordsTranslator.Request.ABORTED) {
		callback();
	} else {
		this._onabort.push(callback);
	}
	return this;
};

CursedWordsTranslator.makeTranslation = function Translation(input, process) {
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
		
		// Returns a function that, when called:
		//  - If `f` is provided, passes the index list and all arguments
		//    to `f` and then:
		//     - If result is a list, matches values to indices
		//     - Else, inserts the result at all listed indices.
		//  - If `f` is not provided, inserts its (one) argument directly at
		//    all indices.
		function makeCallback(indices, f) {
			if (f) {
				return function() {
					var args = [indices];
					args.push.apply(args, arguments);
					var value = f.apply(null, args);
					
					if (Array.isArray(value)) {
						var lastOne = false;
						
						for (var i = value.length - 1; i >= 0; i--) {
							if (setWord(indices[i], value[i])) lastOne = true;
						}
						
						return lastOne;
					} else {
						return setWord(indices, value);
					}
				}
			} else {
				return function(word) {
					return setWord(indices, word);
				};
			}
		}
		
		for (var key in inputMap) {
			var curr = inputMap[key];
			
			process(curr.value, curr.indices, setWord, makeCallback, reject);
		}
	});
};

this.CursedWordsTranslator = CursedWordsTranslator;
}).call(this);

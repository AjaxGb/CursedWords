var dbAddress = 'db/',
	db = {index:{}},
	wordRE = /\S+/g,
	missingSkullPair = [{markup:'(X)'},{markup:'(X)'}],
	suggest = {
		options: [],
		selected: 0,
		setSelection: function(i) {
			if (!suggest.options[suggest.selected]) return;
			suggest.options[suggest.selected].node.classList.remove('selected');
			suggest.selected=i.mod(suggest.options.length);
			suggest.options[suggest.selected].node.classList.add('selected');
		}
	},
	markupInput, plainInput, plainSuggest,
	manualInput, preferChaptersBelow4Input,
	suggestRequest, translator;
Number.prototype.mod = function(n) {
	return ((this % n) + n) % n;
}
Array.prototype.group = function(size) {
	var output = [];
	for (var i = 0; i < this.length; i += size) {
		output.push(this.slice(i, i + size));
	}
	return output;
}

function Translator(dbAddress, onready, scheme) {
	this.onready = onready;
	this.dbAddress = dbAddress;
	if(!scheme){
		if(dbAddress.slice(-1) === '/'){
			scheme = Translator.defaultSchemes.cached;
		}else if(window.indexedDB){
			scheme = Translator.defaultSchemes.indexedDB;
		}else{
			scheme = Translator.defaultSchemes.preloaded;
		}
	}
	for(var key in scheme){
		this[key] = scheme[key];
	}
	if(this.onstart) this.onstart();
	if(this.ready && this.onready) this.onready();
}

Translator.wordRE = /\S+/g;
Translator.nonAlphaRE = /[^A-Za-z]/;
Translator.nonAlphaNumRE = /[^A-Za-z0-9]/;
Translator.missingSkull = new Skull(0,'X');
Translator.missingSkullPair = [Translator.missingSkull, Translator.missingSkull];
Translator.defaultSchemes = {
	cached: {
		// The original scheme, makes dynamic requests to a pre-processed database
		// and caches them in JavaScript objects.
		// Mixed sync and async.
		scheme: 'cached',
		onstart: function() {
			this.ready = true;
			this.db = {index:{}};
		},
		// Callback takes (word - string?, c,p,w - integers)
		requestWord: function(chapter, page, word, callback) {
			if (chapter<1 || page<1 || word<1) {
				console.log(chapter,page,word,'too low');
				callback(undefined, chapter, page, word);
				return;
			}
			if(this.db[chapter]===undefined) this.db[chapter] = {};
			if(page >= this.db[chapter].deadPage ||
					(this.db[chapter][page] && word > this.db[chapter][page].length)){
				console.log(chapter,page,word,'known dead');
				callback(undefined, chapter, page, word);
			}else if(this.db[chapter][page] instanceof XMLHttpRequest){
				console.log(chapter,page,word,'tacked on to',this.db[chapter][page]);
				this.db[chapter][page].callbacks.push(callback);
			}else if(
					this.db[chapter][page]===undefined ||
					this.db[chapter][page][word-1]===undefined){
				console.log('retrieving',chapter,page,word);
				var xhttp = new XMLHttpRequest(), db = this.db;
				xhttp.callbacks = [callback];
				xhttp.onload = function(){
					if(xhttp.status>=200 && xhttp.status<300){ //success code
						db[chapter][page] = xhttp.responseText.match(Translator.wordRE);
						for(var i=xhttp.callbacks.length;i--;){
							if(xhttp.callbacks[i](db[chapter][page][word-1], chapter,page,word)) break;
						}
					}else{
						delete db[chapter][page];
						if(page < db[chapter].deadPage) db[chapter].deadPage = page;
						for(var i=xhttp.callbacks.length;i--;){
							if(xhttp.callbacks[i](undefined, chapter,page,word)) break;
						}
					}
				};
				xhttp.onabort = xhttp.onerror = xhttp.ontimeout = function(){
					delete db[chapter][page];
					if(page < db[chapter].deadPage) db[chapter].deadPage = page;
					for(var i=xhttp.callbacks.length;i--;){
						if(xhttp.callbacks[i](undefined, chapter,page,word)) break;
					}
				};
				xhttp.open('GET', this.dbAddress+'ch'+chapter+'/p'+page+'.txt', true);
				db[chapter][page] = xhttp;
				xhttp.send();
			}else{
				console.log(chapter,page,word,'already loaded');
				callback(this.db[chapter][page][word-1], chapter,page,word);
			}
		},
		requestOccurences: function(word, callback){
			if(this.db.index[word] instanceof XMLHttpRequest){
				console.log('tacked on to',this.db.index[word]);
				this.db.index[word].callbacks.push(callback);
			}else if(this.db.index[word]===undefined){
				console.log('retrieving',word);
				var xhttp = new XMLHttpRequest(), folder = word[0], db = this.db;
				if(Translator.nonAlphaRE.test(folder)){
					folder = '0';
				}
				xhttp.callbacks = [callback];
				xhttp.onload = function(){
					if(xhttp.status>=200 && xhttp.status<300){ //success code
						db.index[word] = xhttp.responseText.match(Translator.wordRE).map(function(occ,i){
							var occ = occ.split(','),
								cObj = 	 db[occ[0]] ||   (db[occ[0]] = {}),
								pArr = cObj[occ[1]] || (cObj[occ[1]] = []);
							pArr[occ[2]-1] = word;
							return occ;
						});
						for(var i=xhttp.callbacks.length;i--;){
							if(xhttp.callbacks[i](db.index[word], word)) break;
						}
					}else{
						delete db.index[word];
						for(var i=xhttp.callbacks.length;i--;){
							if(xhttp.callbacks[i](undefined, word)) break;
						}
					}
				};
				xhttp.onabort = xhttp.onerror = xhttp.ontimeout = function(){
					delete db.index[w];
					for(var i=xhttp.callbacks.length;i--;){
						if(xhttp.callbacks[i](undefined, word)) break;
					}
				};	
				xhttp.open('GET', this.dbAddress+'index/'+folder+'/'+this.encodeWord(word)+'.txt', true);
				db.index[word] = xhttp;
				xhttp.send();
			}else{
				console.log(word,'already loaded');
				xhttp.callbacks[i](this.db.index[word], word)
			}
		},
		requestSuggestions: function(prefix, callback, simultaneous){
			if(this.suggestRequest){
				if(!simultaneous || this.suggestRequest.prefix !== prefix){
					this.suggestRequest.abort();
				}else{
					this.suggestRequest.callbacks.push(callback);
					return;
				}
			}
			var xhttp = new XMLHttpRequest();
			xhttp.prefix = prefix;
			xhttp.callbacks = [callback];
			xhttp.onload = function(){
				if(xhttp.status>=200 && xhttp.status<300){ //success code
					for(var i=xhttp.callbacks.length;i--;){
						if(xhttp.callbacks[i](xhttp.responseText.match(Translator.wordRE), xhttp.prefix))
							break;
					}
				}else{
					for(var i=xhttp.callbacks.length;i--;){
						if(xhttp.callbacks[i](undefined, xhttp.prefix)) break;
					}
				}
			};
			xhttp.onabort = xhttp.onerror = xhttp.ontimeout = function(){
				for(var i=xhttp.callbacks.length;i--;){
					if(xhttp.callbacks[i](undefined, xhttp.prefix)) break;
				}
			}
			xhttp.open('GET', this.dbAddress+'suggest'+this.encodeWord(prefix,'/')+'s.txt', true);
			suggestRequest = xhttp;
			xhttp.send();
		},
		encodeWord: function(word,sep){
			sep = sep || '';
			word = word.toLowerCase();
			var fileName = sep;
			for(var i=0;i<word.length;++i){
				if(Translator.nonAlphaNumRE.test(word[i]))
					fileName += '-' + word[i] + '-';
				else
					fileName += word[i];
				fileName += sep;
			}
			return fileName;
		}
	},
	indexedDB: {
		// The entire transcript is requested as a single document, then processed
		// clientside and stored in indexedDB.
		// Async.
		onstart: function(){
			throw new Error('NYI');
		}
	},
	preloaded: {
		// The entire transcript is requested as a single document, then processed
		// clientside and stored in JavaScript objects.
		// Sync.
		onstart: function(){
			throw new Error('NYI');
		}
	}
}

Translator.parseSkullPair = function(skull1, skull2) {
	// If array, separate
	skull2 = skull1[1] || skull2;
	skull1 = skull1[0] || skull1;
	if (!skull2) {
		return skull1;
	} else {
		return skull1.type || skull2.type || [
			parseInt(skull1.eyes + skull2.eyes, 10),
			parseInt(skull1.horns + '' + skull1.teeth, 10),
			parseInt(skull2.horns + '' + skull2.teeth, 10)
		];
	}
}

Translator.unparseSkullPair = function(chap, page, word){
	word = chap[2] || word;
	page = chap[1] || page;
	chap = chap[0] || chap;
	var chapP1 = Math.floor(chap/2),
		chapP2 = chapP1;
	if(chap%2==1){ //odd
		if(Math.random() >= 0.5) ++chapP1;
		else ++chapP2;
	}
	return [new Skull(Math.floor(page/10),chapP1,page%10),
		new Skull(Math.floor(word/10),chapP2,word%10)];
}

Translator.makeWordCallback = function(input, i){
	return function(word,c,p,w){
		input[i] = word || [c,p,w];
		++input.filled;
		if(input.onword) input.onword(input[i], i, input);
		if(!input.finished && input.filled === input.length){
			input.finished = true;
			if(input.onfinished) input.onfinished(input);
			return true;
		}
	};
}

Translator.prototype.markupToPlain = function(input, onfinished, onword) {
	if (input.constructor === String) { //If not already parsed
		input = Skull.getAllInText(input).group(2)
			.map(Translator.parseSkullPair);
	} else { //Ensure copy
		input = input.slice();
	}
	input.filled = 0;
	input.finished = false;
	input.onword = onword;
	input.onfinished = onfinished;
	for (var i = 0; i < input.length; ++i) {
		var curr = input[i];
		if (curr.constructor === Array) {
			this.requestWord(curr[0],curr[1],curr[2],
				Translator.makeWordCallback(input, i));
		} else {
			++input.filled;
			if (input.onword) input.onword(curr, i, input);
		}
	}
	if (!input.finished && input.filled === input.length) {
		input.finished = true;
		if (input.onfinished) input.onfinished(input);
	}
}

Translator.prototype.plainToMarkup = function(input, onfinished, onword) {
	if (input.constructor === String) { //If not already parsed
		input = input.toLowerCase().match(Translator.wordRE);
	} else { //Ensure copy
		input = input.slice();
	}
	input.filled = 0;
	input.finished = false;
	input.onword = onword;
	input.onfinished = onfinished;
	for (var i = 0; i < input.length; ++i) {
		if (input[i][0] == '{' && input[i][input[i].length-1] == '}') {
			var explicit = input[i].slice(1,-1).split(',');
			if (explicit.length == 3) { // {chap:X,page:X,word:X}
				input[i] = Translator.unparseSkullPair(
					explicit[0].slice(explicit[0].lastIndexOf(':')+1),
					explicit[1].slice(explicit[1].lastIndexOf(':')+1),
					explicit[2].slice(explicit[2].lastIndexOf(':')+1)
				);
				++input.filled;
				if (input.onword) input.onword(input[i], i, input);
				continue;
			} else if (explicit.length == 0
					&& explicit[0].toUpperCase() === 'NOTFOUND') {
				input[i] = Translator.missingSkullPair;
				continue;
			}
		}
		this.requestSkulls(input[i], input, i);
	}
	markupInput.value = skullPairsToString(input);
	updateSkullDisplay();
}

window.addEventListener('load',function(){
	markupInput = document.getElementById('markupInput');
	plainInput = document.getElementById('plainInput');
	plainSuggest = document.getElementById('plainSuggest');
	manualInput = document.getElementById('manualCheck');
	preferChaptersBelow4Input = document.getElementById('preferCh4Check');
	translator = new Translator(dbAddress, )
	
	document.getElementById('markupButton').addEventListener('click',function(){
		markupToPlain();
	});
	markupInput.addEventListener('keydown',function(e){
		if((e.key === 'Enter' || e.keyCode === 13) && e.ctrlKey){
			markupToPlain();
			e.preventDefault();
		}
	});

	document.getElementById('plainButton').addEventListener('click',function(){
		plainToMarkup();
	});
	plainInput.addEventListener('keydown',function(e){
		getSuggestions();
		if(e.key === 'Enter' || e.keyCode === 13){
			if(e.ctrlKey){
				plainToMarkup();
			}else if(suggest.options.length>suggest.selected){
				insertSelection();
			}else{
				return;
			}
		}else if(suggest.options.length>suggest.selected){
			if(e.key === 'Tab' || e.keyCode === 9){
				insertSelection();
			}else if(e.key === 'ArrowUp' || e.keyCode === 38){
				suggest.setSelection(suggest.selected-1);
			}else if(e.key === 'ArrowDown' || e.keyCode === 40){
				suggest.setSelection(suggest.selected+1);
			}else if(e.key === 'Escape' || e.keyCode === 27){
				clearSuggestions();
			}else{
				return;
			}
		}else{
			return;
		}
		e.preventDefault();
	});
	plainInput.addEventListener('keyup',getSuggestions);
	plainInput.addEventListener('click',getSuggestions);
	plainInput.addEventListener('blur',clearSuggestions);
	
	var query = getQueryArgs();
	if(Object.keys(query).length){
		console.log('Query args:', query);
		if(query.plain && query.markup){
			plainInput.value = query.plain;
			markupInput.value = query.markup;
			updateSkullDisplay();
		}else if(query.plain){
			plainInput.value = query.plain;
			this.plainToMarkup();
		}else if(query.markup){
			markupInput.value = query.markup;
			updateSkullDisplay();
			this.markupToPlain();
		}
	}
});

window.addEventListener('popstate',function(e){
	if(e.state.plain || e.state.markup){
		plainInput.value = e.state.plain || '';
		markupInput.value = e.state.markup || '';
	}
	updateSkullDisplay();
});

function getQueryArgs(query){
	query = query || window.location.search.substring(1);
	if(!query) return {};
	return query.split('&').reduce(function(prev, curr){
		var p = curr.split('=');
		prev[decodeURIComponent(p[0])] = decodeURIComponent(p[1]);
		return prev;
	}, {});
}

function pushQueryArgs(query){
	if(!query) return;
	var search = '';
	for(var prop in query){
		search += '&'+encodeURIComponent(prop)+'='+encodeURIComponent(query[prop]);
	}
	var newurl = new URL(window.location.href);
	newurl.search = '?' + search.substr(1);
	window.history.pushState({plain:plainInput.value,markup:markupInput.value},'',newurl);
}

function markupToPlain(){
	var skulls = getSkullArray(markupInput.value);
	markupInput.value = plainInput.value = '';
	if(manualInput.checked){
		var pagesToOpen = {};
	}else{
		var outputArr = new Array(Math.floor(skulls.length/2));
		outputArr.filled = 0;
	}
	for(var i=1;i<skulls.length;i+=2){ // By twos
		var skull1 = skulls[i-1], skull2 = skulls[i];
		markupInput.value += skull1.markup+' '+skull2.markup;
		if(i<skulls.length-2){
			if(i%4==1) markupInput.value += '  ';
			else markupInput.value += '\n';
		}
		if(skull1.missing || skull2.missing){
			if(manualInput.checked){
				plainInput.value += '{NOTFOUND} ';
			}else{
				setPlainWord(outputArr,(i-1)/2,'{NOTFOUND}');
			}
		}else if(skull1.piece == 1 || skull2.piece == 1){
			if(manualInput.checked){
				plainInput.value += '{monkey} ';
			}else{
				setPlainWord(outputArr,(i-1)/2,'MONKEY');
			}
		}else{
			var chapter = parseInt(skull1.eyes + skull2.eyes,10);
			var page = parseInt(skull1.horns + '' + skull1.teeth,10);
			var word = parseInt(skull2.horns + '' + skull2.teeth,10);
			if(manualInput.checked){
				plainInput.value += '{chap:'+chapter+',page:'+page+',word:'+word+'} ';
				var address = 'http://www.paranatural.net/comic/chapter-' + chapter
				+ '-page-' + page;
				pagesToOpen[address] = true;
			}else{
				var errStr = '{chap:'+chapter+',page:'+page+',word:'+word+'}';
				outputArr[(i-1)/2] = errStr;
				requestWord(chapter,page,word,outputArr,(i-1)/2);
			}
		}
	}
	if(skulls.length%2!=0){
		markupInput.value += '\n\n'+skulls[skulls.length-1].markup;
	}
	if(manualInput.checked){
		for(var add in pagesToOpen){
			window.open(add).blur();
		}
		window.focus();
	}else{
		plainInput.value = outputArr.join(' ');
	}
}

function getSuggestions(){
	var prefix = getPrefix();
	if(prefix===suggest.prefix){
		return;
	}else{
		suggest.prefix = prefix;
	}
	if(prefix===undefined){
		clearSuggestions();
		return;
	}
	requestSuggestions(prefix,function(prefix,suggestions){
		if(prefix!==getPrefix())return;
		clearSuggestions();
		if(suggestions===undefined)return;
		for(var i=0;i<suggestions.length;++i){
			var li = document.createElement('LI');
			var pre = document.createElement('STRONG');
			pre.appendChild(document.createTextNode(prefix.toUpperCase()));
			li.appendChild(pre);
			li.appendChild(document.createTextNode(suggestions[i].substr(prefix.length).toUpperCase()));
			li.addEventListener('mousedown',function(e){
				suggest.setSelection(this.value);
				e.preventDefault();
			});
			li.addEventListener('dblclick',function(e){
				insertSelection();
				e.preventDefault();
			});
			li.value = i;
			plainSuggest.appendChild(li);
			suggest.options[i] = {node:li,value:suggestions[i].toUpperCase()};
		}
		plainSuggest.style.display = 'block';
		suggest.setSelection(0);
	});
}

function clearSuggestions(){
	while (plainSuggest.hasChildNodes()) {
		plainSuggest.removeChild(plainSuggest.firstChild);
	}
	plainSuggest.style.display = 'none';
	suggest.options = [];
	suggest.selected = 0;
	suggest.prefix = getPrefix();
}

function insertSelection(){
	if(suggest.options.length<=suggest.selected)return;
	var word = suggest.options[suggest.selected].value, index = plainInput.selectionEnd,
		before = plainInput.value.substr(0,index).replace(/\S+$/,''),
		after = plainInput.value.substr(index).replace(/^\S+/, ''),
		newIndex = before.length + word.length + 1;
	plainInput.value = before + word + ' ' + after;
	plainInput.setSelectionRange(newIndex, newIndex);
	clearSuggestions();
}

function getPrefix(){
	var index = plainInput.selectionEnd;
	if(plainInput.selectionStart!==index)return;
	var result = /\S*$/.exec(plainInput.value.substr(0,index)) + /^\S*/.exec(plainInput.value.substr(index));
	if(result)return result;
}

function getSkullArray(text){
	var skullRE = /([.!]*|\uD83D\uDC52)\(([oO0.]*|[xX])\)(\d?)/g,
		skulls = [], dat;
	while ((dat = skullRE.exec(text)) !== null) {
		skulls.push(new Skull(dat[1],dat[2],dat[3],dat[0]));
	}
	return skulls;
}

function setPlainWord(outputArr,index,value){
	if(value!==undefined){
		outputArr[index] = value.toUpperCase();
		plainInput.value = outputArr.join(' ');
	}
	if(++(outputArr.filled)>=outputArr.length){
		pushQueryArgs({markup:markupInput.value.trim()});
		return true;
	}
	return false;
}

function setSkullPair(outputArr,index,skullpair){
	outputArr[index] = skullpair || missingSkullPair;
	markupInput.value = skullPairsToString(outputArr);
	updateSkullDisplay();
	if(++(outputArr.filled)>=outputArr.length){
		pushQueryArgs({plain:plainInput.value.trim()});
		return true;
	}
	return false;
}

function skullPairFromCPW(chapter,page,word){
	var chapP1 = Math.floor(chapter/2),
		chapP2 = chapP1;
	if(chapter%2==1){ //odd
		if(Math.random() >= 0.5) ++chapP1;
		else ++chapP2;
	}
	return [new Skull(Math.floor(page/10),chapP1,page%10),
		new Skull(Math.floor(word/10),chapP2,word%10)];
}

function skullPairsToString(arr){
	var result = '';
	for(var i=0;i<arr.length;++i){
		if(arr[i] instanceof Array) result += arr[i][0].markup+' '+arr[i][1].markup;
		else result += '() ()';
		if(i<arr.length-1){
			if(i%2==0) result += '  ';
			else result += '\n';
		}
	}
	return result;
}

var badCharRE = /[^A-Za-z0-9]/;
function encodeWord(word,sep){
	if(sep===undefined)sep = '';
	word = word.toLowerCase();
	fileName = sep;
	for(var i=0;i<word.length;++i){
		if(word.charAt(i).match(badCharRE))
			fileName += '-' + word.charCodeAt(i) + '-';
		else
			fileName += word.charAt(i);
		fileName += sep;
	}
	return fileName;
}

function chooseSkulls(outputArr,indices,occurences){
	var range = -1;
	if(preferChaptersBelow4Input.checked){
		for(var i=occurences.length-1;i>=0;--i){
			if(occurences[i][0] <= 4){ // chapter <= 4
				range = i+1;
				break;
			}
		}
	}
	if(range<0){ // pref not set, or all entries above chapter 4
		range = occurences.length;
	}
	for(var i=0;i<indices.length;++i){
		var choice = occurences[Math.floor(Math.random() * range)];
		if(setSkullPair(outputArr, indices[i], skullPairFromCPW(choice[0],choice[1],choice[2])))
			break;
	}
}

function requestSuggestions(prefix,callback){
	if(suggestRequest!=undefined && suggestRequest.prefix!=prefix){
		suggestRequest.abort();
	}
	var req = dbAddress+'suggest'+encodeWord(prefix,'/')+'s.txt';
	var xhttp = new XMLHttpRequest();
	xhttp.prefix = prefix;
	xhttp.addEventListener('load',(function(x,c){
		return function(){
			if(x.status>=200 && x.status<300){ //success code
				c(x.prefix,x.responseText.match(wordRE));
			}else{
				c(x.prefix);
			}
		};
	})(xhttp,callback));
	var couldNotLoad = (function(x,c){
		return function(){
			c(x.prefix);
		};
	})(xhttp,callback);
	xhttp.addEventListener('abort',couldNotLoad);
	xhttp.addEventListener('error',couldNotLoad);
	xhttp.addEventListener('timeout',couldNotLoad);	
	xhttp.open('GET', req, true);
	suggestRequest = xhttp;
	xhttp.send();
}

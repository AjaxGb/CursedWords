var dbAddress = "db/",
	db = {index:{}}, markupInput, plainInput, plainSuggest,
	manualInput, preferChaptersBelow4Input, wordRE = /\S+/g,
	missingSkullPair = [{markup:"(X)"},{markup:"(X)"}],
	suggestRequest, suggest = {options:[],selected:0,setSelection:function(i){
		if(!suggest.options[suggest.selected])return;
		suggest.options[suggest.selected].node.classList.remove("selected");
		suggest.selected=i.mod(suggest.options.length);
		suggest.options[suggest.selected].node.classList.add("selected");
	}};
Number.prototype.mod = function(n) {
    return ((this % n) + n) % n;
}

window.addEventListener("load",function(){
	markupInput = document.getElementById("markupInput");
	plainInput = document.getElementById("plainInput");
	plainSuggest = document.getElementById("plainSuggest");
	manualInput = document.getElementById("manualCheck");
	preferChaptersBelow4Input = document.getElementById("preferCh4Check");
	
	document.getElementById("markupButton").addEventListener("click",function(){
		markupToPlain();
	});
	markupInput.addEventListener("keydown",function(e){
		if((e.key === "Enter" || e.keyCode === 13) && e.ctrlKey){
			markupToPlain();
			e.preventDefault();
		}
	});

	document.getElementById("plainButton").addEventListener("click",function(){
		plainToMarkup();
	});
	plainInput.addEventListener("keydown",function(e){
		getSuggestions();
		if(e.key === "Enter" || e.keyCode === 13){
			if(e.ctrlKey){
				plainToMarkup();
			}else if(suggest.options.length>suggest.selected){
				insertSelection();
			}else{
				return;
			}
		}else if(suggest.options.length>suggest.selected){
			if(e.key === "Tab" || e.keyCode === 9){
				insertSelection();
			}else if(e.key === "ArrowUp" || e.keyCode === 38){
				suggest.setSelection(suggest.selected-1);
			}else if(e.key === "ArrowDown" || e.keyCode === 40){
				suggest.setSelection(suggest.selected+1);
			}else if(e.key === "Escape" || e.keyCode === 27){
				clearSuggestions();
			}else{
				return;
			}
		}else{
			return;
		}
		e.preventDefault();
	});
	plainInput.addEventListener("keyup",getSuggestions);
	plainInput.addEventListener("click",getSuggestions);
	plainInput.addEventListener("blur",clearSuggestions);
	
	var query = getQueryArgs();
	if(Object.keys(query).length){
		console.log("Query args:", query);
		if(query.plain && query.markup){
			plainInput.value = query.plain;
			markupInput.value = query.markup;
			updateSkullDisplay();
		}else if(query.plain){
			plainInput.value = query.plain;
			plainToMarkup();
		}else if(query.markup){
			markupInput.value = query.markup;
			updateSkullDisplay();
			markupToPlain();
		}
	}
});

window.addEventListener("popstate",function(e){
	if(e.state.plain || e.state.markup){
		plainInput.value = e.state.plain || "";
		markupInput.value = e.state.markup || "";
	}
	updateSkullDisplay();
});

function getQueryArgs(query){
	query = query || window.location.search.substring(1);
	if(!query) return {};
	return query.split("&").reduce(function(prev, curr, i, arr){
		var p = curr.split("=");
		prev[decodeURIComponent(p[0])] = decodeURIComponent(p[1]);
		return prev;
	}, {});
}

function pushQueryArgs(query){
	if(!query)return;
	var search = "";
	for(var prop in query){
		search += "&"+encodeURIComponent(prop)+"="+encodeURIComponent(query[prop]);
	}
	var newurl = new URL(window.location.href);
	newurl.search = "?" + search.substr(1);
	window.history.pushState({plain:plainInput.value,markup:markupInput.value},"",newurl);
}

function markupToPlain(){
	var skulls = getSkullArray(markupInput.value);
	markupInput.value = plainInput.value = "";
	if(manualInput.checked){
		var pagesToOpen = {};
	}else{
		var outputArr = new Array(Math.floor(skulls.length/2));
		outputArr.filled = 0;
	}
	for(var i=1;i<skulls.length;i+=2){ // By twos
		var skull1 = skulls[i-1], skull2 = skulls[i];
		markupInput.value += skull1.markup+" "+skull2.markup;
		if(i<skulls.length-2){
			if(i%4==1) markupInput.value += "  ";
			else markupInput.value += "\n";
		}
		if(skull1.missing || skull2.missing){
			if(manualInput.checked){
				plainInput.value += "{NOTFOUND} ";
			}else{
				setPlainWord(outputArr,(i-1)/2,"{NOTFOUND}");
			}
		}else if(skull1.piece == 1 || skull2.piece == 1){
			if(manualInput.checked){
				plainInput.value += "{monkey} ";
			}else{
				setPlainWord(outputArr,(i-1)/2,"MONKEY");
			}
		}else{
			var chapter = parseInt(skull1.eyes + skull2.eyes,10);
			var page = parseInt(skull1.horns + "" + skull1.teeth,10);
			var word = parseInt(skull2.horns + "" + skull2.teeth,10);
			if(manualInput.checked){
				plainInput.value += "{chap:"+chapter+",page:"+page+",word:"+word+"} ";
				var address = "http://www.paranatural.net/comic/chapter-" + chapter
				+ "-page-" + page;
				pagesToOpen[address] = true;
			}else{
				var errStr = "{chap:"+chapter+",page:"+page+",word:"+word+"}";
				outputArr[(i-1)/2] = errStr;
				requestWord(chapter,page,word,outputArr,(i-1)/2);
			}
		}
	}
	if(skulls.length%2!=0){
		markupInput.value += "\n\n"+skulls[skulls.length-1].markup;
	}
	if(manualInput.checked){
		for(var add in pagesToOpen){
			window.open(add).blur();
		}
		window.focus();
	}else{
		plainInput.value = outputArr.join(" ");
	}
}

function plainToMarkup(){
	var input = plainInput.value.toLowerCase().trim().match(wordRE);
	if(!input) return;
	input.filled = 0;
	for(var i=0;i<input.length;++i){
		if(input[i].charAt(0)=="{" && input[i].charAt(input[i].length-1)=="}"){
			var explicit = input[i].slice(1,-1).split(",");
			if(explicit.length == 3){
				setSkullPair(input,i,skullPairFromCPW(
				explicit[0].slice(explicit[0].lastIndexOf(':')+1),
				explicit[1].slice(explicit[1].lastIndexOf(':')+1),
				explicit[2].slice(explicit[2].lastIndexOf(':')+1)));
				continue;
			}else if(explicit[0].toUpperCase() === "NOTFOUND"){
				setSkullPair(input,i);
				continue;
			}
		}
		requestSkulls(input[i],input,i);
	}
	markupInput.value = skullPairsToString(input);
	updateSkullDisplay();
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
			var li = document.createElement("LI");
			var pre = document.createElement("STRONG");
			pre.appendChild(document.createTextNode(prefix.toUpperCase()));
			li.appendChild(pre);
			li.appendChild(document.createTextNode(suggestions[i].substr(prefix.length).toUpperCase()));
			li.addEventListener("mousedown",function(e){
				suggest.setSelection(this.value);
				console.log(this.value);
				e.preventDefault();
			});
			li.addEventListener("dblclick",function(e){
				insertSelection();
				e.preventDefault();
			});
			li.value = i;
			plainSuggest.appendChild(li);
			suggest.options[i] = {node:li,value:suggestions[i].toUpperCase()};
		}
		plainSuggest.style.display = "block";
		suggest.setSelection(0);
	});
}

function clearSuggestions(){
	while (plainSuggest.hasChildNodes()) {
		plainSuggest.removeChild(plainSuggest.firstChild);
	}
	plainSuggest.style.display = "none";
	suggest.options = [];
	suggest.selected = 0;
	suggest.prefix = getPrefix();
}

function insertSelection(){
	if(suggest.options.length<=suggest.selected)return;
	var word = suggest.options[suggest.selected].value, index = plainInput.selectionEnd,
		before = plainInput.value.substr(0,index).replace(/\S+$/,""),
		after = plainInput.value.substr(index).replace(/^\S+/, ""),
		newIndex = before.length + word.length + 1;
	plainInput.value = before + word + " " + after;
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
	var skullRE = /([.!]*|\uD83D\uDC52)\(([oO0.]*|[xX])\)(\d?)/g;
	var skulls = [];
	var dat;
	while ((dat = skullRE.exec(text)) !== null) {
		skulls.push(new Skull(dat[1],dat[2],dat[3],dat[0]));
	}
	return skulls;
}

function setPlainWord(outputArr,index,value){
	if(value!==undefined){
		outputArr[index] = value.toUpperCase();
		plainInput.value = outputArr.join(" ");
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
	var result = "";
	for(var i=0;i<arr.length;++i){
		if(arr[i] instanceof Array) result += arr[i][0].markup+" "+arr[i][1].markup;
		else result += "() ()";
		if(i<arr.length-1){
			if(i%2==0) result += "  ";
			else result += "\n";
		}
	}
	return result;
}

var badCharRE = /[^A-Za-z0-9]/;
function encodeWord(word,sep){
	if(sep===undefined)sep = "";
	word = word.toLowerCase();
	fileName = sep;
	for(var i=0;i<word.length;++i){
		if(word.charAt(i).match(badCharRE))
			fileName += "-" + word.charCodeAt(i) + "-";
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

// "Database" functions go here.

function requestWord(chapter,page,word,outputArr,index){
	if(chapter<1||page<1||word<1){
		setPlainWord(outputArr, index);
		return;
	}
	if(db[chapter]===undefined) db[chapter] = {};
	if(page >= db[chapter].deadPage ||
			(db[chapter][page] && word >= db[chapter][page].deadWord)){
		console.log(chapter,page,word,"known dead");
		setPlainWord(outputArr, index);
	}else if(db[chapter][page]===undefined || db[chapter][page][word-1]===undefined){
		var req = dbAddress+"ch"+chapter+"/p"+page+".txt";
		console.log("retrieving",req);
		var xhttp = new XMLHttpRequest();
		xhttp.indices = [{i:index,w:word}];
		xhttp.addEventListener("load",(function(x,oA,c,p,w){
			return function(){
				if(x.status>=200 && x.status<300){ //success code
					db[c][p] = x.responseText.match(wordRE);
					db[c][p].deadWord = db[c][p].length + 1;
					for(var i=0;i<x.indices.length;++i){
						if(setPlainWord(oA,
							x.indices[i].i,
							db[c][p][x.indices[i].w-1] || undefined)) break;
					}
				}else{
					delete db[c][p];
					if(!(p > db[c].deadPage)) db[c].deadPage = p;
					for(var i=0;i<x.indices.length;++i){
						if(setPlainWord(oA, x.indices[i].i)) break;
					}
				}
			};
		})(xhttp,outputArr,chapter,page,word));
		var couldNotLoad = (function(x,oA,c,p){
			return function(){
				delete db[c][p];
				if(!(p > db[c].deadPage)) db[c].deadPage = p;
				for(var i=0;i<x.indices.length;++i){
					if(setPlainWord(oA, x.indices[i].i)) break;
				}
			};
		})(xhttp,outputArr,chapter,page);
		xhttp.addEventListener("abort",couldNotLoad);
		xhttp.addEventListener("error",couldNotLoad);
		xhttp.addEventListener("timeout",couldNotLoad);	
		xhttp.open("GET", req, true);
		db[chapter][page] = xhttp;
		xhttp.send();
	}else if(db[chapter][page] instanceof XMLHttpRequest){
		console.log("tacked on to",db[chapter][page]);
		db[chapter][page].indices.push({i:index,w:word});
	}else{
		console.log(chapter,page,word,"already loaded");
		setPlainWord(outputArr, index, db[chapter][page][word-1] || undefined);
	}
}

var nonAlphaRE = /[^A-Za-z]/;
function requestSkulls(word,outputArr,index){
	if(db.index[word]===undefined){
		var folder = word[0];
		if(nonAlphaRE.test(folder)){
			folder = "0";
		}
		var req = dbAddress+"index/"+folder+"/"+encodeWord(word)+".txt";
		console.log("retrieving",req);
		var xhttp = new XMLHttpRequest();
		xhttp.indices = [index];
		xhttp.addEventListener("load",(function(x,oA,w){
			return function(){
				if(x.status>=200 && x.status<300){ //success code
					db.index[w] = [];
					x.responseText.match(wordRE).forEach(function(v,i){
						var occs = v.split(",");
						db.index[w][i] = occs;
						if(!db[occs[0]])
							db[occs[0]] = {};
						if(!db[occs[0]][occs[1]])
							db[occs[0]][occs[1]] = [];
						db[occs[0]][occs[1]][occs[2]-1] = w;
					});
					chooseSkulls(oA, x.indices, db.index[w]);
				}else{
					delete db.index[w];
					for(var i=0;i<x.indices.length;++i){
						if(setSkullPair(oA, x.indices[i])) break;
					}
				}
			};
		})(xhttp,outputArr,word));
		var couldNotLoad = (function(x,oA,w){
			return function(){
				delete db.index[w];
				for(var i=0;i<x.indices.length;++i){
					if(setSkullPair(oA, x.indices[i])) break;
				}
			};
		})(xhttp,outputArr,word);
		xhttp.addEventListener("abort",couldNotLoad);
		xhttp.addEventListener("error",couldNotLoad);
		xhttp.addEventListener("timeout",couldNotLoad);	
		xhttp.open("GET", req, true);
		db.index[word] = xhttp;
		xhttp.send();
	}else if(db.index[word] instanceof XMLHttpRequest){
		console.log("tacked on to",db.index[word]);
		db.index[word].indices.push(index);
	}else{
		console.log(word,"already loaded");
		chooseSkulls(outputArr,[index],db.index[word]);
	}
}

function requestSuggestions(prefix,callback){
	if(suggestRequest!=undefined && suggestRequest.prefix!=prefix){
		suggestRequest.abort();
	}
	var req = dbAddress+"suggest"+encodeWord(prefix,"/")+"s.txt";
	var xhttp = new XMLHttpRequest();
	xhttp.prefix = prefix;
	xhttp.addEventListener("load",(function(x,c){
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
	xhttp.addEventListener("abort",couldNotLoad);
	xhttp.addEventListener("error",couldNotLoad);
	xhttp.addEventListener("timeout",couldNotLoad);	
	xhttp.open("GET", req, true);
	suggestRequest = xhttp;
	xhttp.send();
}

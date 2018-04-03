'use strict';

var suggest = {
	options: [],
	selected: 0,
	setSelection: function(i) {
		if (!suggest.options[suggest.selected]) return;
		suggest.options[suggest.selected].node.classList.remove('selected');
		suggest.selected=i.mod(suggest.options.length);
		suggest.options[suggest.selected].node.classList.add('selected');
	}
};
var markupInput, plainInput, manualInput, preferChaptersBelow4Input;
var plainSuggest;
var markupSkullPairs;
var translationRequest, suggestRequest;

function modulo(a, b) {
	return ((a % b) + b) % b;
}

function markupToPlain() {
	var skullPairs = CursedWordsTranslator.markupToSkullPairs(markupInput.value);
	var cpws = CursedWordsTranslator.skullPairsToCPWs(skullPairs);
	
	markupInput.value = CursedWordsTranslator.skullPairsToMarkup(skullPairs);
	plainInput.value = ''
	
	if (translationRequest) translationRequest.abort();
	
	translationRequest = translator.cpwsToPlain(cpws)
		.onfinalize(function() {
			translationRequest = undefined;
		})
		.onsuccess(function(words) {
			plainInput.value = CursedWordsTranslator.wordsToPlain(words);
			pushQueryArgs({
				markup: markupInput.value.trim()
			});
		});
}

window.addEventListener('DOMContentLoaded', function() {
	
	markupInput = document.getElementById('markupInput');
	plainInput = document.getElementById('plainInput');
	plainSuggest = document.getElementById('plainSuggest');
	// TODO: manualInput = document.getElementById('manualCheck');
	preferChaptersBelow4Input = document.getElementById('preferCh4Check');
	
	var query = getQueryArgs();
	if(Object.keys(query).length) {
		console.log('Query args:', query);
		if (query.plain && query.markup) {
			plainInput.value = query.plain;
			markupInput.value = query.markup;
			updateSkullDisplay();
		} else if (query.plain) {
			plainInput.value = query.plain;
			providerRequest.onsuccess(plainToMarkup);
		} else if (query.markup) {
			markupInput.value = query.markup;
			updateSkullDisplay();
			providerRequest.onsuccess(markupToPlain);
		}
	}
	
	providerRequest.onsuccess(function() {
		document.getElementById('markupButton').onclick = markupToPlain;
		
		markupInput.onkeydown = function(e) {
			if((e.key === 'Enter' || e.keyCode === 13) && e.ctrlKey){
				markupToPlain();
				e.preventDefault();
			}
		};
		
		//document.getElementById('plainButton').onclick = plainToMarkup;
	});
	
	// plainInput.addEventListener('keydown',function(e){
	// 	getSuggestions();
	// 	if(e.key === 'Enter' || e.keyCode === 13){
	// 		if(e.ctrlKey){
	// 			plainToMarkup();
	// 		}else if(suggest.options.length>suggest.selected){
	// 			insertSelection();
	// 		}else{
	// 			return;
	// 		}
	// 	}else if(suggest.options.length>suggest.selected){
	// 		if(e.key === 'Tab' || e.keyCode === 9){
	// 			insertSelection();
	// 		}else if(e.key === 'ArrowUp' || e.keyCode === 38){
	// 			suggest.setSelection(suggest.selected-1);
	// 		}else if(e.key === 'ArrowDown' || e.keyCode === 40){
	// 			suggest.setSelection(suggest.selected+1);
	// 		}else if(e.key === 'Escape' || e.keyCode === 27){
	// 			clearSuggestions();
	// 		}else{
	// 			return;
	// 		}
	// 	}else{
	// 		return;
	// 	}
	// 	e.preventDefault();
	// });
	// plainInput.addEventListener('keyup',getSuggestions);
	// plainInput.addEventListener('click',getSuggestions);
	// plainInput.addEventListener('blur',clearSuggestions);
});

window.addEventListener('popstate',function(e) {
	if (e.state.plain || e.state.markup) {
		plainInput.value = e.state.plain || '';
		markupInput.value = e.state.markup || '';
	}
	updateSkullDisplay();
});

function getQueryArgs(query) {
	query = query || window.location.search.substring(1);
	if (!query) return {};
	return query.split('&').reduce(function(prev, curr) {
		var p = curr.split('=');
		prev[decodeURIComponent(p[0])] = decodeURIComponent(p[1]);
		return prev;
	}, {});
}

function pushQueryArgs(query) {
	if (!query) return;
	var search = '';
	for (var prop in query) {
		search += '&' + encodeURIComponent(prop) +
			'=' + encodeURIComponent(query[prop]);
	}
	var newurl = location.protocol + '//' + location.host +
		location.pathname + '?' + search.substr(1) + location.hash;
	window.history.pushState({
		plain: plainInput.value,
		markup: markupInput.value
	}, '', newurl);
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

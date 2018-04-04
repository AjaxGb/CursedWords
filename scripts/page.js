'use strict';

var markupInput, plainInput, manualInput, preferChaptersBelow4Input;
var suggestions, plainSuggest;
var displaySkulls;
var translationRequest;

function updateDisplaySkulls(skullPairs, normalizeMarkup) {
	if (normalizeMarkup === undefined) normalizeMarkup = true;
	
	if (skullPairs) {
		if (!Array.isArray(skullPairs)) {
			skullPairs = CursedWordsTranslator.markupToSkullPairs(skullPairs);
		}
		displaySkulls = skullPairs;
	}
	
	if (normalizeMarkup) {
		markupInput.value = CursedWordsTranslator.skullPairsToMarkup(displaySkulls);
	}
}

function markupToPlain() {
	var skullPairs = CursedWordsTranslator.markupToSkullPairs(markupInput.value);
	var cpws = CursedWordsTranslator.skullPairsToCPWs(skullPairs);
	
	updateDisplaySkulls(skullPairs);
	plainInput.value = CursedWordsTranslator.wordsToPlain(cpws);
	
	if (translationRequest) translationRequest.abort();
	
	if (manualInput.checked) {
		// Open pages but do not run translation
		var pagesOpened = Object.create(null);
		
		for (var i = 0; i < cpws.length; i++) {
			var url = CursedWordsTranslator.cpwToURL(cpws[i]);
			
			if (!pagesOpened[url]) {
				pagesOpened[url] = true;
				window.open(url).blur();
			}
		}
		
		window.focus();
		alert();
		return;
	}
	
	translationRequest = translator.cpwsToWords(cpws);
	translationRequest
		.onfinalize(function() {
			translationRequest = undefined;
		})
		.onprogress(function(word, i) {
			cpws[i] = word;
			plainInput.value = CursedWordsTranslator.wordsToPlain(cpws);
		})
		.onsuccess(function(words) {
			plainInput.value = CursedWordsTranslator.wordsToPlain(words);
			pushQueryArgs({
				markup: markupInput.value.trim()
			});
		});
}

function plainToMarkup() {
	var words = CursedWordsTranslator.plainToWords(plainInput.value);
	
	updateDisplaySkulls(
		CursedWordsTranslator.makeBlankSkullArray(words.length));
	
	if (translationRequest) translationRequest.abort();
	
	translationRequest = translator.wordsToSkullPairs(words);
	translationRequest
		.onfinalize(function() {
			translationRequest = undefined;
		})
		.onprogress(function(skullPair, i) {
			displaySkulls[i] = skullPair;
			updateDisplaySkulls();
		})
		.onsuccess(function(skullPairs) {
			updateDisplaySkulls(skullPairs);
			pushQueryArgs({
				plain: plainInput.value.trim()
			});
		});
}

window.addEventListener('DOMContentLoaded', function() {
	
	markupInput = document.getElementById('markupInput');
	plainInput = document.getElementById('plainInput');
	plainSuggest = document.getElementById('plainSuggest');
	manualInput = document.getElementById('manualCheck');
	preferChaptersBelow4Input = document.getElementById('preferCh4Check');
	
	var query = getQueryArgs();
	if(Object.keys(query).length) {
		
		console.log('Query args:', query);
		
		if (query.plain && query.markup) {
			plainInput.value = query.plain;
			updateDisplaySkulls(query.markup);
		} else if (query.plain) {
			plainInput.value = query.plain;
			providerRequest.onsuccess(plainToMarkup);
		} else if (query.markup) {
			updateDisplaySkulls(query.markup);
			providerRequest.onsuccess(markupToPlain);
		}
	}
	
	providerRequest.onsuccess(function() {
		suggestions = new Suggestions(translator, plainInput, plainSuggest);
		
		document.getElementById('markupButton').onclick = markupToPlain;
		
		markupInput.onkeydown = function(e) {
			if((e.key === 'Enter' || e.keyCode === 13) && e.ctrlKey){
				markupToPlain();
				e.preventDefault();
			}
		};
		
		document.getElementById('plainButton').onclick = plainToMarkup;
		
		plainInput.addEventListener('keydown', function(e) {
			if ((e.key === 'Enter' || e.keyCode === 13) && e.ctrlKey) {
				plainToMarkup();
				e.preventDefault();
			}
		});
	});
});

window.addEventListener('popstate', function(e) {
	if (e.state && (e.state.plain || e.state.markup)) {
		plainInput.value = e.state.plain || '';
		markupInput.value = e.state.markup || '';
	}
	updateDisplaySkulls(markupInput.value);
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

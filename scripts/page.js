'use strict';

var markupInput, plainInput, manualInput;
var suggestions, plainSuggest;
var displaySkulls, skullRenderer;
var translationRequest;
var translator;
var providerRequest;

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

	if (skullRenderer) {
		skullRenderer.drawSkullPairs(displaySkulls);
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
				var newWindow = window.open(url);
				if (newWindow) newWindow.blur();
			}
		}

		window.focus();
		return;
	}

	if (cpws.length === 0) return;
	translationRequest = translator.cpwsToWords(cpws);
	// Ensure request is stored in variable before onfinalize
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
				markup: CursedWordsTranslator.skullPairsToMarkup(skullPairs, 0)
			});
		});
}

function plainToMarkup() {
	var words = CursedWordsTranslator.plainToWords(plainInput.value);

	updateDisplaySkulls(
		CursedWordsTranslator.makeBlankSkullArray(words.length));

	if (translationRequest) translationRequest.abort();

	if (words.length === 0) return;
	translationRequest = translator.wordsToSkullPairs(words);
	// Ensure request is stored in variable before onfinalize
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

	var markupButton = document.getElementById('markupButton');
	var plainButton = document.getElementById('plainButton');

	providerRequest = CursedWordsTranslator
		.autoProvider('transcript.xml', 4)
		.onsuccess(function(provider) {
			translator = new CursedWordsTranslator(provider);
		});
	markupButton.disabled = plainButton.disabled = false;

	skullRenderer = new SkullRenderer(document.getElementById('skullCanvas'));

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

		markupButton.onclick = markupToPlain;

		markupInput.addEventListener('keydown', function(e) {
			if((e.key === 'Enter' || e.keyCode === 13) && e.ctrlKey){
				markupToPlain();
				e.preventDefault();
			}
		});

		markupInput.addEventListener('input', function() {
			updateDisplaySkulls(markupInput.value, false);
		});

		plainButton.onclick = plainToMarkup;

		plainInput.addEventListener('keydown', function(e) {
			if ((e.key === 'Enter' || e.keyCode === 13) && e.ctrlKey) {
				plainToMarkup();
				e.preventDefault();
			}
		});

		var preferCh4Check = document.getElementById('preferCh4Check');
		translator.avoidChaptersAbove4 = preferCh4Check.checked;

		preferCh4Check.addEventListener('click', function() {
			translator.avoidChaptersAbove4 = preferCh4Check.checked;
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

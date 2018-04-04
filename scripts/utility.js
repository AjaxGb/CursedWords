'use strict';

window.addEventListener('DOMContentLoaded', function() {
	var exps = document.getElementsByClassName('expandableHeader');
	for (var i = exps.length - 1; i >= 0; i--) {
		exps[i].addEventListener('click', toggleExpand);
		exps[i].addEventListener('keydown', clickSelfOnEnter);
	}
	var butts = document.getElementsByClassName('copyMarkupButton');
	for (var lol = butts.length - 1; lol >= 0; lol--) {
		butts[lol].addEventListener('click', copyMarkup);
	}
});

function clickSelfOnEnter(e) {
	if (e.key === 'Enter' || e.keyCode === 13) {
		this.click();
	}
}

function toggleExpand() {
	var tabIndex, expandable = this.parentElement;
	if (expandable.classList.contains('minimized')) {
		expandable.classList.remove('minimized');
		tabIndex = 0;
	} else {
		expandable.classList.add('minimized');
		tabIndex = -1;
	}
	var tabbable = expandable.querySelectorAll('.expandableContent a, .expandableContent button');
	for (var i = tabbable.length - 1; i >= 0; i--) {
		tabbable[i].tabIndex = tabIndex;
	}
}

var selectedRow;
function copyMarkup() {
	if (selectedRow) {
		selectedRow.classList.remove('selectedRow');
	}
	selectedRow = this.parentElement.parentElement;
	selectedRow.classList.add('selectedRow');
	var tds = selectedRow.children;
	var noCorrections = tds[2].firstChild.classList.contains('emptyCode');
	var skulls = CursedWordsTranslator.markupToSkullPairs(
		tds[noCorrections ? 1 : 2].textContent);
	updateDisplaySkulls(skulls);
	if (history.pushState) {
		history.pushState({}, '');
	}
	window.scrollTo(0, 0);
}
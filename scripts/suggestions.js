(function() {
'use strict';

function modulo(a, b) {
	return ((a % b) + b) % b;
}

var startWithNonSpaceRE = /^\S/;

function Suggestions(translator, textArea, suggestionUL) {
	var me = this;
	
	this.translator = translator;
	
	this.textArea = textArea;
	this.suggestionUL = suggestionUL;
	
	this.options = [];
	this.selected = 0;
	
	this.prefix = '';
	this.request = undefined;
	
	suggestionUL.addEventListener('mousedown', function(e) {
		me.setSelection(+e.target.getAttribute('index'));
		e.preventDefault();
	});
	suggestionUL.addEventListener('dblclick', function(e) {
		me.setSelection(+e.target.getAttribute('index'));
		me.insertSelection();
		e.preventDefault();
	});
	
	var boundUpdate = this.updateSuggestions.bind(this);
	var boundClear = this.clearSuggestions.bind(this);
	textArea.addEventListener('keyup', boundUpdate);
	textArea.addEventListener('input', boundUpdate);
	textArea.addEventListener('click', boundUpdate);
	textArea.addEventListener('blur', boundClear);
	
	textArea.addEventListener('keydown', function(e) {
		me.updateSuggestions();
		if (!me.selectionExists()) return;
		
		if ((e.key === 'Enter' || e.keyCode === 13) && !e.ctrlKey) {
			me.insertSelection();
		} else if (e.key === 'Tab' || e.keyCode === 9) {
			me.insertSelection();
		} else if (e.key === 'ArrowUp' || e.keyCode === 38) {
			me.setSelection(me.selected - 1);
		}else if(e.key === 'ArrowDown' || e.keyCode === 40){
			me.setSelection(me.selected + 1);
		}else if(e.key === 'Escape' || e.keyCode === 27){
			me.clearSuggestions();
		}else{
			return;
		}
		e.preventDefault();
	});
}

Suggestions.prototype.selectionExists = function() {
	return !!this.options[this.selected];
};

Suggestions.prototype.setSelection = function(i) {
	if (this.options[this.selected]) {
		this.options[this.selected].element.className = '';
	}
	this.selected = modulo(i, this.options.length);
	if (this.options[this.selected]) {
		this.options[this.selected].element.className = 'selected';
	}
};

Suggestions.prototype.getWordUnderCaret = function() {
	if (this.textArea != document.activeElement ||
		this.textArea.selectionStart !== this.textArea.selectionEnd) {
		
		return '';
	}
	var index = this.textArea.selectionEnd;
	
	return (
		/\S*$/.exec(this.textArea.value.substr(0, index)) +
		/^\S*/.exec(this.textArea.value.substr(index))).toUpperCase();
};

Suggestions.prototype.clearSuggestions = function() {
	while (this.suggestionUL.lastChild) {
		this.suggestionUL.removeChild(this.suggestionUL.lastChild);
	}
	this.options = [];
	this.selected = 0;
	this.prefix = this.getWordUnderCaret();
};

Suggestions.prototype.insertSelection = function() {
	if (!this.options[this.selected]) return;
	
	var suggestion = this.options[this.selected].suggestion;
	var index = this.textArea.selectionEnd;
	
	var before = this.textArea.value.substr(0, index).replace(/\S+$/, '');
	var after = this.textArea.value.substr(index).replace(/^\S+/, '');
	var newIndex = before.length + suggestion.length + 1;
	
	var spacesAfterWord = startWithNonSpaceRE.test(after) ? '  ' : ' ';
	
	this.textArea.value = before + suggestion + spacesAfterWord + after;
	this.textArea.setSelectionRange(newIndex, newIndex);
	
	this.clearSuggestions();
};

Suggestions.prototype.updateSuggestions = function() {
	var newPrefix = this.getWordUnderCaret();
	var me = this;
	if (newPrefix === this.prefix) {
		return;
	}
	
	this.prefix = newPrefix;
	if (this.request) this.request.abort();
	
	if (!newPrefix) {
		this.clearSuggestions();
		return;
	}
	
	this.request = this.translator.getSuggestions(newPrefix);
	this.request
		.onfinalize(function() {
			me.request = undefined;
		})
		.onsuccess(function(suggestions) {
			if (newPrefix !== me.getWordUnderCaret()) return;
			
			me.clearSuggestions();
			
			for (var i = 0; i < suggestions.length; i++) {
				var suffix = suggestions[i].substr(newPrefix.length).toUpperCase();
				
				var suggestEl = document.createElement('li');
				var prefixEl = document.createElement('strong');
				prefixEl.appendChild(document.createTextNode(newPrefix));
				suggestEl.appendChild(prefixEl);
				suggestEl.appendChild(document.createTextNode(suffix));
				
				suggestEl.setAttribute('index', i);
				me.suggestionUL.appendChild(suggestEl);
				me.options[i] = {
					element: suggestEl,
					suggestion: suggestions[i].toUpperCase()
				};
			}
			
			me.setSelection(0);
		});
};

this.Suggestions = Suggestions;
}).call(this);

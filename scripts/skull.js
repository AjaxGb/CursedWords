'use strict';

function Skull(horns, eyes, teeth, markup) {
	// Horns
	if (Skull.hornRE.test(horns)) {
		// Unparsed normal horns
		this.horns = Skull.parseHorns(horns);
	} else if (horns == '\uD83D\uDC52') {
		// Straw hat easter egg
		this.type = Skull.PIRATE;
		this.markup = markup
			|| Skull.generateMarkup(0, eyes, teeth, this.type);
		return;
	} else {
		// Number of horns
		this.horns = horns|0;
	}
	
	// Eyes
	if (Skull.eyeRE.test(eyes)) {
		// Unparsed normal eyes
		this.eyes = 0;
		for (var i = eyes.length - 1; i >= 0; i--) {
			if (eyes[i] === '.') this.eyes++;
		}
	} else if (eyes === 'X' || eyes === 'x') {
		// Special "missing" skull
		this.type = Skull.MISSING;
		this.markup = markup
			|| Skull.generateMarkup(horns, 0, teeth, this.type);
		return;
	} else {
		// Number of filled eyes
		this.eyes = eyes|0;
	}
	
	this.teeth = teeth|0;
	this.markup = markup
		|| Skull.generateMarkup(this.horns, this.eyes, this.teeth);
	this.type = Skull.NORMAL;
}

Skull.parseHorns = function(str) {
	// Modified roman number parser. Sufficient for
	// parsing valid horn configurations.
	var foundLong = false, tally = 0;
	
	for (var i = 0; i < str.length; i++) {
		if (str[i] === '!') {
			// Equal to 5
			if (!foundLong) {
				// Dots found up to now should be
				// subtracted from total; think IV = 5 - 1
				foundLong = true;
				tally = -tally;
			}
			tally += 5;
		} else {
			// Assume a dot, equal to 1
			tally += 1;
		}
	}
	
	return tally;
}

Skull.unparseHorns = function(num) {
	// Modified roman numeral generator.
	// Again, sufficient for our needs.
	
	// 4 is the only time we'll use subtractive notation.
	// There is no X equivalent, so 9 for example is "!...."
	if (num === 4) return '.!';
	
	var str = '';
	while (num > 0) {
		if (num >= 5) {
			str += '!';
			num -= 5;
		} else {
			str += '.';
			num -= 1;
		}
	}
	
	return str;
}

Skull.generateMarkup = function(horns, eyes, teeth, type) {
	var markup = (type == Skull.PIRATE)
		? '\uD83D\uDC52('
		: Skull.unparseHorns(horns) + '(';
	
	eyes |= 0;
	if(type == Skull.MISSING) markup += 'X';
	else if (eyes <= 0) markup += 'oo';
	else if (eyes == 2) markup += '..';
	else if (eyes == 1) {
		markup += (Math.random() > 0.5) ? 'o.' : '.o';
	} else while(eyes--) markup += '.';
	
	markup += ')'
	if (teeth|0) markup += teeth;
	
	return markup;
}

Skull.getAllInText = function(input) {
	var skulls = [], dat;
	
	while ((dat = Skull.markupRE.exec(input)) !== null) {
		skulls.push(new Skull(dat[1], dat[2], dat[3], dat[0]));
	}
	
	return skulls;
}

Skull.markupRE = /([.!]*|\uD83D\uDC52)\(([oO0.]*|[xX])\)(\d?)/g;
Skull.hornRE = /^[.!]*$/;
Skull.eyeRE = /^[oO0.]*$/;
Skull.NORMAL  = 0;
Skull.MISSING = 1;
Skull.PIRATE  = 2;

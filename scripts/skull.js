'use strict';

function Skull(horns, eyes, teeth, markup) {
	if (arguments.length === 1) {
		var regexResult = Skull.markupSoloRE.exec(horns);
		if (!regexResult) throw new Error('Invalid markup');
		
		horns = regexResult[1];
		eyes = regexResult[2];
		teeth = regexResult[3];
		markup = regexResult[0];
	}
	
	this.markup = {};
	
	// Horns
	if (typeof eyes === 'string' && Skull.hornRE.test(horns)) {
		// Unparsed normal horns
		this.horns = Skull.parseHorns(horns);
		this.markup.horns = horns;
	} else if (horns == '\uD83D\uDC52') {
		// Straw hat easter egg
		this.type = Skull.PIRATE;
		this.horns = NaN;
		this.markup.horns = horns;
	} else {
		// Number of horns
		this.horns = Math.max(horns|0, 0);
		this.markup.horns = Skull.unparseHorns(this.horns);
	}
	
	// Eyes
	if (typeof eyes === 'string' && Skull.eyeRE.test(eyes)) {
		// Unparsed normal eyes
		this.eyes = 0;
		for (var i = eyes.length - 1; i >= 0; i--) {
			if (eyes[i] === '.') this.eyes++;
		}
		this.markup.eyes = eyes + '';
	} else if (eyes === 'X' || eyes === 'x') {
		// Special "missing" skull
		this.type = Skull.MISSING;
		this.eyes = NaN;
		this.markup.eyes = eyes;
	} else {
		// Number of filled eyes
		this.eyes = eyes = Math.max(eyes|0, 0);
		
		if (eyes === 2) {
			this.markup.eyes = '..';
		} else if (eyes === 1) {
			if (Math.random() > 0.5) {
				this.markup.eyes = 'o.';
			} else {
				this.markup.eyes = '.o';
			}
		} else if (eyes <= 0) {
			this.markup.eyes = 'oo';
		} else {
			var temp = '';
			while (eyes--) {
				temp += '.';
			}
			this.markup.eyes = temp;
		}
	}
	
	this.teeth = Math.min(Math.max(teeth|0, 0), 9);
	this.markup.teeth = (this.teeth) ? this.teeth + '' : '';
	
	this.markup.whole = markup ||
		this.markup.horns + '(' + this.markup.eyes + ')' + this.markup.teeth;
	this.type = this.type || Skull.NORMAL;
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
};

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
};

Skull.getAllInText = function(input) {
	var skulls = [], dat;
	
	while ((dat = Skull.markupGlobalRE.exec(input)) !== null) {
		skulls.push(new Skull(dat[1], dat[2], dat[3], dat[0]));
	}
	
	return skulls;
};

Skull.markupGlobalRE = /([.!]*|\uD83D\uDC52)\(([oO0.]*|[xX])\)(\d?)/g;
Skull.markupSoloRE = /^([.!]*|\uD83D\uDC52)\(([oO0.]*|[xX])\)(\d?)$/;
Skull.hornRE = /^[.!]*$/;
Skull.eyeRE = /^[oO0.]*$/;
Skull.NORMAL  = 0;
Skull.MISSING = 1;
Skull.PIRATE  = 2;

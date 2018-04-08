(function() {
'use strict';

var MAGIC = {
	marginX: 32,
	marginY: 50,
	
	inPairSpacing: 60,
	betweenPairsSpacing: 80,
	lineSpacing: 100,
	
	skullWidth: 50,
	skullHeight: 24,
	
	bezierNudge: 2,
	
	eyeRadius: 7.2,
	dotRadius: 3.2,
	
	jawNormalXInset: 10,
	jawSmallXInset: 12,
	
	lowerJawMinY: 32,
	lowerJawMaxY: 36,
	upperJawMinY: 13,
	upperJawMaxY: 17,
	
	teethLengthShort: 6,
	teethLengthLong: 10,
	
	jawLineWeight: 5,
	teethLineWeight: 4.5,
	
	scalpXInsetEnd: 1,
	scalpXInsetMiddle: 12,
	scalpMin: 8,
	scalpMax: 20,
	
	hornLengthShort: 8,
	hornLengthLong: 18,
	hornCurveShort: 0,
	hornCurveLong: 4,
	
	hornLineWeight: 4.4,
	
	xLeft: 2,
	xRight: 48,
	xHeight: 17.5,
	xLineWeight: 6.5,
};

function SkullRenderer(canvas) {
	this.canvas = canvas;
	this.ctx = canvas.getContext('2d');
	
	this.ctx.lineCap = 'round';
	this.ctx.fillStyle = '#FFF';
	this.ctx.strokeStyle = '#FFF';
}

SkullRenderer.strawHat = new Image(84, 77);
SkullRenderer.strawHat.src = 'pics/strawHatSkull.png';

SkullRenderer.prototype.drawSkullPairs = function(skullPairs) {
	
	this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
	if (!skullPairs || !skullPairs.length) return;
	
	var x = MAGIC.marginX;
	var y = MAGIC.marginY;
	
	for (var i = 0; i < skullPairs.length; i++) {
		
		this.drawSkull(x, y, skullPairs[i][0]);
		
		x += MAGIC.inPairSpacing;
		
		if (skullPairs[i].length > 1) {
			this.drawSkull(x, y, skullPairs[i][1]);
		}
		
		x += MAGIC.betweenPairsSpacing;
		
		if (x + MAGIC.inPairSpacing + MAGIC.skullWidth + MAGIC.marginX >=
			this.canvas.width) {
			
			x = MAGIC.marginX;
			y += MAGIC.lineSpacing;
		}
	}
};

var eyePosCache = [
	                        [],                         // 0
	                    [[25,  0]],                     // 1
	               [[15,  0], [35,  0]],                // 2
	          [[14,  5], [25, -8], [36,  5]],           // 3
	     [[13,  6], [17, -7], [33, -7], [37,  6]],      // 4
	[[10,  5], [17, -8], [25,  5], [33, -8], [40,  5]], // 5
];

SkullRenderer.prototype.drawSkull = function(x, y, skull) {
	// Draw custom pirate image if skull is piratical
	if (skull.type == Skull.PIRATE) {
		this.ctx.drawImage(SkullRenderer.strawHat, x - 17, y - 35, 84, 77);
		return;
	}
	
	var horns = skull.markup.horns;
	var eyes = skull.markup.eyes;
	var teeth = skull.teeth;
	var ctx = this.ctx;
	
	// Draw main skull
	ctx.beginPath();
	ctx.moveTo(x, y);
	ctx.bezierCurveTo( // Top
		x - MAGIC.bezierNudge,
		y + MAGIC.skullHeight,
		x + MAGIC.skullWidth + MAGIC.bezierNudge,
		y + MAGIC.skullHeight,
		x + MAGIC.skullWidth,
		y);
	ctx.bezierCurveTo( // Bottom
		x + MAGIC.skullWidth + MAGIC.bezierNudge,
		y - MAGIC.skullHeight,
		x - MAGIC.bezierNudge,
		y - MAGIC.skullHeight,
		x,
		y);
	ctx.fill();
	
	// Draw X and stop if skull is missing
	if (skull.type === Skull.MISSING) {
		ctx.strokeStyle = '#F00';
		ctx.lineCap = 'square';
		ctx.lineWidth = MAGIC.xLineWeight;
		
		ctx.beginPath();
		
		ctx.moveTo(
			x + MAGIC.xLeft,
			y + MAGIC.xHeight);
		ctx.lineTo(
			x + MAGIC.xRight,
			y - MAGIC.xHeight);
		
		ctx.moveTo(
			x + MAGIC.xLeft,
			y - MAGIC.xHeight);
		ctx.lineTo(
			x + MAGIC.xRight,
			y + MAGIC.xHeight);
		
		ctx.stroke();
		ctx.strokeStyle = '#FFF';
		ctx.lineCap = 'round';
		return;
	}
	
	// Draw teeth
	var topTeeth, bottomTeeth;
	
	if (teeth > 4) {
		// Some above, some below
		topTeeth = bottomTeeth = Math.floor(teeth / 2);
		if (teeth % 2 === 1) bottomTeeth++;
		
		// 3 is the smallest number of lower teeth possible;
		// draw a slightly smaller lower jaw.
		var lowerJawXInset = (bottomTeeth === 3)
			? MAGIC.jawSmallXInset
			: MAGIC.jawNormalXInset;
		
		// Draw lower jaw
		ctx.lineWidth = MAGIC.jawLineWeight;
		ctx.beginPath();
		
		ctx.moveTo(
			x + lowerJawXInset,
			y + MAGIC.lowerJawMinY);
		ctx.bezierCurveTo(
			x + lowerJawXInset,
			y + MAGIC.lowerJawMaxY,
			x + MAGIC.skullWidth - lowerJawXInset,
			y + MAGIC.lowerJawMaxY,
			x + MAGIC.skullWidth - lowerJawXInset,
			y + MAGIC.lowerJawMinY);
		
		ctx.stroke();
		
		// Draw lower teeth
		ctx.lineWidth = MAGIC.teethLineWeight;
		ctx.beginPath();
		
		drawSpikes(ctx,
			x + MAGIC.jawNormalXInset,
			y + MAGIC.lowerJawMinY,
			x + MAGIC.jawNormalXInset,
			y + MAGIC.lowerJawMaxY,
			x + MAGIC.skullWidth - MAGIC.jawNormalXInset,
			y + MAGIC.lowerJawMaxY,
			x + MAGIC.skullWidth - MAGIC.jawNormalXInset,
			y + MAGIC.lowerJawMinY,
			bottomTeeth, -MAGIC.teethLengthShort);
	} else {
		// No lower jaw
		topTeeth = teeth;
		bottomTeeth = 0;
		
		ctx.lineWidth = MAGIC.teethLineWeight;
		ctx.beginPath();
	}
	
	// Draw upper teeth
	drawSpikes(ctx,
		x + MAGIC.jawNormalXInset,
		y + MAGIC.upperJawMinY,
		x + MAGIC.jawNormalXInset,
		y + MAGIC.upperJawMaxY,
		x + MAGIC.skullWidth - MAGIC.jawNormalXInset,
		y + MAGIC.upperJawMaxY,
		x + MAGIC.skullWidth - MAGIC.jawNormalXInset,
		y + MAGIC.upperJawMinY,
		topTeeth, bottomTeeth > 0 ? MAGIC.teethLengthShort : MAGIC.teethLengthLong);
	ctx.stroke();
	
	// Draw horns
	ctx.lineWidth = MAGIC.hornLineWeight;
	ctx.beginPath();
	
	var hornLengths = [], curves = [];
	for (var i = 0; i < horns.length; i++) {
		if (horns[i] === '!') {
			hornLengths[i] = -MAGIC.hornLengthLong;
			curves[i] = MAGIC.hornCurveLong;
		} else {
			hornLengths[i] = -MAGIC.hornLengthShort;
			curves[i] = MAGIC.hornCurveShort;
		}
	}
	
	drawSpikes(ctx,
		x + MAGIC.scalpXInsetEnd,
		y - MAGIC.scalpMin,
		x + MAGIC.scalpXInsetMiddle,
		y - MAGIC.scalpMax,
		x + MAGIC.skullWidth - MAGIC.scalpXInsetMiddle,
		y - MAGIC.scalpMax,
		x + MAGIC.skullWidth - MAGIC.scalpXInsetEnd,
		y - MAGIC.scalpMin,
		horns.length, hornLengths, curves);
	ctx.stroke();
	
	// Draw eyes
	
	var eyePositions, eyeSpread;
	
	if (eyes.length < eyePosCache.length) {
		eyePositions = eyePosCache[eyes.length];
	} else {
		eyeSpread = MAGIC.skullWidth / (eyes.length + 1);
	}
	
	ctx.globalCompositeOperation = 'destination-out';
	ctx.beginPath();
	for (var i = 0; i < eyes.length; i++) {
		var eyeX = x + (eyePositions ? eyePositions[i][0] : (i + 1) * eyeSpread);
		var eyeY = y + (eyePositions ? eyePositions[i][1] : 0);
		
		circle(ctx, eyeX, eyeY, MAGIC.eyeRadius);
	}
	ctx.fill();
	
	ctx.globalCompositeOperation = 'source-over';
	ctx.beginPath();
	for (var i = 0; i < eyes.length; i++) {
		var eyeX = x + (eyePositions ? eyePositions[i][0] : (i + 1) * eyeSpread);
		var eyeY = y + (eyePositions ? eyePositions[i][1] : 0);
		
		if (eyes[i] === '.') {
			circle(ctx, eyeX, eyeY, MAGIC.dotRadius);
		}
	}
	ctx.fill();
}

function circle(ctx, x, y, r) {
	ctx.moveTo(x + r, y);
	ctx.arc(x, y, r, 0, 2 * Math.PI);
}

var teethTCache = [
	                          [],                          //0
	                        [0.50],                        //1
	                     [0.37, 0.63],                     //2
	                  [0.15, 0.50, 0.85],                  //3
	               [0.00, 0.38, 0.62, 1.00],               //4
	            [0.00, 0.32, 0.50, 0.68, 1.00],            //5
	         [0.00, 0.28, 0.43, 0.57, 0.72, 1.00],         //6
	      [0.00, 0.25, 0.38, 0.50, 0.62, 0.75, 1.00],      //7
	   [0.00, 0.23, 0.35, 0.45, 0.55, 0.65, 0.77, 1.00],   //8
	[0.00, 0.21, 0.33, 0.43, 0.50, 0.57, 0.67, 0.79, 1.00] //9
];
var hornTCache = [
	                          [],                          //0
	                        [0.50],                        //1
	                     [0.25, 0.75],                     //2
	                  [0.15, 0.50, 0.85],                  //3
	               [0.10, 0.37, 0.63, 0.90],               //4
	            [0.10, 0.30, 0.50, 0.70, 0.90],            //5
	         [0.10, 0.27, 0.43, 0.57, 0.73, 0.90],         //6
	      [0.10, 0.25, 0.38, 0.50, 0.62, 0.75, 0.90],      //7
	   [0.07, 0.20, 0.33, 0.44, 0.56, 0.68, 0.80, 0.93],   //8
	[0.05, 0.18, 0.30, 0.40, 0.50, 0.60, 0.70, 0.82, 0.95] //9
];
function drawSpikes(ctx, p0x,p0y,c0x,c0y,c1x,c1y,p1x,p1y, count, lengths, curves) {
	var cachedTs;
	if (curves) {
		cachedTs = hornTCache[count];
	} else {
		cachedTs = teethTCache[count];
	}
	
	var variableLength = Array.isArray(lengths);
	
	for (var i = 0; i < count; i++) {
		
		var t = cachedTs ? cachedTs[i] : (i / (count - 1));
		var length = variableLength ? lengths[i] : lengths;
		var curve = curves ? curves[i] : 0;
		var ptOn = pointOnBezier(p0x, p0y, c0x, c0y, c1x, c1y, p1x, p1y, t);
		
		ctx.moveTo(ptOn.x, ptOn.y - 1);
		
		if (!curves) {
			ctx.lineTo(ptOn.x, ptOn.y + length);
			continue;
		}
		
		var normal = normalToBezier(p0x, p0y, c0x, c0y, c1x, c1y, p1x, p1y, t);
		
		if (curve) {
			var curveMult = Math.min(Math.max(t * 4 - 2, -1), 1);
			
			ctx.bezierCurveTo(
				ptOn.x + curve * curveMult,
				ptOn.y + length / 3,
				ptOn.x + curve * curveMult,
				ptOn.y + 2 * length / 3,
				ptOn.x + curve * curveMult * curveMult * curveMult / 2,
				ptOn.y + length);
		} else {
			ctx.lineTo(
				ptOn.x + normal.x * length,
				ptOn.y + normal.y * length);
		}
	}
}

function pointOnBezier(p0x, p0y, c0x, c0y, c1x, c1y, p1x, p1y, t) {
	if (t <= 0) return {x: p0x, y: p0y};
	if (t >= 1) return {x: p1x, y: p1y};
	
	var oneMinusT = 1 - t;
	
	//step 1
	var Ax = (oneMinusT * p0x) + (t * c0x),
	    Ay = (oneMinusT * p0y) + (t * c0y),
	    Bx = (oneMinusT * c0x) + (t * c1x),
	    By = (oneMinusT * c0y) + (t * c1y),
	    Cx = (oneMinusT * c1x) + (t * p1x),
	    Cy = (oneMinusT * c1y) + (t * p1y),
	//step 2
	    Dx = (oneMinusT * Ax) + (t * Bx),
	    Dy = (oneMinusT * Ay) + (t * By),
	    Ex = (oneMinusT * Bx) + (t * Cx),
	    Ey = (oneMinusT * By) + (t * Cy);
	//step 3
	return {
		x: (oneMinusT * Dx) + (t * Ex),
		y: (oneMinusT * Dy) + (t * Ey)
	};
}

function normalToBezier(p0x, p0y, c0x, c0y, c1x, c1y, p1x, p1y, t) {
	if (t < 0) t = 0;
	else if (t > 1) t = 1;
	
	var oneMinusT = 1 - t;
	var x =
		3 * oneMinusT * oneMinusT * (c0x - p0x) +
		6 * t * oneMinusT * (c1x - c0x) +
		3 * t * t * (p1x - c1x);
	var y =
		3 * oneMinusT * oneMinusT * (c0y - p0y) +
		6 * t * oneMinusT * (c1y - c0y) +
		3 * t * t * (p1y - c1y);
	
	var mag = Math.sqrt(x * x + y * y);
	
	return {x: -y / mag, y: x / mag};
}

this.SkullRenderer = SkullRenderer;
}).call(this);

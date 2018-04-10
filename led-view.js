'use strict';
//
// Useful links, etc.
// https://en.wikipedia.org/wiki/Union_Pacific_/_Northwest_Line - 63 miles (Harvard), 50 miles (McHenry)
// https://en.wikipedia.org/wiki/Union_Pacific_/_West_Line - 44 miles
// https://en.wikipedia.org/wiki/Milwaukee_District_/_West_Line - 40 miles
// https://en.wikipedia.org/wiki/Union_Pacific_/_North_Line - 78 miles?
// https://en.wikipedia.org/wiki/Milwaukee_District_/_North_Line - 50 miles
// https://en.wikipedia.org/wiki/North_Central_Service - 56 miles

// dp3rs6 - geohash of palatine train station

//
// TODO: Log errors when the number of trains ≠ the number of LEDs
// TODO: Previous LEDs and current LEDs
// TODO: Rows of segments – use cursor to update
//

var _          = require('lodash');
var async      = require('async');
var bunyan     = require('bunyan');
var geohash    = require('latlon-geohash');
var geolib     = require('geolib');
var readLine   = require('readline');
var fs         = require('fs');
var ttys       = require('ttys');
var request    = require('request')

var log = bunyan.createLogger({ name : "led view", level : "error" });

var sharedConstants = require(process.cwd() + '/constants');

let GEOHASH_LENGTH  = sharedConstants.GEOHASH_LENGTH;
let linesNamesArray = sharedConstants.linesNamesArray;

// The linesObject object contains all of the LED geohashes for each segment
// of each spur for each line. The format is as follows:
//
//		{
//			<line_name_1> : [                                                            \
//				[                                                         \              |-- line array
//					{                                                     |              |   (array of
//						segment : <seg_index>                             |-- spur       |    spurs)
//						ledArray : [                       \              |   array      |
//							{                              |-- led        |   (array of  |
//								ledLat : <lat_degrees>,    |   array      |    segments) |
//								ledLon : <lon_degrees>,    |   (array of  |              |
//								geohash : <led_geohash>    |    leds)     |              |
//								geohashNeighbors : {       |              |              |
//									n: <neighbor_geohash>, |              |              |
//									ne: ...                |              |              |
//									e: ...                 |              |              |
//									se: ...                |              |              |
//									s: ...                 |              |              |
//									sw: ...                |              |              |
//									w: ...                 |              |              |
//									nw: ...                |              |              |
//								}                          |              |              |
//							},                             |              |              |
//							{                              |              |              |
//								<second_led>               |              |              |
//							},                             |              |              |
//							...                            |              |              |
//						]                                  /              |              |
//					},                                                    |              |
//					{                                                     |              |
//						<second_segment_object_properties>                |              |
//					},                                                    |              |
//					...                                                   |              |
//				],                                                        /              |
//				[                                                                        |
//					<second_spur_array_elements>                                         |
//				],                                                                       |
//				...                                                                      |
//				[                                                                        |
//					<nth_spur_array_elements>                                            |
//				]                                                                        |
//			],                                                                           /
//			<line_name_2> : [
//				...
//			],
//			...
//			<line_name_n> : [
//				...
//			]
//		}
//
// This structure is an object containing an array for each line, accessed via
// the line name, which is stored in the linesNameArray array. Each of these
// arrays is made up of an array for each spur that makes up the line. In most cases,
// there is only a single "main" spur for any given line, and in these cases,
// the line array will contain only a single spur array.
//
// Each spur array is an array of segment objects that correspond to the KML
// line segments that were used to create the line's data. Each segment object
// contains a "segment" attribute containing the segment's index and an "ledArray"
// that contains objects describing each LED in the segment.
//
// The LED objects contain an "ledLat" (latitude), "ledLon" (longitude), and
// a "geohash" attribute.
//
var linesObject = {};

// ledsToLight is organized by line, as is the linesObject. It contains an array
// for each line where each element contains a spur index, a segment index, and
// an LED index. In addition, it contains a spurLed property, which is the
// absolute LED index in a spur, which is likely to be a single LED strand.
//
// 		{
//			<line_name_1> : [
//					{
//						spur : <spur_index>,
//						segment : <segment_index>,
//						segmentLed : <led_index>,
//						spurLed : <spur_led_index>
//					},
//					<second_led_object>,
//					...
//				],
//			<line_name_2> : ...
//			...
//		}
//
var ledsToLight = {};

////////////////////////////////////////////////////////////////////////////////
// PREPARE LINES DATA
//
function init(done) {
	log.debug("populateLineObjects()");
	var linePopulateFunctions = [];
	linesNamesArray.forEach((lineName, index, array) => {
		linePopulateFunctions.push(_.partial(getLineData, lineName, _));
	});
	async.series(
		linePopulateFunctions,
		(error, results) => {
			if (error) {
				done(error, null);
			}
			else {
				// results[0] is the results from populateLinesObject. results[1] is
				// the results of startFetching
				var linesData = results;
				linesData.forEach((dataForLine, index, array) => {
					linesObject[dataForLine.line] = dataForLine.data;
				});
				done(null);
			}
		}
	);
}

// TODO: functionalize
function getLineData(name, done) {
	var lineReader = readLine.createInterface({
		input: fs.createReadStream('RouteFiles/LineData-' + name + '.csv')
	});

	// The spursArray holds the data from the spreadsheet CSV file
	var spursArray = [];
	var currentSpursSubArray = -1;

	// The spursLEDArray holds the calculated lat/lon and geohash for each LED for
	// each spur for each line
	var spursLEDArray = [];

	lineReader.on('line', (line) => {
		var lineArray = line.split(',');
		if (lineArray[0] != "") {
			// console.log("Good Line - " + JSON.stringify(lineArray));
			var index = parseInt(lineArray[0], 10);
			if (index == 0) {
				currentSpursSubArray++;
				spursArray[currentSpursSubArray] = [];
			}
			var lineObject = {};
			lineObject.lon = parseFloat(lineArray[1], 10);
			lineObject.lat = parseFloat(lineArray[2], 10);
			lineObject.numLEDs = parseInt(lineArray[10], 10);
			lineObject.dlonOffset = parseFloat(lineArray[14], 10);
			lineObject.dlatOffset = parseFloat(lineArray[15], 10);
			lineObject.dlonLED = parseFloat(lineArray[16], 10);
			lineObject.dlatLED = parseFloat(lineArray[17], 10);
			lineObject.segment = parseFloat(lineArray[18], 10);
			spursArray[currentSpursSubArray][index] = lineObject;
		}
	});

	lineReader.on('close', () => {
		// console.log("*************************************************************");
		spursArray.forEach((segArray, spursIndex, spursArray) => {
			var segLEDArray = [];
			// console.log("SPUR - " + spursIndex);
			segArray.forEach((segment, segIndex, segArray) => {
				if (segIndex > 0) {
					segLEDArray[segIndex-1] = {};
					var ledArray = [];
					for (var ledIndex = 0; ledIndex < segment.numLEDs; ledIndex++) {
						var ledObject = {};
						var ledLon, ledLat;
						if (ledIndex == 0) {
							ledLon = segArray[segIndex-1].lon + segment.dlonOffset;
							ledLat = segArray[segIndex-1].lat + segment.dlatOffset;
						}
						else {
							ledLon = ledArray[ledIndex-1].ledLon + segment.dlonLED;
							ledLat = ledArray[ledIndex-1].ledLat + segment.dlatLED;
						}
						ledObject.ledLon = ledLon;
						ledObject.ledLat = ledLat;
						ledObject.geohash = geohash.encode(ledLat, ledLon, GEOHASH_LENGTH);
						ledObject.geohashNeighbors = geohash.neighbours(ledObject.geohash);
						ledArray.push(ledObject);
						// console.log("\t\tLED - " + ledIndex + " : " + JSON.stringify(ledObject));
					}
					// spursArray[spursIndex][segIndex].ledArray = ledArray;
					segLEDArray[segIndex-1].ledArray = ledArray;
					segLEDArray[segIndex-1].segment = segment.segment;
				}
				spursLEDArray[spursIndex] = segLEDArray;
			});
		});
// console.log("******* spursLEDArray");
// console.log(JSON.stringify(spursLEDArray, null, 4));
// process.exit();
		done(null, { line : name, data : spursLEDArray });
	});
}

// This comes from calculations done outside this program or the spreadsheet
const PALATINE_LED = 78;
const HARVARD_LED = 182;
const MCHENRY_LED = 21;
const SPUR_JUNCTION_POSITION = 37;

function textDisplayUPNW(leds) {
	var mainLedArray = [];
	var spurLedArray = [];
	var UPNW = leds["UP-NW"];
	var mainLedPositions = [];
	var spurLedPositions = [];
// console.log("*******\n" + JSON.stringify(UPNW, null, 2));
	UPNW.forEach((ledObject) => {
		if (ledObject != null && ledObject != undefined) {
			if (ledObject.spur == 0) {
				mainLedPositions.push(ledObject.spurLed);
			}
			if (ledObject.spur == 1) {
				spurLedPositions.push(ledObject.spurLed);
			}
		}
	});
	// Push in the main line LEDs
	for (var i = HARVARD_LED; i >= 0 ; i--) {
		// Push train first, so it will take precidence
		if (_.indexOf(mainLedPositions, i) >= 0) {
			mainLedArray.push('%');
		}
		else if (i == 0) {
			mainLedArray.push('O');
		}
		else if (i == PALATINE_LED) {
			mainLedArray.push('P');
		}
		else if (i == HARVARD_LED) {
			mainLedArray.push('H');
		}
		else {
			mainLedArray.push('=');
		}
	}
	// Push in the offset for the spur junction point
	for (var i = 0; i < SPUR_JUNCTION_POSITION; i++) {
		spurLedArray.push(' ');
	}
	// Push in the spur LEDs (original 0.5" LED spacing was 22 LEDs (.818))
	for (var i = MCHENRY_LED; i >= 0; i--) {
		if (_.indexOf(spurLedPositions, i) >= 0) {
			spurLedArray.push('%');
		}
		else if (i == MCHENRY_LED) {
			spurLedArray.push('M');
		}
		// The first led of this spur never "lit up", so I'm removing it
		else if (i == 0) {
			spurLedArray.push(' ');
		}
		else {
			spurLedArray.push('=');
		}
	}
	console.log(spurLedArray.join(''));
	console.log(mainLedArray.join(''));
}

function ledDisplayUPNW(leds) {
	var UPNW = leds["UP-NW"];
	var ledLightArray = [];
	var palatine = Math.floor(PALATINE_LED/2);
	var ogilve = 0;
	// Add Ogilve and Palatine as blue LEDs
	var postBodyArray = [{position:0, color:"blue"},{position:palatine, color:"blue"}];
	UPNW.forEach((ledObject) => {
		if (ledObject != null && ledObject != undefined) {
			if (ledObject.spur == 0) {
				ledLightArray.push(ledObject.spurLed);
			}
			// If on the McHenry spur, add 220 in order to only need a single
			// continuous strand.
			if (ledObject.spur == 1) {
				ledLightArray.push(ledObject.spurLed + 220);
			}
		}
	});
	// Squeeze the array in half for the protytype strip
	var newPosition, newColor;
	ledLightArray.forEach((ledIndex) => {
		newPosition = Math.floor(ledIndex/2);
		if (newPosition == 0 || newPosition == palatine) {
			newColor = "cyan";
		}
		else {
			newColor = "green";
		}
		postBodyArray.push({position:newPosition, color:newColor});
	});
	// POST new array to LED server
	request.post(
		{
			headers: {'Content-Type' : 'application/json'},
			uri: 'http://localhost:8675',
			body: JSON.stringify(postBodyArray)
		},
		function(error, response, body) {
			if (error) {
				log.error('POST to LED server resulted in an error - %j', error);
			}
			else if (response.statusCode != 201) {
				log.warn('POST to LED server returned an error code (%d)', response.statusCode);
			}
			else {
				log.debug('POST to LED server succeeded');
			}
		}
	);
}

// Process each line fetched
function processFetchedData(sortedPositions, done) {
	log.debug("processFetchedData()");
	linesNamesArray.forEach((name) => {
		ledsToLight[name] = processFetchedLineData(name, sortedPositions[name]);
	});
	log.debug("%s", JSON.stringify(ledsToLight, null, 4));
	textDisplayUPNW(ledsToLight);
	ledDisplayUPNW(ledsToLight);
	done(null);
}

// Process each train in the line
function processFetchedLineData(lineName, trainPositionArray) {
	log.debug("processFetchedLineData()");
	// log.debug("%s - found %d trains", lineName, trainPositionArray.length);

	var ledArray = [];
	if (trainPositionArray != null && trainPositionArray != undefined) {
		trainPositionArray.forEach((trainPosition) => {
			// log.debug("Processing %s train - %j", lineName, element);
			ledArray.push(matchLedWithTrain(lineName, trainPosition));
		});
	}
	return ledArray;
}

// Pick the LED to light for one train
function matchLedWithTrain(lineName, trainPosition) {
	log.debug("matchLedWithTrain(%s, %j)", lineName, trainPosition);
	var lineArray = linesObject[lineName];
	var possibleMatches = [];
	lineArray.forEach((spurArray, spurIndex) => {
		spurArray.forEach((segmentObject, segmentIndex) => {
			var ledArray = segmentObject.ledArray;
			ledArray.forEach((led, ledIndex) => {
				var trainGeohash = trainPosition.geohash;
				if (isInLEDNineBox(trainGeohash, led)) {
					possibleMatches.push({
						led : led,
						spurIndex : spurIndex,
						segmentIndex : segmentIndex,
						ledIndex : ledIndex,
						spurLed : getSpurLedCount(lineName, spurIndex, segmentIndex, ledIndex)
					});
				}
			});
		});
	});
	var exactMatch = pickExactMatch(trainPosition, possibleMatches);
	if (exactMatch != null && exactMatch != undefined) {
		return {
			spur :       exactMatch.spurIndex,
			segment :    exactMatch.segmentIndex,
			segmentLed : exactMatch.ledIndex,
			spurLed :    exactMatch.spurLed
		};
	}
	else {
		return null;
	}
}

// Prune the array of possible matches down to just one
function pickExactMatch(trainPosition, possibleMatches) {
	// First, check for exact matches
	var prunedMatches = [];
	possibleMatches.forEach((possibleMatch) => {
		if (possibleMatch.led.geohash == trainPosition.geohash) {
			prunedMatches.push(possibleMatch);
		}
	});
	if (prunedMatches.length == 1) {
		return prunedMatches[0];
	}
	else if (prunedMatches.length == 0) {
		prunedMatches = possibleMatches;
	}
	var exactMatch;
	var closestDistance = null;
	prunedMatches.forEach((possibleMatch) => {
		var distance = geolib.getDistance({
			latitude : trainPosition.latitude,
			longitude : trainPosition.longitude
		},
		{
			latitude : possibleMatch.led.ledLat,
			longitude : possibleMatch.led.ledLon
		});
		if (closestDistance == null) {
			closestDistance = distance;
			exactMatch = possibleMatch;
		}
		else {
			if (distance < closestDistance) {
				closestDistance = distance;
				exactMatch = possibleMatch;
			}
		}
	});
	return exactMatch;
}

// Is the train in one of the neighbor blocks?
function isInLEDNineBox(trainGeohash, ledObject) {
	if (trainGeohash == ledObject.geohash) {
		return true;
	}
	else {
		var retVal = false;
		_.values(ledObject.geohashNeighbors).forEach((neighborGeohash) => {
			if (trainGeohash == neighborGeohash) {
				retVal = true;
			}
		});
		return retVal;
	}
}

// Calculate the led index for the entire spur
function getSpurLedCount(name, spur, segment, led) {
	// log.debug("getSpurLedCount()");
	var segmentsArray = linesObject[name][spur];
	var totalLedIndex = 0;
	for (var i = 0; i < segment; i++) {
		totalLedIndex += segmentsArray[i].ledArray.length;
	}
	totalLedIndex += (led + 1);
	return totalLedIndex;
}

module.exports.init = init;
module.exports.displayData = processFetchedData;

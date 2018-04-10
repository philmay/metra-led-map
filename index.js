'use strict';

var _          = require('lodash');
var minimist   = require('minimist');
var async      = require('async');
var restify    = require('restify-clients');
var bunyan     = require('bunyan');
var util       = require('util');
var uuidV4     = require('uuid/v4');
var geohash    = require('latlon-geohash');
var readLine   = require('readline');
var fs         = require('fs');

var ledView         = require(process.cwd() + '/led-view');
var sharedConstants = require(process.cwd() + '/constants');
var secrets         = require(process.cwd() + '/secrets');

var username = secrets.metraUsername;
var password = secrets.metraPassword;

// https://gtfsapi.metrarail.com
var metraHost = 'gtfsapi.metrarail.com'; // HTTPS
var baseUrl  = 'https://' + metraHost;

// Raw GTFS Feeds
// • GET - /gtfs/raw/positionUpdates.dat
// • GET - /gtfs/raw/tripUpdates.dat
// • GET - /gtfs/raw/alerts.dat
// • GET - /gtfs/raw/schedule.zip
//
// JSON GTFS Feeds
// • /gtfs/alerts
var alertsPath = '/gtfs/alerts';
// • /gtfs/positions
var positionsPath = '/gtfs/positions';
// • /gtfs/tripUpdates
var tripUpdatesPath = '/gtfs/tripUpdates';

var log = bunyan.createLogger({ name : "metra data", level : "error" });
// Grab command-line args
var argv = minimist(process.argv.slice(2));

var metraClient = restify.createJsonClient({ url : baseUrl });
metraClient.basicAuth(username, password);

let FETCH_INTERVAL = 20000 //ms
var fetchIntervalTimer;

let GEOHASH_LENGTH  = sharedConstants.GEOHASH_LENGTH;
// let linesNamesArray = sharedConstants.linesNamesArray;


log.info("Start initialization...")
async.series(
	[
		initLedView,
		startFetching
	],
	(error, results) => {
		if (error) {
			log.error("Failed to start properly - " + error.message);
			process.exit(1);
		}
		else {
			log.info("******* INITIALIZED *******");
		}
	}
);


////////////////////////////////////////////////////////////////////////////////
// PREPARE VIEWS
//
function initLedView(done) {
	ledView.init(done);
}

////////////////////////////////////////////////////////////////////////////////
// FETCH AND CALL VIEW(S)
//

function startFetching (done) {
	log.debug("startFetching()");
	fetchIntervalTimer = setInterval(fetchPositionData, FETCH_INTERVAL);
	if (fetchIntervalTimer == null || fetchIntervalTimer == undefined) {
		done(new Error("Timer not initialized properly"));
	}
	else {
		done(null);
	}
}

//
// sortedTrainPositions represents the returned METRA data as an object with an
// attribute for each line fetched. Each of these attributes is an array of
// positions for each train currently on the line.
//
//	{
//		<line_name_1> : [
//			{
//				timestamp: <metra_timestamp>,
//				start_time: <metra_advertised_start_time>,
//				start_date: <date_of_trip>,
//				latitude : <train_latitude>,
//				longitude : <train_longitude>,
//				label : <train_number>,
//				id : <some_other_train_id>,
//				geohash : <train_position_geohash>
//			},
//			<second_train_position_object>,
//			...
//		],
//		<line_name_2> : [
//			{
//				...
//			},
//			...
//		],
//		...
//	}
function fetchPositionData() {
	log.debug("fetchPositionData()");
	var sortedTrainPositions = {};
	log.info("Fetching METRA data (%s)", baseUrl + positionsPath);
	metraClient.get(positionsPath, function(error, req, res, locArray) {
		if (error) {
			log.error("    fetch failed");
		}
		else if (locArray.length == 0) {
			log.error("    fetch returned zero-length locArray");
		}
		else {
			log.info("    successfully fetched data for positions");
			log.info("        length = %d", locArray.length);
			locArray.forEach((locObject, index, array) => {
				var line = locObject.vehicle.trip.route_id;
				if (!_.has(sortedTrainPositions, line)) {
					sortedTrainPositions[line] = [];
				}
				var positionGeohash = geohash.encode(
					locObject.vehicle.position.latitude,
					locObject.vehicle.position.longitude,
					GEOHASH_LENGTH
				);
				sortedTrainPositions[line].push(
					{
						timestamp: locObject["metra-publish-tstamp"],
						start_time: locObject.vehicle.trip.start_time,
						start_date: locObject.vehicle.trip.start_date,
						latitude: locObject.vehicle.position.latitude,
					    longitude: locObject.vehicle.position.longitude,
						label: locObject.vehicle.vehicle.label,
						id: locObject.vehicle.vehicle.id,
						geohash: positionGeohash
					}
				);
			});
			updateViews(sortedTrainPositions);
		}
	});
}

function updateViews(sortedTrainPositions) {
	async.parallel(
		[
			_.partial(ledView.displayData, sortedTrainPositions, _)
		],
		(error, results) => {
			if (error) {
				log.error("View processing error - %j", error);
			}
			else {
				log.info("Views updated");
			}
		}
	);
}

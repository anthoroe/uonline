/*
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation; either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 */


"use strict";

var sync = require('sync');
var config = require('../config.js');
var math = require('./math.js');


function parseLocationWays(str) {
	if (str === null) return [];
	var ways = str.split("|");
	for (var i=0; i<ways.length; i++)
	{
		var s = ways[i].split("=");
		ways[i] = {id: parseInt(s[1], 10), text: s[0]}; //#273
	}
	return ways;
}

exports.getDefaultLocation = function(dbConnection) {
	var result = dbConnection.query.sync(dbConnection, 'SELECT * FROM locations WHERE "default" = 1');
	if (result.rowCount === 0)
	{
		throw new Error('default location is not defined');
	}
	if (result.rowCount > 1)
	{
		throw new Error('there is more than one default location');
	}
	var res = result.rows[0];
	res.goto = parseLocationWays(res.goto);
	return res;
}.async();

exports.getUserLocationId = function(dbConnection, userid, callback) {
	dbConnection.query(
		'SELECT location FROM uniusers WHERE id = $1',
		[userid],
		function (error, result) {
			if (!!result && result.rowCount === 0)
			{
				error = new Error("Wrong user's id");
			}
			callback(error, error || result.rows[0].location);
		}
	);
};

exports.getUserLocation = function(dbConnection, userid) {
	var result = dbConnection.query.sync(
		dbConnection,
		'SELECT locations.* FROM locations, uniusers '+
		'WHERE uniusers.id=$1 AND locations.id = uniusers.location',
		[userid]);

	if (result.rowCount === 0)
	{
		throw new Error("Wrong user's id or location");
	}

	var res = result.rows[0];
	res.goto = parseLocationWays(res.goto);

	return res;
}.async();

exports.getUserArea = function(dbConnection, userid, callback) {
	dbConnection.query(
		'SELECT areas.* FROM areas, locations, uniusers '+
		'WHERE uniusers.id=$1 AND locations.id = uniusers.location AND areas.id = locations.area',
		[userid],
		function (error, result) {
			if (!!result && result.rowCount === 0)
			{
				error = new Error("Wrong user's id");
			}
			if (!!error)
			{
				callback(error, null);
				return;
			}
			var res = result.rows[0];
			callback(null, res);
		}
	);
};

/*exports.getAllowedZones = function(dbConnection, sessid, callback) {
	dbConnection.query(
		'SELECT locations.goto FROM locations, uniusers '+
		'WHERE uniusers.sessid = ? AND locations.id = uniusers.location AND uniusers.fight_mode = 0',
		[sessid],
		function (error, result) {
			if (!!error) {callback(error, null); return;}
			var a = result.rows[0].goto.split("|");
			for (var i=0;i<a.length;i++) {
				var s = a[i].split("=");
				a[i] = {to: s[1], name: s[0]};
			}
			callback(null, a);
		}
	);
};*/

exports.changeLocation = function(dbConnection, userid, locid, throughSpaceTime) {
	if (!throughSpaceTime) {
		var result = exports.getUserLocation.sync(null, dbConnection, userid);

		var found = false;
		for (var i in result.goto)
		{
			if (result.goto[i].id == locid)
			{
				found = true;
				break;
			}
		}
		if (!found)
		{
			throw new Error('No way from location '+result.id+' to '+locid);
		}
	}

	var tx = dbConnection.begin();
	//tx.on('error', function(e){console.log(e)});
	tx.query.sync(tx, 'UPDATE uniusers SET location = $1 WHERE id = $2', [locid, userid]);
	tx.query.sync(tx,
		'UPDATE uniusers '+
		'SET autoinvolved_fm = 1, fight_mode = 1 FROM locations, monsters '+
		'WHERE uniusers.id = $1 '+
			'AND uniusers.location = monsters.location '+
			'AND RANDOM()*100 <= monsters.attack_chance', [userid]);
	tx.commit.sync(tx);
}.async();

exports.goAttack = function(dbConnection, userid, callback) {
	dbConnection.query("UPDATE uniusers SET fight_mode = 1 WHERE id = $1", [userid], callback);
};

exports.goEscape = function(dbConnection, userid, callback) {
	dbConnection.query("UPDATE uniusers SET fight_mode = 0, autoinvolved_fm = 0 WHERE id = $1",
		[userid], callback);
};

exports.getUsersOnLocation = function(dbConnection, locid, callback) {
	dbConnection.query(
		'SELECT id, "user" FROM uniusers '+
		"WHERE sess_time > NOW() - $1 * INTERVAL '1 SECOND' AND location = $2",
		[config.userOnlineTimeout, locid],
		function(error, result) {
			callback(error, error || result.rows);
		}
	);
};

exports.getNearbyUsers = function(dbConnection, userid, locid, callback) {
	exports.getUsersOnLocation(
		dbConnection,
		locid,
		function(error, result) {
			if (!!error) callback(error, null);
			result = result.filter(function (i) {
				return i.id !== userid;
			});
			callback(null, result);
		}
	);
};

exports.getNearbyMonsters = function(dbConnection, locid, callback) {
	dbConnection.query(
		'SELECT monster_prototypes.*, monsters.* '+
		'FROM monster_prototypes, monsters '+
		'WHERE monsters.location = $1 '+
		'AND monster_prototypes.id = monsters.prototype',
		[locid],
		function(error, result) {
			callback(error, error || result.rows);
		}
	);
};

exports.isInFight = function(dbConnection, userid, callback) {
	dbConnection.query("SELECT fight_mode FROM uniusers WHERE id = $1", [userid], function (error, result) {
		callback(error, error || (result.rows[0].fight_mode == 1));
	});
};

exports.isAutoinvolved = function(dbConnection, userid, callback) {
	dbConnection.query("SELECT autoinvolved_fm FROM uniusers WHERE id = $1", [userid],
		function (error, result) {
			callback(error, error || (result.rows[0].autoinvolved_fm == 1));
		}
	);
};

exports.uninvolve = function(dbConnection, userid, callback) {
	dbConnection.query("UPDATE uniusers SET autoinvolved_fm = 0 WHERE id = $1", [userid], callback);
};

var characters = [
	'id',
	'"user"',
	'health',
	'health_max',
	'mana',
	'mana_max',
	'energy',
	'power',
	'defense',
	'agility',
	'accuracy',
	'intelligence',
	'initiative',
	'exp',
	'level',
];
var joinedCharacters = characters.join(",");
exports.getUserCharacters = function(dbConnection, userIdOrName, callback) {
	var field = typeof userIdOrName === 'number' ? 'id' : '"user"';
	dbConnection.query(
		'SELECT '+joinedCharacters+' FROM uniusers WHERE '+field+' = $1',
		[userIdOrName],
		function(error, result) {
			if (!!error)
			{
				callback(error, null);
				return;
			}
			var res = result.rows[0];
			if (res === undefined)
			{
				callback(null, null);
				return;
			}
			res.health_percent = res.health * 100 / res.health_max;
			res.mana_percent = res.mana * 100 / res.mana_max;
			var expPrevMax = math.ap(config.EXP_MAX_START, res.level-1, config.EXP_STEP);
			res.exp_max = math.ap(config.EXP_MAX_START, res.level, config.EXP_STEP);
			res.exp_percent = (res.exp-expPrevMax) * 100 / (res.exp_max-expPrevMax);
			//res['nickname'] = res['user']; //лучше поле 'user' переименовать
			callback(null, res);
		}
	);
};


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

var config = require('./config.js');

var anyDB = require('any-db');
var mysqlConnection = anyDB.createPool(config.MYSQL_DATABASE_URL, {min: 2, max: 20});

var utils = require('./utils.js');

var async = require('async');

var express = require('express');

var app = express();
app.enable('trust proxy');
app.use(express.logger());
app.use(express.cookieParser());
app.use(express.bodyParser());
app.use(express.compress());

app.use('/bootstrap', express.static(__dirname + '/bootstrap'));
app.use('/img', express.static(__dirname + '/img'));

var swig = require('swig');
app.engine('html', swig.renderFile);
app.engine('twig', swig.renderFile);
app.engine('swig', swig.renderFile);
app.set('view engine', 'twig'); // historical reasons
app.set('views', __dirname + '/templates');

var phpgate = require('./cgi.js').phpgate;

app.use(function(request, response, next){
	if (!!request.cookies.sessid)
	{
		var sessid = request.cookies.sessid;
		async.waterfall([
				function(callback){
					utils.user.sessionActive(mysqlConnection, sessid, callback);
				},
				function(active, callback) {
					if (active)
					{
						console.log('REFRESHING ' + sessid);
						utils.user.refreshSession(mysqlConnection, sessid, config.sessionExpireTime, callback);
					}
					else
					{
						callback();
					}
				}
			],
			function(error, result)
			{
				next();
			}
		);
	}
});

/*** routing routines ***/

app.get('/node/', function(request, response) {
	response.send('Node.js is up and running.');
});

app.get('/node-about/', function(request, response) {
	// warning: for testing purposes only
	var options = {};
	options.now = new Date();
	options.instance = 'about';
	options.loggedIn = false;
	response.render('about', options);
});

app.get('/', phpgate);
app.get('/about/', phpgate);
app.get('/register/', phpgate);
app.post('/register/', phpgate);
app.get('/login/', phpgate);
app.post('/login/', phpgate);
app.get('/profile/', phpgate);
app.get('/profile/id/:id/', phpgate);
app.get('/profile/user/:user/', phpgate);
app.get('/action/logout', phpgate);
app.get('/game/', phpgate);
app.get('/action/go/:to', phpgate);
app.get('/action/attack', phpgate);
app.get('/action/escape', phpgate);

app.get('/ajax/isNickBusy/:nick', function(request, response) {
	utils.user.userExists(mysqlConnection, request.param('nick'), function(error, result){
		if (!!error) { response.send(500); return; }
		response.json({ 'nick': request.param('nick'), 'isNickBusy': result });
	});
});

app.get('/stats/', phpgate);
app.get('/world/', phpgate);
app.get('/development/', phpgate);


/*
app.get('/', function(request, response) {
	response.redirect('/about/');
});

app.get('/about/', function(request, response) {
	var t = Date.now();
	var options = {};
	options.instance = 'about';
	options.loggedIn = false;
	response.render('about.twig', options);
	console.log(request.path+' - done in '+(Date.now()-t)+' ms');
});
*/

/***** main *****/
var port = process.env.PORT || 5000;
app.listen(port, function() {
	console.log("Listening on " + port);
	if (port==5000) console.log("Try http://localhost:" + port + "/");
});

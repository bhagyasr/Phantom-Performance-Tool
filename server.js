var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var multer = require('multer');
var sys = require('sys');
var util = require('util');
var exec = require('child_process').exec;
var fs = require('fs');
var sendReports = [];
console.log("in server");

var mongoose = require('mongoose');
mongoose.connect('mongodb://localhost/TestPhantom5x'); // connected to TestPhantom2x mongodb database

var reportSchema = new mongoose.Schema({_id: String, reports: []});
var directurls = mongoose.model("directurls", reportSchema); // directurls is the collection of reports of urls which don't need login

app.use(express.static(__dirname + '/public'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(multer());

app.get('/', function (req,res){
	res.sendfile("index.html") // the homepage is the "run a test now" page
});

app.post('/phantom/', function (req,res){ // this function executes respective phantom script for the given url and output is pageReport.json file
	var execStatement = "directScript.js "+req.body.url;
	child = exec(execStatement, function (error, stdout, stderr) { //execute the phantomjs script on the provided url
		if (error) {
			console.log('error in post : ' + error);
		}
		res.send(stdout); // send the output of phantomjs script
	});
});

app.get('/json/', function(req, res){ // this function gets the pageReport.json file and sends it to the front end
	console.log("get json");
	fs.readFile('./public/pageReport.json', 'utf8', function (err, data) {
		if (err) 
		  console.log("readfile error : "+err);
		res.send(data);
	});
});

app.post('/phantom2/', function(req, res){ // this function pings the database get an array of reports for the specified url
	console.log("post phantom2 : "+req.body.url+" -- "+req.body.login);
	sendReports = [];
	var epoch = (new Date() - req.body.days*86400000);
	var oldDate = (new Date(epoch)).toJSON(); //construct the timestamp from when the reports are needed
		
	directurls.find({_id: req.body.url}, function (err, response){
		if(response.length > 0) { // if the url is found in the database
			var allReports = response[0].reports;
			for(var i=0; i<allReports.length; i++){
				if(allReports[i].summary.TimeStamp > oldDate){ // if the timestamp of the report is greater than oldDate timestamp add it to the response array
					sendReports.push(allReports[i]);
				}
				if(i == allReports.length-1) // when all the reports are checked send the response 
					res.send(sendReports);
			}
		} else { // if the url cannot be found in the database send an empty array as response
			var emptyArray = [];
			res.send(emptyArray);
		}
	});
});

app.listen(3000);

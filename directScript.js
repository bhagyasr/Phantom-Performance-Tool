var system = require('system');
var args = system.args;
var webpageModule = require('webpage');
var fs = require('fs');

function getTiming(data) { // domLoading, loadEventStart and other timings of the page are returned as timestamps by phantomjs. We calculate the latency in this function by subtracting it with the time when the page loading started
	var connectStart = data.connectStart;
	var timing = {};
	for (var event in data){
		if ( data.hasOwnProperty(event) ){
			var latency = data[event] - connectStart;
			timing[event] = latency > 0 ? latency : 0;
		}
	}
	return timing;
}

var t0;
var resource = {};

function testPage(url) { // The main function where the whole process runs
    var pageInstance = webpageModule.create();
	
	pageInstance.pageReport = { // the structure of the output json file
		summary : {},
		timing : {},
        resources: []
    };
	
	weight = 0;
	reqs = 0;
	resp = 0;
	
	pageInstance.onError = function(msg, trace) { // Webpage errors or errors while evaluating the page will be logged here. They will not stop the phantom process but the results with web page errors may not be accurate
		console.log(msg);
//		phantom.exit();
	}
	
	pageInstance.onResourceRequested = function(request) { // When a request is sent, this callback function is called. In this function we make an array of all the requests "resourceArray" and log the url of resources, method and the timestamp when the resource was requested
		var resource = {};
		resource.url = request.url;
		resource.method = request.method;
		resource.requestTime = request.time;
		pageInstance.pageReport.resources.push(resource);
	}
	
	pageInstance.onResourceError = function(resourceError) {
//	  console.log("Resource Error : "+resourceError);
	};

	pageInstance.onResourceTimeout = function(req) {
//	  console.error('Time on Resource : '+req);
	};
	
	
	pageInstance.onResourceReceived = function(response) { // When a response is received, this callback function is called.
		var index = pageInstance.pageReport.resources.map(function(each) { return each.url; }).indexOf(response.url); // Match the url of the response with the "resourceArray" and find its index
		if(response.stage == "start") { // a response is either in the start stage when response downloading starts or end stage when the response downloading completes
			pageInstance.pageReport.resources[index].contentType = response.contentType; // In the start stage of a response its content type and the size of the response are logged into the "resourceArray" at the matching url index
			pageInstance.pageReport.resources[index].bodySize = response.bodySize;
			weight = weight + response.bodySize;
		} else { // In the end stage the timestamp when the response downloading is completed is logged and the duration of the resource from request to download is logged
			var t1 = pageInstance.pageReport.resources[index].requestTime;
			t1 =  response.time - t1;
			pageInstance.pageReport.resources[index].responseTime = response.time;
			pageInstance.pageReport.resources[index].duration = t1;
		}
	}
	

    pageInstance.onConsoleMessage = function(msg) {
//      console.log("\nBrowser log: "+msg);
    }
	
	
    pageInstance.onCallback = function(data) {        
		pageInstance.pageReport.summary.url = url;
		pageInstance.pageReport.summary.title = data.title;
		pageInstance.pageReport.timing = getTiming(data.timing);

		setTimeout(function() {
			pageInstance.pageReport.summary.pageSize = weight;
			fs.write('./public/pageReport.json', JSON.stringify(pageInstance.pageReport, null, 4), 'w');
			phantom.exit();
		}, 3000);
    }

    pageInstance.onLoadStarted = function(status) { // this is the first function to be called when the page is open.
        t0 = Date.now();
		pageInstance.pageReport.summary.TimeStamp = (new Date()).toJSON(); // the timestamp of when the report is generated is logged in json format.
    }

    pageInstance.onLoadFinished = function(status) { // after opening the page, when the load is finished, this callback is called
        if (status === 'fail') {
            console.log("Incorrect URL. Please enter proper URL along with http/s");
            phantom.exit();
        }
		
		t0 = Date.now()-t0;
		pageInstance.pageReport.summary.loadTime = t0;
		
        pageInstance.evaluate(function() {
            window.callPhantom({
			timing: performance.timing,
			title: document.title
			});
        });
    }

    pageInstance.open(url);
}

testPage(args[1]);

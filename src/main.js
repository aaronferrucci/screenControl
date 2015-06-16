// KPR Script file
var printit = function(name, o) {
	var output = name + ":\n";
	for (var property in o) {
	  output += "  " + property + ': ' + o[property]+';\n';
	}
	trace(output);
};

var updateDate = function(dateLine) {
	var date = new Date();
	lastHour = currentHour;
	currentHour = date.getHours();

	var dateStr = date.toLocaleString();
/*		
	var hours = String( date.getHours() );
	var minutes = String( date.getMinutes() );
	var seconds = String( date.getSeconds() );
	if ( 1 == minutes.length )
		minutes = '0' + minutes;
	if ( 1 == seconds.length )
		seconds = '0' + seconds;
	var time = hours + ':' + minutes + ':' + seconds;
*/
	dateLine.first.string = dateStr;
}

// TODO: a better way to handle constants?
var touchSkin = new Skin( { fill:"gray" } );
var onSkin = new Skin( { fill:"green" } );
var offSkin = new Skin( { fill:"red" } );
var labelStyle = new Style( { font: "bold 40px", color:"white" } );
var timeDateStyle = new Style( { font: "bold 30px", color:"white" } );
var onString = "Internet Is ON";
var offString = "Internet Is OFF";
var defaultFullTime = 14 * 60 * 60;

// TODO: put globals into a class.
var globalState = false;
var timeLeft = 0;
var currentHour = 0, lastHour = 0;
var netStartHour = 7;
var path = mergeURI(Files.documentsDirectory, application.di + "." + "time.json");

var appBehaviors = Behavior({
  onQuit: function(app) {
  	trace("app onQuit(); saving timeLeft=" + timeLeft + "\n");
	application.invoke(new Message("/firewall?network_mode=2"));
	Files.writeJSON(path, timeLeft);
	// TODO: wait until the /firewall message returns.
  },

  onLaunch: function(app) {
    // TODO: Better timezone lookup.
    var tz = "PDT+07:00";
  	trace("setting tz: " + tz + "\n");
  	K4.timezone = tz;
  },  
});

var theBehaviors = Behavior({
  onCreate: function(column, data) {
	trace("onCreate()\n");
	currentHour = 0;
	lastHour = 0;
	application.invoke(new Message("/firewall?network_mode=2"));
	
	contents = column.first;
    timeLine = contents.first;
	dateLine = contents.next;
	if (!Files.exists(path)) {
		trace("no file '" + path + "'; creating it\n");
	  	timeLeft = defaultFullTime;
		Files.writeJSON(path, timeLeft);
	} else {
	  	timeLeft = Files.readJSON(path);
	  	if (timeLeft < 0)
	  	  timeLeft = 0;
	  	trace("read time: " + timeLeft + " from file " + path + "\n");
	}
	timeLine.string = String(timeLeft);
	updateDate(dateLine);
  },
  
  onTimeUpdated: function(column) {
	contents = column.first;
    timeLine = contents.first;
	timeLine.string = String(timeLeft);
	dateLine = contents.next;
	updateDate(dateLine);	

	if (globalState) {
	  if (timeLeft == 1) {
		globalState = false;
		// TODO: refactor into a call that updates the screen, turns off network access
		application.distribute("onTouchEnded");
	  }
	  
	  // TODO: note assumption that we are called once per second. That might not be accurate.
	  if (timeLeft > 0)
	    timeLeft--;
	}
  },
  
  onTouchBegan: function(column, id, x, y, ticks) {
	if (timeLeft > 0 && currentHour >= netStartHour) {
		globalState = !globalState;
	}
		
	contents = column.first;
    statusLine = contents.next.next;
	
	column.skin = touchSkin;
   },
  
  onTouchEnded: function (column, id, x, y, ticks) {
	contents = column.first;
    statusLine = contents.next.next;
	if (globalState) {
	  statusLine.first.string = onString;
	  column.skin = onSkin;
	  application.invoke(new Message("/firewall?network_mode=1"));
	} else {
	  statusLine.first.string = offString;
	  Files.writeJSON(path, timeLeft);
	  application.invoke(new Message("/firewall?network_mode=2"));
	  column.skin = offSkin;
	}
  }
});

var main = new Column({
	left:0, right:0, top:0, bottom:0,
	active: true,
	behavior: theBehaviors,
	skin: offSkin,
	contents:[
	  new Line({
		  left:0,
		  right:0,
		  top:0,
		  bottom:0,
		  contents: [
			new Label({left:0, right:0, top:0, bottom:0, height: 0, string: "XX:XX:XX", style: labelStyle}),
		  ],
		}),
	  new Line({
		  left:0,
		  right:0,
		  top:0,
		  bottom:0,
		  contents: [
			new Label({left:0, right:0, top:0, bottom:0, height: 0, string: "Current Time/Date", style: timeDateStyle}),
		  ],
		}),
	  new Line({
		  left:0,
		  right:0,
		  top:0,
		  bottom:0,
		  contents: [
			new Label({left:0, right:0, top:0, bottom:0, height: 0, string: offString, style: labelStyle}),
		  ],
		}),
	]
});

Handler.bind(
  "/time",
  {
	  onInvoke: function(handler, message) {
	  	application.distribute("onTimeUpdated");
		handler.invoke(new Message("/delay"));
	  }
  }
);

Handler.bind(
  "/delay",
  {
	  onInvoke: function(handler, message) {
	  	handler.wait(1000);
	  },
	  onComplete: function(handler, message) {
		handler.invoke(new Message("/time"));
	  }
  }
);

Handler.bind(
  "/firewall",
  {
    onInvoke: function(handler, message) {
		var query = parseQuery( message.query );
		var network_mode = query.network_mode;
		var uri = "http://192.168.1.1:8080/network_control.sh" + "?network_mode=" + network_mode;
		var debug = true;
		if (debug) {
			trace("debug: uri: " + uri + "\n");
		} else {
		    handler.invoke(new Message(uri), Message.TEXT);
		}
    },
    onComplete: function(handler, message) {
      // TODO: if the message status is not success, don't change globalState?
      // (but I've already done that in onTouchBegan.)
      trace("message.status: " + message.status + "\n");
    }
  }
);

application.add(main);
application.behavior = appBehaviors;
application.invoke(new Message("/time"));

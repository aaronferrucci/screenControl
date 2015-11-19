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
  currentHour = date.getHours();

  lastDay = currentDay;
  currentDay = date.getDay();

  // "The getDay() method returns the day of the week (from 0 to 6) for the specified date."
  // "Note: Sunday is 0, Monday is 1, and so on."
  // Detect the transition from the end of one week to the beginning
  // of the next, and update timeLeft.
  var refillDay = 1; // Monday
  if (currentDay == refillDay && lastDay != refillDay) {
    timeLeft = defaultFullTime;
  }  
  var dateStr = date.toLocaleString();
  // If you're wondering how the time gets set to daylight savings time or not...
  // it's done in the settings menu on the Kinoma. Awkward.
  dateLine.first.string = dateStr;
}

// TODO: a better way to handle constants?
var touchSkin = new Skin( { fill:"gray" } );
var onSkin = new Skin( { fill:"green" } );
var offSkin = new Skin( { fill:"red" } );
var labelStyle = new Style( { font: "bold 40px", color:"white" } );
var timeDateStyle = new Style( { font: "bold 30px", color:"white" } );
var onString = "Screen Time: OK";
var offString = "Screen Time: Not OK";
var defaultFullTime = 14 * 60 * 60;

// TODO: put globals into a class.
var globalState = false;
var timeLeft = 0;
var currentHour = 0;
var lastDay = 0; currentDay = 0;
var netStartHour = 7;
var path = mergeURI(Files.documentsDirectory, application.di + "." + "time.json");

var appBehaviors = Behavior({
  onQuit: function(app) {
    app.invoke(new Message("/firewall?network_mode=2"));
    trace("onQuit: un-sharing\n");
    app.shared = false;

    trace("app onQuit(); saving timeLeft=" + timeLeft + "\n");
    Files.writeJSON(path, timeLeft);
    // TODO: wait until the /firewall message returns.
  },

  onLaunch: function(app) {
    trace("onLaunch: sharing\n");
    app.shared = true;
  },
});

var timeSplit = function(timeLeft) {
  var seconds = timeLeft % 60;
  timeLeft = timeLeft / 60;
  var minutes = Math.floor(timeLeft) % 60;
  timeLeft = timeLeft / 60;
  var hours = Math.floor(timeLeft);
  
  return {hours: hours, minutes: minutes, seconds: seconds};
};

var timeString = function(timeLeft) {
  var theTime = timeSplit(timeLeft);
  var seconds = String(theTime.seconds);
  var minutes = String(theTime.minutes);
  var hours = String(theTime.hours);
  if (1 == minutes.length)
    minutes = '0' + minutes;
  if (1 == seconds.length)
    seconds = '0' + seconds;
  var timeStr = hours + ':' + minutes + ':' + seconds;
  return(timeStr);
};

var theBehaviors = Behavior({
  onCreate: function(column, data) {
    trace("onCreate()\n");
    currentHour = 0;
    application.invoke(new Message("/firewall?network_mode=2"));
    
    contents = column.first;
    timeLine = contents.first;
    dateLine = contents.next;
    
    if (!Files.exists(path)) {
      trace("no file '" + path + "'; creating it\n");
      timeLeft = defaultFullTime;
      Files.writeJSON(path, timeLeft);
    } else {
      // TODO: catch readJSON exceptions (can happen if the filesystem is corrupted).
      // Recreate the file if exception occurs.
      timeLeft = Files.readJSON(path);
      if (timeLeft < 0)
        timeLeft = 0;
      trace("read time: " + timeLeft + " from file " + path + "\n");
    }
    timeLine.string = timeString(timeLeft);
    updateDate(dateLine);
  },

  onTimeUpdated: function(column) {
    contents = column.first;
    timeLine = contents.first;
    timeLine.string = timeString(timeLeft);

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
    // Todo: allow turning internet off, even if it's past midnight but before 7.
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
  },
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
      var debug = false;
      if (debug) {
        trace("debug: uri: " + uri + "\n");
      } else {
        handler.invoke(new Message(uri), Message.TEXT);
      }
    },
    onComplete: function(handler, message) {
      // TODO: if the message status is not success, don't change globalState?
      // (but I've already done that in onTouchBegan.)
      // TODO: if there's no network connection, the counter may be counting
      // down without having provided access. Can I detect that via message status
      // and 1) stop counting down, 2) print an error?
      
      // trace("message.status: " + message.status + "\n");
    }
  }
);

Handler.bind(
  "/respond",
  Behavior({
    onInvoke: function(handler, message){
      message.responseText = "You found me!";
      message.status = 200;  
    }
}));

var parseTimeValue = function(queryValue, label, currentVal, lowLimit, highLimit) {
  var msg = "";

  if (queryValue == undefined) {
    msg += "Warning: ignoring undefined value for " + label + "\n";
    return {value: currentVal, msg: msg};
  }
  
  var isPlus = false, isMinus = false;
  if (queryValue.substring(0, 1) == '+') {
    isPlus = true;
  } else if (queryValue.substring(0, 1) == '-') {
    isMinus = true;
  }
  
  if (isPlus || isMinus)
    queryValue = queryValue.substring(1);
  
  var value = parseInt(queryValue);
  if (isNaN(value) || value < lowLimit || value >= highLimit) {
    value = currentVal;
    msg += "Warning: using default value for " + label + ": " + value + "\n";
  } else {
    if (isPlus)
      value = currentVal + value;
    else if (isMinus)
      value = currentVal - value;
  }
  return {value: value, msg: msg};
}

Handler.bind(
  "/setTimeLeft",
  Behavior({
  onInvoke: function(handler, message){
    var query = parseQuery(message.query);
    var hours;
    var minutes;
    var seconds;
    
    var errString = "";
    var qualified;
    var theTime = timeSplit(timeLeft);

    qualified = parseTimeValue(query.hours, "hours", theTime.hours, 0, 100);
    hours = qualified.value;
    errString += qualified.msg;
    
    qualified = parseTimeValue(query.minutes, "minutes", theTime.minutes, 0, 60);
    minutes = qualified.value;
    errString += qualified.msg;

    qualified = parseTimeValue(query.seconds, "seconds", theTime.seconds, 0, 60);
    seconds = qualified.value;
    errString += qualified.msg;
      
    var newTime = hours * 60 * 60 + minutes * 60 + seconds;
    if (newTime < 0) 
      newTime = 0;
    timeLeft = newTime;
    message.responseText = errString + "Time remaining is now: " + timeString(timeLeft);
    message.status = 200;
  }
}));

application.add(main);
application.behavior = appBehaviors;
application.invoke(new Message("/time"));


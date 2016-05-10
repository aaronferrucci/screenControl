
var debug = false;
var debugDate = false;
// For time/date debugging, compute an offset from the desired date.
// Date(year, month [0-based], day-of-month, hour [0-23], minute, second, millisecond)
var offset = new Date(2016, 4, 17, 23, 59, 50, 0).getTime() - new Date().getTime();

var printit = function(name, o) {
  var output = name + ":\n";
  for (var property in o) {
    output += "  " + property + ': ' + o[property]+';\n';
  }
  trace(output);
};

var localTimeString = function(date) {
  var hours = date.getHours();
  var minutes = String(date.getMinutes());
  var seconds = String(date.getSeconds());
  var ampm = "AM";
  if (hours == 0) {
    hours = 12;
  }
  else if (hours > 12) {
    hours -= 12;
    ampm = "PM";
  }
  
  if (1 == minutes.length)
    minutes = '0' + minutes;
  if (1 == seconds.length)
    seconds = '0' + seconds;
  
  var localtime = hours + ":" + minutes + ":" + seconds + " " + ampm
  return localtime;
}

var addTimeOnDayTransition = function(markerDay, incrAmount) {
  if (currentDay != prevDay && currentDay == markerDay) {
    timeLeft += incrAmount;
  }
}

class DebugDate extends Date {
  constructor () {
    var actualTime = super().getTime();
    super.setTime(actualTime + offset);
  }

  getHours() {
    var hours = super.getHours();
    return hours;
  }

  getDay() {
    var day = super.getDay();
    return day;
  }

  getMinutes() {
    var min = super.getMinutes();
    return min;
  }

  getSeconds() {
    var secs = super.getSeconds();
    return secs;
  }
}

var MyDate;
if (debugDate) {
  MyDate = DebugDate;
} else {
  MyDate = Date;
}

var updateTimeDate = function(timeLine, dateLine) {
  var date = new MyDate();
  currentHour = date.getHours();

  prevDay = currentDay;
  currentDay = date.getDay();

  // "The getDay() method returns the day of the week (from 0 to 6) for the specified date."
  // "Note: Sunday is 0, Monday is 1, and so on."
  // Detect the transition from the end of one week to the beginning
  // of the next, and update timeLeft.
  addTimeOnDayTransition(3, 4 * 60 * 60); // Weds, +4 hours
  addTimeOnDayTransition(5, 10 * 60 * 60); // Fri, +10 hours

  // If you're wondering how the time gets set to daylight savings time or not...
  // it's done in the settings menu on the Kinoma. Awkward.
  var timeStr = localTimeString(date);
  timeLine.first.string = timeStr;
  
  var dateStr = date.toLocaleDateString();
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
var tooEarlyString = offString + " (too early)";
var defaultFullTime = 14 * 60 * 60;
var backlightInterval = 10;
var backlightBright = 0.6;
var backlightDim = 0.08;

// TODO: put globals into a class.
var globalState = false;
var timeLeft = 0;
var currentHour = 0;
var prevDay = 0;
var currentDay = 0;
var netStartHour = 7;
var path = mergeURI(Files.documentsDirectory, application.di + "." + "time.json");

var backlightTimeLeft = backlightInterval;

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
  
  // Bug fix: previously, if the power was turned off, there was no chance to save timeLeft.
  // The exploit was: turn off after some time had elapsed, reboot, restart the app.
  // Fix: on power button press, save the timeLeft value. As an added bonus, return 
  // true to signal that the button down event has been handled (no menu popup). A long-press
  // of the button will still turn the Kinoma off. Bug: long-press power down leads to
  // a 0-length timeLeft file.
  onKeyDown: function(app, key, modifiers, repeat, ticks) {
    if (key.charCodeAt(0) == Event.FunctionKeyPower){
      trace("power button pressed, saving timeLeft: " + timeLeft + "\n");
      try {
        Files.writeJSON(path, timeLeft);
      } catch(err) {
        trace("writeJSON error: " + err.message + "\n");
      }
      return true;
    }
  },
  onKeyUp: function(app, key, modifiers, repeat, ticks){
    if (key.charCodeAt(0) == Event.FunctionKeyPower){
      trace("power button released\n");
      return true;
    }
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

var setBacklight = function(brightness) {
  trace("setting backlight: " + brightness + "\n");
  var message = new Message("xkpr://shell/settings/backlight");
  message.requestText = JSON.stringify(brightness);
  message.method = "PUT";
  application.invoke(message);
}

var theBehaviors = Behavior({
  onCreate: function(column, data) {
    trace("onCreate()\n");
    currentHour = 0;
    application.invoke(new Message("/firewall?network_mode=2"));
    
    var contents = column.first;
    var timeLeftLine = contents.first;
    var timeLine = contents.next;
    var dateLine = contents.next;
    
    if (!Files.exists(path)) {
      trace("no file '" + path + "'; creating it\n");
      timeLeft = defaultFullTime;
      Files.writeJSON(path, timeLeft);
    } else {
      try {
        timeLeft = Files.readJSON(path);
      } 
      catch(err) {
        // Recreate the file if exception occurs.
        trace("readJSON error: " + err.message + "; resetting timeLeft\n");
        timeLeft = 60 * 60; // 1 hour - don't want to reset to full time!
        Files.writeJSON(path, timeLeft);
      }
      if (timeLeft < 0)
        timeLeft = 0;
      trace("read time: " + timeLeft + " from file " + path + "\n");
    }
    timeLeftLine.string = timeString(timeLeft);
    updateTimeDate(timeLine, dateLine);
  },

  onTimeUpdated: function(column) {
    var contents = column.first;
    var timeLeftLine = contents.first;
    timeLeftLine.string = timeString(timeLeft);

    var timeLine = contents.next;
    var dateLine = contents.next.next;
    updateTimeDate(timeLine, dateLine);  

    if (globalState) {
      backlightTimeLeft = backlightInterval;
      if (timeLeft == 1) {
        globalState = false;
        // TODO: refactor into a call that updates the screen, turns off network access
        application.distribute("onTouchEnded");
      }
      
      // TODO: note assumption that we are called once per second. That might not be accurate.
      if (timeLeft > 0)
        timeLeft--;
    } else {
      // if not enabled, dim the backlight after a little while. 
      if (backlightTimeLeft == 1) {
	    setBacklight(backlightDim);
	    // trace("trying to quit\n");
        // Host.prototype.quit();
      }
      if (backlightTimeLeft > 0) {
        backlightTimeLeft--;
      }
    }
  },
  
  onTouchBegan: function(column, id, x, y, ticks) {
    // Todo: allow turning internet off, even if it's past midnight but before 7.
    if (backlightTimeLeft > 2) {
      if (timeLeft > 0 && currentHour >= netStartHour) {
        globalState = !globalState;
      }
      
      column.skin = touchSkin;
    }
  },
  
  onTouchEnded: function (column, id, x, y, ticks) {
    // If the backlight was set low, set it high and
    // ignore this touch.
    // Overlap by one second: assume the backlight is dim
    // at 2 seconds and less; this might mean setting it
    // high when it's already high, but that's better than
    // failing to set it high when it's dime.
    if (backlightTimeLeft <= 2) {
	  setBacklight(backlightBright);
      backlightTimeLeft = backlightInterval;
      return;
    }
  
    var contents = column.first;
    var statusLine = contents.next.next.next;
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
      new Label({left:0, right:0, top:0, bottom:0, height: 0, string: "Current Time", style: timeDateStyle}),
      ],
    }),
    new Line({
      left:0,
      right:0,
      top:0,
      bottom:0,
      contents: [
      new Label({left:0, right:0, top:0, bottom:0, height: 0, string: "Current Date", style: timeDateStyle}),
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
  "/backlight",
  Behavior({
    onInvoke: function(handler, message) {
      handler.invoke(new Message("xkpr://shell/settings/backlight"), Message.JSON);
    },
    onComplete: function(handler, message, data) {
      trace("backlight onComplete");
      trace("message.status: " + message.status + "\n");
      trace("data: " + data + "\n");
    }
  })
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
setBacklight(backlightBright);
application.behavior = appBehaviors;
application.invoke(new Message("/time"));
